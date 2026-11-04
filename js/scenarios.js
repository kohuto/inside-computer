/* Každý scénář je jen obsah a stav schématu. O čas i vykreslení se starají jiné soubory.
   effects se dědí mezi kroky, active/flows platí pouze pro aktuální krok.
   memoryWrites mění zobrazený obsah paměti až po dokončení přenosu.
   Podrobná varianta rozvádí tentýž příběh, který základní režim místy shrnuje. */
window.HWLab = window.HWLab || {};
(function (Lab) {
  'use strict';
  // reverse používá tutéž spojnici opačným směrem (například zápis CPU → RAM).
  const flow = (route, type, label, reverse = false) => ({ route, type, label, ...(reverse ? { reverse: true } : {}) });
  const step = (id, title, description, active, flows = [], effects = {}, duration = 2900) =>
    ({ id, title, description, active, flows, effects, duration });
  const item = (id, label) => ({ id, label });
  const ramWrite = (...items) => ({ ram: items });
  const withMemory = (steps, writes) => steps.map(s => writes[s.id] ? { ...s, memoryWrites: writes[s.id] } : s);
  const focus = (ids,label) => ({ids,...(label ? {label} : {})});
  const withRamFocus = (steps,focuses) => steps.map(s => focuses[s.id] ? {...s,ramFocus:focuses[s.id]} : s);

  const click = () => step('click', 'Kliknutí je vstup pro počítač',
    'Myš odešle informaci o kliknutí. Procesor zpracuje instrukce, které na tento vstup navazují.',
    ['mouse', 'cpu'], [flow('mouseCpu', 'control', 'vstup z myši')], { clicked: true });
  const cpuDetail = (prefix, context) => [
    step(prefix + '-cache', 'Blízká data v cache procesoru',
      context + ' Potřebné instrukce a často používaná data z RAM se průběžně dostávají do malé, rychlé cache uvnitř CPU.',
      ['ram', 'cpu', 'cache'], [flow('ramCache', 'control', 'instrukce a data')], { cpuWork: true }),
    step(prefix + '-registers', 'Registry drží právě používané hodnoty',
    'Při vykonávání instrukcí CPU pracuje s jednotlivými hodnotami a adresami v registrech. Do registru se nenačítá celý program.',
      ['cpu', 'cache', 'registers'], [flow('cacheRegisters', 'control', null)], {}, 3200)
  ];

  // Stejně jako u síťové části: příprava požadavku, oznámení zařízení,
  // načtení požadavku a teprve poté přenos obsahu a oznámení dokončení.
  const calcRequest = () => [
    step('read-request-write', 'CPU připraví požadavek v RAM',
      'CPU zapíše do RAM požadavek na načtení kalkulačky z SSD. Určí, které části kódu a dat načíst a kam je v RAM uložit.',
      ['cpu', 'ram'], [flow('ramCpu', 'control', 'Požadavek na načtení', true)], { cpuWork: true }, 3100),
    step('read-request', 'CPU oznámí SSD nový požadavek',
      'CPU oznámí řadiči SSD, že je v RAM připravený nový požadavek. Samotný příkaz si SSD načte z paměti.',
      ['cpu', 'ssd'], [flow('cpuSsd', 'control', 'Oznámení nového požadavku')]),
    step('read-request-read', 'SSD načte požadavek z RAM',
      'Řadič SSD načte z RAM připravený příkaz. Získá tak údaje o požadovaném obsahu a jeho cílovém umístění v RAM.',
      ['ram', 'ssd'], [flow('ssdRam', 'control', 'Požadavek na načtení', true)])
  ];
  const calcLoad = detailed => step('load', 'Ze SSD do pracovní paměti',
    detailed
      ? 'Řadiče přenesou potřebný kód a data z SSD do RAM pomocí DMA (přímého přístupu do paměti). Výpočetní jádra CPU nemusí jednotlivé bajty kopírovat.'
      : 'Řadiče přenesou potřebný kód a data z SSD do RAM, kde budou dostupné pro běh programu. CPU nemusí jednotlivé bajty kopírovat.',
    ['ssd', 'ram'], [flow('ssdRam', 'data', 'Kód a data')], { ramLoaded: true }, 3500);
  const calcLoaded = () => step('read-complete', 'SSD oznámí dokončení načítání',
    'Řadič SSD oznámí CPU, že byl přenos dokončen. Kód a data už jsou v RAM; oznámení tento obsah znovu nepřenáší.',
    ['ssd', 'cpu'], [flow('cpuSsd', 'control', 'Oznámení dokončení', true)]);
  const calcRun = detailed => [
    step('execute', 'CPU načítá instrukce kalkulačky',
      detailed
        ? 'CPU vykonává instrukce kalkulačky; pokud nejsou v cache, doplní se z RAM. Ne každá instrukce proto vyžaduje nový přenos z RAM.'
        : 'Z RAM se do CPU podle potřeby načítají instrukce kalkulačky. CPU je vykonává a připravuje spuštění aplikace.',
      ['cpu', 'ram', ...(detailed ? ['cache'] : [])], [flow('ramCpu', 'control', 'instrukce programu')], { cpuWork: true }, 3200),
    step('read-data', 'CPU čte pracovní data',
      detailed
        ? 'CPU čte také pracovní data, například údaje o připravovaném okně; často je získá už z cache. Jednotlivé právě používané hodnoty zpracovává v registrech.'
        : 'CPU čte z RAM také pracovní data, například údaje o připravovaném okně. Načtené instrukce určují, jak s těmito daty pracovat.',
      ['cpu', 'ram', ...(detailed ? ['cache', 'registers'] : [])], [flow('ramCpu', 'data', 'čtení dat')], {}, 3200),
    step('write-data', 'CPU připraví podklady pro obraz v RAM',
      detailed
        ? 'CPU připraví údaje pro obraz okna a zapíše je do RAM; zápisy mohou nejprve čekat v cache. Příkazy pro grafickou část připraví v následujícím kroku.'
        : 'CPU zapíše do RAM připravené podklady pro obraz okna kalkulačky. V následujícím kroku připraví příkazy pro grafickou část.',
      ['cpu', 'ram', ...(detailed ? ['cache'] : [])], [flow('ramCpu', 'data', 'Připravené podklady pro obraz', true)], {}, 3200)
  ];
  const calcGraphics = () => [
    step('graphics-commands-write', 'CPU zapíše příkazy vykreslení do RAM',
      'CPU uloží do RAM příkazy pro vykreslení okna kalkulačky. Ty určují požadovanou práci a umístění obrazových podkladů.',
      ['cpu', 'ram'], [flow('ramCpu', 'control', 'Příkazy vykreslení', true)]),
    step('graphics-request', 'CPU oznámí grafické části novou práci',
      'CPU oznámí grafické části, že jsou v RAM připravené nové příkazy. Jejich obsah i obrazové podklady si grafická část načte z paměti.',
      ['cpu', 'gpu'], [flow('cpuGpu', 'control', 'Oznámení nové práce')]),
    step('graphics-commands-read', 'Grafická část načte příkazy z RAM',
      'Grafická část převezme z RAM příkazy vykreslení. Získá tak také údaje o umístění připravených obrazových podkladů.',
      ['ram', 'gpu'], [flow('ramGpu', 'control', 'Příkazy vykreslení')]),
    step('draw', 'Grafická část načítá podklady z RAM',
      'Podle načtených příkazů grafická část převezme ze společné RAM obrazové podklady a připraví obraz okna. Načtení příkazů a samotných podkladů ukazujeme odděleně.',
      ['ram', 'gpu'], [flow('ramGpu', 'data', 'Podklady pro obraz')], { screen: 'loading' }, 3500)
  ];
  const calcReady = () => step('ready', 'Kalkulačka je připravená',
    'Grafická část posílá obraz do monitoru. Okno kalkulačky je zobrazené a připravené k použití.',
    ['gpu', 'monitor'], [flow('gpuMonitor', 'output', 'Obrazový signál')], { screen: 'calculator', cpuWork: false }, 2700);

  const calc = detailed => [click(), ...calcRequest(), calcLoad(detailed), calcLoaded(),
    ...(detailed ? cpuDetail('calculator', 'Teď už jsou v RAM i potřebné části kalkulačky.') : []),
    ...calcRun(detailed), ...calcGraphics(), calcReady()];

  // Základní příběh má 18 postupných přenosů. Cache a registry pouze rozvádějí
  // práci CPU s vybranými údaji; proud komprimovaného videa jimi nevedeme.
  const youtube = detailed => [
    step('play-click', 'Kliknutí na Přehrát',
      'Myš odešle informaci o kliknutí na Přehrát. CPU vykoná instrukce, které na tento vstup navazují.',
      ['mouse', 'cpu'], [flow('mouseCpu', 'control', 'Kliknutí na Přehrát')], { clicked: true }),
    step('request-write', 'CPU připraví požadavek v RAM',
      'CPU zapíše do RAM údaje požadavku na video. Síťové rozhraní si je odtud bude moci načíst.',
      ['cpu', 'ram'], [flow('ramCpu', 'control', 'Požadavek na video', true)], { cpuWork: true }),
    step('request-notify', 'CPU oznámí nový požadavek',
      'CPU oznámí síťovému rozhraní, že je v RAM připravený nový požadavek. Samotné údaje požadavku zůstávají v paměti.',
      ['cpu', 'network'], [flow('cpuNetwork', 'control', 'Oznámení nového požadavku')]),
    step('request-read', 'Síťová část načte požadavek z RAM',
      'Síťové rozhraní načte připravené údaje požadavku z RAM. Přenos obsahu z paměti je oddělený od předchozího oznámení CPU.',
      ['ram', 'network'], [flow('networkRam', 'control', 'Požadavek na video', true)]),
    step('request-server', 'Požadavek putuje na server',
      'Síťové rozhraní odešle požadavek přes internet na vzdálený server. Ten může začít posílat multimediální obsah po částech.',
      ['network', 'server'], [flow('networkServer', 'control', 'Požadavek na video')]),
    step('receive', 'Server posílá video a zvuk',
      'Server odešle první část komprimovaného videa a zvuku. Síťové rozhraní přijímá jen část pro začátek přehrávání, nikoli celé video.',
      ['server', 'network'], [flow('serverNetwork', 'data', 'Video a zvuk')], {}, 3300),
    step('buffer', 'Přijatý obsah se uloží do RAM',
      'Síťové rozhraní přenese přijatá data do vyrovnávací paměti v RAM. CPU nemusí jednotlivé bajty tohoto přenosu kopírovat.',
      ['network', 'ram'], [flow('networkRam', 'data', 'Video a zvuk')], { buffer: 2 }, 3300),
    step('receive-notify', 'Síťová část oznámí přijetí dat',
      'Síťové rozhraní oznámí CPU, že jsou nová data dostupná v RAM. Oznámení je krátká řídicí informace, nikoli celý přijatý obsah.',
      ['network', 'cpu'], [flow('cpuNetwork', 'control', 'Oznámení přijatých dat', true)]),
    step('received-read', 'CPU načte potřebná přijatá data',
      'CPU zpracuje přijatý síťový obsah včetně dešifrování, připraví video a dekóduje zvuk. Dekódování obrazu zůstává úkolem grafické části.',
      ['ram', 'cpu'], [flow('ramCpu', 'data', 'Přijatá data')], { cpuWork: true }, 3300),
    ...(detailed ? cpuDetail('playback', 'CPU připravuje přijatý obsah k přehrávání; obraz později dekóduje grafická část.') : []),
    step('playback-write', 'CPU připraví data přehrávání v RAM',
      detailed
        ? 'CPU zapíše do RAM připravené video a zvukové vzorky; zápisy mohou nejprve čekat v cache. Obrazová data zůstávají komprimovaná pro grafický videodekodér.'
        : 'CPU zapíše do RAM zpracovaný zvuk a údaje pro přehrávání. Video zatím zůstává komprimované a bude je dekódovat grafická část.',
      ['cpu', 'ram', ...(detailed ? ['cache'] : [])], [flow('ramCpu', 'data', 'Připravená data přehrávání', true)], {}, 3300),
    step('video-commands-write', 'CPU zapíše příkazy pro grafickou část',
      'CPU uloží do RAM příkazy určující zpracování videa a umístění jeho dat. Jde o příkazy pro grafický hardware.',
      ['cpu', 'ram'], [flow('ramCpu', 'control', 'Příkazy zpracování videa', true)]),
    step('graphics-notify', 'CPU oznámí grafické části novou práci',
      'CPU oznámí grafické části, že jsou v RAM připravené nové příkazy. Jejich obsah i video si grafická část načte z paměti.',
      ['cpu', 'gpu'], [flow('cpuGpu', 'control', 'Oznámení nové práce')]),
    step('video-commands-read', 'Grafická část načte příkazy z RAM',
      'Grafická část převezme z RAM příkazy zpracování videa. Získá tak také údaje o umístění připraveného obsahu.',
      ['ram', 'gpu'], [flow('ramGpu', 'control', 'Příkazy zpracování videa')]),
    step('video-read', 'Grafická část načte a dekóduje video',
      'Specializovaný videodekodér grafické části načte komprimované video ze společné RAM a připraví obrazové snímky. Obsah videa nemusí procházet výpočetními jádry CPU.',
      ['ram', 'gpu'], [flow('ramGpu', 'data', 'Video')], { buffer: 2 }, 3300),
    step('audio-setup', 'CPU nastaví zvukové přehrávání',
      'CPU předá zvukové části nastavení přehrávání a umístění připravených zvukových dat v RAM. Poté si zvuková část může obsah načíst.',
      ['cpu', 'audio'], [flow('audioCpu', 'control', 'Nastavení přehrávání', true)]),
    step('audio-read', 'Zvuková část načte zvuk z RAM',
      'Zvuková část načte z RAM připravená zvuková data. Z nich připraví signál pro zvukový výstup.',
      ['ram', 'audio'], [flow('ramAudio', 'data', 'Zvuk')]),
    step('image-output', 'Monitor zobrazí první obraz',
      'Grafická část odešle obrazový signál monitoru, který zobrazí první připravený snímek. Následuje spuštění odpovídajícího zvukového výstupu.',
      ['gpu', 'monitor'], [flow('gpuMonitor', 'output', 'Obrazový signál')],
      { screen: 'video', playback: true, playbackFrom: 0, playbackTo: 0, soundPlaying: false, cpuWork: false }),
    step('sound-output', 'Obraz a zvuk se přehrávají',
      'Reproduktory přehrávají zvuk odpovídající obrazu a krátká ukázka se poté zastaví. V reálu mohou mezitím přicházet a zpracovávat se další části; ukázali jsme začátek, nikoli stažení celého videa.',
      ['audio', 'speakers', 'monitor'], [flow('audioSpeakers', 'output', 'Zvukový signál')],
      { playbackFrom: 0, playbackTo: 3, soundPlaying: true, buffer: 2 }, 6000)
  ];

  // Základní režimy obsahují i zvýraznění zpracování bez přenosu. phases jsou části stejného
  // číslovaného kroku; jejich čas i souběžné přenosy řídí společný přehrávač.
  const highlight = (target, label) => ({ target, label });
  const staged = (content, phases) => ({ ...content, phases });
  const calcBasic = () => [
    step('click', 'Kliknutí je vstup pro počítač',
      'Myš odešle informaci o kliknutí na ikonu kalkulačky. CPU vykonává instrukce, které na tento vstup navazují.',
      ['mouse', 'cpu'], [flow('mouseCpu', 'control', 'Kliknutí na kalkulačku')], { clicked: true }),
    step('read-request-write', 'CPU připraví požadavek v RAM',
      'CPU zapíše do RAM příkaz určující, které části kalkulačky načíst z NVMe SSD a kam je uložit. RAM sama o načtení nežádá.',
      ['cpu', 'ram'], [flow('ramCpu', 'control', 'Požadavek na načtení', true)], { cpuWork: true }),
    step('read-request', 'CPU oznámí SSD novou práci',
      'CPU upozorní řadič SSD na práci připravenou v RAM. Řadič si odtud načte příkaz; tento detail zde samostatně neanimujeme.',
      ['cpu', 'ssd'], [flow('cpuSsd', 'control', 'Oznámení nové práce')]),
    step('load', 'Kód a data se načtou do RAM',
      'Řadič SSD přenese potřebný kód a data do RAM pomocí DMA. Výpočetní jádra CPU nemusí jednotlivé bajty kopírovat.',
      ['ssd', 'ram'], [flow('ssdRam', 'data', 'Kód a data')], { ramLoaded: true }, 3500),
    step('execute', 'CPU načte instrukce a data',
      'CPU načte z RAM potřebné instrukce kalkulačky a pracovní data. Čtení jejich obsah v RAM nemaže.',
      ['ram', 'cpu'], [flow('ramCpu', 'data', 'Instrukce a data')], { cpuWork: true }, 3200),
    { ...step('process', 'CPU zpracovává program',
      'Procesor vykonává načtené instrukce a pracuje s daty. Připraví podklady a příkazy pro zobrazení okna, které následně zapíše do RAM.',
      ['cpu'], [], { cpuWork: true }, 3800),
      highlights: [highlight('cpu', 'Zpracování')] },
    step('write-data', 'CPU zapíše podklady a příkazy',
      'CPU uloží do RAM připravené obrazové podklady i vykreslovací příkazy. Grafická část je bude moci načíst z paměti.',
      ['cpu', 'ram'], [flow('ramCpu', 'data', 'Podklady a příkazy', true)], {}, 3200),
    step('graphics-request', 'CPU oznámí grafické části novou práci',
      'CPU oznámí dostupnost připravené práce. Podklady a vykreslovací příkazy zůstávají v RAM, odkud si je grafická část načte.',
      ['cpu', 'gpu'], [flow('cpuGpu', 'control', 'Oznámení nové práce')]),
    step('draw', 'Grafická část načte podklady a příkazy',
      'Grafická část načte ze společné RAM podklady i příkazy a připraví obraz okna. Čtení jejich obsah v RAM nemaže.',
      ['ram', 'gpu'], [flow('ramGpu', 'data', 'Podklady a příkazy')], { screen: 'loading' }, 3500),
    step('ready', 'Kalkulačka se zobrazí na monitoru',
      'Grafická část odešle obrazový signál monitoru. Na monitoru se zobrazí kalkulačka připravená k použití.',
      ['gpu', 'monitor'], [flow('gpuMonitor', 'output', 'Obrazový signál')], { screen: 'calculator', cpuWork: false }, 2900)
  ];

  const youtubeBasic = () => {
    const outputs = [flow('gpuMonitor', 'output', 'Obrazový signál'), flow('audioSpeakers', 'output', 'Zvukový signál')];
    const playing = ['gpu', 'audio', 'monitor', 'speakers'];
    return [
      step('play-click', 'Kliknutí na Přehrát',
        'YouTube už je otevřený. Myš odešle CPU informaci o kliknutí na Přehrát.',
        ['mouse', 'cpu'], [flow('mouseCpu', 'control', 'Kliknutí na Přehrát')], { clicked: true }),
      step('request-write', 'CPU připraví požadavek v RAM',
        'CPU zapíše do RAM požadavek na potřebný úsek videa. Síťová část si jej odtud bude moci načíst.',
        ['cpu', 'ram'], [flow('ramCpu', 'control', 'Požadavek na video', true)], { cpuWork: true }),
      step('request-notify', 'CPU oznámí síťové části novou práci',
        'CPU upozorní síťovou část na požadavek připravený v RAM. Síťová část si jej odtud načte; tento detail zde samostatně neanimujeme.',
        ['cpu', 'network'], [flow('cpuNetwork', 'control', 'Oznámení nové práce')]),
      step('request-server', 'Požadavek putuje na server',
        'Síťová část odešle požadavek přes internet na vzdálený server. Potřebný úsek videa se teprve stáhne.',
        ['network', 'server'], [flow('networkServer', 'control', 'Požadavek na video')]),
      step('receive', 'Server posílá video a zvuk',
        'Server posílá první část obsahu videa a zvuku. Přijatý obsah ještě není připravený přímo pro monitor a reproduktory.',
        ['server', 'network'], [flow('serverNetwork', 'data', 'Video a zvuk')], {}, 3300),
      step('buffer', 'Síťová část zapíše data do RAM',
        'Síťová část uloží přijatý obsah do vyrovnávací paměti v RAM pomocí DMA. Přenos neprochází výpočetními jádry CPU.',
        ['network', 'ram'], [flow('networkRam', 'data', 'Video a zvuk')], { buffer: 2 }, 3300),
      step('received-read', 'CPU načte instrukce a data',
        'CPU načte z RAM potřebné instrukce prohlížeče a přijatá pracovní data. Čtení jejich obsah v RAM nemaže.',
        ['ram', 'cpu'], [flow('ramCpu', 'data', 'Instrukce a data')], { cpuWork: true }, 3200),
      { ...step('prepare', 'Příprava přehrávání',
        'CPU zpracuje načtená data včetně dešifrování a dekódování zvuku. Připraví video, zvukové vzorky a příkazy pro následný zápis do RAM.',
        ['cpu'], [], { cpuWork: true }, 4200),
        highlights: [highlight('cpu', 'Příprava přehrávání')] },
      step('playback-write', 'CPU zapíše data a příkazy do RAM',
        'CPU zapíše do RAM připravené video, zvukové vzorky a příkazy. Obrazová data jsou stále komprimovaná, zvuk už má podobu vzorků.',
        ['cpu', 'ram'], [flow('ramCpu', 'data', 'Data a příkazy', true)], {}, 3200),
      step('graphics-notify', 'CPU oznámí grafické části novou práci',
        'CPU pouze oznámí připravenou práci. Příkazy i video si grafická část načte z RAM.',
        ['cpu', 'gpu'], [flow('cpuGpu', 'control', 'Oznámení nové práce')]),
      step('video-read', 'Grafická část načte video a příkazy',
        'Grafická část převezme z RAM připravené video i příkazy pro jeho zpracování. Čtení data z RAM nemaže.',
        ['ram', 'gpu'], [flow('ramGpu', 'data', 'Video a příkazy')], {}, 3300),
      { ...step('video-process', 'Grafická část zpracovává video',
        'Specializovaný videodekodér grafické části dekóduje připravené video. Vznikají obrazové snímky pro monitor.',
        ['gpu'], [], { screen: 'loading' }, 3000),
        highlights: [highlight('gpu', 'Zpracování videa')] },
      step('audio-setup', 'CPU nastaví a spustí zvukovou část',
        'CPU určí umístění zvukových dat v RAM, jejich formát a spustí přehrávání. Samotné vzorky převezme zvuková část z paměti.',
        ['cpu', 'audio'], [flow('audioCpu', 'control', 'Spuštění přehrávání', true)]),
      step('audio-read', 'Zvuková část načte zvukové vzorky',
        'Zvuková část načte připravené zvukové vzorky z RAM pomocí DMA. Čtení vzorky z paměti nemaže.',
        ['ram', 'audio'], [flow('ramAudio', 'data', 'Zvukové vzorky')]),
      staged(step('playback', 'Obraz a zvuk se přehrávají souběžně',
        'Monitor zobrazuje obraz a reproduktory přehrávají odpovídající zvuk. Současně přicházejí další data do RAM; krátká ukázka se pak zastaví.',
        playing, outputs, { screen: 'video', playback: true, soundPlaying: true, playbackFrom: 0, playbackTo: 3, cpuWork: false }, 10000), [
        { at: 0 },
        { at: .18, active: [...playing, 'server', 'network'], flows: [...outputs, flow('serverNetwork', 'data', 'Video a zvuk')] },
        { at: .36, active: [...playing, 'network', 'ram'], flows: [...outputs, flow('networkRam', 'data', 'Video a zvuk')], effects: { buffer: 3 },
          memoryWrites: ramWrite(item('received', 'Video a zvuk (části 1–2)')) },
        { at: .54 },
        { at: .66, active: [...playing, 'server', 'network'], flows: [...outputs, flow('serverNetwork', 'data', 'Video a zvuk')] },
        { at: .82, active: [...playing, 'network', 'ram'], flows: [...outputs, flow('networkRam', 'data', 'Video a zvuk')], effects: { buffer: 4 },
          memoryWrites: ramWrite(item('received', 'Video a zvuk (části 1–3)')) },
        { at: .96 }
      ])
    ];
  };

  // Editor i rozepsaný dokument už jsou v RAM. Po přenosu čekají data v SSD
  // na trvalý zápis; hotový soubor přibude až po dokončení devátého kroku.
  // Cache a registry rozvádíme uvnitř stejných kroků, bez prodloužení příběhu.
  const saveFile = detailed => withMemory([
    step('save-click', 'Kliknutí na Uložit',
      'Textový editor je otevřený a dokument je rozepsaný v RAM. Myš odešle CPU informaci o kliknutí na Uložit.',
      ['mouse','cpu'], [flow('mouseCpu','control','Kliknutí na Uložit')], {clicked:true}),
    step('save-read', 'CPU načte instrukce a data',
      detailed ? 'CPU získá potřebné instrukce editoru a vybraná pracovní data z RAM do cache. Často používané údaje mohou být v cache už připravené.'
        : 'CPU načte potřebné instrukce editoru a pracovní data pro uložení dokumentu. Při běhu programu zajišťuje také činnost systému a ovladače.',
      ['ram','cpu',...(detailed ? ['cache'] : [])], [flow(detailed ? 'ramCache' : 'ramCpu','data','Instrukce a data')], {cpuWork:true}, 3200),
    {...step('save-prepare', 'CPU připraví soubor k uložení',
      'CPU připraví obsah dokumentu ve formátu textového souboru poznamky.txt.' + (detailed
        ? ' Cache uchovává potřebné instrukce a data, registry právě používané adresy a jednotlivé hodnoty.'
        : ' Připravené bajty souboru následně zapíše do RAM.'),
      ['cpu',...(detailed ? ['cache','registers'] : [])], [], {}, 3600),
      highlights:[highlight(detailed ? 'cpuRam' : 'cpu','Příprava souboru')]},
    step('save-data', 'CPU zapíše připravená data do RAM',
      'CPU uloží do RAM připravené bajty souboru poznamky.txt. Rozepsaný dokument zůstává dostupný editoru.',
      ['cpu','ram'], [flow('ramCpu','data','Data souboru',true)], {}, 3200),
    step('save-request', 'CPU připraví požadavek na zápis',
      'CPU zapíše do RAM požadavek určující umístění zdrojových dat, jejich délku a cílové bloky SSD. Název souboru a jeho umístění řeší systém souborů.',
      ['cpu','ram'], [flow('ramCpu','control','Požadavek na zápis',true)]),
    step('save-notify', 'CPU oznámí SSD novou práci',
      'CPU upozorní řadič SSD na připravenou práci v RAM. Toto oznámení nepřenáší obsah souboru.',
      ['cpu','ssd'], [flow('cpuSsd','control','Oznámení nové práce')]),
    step('save-request-read', 'SSD načte požadavek z RAM',
      'Řadič SSD si z RAM načte připravený příkaz k zápisu. Zjistí, odkud má data převzít a kam je uložit.',
      ['ram','ssd'], [flow('ssdRam','control','Požadavek na zápis',true)]),
    step('save-transfer', 'Data souboru se přenesou do SSD',
      'Řadič SSD načte data souboru z RAM pomocí DMA. CPU nemusí jednotlivé bajty kopírovat. Přijatá data ještě čekají na trvalý zápis do flash.',
      ['ram','ssd'], [flow('ssdRam','data','Data souboru',true)], {}, 3600),
    {...step('save-flash', 'SSD zapisuje data do flash',
      'SSD dokončí zápis do trvalé paměti. Po skončení tohoto kroku se v SSD objeví poznamky.txt a jeho kopie zůstane v RAM. Ukázka zde končí dokončeným trvalým zápisem.',
      ['ssd'], [], {cpuWork:false}, 4000), highlights:[highlight('ssd','Zápis do flash')]}
  ], {
    'save-data':ramWrite(item('file','poznamky.txt')),
    'save-request':ramWrite(item('request','Požadavek na zápis')),
    'save-transfer':{ssd:[item('file','Čeká na zápis')]},
    'save-flash':{ssd:[item('file','poznamky.txt')]}
  });

  // Studený start: první instrukce pocházejí z flash, RAM se připraví až poté.
  // Zavaděč a potřebné části OS načítáme odděleně. Cache nemění počet kroků.
  const boot = (detailed,graphics) => {
    const cpuActive = ['cpu',...(detailed ? ['cache','registers'] : [])];
    const readRoute = detailed ? 'ramCache' : 'ramCpu';
    const work = (id,title,description,label,effects={}) => ({
      ...step(id,title,description,cpuActive,[],effects,3400),
      highlights:[highlight(detailed ? 'cpuRam' : 'cpu',label)]
    });
    const steps = withMemory([
      {...step('power-on','Stisk vypínače zapne hlavní napájení',
        'Vypínač dá pokyn řídicím obvodům základní desky, které zapnou hlavní výstupy zdroje. Po ustálení napětí může začít start CPU. Pohotovostní napájení je přítomné už před stiskem.',
        ['powerbutton','psu'],[],{powered:true},3000),highlights:[highlight('power','Zapnutí napájení')]},
      {...step('firmware-read','CPU začne číst kód firmwaru UEFI',
        'Po uvolnění resetu CPU čte první instrukce z flash paměti s firmwarem UEFI. RAM ještě není připravená; úvodní kód se proto nemusí nejprve načíst do RAM.',
        ['uefi','cpu'],[flow('uefiCpu','control','Kód firmwaru')],{cpuWork:true},3300),
        completionEffects:{cpuSoftware:'UEFI'}},
      {...work('hardware-init','Firmware připraví hardware',
        'CPU vykonává firmware, provede základní kontroly a připraví paměťový řadič i RAM. Následně zpřístupní zařízení potřebná pro start, včetně SSD a grafiky. Nejde o test každého bajtu paměti.',
        'Inicializace hardwaru'),active:[...cpuActive,'ram','ssd','gpu'],completionEffects:{ramReady:true}},
      work('boot-select','Firmware vybere zavaděč systému',
        'CPU stále vykonává firmware UEFI. Podle uloženého nastavení vybere spouštěcí položku a zavaděč na SSD. V této ukázce se systém spouští z místního SSD.',
        'Výběr zavaděče'),
      step('loader-request','CPU připraví požadavek na zavaděč',
        'RAM je už připravená. CPU v ní vytvoří požadavek na načtení zavaděče systému z SSD. Používáme stejný zjednodušený model čtení jako v ostatních scénářích.',
        ['cpu','ram'],[flow('ramCpu','control','Požadavek na načtení',true)]),
      step('loader-notify','CPU oznámí SSD připravený požadavek',
        'CPU upozorní řadič SSD na novou práci. Převzetí příkazu a oznámení dokončení pro přehlednost slučujeme s následujícím přenosem zavaděče.',
        ['cpu','ssd'],[flow('cpuSsd','control','Oznámení nové práce')]),
      step('loader-load','Zavaděč se načte z SSD do RAM',
        'Řadič SSD přenese kód a data zavaděče do RAM. Původní kopie zůstává na SSD. Zavaděč je malý program, který připraví spuštění operačního systému.',
        ['ssd','ram'],[flow('ssdRam','data','Zavaděč systému')],{ramLoaded:true},3500),
      {...step('loader-read','CPU načte instrukce zavaděče',
        'CPU začne načítat instrukce a data zavaděče z RAM.' + (detailed ? ' Potřebné údaje se dostávají do cache; registry drží jednotlivé právě používané hodnoty.' : ''),
        ['ram',...cpuActive],[flow(readRoute,'control','Instrukce zavaděče')],{},3200),completionEffects:{cpuSoftware:'Zavaděč'}},
      work('loader-run','Zavaděč připraví spuštění systému',
        'CPU nyní vykonává zavaděč. Ten vybere potřebné součásti operačního systému a připraví jejich načtení do RAM.',
        'Spuštění zavaděče'),
      step('system-request','CPU připraví požadavek na části systému',
        'CPU při vykonávání zavaděče připraví v RAM požadavek na potřebné části systému uložené na SSD.',
        ['cpu','ram'],[flow('ramCpu','control','Požadavek na načtení',true)]),
      step('system-notify','CPU oznámí SSD další práci',
        'CPU upozorní SSD na připravené čtení částí operačního systému. Oznámení nepřenáší samotný kód systému.',
        ['cpu','ssd'],[flow('cpuSsd','control','Oznámení nové práce')]),
      step('system-load','Potřebné části systému se načtou do RAM',
        'Z SSD se postupně načítá jádro, potřebné ovladače a další soubory pro start a přihlašovací prostředí. Tento krok shrnuje více čtení; celý systém se do RAM najednou nekopíruje.',
        ['ssd','ram'],[flow('ssdRam','data','Části systému')],{},4000),
      {...step('system-read','CPU převezme instrukce a data systému',
        'Zavaděč předá řízení jádru systému. CPU načítá jeho instrukce a potřebná data z RAM.' + (detailed ? ' Čtení zprostředkovává cache; registry uchovávají právě používané hodnoty a adresy.' : ''),
        ['ram',...cpuActive],[flow(readRoute,'control','Instrukce a data')],{},3200),completionEffects:{cpuSoftware:'Operační systém'}},
      work('system-start','Operační systém zahájí provoz',
        'CPU vykonává systém, který inicializuje ovladače, spouští služby a připravuje přihlašovací prostředí. Další soubory se v reálném počítači načítají průběžně; zde jsme jejich čtení shrnuli v předchozím kroku.',
        'Spouštění systému'),
      step('boot-image','CPU připraví obraz přihlášení v RAM',
        'CPU při běhu systému a grafického ovladače zapíše do RAM podklady a příkazy pro přihlašovací obrazovku.',
        ['cpu','ram'],[flow('ramCpu','data','Podklady a příkazy',true)]),
      step('graphics-request','CPU oznámí grafické části novou práci',
        'CPU oznámí grafické části připravené podklady a příkazy v RAM. Samotná obrazová data se tímto oznámením nepřenášejí.',
        ['cpu','gpu'],[flow('cpuGpu','control','Oznámení nové práce')]),
      step('draw','Grafická část převezme podklady a příkazy',
        'Integrovaná grafika načte ze společné RAM podklady a příkazy pro přihlašovací obrazovku a připraví její obraz. Pro jednoduchost nezobrazujeme dřívější logo firmwaru.',
        ['ram','gpu'],[flow('ramGpu','data','Podklady a příkazy')],{},3500),
      {...step('ready','Počítač je připravený k přihlášení',
        'Grafická část odešle monitoru obrazový signál. Po dokončení přenosu se zobrazí přihlašovací obrazovka; operační systém již běží v CPU.',
        ['gpu','monitor'],[flow('gpuMonitor','output','Obrazový signál')],{},3000),completionEffects:{screen:'login',cpuWork:false}}
    ],{
      'loader-request':ramWrite(item('request','Načíst zavaděč')),
      'loader-load':ramWrite(item('loader','Zavaděč systému')),
      'system-request':ramWrite(item('request','Načíst systém')),
      'system-load':ramWrite(item('system','Části systému')),
      'boot-image':ramWrite(item('image','Podklady pro obraz'),item('commands','Příkazy pro grafiku'))
    });
    return withRamFocus(withGraphics(steps,false,graphics,false,{
      frameLabel:'Obraz přihlášení', imageDescription:'přihlašovací obrazovky',
      preparationScreen:null, outputDescription:'po dokončení přenosu se objeví přihlašovací obrazovka.'
    }),{
      'boot-image':focus(['image','commands'],'Podklady a příkazy'),
      draw:focus(['image','commands'],'Podklady a příkazy'),
      'graphics-commands-read':focus(['commands']),
      'graphics-upload':focus(['image'])
    });
  };

  // Stabilní id položek dovoluje doplnit nebo aktualizovat obsah. Čtení nic
  // nemaže a přenos kódu ze SSD nemění jeho dlouhodobě uloženou kopii.
  const calculatorMemory = detailed => ({
    'read-request-write': ramWrite(item('request', 'Požadavek na načtení')),
    load: ramWrite(item('program', 'Kód a data kalkulačky')),
    'write-data': ramWrite(item('image', 'Podklady pro obraz'),
      ...(!detailed ? [item('commands', 'Příkazy pro grafiku')] : [])),
    'graphics-commands-write': ramWrite(item('commands', 'Příkazy pro grafiku'))
  });
  const youtubeMemory = detailed => ({
    'request-write': ramWrite(item('request', 'Požadavek na video')),
    buffer: ramWrite(item('received', 'Video a zvuk (část 1)')),
    'playback-write': ramWrite(item('prepared', 'Video a zvukové vzorky'),
      ...(!detailed ? [item('commands', 'Příkazy pro grafiku')] : [])),
    'video-commands-write': ramWrite(item('commands', 'Příkazy pro grafiku'))
  });

  // Výběr v RAM je součástí obsahu scénáře, neodvozuje se z textu zprávy.
  // Související data a příkazy shrnujeme do jedné čitelné položky.
  const calculatorRamFocus = detailed => ({
    'write-data':focus(detailed ? ['image'] : ['image','commands'],detailed ? undefined : 'Podklady a příkazy'),
    draw:focus(detailed ? ['image'] : ['image','commands'],detailed ? undefined : 'Podklady a příkazy'),
    'graphics-commands-read':focus(['commands']),
    'graphics-upload':focus(['image'])
  });
  const youtubeRamFocus = detailed => ({
    'received-read':focus(['program','received'],'Instrukce a data'),
    'playback-write':focus(detailed ? ['prepared'] : ['prepared','commands'],detailed ? undefined : 'Data a příkazy'),
    'video-commands-read':focus(['commands']),
    'video-read':focus(detailed ? ['prepared'] : ['prepared','commands'],detailed ? 'Video' : 'Video a příkazy'),
    'graphics-commands-read':focus(['commands']),
    'graphics-upload':focus(['prepared'],'Video'),
    'audio-setup':focus(['prepared'],'Zvukové vzorky'),
    'audio-read':focus(['prepared'],'Zvukové vzorky'),
    'image-output':focus(['prepared'],'Video'),
    'sound-output':focus(['prepared'],'Zvukové vzorky'),
    playback:focus(['prepared'],'Video a zvuk')
  });
  const saveRamFocus = {
    'save-read':focus(['program','document'],'Instrukce a data'),
    'save-prepare':focus(['document']),
    'save-transfer':focus(['file'])
  };

  // Dedikovaná karta načítá příkazy ze systémové RAM, ale obrazové podklady
  // kopíruje do vlastní VRAM. Nevedeme do ní program CPU ani zvukové vzorky.
  // Jde o jednu názornou variantu desktopové karty s přímo připojeným monitorem.
  const withGraphics = (steps, detailed, graphics, video, options = {}) => {
    if (graphics !== 'dedicated') return steps;
    const input = video ? 'Komprimované video' : 'Podklady pro obraz';
    const frames = video ? 'Obrazové snímky' : (options.frameLabel || 'Obraz okna');
    const imageDescription = options.imageDescription || 'okna kalkulačky';
    const upload = () => ({ ...step('graphics-upload', 'Karta přenese obrazová data do VRAM',
      'Kopírovací část grafické karty přenese ' + (video ? 'komprimované video' : 'obrazové podklady') + ' z RAM do vlastní paměti VRAM pomocí DMA. CPU nemusí jednotlivé bajty kopírovat. Příkazy se načítají z RAM; do VRAM zde ukládáme obrazový obsah.',
      ['ram','gpu','vram'], [flow('ramVram','data',input)], {}, 3500),
      memoryWrites: { vram:[item('input',input)] } });
    const read = () => step('graphics-input', 'GPU čte podklady z vlastní VRAM',
      'GPU načte ' + (video ? 'komprimované video pro dekódování' : 'obrazové podklady ' + imageDescription) + ' z VRAM na grafické kartě. Systémová RAM si dál ponechává svoji kopii.',
      ['vram','gpu'], [flow('gpuVram','data',input,true)], {}, 2600);
    const store = () => ({ ...step('graphics-store', 'GPU ukládá hotový obraz do VRAM',
      video ? 'Videodekodér GPU vytvořil obrazové snímky. Grafická karta je uloží do VRAM, odkud je může číst její zobrazovací část.'
        : 'GPU zpracuje podklady a vykreslí obraz ' + imageDescription + ' do VRAM. Na monitor se zatím neposílá hotový obraz.',
      ['gpu','vram'], [flow('gpuVram','data',frames)], options.preparationScreen === null ? {} : { screen:'loading' }, 3100),
      memoryWrites: { vram:[item('frames',frames)] } });
    const scanout = () => step('graphics-scanout', 'Zobrazovací část karty čte obraz z VRAM',
      'Zobrazovací část grafické karty načítá hotový obraz z VRAM. Poté jej odešle jako obrazový signál přímo připojenému monitoru. Při přehrávání se toto čtení průběžně opakuje; zde ukazujeme jeden přenos.',
      ['vram','gpu'], [flow('gpuVram','data',video ? 'Obrazový snímek' : frames,true)], {}, 2600);
    const process = s => ({ ...s, description:'Videodekodér GPU zpracuje komprimované video načtené z vlastní VRAM. Vytvoří obrazové snímky, které grafická karta následně uloží zpět do VRAM.' });
    return steps.flatMap(s => {
      if (['graphics-request','graphics-notify'].includes(s.id)) return [{ ...s,
        description:'CPU oznámí dedikované grafické kartě novou práci. Karta si načte příkazy z RAM a podle nich přenese potřebná obrazová data do své VRAM.' }];
      if (s.id === 'draw' || s.id === 'video-read') {
        const commands = detailed ? [] : [step('graphics-commands-read', 'GPU načte příkazy z RAM',
          'Grafická karta načte příkazy ze systémové RAM. Ty určují požadovanou práci a umístění obrazových dat; samy nejsou obrazovým signálem.',
          ['ram','gpu'], [flow('ramGpu','control','Příkazy pro grafiku')])];
        return [...commands,upload(),read(),...(!video ? [store()] : detailed ? [process({
          ...step('video-process','GPU zpracovává video','Zpracování videa ve vlastní paměti karty.',
            ['gpu'],[],{screen:'loading'},3000), highlights:[highlight('gpu','Zpracování videa')]
        }),store()] : [])];
      }
      if (s.id === 'video-process') return [process(s),store()];
      if (['ready','playback','image-output'].includes(s.id)) return [scanout(),{ ...s,
        description:s.id === 'playback'
          ? 'Grafická karta posílá obraz z připravených snímků ve VRAM a zvuková část přehrává vzorky ze systémové RAM. Další přijaté části videa a zvuku zatím přibývají do RAM; krátká ukázka se pak zastaví.'
          : 'Grafická karta posílá obrazový signál přímo připojenému monitoru. Hotový obraz je uložený ve VRAM; ' + (video ? 'zvuková část dál používá systémovou RAM.' : (options.outputDescription || 'na monitoru se objeví okno kalkulačky.')) }];
      return [s];
    });
  };

  Lab.scenarios = [
    { id: 'calculator', title: 'Spuštění kalkulačky', shortTitle: 'Kalkulačka', subtitle: 'Od kliknutí k otevřenému oknu', icon: 'calculator',
      diagram: { server: false },
      initialMemory: { ssd: [item('program', 'Kód a data kalkulačky')], ram: [] },
      emptyMemory: { ram: 'Bez dat kalkulačky' },
      initial: { title: 'Vše začíná jedním kliknutím', description: 'Počítač je zapnutý, kalkulačka neběží a její potřebné části ještě nejsou v RAM. Spusťte ukázku nebo postupujte po jednotlivých krocích.', screen: 'desktop', ramLoaded: false, buffer: 0, playback: false, segment: 0, cpuWork: false, clicked: false },
      createSteps: (detailed, graphics = 'integrated') => withRamFocus(withGraphics(withMemory(detailed ? calc(true) : calcBasic(), calculatorMemory(detailed)), detailed, graphics, false),calculatorRamFocus(detailed)) },
    { id: 'youtube', title: 'Spuštění videa na YouTube', shortTitle: 'Video na YouTube', subtitle: 'Od přehrání k obrazu a zvuku', icon: 'video',
      diagram: { server: true },
      initialMemory: { ssd: [item('program', 'Kód a data prohlížeče')], ram: [item('program', 'Kód a data prohlížeče')] },
      initial: { title: 'Video čeká na přehrání', description: 'Prohlížeč i stránka YouTube jsou otevřené, přehrávání stojí a vyrovnávací paměť je prázdná. Úvodní kroky ukazujeme postupně; příjem dalších dat, zpracování a přehrávání se mohou překrývat.', screen: 'youtube', ramLoaded: false, buffer: 0, playback: false, playbackFrom: 0, playbackTo: 0, soundPlaying: false, cpuWork: false, clicked: false },
      createSteps: (detailed, graphics = 'integrated') => withRamFocus(withGraphics(withMemory(detailed ? youtube(true) : youtubeBasic(), youtubeMemory(detailed)), detailed, graphics, true),youtubeRamFocus(detailed)) },
    { id:'save', title:'Uložení souboru', shortTitle:'Uložení souboru', subtitle:'Z RAM do paměti SSD', icon:'save',
      diagram:{server:false},
      initialMemory:{ssd:[item('program','Kód editoru')],ram:[item('program','Kód a data editoru'),item('document','Rozepsaný dokument')]},
      initial:{title:'Dokument čeká na uložení',description:'Textový editor je otevřený a v RAM je rozepsaný dokument. Soubor poznamky.txt na SSD ještě není. Ukázka sleduje jeho uložení až do flash paměti SSD.',
        screen:'editor',ramLoaded:true,buffer:0,playback:false,soundPlaying:false,cpuWork:false,clicked:false},
      createSteps:detailed => withRamFocus(saveFile(detailed),saveRamFocus) },
    { id:'boot',title:'Zapnutí počítače',shortTitle:'Zapnutí počítače',subtitle:'Od vypínače k přihlášení',icon:'power',
      diagram:{server:false,boot:true},
      initialMemory:{ssd:[item('loader','Zavaděč'),item('system','Systém a data')],ram:[]},
      emptyMemory:{ram:'Připravená, prázdná'},
      initial:{title:'Počítač čeká na zapnutí',description:'Počítač je připojený k zásuvce, hlavní napájení je vypnuté. Flash obsahuje firmware UEFI, SSD zavaděč a operační systém. RAM ještě není připravená. Spusťte ukázku stisku vypínače.',
        screen:'black',powered:false,ramReady:false,cpuSoftware:'Čeká na start',ramLoaded:false,buffer:0,playback:false,soundPlaying:false,cpuWork:false,clicked:false},
      createSteps:boot }
  ];
})(window.HWLab);
