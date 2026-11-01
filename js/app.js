(function (Lab) {
  'use strict';
  const $ = id => document.getElementById(id);
  const icons = {
    calculator:'<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h1m3 0h1m3 0h1M8 15h1m3 0h1m3 0h1M8 19h1m3 0h1m3 0h1"/>',
    video:'<rect x="2" y="4" width="20" height="16" rx="4"/><path d="m10 8 6 4-6 4Z"/>'
  };
  $('scenario-options').innerHTML = Lab.scenarios.map((s,i)=>`<label class="scenario-card"><input type="radio" name="scenario" value="${s.id}" ${i===0?'checked':''}><span class="scenario-icon" aria-hidden="true"><svg viewBox="0 0 24 24">${icons[s.icon] || icons.calculator}</svg></span><span class="scenario-text">${s.shortTitle}<small>${s.subtitle}</small></span><span class="scenario-radio" aria-hidden="true"></span></label>`).join('');
  const diagram = new Lab.Diagram($('diagram-container'));
  let lastStep = '';
  const player = new Lab.Player(Lab.scenarios, state => {
    diagram.render(state);
    const stepKey = `${state.scenario.id}:${state.detailed}:${state.index}`;
    if (lastStep !== stepKey) {
      lastStep = stepKey;
      $('scenario-title').textContent = state.scenario.title;
      $('step-title').textContent = state.step ? state.step.title : state.effects.title;
      $('step-description').textContent = state.step ? state.step.description : state.effects.description;
      $('step-count').textContent = state.index < 0 ? 'VÝCHOZÍ STAV' : `KROK ${String(state.index+1).padStart(2,'0')} / ${String(state.steps.length).padStart(2,'0')}`;
      $('step-track').innerHTML = state.steps.map((_,i)=>`<i class="${i<state.index?'past':''}">${i===state.index?'<b></b>':''}</i>`).join('');
    }
    const progress = $('step-track').querySelector('b');
    if (progress) progress.style.width = `${state.progress*100}%`;
    const playing = state.status === 'playing';
    $('play').querySelector('span').textContent = playing ? 'Pozastavit' : state.status === 'ended' ? 'Přehrát znovu' : state.status === 'paused' ? 'Pokračovat' : 'Spustit';
    $('play').querySelector('svg').innerHTML = playing ? '<path d="M8 5h2v14H8Zm6 0h2v14h-2Z"/>' : '<path d="m8 5 11 7-11 7Z"/>';
    $('play').setAttribute('aria-label', $('play').querySelector('span').textContent + ' animaci');
    $('next').disabled = state.status === 'ended';
  });
  $('play').addEventListener('click', () => player.status === 'playing' ? player.pause() : player.play());
  $('next').addEventListener('click', () => player.next());
  $('reset').addEventListener('click', () => player.reset());
  document.querySelectorAll('[name=scenario]').forEach(input => input.addEventListener('change', () => player.select(input.value)));
  document.querySelectorAll('[name=detail]').forEach(input => input.addEventListener('change', () => {
    const detailed = input.value === 'detailed';
    $('detail-hint').textContent = detailed ? 'Navíc cache a registry uvnitř CPU.' : 'Hlavní součásti a cesta dat.';
    player.select(player.scenario.id, detailed);
  }));
  $('show-explanation').addEventListener('change', event => {
    $('explanation').hidden = !event.target.checked;
    $('step-area').classList.toggle('explanation-hidden', !event.target.checked);
  });
  // Skrytá karta scénář pozastaví, aby žák nepřišel o kroky. Sama jej znovu nespouští.
  document.addEventListener('visibilitychange', () => { if (document.hidden) player.pause(); });
})(window.HWLab);
