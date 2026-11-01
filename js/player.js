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
      this.detailed = false; this.frame = null;
      this.select(scenarios[0].id, false);
    }
    select(id, detailed = this.detailed) {
      const scenario = this.scenarios.find(s => s.id === id);
      if (!scenario) throw new Error('Neznámý scénář: ' + id);
      this.stopClock(); this.scenario = scenario; this.detailed = detailed;
      this.steps = scenario.createSteps(detailed); this.reset();
    }
    stopClock() {
      if (this.frame !== null) this.cancel(this.frame);
      this.frame = null; this.lastTime = null;
    }
    reset() {
      this.stopClock(); this.index = -1; this.elapsed = 0; this.status = 'ready'; this.emit();
    }
    play() {
      if (this.status === 'playing') return;
      if (this.status === 'ended') this.reset();
      if (this.index === -1) { this.index = 0; this.elapsed = 0; }
      else if (this.elapsed >= this.steps[this.index].duration) {
        this.index++; this.elapsed = 0;
      }
      this.status = 'playing'; this.lastTime = null; this.emit();
      this.frame = this.request(time => this.tick(time));
    }
    pause() {
      if (this.status !== 'playing') return;
      this.stopClock(); this.status = 'paused'; this.emit();
    }
    next() {
      if (this.status === 'ended') return;
      this.stopClock();
      const current = this.snapshot();
      // Vícefázový krok lze prohlédnout po částech, bez dalšího číslovaného kroku.
      if (current.step?.phases && current.phaseIndex < current.step.phases.length - 1) {
        const nextEnd = current.step.phases[current.phaseIndex + 2]?.at ?? 1;
        this.elapsed = nextEnd * current.step.duration;
      } else {
        this.index = Math.min(this.index + 1, this.steps.length - 1);
        const step = this.steps[this.index];
        this.elapsed = (step.phases?.[1]?.at ?? 1) * step.duration;
      }
      this.status = this.index === this.steps.length - 1 && this.elapsed >= this.steps[this.index].duration ? 'ended' : 'paused';
      this.emit();
    }
    tick(time) {
      this.frame = null;
      if (this.status !== 'playing') return;
      // Po návratu ze skryté karty nepřeskočíme příběh. Čas zůstává didaktický.
      const delta = this.lastTime === null ? 0 : Math.max(0, Math.min(time - this.lastTime, 100));
      this.lastTime = time; this.elapsed += delta;
      while (this.elapsed >= this.steps[this.index].duration) {
        if (this.index === this.steps.length - 1) {
          this.elapsed = this.steps[this.index].duration; this.status = 'ended'; this.stopClock(); break;
        }
        this.elapsed -= this.steps[this.index].duration; this.index++;
      }
      this.emit();
      if (this.status === 'playing') this.frame = this.request(nextTime => this.tick(nextTime));
    }
    snapshot() {
      const step = this.index >= 0 ? this.steps[this.index] : null;
      const progress = step ? Math.min(1,this.elapsed/step.duration) : 0;
      // Na přesné hranici ukazujeme dokončenou předchozí fázi i při krokování.
      const phaseIndex = step?.phases ? step.phases.reduce((index,phase,i) => progress > phase.at + 1e-9 ? i : index, 0) : 0;
      const phase = step?.phases?.[phaseIndex];
      const effects = {...this.scenario.initial};
      for (let i=0;i<=this.index;i++) {
        const reached = this.steps[i];
        Object.assign(effects, reached.effects);
        reached.phases?.forEach((part,j) => {
          if (i < this.index || j <= phaseIndex) Object.assign(effects,part.effects);
        });
      }
      const phaseEnd = step?.phases?.[phaseIndex+1]?.at ?? 1;
      const phaseProgress = phase ? Math.min(1,Math.max(0,(progress-phase.at)/(phaseEnd-phase.at))) : progress;
      return { scenario:this.scenario, detailed:this.detailed, steps:this.steps, index:this.index,
        progress, phaseIndex, phaseProgress, status:this.status, step, effects,
        active:phase?.active ?? step?.active ?? [], flows:phase?.flows ?? step?.flows ?? [],
        highlights:phase?.highlights ?? step?.highlights ?? [] };
    }
    emit() { this.onChange(this.snapshot()); }
  }
  Lab.Player = Player;
})(window.HWLab);
