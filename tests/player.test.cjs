const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = {window:{}};
vm.createContext(context);
for (const file of ['scenarios.js','player.js','diagram.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file),'utf8'),context);
}
const {Player,scenarios,routes,layout,connections,transferProgress,power} = context.window.HWLab;
const graphicsScenarios=scenarios.filter(s=>s.createSteps(false).some(step=>step.flows.some(flow=>flow.route==='cpuGpu')));
const plain = value => JSON.parse(JSON.stringify(value));
const clocks = new WeakMap();
function stepForward(player) { player.next(); clocks.get(player)(100000); }
function harness(id='calculator',detailed=false,graphics='integrated') {
  let sequence=0, now=0;
  const pending = new Map();
  const changes=[];
  const player = new Player(scenarios, s=>changes.push(s), {
    request(fn) { const id=++sequence; pending.set(id,fn); return id; },
    cancel(id) { pending.delete(id); }
  });
  player.select(id,detailed,graphics);
  const advance = ms => {
    for(let remaining=ms;remaining>0;remaining-=Math.min(remaining,20)) {
      now+=Math.min(remaining,20); const callbacks=[...pending.values()]; pending.clear(); callbacks.forEach(fn=>fn(now));
    }
  };
  clocks.set(player,advance);
  return {player,pending,advance,changes};
}
function finishStepping(player) {
  let clicks=0;
  while(player.status!=='ended'&&clicks++<100)stepForward(player);
  assert.equal(player.status,'ended');
}
for (const scenario of scenarios) for (const detailed of [false,true]) {
  test(`${scenario.id}/${detailed?'podrobné':'základní'}: definice a úplný průběh`,()=>{
    const h=harness(scenario.id,detailed), p=h.player;
    assert.equal(p.index,-1);
    assert.equal(new Set(p.steps.map(s=>s.id)).size,p.steps.length);
    for(const s of p.steps) {
      assert.ok(s.duration>0 && s.title && s.description);
      if(s.phases) {
        assert.equal(s.phases[0].at,0);
        assert.ok(s.phases.every((part,i)=>part.at>=0&&part.at<1&&(!i||part.at>s.phases[i-1].at)));
      }
      for(const frame of [s,...(s.phases||[]).map(part=>({...s,...part}))]) {
        if(detailed)assert.equal(frame.flows.length,frame.highlights?.length?0:1);
        for(const f of frame.flows) { assert.ok(routes[f.route],f.route); assert.ok(['control','data','output'].includes(f.type)); }
        if(scenario.id==='calculator') assert.ok(!frame.active.some(c=>['network','server','audio','speakers'].includes(c)));
        if(scenario.id==='youtube') assert.ok(!frame.active.includes('ssd'));
        if(!detailed) {
          assert.ok(!frame.active.some(c=>['cache','registers'].includes(c)));
          for(const item of [...frame.flows,...(frame.highlights||[])])assert.ok(item.label.trim().split(/\s+/u).length<=3,item.label);
        }
      }
    }
    p.play(); h.advance(100000);
    assert.equal(p.status,'ended'); assert.equal(h.pending.size,0);
    assert.equal(p.index,p.steps.length-1); assert.equal(p.snapshot().progress,1);
    assert.equal(p.snapshot().effects.screen,{calculator:'calculator',youtube:'video',save:'editor',boot:'login'}[scenario.id]);
    const stepper=harness(scenario.id,detailed);
    finishStepping(stepper.player);
    assert.deepEqual(plain(stepper.player.snapshot().effects),plain(p.snapshot().effects));
    assert.deepEqual(plain(stepper.player.snapshot().memory),plain(p.snapshot().memory));
    p.reset(); assert.deepEqual(plain(p.snapshot().effects),plain(scenario.initial));
    assert.deepEqual(plain(p.snapshot().memory),plain(scenario.initialMemory));
    assert.equal(p.index,-1); assert.equal(h.pending.size,0);
  });
}
test('Zjednodušené přípravy zastupují stejné rozvedené kroky podrobného režimu',()=>{
  const groups={
    calculator:{'read-request':['read-request','read-request-read'],load:['load','read-complete'],execute:['calculator-cache','calculator-registers','execute','read-data'],process:[],'write-data':['write-data','graphics-commands-write'],draw:['graphics-commands-read','draw']},
    youtube:{'request-notify':['request-notify','request-read'],buffer:['buffer','receive-notify'],prepare:['playback-cache','playback-registers'],'playback-write':['playback-write','video-commands-write'],'video-read':['video-commands-read','video-read'],'video-process':[],playback:['image-output','sound-output']},
    save:{},boot:{}
  };
  for(const scenario of scenarios){
    const base=scenario.createSteps(false),detail=scenario.createSteps(true);
    assert.deepEqual(plain(base.flatMap(s=>groups[scenario.id][s.id]||[s.id])),plain(detail.map(s=>s.id)));
    const preparation=base.find(s=>s.id===({calculator:'process',youtube:'prepare',save:'save-prepare',boot:'system-start'}[scenario.id]));
    assert.deepEqual(plain(preparation.active),['cpu']);assert.equal(preparation.flows.length,0);
    assert.equal(preparation.highlights[0].label,{calculator:'Zpracování',youtube:'Příprava přehrávání',save:'Příprava souboru',boot:'Spouštění systému'}[scenario.id]);
  }
});
test('Čtení z SSD odděluje přípravu příkazu, oznámení, přenos obsahu a dokončení',()=>{
  for(const detailed of [false,true]) {
    const h=harness('calculator',detailed),p=h.player;
    assert.equal(p.steps.length,detailed?16:10);
    const expected=detailed?[
      {route:'ramCpu',type:'control',label:'Požadavek na načtení',reverse:true},
      {route:'cpuSsd',type:'control',label:'Oznámení nového požadavku'},
      {route:'ssdRam',type:'control',label:'Požadavek na načtení',reverse:true},
      {route:'ssdRam',type:'data',label:'Kód a data'},
      {route:'cpuSsd',type:'control',label:'Oznámení dokončení',reverse:true}
    ]:[
      {route:'ramCpu',type:'control',label:'Požadavek na načtení',reverse:true},
      {route:'cpuSsd',type:'control',label:'Oznámení nové práce'},
      {route:'ssdRam',type:'data',label:'Kód a data'}
    ];
    stepForward(p);
    for(const [i,transfer]of expected.entries()){
      stepForward(p);const state=p.snapshot();
      assert.deepEqual(plain(state.flows),[transfer]);
      assert.equal(state.effects.ramLoaded,i>=(detailed?3:2));
    }
    const loaded=p.steps.findIndex(s=>s.id==='load'),execute=p.steps.findIndex(s=>s.id==='execute');
    assert.equal(p.steps[loaded+1].id,detailed?'read-complete':'execute');
    assert.ok(execute>loaded,'CPU načítá program až po přenosu obsahu do RAM');
    const video=scenarios.find(s=>s.id==='youtube').createSteps(detailed);
    assert.ok(video.every(s=>s.flows.every(f=>!['cpuSsd','ssdRam'].includes(f.route))));
  }
});
test('Podrobný režim čte instrukce i pracovní data z RAM, zápis používá stejnou cestu opačně',()=>{
  assert.equal(routes.cpuRam,undefined);
  assert.deepEqual(plain(routes.ramCache.points[0]),plain(routes.ramCpu.points[0]));
  assert.equal(routes.ramCache.points[1][0],routes.ramCpu.points[1][0]);
  for(const detailed of [true]) {
    const calc=scenarios.find(s=>s.id==='calculator').createSteps(detailed);
    const index=calc.findIndex(s=>s.id==='execute');
    const transfers=calc.slice(index,index+3);
    assert.deepEqual(plain(transfers.map(s=>s.id)),['execute','read-data','write-data']);
    assert.deepEqual(plain(transfers.map(s=>s.flows)),[
      [{route:'ramCpu',type:'control',label:'instrukce programu'}],
      [{route:'ramCpu',type:'data',label:'čtení dat'}],
      [{route:'ramCpu',type:'data',label:'Připravené podklady pro obraz',reverse:true}]
    ]);
    const video=scenarios.find(s=>s.id==='youtube').createSteps(detailed);
    const read=video.find(s=>s.id==='received-read'),write=video.find(s=>s.id==='playback-write');
    assert.ok(video.indexOf(write)>video.indexOf(read));
    assert.ok(read.flows.some(f=>f.route==='ramCpu' && !f.reverse && f.label==='Přijatá data'));
    assert.ok(write.flows.some(f=>f.route==='ramCpu' && f.reverse && f.label==='Připravená data přehrávání'));
    for(const s of [...calc,...video]) {
      assert.ok(s.flows.filter(f=>['ramCpu','ramCache'].includes(f.route)).length<=1);
    }
  }
});
test('Spojnice mají porty ve středech stran a trasy vedou po společných úsecích',()=>{
  const port=(id,side)=>{const b=layout.nodes[id];return{top:[b.x+b.w/2,b.y],bottom:[b.x+b.w/2,b.y+b.h],left:[b.x,b.y+b.h/2],right:[b.x+b.w,b.y+b.h/2]}[side];};
  const endpoints={
    mouseCpu:['mouse','top','cpu','bottom'],cpuSsd:['cpu','left','ssd','right'],ssdRam:['ssd','top','ram','left'],
    uefiCpu:['uefi','right','cpu','left'],
    ramCpu:['ram','bottom','cpu','top'],cpuGpu:['cpu','right','gpu','left'],cpuNetwork:['cpu','right','network','left'],
    ramGpu:['ram','right','gpu','left'],ramVram:['ram','right','vram','left'],gpuVram:['gpu','bottom','vram','top'],gpuMonitor:['gpu','right','monitor','left'],
    networkServer:['network','right','server','left'],serverNetwork:['server','left','network','right'],
    networkRam:['network','left','ram','right'],ramAudio:['ram','right','audio','left'],
    audioCpu:['audio','left','cpu','right'],audioSpeakers:['audio','right','speakers','left']
  };
  for(const [id,[from,sideA,to,sideB]]of Object.entries(endpoints)){
    assert.deepEqual(plain(routes[id].points[0]),port(from,sideA),id+' začátek');
    assert.deepEqual(plain(routes[id].points.at(-1)),port(to,sideB),id+' konec');
  }
  assert.ok(routes.ramCache.points.some(p=>p[0]===port('cpu','top')[0]&&p[1]===port('cpu','top')[1]));
  const segments=Object.values(connections).flatMap(r=>r.points.slice(1).map((b,i)=>[r.points[i],b]));
  const contains=(a,b,p,q)=>{
    if(a[0]===b[0]&&p[0]===q[0]&&a[0]===p[0])return Math.min(a[1],b[1])>=Math.min(p[1],q[1])&&Math.max(a[1],b[1])<=Math.max(p[1],q[1]);
    if(a[1]===b[1]&&p[1]===q[1]&&a[1]===p[1])return Math.min(a[0],b[0])>=Math.min(p[0],q[0])&&Math.max(a[0],b[0])<=Math.max(p[0],q[0]);
    return false;
  };
  for(const [id,r]of Object.entries(routes))for(let i=1;i<r.points.length;i++){
    assert.ok(segments.some(([p,q])=>contains(r.points[i-1],r.points[i],p,q)),id+' sleduje viditelný podklad');
  }
  assert.ok(routes.ssdRam.d.includes('Q'),'Ohyb SSD–RAM je zaoblený');
});
test('Napájení má samostatnou vrstvu; zdroj se nepřekrývá s datovým schématem a AC se nespojí s DC',()=>{
  const psu=layout.nodes.psu,outlet=layout.nodes.outlet;
  assert.deepEqual(plain(power.ac.points[0]),[outlet.x+outlet.w/2,outlet.y]);
  assert.deepEqual(plain(power.ac.points.at(-1)),[psu.x+psu.w/2,psu.y+psu.h]);
  assert.deepEqual(plain(power.dc.points[0]),[psu.x+psu.w,psu.y+psu.h/2]);
  assert.ok(outlet.y>layout.boundary.y+layout.boundary.h,'Zásuvka je mimo počítač');
  for(const id of [...power.components,...power.dedicatedComponents]){
    const b=layout.nodes[id];assert.ok(b,id);
    assert.ok(Math.min(b.x+b.w,psu.x+psu.w)<=Math.max(b.x,psu.x)||Math.min(b.y+b.h,psu.y+psu.h)<=Math.max(b.y,psu.y),'Zdroj nepřekrývá '+id);
    assert.ok(!['monitor','speakers','server','outlet'].includes(id),'Externí přístroje nejsou na výstupu PSU');
  }
  const segments=points=>points.slice(1).map((b,i)=>[points[i],b]);
  // Všechny úseky jsou vodorovné nebo svislé. Zvlášť chráníme mezeru pro
  // přívod ze zásuvky, aby nevznikl falešný elektrický uzel AC a DC.
  for(const [a,b] of segments(power.ac.points))for(const [c,d] of segments(power.dc.points)){
    const overlapX=Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]));
    const overlapY=Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1]));
    assert.ok(!(overlapX&&overlapY),'Přívod AC nekříží rozvod DC');
  }
  assert.ok(!Object.values(routes).includes(power.ac)&&!Object.values(routes).includes(power.dc),'Energie není datová zpráva přehrávače');
});
test('Podrobný YouTube zachovává 18 hlavních přenosů včetně oznámení a směrů',()=>{
  const expected=[
    ['mouseCpu',false,'Kliknutí na Přehrát'],
    ['ramCpu',true,'Požadavek na video'],
    ['cpuNetwork',false,'Oznámení nového požadavku'],
    ['networkRam',true,'Požadavek na video'],
    ['networkServer',false,'Požadavek na video'],
    ['serverNetwork',false,'Video a zvuk'],
    ['networkRam',false,'Video a zvuk'],
    ['cpuNetwork',true,'Oznámení přijatých dat'],
    ['ramCpu',false,'Přijatá data'],
    ['ramCpu',true,'Připravená data přehrávání'],
    ['ramCpu',true,'Příkazy zpracování videa'],
    ['cpuGpu',false,'Oznámení nové práce'],
    ['ramGpu',false,'Příkazy zpracování videa'],
    ['ramGpu',false,'Video'],
    ['audioCpu',true,'Nastavení přehrávání'],
    ['ramAudio',false,'Zvuk'],
    ['gpuMonitor',false,'Obrazový signál'],
    ['audioSpeakers',false,'Zvukový signál']
  ];
  const scenario=scenarios.find(s=>s.id==='youtube');
  for(const detailed of [true]){
    const steps=scenario.createSteps(detailed);
    assert.equal(steps.length,detailed?20:18);
    const main=steps.filter(s=>!s.id.startsWith('playback-cache')&&!s.id.startsWith('playback-registers'));
    assert.deepEqual(plain(main.map(s=>[s.flows[0].route,!!s.flows[0].reverse,s.flows[0].label])),expected);
    assert.ok(steps.filter(s=>['ramCache','cacheRegisters'].includes(s.flows[0].route)).every(s=>
      !['Video','Video a zvuk'].includes(s.flows[0].label)));
  }
});
test('Podrobný scénář zachovává návaznost obrazu a zvuku se společným zastavitelným časem',()=>{
  for(const detailed of[true]){
    const h=harness('youtube',detailed),p=h.player;
    for(let i=0;i<p.steps.length-1;i++)stepForward(p);
    assert.equal(p.snapshot().step.id,'image-output');
    assert.equal(p.snapshot().effects.soundPlaying,false);
    assert.equal(p.snapshot().effects.screen,'video');
    p.play();h.advance(1800);p.pause();
    const paused=plain(p.snapshot()),count=h.changes.length;
    assert.equal(paused.step.id,'sound-output');
    assert.equal(paused.effects.soundPlaying,true);
    h.advance(5000);assert.deepEqual(plain(p.snapshot()),paused);
    assert.equal(h.changes.length,count);assert.equal(h.pending.size,0);
    p.play();h.advance(6000);assert.equal(p.status,'ended');
    assert.equal(h.pending.size,0);
    p.reset();assert.equal(p.snapshot().effects.soundPlaying,false);
    assert.equal(p.snapshot().effects.playback,false);
    h.changes.length=0;
    p.play();h.advance(100000);
    let phase=0;
    for(const state of h.changes.filter(s=>s.effects.playback)){
      const e=state.effects,next=e.playbackFrom+(e.playbackTo-e.playbackFrom)*state.progress;
      assert.ok(next>=phase,'Plynulý postup obrazu');phase=next;
    }
    assert.equal(phase,3);
    assert.equal(p.steps.at(-1).id,'sound-output');
    assert.equal(p.status,'ended');assert.equal(h.pending.size,0);
  }
});
test('Podrobné scénáře nadále oddělují grafické příkazy od obsahu',()=>{
  // Start zachovává osmnáct hlavních kroků i se zobrazenou cache.
  for(const scenario of graphicsScenarios.filter(s=>s.id!=='boot')) for(const detailed of [true]) {
    const h=harness(scenario.id,detailed),p=h.player;
    const requestIndex=p.steps.findIndex(s=>s.flows.some(f=>f.route==='cpuGpu'));
    assert.ok(requestIndex>=0);
    const request=p.steps[requestIndex],data=p.steps[requestIndex+1];
    const commandWrite=p.steps[requestIndex-1],content=p.steps[requestIndex+2];
    assert.equal(commandWrite.flows[0].route,'ramCpu');
    assert.equal(commandWrite.flows[0].reverse,true);
    assert.equal(commandWrite.flows[0].type,'control');
    assert.equal(request.flows[0].label,'Oznámení nové práce');
    assert.equal(data.flows[0].type,'control');
    assert.equal(data.flows[0].label,commandWrite.flows[0].label);
    assert.equal(content.flows[0].route,'ramGpu');
    assert.equal(content.flows[0].type,'data');
    assert.ok(!request.flows.some(f=>f.route==='ramGpu'));
    assert.ok(data.flows.some(f=>f.route==='ramGpu'));
    assert.ok(!data.flows.some(f=>f.route==='cpuGpu'));
    assert.ok(p.steps.slice(0,requestIndex).every(s=>s.flows.every(f=>f.route!=='ramGpu')));
    assert.ok(p.steps.every(s=>!(s.flows.some(f=>f.route==='cpuGpu')&&s.flows.some(f=>f.route==='ramGpu'))));
    for(let i=0;i<=requestIndex;i++)stepForward(p);
    assert.ok(p.snapshot().flows.some(f=>f.route==='cpuGpu'));
    stepForward(p);const stepped=plain(p.snapshot().flows);
    assert.ok(stepped.some(f=>f.route==='ramGpu'));
    p.reset();p.play();
    const before=p.steps.slice(0,requestIndex).reduce((sum,s)=>sum+s.duration,0);
    h.advance(before+request.duration/2+20);
    assert.equal(p.snapshot().step.id,request.id);
    assert.ok(p.snapshot().flows.some(f=>f.route==='cpuGpu'));
    assert.ok(!p.snapshot().flows.some(f=>f.route==='ramGpu'));
    h.advance(request.duration/2+100);
    assert.equal(p.snapshot().step.id,data.id);
    assert.deepEqual(plain(p.snapshot().flows),stepped);
  }
});
test('Pauza zastaví čas i výstup, pokračování naváže bez skoku',()=>{
  const h=harness(); h.player.play();h.advance(1000);h.player.pause();
  const before=plain(h.player.snapshot()); const events=h.changes.length;
  h.advance(20000);assert.equal(h.changes.length,events);assert.equal(h.pending.size,0);
  assert.equal(h.player.snapshot().progress,before.progress);
  h.player.play();h.advance(200);assert.ok(h.player.snapshot().progress>before.progress);
});
test('Reset a změna scénáře ruší běžící animaci a její efekty',()=>{
  const h=harness('youtube',true);h.player.play();h.advance(1500);
  h.player.select('calculator',false);const count=h.changes.length;h.advance(20000);
  assert.equal(h.changes.length,count);assert.equal(h.pending.size,0);
  assert.equal(h.player.status,'ready');assert.equal(h.player.snapshot().effects.screen,'desktop');
  assert.equal(h.player.snapshot().effects.buffer,0);
  h.player.play();h.advance(500);h.player.reset();h.advance(5000);
  assert.equal(h.player.index,-1);assert.equal(h.pending.size,0);
});
test('Další krok přehraje celý přenos a zastaví; rozpracovaný přenos dokončí',()=>{
  const h=harness(),p=h.player;
  p.next();assert.equal(p.index,0);assert.equal(p.status,'playing');
  assert.equal(p.snapshot().progress,0);assert.equal(h.pending.size,1);
  h.advance(1000);assert.ok(p.snapshot().progress>0&&p.snapshot().progress<1);
  p.next();assert.equal(p.index,0);assert.equal(h.pending.size,1);
  h.advance(10000);assert.equal(p.index,0);assert.equal(p.status,'paused');
  assert.equal(p.snapshot().progress,1);assert.equal(h.pending.size,0);
  p.next();assert.equal(p.index,1);assert.equal(p.snapshot().progress,0);
  h.advance(600);p.pause();const atPause=p.snapshot().progress;
  h.advance(1000);assert.equal(p.snapshot().progress,atPause);
  p.play();h.advance(10000);assert.ok(p.index>1,'Pokračovat spustí automatiku');
});
test('Krokování videa zastaví na konci fáze a další zpráva vyrazí od zdroje',()=>{
  const h=harness('youtube'),p=h.player;
  for(let i=0;i<p.steps.length-1;i++)stepForward(p);
  p.next();assert.equal(p.snapshot().phaseIndex,0);
  h.advance(10000);
  assert.equal(p.status,'paused');assert.equal(p.snapshot().progress,.18);
  assert.equal(p.snapshot().phaseIndex,0);assert.equal(h.pending.size,0);
  p.next();let state=p.snapshot();
  assert.equal(state.phaseIndex,1);assert.equal(state.phaseProgress,0);
  const incoming=state.flows.find(f=>f.route==='serverNetwork');
  assert.equal(transferProgress(incoming,state),0);
  p.pause();
  assert.equal(p.snapshot().phaseIndex,1,'Pauza na začátku fáze nezmění viditelný přenos');
  assert.deepEqual(plain(p.snapshot().flows),plain(state.flows));
  p.next();
  h.advance(920);state=p.snapshot();
  assert.ok(transferProgress(incoming,state)>.45 && transferProgress(incoming,state)<.55);
  p.pause();const held=transferProgress(incoming,p.snapshot());h.advance(10000);
  assert.equal(transferProgress(incoming,p.snapshot()),held);
  p.next();h.advance(10000);state=p.snapshot();
  assert.equal(state.progress,.36);assert.equal(transferProgress(incoming,state),1);
  p.next();p.reset();h.advance(10000);
  assert.equal(p.index,-1);assert.equal(h.pending.size,0);
});

test('Souběžné signály pokračují přes fáze; každý nový příjem projde celou cestu',()=>{
  const h=harness('youtube'),p=h.player;
  p.play();h.advance(100000);
  const frames=h.changes.filter(s=>s.step?.id==='playback');
  const lastProgress=new Map(),finished=new Set();
  for(const state of frames)for(const flow of state.flows){
    const key=['gpuMonitor','audioSpeakers'].includes(flow.route)?flow.route:flow.route+':'+state.phaseIndex;
    const progress=transferProgress(flow,state),previous=lastProgress.get(key)??0;
    assert.ok(progress>=previous && progress<=1,'Pohyb se uvnitř přenosu nevrací zpět');
    if(['gpuMonitor','audioSpeakers'].includes(flow.route))assert.equal(progress,state.progress);
    else {
      assert.equal(progress,state.phaseProgress);
      if(progress>.9)finished.add(key);
    }
    lastProgress.set(key,progress);
  }
  assert.equal(lastProgress.get('gpuMonitor'),1);assert.equal(lastProgress.get('audioSpeakers'),1);
  assert.equal(finished.size,4,'Dva příjmy ze serveru a dvě předání do RAM');
});
test('Více stisků Spustit nevytvoří více časovačů a dokončený děj lze přehrát znovu',()=>{
  const h=harness();h.player.play();h.player.play();assert.equal(h.pending.size,1);
  h.advance(100000);stepForward(h.player);assert.equal(h.player.status,'ended');
  h.player.play();assert.equal(h.player.index,0);assert.equal(h.player.status,'playing');
  assert.equal(h.player.snapshot().effects.screen,'desktop');assert.equal(h.pending.size,1);
});

test('Základní scénáře mají přesně 10, 15, 9 a 18 kroků s předepsanými přenosy',()=>{
  const contracts={calculator:[
    ['mouseCpu',false,'Kliknutí na kalkulačku'],['ramCpu',true,'Požadavek na načtení'],
    ['cpuSsd',false,'Oznámení nové práce'],['ssdRam',false,'Kód a data'],
    ['ramCpu',false,'Instrukce a data'],['highlight','cpu','Zpracování'],
    ['ramCpu',true,'Podklady a příkazy'],['cpuGpu',false,'Oznámení nové práce'],
    ['ramGpu',false,'Podklady a příkazy'],['gpuMonitor',false,'Obrazový signál']
  ],youtube:[
    ['mouseCpu',false,'Kliknutí na Přehrát'],['ramCpu',true,'Požadavek na video'],
    ['cpuNetwork',false,'Oznámení nové práce'],['networkServer',false,'Požadavek na video'],
    ['serverNetwork',false,'Video a zvuk'],['networkRam',false,'Video a zvuk'],
    ['ramCpu',false,'Instrukce a data'],['highlight','cpu','Příprava přehrávání'],
    ['ramCpu',true,'Data a příkazy'],['cpuGpu',false,'Oznámení nové práce'],
    ['ramGpu',false,'Video a příkazy'],['highlight','gpu','Zpracování videa'],
    ['audioCpu',true,'Spuštění přehrávání'],
    ['ramAudio',false,'Zvukové vzorky'],
    [['gpuMonitor',false,'Obrazový signál'],['audioSpeakers',false,'Zvukový signál']]
  ],save:[
    ['mouseCpu',false,'Kliknutí na Uložit'],['ramCpu',false,'Instrukce a data'],
    ['highlight','cpu','Příprava souboru'],['ramCpu',true,'Data souboru'],
    ['ramCpu',true,'Požadavek na zápis'],['cpuSsd',false,'Oznámení nové práce'],
    ['ssdRam',true,'Požadavek na zápis'],['ssdRam',true,'Data souboru'],
    ['highlight','ssd','Zápis do flash']
  ],boot:[
    ['highlight','power','Zapnutí napájení'],['uefiCpu',false,'Kód firmwaru'],
    ['highlight','cpu','Inicializace hardwaru'],['highlight','cpu','Výběr zavaděče'],
    ['ramCpu',true,'Požadavek na načtení'],['cpuSsd',false,'Oznámení nové práce'],
    ['ssdRam',false,'Zavaděč systému'],['ramCpu',false,'Instrukce zavaděče'],
    ['highlight','cpu','Spuštění zavaděče'],['ramCpu',true,'Požadavek na načtení'],
    ['cpuSsd',false,'Oznámení nové práce'],['ssdRam',false,'Části systému'],
    ['ramCpu',false,'Instrukce a data'],['highlight','cpu','Spouštění systému'],
    ['ramCpu',true,'Podklady a příkazy'],['cpuGpu',false,'Oznámení nové práce'],
    ['ramGpu',false,'Podklady a příkazy'],['gpuMonitor',false,'Obrazový signál']
  ]};
  for(const scenario of scenarios){
    const steps=scenario.createSteps(false);assert.equal(steps.length,contracts[scenario.id].length);
    const actual=steps.map(s=>{
      if(s.highlights?.length)return['highlight',s.highlights[0].target,s.highlights[0].label];
      const flows=s.flows.length?s.flows:s.phases.at(-1).flows;
      const items=flows.map(f=>[f.route,!!f.reverse,f.label]);return items.length===1?items[0]:items;
    });
    assert.deepEqual(plain(actual),contracts[scenario.id]);
  }
});

test('Oba scénáře oddělí čtení, práci CPU a zápis; video má samostatné zpracování GPU',()=>{
  const calc=harness('calculator').player;
  for(let i=0;i<5;i++)stepForward(calc);
  let state=calc.snapshot();
  assert.equal(state.index,4);assert.equal(state.flows[0].route,'ramCpu');assert.equal(state.flows[0].reverse,undefined);
  assert.equal(state.flows[0].label,'Instrukce a data');assert.equal(state.effects.ramLoaded,true);
  stepForward(calc);state=calc.snapshot();
  assert.deepEqual(plain(state.active),['cpu']);assert.equal(state.flows.length,0);
  assert.equal(state.highlights[0].target,'cpu');assert.equal(state.highlights[0].label,'Zpracování');
  stepForward(calc);state=calc.snapshot();
  assert.equal(state.flows[0].route,'ramCpu');assert.equal(state.flows[0].reverse,true);assert.equal(state.flows[0].label,'Podklady a příkazy');
  stepForward(calc);stepForward(calc);state=calc.snapshot();
  assert.equal(state.index,8);assert.equal(state.effects.screen,'loading');assert.equal(state.flows[0].route,'ramGpu');
  stepForward(calc);state=calc.snapshot();
  assert.equal(state.index,9);assert.equal(state.status,'ended');assert.equal(state.effects.screen,'calculator');
  assert.equal(state.flows[0].route,'gpuMonitor');
  const h=harness('calculator');h.player.play();h.advance(100000);
  for(const s of h.changes.filter(s=>s.index>=0))assert.equal(s.effects.screen==='calculator',s.index===9);

  const video=harness('youtube').player;
  for(let i=0;i<7;i++)stepForward(video);state=video.snapshot();
  assert.equal(state.index,6);assert.equal(state.flows[0].route,'ramCpu');assert.equal(state.flows[0].label,'Instrukce a data');
  stepForward(video);state=video.snapshot();
  assert.equal(state.index,7);assert.deepEqual(plain(state.active),['cpu']);assert.equal(state.flows.length,0);
  assert.equal(state.highlights[0].target,'cpu');assert.equal(state.highlights[0].label,'Příprava přehrávání');
  stepForward(video);state=video.snapshot();
  assert.equal(state.index,8);assert.equal(state.flows[0].route,'ramCpu');assert.equal(state.flows[0].reverse,true);assert.equal(state.flows[0].label,'Data a příkazy');
  stepForward(video);stepForward(video);state=video.snapshot();
  assert.equal(state.index,10);assert.equal(state.flows[0].label,'Video a příkazy');
  stepForward(video);state=video.snapshot();
  assert.equal(state.index,11);assert.deepEqual(plain(state.active),['gpu']);assert.equal(state.flows.length,0);
  assert.equal(state.highlights[0].label,'Zpracování videa');assert.equal(state.effects.buffer,2);
  stepForward(video);stepForward(video);stepForward(video);state=video.snapshot();
  assert.equal(state.index,14);assert.equal(state.effects.playback,true);assert.equal(state.effects.soundPlaying,true);
  assert.deepEqual(plain(state.flows.map(f=>f.route)),['gpuMonitor','audioSpeakers']);
});

test('Základní YouTube přehrává obraz a zvuk souběžně a při tom doplňuje RAM',()=>{
  const h=harness('youtube');h.player.play();h.advance(100000);
  const playback=h.changes.filter(s=>s.step?.id==='playback');
  assert.ok(playback.length>0);
  let buffer=2,phase=0;const arrivals=[];let last='';
  for(const s of playback){
    assert.equal(s.effects.playback,true);assert.equal(s.effects.soundPlaying,true);assert.equal(s.effects.screen,'video');
    assert.ok(s.flows.some(f=>f.route==='gpuMonitor'));assert.ok(s.flows.some(f=>f.route==='audioSpeakers'));
    assert.ok(s.effects.buffer>=buffer,'Čtení RAM obsah nemaže');buffer=s.effects.buffer;
    const current=s.effects.playbackFrom+(s.effects.playbackTo-s.effects.playbackFrom)*s.progress;
    assert.ok(current>=phase);phase=current;
    if(s.phaseIndex!==last){last=s.phaseIndex;arrivals.push(...s.flows.filter(f=>['serverNetwork','networkRam'].includes(f.route)).map(f=>f.route));}
  }
  assert.deepEqual(arrivals,['serverNetwork','networkRam','serverNetwork','networkRam']);
  assert.equal(phase,3);assert.equal(buffer,4);assert.equal(h.player.status,'ended');assert.equal(h.pending.size,0);
  for(const s of h.changes.filter(s=>s.index>=5&&s.index<14))assert.equal(s.effects.buffer,2);
});

test('Pauza, pokračování, reset a změna režimu ruší i souběžné dílčí přenosy',()=>{
  const h=harness('youtube');const p=h.player;
  const before=p.steps.slice(0,-1).reduce((sum,s)=>sum+s.duration,0);
  p.play();h.advance(before+2600);p.pause();
  const paused=plain(p.snapshot());assert.equal(paused.step.id,'playback');
  assert.equal(paused.flows.length,3);assert.ok(paused.flows.some(f=>f.route==='serverNetwork'));
  const count=h.changes.length;h.advance(5000);assert.equal(h.changes.length,count);
  assert.deepEqual(plain(p.snapshot()),paused);assert.equal(h.pending.size,0);
  p.play();h.advance(200);assert.ok(p.snapshot().progress>paused.progress);
  p.reset();const reset=plain(p.snapshot());h.advance(10000);assert.deepEqual(plain(p.snapshot()),reset);
  assert.equal(reset.flows.length,0);assert.equal(reset.highlights.length,0);assert.equal(reset.effects.buffer,0);
  p.play();h.advance(200);p.select('youtube',true);
  assert.equal(p.steps.length,20);assert.equal(p.index,-1);assert.equal(h.pending.size,0);
});

test('Krokování a automatika procházejí shodnými vnitřními fázemi',()=>{
  for(const scenario of scenarios){
    const auto=harness(scenario.id),manual=harness(scenario.id);
    auto.player.play();auto.advance(100000);finishStepping(manual.player);
    const trace=states=>states.filter(s=>s.index>=0).map(s=>`${s.index}:${s.phaseIndex}`).filter((key,i,all)=>i===0||key!==all[i-1]);
    assert.deepEqual(trace(auto.changes),trace(manual.changes));
    assert.deepEqual(plain(auto.player.snapshot().effects),plain(manual.player.snapshot().effects));
  }
});

test('Kalkulačka doplní RAM až po dojezdu dat; čtení nemaže RAM ani kód na SSD',()=>{
  for(const detailed of [false,true]){
    const h=harness('calculator',detailed),p=h.player;
    const initial=plain(p.snapshot().memory);
    assert.deepEqual(initial.ram,[]);
    assert.equal(initial.ssd[0].label,'Kód a data kalkulačky');
    stepForward(p);assert.deepEqual(plain(p.snapshot().memory.ram),[]);
    p.next();h.advance(1000);p.pause();
    assert.equal(p.snapshot().step.id,'read-request-write');
    assert.deepEqual(plain(p.snapshot().memory.ram),[],'Rozpracovaný zápis ještě není uložený');
    const paused=plain(p.snapshot().memory);h.advance(5000);
    assert.deepEqual(plain(p.snapshot().memory),paused);
    stepForward(p);
    assert.deepEqual(plain(p.snapshot().memory.ram.map(s=>s.id)),['request']);
    while(p.snapshot().step.id!=='load'){
      p.next();
      if(p.snapshot().step.id==='load')break;
      h.advance(10000);
    }
    h.advance(1600);
    assert.ok(!p.snapshot().memory.ram.some(s=>s.id==='program'));
    h.advance(10000);
    const loaded=plain(p.snapshot().memory);
    assert.deepEqual(loaded.ram.map(s=>s.id),['request','program']);
    assert.deepEqual(loaded.ssd,initial.ssd,'Na SSD zůstane původní kopie');
    while(p.snapshot().step.id!=='write-data'){
      p.next();
      if(p.snapshot().step.id==='write-data')break;
      h.advance(10000);
      assert.deepEqual(plain(p.snapshot().memory),loaded,'Čtení obsahu paměť nemaže');
    }
    assert.deepEqual(plain(p.snapshot().memory),loaded);
    h.advance(10000);finishStepping(p);
    assert.deepEqual(plain(p.snapshot().memory.ram.map(s=>s.id)),['request','program','image','commands']);
    assert.deepEqual(plain(p.snapshot().memory.ssd),initial.ssd);
    p.reset();assert.deepEqual(plain(p.snapshot().memory),initial);
  }
});

test('Video začíná s prohlížečem v RAM a postupně přidává požadavek, obsah a příkazy',()=>{
  for(const detailed of [false,true]){
    const h=harness('youtube',detailed),p=h.player;
    const initial=plain(p.snapshot().memory);
    assert.deepEqual(initial.ram.map(s=>s.id),['program']);
    assert.equal(initial.ram[0].label,'Kód a data prohlížeče');
    for(let i=0;i<p.steps.length;i++){
      const before=plain(p.snapshot().memory);
      p.next();const step=p.snapshot().step;
      assert.deepEqual(plain(p.snapshot().memory),before,'Začátek přenosu nic předčasně neuloží');
      h.advance(1000);
      assert.deepEqual(plain(p.snapshot().memory),before,'Data nejsou v RAM před dojezdem');
      h.advance(10000);
      if(step.phases)break;
      if(step.id==='buffer')assert.equal(p.snapshot().memory.ram.find(s=>s.id==='received').label,'Video a zvuk (část 1)');
      if(!step.memoryWrites)assert.deepEqual(plain(p.snapshot().memory),before,'Čtení a oznámení nemění uložený obsah');
      assert.deepEqual(plain(p.snapshot().memory.ssd),initial.ssd);
    }
    finishStepping(p);
    assert.deepEqual(plain(p.snapshot().memory.ram.map(s=>s.id)),['program','request','received','prepared','commands']);
    assert.equal(p.snapshot().memory.ram.find(s=>s.id==='received').label,detailed?'Video a zvuk (část 1)':'Video a zvuk (části 1–3)');
    assert.deepEqual(plain(p.snapshot().memory.ssd),initial.ssd);
  }
});

test('Další části videa se v RAM objeví až na konci příslušných přenosových fází',()=>{
  const h=harness('youtube'),p=h.player;
  for(let i=0;i<p.steps.length-1;i++)stepForward(p);
  const label=()=>p.snapshot().memory.ram.find(s=>s.id==='received').label;
  assert.equal(label(),'Video a zvuk (část 1)');
  stepForward(p);assert.equal(p.snapshot().progress,.18);
  stepForward(p);assert.equal(p.snapshot().progress,.36);
  assert.equal(label(),'Video a zvuk (část 1)','Příjem u síťové části ještě nemění RAM');
  p.next();h.advance(920);p.pause();
  assert.equal(label(),'Video a zvuk (část 1)');
  const paused=plain(p.snapshot().memory);h.advance(5000);assert.deepEqual(plain(p.snapshot().memory),paused);
  stepForward(p);assert.equal(p.snapshot().progress,.54);
  assert.equal(label(),'Video a zvuk (části 1–2)');
  finishStepping(p);assert.equal(label(),'Video a zvuk (části 1–3)');
  assert.equal(p.snapshot().memory.ram.length,5,'Aktualizace obsahu nevytváří duplicitní položky');
});

test('Obsah paměti se nepropíše do definic a změna scénáře odstraní předchozí data',()=>{
  const h=harness('calculator'),p=h.player;
  finishStepping(p);
  const snapshot=p.snapshot();snapshot.memory.ssd[0].label='změněno';snapshot.memory.ram.length=0;
  assert.equal(p.snapshot().memory.ssd[0].label,'Kód a data kalkulačky');
  assert.equal(p.snapshot().memory.ram.length,4);
  p.select('youtube',true);
  assert.deepEqual(plain(p.snapshot().memory.ram.map(s=>s.label)),['Kód a data prohlížeče']);
  p.next();h.advance(1000);p.select('calculator',false);h.advance(10000);
  assert.deepEqual(plain(p.snapshot().memory.ram),[]);assert.equal(h.pending.size,0);
});

for (const scenario of graphicsScenarios) for (const detailed of [false,true]) {
  test(`${scenario.id}/${detailed?'podrobné':'základní'}/dedikovaná: příkazy z RAM, obraz ve VRAM a shodné přehrání`,()=>{
    const h=harness(scenario.id,detailed,'dedicated'),p=h.player;
    assert.equal(p.graphics,'dedicated');
    assert.deepEqual(plain(p.snapshot().memory.vram),[]);
    assert.equal(p.steps.length,scenario.id==='boot'?22:scenario.id==='calculator'?(detailed?19:14):(detailed?24:19));
    assert.equal(new Set(p.steps.map(s=>s.id)).size,p.steps.length);
    const notify=p.steps.findIndex(s=>['graphics-request','graphics-notify'].includes(s.id));
    assert.equal(p.steps[notify].flows[0].route,'cpuGpu');
    assert.equal(p.steps[notify+1].flows[0].route,'ramGpu');
    assert.equal(p.steps[notify+1].flows[0].type,'control');
    assert.equal(p.steps[notify+2].flows[0].route,'ramVram');
    assert.equal(p.steps[notify+3].flows[0].route,'gpuVram');
    assert.equal(p.steps[notify+3].flows[0].reverse,true);
    for (const s of p.steps) for (const part of [s,...(s.phases||[]).map(phase=>({...s,...phase}))]) {
      for (const f of part.flows) assert.ok(routes[f.route],f.route);
      if (!detailed) for (const f of [...part.flows,...(part.highlights||[])]) assert.ok(f.label.trim().split(/\s+/u).length<=3,f.label);
      if (s.id!=='playback') assert.ok(part.flows.length<=1,'Příprava používá vždy jeden přenos');
      if (scenario.id==='calculator') assert.ok(!part.active.some(id=>['audio','network','server','speakers'].includes(id)));
      if (scenario.id==='youtube') assert.ok(!part.active.includes('ssd'));
    }
    // Ani při průběžném čtení se VRAM nenaplní před dokončením zápisu.
    for (let i=0;i<p.steps.length;i++) {
      const previous=plain(p.snapshot().memory);
      p.next();const current=p.snapshot();
      assert.deepEqual(plain(current.memory),previous);
      if (current.step.id==='graphics-scanout') assert.ok(current.memory.vram.some(item=>item.id==='frames'));
      h.advance(1000);
      if (current.step.id.startsWith('graphics-')) assert.deepEqual(plain(p.snapshot().memory),previous);
      h.advance(10000);
      if (current.step.id==='graphics-upload') assert.deepEqual(plain(p.snapshot().memory.vram.map(item=>item.id)),['input']);
      if (current.step.id==='graphics-store') assert.deepEqual(plain(p.snapshot().memory.vram.map(item=>item.id)),['input','frames']);
    }
    finishStepping(p);
    const manually=plain(p.snapshot());
    assert.deepEqual(manually.memory.vram.map(item=>item.id),['input','frames']);
    assert.ok(!manually.memory.vram.some(item=>/příkaz|zvuk|kód|prohlížeč/i.test(item.label)));
    p.reset();assert.deepEqual(plain(p.snapshot().memory.vram),[]);
    p.play();h.advance(200000);
    assert.equal(p.status,'ended');assert.equal(h.pending.size,0);
    assert.deepEqual(plain(p.snapshot().memory),manually.memory);
    assert.deepEqual(plain(p.snapshot().effects),manually.effects);
  });
}

test('Přepnutí grafiky ruší přenos, zachová scénář i podrobnost a vyčistí VRAM',()=>{
  const h=harness('youtube',true,'dedicated'),p=h.player;
  finishStepping(p);assert.equal(p.snapshot().memory.vram.length,2);
  p.reset();
  const store=p.steps.findIndex(s=>s.id==='graphics-store');
  for(let i=0;i<store;i++)stepForward(p);
  p.next();h.advance(1200);
  assert.equal(p.snapshot().step.id,'graphics-store');
  assert.equal(p.snapshot().memory.vram.length,1);
  p.select(p.scenario.id,p.detailed,'integrated');h.advance(20000);
  assert.equal(p.index,-1);assert.equal(p.status,'ready');assert.equal(h.pending.size,0);
  assert.equal(p.scenario.id,'youtube');assert.equal(p.detailed,true);
  assert.ok(!('vram' in p.snapshot().memory));assert.equal(p.steps.length,20);
  assert.ok(!p.steps.some(s=>s.flows.some(f=>routes[f.route].dedicated)));
  p.select(p.scenario.id,p.detailed,'dedicated');
  assert.deepEqual(plain(p.snapshot().memory.vram),[]);assert.equal(p.steps.length,24);
  p.select('calculator');assert.equal(p.graphics,'dedicated');assert.equal(p.detailed,true);
  assert.deepEqual(plain(p.snapshot().memory.ram),[]);
  p.select('calculator',false);assert.equal(p.graphics,'dedicated');assert.equal(p.steps.length,14);
  assert.throws(()=>p.select('calculator',false,'unknown'),/Neznámá grafika/);
});

for(const detailed of [false,true])for(const graphics of ['integrated','dedicated']){
  test(`Uložení souboru/${detailed?'cache':'bez cache'}/${graphics}: trvalý soubor vznikne až dokončením devátého kroku`,()=>{
    const h=harness('save',detailed,graphics),p=h.player,initial=plain(p.snapshot().memory);
    assert.equal(p.steps.length,9);assert.ok(p.steps.every(s=>!s.phases));
    assert.ok(!initial.ssd.some(item=>item.id==='file'));
    assert.deepEqual(initial.ram.map(item=>item.id),['program','document']);
    assert.equal(p.steps[1].flows[0].route,detailed?'ramCache':'ramCpu');
    assert.equal(p.steps[2].active.includes('registers'),detailed);
    assert.equal(p.steps.at(-1).id,'save-flash');
    assert.deepEqual(plain(p.steps.at(-1).active),['ssd']);
    assert.equal(p.steps.at(-1).flows.length,0);
    assert.equal(p.steps.at(-1).highlights[0].target,'ssd');
    for(const step of p.steps){
      assert.ok(!step.active.some(id=>['gpu','vram','network','server','audio','monitor','speakers'].includes(id)));
      assert.ok(step.flows.length<=1);
      assert.ok(!step.flows.some(f=>f.route==='cpuSsd'&&f.reverse),'Po zápisu nenásleduje oznámení CPU');
      const before=plain(p.snapshot().memory);
      p.next();assert.deepEqual(plain(p.snapshot().memory),before);
      h.advance(step.duration/2);p.pause();
      assert.deepEqual(plain(p.snapshot().memory),before,'Paměť se nemění uprostřed zápisu');
      const frozen=plain(p.snapshot());h.advance(10000);assert.deepEqual(plain(p.snapshot()),frozen);
      p.next();h.advance(10000);
      const state=p.snapshot();
      assert.deepEqual(plain(state.memory.ram.find(item=>item.id==='document')),initial.ram[1],'Rozepsaný dokument zůstává');
      assert.deepEqual(plain(state.memory.ssd.find(item=>item.id==='program')),initial.ssd[0],'Kód editoru zůstává na SSD');
      if(state.index<7)assert.ok(!state.memory.ssd.some(item=>item.id==='file'));
      if(step.id==='save-data')assert.equal(state.memory.ram.find(item=>item.id==='file').label,'poznamky.txt');
      if(step.id==='save-transfer')assert.equal(state.memory.ssd.find(item=>item.id==='file').label,'Čeká na zápis');
      if(graphics==='dedicated')assert.deepEqual(plain(state.memory.vram),[]);
      assert.equal(state.effects.screen,'editor','Monitor zůstává otevřený na dokumentu');
    }
    const final=plain(p.snapshot());
    assert.equal(p.status,'ended');assert.equal(h.pending.size,0);
    assert.equal(final.index,8);assert.equal(final.memory.ssd.find(item=>item.id==='file').label,'poznamky.txt');
    assert.deepEqual(final.memory.ssd.find(item=>item.id==='file'),final.memory.ram.find(item=>item.id==='file'));
    p.reset();assert.deepEqual(plain(p.snapshot().memory),initial);
    p.play();h.advance(100000);
    assert.equal(p.status,'ended');assert.equal(h.pending.size,0);
    assert.deepEqual(plain(p.snapshot().memory),final.memory);
    assert.deepEqual(plain(p.snapshot().effects),final.effects);
  });
}

test('Zrušení zápisu do flash a přepnutí scénáře nezanechají hotový soubor ani časovač',()=>{
  const h=harness('save'),p=h.player;
  for(let i=0;i<8;i++)stepForward(p);
  assert.equal(p.snapshot().memory.ssd.find(item=>item.id==='file').label,'Čeká na zápis');
  p.next();h.advance(1200);p.reset();h.advance(10000);
  assert.equal(p.index,-1);assert.equal(h.pending.size,0);
  assert.ok(!p.snapshot().memory.ssd.some(item=>item.id==='file'));
  finishStepping(p);assert.equal(p.snapshot().memory.ssd.find(item=>item.id==='file').label,'poznamky.txt');
  p.select('calculator');assert.ok(!p.snapshot().memory.ssd.some(item=>item.id==='file'));
  p.select('save',true);assert.equal(p.steps.length,9);
  assert.ok(!p.snapshot().memory.ram.some(item=>item.id==='file'));
  p.play();h.advance(500);p.select('youtube');h.advance(10000);
  assert.equal(p.index,-1);assert.equal(h.pending.size,0);
  assert.ok(!p.snapshot().memory.ssd.some(item=>item.id==='file'));
});

for(const detailed of [false,true])for(const graphics of ['integrated','dedicated']){
  test(`Zapnutí/${detailed?'cache':'bez cache'}/${graphics}: firmware, zavaděč a systém navazují až po dokončení`,()=>{
    const h=harness('boot',detailed,graphics),p=h.player,initial=plain(p.snapshot());
    assert.equal(initial.effects.powered,false);assert.equal(initial.effects.ramReady,false);
    assert.equal(initial.effects.screen,'black');assert.deepEqual(initial.memory.ram,[]);
    assert.equal(p.steps.length,graphics==='dedicated'?22:18);
    const complete={
      'firmware-read':{cpuSoftware:'UEFI'},'hardware-init':{ramReady:true},
      'loader-read':{cpuSoftware:'Zavaděč'},'system-read':{cpuSoftware:'Operační systém'},
      ready:{screen:'login',cpuWork:false}
    };
    for(const s of p.steps){
      const before=plain(p.snapshot());p.next();h.advance(1000);p.pause();
      let state=p.snapshot();assert.equal(state.step.id,s.id);
      assert.deepEqual(plain(state.memory),before.memory,'Uložení čeká na dojezd zprávy');
      for(const key of Object.keys(complete[s.id]||{}))assert.equal(state.effects[key],before.effects[key],key+' se nemění před dokončením');
      assert.ok(state.flows.length<=1);assert.ok(!state.active.includes('mouse'));
      assert.ok(!state.flows.some(f=>['networkServer','serverNetwork','ramAudio','audioSpeakers'].includes(f.route)));
      const paused=plain(state);h.advance(1000);assert.deepEqual(plain(p.snapshot()),paused);
      stepForward(p);state=p.snapshot();
      assert.deepEqual(plain(state.memory.ssd),initial.memory.ssd,'Čtení nemaže ani nepřepisuje SSD');
      for(const [key,value]of Object.entries(complete[s.id]||{}))assert.equal(state.effects[key],value);
      if(s.id==='power-on')assert.equal(state.effects.powered,true);
      if(s.id==='loader-load')assert.ok(state.memory.ram.some(i=>i.id==='loader'));
      if(s.id==='system-load')assert.ok(state.memory.ram.some(i=>i.id==='system'));
      if(s.id!=='ready')assert.equal(state.effects.screen,'black','Přihlášení se neobjeví před obrazovým signálem');
    }
    const final=plain(p.snapshot());assert.equal(final.status,'ended');assert.equal(final.effects.screen,'login');
    assert.equal(final.effects.cpuSoftware,'Operační systém');
    assert.deepEqual(final.memory.ram.map(i=>i.id),['request','loader','system','image','commands']);
    p.reset();assert.deepEqual(plain(p.snapshot().effects),initial.effects);assert.deepEqual(plain(p.snapshot().memory),initial.memory);
    p.play();h.advance(200000);assert.deepEqual(plain(p.snapshot().effects),final.effects);assert.deepEqual(plain(p.snapshot().memory),final.memory);
    p.reset();assert.equal(h.pending.size,0);
  });
}

test('Zrušení inicializace a přepnutí z/do startu obnoví napájení, RAM i software CPU',()=>{
  const h=harness('boot'),p=h.player;stepForward(p);stepForward(p);
  p.next();h.advance(1200);assert.equal(p.snapshot().effects.ramReady,false);
  p.reset();h.advance(10000);assert.equal(p.snapshot().effects.powered,false);
  assert.equal(p.snapshot().effects.ramReady,false);assert.equal(h.pending.size,0);
  p.select('calculator');assert.equal(p.snapshot().effects.powered,undefined);
  assert.equal(p.snapshot().effects.cpuSoftware,undefined);assert.equal(p.snapshot().effects.screen,'desktop');
  p.play();h.advance(1200);p.select('boot',true,'dedicated');h.advance(10000);
  assert.equal(p.status,'ready');assert.equal(p.snapshot().effects.powered,false);
  assert.deepEqual(plain(p.snapshot().memory.ram),[]);assert.deepEqual(plain(p.snapshot().memory.vram),[]);
  assert.equal(h.pending.size,0);
});

test('RAM ve všech 16 variantách ukazuje nejvýše jeden aktuální obsah a obnoví ho po resetu',()=>{
  for(const scenario of scenarios)for(const detailed of [false,true])for(const graphics of ['integrated','dedicated']){
    const h=harness(scenario.id,detailed,graphics),p=h.player,initial=plain(p.snapshot().displayMemory);
    const check=state=>{
      assert.ok(state.displayMemory.ram.length<=1);
      for(const displayed of state.displayMemory.ram)for(const id of displayed.id.split('+')){
        assert.ok(state.memory.ram.some(item=>item.id===id),'Zobrazený obsah už musí být v RAM: '+id);
      }
      assert.deepEqual(plain(state.displayMemory.ssd),plain(state.memory.ssd));
      if(state.graphics==='dedicated')assert.deepEqual(plain(state.displayMemory.vram),plain(state.memory.vram));
    };
    check(p.snapshot());
    for(let i=0;i<p.steps.length;i++){
      p.next();check(p.snapshot());h.advance(1000);check(p.snapshot());
      h.advance(10000);check(p.snapshot());
    }
    finishStepping(p);const final=plain(p.snapshot().displayMemory);
    p.reset();assert.deepEqual(plain(p.snapshot().displayMemory),initial);
    p.play();h.advance(200000);assert.deepEqual(plain(p.snapshot().displayMemory),final);
    for(const state of h.changes)check(state);
    p.reset();assert.deepEqual(plain(p.snapshot().displayMemory),initial);
  }
});

test('Kalkulačka nahradí požadavek až dojezdem kódu a při čtení vybere podklady místo starých příkazů',()=>{
  for(const detailed of [false,true])for(const graphics of ['integrated','dedicated']){
    const h=harness('calculator',detailed,graphics),p=h.player;
    while(p.steps[p.index+1].id!=='load')stepForward(p);
    assert.equal(p.snapshot().displayMemory.ram[0].id,'request');
    p.next();h.advance(1000);p.pause();
    assert.equal(p.snapshot().displayMemory.ram[0].id,'request');
    const held=plain(p.snapshot().displayMemory);h.advance(3000);assert.deepEqual(plain(p.snapshot().displayMemory),held);
    stepForward(p);assert.equal(p.snapshot().displayMemory.ram[0].id,'program');
    assert.ok(p.snapshot().memory.ram.some(item=>item.id==='request'),'Skrytí starého požadavku nemaže model paměti');
    while(p.status!=='ended'){
      stepForward(p);const s=p.snapshot();
      if(s.step.id==='graphics-commands-read')assert.equal(s.displayMemory.ram[0].id,'commands');
      if(s.step.id==='graphics-upload'||(detailed&&s.step.id==='draw'))assert.equal(s.displayMemory.ram[0].id,'image');
      assert.ok(!s.displayMemory.ram.some(item=>item.id==='request'));
    }
    const state=p.snapshot(),actual=plain(state.memory.ram);
    state.displayMemory.ram[0].label='Změněný náhled';
    assert.deepEqual(plain(state.memory.ram),actual,'Náhled nemění uložená data');
  }
});

test('Video vybere příkazy, obraz a zvuk podle práce a při příjmu dalších částí obnoví aktuální obsah',()=>{
  for(const detailed of [false,true])for(const graphics of ['integrated','dedicated']){
    const h=harness('youtube',detailed,graphics),p=h.player;
    for(let i=0;i<p.steps.length;i++){
      stepForward(p);const s=p.snapshot();
      if(s.step.id==='buffer')assert.equal(s.displayMemory.ram[0].id,'received');
      if(s.step.id==='video-commands-read'||s.step.id==='graphics-commands-read')assert.equal(s.displayMemory.ram[0].id,'commands');
      if(s.step.id==='graphics-upload')assert.equal(s.displayMemory.ram[0].label,'Video');
      if(s.step.id==='audio-read')assert.equal(s.displayMemory.ram[0].label,'Zvukové vzorky');
    }
    finishStepping(p);
    assert.equal(p.snapshot().displayMemory.ram[0].label,detailed?'Zvukové vzorky':'Video a zvuk (části 1–3)');
    assert.ok(p.snapshot().memory.ram.some(item=>item.id==='program'));
    assert.ok(p.snapshot().memory.ram.some(item=>item.id==='prepared'));
  }
});

test('Ukládání vrátí do náhledu RAM soubor po čtení požadavku; start nahradí zavaděč částmi systému',()=>{
  for(const detailed of [false,true])for(const graphics of ['integrated','dedicated']){
    const save=harness('save',detailed,graphics).player;
    assert.equal(save.snapshot().displayMemory.ram[0].id,'document');
    while(save.status!=='ended'){
      stepForward(save);const s=save.snapshot();
      if(s.step.id==='save-request-read')assert.equal(s.displayMemory.ram[0].id,'request');
      if(['save-transfer','save-flash'].includes(s.step.id))assert.equal(s.displayMemory.ram[0].label,'poznamky.txt');
    }
    const boot=harness('boot',detailed,graphics).player;
    while(boot.status!=='ended'){
      stepForward(boot);const s=boot.snapshot();
      if(s.step.id==='loader-load')assert.equal(s.displayMemory.ram[0].id,'loader');
      if(s.step.id==='system-load'||s.step.id==='system-start')assert.equal(s.displayMemory.ram[0].id,'system');
    }
    assert.ok(boot.snapshot().memory.ram.some(item=>item.id==='loader'));
    boot.select('calculator');assert.deepEqual(plain(boot.snapshot().displayMemory.ram),[]);
  }
});
