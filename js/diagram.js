window.HWLab = window.HWLab || {};
(function (Lab) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  // Souřadnice součástí na jednom místě. Trasy vycházejí z bodů na jejich okrajích.
  const layout = {
    viewBox: '0 0 1320 680',
    boundary: { x:50, y:20, w:995, h:540 },
    nodes: {
      ram:      { x:470,  y:50,  w:220, h:100 },
      cpu:      { x:470,  y:340, w:220, h:190 },
      ssd:      { x:70,   y:397.5, w:180, h:75 },
      audio:    { x:820,  y:230, w:200, h:75 },
      network:  { x:820,  y:60,  w:200, h:80 },
      gpu:      { x:820,  y:387.5, w:200, h:95 },
      mouse:    { x:550,  y:600, w:60,  h:64 },
      speakers: { x:1182, y:233.5, w:92,  h:68 },
      server:   { x:1160, y:40,  w:135, h:120 },
      monitor:  { x:1160, y:387.5, w:137, h:95 }
    }
  };
  const point = (id, dx, dy) => [layout.nodes[id].x + dx, layout.nodes[id].y + dy];
  const port = (id, side) => {
    const b = layout.nodes[id];
    return { top:point(id,b.w/2,0), bottom:point(id,b.w/2,b.h),
      left:point(id,0,b.h/2), right:point(id,b.w,b.h/2) }[side];
  };
  const placed = (id, x, y) => `translate(${layout.nodes[id].x-x} ${layout.nodes[id].y-y})`;
  // Zaoblení používá stejnou geometrii pro podklad, šipku i pohyblivé částice.
  const pathData = (points, radius = 0) => {
    let d = `M${points[0].join(' ')}`;
    for (let i=1;i<points.length-1;i++) {
      const [a,b,c] = [points[i-1],points[i],points[i+1]];
      const ab = Math.hypot(a[0]-b[0],a[1]-b[1]), bc = Math.hypot(c[0]-b[0],c[1]-b[1]);
      const r = Math.min(radius,ab/2,bc/2);
      if (!r || (a[0]-b[0])*(c[1]-b[1]) === (a[1]-b[1])*(c[0]-b[0])) { d += ` L${b.join(' ')}`; continue; }
      const before = b.map((v,j)=>v+(a[j]-v)*r/ab);
      const after = b.map((v,j)=>v+(c[j]-v)*r/bc);
      d += ` L${before.join(' ')} Q${b.join(' ')} ${after.join(' ')}`;
    }
    return d + ` L${points[points.length-1].join(' ')}`;
  };
  const route = (points, label, options = {}) => ({
    points, label, d:pathData(points,options.radius),
    ...options
  });
  const bus = { top:[755,port('ram','right')[1]], audio:[755,port('audio','left')[1]], bottom:[755,port('cpu','right')[1]] };
  const memoryLabel = [485,(port('ram','bottom')[1]+port('cpu','top')[1])/2];
  // Logické trasy sdílejí jednu svislou cestu a připojují se ve středech stran.
  const routes = {
    mouseCpu: route([port('mouse','top'), port('cpu','bottom')], [480,565], {labelWidth:136}),
    cpuSsd: route([port('cpu','left'), port('ssd','right')], [360,bus.bottom[1]], {labelWidth:176}),
    ssdRam: route([port('ssd','top'), [port('ssd','top')[0],bus.top[1]], port('ram','left')], [160,245], {labelWidth:176,radius:24}),
    ramCpu: route([port('ram','bottom'), port('cpu','top')], memoryLabel, {labelWidth:164}),
    // V detailu stejný vstup do CPU pokračuje kolem nadpisu do středu pravé strany cache.
    ramCache: route([port('ram','bottom'), port('cpu','top'), point('cpu',110,8), point('cpu',210,8), point('cpu',210,73), point('cpu',202,73)], memoryLabel, {labelWidth:164,detailed:true,onUse:true,radius:5}),
    cacheRegisters: route([point('cpu',110,94), point('cpu',110,124)], null, {detailed:true,internal:true}),
    cpuGpu: route([port('cpu','right'), port('gpu','left')], [755,bus.bottom[1]+35], {labelWidth:124}),
    cpuNetwork: route([port('cpu','right'), bus.bottom, bus.top, port('network','left')], [755,(bus.audio[1]+bus.bottom[1])/2], {labelWidth:124}),
    ramGpu: route([port('ram','right'), bus.top, bus.bottom, port('gpu','left')], [710,memoryLabel[1]], {labelWidth:176}),
    gpuMonitor: route([port('gpu','right'), port('monitor','left')], [1090,bus.bottom[1]], {labelWidth:124}),
    networkServer: route([port('network','right'), port('server','left')], [1090,140], {labelWidth:140,network:true}),
    serverNetwork: route([port('server','left'), port('network','right')], [1090,140], {labelWidth:140,network:true}),
    networkRam: route([port('network','left'), port('ram','right')], [755,75], {labelWidth:124}),
    ramAudio: route([port('ram','right'), bus.top, bus.audio, port('audio','left')], [710,memoryLabel[1]], {labelWidth:176}),
    audioCpu: route([port('audio','left'), bus.audio, bus.bottom, port('cpu','right')], [755,(bus.audio[1]+bus.bottom[1])/2], {labelWidth:124}),
    audioSpeakers: route([port('audio','right'), port('speakers','left')], [1090,bus.audio[1]], {labelWidth:124})
  };
  // Podklad kreslí každý úsek právě jednou; mnoho logických tras používá tentýž úsek.
  const connections = {
    mouseCpu:routes.mouseCpu, cpuSsd:routes.cpuSsd, ssdRam:routes.ssdRam,
    ramCpu:routes.ramCpu, ramCache:routes.ramCache, cacheRegisters:routes.cacheRegisters,
    ramNetwork:routes.networkRam, cpuGpu:routes.cpuGpu,
    shared:route([bus.top,bus.bottom]), audioBranch:route([bus.audio,port('audio','left')]),
    gpuMonitor:routes.gpuMonitor, networkServer:routes.networkServer, audioSpeakers:routes.audioSpeakers
  };
  const flowPath = flow => flow.reverse
    ? pathData([...routes[flow.route].points].reverse(),routes[flow.route].radius)
    : routes[flow.route].d;
  const activityPositions = {
    cpu: { label:point('cpu',layout.nodes.cpu.w/2,105), labelWidth:180 },
    cpuRam: { label:[port('cpu','top')[0], memoryLabel[1]], labelWidth:220 },
    gpu: { label:point('gpu',layout.nodes.gpu.w/2,layout.nodes.gpu.h+32.5), labelWidth:200 }
  };
  const serverIcon = (x, y) => `<g class="node-icon" transform="translate(${x} ${y})"><rect x="0" y="0" width="34" height="12" rx="3"/><rect x="0" y="17" width="34" height="12" rx="3"/><path d="M8 6h14M8 23h14m6-17h1m-1 17h1"/></g>`;
  // Statické 2D motivy pouzder, čipů a kontaktů. Neznázorňují data ani další
  // paměti; velikost bloků a logické porty zůstávají stejné.
  const chip = (x,y,w,h) => `<path class="hardware-line" d="${[8,w-8].map(dx=>`M${x+dx} ${y-4}v4 M${x+dx} ${y+h}v4`).join(' ')} M${x-4} ${y+h/2}h4 M${x+w} ${y+h/2}h4"/><rect class="hardware-chip" x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/><path class="hardware-chip-mark" d="M${x+6} ${y+7}h${Math.min(w-12,14)}"/>`;
  const contact = (x,y,w,h) => `<rect class="hardware-contact" x="${x}" y="${y}" width="${w}" height="${h}" rx="1"/>`;
  const componentArt = {
    ram: `${[18,82,146].map(x=>chip(x,47,44,27)).join('')}<path class="hardware-line" d="M12 38h196 M12 80h196"/>${[18,30,42,54,66,78,90,126,138,150,162,174,186,198].map(x=>contact(x,87,6,9)).join('')}`,
    cpu: `<path class="cpu-pins hardware-line" d="${[28,48,68,88,132,152,172,192].map(x=>`M${x} -7v7 M${x} 190v7`).join(' ')} ${[45,65,125,145,165].map(y=>`M-7 ${y}h7 M220 ${y}h7`).join(' ')}"/><rect class="hardware-inset" x="11" y="43" width="198" height="137" rx="6"/><g class="cpu-silicon"><rect class="hardware-core" x="46" y="67" width="128" height="90" rx="5"/><path class="hardware-line" d="M60 82h100 M60 142h100 M60 91v42 M160 91v42"/><path class="hardware-trace" d="M24 58h13v21 M196 58h-13v21 M24 164h13v-21 M196 164h-13v-21"/></g>`,
    ssd: `${chip(102,16,42,43)}<path class="hardware-line" d="M18 46h49 M18 54h35 M74 37h20 M74 45h12v12h11"/>${[15,27,39,51].map(y=>contact(163,y,12,8)).join('')}<path class="hardware-line" d="M156 10v55"/>`,
    network: `${chip(18,44,30,22)}<path class="hardware-line" d="M56 55h35v-8h37 M62 63h41v-8h25"/><path class="hardware-socket" d="M139 41h43v28h-43Z M146 63h6v5h17v-5h6"/>${[146,150,154,158,162,166,170,174].map(x=>contact(x,45,2,9)).join('')}`,
    audio: `${chip(18,44,29,20)}<path class="hardware-line" d="M56 55h10l5-9 8 18 8-22 8 24 7-18 6 7h32"/><circle class="hardware-socket" cx="171" cy="55" r="11"/><circle class="hardware-jack" cx="171" cy="55" r="5"/>`,
    gpu: `${chip(18,48,38,30)}<rect class="hardware-core" x="28" y="56" width="18" height="14" rx="2"/><path class="hardware-line" d="M65 57h21v-9h29 M65 68h29v9h21"/><rect class="hardware-inset" x="130" y="45" width="52" height="35" rx="3"/>${[[136,51],[148,51],[160,51],[136,63],[148,63],[160,63]].map(([x,y])=>`<rect class="hardware-pixel" x="${x}" y="${y}" width="8" height="8" rx="1"/>`).join('')}`
  };
  const box = (id, content) => {
    const b = layout.nodes[id];
    const radius = id === 'cpu' ? 8 : ['ram','ssd'].includes(id) ? 5 : 10;
    return `<g id="node-${id}" class="diagram-node component-${id}" transform="translate(${b.x} ${b.y})"><rect class="node-box" width="${b.w}" height="${b.h}" rx="${radius}"/><g class="hardware-art" aria-hidden="true">${componentArt[id] || ''}</g>${content}</g>`;
  };

  class Diagram {
    constructor(container) {
      container.innerHTML = `<svg viewBox="${layout.viewBox}" role="img" aria-labelledby="diagram-title diagram-desc">
        <title id="diagram-title">Spolupráce součástí počítače</title>
        <desc id="diagram-desc">RAM je nad procesorem, SSD vlevo. Vpravo jsou pod sebou síťové rozhraní, zvuková část a grafická část, připojené společnou logickou cestou k RAM a CPU. Spojnice vycházejí ze středů stran. Mimo počítač je dole myš, vpravo reproduktory nad monitorem a u videa také server. Šipky znázorňují logickou komunikaci, nikoli přesné fyzické zapojení. Při přehrávání mohou obrazový a zvukový výstup probíhat souběžně s příjmem dalších dat.</desc>
        <defs><marker id="arrow-flow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path class="flow-arrow" d="M0 0 8 4 0 8Z"/></marker></defs>
        <rect class="pc-boundary" x="${layout.boundary.x}" y="${layout.boundary.y}" width="${layout.boundary.w}" height="${layout.boundary.h}" rx="19"/>
        <text class="boundary-label" x="${layout.boundary.x+22}" y="${layout.boundary.y+25}">UVNITŘ POČÍTAČE</text>
        <g id="base-routes">${Object.entries(connections).map(([id,r]) => `<path id="route-${id}" class="route-base" d="${r.d}"/>`).join('')}</g>
        ${box('ram', '<text class="node-label" x="18" y="32">RAM</text>')}
        ${box('cpu', `<text class="node-label" x="18" y="32">Procesor <tspan font-size="16" font-weight="400">CPU</tspan></text><g id="cpu-detail"><rect class="node-inner cache-box" x="18" y="52" width="184" height="42" rx="6"/><text class="inner-label cache-label" x="30" y="78">Cache CPU</text><rect class="node-inner registers-box" x="18" y="124" width="184" height="48" rx="6"/><text class="inner-label registers-label" x="30" y="145">Registry CPU</text><text class="inner-sub" x="30" y="163">jednotlivé hodnoty a adresy</text><text class="inner-sub" x="130" y="111">hodnoty ↓</text></g>`)}
        ${box('ssd', '<text class="node-label" x="18" y="33">SSD</text>')}
        ${box('audio', '<text class="node-label" x="18" y="29">Zvuková část</text>')}
        ${box('network', '<text class="node-label" x="18" y="29">Síťové rozhraní</text>')}
        ${box('gpu', '<text class="node-label" x="18" y="30">Grafická část</text>')}
        <g class="diagram-node" id="node-mouse" transform="${placed('mouse',550,450)}"><rect class="node-box" x="550" y="450" width="60" height="64" rx="27"/><path class="node-icon" d="M580 451v25m-29 0h58"/><rect x="577" y="459" width="6" height="12" rx="3" fill="#9facbf"/><g id="mouse-click"><circle cx="565" cy="463" r="6" fill="var(--flow)" opacity=".25"/><path d="m554 444-5-6m14 3-1-7m-16 23-7-1" stroke="var(--flow)" stroke-width="2" stroke-linecap="round"/></g><text class="node-label" x="636" y="491">Myš</text></g>
        <g class="diagram-node" id="node-server" transform="${placed('server',1050,45)}"><rect class="node-box" x="1050" y="45" width="135" height="120" rx="12"/>${serverIcon(1100,64)}<text class="node-label" style="font-size:18px" x="1117" y="123" text-anchor="middle">Vzdálený</text><text class="node-label" style="font-size:18px" x="1117" y="145" text-anchor="middle">server</text><text class="external-note" x="1117" y="30">internet</text></g>
        <g class="diagram-node" id="node-monitor" transform="${placed('monitor',1048,246)}"><rect class="node-box" x="1048" y="246" width="137" height="95" rx="7"/><rect class="screen-content" x="1055" y="253" width="123" height="79" rx="3"/><path class="monitor-stand" d="M1116 341v15m-24 0h48"/><g id="screen-desktop"><rect x="1065" y="265" width="19" height="22" rx="3" fill="#5275d2"/><path d="M1069 270h11m-11 5h3m4 0h3m-10 5h3m4 0h3" stroke="#fff" stroke-width="1.5"/><text class="screen-tiny" x="1062" y="298">Kalkulačka</text></g><g id="screen-calculator"><rect x="1081" y="257" width="72" height="70" rx="4" fill="#fff" stroke="#c7d3ec"/><rect x="1086" y="265" width="62" height="14" rx="2" fill="#eef2fa"/><text x="1141" y="275" font-size="10" fill="#3a4e78" text-anchor="end">0</text>${Array.from({length:12},(_,i)=>`<rect x="${1086+(i%3)*21}" y="${284+Math.floor(i/3)*9}" width="18" height="6" rx="1.5" fill="${i===11?'#6b85d2':'#e0e7f5'}"/>`).join('')}</g><g id="screen-youtube"><rect x="1059" y="258" width="115" height="8" rx="2" fill="#e6eaf3"/><rect x="1063" y="260" width="10" height="5" rx="1" fill="#cf5555"/><rect x="1059" y="271" width="115" height="56" rx="2" fill="#dfebf0"/><g id="video-landscape"><circle class="video-sun" id="video-sun" cx="1149" cy="282" r="8"/><path class="video-land" d="m1059 312 28-23 23 18 28-13 36 21v12h-115Z"/><path class="video-mountain" d="m1059 319 29-9 22 9 33-17 31 19v6h-115Z"/><circle id="video-ball" cx="1081" cy="310" r="4" fill="#f5d39b"/></g><g id="video-play"><circle cx="1117" cy="298" r="12" fill="#fff" opacity=".92"/><path d="m1114 291 9 7-9 7Z" fill="#4261a4"/></g><path d="M1065 323h104" stroke="#fff" stroke-width="2"/><path id="video-progress" d="M1065 323h0" stroke="#cf5555" stroke-width="2"/></g><g id="screen-loading"><rect x="1055" y="253" width="123" height="79" fill="#edf2fb"/><text class="screen-label" x="1117" y="297" text-anchor="middle">Příprava obrazu…</text></g><text class="node-label" x="1117" y="384" text-anchor="middle">Monitor</text></g>
        <g class="diagram-node" id="node-speakers" transform="${placed('speakers',1062,425)}"><rect class="node-box" x="1062" y="425" width="40" height="68" rx="6"/><rect class="node-box" x="1114" y="425" width="40" height="68" rx="6"/><g class="node-icon"><circle class="speaker-cone" cx="1082" cy="464" r="12"/><circle class="speaker-cone" cx="1134" cy="464" r="12"/><circle cx="1082" cy="440" r="4"/><circle cx="1134" cy="440" r="4"/></g><text class="node-label" x="1108" y="512" text-anchor="middle">Reproduktory</text></g>
        <g id="active-routes"></g><g id="particles" aria-hidden="true"></g><g id="flow-labels"></g>
      </svg>`;
      this.svg = container.querySelector('svg');
      this.nodes = [...this.svg.querySelectorAll('.diagram-node')];
      this.currentKey = '';
      this.particles = [];
    }

    render(state) {
      const key = `${state.scenario.id}:${state.detailed}:${state.index}:${state.phaseIndex}`;
      if (key !== this.currentKey) { this.currentKey = key; this.setStep(state); }
      // effects může změnit reset i ve stejném kroku; žádný stav nezůstává z minulého scénáře.
      const e = state.effects;
      this.show('mouse-click', state.index === 0 && !!e.clicked);
      this.show('screen-desktop', e.screen === 'desktop');
      this.show('screen-calculator', e.screen === 'calculator');
      this.show('screen-youtube', e.screen === 'youtube' || e.screen === 'video');
      this.show('screen-loading', e.screen === 'loading');
      this.show('video-play', !e.playback);
      // Rozsah lokální ukázky patří ke kroku; stejný čas řídí obraz, zvuk i přenos.
      const phase = e.playback ? e.playbackFrom + (e.playbackTo - e.playbackFrom) * state.progress : 0;
      this.svg.querySelector('#video-ball').setAttribute('cx', 1075 + phase * 29);
      this.svg.querySelector('#video-ball').setAttribute('cy', 311 - Math.sin(phase * Math.PI * 2) * 4);
      this.svg.querySelector('#video-sun').setAttribute('cx', 1149 - phase * 3);
      this.svg.querySelector('#video-progress').setAttribute('d', `M1065 323h${phase / 3 * 104}`);
      // Zvuk znázorňují přímo membrány reproduktorů, bez teček vedle nich.
      this.svg.querySelectorAll('.speaker-cone').forEach(el => {
        const pulse = (1 + Math.sin(phase * 15)) / 2;
        el.setAttribute('r', e.soundPlaying ? 12 + pulse * 1.5 : 12);
        el.setAttribute('fill', e.soundPlaying ? 'var(--flow)' : 'none');
        el.setAttribute('fill-opacity', e.soundPlaying ? .25 + pulse * .45 : 0);
      });
      this.particles.forEach(({el,path,length,offset}) => {
        const t = (state.phaseProgress * 1.5 + offset) % 1;
        const p = path.getPointAtLength(t * length);
        const q = path.getPointAtLength(Math.min(length, t * length + 1));
        const angle = Math.atan2(q.y-p.y,q.x-p.x)*180/Math.PI;
        el.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${angle})`);
      });
    }

    show(id, visible) { this.svg.querySelector('#' + id).style.display = visible ? '' : 'none'; }

    // Popisky se zalamují podle skutečně změřené délky textu, nikoli přes bloky.
    renderLabels(flows, highlights) {
      const layer = this.svg.querySelector('#flow-labels');
      layer.replaceChildren();
      const labels = [...flows.filter(f => f.label).map(f => ({...f,position:routes[f.route]})),
        ...highlights.map(h => ({...h,position:activityPositions[h.target]}))];
      for (const flow of labels) {
        const r = flow.position, [x,y] = r.label;
        const group = document.createElementNS(NS,'g'); group.setAttribute('class','flow-label');
        group.setAttribute('aria-label',flow.label);
        if (flow.target) group.setAttribute('data-target',flow.target);
        const rect = document.createElementNS(NS,'rect');
        const text = document.createElementNS(NS,'text');
        group.append(rect,text); layer.append(group);
        const maxTextWidth = (r.labelWidth || 144) - 20;
        const lines = []; let line = '';
        for (const word of flow.label.split(' ')) {
          const candidate = line ? line + ' ' + word : word;
          text.textContent = candidate;
          if (line && text.getComputedTextLength() > maxTextWidth) { lines.push(line); line = word; }
          else line = candidate;
        }
        if (line) lines.push(line);
        let width = 0;
        for (const line of lines) { text.textContent = line; width = Math.max(width,text.getComputedTextLength()); }
        text.replaceChildren();
        const lineHeight = 20, height = lines.length * lineHeight + 10;
        lines.forEach((line,i) => {
          const span = document.createElementNS(NS,'tspan');
          span.setAttribute('x',x); span.setAttribute('y',y + (i-(lines.length-1)/2)*lineHeight);
          span.textContent = line + (i < lines.length-1 ? ' ' : ''); text.append(span);
        });
        rect.setAttribute('x',x-(width+20)/2); rect.setAttribute('y',y-height/2);
        rect.setAttribute('width',width+20); rect.setAttribute('height',height);
      }
    }

    setStep(state) {
      const active = state.active;
      this.nodes.forEach(el => el.classList.toggle('active', active.includes(el.id.slice(5))));
      const cpu = this.svg.querySelector('#node-cpu');
      cpu.classList.toggle('detailed', state.detailed);
      cpu.classList.toggle('cache-active', active.includes('cache'));
      cpu.classList.toggle('registers-active', active.includes('registers'));
      this.show('cpu-detail', state.detailed);
      const view = state.scenario.diagram || {};
      this.show('node-server', !!view.server);
      Object.entries(connections).forEach(([id,r]) => this.show('route-' + id, (!r.detailed || state.detailed) && (!r.network || view.server) && (!r.onUse || state.flows.some(f => f.route === id))));
      this.svg.querySelector('#route-ramCpu').style.display = state.flows.some(f=>f.route==='ramCache') ? 'none' : '';
      const activeRoutes = this.svg.querySelector('#active-routes');
      activeRoutes.innerHTML = state.flows.map(f => {
        const d = flowPath(f);
        return `<path class="route-active" d="${d}" marker-end="url(#arrow-flow)"/>`;
      }).join('');
      this.renderLabels(state.flows, state.highlights);
      const particles = this.svg.querySelector('#particles'); particles.replaceChildren(); this.particles = [];
      const paths = activeRoutes.querySelectorAll('.route-active');
      state.flows.forEach((_, index) => {
        // Částice i koncová šipka sledují tutéž orientovanou cestu, včetně zápisu do RAM.
        const path = paths[index]; const length = path.getTotalLength();
        for (let i=0;i<(length>160?3:1);i++) {
          const el = document.createElementNS(NS, 'path');
          el.setAttribute('d', 'M-6-5 6 0-6 5Z'); el.setAttribute('class','flow-particle');
          particles.appendChild(el); this.particles.push({el,path,length,offset:i/3+.08});
        }
      });
    }
  }
  Lab.Diagram = Diagram;
  Lab.routes = routes;
  Lab.connections = connections;
  Lab.layout = layout;
})(window.HWLab);
