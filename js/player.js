/* Jediný časovač řídí všechny pohyby. Pauza ruší RAF; reset ruší i rozpracovaný krok.
   Vykreslovač dostává kompletní stav odvozený od výchozího stavu a již prošlých kroků. */
window.HWLab = window.HWLab || {};
(function (Lab) {
  'use strict';
  class Player {
    constructor(scenarios, onChange, clock = {}) {
      this.scenarios = scenarios;
      this.onChange = onChange;
      this.request = clock.request || (fn => requestAnimationFrame(fn));
      this.cancel = clock.cancel || (id => cancelAnimationFrame(id));
      this.graphics = 'integrated'; this.frame = null;
      this.select(scenarios[0].id);
    }
    select(id, graphics = this.graphics) {
      const scenario = this.scenarios.find(s => s.id === id);
      if (!scenario) throw new Error('Neznámý scénář: ' + id);
      if (!['integrated','dedicated'].includes(graphics)) throw new Error('Neznámá grafika: ' + graphics);
      this.stopClock(); this.scenario = scenario;
      this.graphics = graphics;
      this.steps = scenario.createSteps(graphics); this.reset();
    }
    stopClock() {
      if (this.frame !== null) this.cancel(this.frame);
      this.frame = null; this.lastTime = null;
    }
    reset() {
      this.stopClock(); this.stepEnd = null; this.boundaryPhase = null;
      this.index = -1; this.elapsed = 0; this.status = 'ready'; this.emit();
    }
    prepareUnit() {
      const current = this.snapshot();
      if (this.index < 0 || this.elapsed >= this.steps[this.index].duration) {
        this.index++; this.elapsed = 0; this.boundaryPhase = null;
      } else {
        const start = current.step.phases?.[current.phaseIndex+1]?.at;
        if (start !== undefined && this.elapsed >= start*current.step.duration-1e-7) {
          this.elapsed = start*current.step.duration; this.boundaryPhase = current.phaseIndex+1;
        }
      }
    }
    play() {
      this.stepEnd = null;
      if (this.status === 'playing') return;
      if (this.status === 'ended') this.reset();
      this.prepareUnit();
      this.status = 'playing'; this.lastTime = null; this.emit();
      this.frame = this.request(time => this.tick(time));
    }
    pause() {
      if (this.status !== 'playing') return;
      this.stopClock(); this.stepEnd = null; this.status = 'paused'; this.emit();
    }
    next() {
      if (this.status === 'ended') return;
      this.stopClock();
      this.prepareUnit();
      // Tlačítko přehraje jednu fázi a samo zastaví. Rozpracovaný přenos nejprve
      // dokončí, takže krokování nezahazuje jeho pohyb ani nevytváří další časovač.
      this.status = 'playing';
      const next = this.snapshot();
      this.stepEnd = (next.step.phases?.[next.phaseIndex+1]?.at ?? 1)*next.step.duration;
      this.emit();
      this.frame = this.request(time => this.tick(time));
    }
    tick(time) {
      this.frame = null;
      if (this.status !== 'playing') return;
      // Po návratu ze skryté karty nepřeskočíme příběh. Čas zůstává didaktický.
      const delta = this.lastTime === null ? 0 : Math.max(0, Math.min(time - this.lastTime, 100));
      this.lastTime = time; this.elapsed += delta;
      if (this.stepEnd !== null && this.elapsed >= this.stepEnd) {
        this.elapsed = this.stepEnd; this.stepEnd = null;
        this.status = this.index === this.steps.length-1 && this.elapsed >= this.steps[this.index].duration ? 'ended' : 'paused';
        this.stopClock(); this.emit(); return;
      }
      while (this.elapsed >= this.steps[this.index].duration) {
        if (this.index === this.steps.length - 1) {
          this.elapsed = this.steps[this.index].duration; this.status = 'ended'; this.stopClock(); break;
        }
        this.elapsed -= this.steps[this.index].duration; this.index++; this.boundaryPhase = null;
      }
      this.emit();
      if (this.status === 'playing') this.frame = this.request(nextTime => this.tick(nextTime));
    }
    snapshot() {
      const step = this.index >= 0 ? this.steps[this.index] : null;
      const progress = step ? Math.min(1,this.elapsed/step.duration) : 0;
      // Hranice drží dokončenou fázi. Nové spuštění může na stejné hranici ukázat
      // začátek následující fáze; samotná pauza tento výběr nikdy nezmění.
      let phaseIndex = step?.phases ? step.phases.reduce((index,phase,i) => progress > phase.at+1e-9 ? i : index, 0) : 0;
      if (this.boundaryPhase !== null && Math.abs(progress-(step?.phases?.[this.boundaryPhase]?.at ?? -1))<1e-9) {
        phaseIndex = this.boundaryPhase;
      }
      const phase = step?.phases?.[phaseIndex];
      const effects = {...this.scenario.initial};
      const memory = Object.fromEntries(Object.entries({ram:[],ssd:[],...(this.graphics === 'dedicated' ? {vram:[]} : {}),...this.scenario.initialMemory})
        .map(([id,items]) => [id,items.map(item => ({...item}))]));
      // RAM ukazuje jen právě probíraný obsah. Úplný model paměti zůstává
      // zachovaný, aby šlo později číst i dříve uložená data.
      let ramDisplay = memory.ram.slice(-1).map(item => ({...item}));
      const focusRam = (ids, label) => {
        const items = ids.map(id => memory.ram.find(item => item.id === id)).filter(Boolean);
        if (!items.length) return;
        ramDisplay = [{id:items.map(item => item.id).join('+'),label:label || items.map(item => item.label).join(' + ')}];
      };
      const focusStep = part => {
        // Nový obsah příchozího zápisu zobrazíme teprve po jeho dojezdu.
        if (part.ramFocus && !part.memoryWrites?.ram) focusRam(part.ramFocus.ids,part.ramFocus.label);
      };
      const focusWrite = part => {
        if (part.memoryWrites?.ram) focusRam(part.memoryWrites.ram.map(item => item.id),part.ramFocus?.label);
      };
      const writeMemory = writes => Object.entries(writes || {}).forEach(([id,items]) => {
        const contents = memory[id] || (memory[id] = []);
        for (const item of items) {
          const index = contents.findIndex(stored => stored.id === item.id);
          if (index < 0) contents.push({...item});
          else contents[index] = {...item};
        }
      });
      for (let i=0;i<=this.index;i++) {
        const reached = this.steps[i];
        Object.assign(effects, reached.effects);
        focusStep(reached);
        // Uložení nastane při dojezdu zprávy, nikoli už při zahájení kroku.
        if (i < this.index || progress >= 1) {
          writeMemory(reached.memoryWrites);
          focusWrite(reached);
          Object.assign(effects,reached.completionEffects);
        }
        reached.phases?.forEach((part,j) => {
          if (i < this.index || j <= phaseIndex) {
            Object.assign(effects,part.effects);
            focusStep(part);
          }
          if (i < this.index || progress >= (reached.phases[j+1]?.at ?? 1)) {
            writeMemory(part.memoryWrites);
            focusWrite(part);
            Object.assign(effects,part.completionEffects);
          }
        });
      }
      const phaseEnd = step?.phases?.[phaseIndex+1]?.at ?? 1;
      const phaseProgress = phase ? Math.min(1,Math.max(0,(progress-phase.at)/(phaseEnd-phase.at))) : progress;
      return { scenario:this.scenario, graphics:this.graphics, steps:this.steps, index:this.index,
        progress, phaseIndex, phaseProgress, status:this.status, step, effects, memory,
        displayMemory:{...memory,ram:ramDisplay},
        active:phase?.active ?? step?.active ?? [], flows:phase?.flows ?? step?.flows ?? [],
        highlights:phase?.highlights ?? step?.highlights ?? [] };
    }
    emit() { this.onChange(this.snapshot()); }
  }
  Lab.Player = Player;
})(window.HWLab);
