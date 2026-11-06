# Uvnitř počítače

Statická vzdělávací aplikace v češtině pro 9. třídu ZŠ a 2. ročník SŠ. Ukazuje spolupráci hardwaru při spuštění kalkulačky, přehrávání videa, uložení textového souboru a zapnutí počítače. Používá čisté HTML, CSS, JavaScript a SVG; nemá závislosti, sestavování, externí požadavky, skutečné video ani zvuk.

## Spuštění

Otevřete `index.html` v moderním prohlížeči. Funguje i přímo z disku bez serveru a připojení k internetu. Případně v této složce spusťte `python3 -m http.server 8000` a otevřete `http://localhost:8000`.

Pro GitHub Pages nahrajte obsah této složky do repozitáře. V **Settings → Pages** vyberte publikování z větve a kořenovou složku `/ (root)`. Žádný build není potřeba. Všechny cesty jsou relativní, takže aplikace funguje i pod názvem repozitáře.

## GitHub a další změny

Repozitář: [kohuto/inside-computer](https://github.com/kohuto/inside-computer). Místní větev `main` sleduje `origin/main`.

Příkazy spouštějte z kořenové složky projektu. Nejnovější změny stáhnete pomocí `git pull --ff-only`. Vlastní dokončené změny nahrajete takto:

```sh
git add .
git commit -m "Popis změny"
git push
```

## Ovládání

Výběr činnosti je nad vizualizací. Volba grafiky „Integrovaná | Dedikovaná“ je v záhlaví vizualizace pod názvem scénáře. Okno vizualizace zabírá celou dostupnou šířku stránky, také na velkých monitorech; postranní sloupec ani omezení maximální šířky se nepoužívají. SVG zachovává poměr stran a přizpůsobuje výšku dostupnému místu, včetně zapnutého vysvětlení.

Tlačítka přehrávání, krokování a návratu na začátek jsou v pravém horním rohu okna vizualizace vedle názvu scénáře. V úzkém okně se řadí pod volbu grafiky a zarovnají doleva, aby nepřekrývala schéma.

- Vyberte činnost a pod názvem scénáře zvolte **Integrovaná** (výchozí stav) nebo **Dedikovaná**. Obě varianty jsou stále viditelné a vybraná je zvýrazněná. Změna vrátí scénář na začátek; ostatní volby se zachovají. Výběr tvoří skupina nativních rádiových tlačítek „Typ grafiky“, ovladatelná také šipkami na klávesnici, s viditelným rámečkem při zaměření.
- **Integrovaná** grafika používá systémovou RAM. **Dedikovaná** karta má GPU a vlastní VRAM; ve schématu se zobrazí i její obsah, kopírování obrazových dat a čtení hotového obrazu. Volba funguje u všech scénářů s grafickým výstupem.
- **Spustit / Pozastavit / Pokračovat** ovládá celý děj včetně pohyblivých zpráv, obrazu na monitoru a indikátoru zvuku. Po dokončení lze ukázku přehrát znovu.
- **Další krok** přehraje jeden krok a na jeho konci se samočinně zastaví. Z výchozího stavu začne prvním krokem. Pokud je aktuální přenos rozpracovaný, nejprve jej dokončí; opakované stisky jeho pohyb nepřeskočí. U kroků s vnitřními fázemi přehraje jednu fázi: například příjem a potom uložení další části dat. Číslo kroku přitom zůstává stejné. **Pokračovat** spustí souvislé přehrávání od aktuálního místa.
- **Od začátku** vymaže průběh, pohyby i obsah monitoru a obnoví výchozí stav aktuálního scénáře.
- Animace běží stálou rychlostí. Přepínač **Zobrazit vysvětlení** je pod vizualizací a při otevření stránky je vypnutý. Po zapnutí se pod přepínačem zobrazí číslo a průběh kroku, titulek i vysvětlení. Vypnutí je opět skryje. Názvy komponent, uložený obsah pamětí a datové popisky zůstávají ve schématu viditelné.
- Napájení zapnutého počítače je vždy zvýrazněné zlatou vrstvou: společným obvodovým rozvodem a blesky u napájených součástí. Nemá samostatný přepínač. Ve scénáři zapnutí se vrstva objeví po stisku vypínače a reset ji vrátí do vypnutého stavu.
- Při přechodu na jinou kartu se děj pozastaví. Na úzkém telefonu lze schéma vodorovně posunout; hlavní rozhraní je určené pro notebook a promítání.

## Organizace kódu a další scénáře

| Soubor | Účel |
| --- | --- |
| `index.html` | Struktura rozhraní, bez vložených scénářů. |
| `styles.css` | Vzhled, čitelnost, responzivní rozložení a SVG styly. |
| `js/scenarios.js` | Obsah, výchozí stavy a kroky všech scénářů. |
| `js/diagram.js` | Společné SVG, logické trasy, pohyblivé zprávy, vizuální stavy a samostatná vrstva napájení. |
| `js/player.js` | Nezávislý přehrávač s jediným časem, pauzou, krokováním a resetem. |
| `js/app.js` | Napojení přehrávače na ovládací prvky. |

Nový scénář přidejte do `HWLab.scenarios` v `js/scenarios.js`. Výběr se vytvoří automaticky. Definujte `id`, `title`, `shortTitle`, `subtitle`, `icon`, `diagram`, `initial` a funkci `createSteps(graphics)`. Argument je `integrated` nebo `dedicated`. Funkce vrací pole kroků. `flows` může obsahovat jeden přenos, souběžné přenosy nebo být prázdné při zvýraznění zpracování v komponentě. Kalkulačku a video definují `calculatorSteps()` a `youtubeSteps()`, ukládání `saveFile()` a start počítače `boot(graphics)`. Funkce `withGraphics()` rozšiřuje grafické kroky pro dedikovanou kartu; nevytváří druhou kopii celého scénáře. Cache a registry nejsou ve vizualizaci znázorněné; čtení a zápisy procesoru používají přímo logické spojení s RAM. Nastavení `diagram.server` zapíná vzdálený server a jeho spojení; vnitřní propojení síťové části jsou viditelná stále. RAM a SSD mají podobu jednoduchých bloků s uloženými daty pro aktuální ukázku. Vyrovnávací paměť videa se nekreslí jako samostatný blok ani ukazatel zaplnění.

```js
{
  id: 'vlastni-scenar',
  title: 'Název činnosti',
  shortTitle: 'Krátký název',
  subtitle: 'Popis činnosti',
  icon: 'calculator',
  diagram: { server: false },
  initialMemory: { ssd: [{ id: 'program', label: 'Kód a data aplikace' }], ram: [] },
  emptyMemory: { ram: 'Bez dat aplikace' },
  initial: { title: 'Výchozí stav', description: 'Co už je připraveno.',
    screen: 'desktop', buffer: 0, playback: false, ramLoaded: false },
  createSteps: graphics => [
    {
      id: 'prvni-krok', title: 'Titulek kroku', description: 'Jedna až dvě věty.',
      duration: 3000, active: ['ssd', 'ram'],
      flows: [{ route: 'ssdRam', type: 'data', label: 'kód a data' }],
      effects: { ramLoaded: true },
      memoryWrites: { ram: [{ id: 'program', label: 'Kód a data aplikace' }] }
    }
  ]
}
```

`active` a `flows` platí pouze v daném kroku. Všechny přenosy používají stejnou plnou čáru a barvu. Po orientované trase jednou projede značka dat, kterou doprovází vodorovný štítek s názvem přenášených dat. Značka začíná na portu zdroje a končí na portu cíle, sleduje i ohyby a neskočí během přenosu zpět na začátek. Štítek se pohybuje vedle ní a tenká vodicí linka ukazuje její polohu. Jeho odstup chrání názvy komponent a uložený obsah pamětí. Význam přenosu určuje text, nikoli barva. Barvu společně nastavuje `--flow` v `styles.css`. Pole `type` v definici zůstává obsahovým označením, neovlivňuje vzhled. Přenos může mít `reverse: true`, čímž se obrátí jeho směr po stejné trase, včetně koncové šipky i pohyblivé zprávy. Například `{ route: 'ramCpu', type: 'data', label: 'zápis dat', reverse: true }` představuje zápis CPU → RAM. `effects` se skládají od výchozího stavu přes všechny dosud dosažené kroky. Výchozí stav proto vždy uveďte úplný. Přehrávač při resetu neobnovuje starý DOM, ale znovu odvodí čistý stav. Použitelné identifikátory součástí jsou `mouse`, `cpu`, `ram`, `ssd`, `gpu`, `network`, `audio`, `monitor`, `speakers`, `server`, u dedikované grafiky `vram`, při startu `uefi`, `powerbutton`, `psu`.

Obsah pamětí definuje `initialMemory`: pro `ram`, `ssd` a případně `vram` je to pole položek `{ id, label }`. Volitelné `emptyMemory` určuje text prázdného zobrazení. Krok nebo jeho fáze může mít `memoryWrites`, například `{ ram: [{ id: 'commands', label: 'Příkazy pro grafiku' }] }`. Tento zápis se projeví až po dokončení daného kroku nebo fáze, tedy při dojezdu animované zprávy. Nové `id` přidá položku, stejné `id` aktualizuje její text. Čtení nic neodstraňuje. Přehrávač obsah vždy znovu skládá do `state.memory`, takže reset a přepnutí scénáře obnoví správný výchozí stav. SSD lze později měnit stejným způsobem přes `memoryWrites.ssd`. Přehrávač přidává prázdnou `state.memory.vram` pouze pro dedikovanou variantu. Přenos `ramVram` zapíše obrazové podklady, krok `graphics-store` přidá hotový obraz přes `memoryWrites.vram`. Čtení VRAM ji nemaže; reset ji vyprázdní. Názvy ani směry přenosů se z textu uloženého obsahu neodvozují.

RAM ve vizualizaci ukazuje pouze právě probíraný obsah, nikoli historii všech položek. Nový dokončený zápis nahradí předchozí náhled. Při čtení vybírá `ramFocus` potřebné dříve uložené položky; například `{ ids: ['image', 'commands'], label: 'Podklady a příkazy' }` shrne související data do jednoho řádku. Příchozí zápis změní náhled až po dojezdu zprávy. Výběr zůstává při pauze zachovaný a při resetu se obnoví výchozí obsah. `state.displayMemory.ram` má nejvýše jednu položku, zatímco `state.memory.ram` dál drží úplný model dat pro další čtení. SSD a VRAM se zobrazují jako dříve. Toto zjednodušení proto neznamená, že čtení nebo změna kroku fyzicky smaže jiná data z RAM. Ve scénáři ukládání je zpočátku zobrazen rozepsaný dokument, při přenosu souboru zpět soubor místo již zpracovaného požadavku.

Uložený obsah RAM, SSD, VRAM i flash paměti využívá prostor pod názvem komponenty. Bílé plochy mají výraznější ohraničení a větší tučné písmo; prázdná paměť je odlišená přerušovaným rámečkem. `memoryAreas` v `js/diagram.js` určuje vnitřní prostor a výchozí velikost písma. Vykreslovač jej rozdělí mezi položky a změří šířku i výšku textu, aby se celé názvy vešly bez ořezání. Rozměry komponent a datové trasy zůstávají zachované.

Zpracování CPU nemá samostatný čekací krok ani popisek. Po přijetí instrukcí a dat následuje přímo další přenos z CPU. Vysvětlení navazujícího přenosu shrnuje i přípravu jeho obsahu. Zpracování grafiky a trvalý zápis SSD dál mohou mít `flows: []` a `highlights`, například `[{ target: 'gpu', label: 'Zpracování videa' }]`. Cíl `gpu` umisťuje popisek dovnitř grafické části a cíl `ssd` nad SSD mimo uložený obsah. Polohy nastavuje `activityPositions` ve vykreslovači. Popisky zpráv a zvýraznění mají nejvýše tři slova.

Volitelné `phases` rozděluje tentýž číslovaný krok. Každá fáze má `at` (začátek jako podíl celkové délky kroku, první musí být 0) a může přepsat `active`, `flows`, `highlights` a přidat `effects`. Například v posledním kroku videa od času 0 běží oba výstupy, od času 0,18 přibude příjem ze serveru a od času 0,36 zápis do RAM. Neuvedené vizuální údaje fáze přebírá ze základní definice kroku; efekty se skládají přes dosažené fáze. Zpráva aktivní přes několik sousedních fází se pohybuje plynule po celou tuto dobu. Například obrazový a zvukový signál postupují přes celý závěrečný krok, zatímco každá nově přijatá část dat projde vlastní cestu během své fáze. Funkce `transferProgress` odvozuje tuto polohu ze stavu přehrávače. Všechny fáze, zprávy a výstupy používají jediný čas, takže se společně pozastaví a resetují; SVG nemá vlastní nezávislou animaci.

Rozmístění je definované v `layout.nodes` v `js/diagram.js`. Funkce `port(id, side)` určuje střed zvolené strany komponenty (`top`, `bottom`, `left`, `right`). Logické trasy jsou v `routes`; trasa může mít více bodů a parametr `radius` pro zaoblené rohy. `connections` obsahuje jednotlivé čáry podkladu: společné úseky se vykreslují pouze jednou, i když je používá více logických tras. Nová trasa musí sledovat tyto úseky; nový fyzicky zobrazený spoj přidejte také do `connections`. Opačný přenos například z RAM na SSD může využít `ssdRam` s `reverse: true`. Popisky se automaticky zalamují podle skutečné šířky textu a nastavení `labelWidth`. Pohyblivý štítek umisťuje `packetLabelPosition` ve vykreslovači; statické popisky zpracování mají vlastní souřadnice v `activityPositions`.

Nový obsah monitoru se přidává do stejného vykreslovače, bez změny přehrávače. Efekty `playbackFrom` a `playbackTo` určují rozsah lokální animace videa v daném kroku (0–3 pro tuto krátkou ukázku). Přehrávač mezi nimi postupuje podle času kroku. `playback` zapíná obrazovou ukázku a `soundPlaying` vizuální indikátor zvuku. Krok `playback` zapíná obraz a zvuk zároveň. Jeho vnitřní fáze ponechávají oba výstupy aktivní a postupně přidávají příjem server → síťová část → RAM, bez opakování celé úvodní sekvence. Pauza zastaví jejich společný čas a reset obnoví oba výstupy.

RAM je umístěná nad CPU, SSD vlevo na úrovni středu CPU. V pravém sloupci jsou shora síťové rozhraní, zvuková část a grafická část. Spoje vycházejí ze středů stran. Mezi RAM, CPU a pravým sloupcem vede společná svislá cesta s odbočkami; SSD–RAM má zaoblený ohyb. CPU a RAM navíc spojuje přímá obousměrně používaná cesta. Myš je pod procesorem mimo hranici počítače. Vpravo mimo počítač jsou reproduktory nad monitorem a u videa ještě vzdálený server nad reproduktory. Vnitřní propojení zůstávají viditelná i v neaktivním stavu.

Komponenty jsou jednoduché ploché bloky s názvy a funkčním obsahem. Dekorativní čipy, vývody, kontakty, plošné spoje, konektory a ventilátor zdroje se nekreslí. RAM, SSD, VRAM a flash paměť s UEFI zobrazují uložený obsah. Zdroj ukazuje převod napětí a periferie si ponechávají rozpoznatelný tvar i stavové indikátory. Rozměry bloků a souřadnice portů se nemění.

Plocha SVG má rozměry `1320 × 730`; pod GPU je místo pro VRAM a myš zůstává mimo hranici počítače. Rozšíření využívá větší svislé rozestupy a volné místo vlevo; rozměry komponent se nemění. Hranice počítače je definovaná v `layout.boundary`. Výška SVG se odvozuje od jeho poměru stran, takže širší či vyšší prostor není dosažen zvětšením bloků.

## Technický model

`completionEffects` kroku nebo fáze doplní vizuální stav až po jeho dokončení, stejně jako `memoryWrites`. Start počítače je používá pro připravenost RAM, označení vykonávaného softwaru CPU a výslednou přihlašovací obrazovku. Rozpracovaný krok je při pauze či resetu předčasně neprovede.

Čas je didakticky zpomalený a spojnice vyjadřují logickou komunikaci, nikoli přesné fyzické zapojení sběrnic. Výchozí model používá integrovanou grafiku a společnou systémovou RAM. Grafika je pro přehlednost nakreslená jako funkční blok odděleně od CPU, nikoli jako samostatná rozšiřující karta. Volitelný model představuje desktopovou dedikovanou kartu s vlastní VRAM a monitorem připojeným přímo ke kartě. Zvuková část dále používá systémovou RAM. Operační systém a ovladače nevystupují jako další komponenty; jejich činnost je zahrnuta v práci CPU.

Vlevo od CPU je samostatný blok flash paměti s uloženým firmwarem UEFI. Uchovává kód i bez napájení; jeho úlohou je příprava hardwaru a zahájení zavádění systému při startu počítače. Kód vykonává CPU. Spojení `uefiCpu` je logické, bez kreslení řadiče flash či konkrétní sběrnice. Poslední úsek k CPU sdílí podklad s cestou SSD–CPU. U kalkulačky, videa a ukládání je systém již spuštěný, proto se čip nezvýrazňuje. Při zapnutí znázorňuje přenos počáteční získávání instrukcí firmwaru; nejde o jednorázové načtení celého UEFI do CPU. Další moduly mohou po zpřístupnění RAM běžet z ní. Uložený obsah flash se čtením nemění. Čip patří mezi napájené vnitřní součásti a jeho blesk se zobrazuje spolu s ostatními po zapnutí hlavního napájení. Podklad: [UEFI – Firmware Storage Design Discussion](https://uefi.org/specs/PI/1.9/V3_Design_Discussion.html) a [QEMU – Anatomy of a Boot](https://www.qemu.org/2020/07/03/anatomy-of-a-boot/).

Zdroj je zasazený do spodního okraje počítače jako jednoduchý blok s názvem „Zdroj“. Zásuvka je vlevo pod ním vně počítače. Přívod vystupuje ze středu pravého boku zásuvky, vede doprava a vstupuje zespodu do středu spodní hrany zdroje; výstup z pravého boku pokračuje přímo po spodní napájecí čáře doprava. Název zásuvky a „Střídavé (230 V)“ jsou vlevo od jejího symbolu, „Stejnosměrné“ a na dalším řádku „(12 V, 5 V, 3,3 V)“ pod výstupem vpravo od zdroje. Popisky napětí jsou stále viditelné; při vypnutých hlavních výstupech ve scénáři startu je výstupní popisek ztlumený. Zobrazená klasická ATX varianta má výstupy 12 V, 5 V a 3,3 V. Měniče na desce a kartách napětí dále upravují pro jednotlivé čipy; nejde o tvrzení, že každý čip používá přímo napětí z výstupu zdroje.

Napájení má samostatnou zlatou vrstvu a nepatří do datových přenosů. Jedna trasa po obvodu společně představuje více rozvodů přes základní desku a napájecí kabely. Blesky označují napájené součásti, včetně právě neaktivních; nevzniká další kabel ke každému bloku. U dedikované grafiky je označená i VRAM na kartě. Myš je napájena přes USB; monitor, aktivní reproduktory a vzdálený server v tomto modelu používají vlastní napájení mimo zobrazený PSU. U běžících aplikací je zlatá vrstva stálá. Ve scénáři zapnutí se objeví až po prvním kroku; používá stejný čas přehrávače a nemá vlastní animaci.

Model energie je oddělený od `routes` a `connections` v objektu `HWLab.power`: `ac` je přívod zásuvka → zdroj, `dc` společně znázorněný rozvod a seznamy `components` / `dedicatedComponents` určují označené vnitřní součásti. Viditelnost vrstvy se řídí pouze zapnutým či vypnutým stavem počítače ve scénáři. Geometrie AC a DC se nekříží, aby nevznikl falešný elektrický uzel. Napětí vycházejí z [Intel – Power Supply Design Guide for Desktop Platform Form Factors](https://www.intel.com/content/dam/www/public/us/en/documents/design-guides/resellers-power-supply-design-guide-changes.pdf).

Aktivní chlazení představuje jednoduchý kruhový ventilátor s lopatkami a popiskem „Ventilátor“. Je ve volném místě dole mezi procesorem a oblastí grafiky, vlevo od případné VRAM. Blesk označuje jeho napájení ze základní desky.

Geometrii chlazení definuje `HWLab.cooling`. `coolingMotion(state)` odvozuje polohu ventilátoru ze součtu délek dokončených kroků a průběhu aktuálního kroku. Pohyb plynule navazuje mezi kroky i fázemi a zastaví se spolu s přehrávačem. Po resetu se poloha obnoví. U studeného startu je napájení ventilátoru skryté do zapnutí hlavního napájení; samotný ventilátor zůstává viditelný a stojí. Chlazení je názorné, rychlost otáčení není měřením teploty.

| Scénář | Integrovaná grafika | Dedikovaná grafika |
| --- | ---: | ---: |
| Spuštění kalkulačky | 10 | 14 |
| Video na YouTube | 14 | 18 |
| Uložení souboru | 8 | 8 |
| Zapnutí počítače | 14 | 18 |

Scénář `boot` ukazuje plný start počítače s UEFI a NVMe SSD bez obnovy ze spánku či hibernace. Místo myši se pod CPU zobrazí vypínač. Před spuštěním je hlavní napájecí vrstva skrytá, monitor černý a RAM nepřipravená; pohotovostní napájení řídicích obvodů není samostatně zakreslené. Stisk v prvním kroku aktivuje hlavní napájení, zvýraznění je potom trvale viditelné. Vysvětlení popisuje PS_ON#, PWR_OK a návaznost resetu. Počáteční instrukce firmwaru pocházejí z flash; další moduly mohou po inicializaci paměti běžet z RAM. Krok shrnuje více fází inicializace a při dokončení zpřístupní RAM.

Správce spouštění UEFI vybere zaváděcí program. Ovladač firmwaru připraví příkaz ke čtení v RAM, aktualizuje doorbell SSD a zpracuje dokončení přenosu DMA. Služby firmwaru připraví spustitelný obraz a předají mu řízení. Zavaděč může shrnovat řetězec programů, například správce spouštění Windows a OS loader. Následující čtení se týká jádra a počátečních ovladačů; další služby a přihlašovací prostředí se načítají také po spuštění jádra, v ději shrnutém krokem přípravy grafických podkladů. Vysvětlení předání řízení zahrnuje ExitBootServices a zachování vybraných běhových služeb firmwaru. CPU průběžně čte instrukce přes cache a RAM; celý systém se najednou nekopíruje dovnitř CPU ani do RAM. Pod CPU navazují označení UEFI → Zavaděč → Operační systém. SSD si ponechává původní obsah; RAM ukazuje jen vybraná data, takže po inicializaci nenaznačuje zcela prázdnou paměť.

Grafický software připraví podklady a příkazy, GPU vykreslí obrazové plochy do RAM nebo VRAM a zobrazovací část je průběžně čte pro výstupní signál. Výstupní krok dokončí zobrazení přihlášení, skutečná komunikace s monitorem pokračuje. Dedikovaná grafika přidává čtyři přenosy související s VRAM a má vlastní texty pro start systému; kopírování podkladů do VRAM je zobrazená varianta, nikoli univerzální požadavek pro každý prostředek. Počáteční logo firmwaru a případné ověření Secure Boot nejsou samostatně animované. Pořadí, trasy a časování mají nadále 14 kroků u integrované a 18 u dedikované grafiky.

Technické podklady ke startu: [Intel – napájení ATX](https://www.intel.com/content/dam/www/public/us/en/documents/design-guides/resellers-power-supply-design-guide-changes.pdf), [UEFI PI – inicializace paměti](https://uefi.org/specs/PI/1.9/V1_PEI_Physical_Memory_Usage.html), [UEFI Boot Manager](https://uefi.org/specs/UEFI/2.11/03_Boot_Manager.html), [UEFI – předání platformy systému](https://uefi.org/specs/UEFI/2.11/08_Services_Runtime_Services.html), [Microsoft – fáze startu Windows](https://learn.microsoft.com/en-us/troubleshoot/windows-client/performance/windows-boot-issues-troubleshooting), [SPDK – NVMe a DMA](https://spdk.io/doc/nvme_spec.html), [Linux DRM/KMS – čtení obrazu pro zobrazení](https://docs.kernel.org/gpu/drm-kms.html).

Průběh startu vychází z [UEFI – Boot Manager](https://uefi.org/specs/UEFI/2.11/03_Boot_Manager.html), [QEMU – Anatomy of a Boot](https://www.qemu.org/2020/07/03/anatomy-of-a-boot/) a řízení zdroje z [Intel – PS_ON#](https://edc.intel.com/content/www/us/en/design/ipla/software-development-platforms/client/platforms/alder-lake-desktop/atx-version-3-0-multi-rail-desktop-platform-power-supply-design-guide/2.0/2.01/ps-on-required/). Cesty SSD po inicializaci RAM zachovávají stejný zjednodušený model požadavků jako ostatní scénáře; nejde o přesný záznam konkrétního firmwaru či platformy.

Následující číslování popisuje integrovanou grafiku. U kalkulačky a videa dedikovaná varianta přidává jednotlivé přenosy do vlastní paměti karty.

Kalkulačka začíná kliknutím, potřebné části jejího programu dosud nejsou v RAM. CPU připraví příkaz pro NVMe SSD v RAM a oznámí novou práci SSD. Následuje rovnou animace přenosu kódu a dat z SSD do RAM pomocí DMA. Načtení příkazu řadičem a oznámení dokončení jsou zahrnuté v ději bez samostatných kroků. Oznámení zjednodušeně shrnuje informace o dokončení a upozornění CPU; interní fronty a stavové záznamy nekreslíme. Výpočetní jádra CPU nemusí jednotlivé bajty přenosu kopírovat. Přenos SSD ↔ RAM přitom používá rozhraní a řadiče; šipka neznamená samostatný fyzický vodič mezi SSD a paměťovým modulem.

Kalkulačka s integrovanou grafikou má deset kroků i deset stisků tlačítka Další krok. Po načtení „Instrukce a data“ z RAM do CPU v kroku 5 hned následuje zápis „Podklady a příkazy“ zpět do RAM v kroku 6. Zpracování CPU je součástí vysvětlení tohoto zápisu. Po oznámení nové práce grafické části v kroku 7 následuje načtení podkladů a příkazů z RAM v kroku 8. Krok 9 odešle „Obrazový signál“; během celého přenosu včetně jeho dokončení monitor ještě ukazuje přípravu obrazu. Samostatný závěrečný krok 10 zobrazí kalkulačku po přijetí signálu a neobsahuje další přenos. S dedikovanou kartou jde o kroky 13 a 14.

U videa jsou prohlížeč i YouTube již otevřené. CPU připraví požadavek v RAM a oznámí novou práci síťové části; ta požadavek odešle serveru a zapíše přijatý obsah do RAM pomocí DMA. Načtení požadavku z RAM a oznámení přijatých dat jsou zahrnuté v ději bez samostatných přenosových kroků. „Video a zvuk“ označuje obsah přenosu, nikoli hotový signál pro monitor a reproduktory. V kroku 7 CPU načte „Instrukce a data“. Hned následuje krok 8, zápis „Data a příkazy“ zpět do RAM; jeho vysvětlení zahrnuje zpracování, dešifrování i přípravu zvukových vzorků. Po oznámení nové práce v kroku 9 si grafika načte „Video a příkazy“ v kroku 10. Dekódování obrazu zůstává samostatným krokem 11 se zvýrazněnou grafickou částí a popiskem „Zpracování videa“.

Vysvětlení předpokládají hardwarové dekódování podporovaného videoformátu a softwarové dekódování zvuku na CPU. Rozlišují síťové příjmové buffery od paměti přehrávače, instrukce CPU od řídicích údajů videodekodéru a komprimované video od hotových snímků. Integrovaná grafika používá systémovou RAM; dedikovaná varianta ukazuje kopírování vstupu a uložení snímků do VRAM. Skutečné umístění dat závisí na ovladači. Příjem, dekódování a výstup se během přehrávání překrývají; přehrávač koordinuje obraz a zvuk podle společného časového základu. Technické podklady: [Chromium Media](https://chromium.googlesource.com/chromium/src/+/HEAD/media/README.md), [dekódování videa Direct3D 11](https://learn.microsoft.com/en-us/windows/win32/medfound/supporting-direct3d-11-video-decoding-in-media-foundation), [zvukové buffery WaveRT](https://learn.microsoft.com/en-us/windows-hardware/drivers/audio/understanding-the-wavert-port-driver).

CPU nastaví umístění a formát zvukových dat a spustí zvukovou část. Ta načítá zvukové vzorky z RAM pomocí DMA. V posledním kroku 14 současně proudí obrazový a zvukový signál, pohybuje se místní obrázek a pulzují membrány reproduktorů. Přitom dvakrát navazuje server → síťová část → RAM. Nestahuje se nejprve celé video a úvodní požadavek se neopakuje. Ukázka po deseti didaktických sekundách posledního kroku automaticky skončí. SSD v tomto scénáři není aktivní; skutečné video, zvuk, síť ani YouTube API se nepoužívají.

Scénář „Uložení souboru“ začíná otevřeným editorem a rozepsaným dokumentem v RAM. Na SSD je kód editoru, soubor poznamky.txt tam ještě není. Ukázka končí trvalým zápisem do flash, celkem má osm kroků a osm stisků Další krok:

1. Myš → CPU: Kliknutí na Uložit.
2. RAM → CPU: Instrukce a data.
3. CPU → RAM: Data souboru.
4. CPU → RAM: Požadavek na zápis.
5. CPU → SSD: Oznámení nové práce.
6. RAM → SSD: Požadavek na zápis.
7. RAM → SSD: Data souboru, převzatá řadičem pomocí DMA.
8. Zvýraznění SSD: Zápis do flash.

Příprava souboru procesorem je shrnutá ve vysvětlení kroku 3. Po jeho dokončení přibude v RAM položka poznamky.txt, po kroku 4 požadavek na zápis. Po přenosu v kroku 7 se v SSD objeví „Čeká na zápis“, což představuje přijatá data před trvalým uložením. Teprve dokončení kroku 8 změní položku na poznamky.txt. Kopie v RAM, rozepsaný dokument i kód editoru zůstávají zachované. Reset a změna scénáře obnoví výchozí stav bez uloženého souboru.

Vysvětlení rozlišují editor, systém souborů a ovladač NVMe, průběžné čtení přes cache CPU, příkazovou frontu a doorbell, logické bloky a fyzická umístění ve flash. Běžný zápis může nejprve skončit v systémové souborové cache; přesun do SSD a programování flash se mohou překrývat. Závěrečný krok shrnuje i zápis potřebných metadat a zajištění trvalosti po předání dat ze systémových bufferů, včetně případného vyprázdnění zapisovací cache úložiště nebo použití FUA. Potvrzení Uloženo v editoru nemusí na tento okamžik čekat. Technické podklady: [Microsoft File Caching](https://learn.microsoft.com/en-us/windows/win32/fileio/file-caching), [SPDK: příkazy a DMA NVMe](https://spdk.io/doc/nvme_spec.html), [Linux: zapisovací cache, Flush a FUA](https://docs.kernel.org/block/writeback_cache_control.html), [specifikace příkazu NVMe Write](https://nvmexpress.org/wp-content/uploads/NVM-Express-NVM-Command-Set-Specification-Revision-1.2-2025.08.01-Ratified.pdf).

Přenos obsahu RAM → SSD probíhá po stejné přímé logické cestě pomocí DMA. Grafická varianta mění podobu hardwaru, ale v tomto scénáři se k ní neposílá nová práce a VRAM zůstává prázdná. Na monitoru je od začátku otevřený editor; po dokončení ukládání nepřidáváme oznámení CPU ani překreslení obrazovky.

Tato didaktická varianta sleduje data až do trvalé paměti SSD. Skutečné aplikace mohou potvrdit uložení už po předání dat systému a fyzický zápis nastane později kvůli vyrovnávacím pamětem; viz [Microsoft – systémová souborová cache](https://learn.microsoft.com/en-us/windows/win32/fileio/file-caching).

V RAM a SSD se zobrazují vybraná data související se scénářem. Prázdná RAM kalkulačky proto znamená, že v ní ještě nejsou její data; nejde o tvrzení, že zapnutý počítač nemá v RAM vůbec nic. Na SSD zůstává „Kód a data kalkulačky“, v RAM postupně přibude požadavek, načtený program, podklady pro obraz a grafické příkazy. U videa už RAM obsahuje kód a data prohlížeče, poté přibude požadavek, přijatá část videa a zvuku, připravené video se zvukovými vzorky a grafické příkazy. Další příjmy aktualizují souhrnnou položku na části 1–2 a 1–3. Čtení ani zobrazení obrazu tento obsah nemaže; kopie programu na SSD zůstává zachovaná. Vyrovnávací paměť se nezobrazuje jako zvláštní dílky či ukazatel zaplnění. Obsah pamětí zůstává viditelný i po skrytí vysvětlení.

U dedikované varianty se po oznámení CPU nejprve načtou grafické příkazy z RAM. Kopírovací část karty pak pomocí DMA přenese obrazové podklady kalkulačky nebo komprimované video do VRAM. GPU je odtud načte a vytvoří hotový obraz, který uloží zpět do VRAM. Zobrazovací část karty z VRAM čte snímek a pak odešle obrazový signál monitoru. Jeden přenos znázorňuje průběžně opakovanou práci; nejde o úplný popis všech grafických front a paměťových přístupů. Příkazy v tomto modelu zůstávají v systémové RAM, nemusí se všechny nejprve kopírovat do VRAM. Instrukce CPU ani zvukové vzorky se do VRAM nepřenášejí.

VRAM začíná s textem „Bez obrazových dat“. Po kopírování obsahuje „Podklady pro obraz“ nebo „Komprimované video“, po zpracování přibude „Obraz okna“ nebo „Obrazové snímky“. U závěrečného videa zůstávají připravené snímky ve VRAM a další přijaté části čekají v RAM. Schéma neukazuje hybridní notebook, v němž může dedikované GPU předávat obraz ještě integrovanému GPU. Základ rozdílu mezi sdílenou RAM a vlastní pamětí popisuje [Intel – integrovaná a dedikovaná grafika](https://www.intel.com/content/www/us/en/support/articles/000057824/graphics.html).

Technické podklady: [Intel – integrovaná grafika a sdílená paměť](https://www.intel.com/content/www/us/en/developer/articles/guide/quick-reference-guide-to-intel-processor-graphics.html), [Intel – hardwarové dekódování videa](https://www.intel.com/content/www/us/en/support/articles/000055741/graphics/processor-graphics.html), [SPDK – příkazy NVMe a DMA](https://spdk.io/doc/nvme_spec.html).

## Ověření

Bez závislostí lze spustit `node --test tests/player.test.cjs`. Celkem 42 testů kontroluje všech osm kombinací scénáře a grafiky, úplné dokončení, shodu krokování a přehrávání, přehrání jednoho kroku s automatickým zastavením, plynulost přenosu přes fáze, zápis paměti až při dokončení přenosu, zachování dat při čtení, pauzu i zrušení starého časovače po resetu a změně scénáře či grafiky. Kontroly dedikované varianty navíc ověřují pořadí příkazů a dat, použití VRAM až po dokončení zápisu, zachování RAM a SSD, nepřítomnost programu a zvuku ve VRAM a shodu krokování s automatikou. Kontroly ukládání ověřují přesných osm kroků, rozlišení přenosu a trvalého zápisu, stav před zápisem i během pauzy, zachování dokumentu v RAM, vyprázdnění VRAM a zrušení rozpracovaného zápisu při resetu. Kontrola chlazení ověřuje zapnutí při startu, plynulou návaznost kroků, společnou pauzu, obnovení při resetu a shodnou výslednou polohu při automatickém i krokovaném přehrání. V prohlížeči je třeba také zkontrolovat popisky SVG, ovládání a rozložení na cílovém rozlišení.

Výsledky provedeného ověření jsou v [tests/PROVERENI.md](tests/PROVERENI.md).
