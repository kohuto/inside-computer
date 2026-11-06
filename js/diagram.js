window.HWLab = window.HWLab || {};
(function (Lab) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';

  // Souřadnice součástí na jednom místě. Trasy vycházejí z bodů na jejich okrajích.
  const layout = {
    viewBox: '0 0 1320 730',
    boundary: { x:50, y:20, w:995, h:610 },
    nodes: {
      ram:      { x:470,  y:25,  w:220, h:150 },
      cpu:      { x:480,  y:370, w:200, h:130 },
      ssd:      { x:70,   y:387.5, w:180, h:95 },
      uefi:     { x:282.5,y:252.5,w:120,h:70 },
      audio:    { x:820,  y:230, w:200, h:75 },
      network:  { x:820,  y:60,  w:200, h:80 },
      gpu:      { x:820,  y:387.5, w:200, h:95 },
      vram:     { x:820,  y:525, w:200, h:85 },
      psu:      { x:210,  y:608, w:160, h:60 },
      outlet:   { x:125,  y:650, w:60,  h:64 },
      mouse:    { x:550,  y:650, w:60,  h:64 },
      powerbutton:{ x:550,y:650,w:60,h:64 },
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
  // Zaoblení používá stejnou geometrii pro podklad, šipku i pohyblivé zprávy.
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
  const route = (points, options = {}) => ({
    points, d:pathData(points,options.radius),
    ...options
  });
  const bus = { top:[755,port('ram','right')[1]], audio:[755,port('audio','left')[1]], bottom:[755,port('cpu','right')[1]] };
  const firmwareBranch = [port('uefi','right'),[435,port('uefi','right')[1]],[435,port('cpu','left')[1]]];
  // Logické trasy sdílejí jednu svislou cestu a připojují se ve středech stran.
  const routes = {
    mouseCpu: route([port('mouse','top'), port('cpu','bottom')], {labelWidth:136}),
    cpuSsd: route([port('cpu','left'), port('ssd','right')], {labelWidth:176}),
    uefiCpu: route([...firmwareBranch,port('cpu','left')], {labelWidth:164}),
    ssdRam: route([port('ssd','top'), [port('ssd','top')[0],bus.top[1]], port('ram','left')], {labelWidth:176,radius:24}),
    ramCpu: route([port('ram','bottom'), port('cpu','top')], {labelWidth:164}),
    cpuGpu: route([port('cpu','right'), port('gpu','left')], {labelWidth:124}),
    cpuNetwork: route([port('cpu','right'), bus.bottom, bus.top, port('network','left')], {labelWidth:124}),
    ramGpu: route([port('ram','right'), bus.top, bus.bottom, port('gpu','left')], {labelWidth:176}),
    ramVram: route([port('ram','right'), bus.top, bus.bottom, [bus.bottom[0],port('vram','left')[1]], port('vram','left')], {labelWidth:176,dedicated:true}),
    gpuVram: route([port('gpu','bottom'),port('vram','top')], {labelWidth:176,dedicated:true}),
    gpuMonitor: route([port('gpu','right'), port('monitor','left')], {labelWidth:124}),
    networkServer: route([port('network','right'), port('server','left')], {labelWidth:140,network:true}),
    serverNetwork: route([port('server','left'), port('network','right')], {labelWidth:140,network:true}),
    networkRam: route([port('network','left'), port('ram','right')], {labelWidth:124}),
    ramAudio: route([port('ram','right'), bus.top, bus.audio, port('audio','left')], {labelWidth:176}),
    audioCpu: route([port('audio','left'), bus.audio, bus.bottom, port('cpu','right')], {labelWidth:124}),
    audioSpeakers: route([port('audio','right'), port('speakers','left')], {labelWidth:124})
  };
  // Podklad kreslí každý úsek právě jednou; mnoho logických tras používá tentýž úsek.
  const connections = {
    mouseCpu:routes.mouseCpu, cpuSsd:routes.cpuSsd, ssdRam:routes.ssdRam,
    // Poslední úsek k CPU sdílí podklad s cpuSsd; nekreslí se podruhé.
    uefiBranch:route(firmwareBranch),
    ramCpu:routes.ramCpu,
    ramNetwork:routes.networkRam, cpuGpu:routes.cpuGpu,
    shared:route([bus.top,bus.bottom]), audioBranch:route([bus.audio,port('audio','left')]),
    vramBranch:route([bus.bottom,[bus.bottom[0],port('vram','left')[1]],port('vram','left')], {dedicated:true}),
    gpuVram:routes.gpuVram,
    gpuMonitor:routes.gpuMonitor, networkServer:routes.networkServer, audioSpeakers:routes.audioSpeakers
  };
  // Samostatná vrstva energie. Obvodová trasa představuje více napájecích cest
  // přes desku a kabely, nikoli jediný skutečný vodič ani datovou sběrnici.
  const power = {
    components:['ram','cpu','ssd','uefi','network','audio','gpu'],
    dedicatedComponents:['vram'],
    ac:route([
      port('outlet','right'),
      [port('psu','bottom')[0],port('outlet','right')[1]],
      port('psu','bottom')
    ]),
    dc:route([port('psu','right'),[1053,638],[1053,12],[42,12],[42,638],[68,638]], {radius:10})
  };
  const powerBadge = id => {
    const b = layout.nodes[id];
    return `<g class="power-badge" id="power-badge-${id}" data-component="${id}" transform="translate(${b.x-10} ${b.y+14})"><title>Napájeno ze zdroje přes desku nebo napájecí kabely</title><rect x="-9" y="-12" width="18" height="24" rx="5"/><path d="M2-8-5 1h5l-2 7L6-1H1Z"/></g>`;
  };
  // Samostatný symbol chlazení ve volném místě pod CPU, vedle oblasti VRAM.
  const cooling = { x:699, y:555, w:50, h:50 };
  const coolingMotion = state => {
    const powered = state.effects.powered !== false;
    const elapsed = !powered || state.index < 0 ? 0
      : state.steps.slice(0,state.index).reduce((time,step)=>time+step.duration,0)+state.step.duration*state.progress;
    return {powered,angle:(elapsed*.09)%360};
  };
  const flowPath = flow => flow.reverse
    ? pathData([...routes[flow.route].points].reverse(),routes[flow.route].radius)
    : routes[flow.route].d;
  const sameFlow = (a,b) => a.route === b.route && !!a.reverse === !!b.reverse && a.label === b.label;
  // Přenos, který pokračuje přes několik fází, se při změně fáze nevrací na začátek.
  // Nově přidaná zpráva naopak projde celou cestu během svého vlastního úseku.
  const transferProgress = (flow, state) => {
    const phases = state.step?.phases;
    if (!phases) return state.progress;
    const contains = i => (phases[i].flows ?? state.step.flows).some(f => sameFlow(f,flow));
    let first = state.phaseIndex, last = first;
    while (first > 0 && contains(first-1)) first--;
    while (last < phases.length-1 && contains(last+1)) last++;
    const start = phases[first].at, end = phases[last+1]?.at ?? 1;
    return Math.max(0,Math.min(1,(state.progress-start)/(end-start)));
  };
  const activityPositions = {
    gpu: { label:point('gpu',layout.nodes.gpu.w/2,70), labelWidth:180 },
    ssd: { label:point('ssd',layout.nodes.ssd.w/2,-35), labelWidth:180 },
    power: { label:point('psu',layout.nodes.psu.w/2,-43),labelWidth:176 }
  };
  // Obsah využívá celou plochu pod názvem. Menší paměti mají kompaktnější
  // odsazení; písmo se měří podle počtu položek a skutečně zalomených řádků.
  const memoryAreas = {
    ram:  { x:12, y:46, w:196, h:92, fontSize:24, paddingX:10, paddingY:8 },
    ssd:  { x:10, y:36, w:160, h:49, fontSize:20, paddingX:6, paddingY:1 },
    uefi: { x:8, y:32, w:104, h:30, fontSize:18, paddingX:6, paddingY:3 },
    vram: { x:8, y:34, w:184, h:45, fontSize:20, paddingX:3, paddingY:0 }
  };
  const serverIcon = (x, y) => `<g class="node-icon" transform="translate(${x} ${y})"><rect x="0" y="0" width="34" height="12" rx="3"/><rect x="0" y="17" width="34" height="12" rx="3"/><path d="M8 6h14M8 23h14m6-17h1m-1 17h1"/></g>`;
  // Jednoduché bloky ponechávají místo názvům, obsahu pamětí a stavům simulace.
  const box = (id, content) => {
    const b = layout.nodes[id];
    const radius = id === 'cpu' ? 8 : ['ram','ssd'].includes(id) ? 5 : 10;
    return `<g id="node-${id}" class="diagram-node component-${id}" transform="translate(${b.x} ${b.y})"><rect class="node-box" width="${b.w}" height="${b.h}" rx="${radius}"/>${content}</g>`;
  };

  const editorScreen = `<g id="screen-editor"><title>Otevřený textový editor s rozepsaným dokumentem poznamky.txt</title><rect x="1059" y="258" width="115" height="69" rx="3" fill="#fff" stroke="#dce3ee"/><rect x="1059" y="258" width="115" height="12" rx="3" fill="#e8edf7"/><text class="editor-toolbar" x="1063" y="266">Textový editor</text><rect x="1142" y="260" width="28" height="8" rx="2" fill="#5275d2"/><text class="editor-save" x="1156" y="266" text-anchor="middle">Uložit</text><text class="editor-text" x="1064" y="283" font-weight="650">Moje poznámky</text><text class="editor-text" x="1064" y="298">Dnes se učím</text><text class="editor-text" x="1064" y="309">ukládat soubory.</text><text class="editor-toolbar" x="1064" y="322">poznamky.txt</text></g>`;

  const bootScreens = `<g id="screen-black"><rect x="1055" y="253" width="123" height="79" rx="3" fill="#202b40"/></g><g id="screen-login"><title>Přihlašovací obrazovka operačního systému</title><rect x="1055" y="253" width="123" height="79" rx="3" fill="#dce9f3"/><circle cx="1117" cy="275" r="8" fill="#6d91ab"/><path d="M1103 295v-3a14 14 0 0 1 28 0v3Z" fill="#6d91ab"/><text class="login-label" x="1117" y="308" text-anchor="middle">Přihlášení</text><rect x="1091" y="314" width="52" height="10" rx="3" fill="#fff"/><path d="m1135 317 3 2-3 2" fill="none" stroke="#52728c" stroke-width="1.2"/></g>`;

  class Diagram {
    constructor(container) {
      container.innerHTML = `<svg viewBox="${layout.viewBox}" role="img" aria-labelledby="diagram-title diagram-desc">
        <title id="diagram-title">Spolupráce součástí počítače</title>
        <desc id="diagram-desc">RAM je nad procesorem, SSD vlevo. Vpravo jsou pod sebou síťové rozhraní, zvuková část a grafická část, připojené společnou logickou cestou k RAM a CPU. Spojnice vycházejí ze středů stran. Mimo počítač je dole myš, vpravo reproduktory nad monitorem a u videa také server. Šipky znázorňují logickou komunikaci, nikoli přesné fyzické zapojení. Při přehrávání mohou obrazový a zvukový výstup probíhat souběžně s příjmem dalších dat.</desc>
        <defs><marker id="arrow-flow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="userSpaceOnUse"><path class="flow-arrow" d="M0 0 8 4 0 8Z"/></marker></defs>
        <rect class="pc-boundary" x="${layout.boundary.x}" y="${layout.boundary.y}" width="${layout.boundary.w}" height="${layout.boundary.h}" rx="19"/>
        <g id="power-distribution" class="power-distribution" aria-label="Společně znázorněné napájení vnitřních součástí"><title>Napájení přes základní desku a kabely. Zlatá vrstva shrnuje více cest; neznázorňuje jediný skutečný vodič. Napětí se dále upravuje pro jednotlivé čipy.</title><rect class="power-field" x="50" y="20" width="995" height="610" rx="19"/><path class="power-rail power-rail-halo" d="${power.dc.d}"/><path class="power-rail" d="${power.dc.d}"/></g>
        <text class="boundary-label" x="${layout.boundary.x+22}" y="${layout.boundary.y+25}">UVNITŘ POČÍTAČE</text>
        <g id="gpu-card"><rect class="gpu-card-box" x="805" y="350" width="230" height="270" rx="12"/><text class="graphics-note" x="820" y="373">Dedikovaná karta</text></g>
        <g id="base-routes">${Object.entries(connections).map(([id,r]) => `<path id="route-${id}" class="route-base" d="${r.d}"/>`).join('')}</g>
        ${box('ram', '<text class="node-label" x="18" y="32">RAM</text><g id="memory-ram" aria-label="Zobrazený obsah RAM"></g>')}
        ${box('cpu', `<text class="node-label" x="18" y="32">Procesor</text><g id="cpu-software" transform="translate(12 ${layout.nodes.cpu.h-68})"><rect width="${layout.nodes.cpu.w-24}" height="56" rx="7"/><text class="software-caption" x="${(layout.nodes.cpu.w-24)/2}" y="20" text-anchor="middle">CPU vykonává</text><text id="cpu-software-name" class="software-name" x="${(layout.nodes.cpu.w-24)/2}" y="42" text-anchor="middle"></text></g>`)}
        <g id="cooling-fan" transform="translate(${cooling.x} ${cooling.y})" aria-label="Ventilátor chlazení počítače"><title>Elektricky napájený ventilátor představuje aktivní chlazení počítače. Jeho otáčení se řídí společným časem simulace.</title><g transform="translate(25 25)"><circle class="cooler-fan-ring" r="25"/><g id="cooler-rotor">${Array.from({length:5},(_,i)=>`<path class="cooler-blade" d="M-4-5C-11-20 2-28 12-19C17-15 15-7 5-3Z" transform="rotate(${i*72})"/>`).join('')}</g><circle class="cooler-fan-hub" r="5.5"/></g><text class="cooling-label" x="25" y="70" text-anchor="middle">Ventilátor</text></g>
        ${box('ssd', '<text class="node-label" x="14" y="27">SSD</text><g id="memory-ssd" aria-label="Zobrazený obsah SSD"></g>')}
        ${box('uefi', '<title>Flash paměť na základní desce uchovává firmware UEFI i bez napájení. Při startu CPU vykonává jeho kód, který připraví hardware a zahájí zavádění operačního systému. Tyto ukázky začínají až po startu počítače.</title><text class="node-label" x="10" y="22">Flash paměť</text><g id="memory-uefi" aria-label="Trvale uložený firmware UEFI"></g>')}
        ${box('audio', '<text class="node-label" x="18" y="29">Zvuková část</text>')}
        ${box('network', '<text class="node-label" x="18" y="29">Síťové rozhraní</text>')}
        ${box('gpu', '<text class="node-label" id="gpu-name" x="18" y="30">Grafická část</text>')}
        <text id="integrated-note" class="graphics-note" x="820" y="507">Integrovaná · sdílí RAM</text>
        ${box('vram', '<text class="node-label" x="18" y="27">VRAM</text><g id="memory-vram" aria-label="Zobrazený obsah VRAM"></g>')}
        <path class="power-input" d="${power.ac.d}"/>
        ${box('psu', '<title>Zdroj převádí vstupních 230 V střídavých na stejnosměrné výstupy 12 V, 5 V a 3,3 V. Měniče na desce a kartách napětí dále upravují pro jednotlivé čipy.</title><text class="node-label" x="80" y="38" text-anchor="middle">Zdroj</text>')}
        <g id="voltage-output" class="voltage-output" aria-label="Výstup zdroje: stejnosměrné napětí 12 V, 5 V a 3,3 V"><text class="voltage-kind" x="${layout.nodes.psu.x+layout.nodes.psu.w+8}" y="${layout.nodes.psu.y+layout.nodes.psu.h+12}"><tspan>Stejnosměrné </tspan><tspan x="${layout.nodes.psu.x+layout.nodes.psu.w+8}" dy="16">(12 V, 5 V, 3,3 V)</tspan></text></g>
        ${box('outlet', '<title>Zásuvka dodává střídavé napětí 230 V do zdroje počítače</title><g class="outlet-art" aria-hidden="true"><circle cx="30" cy="31" r="22"/><rect x="27" y="13" width="6" height="11" rx="2"/><circle cx="21" cy="35" r="3.2"/><circle cx="39" cy="35" r="3.2"/></g><text class="node-label" x="-16" y="29" text-anchor="end">Zásuvka</text><g id="voltage-input" aria-label="Vstup zdroje ze zásuvky: střídavé napětí 230 V"><text class="voltage-kind" x="-16" y="49" text-anchor="end">Střídavé (230 V)</text></g>')}
        <g class="diagram-node" id="node-mouse" transform="${placed('mouse',550,450)}"><rect class="node-box" x="550" y="450" width="60" height="64" rx="27"/><path class="node-icon" d="M580 451v25m-29 0h58"/><rect x="577" y="459" width="6" height="12" rx="3" fill="#9facbf"/><g id="mouse-click"><circle cx="565" cy="463" r="6" fill="var(--flow)" opacity=".25"/><path d="m554 444-5-6m14 3-1-7m-16 23-7-1" stroke="var(--flow)" stroke-width="2" stroke-linecap="round"/></g><text class="node-label" x="636" y="491">Myš</text></g>
        <g class="diagram-node" id="node-server" transform="${placed('server',1050,45)}"><rect class="node-box" x="1050" y="45" width="135" height="120" rx="12"/>${serverIcon(1100,64)}<text class="node-label" style="font-size:18px" x="1117" y="123" text-anchor="middle">Vzdálený</text><text class="node-label" style="font-size:18px" x="1117" y="145" text-anchor="middle">server</text><text class="external-note" x="1117" y="30">internet</text></g>
        <g class="diagram-node" id="node-monitor" transform="${placed('monitor',1048,246)}"><rect class="node-box" x="1048" y="246" width="137" height="95" rx="7"/><rect class="screen-content" x="1055" y="253" width="123" height="79" rx="3"/><path class="monitor-stand" d="M1116 341v15m-24 0h48"/><g id="screen-desktop"><rect x="1065" y="265" width="19" height="22" rx="3" fill="#5275d2"/><path d="M1069 270h11m-11 5h3m4 0h3m-10 5h3m4 0h3" stroke="#fff" stroke-width="1.5"/><text class="screen-tiny" x="1062" y="298">Kalkulačka</text></g><g id="screen-calculator"><rect x="1081" y="257" width="72" height="70" rx="4" fill="#fff" stroke="#c7d3ec"/><rect x="1086" y="265" width="62" height="14" rx="2" fill="#eef2fa"/><text x="1141" y="275" font-size="10" fill="#3a4e78" text-anchor="end">0</text>${Array.from({length:12},(_,i)=>`<rect x="${1086+(i%3)*21}" y="${284+Math.floor(i/3)*9}" width="18" height="6" rx="1.5" fill="${i===11?'#6b85d2':'#e0e7f5'}"/>`).join('')}</g><g id="screen-youtube"><rect x="1059" y="258" width="115" height="8" rx="2" fill="#e6eaf3"/><rect x="1063" y="260" width="10" height="5" rx="1" fill="#cf5555"/><rect x="1059" y="271" width="115" height="56" rx="2" fill="#dfebf0"/><g id="video-landscape"><circle class="video-sun" id="video-sun" cx="1149" cy="282" r="8"/><path class="video-land" d="m1059 312 28-23 23 18 28-13 36 21v12h-115Z"/><path class="video-mountain" d="m1059 319 29-9 22 9 33-17 31 19v6h-115Z"/><circle id="video-ball" cx="1081" cy="310" r="4" fill="#f5d39b"/></g><g id="video-play"><circle cx="1117" cy="298" r="12" fill="#fff" opacity=".92"/><path d="m1114 291 9 7-9 7Z" fill="#4261a4"/></g><path d="M1065 323h104" stroke="#fff" stroke-width="2"/><path id="video-progress" d="M1065 323h0" stroke="#cf5555" stroke-width="2"/></g>${editorScreen}${bootScreens}<g id="screen-loading"><rect x="1055" y="253" width="123" height="79" fill="#edf2fb"/><text class="screen-label" x="1117" y="297" text-anchor="middle">Příprava obrazu…</text></g><text class="node-label" x="1117" y="384" text-anchor="middle">Monitor</text></g>
        <g class="diagram-node" id="node-speakers" transform="${placed('speakers',1062,425)}"><rect class="node-box" x="1062" y="425" width="40" height="68" rx="6"/><rect class="node-box" x="1114" y="425" width="40" height="68" rx="6"/><g class="node-icon"><circle class="speaker-cone" cx="1082" cy="464" r="12"/><circle class="speaker-cone" cx="1134" cy="464" r="12"/><circle cx="1082" cy="440" r="4"/><circle cx="1134" cy="440" r="4"/></g><text class="node-label" x="1108" y="512" text-anchor="middle">Reproduktory</text></g>
        <g id="power-badges" class="power-badges">${[...power.components,...power.dedicatedComponents].map(powerBadge).join('')}<g class="power-badge" data-component="cooler" transform="translate(${cooling.x+cooling.w/2} ${cooling.y-14})"><title>Ventilátor je napájený ze základní desky</title><rect x="-9" y="-12" width="18" height="24" rx="5"/><path d="M2-8-5 1h5l-2 7L6-1H1Z"/></g><g class="power-badge" data-component="mouse" transform="translate(620 688)"><title>Myš je napájená přes USB ze základní desky</title><rect x="-9" y="-12" width="18" height="24" rx="5"/><path d="M2-8-5 1h5l-2 7L6-1H1Z"/></g></g>
        ${box('powerbutton','<title>Vypínač dá pokyn řídicím obvodům základní desky k zapnutí hlavního napájení</title><path class="power-button-icon" d="M30 12v20M17 20a20 20 0 1 0 26 0"/><text class="node-label" x="86" y="42">Vypínač</text>')}
        <g id="active-routes"></g><g id="packets"></g><g id="flow-labels"></g>
      </svg>`;
      this.svg = container.querySelector('svg');
      this.nodes = [...this.svg.querySelectorAll('.diagram-node')];
      this.currentKey = '';
      this.packets = [];
      this.memoryKeys = {};
      this.coolerRotor = this.svg.querySelector('#cooler-rotor');
    }

    render(state) {
      const key = `${state.scenario.id}:${state.graphics}:${state.index}:${state.phaseIndex}`;
      if (key !== this.currentKey) { this.currentKey = key; this.setStep(state); }
      this.renderMemory(state.displayMemory,state.scenario,state.graphics,state.effects);
      // effects může změnit reset i ve stejném kroku; žádný stav nezůstává z minulého scénáře.
      const e = state.effects;
      this.svg.classList.toggle('computer-off',e.powered === false);
      const motion = coolingMotion(state);
      this.coolerRotor.setAttribute('transform',`rotate(${motion.angle})`);
      this.svg.querySelector('#cpu-software-name').textContent = e.cpuSoftware || '';
      this.svg.querySelector('.software-caption').textContent = e.cpuSoftware === 'Čeká na start' ? 'CPU' : 'CPU vykonává';
      this.show('mouse-click', state.index === 0 && !!e.clicked);
      this.show('screen-desktop', e.screen === 'desktop');
      this.show('screen-calculator', e.screen === 'calculator');
      this.show('screen-editor', e.screen === 'editor');
      this.show('screen-youtube', e.screen === 'youtube' || e.screen === 'video');
      this.show('screen-loading', e.screen === 'loading');
      this.show('screen-black', e.screen === 'black');
      this.show('screen-login', e.screen === 'login');
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
      this.packets.forEach(({el,path,length,flow,arrow,label,leader}) => {
        const distance = transferProgress(flow,state) * length;
        const p = path.getPointAtLength(distance);
        const before = path.getPointAtLength(Math.max(0,distance-.5));
        const after = path.getPointAtLength(Math.min(length,distance+.5));
        const angle = Math.atan2(after.y-before.y,after.x-before.x)*180/Math.PI;
        el.setAttribute('transform', `translate(${p.x} ${p.y})`);
        arrow.setAttribute('transform', `rotate(${angle})`);
        if (label) {
          // Šipka jede přímo po spojnici. Čitelný vodorovný štítek ji doprovází
          // vedle čáry, aby u cíle nezakryl název komponenty.
          const position = this.packetLabelPosition(flow.route,p,label);
          const dx = position.x-p.x, dy = position.y-p.y;
          label.el.setAttribute('transform', `translate(${dx} ${dy})`);
          leader.setAttribute('x1',0); leader.setAttribute('y1',0);
          leader.setAttribute('x2',Math.max(dx-label.width/2,Math.min(0,dx+label.width/2)));
          leader.setAttribute('y2',Math.max(dy-label.height/2,Math.min(0,dy+label.height/2)));
        }
      });
    }

    show(id, visible) { this.svg.querySelector('#' + id).style.display = visible ? '' : 'none'; }

    // Obsah se odvozuje z dokončených zápisů. Nemá vlastní časovač a po resetu
    // i při přepnutí scénáře se obnoví ze stejného stavu jako všechny přenosy.
    renderMemory(memory, scenario, graphics, effects = {}) {
      for (const [id,area] of Object.entries(memoryAreas)) {
        if (id === 'vram' && graphics !== 'dedicated') continue;
        const items = id === 'uefi' ? [{id:'firmware',label:'UEFI'}] : (memory[id] || []);
        const empty = id === 'ram' && effects.ramReady === false ? 'RAM nepřipravena' : (scenario.emptyMemory?.[id] || (id === 'vram' ? 'Bez obrazových dat' : 'Bez sledovaných dat'));
        const key = JSON.stringify([items,empty]);
        if (this.memoryKeys[id] === key) continue;
        this.memoryKeys[id] = key;
        const layer = this.svg.querySelector('#memory-'+id); layer.replaceChildren();
        const entries = items.length ? items : [{label:empty,empty:true}];
        const gap = 3, height = (area.h-gap*(entries.length-1))/entries.length;
        for (const [index,item] of entries.entries()) {
          const y = area.y+index*(height+gap);
          const group = document.createElementNS(NS,'g');
          group.setAttribute('class',item.empty ? 'memory-placeholder' : 'memory-item');
          if (!item.empty) group.setAttribute('data-memory-id',item.id);
          group.setAttribute('aria-label',item.label);
          const rect = document.createElementNS(NS,'rect'), text = document.createElementNS(NS,'text');
          if (item.empty) text.setAttribute('class','memory-empty');
          text.setAttribute('text-anchor','middle');
          group.append(rect,text); layer.append(group);
          let lines, lineHeight, baselineOffset;
          const maxWidth = area.w-area.paddingX*2;
          const maxFontSize = item.empty ? Math.min(area.fontSize,20) : area.fontSize;
          for (let size=maxFontSize;size>=14;size-=.5) {
            text.style.fontSize = size+'px';
            const wrapped = this.wrapText(text,item.label,maxWidth);
            lines = wrapped.lines; lineHeight = size*1.1;
            const glyphs = text.getBBox();
            baselineOffset = -glyphs.y-glyphs.height/2;
            if (wrapped.width <= maxWidth && glyphs.height+(lines.length-1)*lineHeight <= height-area.paddingY*2) break;
          }
          text.replaceChildren();
          lines.forEach((line,i) => {
            const span = document.createElementNS(NS,'tspan');
            span.setAttribute('x',area.x+area.w/2);
            span.setAttribute('y',y+height/2+baselineOffset+(i-(lines.length-1)/2)*lineHeight);
            span.textContent = line+(i<lines.length-1?' ':''); text.append(span);
          });
          rect.setAttribute('x',area.x); rect.setAttribute('y',y);
          rect.setAttribute('width',area.w); rect.setAttribute('height',height); rect.setAttribute('rx',6);
        }
      }
    }

    wrapText(text, caption, maxWidth) {
      const lines = []; let line = '';
      for (const word of caption.split(' ')) {
        const candidate = line ? line+' '+word : word;
        text.textContent = candidate;
        if (line && text.getComputedTextLength() > maxWidth) { lines.push(line); line = word; }
        else line = candidate;
      }
      if (line) lines.push(line);
      let width = 0;
      for (const line of lines) { text.textContent = line; width = Math.max(width,text.getComputedTextLength()); }
      return {lines,width};
    }

    // Text se neotáčí s ohybem trasy a zalamuje se podle skutečné šířky písma.
    createLabel(layer, caption, maxWidth) {
      const group = document.createElementNS(NS,'g'); group.setAttribute('class','flow-label');
      group.setAttribute('aria-label',caption);
      const rect = document.createElementNS(NS,'rect');
      const text = document.createElementNS(NS,'text');
      group.append(rect,text); layer.append(group);
      const {lines,width} = this.wrapText(text,caption,maxWidth-20);
      text.replaceChildren();
      const lineHeight = 20, height = lines.length * lineHeight + 10;
      lines.forEach((line,i) => {
        const span = document.createElementNS(NS,'tspan');
        span.setAttribute('x',0); span.setAttribute('y',(i-(lines.length-1)/2)*lineHeight);
        span.textContent = line + (i < lines.length-1 ? ' ' : ''); text.append(span);
      });
      rect.setAttribute('x',-(width+20)/2); rect.setAttribute('y',-height/2);
      rect.setAttribute('width',width+20); rect.setAttribute('height',height);
      return {el:group,width:width+20,height};
    }

    packetLabelPosition(routeId, point, label) {
      const {width,height} = label;
      let x = point.x, y = point.y-height/2-44;
      if (routeId === 'mouseCpu') {
        x -= width/2+18;
        // U zásuvky a zdroje necháme nové popisky napětí odkryté.
        y = Math.min(point.y,layout.boundary.y+layout.boundary.h-height/2-12);
      }
      if (routeId === 'cpuSsd') x -= width/2+14;
      if (routeId === 'uefiCpu') {
        // Čtení firmwaru vede kolem jeho pouzdra, štítek zůstane vpravo
        // od flash a nad CPU i při závěrečném vstupu do procesoru.
        x += width/2+16;
        y = Math.min(y,port('cpu','top')[1]-height/2-8);
      }
      if (routeId === 'cpuNetwork' && height > 50) {
        const turn = Math.max(0,Math.min(1,(port('network','left')[1]+100-point.y)/100));
        const below = point.y+height/2+layout.nodes.network.h/2+10;
        y += (below-y)*turn;
      }
      if (routeId === 'ssdRam') {
        const from = port('ssd','top')[1], to = port('ram','bottom')[1];
        const turn = Math.max(0,Math.min(1,(from-point.y)/(from-to)));
        y = point.y+(height/2+16)*(2*turn-1);
        // U portu RAM zůstane štítek pod pamětí, aby nezakryl její uložený obsah.
        y = Math.max(y,port('ram','bottom')[1]+height/2+12);
      }
      if (routeId === 'ramCpu') {
        // Štítek zůstává mezi pamětí a procesorem, mimo jejich uložený obsah.
        x = port('cpu','top')[0]-width/2-12;
        y = Math.max(port('ram','bottom')[1]+height/2+8,
          Math.min(port('cpu','top')[1]-height/2-8,point.y));
      }
      if (this.svg.classList.contains('dedicated-graphics') && ['cpuGpu','ramGpu'].includes(routeId) && point.y > 350) {
        x = Math.max(x,port('cpu','right')[0]+width/2+12);
        y = Math.min(y,350-height/2-8);
      }
      if (routeId === 'ramVram') {
        // Štítek obejde nadpis karty zprava. Posun je plynulý a končí před VRAM,
        // zatímco značka dat pokračuje až do jejího středového portu.
        const left = Math.max(0,Math.min(1,(point.y-200)/60));
        x += (Math.min(x,port('audio','left')[0]-width/2-12)-x)*left;
        const turnX = Math.max(0,Math.min(1,(point.y-360)/60));
        const turnY = Math.max(0,Math.min(1,(point.y-420)/60));
        x += (port('monitor','left')[0]-12-width/2-x)*turnX;
        const above = Math.min(y,350-height/2-8);
        y = above+(Math.min(point.y,layout.nodes.vram.y-height/2-12)-above)*turnY;
      }
      if (routeId === 'gpuVram') {
        // Krátký vnitřní přenos má štítek vedle karty; názvy GPU a VRAM zůstávají čitelné.
        x = port('monitor','left')[0]-12-width/2; y = point.y;
      }
      const view = this.svg.viewBox.baseVal;
      return {x:Math.max(view.x+width/2+8,Math.min(view.x+view.width-width/2-8,x)),
        y:Math.max(view.y+height/2+8,Math.min(view.y+view.height-height/2-8,y))};
    }

    renderHighlights(highlights) {
      const layer = this.svg.querySelector('#flow-labels'); layer.replaceChildren();
      for (const item of highlights) {
        const position = activityPositions[item.target];
        const label = this.createLabel(layer,item.label,position.labelWidth || 144);
        label.el.setAttribute('data-target',item.target);
        label.el.setAttribute('transform',`translate(${position.label.join(' ')})`);
      }
    }

    setStep(state) {
      const active = state.active;
      this.nodes.forEach(el => el.classList.toggle('active', active.includes(el.id.slice(5))));
      const dedicated = state.graphics === 'dedicated';
      const boot = !!state.scenario.diagram?.boot;
      this.show('node-powerbutton',boot);this.show('cpu-software',boot);
      this.show('node-mouse',!boot);
      this.svg.querySelector('[data-component="mouse"]').style.display = boot ? 'none' : '';
      this.svg.classList.toggle('dedicated-graphics', dedicated);
      this.svg.querySelector('#gpu-name').textContent = dedicated ? 'GPU' : 'Grafická část';
      const firmwareDescription = 'Flash paměť na základní desce uchovává firmware UEFI i bez napájení. Při startu CPU vykonává jeho kód, který připraví hardware a zahájí zavádění operačního systému.';
      this.svg.querySelector('#node-uefi > title').textContent = firmwareDescription + (boot ? ' Tento scénář ukazuje jeho čtení při startu počítače.' : ' Tento scénář začíná až po startu počítače.');
      this.svg.querySelector('#diagram-desc').textContent = 'RAM je nad procesorem, SSD vlevo. Vlevo nad SSD je flash čip s trvale uloženým firmwarem UEFI a logickým spojením s CPU. ' + (boot
        ? 'Scénář zapíná hlavní napájení vypínačem, čte firmware, připravuje RAM a načítá zavaděč a potřebné části systému. Pod CPU je označení právě vykonávaného softwaru. '
        : 'Tento scénář začíná po startu počítače, proto čip s UEFI nekomunikuje. ') + 'Vpravo jsou síťová, zvuková a grafická část. ' + (dedicated
        ? 'Dedikovaná grafická karta obsahuje GPU a vlastní paměť VRAM. Obrazové podklady se kopírují z RAM do VRAM; hotový obraz jde z karty přímo do monitoru.'
        : 'Integrovaná grafika sdílí systémovou RAM; je zde nakreslená jako funkční blok odděleně od CPU, nikoli jako samostatná karta.') + ' Spojnice vyjadřují logickou komunikaci, nikoli přesné fyzické zapojení. Monitor, reproduktory a případný server jsou mimo počítač.';
      this.show('gpu-card', dedicated); this.show('node-vram', dedicated); this.show('integrated-note', !dedicated);
      this.show('power-badge-vram', dedicated);
      this.svg.querySelector('#diagram-desc').textContent += ' Zásuvka napájí zdroj, který převádí 230 V střídavých na 12 V, 5 V a 3,3 V stejnosměrných. Zlatá vrstva a blesky souhrnně znázorňují napájení vnitřních součástí přes desku a kabely. Napětí se pro čipy dále upravuje. Monitor, reproduktory a server mají vlastní napájení mimo zobrazený zdroj. ' + (boot ? 'Před stiskem vypínače jsou hlavní výstupy zdroje vypnuté; pohotovostní napájení není samostatně zakreslené.' : 'Myš pod počítačem dostává 5 V přes USB. Napájení je přítomné během celé ukázky, i u součástí, které právě neposílají data.');
      this.svg.querySelector('#diagram-desc').textContent += ' Dole mezi procesorem a oblastí grafiky je jednoduchý ventilátor představující aktivní chlazení počítače. Otáčení používá společný čas simulace; pauza zastaví i ventilátor.';
      const view = state.scenario.diagram || {};
      this.show('node-server', !!view.server);
      Object.entries(connections).forEach(([id,r]) => this.show('route-' + id, (!r.dedicated || dedicated) && (!r.network || view.server)));
      this.show('route-mouseCpu',!boot);
      const activeRoutes = this.svg.querySelector('#active-routes');
      activeRoutes.innerHTML = state.flows.map(f => {
        const d = flowPath(f);
        return `<path class="route-active" d="${d}" marker-end="url(#arrow-flow)"/>`;
      }).join('');
      this.renderHighlights(state.highlights);
      const packets = this.svg.querySelector('#packets'); packets.replaceChildren(); this.packets = [];
      const paths = activeRoutes.querySelectorAll('.route-active');
      state.flows.forEach((flow, index) => {
        // Jeden pojmenovaný balíček putuje od zdroje až do cíle, bez přeskoku zpět.
        const path = paths[index]; const length = path.getTotalLength();
        const el = document.createElementNS(NS,'g'); el.setAttribute('class','flow-packet');
        el.setAttribute('data-route',flow.route); packets.append(el);
        const leader = document.createElementNS(NS,'line'); leader.setAttribute('class','packet-leader');
        const arrow = document.createElementNS(NS,'path'); arrow.setAttribute('d','M-7-5 6 0-7 5Z');
        arrow.setAttribute('class','flow-particle'); arrow.setAttribute('aria-hidden','true');
        el.append(leader,arrow);
        const label = flow.label ? this.createLabel(el,flow.label,routes[flow.route].labelWidth || 144) : null;
        leader.style.display = label ? '' : 'none';
        this.packets.push({el,path,length,flow,arrow,label,leader});
      });
    }
  }
  Lab.Diagram = Diagram;
  Lab.routes = routes;
  Lab.connections = connections;
  Lab.layout = layout;
  Lab.power = power;
  Lab.cooling = cooling;
  Lab.coolingMotion = coolingMotion;
  Lab.transferProgress = transferProgress;
})(window.HWLab);
