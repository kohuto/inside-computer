/* Každý scénář je jen obsah a stav schématu. O čas i vykreslení se starají jiné soubory.
   effects se dědí mezi kroky, active/flows platí pouze pro aktuální krok.
   memoryWrites mění zobrazený obsah paměti až po dokončení přenosu. */
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

  // Zpracování CPU shrnují navazující přenosy, bez samostatných čekacích kroků.
  // phases jsou části stejného číslovaného kroku řízené společným přehrávačem.
  const highlight = (target, label) => ({ target, label });
  const staged = (content, phases) => ({ ...content, phases });
  const calculatorSteps = () => [
    step('click', 'Kliknutí na ikonu',
      'Myš předává informace o stisku tlačítka a pohybu přes příslušné rozhraní a ovladače. Operační systém běžící na CPU podle polohy ukazatele vyhodnotí, že uživatel klikl na ikonu kalkulačky, a zahájí její spuštění.',
      ['mouse', 'cpu'], [flow('mouseCpu', 'control', 'informace o kliknutí')], { clicked: true }),
    step('read-request-write', 'CPU připraví požadavek v RAM',
      'Operační systém prostřednictvím ovladače úložiště připraví příkaz ke čtení z NVMe SSD. Ovladač je software, jehož instrukce provádí CPU. Procesor podle nich zapíše příkaz do fronty v RAM. Příkaz určuje, ze kterých bloků SSD načíst potřebný kód a data kalkulačky a do které oblasti RAM je uložit. RAM příkaz pouze uchovává; sama načítání neřídí.',
      ['cpu', 'ram'], [flow('ramCpu', 'control', 'Požadavek na načtení', true)], { cpuWork: true }),
    step('read-request', 'CPU oznámí SSD novou práci',
      'Po připravení příkazu v RAM aktualizuje CPU podle instrukcí ovladače úložiště oznamovací registr řadiče SSD, označovaný jako doorbell. Řadič tak zjistí, že jsou ve frontě připravené nové příkazy. Načte si je z RAM a začne je zpracovávat.',
      ['cpu', 'ssd'], [flow('cpuSsd', 'control', 'Oznámení nové práce')]),
    step('load', 'Kód a data se načtou do RAM',
      'Řadič SSD podle převzatého příkazu načte požadované bloky a přenese kód a data kalkulačky do určené oblasti RAM pomocí DMA. DMA neboli přímý přístup do paměti umožňuje zařízení přenášet data do RAM nebo z RAM, aniž by výpočetní jádra CPU kopírovala jednotlivé bajty. Po dokončení přenosu řadič zapíše do příslušné fronty v RAM záznam o dokončení. Ovladač úložiště tento záznam zpracuje a operační systém pak může pokračovat ve spouštění kalkulačky.',
      ['ssd', 'ram'], [flow('ssdRam', 'data', 'Kód a data')], { ramLoaded: true }, 3500),
    step('execute', 'CPU načte instrukce a data',
      'CPU postupně získává instrukce kalkulačky a potřebná pracovní data prostřednictvím paměťové hierarchie. Nejprve je hledá v cache, malé a rychlé paměti uvnitř procesoru. Pokud tam potřebné instrukce nebo data nejsou, doplní se z RAM. Tento krok představuje mnoho průběžných čtení během vykonávání programu; celý program se jednorázově nepřesune dovnitř CPU. Čtení obsah RAM nemaže.',
      ['ram', 'cpu'], [flow('ramCpu', 'data', 'Instrukce a data')], { cpuWork: true }, 3200),
    step('write-data', 'CPU zapíše podklady a příkazy',
      'CPU vykonává instrukce kalkulačky, grafických knihoven a ovladačů. Tyto softwarové části připraví obrazové podklady a vykreslovací příkazy pro GPU, které CPU zapíše do RAM. Vykreslovací příkazy určují práci grafického hardwaru; nejde o přeposlání instrukcí kalkulačky, které vykonává CPU. Grafická část si připravené podklady a příkazy následně načte z paměti.',
      ['cpu', 'ram'], [flow('ramCpu', 'data', 'Podklady a příkazy', true)], {}, 3200),
    step('graphics-request', 'CPU oznámí grafické části novou práci',
      'CPU podle instrukcí grafického ovladače a operačního systému předá GPU požadavek na zpracování připravené dávky vykreslovacích příkazů. Ovladač a systém správy GPU zajistí zařazení práce do fronty a potřebnou synchronizaci s předchozími operacemi. Konkrétní způsob předání závisí na grafickém hardwaru a ovladači. Samotné příkazy a obrazové podklady si GPU načte z RAM.',
      ['cpu', 'gpu'], [flow('cpuGpu', 'control', 'Oznámení nové práce')]),
    step('draw', 'Grafická část načte podklady a příkazy',
      'Integrovaná grafika využívá společnou operační paměť RAM, ze které GPU načte vykreslovací příkazy a obrazové podklady. Vykreslovací jednotky GPU podle příkazů zpracují podklady a zapíšou výsledné pixely obrazu okna do obrazové paměťové plochy v RAM. Ve Windows správce oken DWM s využitím GPU skládá obrazy jednotlivých oken do výsledného obrazu pracovní plochy. Tento krok tedy zahrnuje čtení i zápisy obrazových dat v paměti; samotné čtení původní podklady nemaže.',
      ['ram', 'gpu'], [flow('ramGpu', 'data', 'Podklady a příkazy')], { screen: 'loading' }, 3500),
    step('display-signal', 'Grafická část posílá obrazový signál',
      'Zobrazovací část grafického hardwaru čte připravený obraz z paměti a odesílá jej monitoru jako obrazový signál.',
      ['gpu', 'monitor'], [flow('gpuMonitor', 'output', 'Obrazový signál')], { cpuWork: false }, 2900),
    step('ready', 'Kalkulačka se zobrazí na monitoru',
      'Monitor přijal obrazový signál a zobrazí kalkulačku připravenou k použití.',
      ['monitor'], [], { screen: 'calculator' }, 1800)
  ];

  const youtubeSteps = () => {
    const outputs = [flow('gpuMonitor', 'output', 'Obrazový signál'), flow('audioSpeakers', 'output', 'Zvukový signál')];
    const playing = ['gpu', 'audio', 'monitor', 'speakers'];
    return [
      step('play-click', 'Kliknutí na Přehrát',
        'Myš předává údaje o pohybu a stisku tlačítka přes příslušné rozhraní a ovladače. Operační systém a prohlížeč běžící na CPU podle polohy ukazatele vyhodnotí kliknutí na tlačítko Přehrát a zahájí přehrávání.',
        ['mouse', 'cpu'], [flow('mouseCpu', 'control', 'Kliknutí na Přehrát')], { clicked: true }),
      step('request-write', 'CPU připraví požadavek v RAM',
        'Prohlížeč běžící na CPU vytvoří síťový požadavek na potřebný úsek videa. Síťový software připraví odesílaná data a ovladač síťového zařízení zapíše do odesílací fronty v RAM záznamy s jejich umístěním a délkou. Síťový řadič podle těchto záznamů převezme data k odeslání; význam požadavku na video řeší prohlížeč.',
        ['cpu', 'ram'], [flow('ramCpu', 'control', 'Požadavek na video', true)], { cpuWork: true }),
      step('request-notify', 'CPU oznámí síťové části novou práci',
        'CPU podle instrukcí síťového ovladače oznámí řadiči, že jsou v odesílací frontě nové položky. Ovladač zajistí, aby byly záznamy i data dostupné zařízení; konkrétní způsob oznámení závisí na řadiči. Ten podle záznamů načte připravená data z RAM, obvykle pomocí DMA.',
        ['cpu', 'network'], [flow('cpuNetwork', 'control', 'Oznámení nové práce')]),
      step('request-server', 'Požadavek putuje na server',
        'Síťový řadič vyšle připravená data přes síťové rozhraní. Požadavek putuje přes místní síť a další síťová zařízení k serveru poskytujícímu obsah. Přípravu webového požadavku a zabezpečeného spojení řídí software vykonávaný CPU; síťový řadič zajišťuje přenos na místní síť.',
        ['network', 'server'], [flow('networkServer', 'control', 'Požadavek na video')]),
      step('receive', 'Server posílá video a zvuk',
        'Server odešle požadované části komprimovaného videa a zvuku prostřednictvím zabezpečeného spojení. Obsah přichází po síťových paketech; obrazová a zvuková stopa mohou být stahovány odděleně. Přijatá data musí projít síťovým zpracováním a dekódováním, než z nich vzniknou obrazové snímky a zvukové vzorky.',
        ['server', 'network'], [flow('serverNetwork', 'data', 'Video a zvuk')], {}, 3300),
      step('buffer', 'Síťová část zapíše data do RAM',
        'Síťový řadič zapisuje přijaté pakety pomocí DMA do příjmových bufferů v RAM, které předem připravil ovladač. DMA neboli přímý přístup do paměti přenáší data bez kopírování jednotlivých bajtů výpočetními jádry CPU. Ovladač a síťový software zpracují oznámení o příjmu a zpřístupní data prohlížeči. Síťové buffery jsou odlišné od paměti, ve které přehrávač uchovává připravené mediální úseky.',
        ['network', 'ram'], [flow('networkRam', 'data', 'Video a zvuk')], { buffer: 2 }, 3300),
      step('received-read', 'CPU načte instrukce a data',
        'CPU průběžně provádí instrukce prohlížeče, systému a ovladačů a čte údaje potřebné ke zpracování přijatého obsahu. Instrukce i pracovní data získává přes cache; chybějící obsah se doplňuje z RAM. Tento krok představuje mnoho čtení podle potřeby, nikoli jednorázové načtení celého prohlížeče či videa do CPU. Čtení RAM její obsah nemaže.',
        ['ram', 'cpu'], [flow('ramCpu', 'data', 'Instrukce a data')], { cpuWork: true }, 3200),
      step('playback-write', 'CPU zapíše data a příkazy do RAM',
        'Síťový a přehrávací software vykonávaný CPU zpracuje přenos včetně dešifrování zabezpečeného spojení a připraví komprimované obrazové a zvukové stopy. Softwarový zvukový dekodér převede zvuk na vzorky; obrazová data zůstanou komprimovaná pro hardwarový videodekodér. CPU zapíše do RAM připravená data a příkazy pro další zpracování. Příkazy pro grafický hardware jsou nové řídicí údaje, nikoli přeposlané instrukce programu CPU.',
        ['cpu', 'ram'], [flow('ramCpu', 'data', 'Data a příkazy', true)], {}, 3200),
      step('graphics-notify', 'CPU oznámí grafické části novou práci',
        'CPU podle instrukcí grafického ovladače a operačního systému předá grafickému hardwaru připravenou dekódovací práci. Ovladač a systém správy GPU zajistí její zařazení a návaznost na předchozí operace. Konkrétní způsob zadání závisí na hardwaru a ovladači; komprimované video a příkazy si zařízení převezme z paměti.',
        ['cpu', 'gpu'], [flow('cpuGpu', 'control', 'Oznámení nové práce')]),
      step('video-read', 'Grafická část načte video a příkazy',
        'Integrovaná grafika sdílí systémovou RAM s CPU. Grafický hardware z ní načítá komprimované video a řídicí údaje pro videodekodér, například parametry snímků a odkazy na potřebné paměťové plochy. Načtený obsah zatím není hotovým obrazem pro monitor; ten vytvoří dekódování. Čtení původní data v RAM nemaže.',
        ['ram', 'gpu'], [flow('ramGpu', 'data', 'Video a příkazy')], {}, 3300),
      { ...step('video-process', 'Grafická část zpracovává video',
        'Specializovaný videodekodér grafického hardwaru převádí komprimované video na obrazové snímky a zapisuje je do obrazových paměťových ploch v RAM. Snímky se pro zobrazení mohou dále upravit, například změnou barevného formátu nebo velikosti, a složit s webovou stránkou. Krok zahrnuje čtení i zápisy do paměti. Hardwarové dekódování vyžaduje podporu použitého formátu v dekodéru a ovladači.',
        ['gpu'], [], { screen: 'loading' }, 3000),
        highlights: [highlight('gpu', 'Zpracování videa')] },
      step('audio-setup', 'CPU nastaví a spustí zvukovou část',
        'Zvukový software a ovladač vykonávané CPU nastaví přehrávací formát, například vzorkovací frekvenci a počet kanálů, a zpřístupní zařízení buffer se vzorky v RAM. Ovladač nastaví přenos z paměti a spustí zvukový proud. Zvukový systém může vzorky před předáním hardwaru smíchat s dalšími zvuky nebo upravit jejich formát.',
        ['cpu', 'audio'], [flow('audioCpu', 'control', 'Spuštění přehrávání', true)]),
      step('audio-read', 'Zvuková část načte zvukové vzorky',
        'Řadič zvukového zařízení průběžně čte připravené zvukové vzorky z bufferu v RAM pomocí DMA. Software doplňuje další vzorky podle postupu přehrávání; nejde o jednorázové načtení celého zvuku. Vzorky se ve zvukovém zařízení zpracují a pro analogový výstup převedou na elektrický signál pro reproduktory.',
        ['ram', 'audio'], [flow('ramAudio', 'data', 'Zvukové vzorky')]),
      staged(step('playback', 'Obraz a zvuk se přehrávají souběžně',
        'Zobrazovací část grafického hardwaru opakovaně čte připravený obraz z paměti a vytváří signál pro monitor. Zvukové zařízení souběžně zpracovává vzorky a vytváří zvukový výstup. Přehrávač časuje obraz a zvuk podle společného časového základu a zohledňuje zpoždění výstupů. Zatím se přijímají další části obsahu; jejich příprava na CPU, dekódování i doplňování bufferů se při pokračujícím přehrávání opakují a překrývají.',
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
  // na trvalý zápis; hotový soubor přibude až po dokončení posledního kroku.
  const saveFile = () => withMemory([
    step('save-click', 'Kliknutí na Uložit',
      'Myš předává údaje o pohybu a stisku tlačítka přes příslušné rozhraní a ovladače. Operační systém a uživatelské rozhraní editoru běžící na CPU podle polohy ukazatele vyhodnotí kliknutí na Uložit. Editor zahájí ukládání dokumentu; myš sama význam tlačítka nezná.',
      ['mouse','cpu'], [flow('mouseCpu','control','Kliknutí na Uložit')], {clicked:true}),
    step('save-read', 'CPU načte instrukce a data',
      'CPU vykonává instrukce editoru a podle potřeby také operačního systému a ovladačů. Instrukce i pracovní data získává průběžně přes paměťovou hierarchii včetně cache; chybějící obsah se doplňuje z RAM. Krok shrnuje mnoho čtení během ukládání, nikoli jednorázový přesun celého programu či dokumentu do CPU. Čtení obsah RAM nemaže.',
      ['ram','cpu'], [flow('ramCpu','data','Instrukce a data')], {cpuWork:true}, 3200),
    step('save-data', 'CPU zapíše připravená data do RAM',
      'Editor vykonávaný CPU připraví bajtovou podobu textu podle zvoleného kódování a předá systému požadavek na zápis souboru poznamky.txt s odkazem na data v paměti. Při běžném ukládání systém data nejprve uchová v souborové cache v RAM a na SSD je může zapsat později. Není nutné vždy vytvářet novou kopii celého dokumentu; jeho pracovní podoba zůstává editoru dostupná.',
      ['cpu','ram'], [flow('ramCpu','data','Data souboru',true)], {}, 3200),
    step('save-request', 'CPU připraví požadavek na zápis',
      'Systém souborů spravuje název souboru, jeho metadata a přiřazení dat k prostoru úložiště. Při předání zápisu zařízení ovladač úložiště vykonávaný CPU vytvoří příkaz ve frontě v systémové RAM. Příkaz určuje umístění zdrojových dat v paměti, cílové logické bloky NVMe SSD a jejich počet. Konkrétní fyzické umístění ve flash volí řadič SSD; větší zápis se může rozdělit do více příkazů.',
      ['cpu','ram'], [flow('ramCpu','control','Požadavek na zápis',true)]),
    step('save-notify', 'CPU oznámí SSD novou práci',
      'Po připravení příkazu aktualizuje CPU podle instrukcí ovladače oznamovací registr řadiče SSD, označovaný jako doorbell. Řadič tak zjistí, že příkazová fronta obsahuje novou práci. Oznámení samo nepřenáší příkaz ani obsah souboru; ty si řadič převezme z RAM.',
      ['cpu','ssd'], [flow('cpuSsd','control','Oznámení nové práce')]),
    step('save-request-read', 'SSD načte požadavek z RAM',
      'Řadič SSD načte příkaz z příkazové fronty v systémové RAM. Získá z něj cílový rozsah logických bloků a odkazy na paměťové oblasti se zapisovanými daty. Příkaz a obsah souboru jsou oddělené: nejprve řadič zjistí požadovanou operaci a podle ní zajistí přenos dat. RAM příkaz pouze uchovává, sama zápis neřídí.',
      ['ram','ssd'], [flow('ssdRam','control','Požadavek na zápis',true)]),
    step('save-transfer', 'Data souboru se přenesou do SSD',
      'Řadič SSD převezme data z určených oblastí RAM pomocí DMA. DMA neboli přímý přístup do paměti umožňuje zařízení přenášet data bez kopírování jednotlivých bajtů výpočetními jádry CPU. Čtení zdrojová data v RAM nemaže. SSD může přijatá data dočasně uchovat v interním bufferu nebo zapisovací cache; přenos a zápis do flash se mohou překrývat. Samotné převzetí dat ještě nezaručuje trvalé uložení.',
      ['ram','ssd'], [flow('ssdRam','data','Data souboru',true)], {}, 3600),
    {...step('save-flash', 'SSD zapisuje data do flash',
      'Řadič SSD zapisuje data do NAND flash a spravuje mapování logických bloků na fyzická umístění. Závěr ukázky zahrnuje i zápis potřebných metadat a zajištění trvalosti: systém předá data ze svých bufferů úložišti a podle potřeby vyžádá vyprázdnění jeho zapisovací cache nebo použije zápis s příznakem FUA, který vyžaduje trvalé uložení před potvrzením. Řadič hlásí výsledek příkazu záznamem v dokončovací frontě, který zpracuje ovladač. Potvrzení Uloženo v editoru může přijít dříve; zde končíme až trvalým uložením. Data v RAM mohou dál zůstat dostupná editoru.',
      ['ssd'], [], {cpuWork:false}, 4000), highlights:[highlight('ssd','Zápis do flash')]}
  ], {
    'save-data':ramWrite(item('file','poznamky.txt')),
    'save-request':ramWrite(item('request','Požadavek na zápis')),
    'save-transfer':{ssd:[item('file','Čeká na zápis')]},
    'save-flash':{ssd:[item('file','poznamky.txt')]}
  });

  // Studený start: první instrukce pocházejí z flash, RAM se připraví až poté.
  // Zavaděč a potřebné části OS načítáme odděleně.
  const boot = (graphics = 'integrated') => {
    const steps = withMemory([
      {...step('power-on','Vypínač zahájí zapnutí hlavního napájení',
        'Stisk vypínače vyhodnotí řídicí obvody základní desky, napájené z pohotovostní větve zdroje. Signálem PS_ON# zapnou hlavní výstupy zdroje; zdroj po ustálení napětí potvrdí jejich správný stav signálem PWR_OK. Deska dokončí potřebnou posloupnost napájení a resetu, aby mohl začít start CPU. Tlačítko přímo nespíná síťových 230 V.',
        ['powerbutton','psu'],[],{powered:true},3000),highlights:[highlight('power','Zapnutí napájení')]},
      {...step('firmware-read','CPU spustí firmware a připraví hardware',
        'Po resetu začne CPU vykonávat počáteční kód firmwaru uložený ve flash paměti. Firmware zprovozní paměťový řadič a RAM, provede potřebné kontroly a inicializuje zařízení pro další start. Rané moduly mohou běžet přímo z prostoru flash; další se po zpřístupnění RAM načítají a vykonávají z ní. Krok shrnuje více fází inicializace, nikoli jednorázové načtení celého UEFI do CPU.',
        ['uefi','cpu'],[flow('uefiCpu','control','Instrukce firmwaru')],{cpuWork:true},3300),
        completionEffects:{cpuSoftware:'UEFI',ramReady:true}},
      step('loader-request','Firmware připraví načtení zavaděče',
        'Správce spouštění UEFI podle uložené konfigurace a pořadí zaváděcích položek vybere program na SSD. Služby firmwaru zjistí, které bloky obsahují jeho soubor. Ovladač NVMe ve firmwaru, jehož instrukce provádí CPU, připraví do fronty v RAM příkaz ke čtení s určením zdrojových bloků a cílové paměti. Operační systém ještě neběží.',
        ['cpu','ram'],[flow('ramCpu','control','Načíst zavaděč',true)]),
      step('loader-notify','Ovladač firmwaru oznámí SSD novou práci',
        'CPU podle instrukcí ovladače firmwaru aktualizuje oznamovací registr řadiče NVMe SSD, označovaný jako doorbell. Řadič tak zjistí, že příkazová fronta obsahuje novou práci, a načte si z RAM příkaz ke čtení. Oznámení samo nepřenáší kód zavaděče.',
        ['cpu','ssd'],[flow('cpuSsd','control','Oznámení nové práce')]),
      step('loader-load','Zavaděč se načte z SSD do RAM',
        'Řadič SSD přenese požadované bloky do RAM pomocí DMA, tedy přímého přístupu do paměti bez kopírování jednotlivých bajtů výpočetními jádry CPU. Ovladač zpracuje záznam o dokončení. Služby UEFI připraví spustitelný obraz zavaděče v paměti včetně potřebných úprav adres. Soubor na SSD zůstává zachovaný. Zavaděč zde shrnuje i případný řetězec programů, například správce spouštění Windows a následný OS loader.',
        ['ssd','ram'],[flow('ssdRam','data','Zavaděč systému')],{ramLoaded:true},3500),
      {...step('loader-read','Firmware předá řízení zavaděči',
        'UEFI zahájí vykonávání načteného programu na jeho vstupním bodu. CPU průběžně získává instrukce zavaděče a pracovní data přes paměťovou hierarchii včetně cache; chybějící obsah se doplňuje z RAM. Zavaděč využívá dostupné služby firmwaru k přípravě startu systému. Nejde o jednorázový přesun celého programu do CPU a čtení obsah RAM nemaže.',
        ['ram','cpu'],[flow('ramCpu','control','Instrukce zavaděče')],{},3200),completionEffects:{cpuSoftware:'Zavaděč'}},
      step('system-request','Zavaděč připraví načtení jádra systému',
        'Zavaděč vykonávaný CPU podle konfigurace určí jádro a prostředky nezbytné pro jeho spuštění, včetně počátečních ovladačů. Pomocí služeb a ovladačů dostupných během zavádění připraví čtení ze SSD. Ovladač NVMe zapíše do fronty v RAM příkazy určující čtené bloky a cílové oblasti paměti. Nejde ještě o činnost běžícího jádra systému.',
        ['cpu','ram'],[flow('ramCpu','control','Načíst jádro',true)]),
      step('system-notify','Ovladač oznámí SSD další příkazy',
        'CPU podle instrukcí ovladače aktualizuje doorbell řadiče SSD pro nově připravené příkazy. Řadič si je převezme z fronty v RAM. Jedno oznámení může zpřístupnit více příkazů; nepřenáší samotný kód jádra ani ovladačů.',
        ['cpu','ssd'],[flow('cpuSsd','control','Oznámení nové práce')]),
      step('system-load','Jádro a počáteční ovladače se načtou do RAM',
        'Řadič SSD přenáší pomocí DMA bloky s jádrem a prostředky potřebnými pro jeho start do připravené RAM. Software zpracuje dokončení čtení a připraví kód, data i údaje pro předání řízení jádru. Krok shrnuje více operací; celý operační systém se najednou nekopíruje. Další ovladače, služby a přihlašovací prostředí se načítají také později, až při běhu systému.',
        ['ssd','ram'],[flow('ssdRam','data','Jádro a ovladače')],{},4000),
      {...step('system-read','CPU začne vykonávat jádro systému',
        'Zavaděč ukončí zaváděcí služby UEFI voláním ExitBootServices a předá řízení jádru s potřebnými údaji o paměti a platformě. CPU začne vykonávat jeho instrukce a průběžně číst pracovní data přes cache a RAM. Systém přebírá správu prostředků a zařízení; vybrané běhové služby firmwaru zůstávají dostupné. Nejde o přenesení celého systému dovnitř CPU.',
        ['ram','cpu'],[flow('ramCpu','control','Instrukce a data')],{},3200),completionEffects:{cpuSoftware:'Operační systém'}},
      step('boot-image','Systém připraví podklady pro přihlášení',
        'Systém běžící na CPU pokračuje v inicializaci zařízení, načítá další soubory ze SSD a spouští služby i přihlašovací prostředí. Jeho grafický software, knihovny a ovladače připraví v RAM podklady a vykreslovací příkazy. Příkazy určují novou práci pro GPU; nejsou přeposlanými instrukcemi jádra. Tento krok shrnuje také pokračující načítání, hotový obraz se teprve vykreslí.',
        ['cpu','ram'],[flow('ramCpu','data','Podklady a příkazy',true)]),
      step('graphics-request','Grafický ovladač předá práci GPU',
        'CPU podle instrukcí grafického softwaru a ovladače předá připravenou práci grafickému hardwaru. Grafický subsystém zajistí její zařazení a návaznost na předchozí operace. Konkrétní mechanismus závisí na hardwaru a ovladači; není nutně stejný jako doorbell SSD. Oznámení samo nepřenáší obrazové podklady, které si zařízení převezme z paměti.',
        ['cpu','gpu'],[flow('cpuGpu','control','Oznámení nové práce')]),
      step('draw','GPU vykreslí přihlašovací obrazovku do paměti',
        'Integrovaná grafika využívá společnou systémovou RAM. GPU z ní čte podklady a vykreslovací příkazy a zapisuje výsledné obrazové plochy zpět do paměti. Grafický subsystém může více ploch složit do výsledné obrazovky. Krok shrnuje čtení, zpracování i zápisy; původní podklady se čtením nemažou. Dřívější zobrazení loga či nabídky firmwaru není v této ukázce zakreslené.',
        ['ram','gpu'],[flow('ramGpu','data','Podklady a příkazy')],{},3500),
      {...step('ready','Monitor zobrazí přihlašovací obrazovku',
        'Zobrazovací část grafického hardwaru průběžně čte připravený obraz z RAM a vytváří obrazový signál pro monitor. Monitor podle něj zobrazuje přihlašovací obrazovku; čtení i přenos se opakují podle časování displeje. CPU již vykonává operační systém a přihlašovací prostředí. Ukázka končí zobrazením obrazu, skutečná komunikace s monitorem tím nekončí.',
        ['gpu','monitor'],[flow('gpuMonitor','output','Obrazový signál')],{},3000),completionEffects:{screen:'login',cpuWork:false}}
    ],{
      'loader-request':ramWrite(item('request','Načíst zavaděč')),
      'loader-load':ramWrite(item('loader','Zavaděč systému')),
      'system-request':ramWrite(item('request','Načíst jádro')),
      'system-load':ramWrite(item('system','Jádro a ovladače')),
      'boot-image':ramWrite(item('image','Podklady pro obraz'),item('commands','Příkazy pro grafiku'))
    });
    const configured = withGraphics(steps,graphics,false,{
      frameLabel:'Obraz přihlášení', imageDescription:'přihlašovací obrazovky',
      preparationScreen:null
    });
    // Texty zavádění systému mají vlastní kontext, nezmění kalkulačku ani video.
    const dedicatedText = {
      'graphics-request':{
        description:'CPU podle instrukcí grafického softwaru a ovladače předá dedikované kartě práci pro přihlašovací obrazovku. Grafický subsystém zajistí zařazení a synchronizaci. Umístění příkazů a obrazových prostředků závisí na hardwaru a ovladači; zde karta načítá příkazy ze systémové RAM a obrazové podklady se nejprve kopírují do VRAM.'
      },
      'graphics-commands-read':{
        title:'Karta načte vykreslovací příkazy z RAM',
        description:'Grafická karta načítá ze systémové RAM připravené vykreslovací příkazy a odkazy na obrazové prostředky přihlašovacího prostředí. Jde o práci připravenou grafickým softwarem a ovladačem, nikoli o instrukce operačního systému vykonávané CPU. Konkrétní umístění příkazových bufferů závisí na použitém hardwaru a ovladači.'
      },
      'graphics-upload':{
        title:'Karta přenese podklady do vlastní VRAM',
        description:'Kopírovací jednotka karty přenese vybrané obrazové podklady ze systémové RAM do VRAM pomocí DMA. CPU připravuje přenos a jeho návaznost na vykreslení; jeho výpočetní jádra nemusí kopírovat jednotlivé bajty. Zde ukazujeme běžnou variantu s podklady ve VRAM. Některé prostředky mohou podle hardwaru a ovladače zůstat v systémové paměti nebo vzniknout přímo ve VRAM.'
      },
      'graphics-input':{
        title:'GPU čte podklady přihlášení z VRAM',
        description:'GPU podle vykreslovacích příkazů průběžně čte potřebné obrazové podklady z VRAM. Nejde o jednorázové převzetí celého jejího obsahu do výpočetních jednotek. Čtení data nemaže; případné kopie v systémové RAM mohou zůstat zachované. Čtení podkladů a vytváření výsledku se při skutečném vykreslování prolínají.'
      },
      'graphics-store':{
        title:'GPU vykreslí obraz přihlášení do VRAM',
        description:'GPU vykonává připravené grafické příkazy a zapisuje výsledné obrazové plochy do VRAM. Grafický subsystém může jejich obsah složit do obrazu přihlašovací obrazovky. Výsledek zůstává v paměti dostupný zobrazovací části; není ještě obrazovým signálem. Čtení a zápisy vznikají průběžně při vykreslování, i když je ukázka rozděluje do samostatných kroků.'
      },
      'graphics-scanout':{
        title:'Zobrazovací část čte obraz přihlášení z VRAM',
        description:'Zobrazovací část grafické karty čte z VRAM obraz připravený k zobrazení a podle něj vytváří výstup pro monitor. Čtení se opakuje podle časování displeje a průběžně navazuje na přenos obrazového signálu. Tento krok zvýrazňuje paměťový přístup zobrazovací části, nikoli další vykreslování výpočetními jednotkami GPU.'
      },
      ready:{
        description:'Zobrazovací část karty průběžně vytváří obrazový signál z připraveného obrazu ve VRAM. Přímo připojený monitor podle něj zobrazuje přihlašovací obrazovku. Čtení paměti a přenos signálu se opakují podle časování displeje; ukončením ukázky skutečná komunikace nekončí. CPU již vykonává operační systém a přihlašovací prostředí.'
      }
    };
    return withRamFocus(configured.map(s => graphics === 'dedicated' && dedicatedText[s.id]
      ? {...s,...dedicatedText[s.id]} : s),{
      'boot-image':focus(['image','commands'],'Podklady a příkazy'),
      draw:focus(['image','commands'],'Podklady a příkazy'),
      'graphics-commands-read':focus(['commands']),
      'graphics-upload':focus(['image'])
    });
  };

  // Stabilní id položek dovoluje doplnit nebo aktualizovat obsah. Čtení nic
  // nemaže a přenos kódu ze SSD nemění jeho dlouhodobě uloženou kopii.
  const calculatorMemory = {
    'read-request-write': ramWrite(item('request', 'Požadavek na načtení')),
    load: ramWrite(item('program', 'Kód a data kalkulačky')),
    'write-data': ramWrite(item('image', 'Podklady pro obraz'), item('commands', 'Příkazy pro grafiku'))
  };
  const youtubeMemory = {
    'request-write': ramWrite(item('request', 'Požadavek na video')),
    buffer: ramWrite(item('received', 'Video a zvuk (část 1)')),
    'playback-write': ramWrite(item('prepared', 'Video a zvukové vzorky'), item('commands', 'Příkazy pro grafiku'))
  };

  // Výběr v RAM je součástí obsahu scénáře, neodvozuje se z textu zprávy.
  // Související data a příkazy shrnujeme do jedné čitelné položky.
  const calculatorRamFocus = {
    'write-data':focus(['image','commands'],'Podklady a příkazy'),
    draw:focus(['image','commands'],'Podklady a příkazy'),
    'graphics-commands-read':focus(['commands']),
    'graphics-upload':focus(['image'])
  };
  const youtubeRamFocus = {
    'received-read':focus(['program','received'],'Instrukce a data'),
    'playback-write':focus(['prepared','commands'],'Data a příkazy'),
    'video-read':focus(['prepared','commands'],'Video a příkazy'),
    'graphics-commands-read':focus(['commands']),
    'graphics-upload':focus(['prepared'],'Video'),
    'audio-setup':focus(['prepared'],'Zvukové vzorky'),
    'audio-read':focus(['prepared'],'Zvukové vzorky'),
    playback:focus(['prepared'],'Video a zvuk')
  };
  const saveRamFocus = {
    'save-read':focus(['program','document'],'Instrukce a data'),
    'save-transfer':focus(['file'])
  };

  // Dedikovaná karta načítá příkazy ze systémové RAM, ale obrazové podklady
  // kopíruje do vlastní VRAM. Nevedeme do ní program CPU ani zvukové vzorky.
  // Jde o jednu názornou variantu desktopové karty s přímo připojeným monitorem.
  const withGraphics = (steps, graphics, video, options = {}) => {
    if (graphics !== 'dedicated') return steps;
    const input = video ? 'Komprimované video' : 'Podklady pro obraz';
    const frames = video ? 'Obrazové snímky' : (options.frameLabel || 'Obraz okna');
    const imageDescription = options.imageDescription || 'okna kalkulačky';
    const upload = () => ({ ...step('graphics-upload', 'Karta přenese obrazová data do VRAM',
      video ? 'Kopírovací jednotka karty přenese komprimované video ze systémové RAM do VRAM pomocí DMA. CPU připravuje přenos a jeho návaznost na další práci; jednotlivé bajty nemusí kopírovat jeho výpočetní jádra. Zde ukazujeme variantu s videem ve VRAM; konkrétní ovladač může vstupní data umístit i jinak.'
        : 'Kopírovací část grafické karty přenese obrazové podklady z RAM do vlastní paměti VRAM pomocí DMA. CPU nemusí jednotlivé bajty kopírovat. Příkazy se načítají z RAM; do VRAM zde ukládáme obrazový obsah.',
      ['ram','gpu','vram'], [flow('ramVram','data',input)], {}, 3500),
      memoryWrites: { vram:[item('input',input)] } });
    const read = () => step('graphics-input', 'GPU čte podklady z vlastní VRAM',
      video ? 'Videodekodér karty získává z VRAM komprimované obrazové údaje podle připravených příkazů. Průběžně čte potřebné části vstupního proudu; nepřenáší si celé video jednorázově do výpočetních jednotek. Čtení původní obsah VRAM nemaže.'
        : 'GPU načte obrazové podklady ' + imageDescription + ' z VRAM na grafické kartě. Systémová RAM si dál ponechává svoji kopii.',
      ['vram','gpu'], [flow('gpuVram','data',input,true)], {}, 2600);
    const store = () => ({ ...step('graphics-store', 'GPU ukládá hotový obraz do VRAM',
      video ? 'Videodekodér zapisuje nekomprimované snímky do obrazových paměťových ploch ve VRAM. Zápisy vznikají už během dekódování; tento krok zvýrazňuje uložení výsledku. Snímky mohou dále projít úpravou barev, velikosti a složením s obsahem webové stránky.'
        : 'GPU zpracuje podklady a vykreslí obraz ' + imageDescription + ' do VRAM. Na monitor se zatím neposílá hotový obraz.',
      ['gpu','vram'], [flow('gpuVram','data',frames)], options.preparationScreen === null ? {} : { screen:'loading' }, 3100),
      memoryWrites: { vram:[item('frames',frames)] } });
    const scanout = () => step('graphics-scanout', 'Zobrazovací část karty čte obraz z VRAM',
      video ? 'Zobrazovací část grafické karty čte z VRAM hotový obraz připravený k zobrazení. Může jít o obraz složený z videa a ostatního obsahu obrazovky, nikoli přímo o původní výstup videodekodéru. Čtení se opakuje podle časování displeje a navazuje na něj přenos obrazového signálu do monitoru.'
        : 'Zobrazovací část grafické karty načítá hotový obraz z VRAM. Poté jej odešle jako obrazový signál přímo připojenému monitoru. Při přehrávání se toto čtení průběžně opakuje; zde ukazujeme jeden přenos.',
      ['vram','gpu'], [flow('gpuVram','data',video ? 'Obrazový snímek' : frames,true)], {}, 2600);
    const process = s => ({ ...s, description:'Specializovaný videodekodér grafické karty podle řídicích údajů převádí komprimované video z VRAM na obrazové snímky. Výsledek zapisuje do obrazových paměťových ploch ve VRAM; tuto část práce zdůrazní následující krok. Hardwarové dekódování vyžaduje podporu použitého formátu v dekodéru a ovladači.' });
    return steps.flatMap(s => {
      if (['graphics-request','graphics-notify'].includes(s.id)) return [{ ...s,
        description:video ? 'CPU podle instrukcí grafického ovladače a operačního systému předá dedikované grafické kartě dekódovací práci. Ovladač a systém správy GPU zajistí její zařazení a návaznost na předchozí operace. Karta si načte příkazy ze systémové RAM a podle nich zpřístupní videodekodéru komprimované video; v této variantě se vstup nejprve kopíruje do VRAM.'
          : 'CPU podle instrukcí grafického ovladače a operačního systému předá dedikované grafické kartě připravenou práci. Ovladač a systém správy GPU zajistí její zařazení do fronty a potřebnou synchronizaci s předchozími operacemi. Konkrétní způsob předání závisí na grafickém hardwaru a ovladači. Karta si příkazy načte ze systémové RAM a podle nich přenese potřebné obrazové podklady do VRAM.' }];
      if (s.id === 'draw' || s.id === 'video-read') {
        const commands = [step('graphics-commands-read', 'GPU načte příkazy z RAM',
          video ? 'Grafický hardware načte ze systémové RAM příkazy pro videodekodér. Obsahují řídicí údaje pro dekódování a odkazy na vstupní video i výstupní paměťové plochy. Jde o práci připravenou ovladačem, nikoli o instrukce prohlížeče vykonávané CPU.'
            : 'Grafická karta načte příkazy ze systémové RAM. Ty určují požadovanou práci a umístění obrazových dat; samy nejsou obrazovým signálem.',
          ['ram','gpu'], [flow('ramGpu','control','Příkazy pro grafiku')])];
        return [...commands,upload(),read(),...(!video ? [store()] : [])];
      }
      if (s.id === 'video-process') return [process(s),store()];
      if (s.flows.some(f => f.route === 'gpuMonitor')) return [scanout(),{ ...s,
        description:s.id === 'playback'
          ? 'Zobrazovací část karty opakovaně čte připravený obraz z VRAM a vytváří signál pro přímo připojený monitor. Zvukové zařízení souběžně zpracovává vzorky ze systémové RAM. Přehrávač časuje obraz a zvuk podle společného časového základu a zohledňuje zpoždění výstupů. Zatím přicházejí další části obsahu; příprava na CPU, dekódování a doplňování bufferů se při pokračujícím přehrávání opakují a překrývají.'
          : 'Grafická karta posílá obrazový signál přímo připojenému monitoru. Hotový obraz je uložený ve VRAM; ' + (video ? 'zvuková část dál používá systémovou RAM.' : (options.outputDescription || 'po dokončení přenosu se v následujícím kroku zobrazí kalkulačka.')) }];
      return [s];
    });
  };

  Lab.scenarios = [
    { id: 'calculator', title: 'Spuštění kalkulačky', shortTitle: 'Kalkulačka', subtitle: 'Od kliknutí k otevřenému oknu', icon: 'calculator',
      diagram: { server: false },
      initialMemory: { ssd: [item('program', 'Kód a data kalkulačky')], ram: [] },
      emptyMemory: { ram: 'Bez dat kalkulačky' },
      initial: { title: 'Vše začíná jedním kliknutím', description: 'Počítač je zapnutý, kalkulačka neběží a její potřebné části ještě nejsou v RAM. Spusťte ukázku nebo postupujte po jednotlivých krocích.', screen: 'desktop', ramLoaded: false, buffer: 0, playback: false, segment: 0, cpuWork: false, clicked: false },
      createSteps: (graphics = 'integrated') => withRamFocus(withGraphics(withMemory(calculatorSteps(), calculatorMemory), graphics, false),calculatorRamFocus) },
    { id: 'youtube', title: 'Spuštění videa na YouTube', shortTitle: 'Video na YouTube', subtitle: 'Od přehrání k obrazu a zvuku', icon: 'video',
      diagram: { server: true },
      initialMemory: { ssd: [item('program', 'Kód a data prohlížeče')], ram: [item('program', 'Kód a data prohlížeče')] },
      initial: { title: 'Video čeká na přehrání', description: 'Prohlížeč i stránka YouTube už jsou otevřené a jejich potřebný kód je v RAM. Ukázka začíná před načtením přehrávaného úseku. Předpokládá hardwarové dekódování videa a softwarové dekódování zvuku na CPU. Při přehrávání se příjem, příprava dat, dekódování a výstup průběžně překrývají.', screen: 'youtube', ramLoaded: false, buffer: 0, playback: false, playbackFrom: 0, playbackTo: 0, soundPlaying: false, cpuWork: false, clicked: false },
      createSteps: (graphics = 'integrated') => withRamFocus(withGraphics(withMemory(youtubeSteps(), youtubeMemory), graphics, true),youtubeRamFocus) },
    { id:'save', title:'Uložení souboru', shortTitle:'Uložení souboru', subtitle:'Z RAM do paměti SSD', icon:'save',
      diagram:{server:false},
      initialMemory:{ssd:[item('program','Kód editoru')],ram:[item('program','Kód a data editoru'),item('document','Rozepsaný dokument')]},
      initial:{title:'Dokument čeká na uložení',description:'Editor je otevřený a rozepsaný dokument je v RAM. Soubor poznamky.txt na SSD ještě není. Ukázka sleduje přípravu obsahu a zápis na NVMe SSD až po trvalé uložení. Skutečný systém může zápisy odkládat a slučovat; jednotlivé přenosy se nemusí provést bezprostředně po kliknutí na Uložit.',
        screen:'editor',ramLoaded:true,buffer:0,playback:false,soundPlaying:false,cpuWork:false,clicked:false},
      createSteps:() => withRamFocus(saveFile(),saveRamFocus) },
    { id:'boot',title:'Zapnutí počítače',shortTitle:'Zapnutí počítače',subtitle:'Od vypínače k přihlášení',icon:'power',
      diagram:{server:false,boot:true},
      initialMemory:{ssd:[item('loader','Zavaděč'),item('system','Systém a data')],ram:[]},
      emptyMemory:{ram:'Bez dat systému'},
      initial:{title:'Počítač čeká na zapnutí',description:'Ukázka sleduje plný start stolního počítače s UEFI a NVMe SSD až k přihlášení. Zdroj je připojený k síti a dodává pohotovostní napájení, jeho hlavní výstupy jsou vypnuté. Flash obsahuje firmware, SSD zaváděcí programy a operační systém. RAM ještě není inicializovaná. Nejde o obnovení z režimu spánku či hibernace; v pamětech zobrazujeme jen vybraný obsah související se scénářem.',
        screen:'black',powered:false,ramReady:false,cpuSoftware:'Čeká na start',ramLoaded:false,buffer:0,playback:false,soundPlaying:false,cpuWork:false,clicked:false},
      createSteps:boot }
  ];
})(window.HWLab);
