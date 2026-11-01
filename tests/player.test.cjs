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
const {Player,scenarios,routes,layout,connections} = context.window.HWLab;
const plain = value => JSON.parse(JSON.stringify(value));
function harness(id='calculator',detailed=false) {
  let sequence=0, now=0;
  const pending = new Map();
  const changes=[];
  const player = new Player(scenarios, s=>changes.push(s), {
    request(fn) { const id=++sequence; pending.set(id,fn); return id; },
    cancel(id) { pending.delete(id); }
  });
  player.select(id,detailed);
  const advance = ms => {
    for(let remaining=ms;remaining>0;remaining-=Math.min(remaining,20)) {
      now+=Math.min(remaining,20); const callbacks=[...pending.values()]; pending.clear(); callbacks.forEach(fn=>fn(now));
    }
  };
  return {player,pending,advance,changes};
}
function finishStepping(player) {
  let clicks=0;
  while(player.status!=='ended'&&clicks++<100)player.next();
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
        if(detailed)assert.equal(frame.flows.length,1);
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
    assert.equal(p.snapshot().effects.screen,scenario.id==='calculator'?'calculator':'video');
    const stepper=harness(scenario.id,detailed);
    finishStepping(stepper.player);
    assert.deepEqual(plain(stepper.player.snapshot().effects),plain(p.snapshot().effects));
    p.reset(); assert.deepEqual(plain(p.snapshot().effects),plain(scenario.initial));
    assert.equal(p.index,-1); assert.equal(h.pending.size,0);
  });
}
test('Zjednodušené přípravy zastupují stejné rozvedené kroky podrobného režimu',()=>{
  const groups={
    calculator:{'read-request':['read-request','read-request-read'],load:['load','read-complete'],execute:['calculator-cache','calculator-registers','execute','read-data'],process:[],'write-data':['write-data','graphics-commands-write'],draw:['graphics-commands-read','draw']},
    youtube:{'request-notify':['request-notify','request-read'],buffer:['buffer','receive-notify'],prepare:['playback-cache','playback-registers'],'playback-write':['playback-write','video-commands-write'],'video-read':['video-commands-read','video-read'],'video-process':[],playback:['image-output','sound-output']}
  };
  for(const scenario of scenarios){
    const base=scenario.createSteps(false),detail=scenario.createSteps(true);
    assert.deepEqual(plain(base.flatMap(s=>groups[scenario.id][s.id]||[s.id])),plain(detail.map(s=>s.id)));
    const preparation=base.find(s=>s.id===(scenario.id==='calculator'?'process':'prepare'));
    assert.deepEqual(plain(preparation.active),['cpu']);assert.equal(preparation.flows.length,0);
    assert.equal(preparation.highlights[0].label,scenario.id==='calculator'?'Zpracování':'Příprava přehrávání');
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
    p.next();
    for(const [i,transfer]of expected.entries()){
      p.next();const state=p.snapshot();
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
    ramCpu:['ram','bottom','cpu','top'],cpuGpu:['cpu','right','gpu','left'],cpuNetwork:['cpu','right','network','left'],
    ramGpu:['ram','right','gpu','left'],gpuMonitor:['gpu','right','monitor','left'],
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
    for(let i=0;i<p.steps.length-1;i++)p.next();
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
  for(const scenario of scenarios) for(const detailed of [true]) {
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
    for(let i=0;i<=requestIndex;i++)p.next();
    assert.ok(p.snapshot().flows.some(f=>f.route==='cpuGpu'));
    p.next();const stepped=plain(p.snapshot().flows);
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
test('Krokování za běhu pozastaví a pokračování nezačne již dokončený krok',()=>{
  const h=harness();h.player.play();h.advance(600);h.player.next();
  assert.equal(h.player.index,1);assert.equal(h.player.snapshot().progress,1);
  assert.equal(h.player.status,'paused');assert.equal(h.pending.size,0);
  h.player.play();assert.equal(h.player.index,2);assert.equal(h.player.snapshot().progress,0);
});
test('Více stisků Spustit nevytvoří více časovačů a dokončený děj lze přehrát znovu',()=>{
  const h=harness();h.player.play();h.player.play();assert.equal(h.pending.size,1);
  h.advance(100000);h.player.next();assert.equal(h.player.status,'ended');
  h.player.play();assert.equal(h.player.index,0);assert.equal(h.player.status,'playing');
  assert.equal(h.player.snapshot().effects.screen,'desktop');assert.equal(h.pending.size,1);
});

test('Základní scénáře mají přesně 10 a 15 kroků s předepsanými přenosy',()=>{
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
  ]};
  for(const scenario of scenarios){
    const steps=scenario.createSteps(false);assert.equal(steps.length,scenario.id==='calculator'?10:15);
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
  for(let i=0;i<5;i++)calc.next();
  let state=calc.snapshot();
  assert.equal(state.index,4);assert.equal(state.flows[0].route,'ramCpu');assert.equal(state.flows[0].reverse,undefined);
  assert.equal(state.flows[0].label,'Instrukce a data');assert.equal(state.effects.ramLoaded,true);
  calc.next();state=calc.snapshot();
  assert.deepEqual(plain(state.active),['cpu']);assert.equal(state.flows.length,0);
  assert.equal(state.highlights[0].target,'cpu');assert.equal(state.highlights[0].label,'Zpracování');
  calc.next();state=calc.snapshot();
  assert.equal(state.flows[0].route,'ramCpu');assert.equal(state.flows[0].reverse,true);assert.equal(state.flows[0].label,'Podklady a příkazy');
  calc.next();calc.next();state=calc.snapshot();
  assert.equal(state.index,8);assert.equal(state.effects.screen,'loading');assert.equal(state.flows[0].route,'ramGpu');
  calc.next();state=calc.snapshot();
  assert.equal(state.index,9);assert.equal(state.status,'ended');assert.equal(state.effects.screen,'calculator');
  assert.equal(state.flows[0].route,'gpuMonitor');
  const h=harness('calculator');h.player.play();h.advance(100000);
  for(const s of h.changes.filter(s=>s.index>=0))assert.equal(s.effects.screen==='calculator',s.index===9);

  const video=harness('youtube').player;
  for(let i=0;i<7;i++)video.next();state=video.snapshot();
  assert.equal(state.index,6);assert.equal(state.flows[0].route,'ramCpu');assert.equal(state.flows[0].label,'Instrukce a data');
  video.next();state=video.snapshot();
  assert.equal(state.index,7);assert.deepEqual(plain(state.active),['cpu']);assert.equal(state.flows.length,0);
  assert.equal(state.highlights[0].target,'cpu');assert.equal(state.highlights[0].label,'Příprava přehrávání');
  video.next();state=video.snapshot();
  assert.equal(state.index,8);assert.equal(state.flows[0].route,'ramCpu');assert.equal(state.flows[0].reverse,true);assert.equal(state.flows[0].label,'Data a příkazy');
  video.next();video.next();state=video.snapshot();
  assert.equal(state.index,10);assert.equal(state.flows[0].label,'Video a příkazy');
  video.next();state=video.snapshot();
  assert.equal(state.index,11);assert.deepEqual(plain(state.active),['gpu']);assert.equal(state.flows.length,0);
  assert.equal(state.highlights[0].label,'Zpracování videa');assert.equal(state.effects.buffer,2);
  video.next();video.next();video.next();state=video.snapshot();
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
