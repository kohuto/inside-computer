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

Výběr činnosti a dva přepínače „Cache a registry“ a „Dedikovaná grafika“ jsou nad vizualizací. Okno vizualizace zabírá celou dostupnou šířku stránky, také na velkých monitorech; postranní sloupec ani omezení maximální šířky se nepoužívají. Na úzkém displeji se nastavení skládá pod sebe. SVG zachovává poměr stran a přizpůsobuje výšku dostupnému místu, včetně zapnutého vysvětlení.

Tlačítka přehrávání, krokování a návratu na začátek jsou v pravém horním rohu okna vizualizace vedle názvu scénáře. V úzkém okně se zarovnají doprava pod název, aby nepřekrývala schéma.

- Vyberte činnost. Přepínač **Cache a registry** zapíná jejich zobrazení uvnitř procesoru. Přepínač **Dedikovaná grafika** přepíná mezi integrovanou grafikou (vypnuto) a dedikovanou kartou (zapnuto). Oba jsou ve výchozím stavu vypnuté. Změna vrátí scénář na začátek; ostatní volby se zachovají. Přepínače lze ovládat také klávesnicí a mají viditelný rámeček při zaměření.
- **Integrovaná** grafika používá systémovou RAM. **Dedikovaná** karta má GPU a vlastní VRAM; ve schématu se zobrazí i její obsah, kopírování obrazových dat a čtení hotového obrazu. Volba funguje u všech scénářů s grafickým výstupem v obou úrovních podrobnosti.
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

Nový scénář přidejte do `HWLab.scenarios` v `js/scenarios.js`. Výběr se vytvoří automaticky. Definujte `id`, `title`, `shortTitle`, `subtitle`, `icon`, `diagram`, `initial` a funkci `createSteps(detailed, graphics)`. Druhý argument je `integrated` nebo `dedicated`. Ta vrací pole kroků. `flows` může obsahovat jeden přenos, souběžné přenosy nebo být prázdné při společném zvýraznění komponent. Základní varianty jsou ve funkcích `calcBasic()` a `youtubeBasic()`, podrobné v `calc(true)` a `youtube(true)`. Scénář `saveFile(detailed)` má v obou nastaveních devět kroků; zobrazení cache a registrů mění pouze detaily čtení a zpracování v CPU. Funkce `withGraphics()` rozšiřuje grafické kroky pro dedikovanou kartu; nevytváří druhou kopii celého scénáře. Obě úrovně popisují stejný příběh; základní odděluje hlavní přenosy a zpracování v CPU, podrobná navíc rozvádí dílčí příkazy, cache a registry. Nastavení `diagram.server` zapíná vzdálený server a jeho spojení; vnitřní propojení síťové části jsou viditelná stále. RAM a SSD mají podobu jednoduchých bloků se seznamem uložených dat pro aktuální ukázku. Vyrovnávací paměť videa se nekreslí jako samostatný blok ani ukazatel zaplnění.

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
  createSteps: detailed => [
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

`active` a `flows` platí pouze v daném kroku. Všechny přenosy používají stejnou plnou čáru a barvu. Po orientované trase jednou projede značka dat, kterou doprovází vodorovný štítek s názvem přenášených dat. Značka začíná na portu zdroje a končí na portu cíle, sleduje i ohyby a neskočí během přenosu zpět na začátek. Štítek se pohybuje vedle ní a tenká vodicí linka ukazuje její polohu. Jeho odstup chrání názvy komponent; při vstupu do cache zůstane před CPU, zatímco značka pokračuje dovnitř. Význam přenosu určuje text, nikoli barva. Barvu společně nastavuje `--flow` v `styles.css`. Pole `type` v definici zůstává obsahovým označením, neovlivňuje vzhled. Přenos může mít `reverse: true`, čímž se obrátí jeho směr po stejné trase, včetně koncové šipky i pohyblivé zprávy. Například `{ route: 'ramCpu', type: 'data', label: 'zápis dat', reverse: true }` představuje zápis CPU → RAM. `effects` se skládají od výchozího stavu přes všechny dosud dosažené kroky. Výchozí stav proto vždy uveďte úplný. Přehrávač při resetu neobnovuje starý DOM, ale znovu odvodí čistý stav. Použitelné identifikátory součástí jsou `mouse`, `cpu`, `ram`, `ssd`, `gpu`, `network`, `audio`, `monitor`, `speakers`, `server`, u dedikované grafiky `vram`, při startu `uefi`, `powerbutton`, `psu`, a v detailu `cache`, `registers`.

Obsah pamětí definuje `initialMemory`: pro `ram`, `ssd` a případně `vram` je to pole položek `{ id, label }`. Volitelné `emptyMemory` určuje text prázdného zobrazení. Krok nebo jeho fáze může mít `memoryWrites`, například `{ ram: [{ id: 'commands', label: 'Příkazy pro grafiku' }] }`. Tento zápis se projeví až po dokončení daného kroku nebo fáze, tedy při dojezdu animované zprávy. Nové `id` přidá položku, stejné `id` aktualizuje její text. Čtení nic neodstraňuje. Přehrávač obsah vždy znovu skládá do `state.memory`, takže reset a přepnutí scénáře obnoví správný výchozí stav. SSD lze později měnit stejným způsobem přes `memoryWrites.ssd`. Přehrávač přidává prázdnou `state.memory.vram` pouze pro dedikovanou variantu. Přenos `ramVram` zapíše obrazové podklady, krok `graphics-store` přidá hotový obraz přes `memoryWrites.vram`. Čtení VRAM ji nemaže; reset ji vyprázdní. Názvy ani směry přenosů se z textu uloženého obsahu neodvozují.

RAM ve vizualizaci ukazuje pouze právě probíraný obsah, nikoli historii všech položek. Nový dokončený zápis nahradí předchozí náhled. Při čtení vybírá `ramFocus` potřebné dříve uložené položky; například `{ ids: ['image', 'commands'], label: 'Podklady a příkazy' }` shrne související data do jednoho řádku. Příchozí zápis změní náhled až po dojezdu zprávy. Výběr zůstává při pauze zachovaný a při resetu se obnoví výchozí obsah. `state.displayMemory.ram` má nejvýše jednu položku, zatímco `state.memory.ram` dál drží úplný model dat pro další čtení. SSD a VRAM se zobrazují jako dříve. Toto zjednodušení proto neznamená, že čtení nebo změna kroku fyzicky smaže jiná data z RAM. Ve scénáři ukládání je zpočátku zobrazen rozepsaný dokument, při přenosu souboru zpět soubor místo již zpracovaného požadavku.

Uložený obsah RAM, SSD, VRAM i flash paměti využívá prostor pod názvem komponenty. Bílé plochy mají výraznější ohraničení a větší tučné písmo; prázdná paměť je odlišená přerušovaným rámečkem. `memoryAreas` v `js/diagram.js` určuje vnitřní prostor a výchozí velikost písma. Vykreslovač jej rozdělí mezi položky a změří šířku i výšku textu, aby se celé názvy vešly bez ořezání. Rozměry komponent a datové trasy zůstávají zachované.

Přípravný krok může mít `active: ['cpu', 'ram']`, `flows: []` a `highlights: [{ target: 'cpuRam', label: 'Příprava přehrávání' }]`. Cíl `cpu` umisťuje popisek dovnitř CPU a cíl `gpu` dovnitř grafické části. Cíl `ssd` umisťuje popisek nad SSD, aby nezakrýval jeho uložený obsah. Polohy těchto popisků nastavuje `activityPositions` ve vykreslovači. Popisky zpráv a zvýraznění základního režimu mají nejvýše tři slova.

Volitelné `phases` rozděluje tentýž číslovaný krok. Každá fáze má `at` (začátek jako podíl celkové délky kroku, první musí být 0) a může přepsat `active`, `flows`, `highlights` a přidat `effects`. Například v posledním kroku videa od času 0 běží oba výstupy, od času 0,18 přibude příjem ze serveru a od času 0,36 zápis do RAM. Neuvedené vizuální údaje fáze přebírá ze základní definice kroku; efekty se skládají přes dosažené fáze. Zpráva aktivní přes několik sousedních fází se pohybuje plynule po celou tuto dobu. Například obrazový a zvukový signál postupují přes celý závěrečný krok, zatímco každá nově přijatá část dat projde vlastní cestu během své fáze. Funkce `transferProgress` odvozuje tuto polohu ze stavu přehrávače. Všechny fáze, zprávy a výstupy používají jediný čas, takže se společně pozastaví a resetují; SVG nemá vlastní nezávislou animaci.

Rozmístění je definované v `layout.nodes` v `js/diagram.js`. Funkce `port(id, side)` určuje střed zvolené strany komponenty (`top`, `bottom`, `left`, `right`). Logické trasy jsou v `routes`; trasa může mít více bodů a parametr `radius` pro zaoblené rohy. `connections` obsahuje jednotlivé čáry podkladu: společné úseky se vykreslují pouze jednou, i když je používá více logických tras. Nová trasa musí sledovat tyto úseky; nový fyzicky zobrazený spoj přidejte také do `connections`. Opačný přenos například z RAM na SSD může využít `ssdRam` s `reverse: true`. Popisky se automaticky zalamují podle skutečné šířky textu a nastavení `labelWidth`. Pohyblivý štítek umisťuje `packetLabelPosition` ve vykreslovači; statické popisky zpracování mají vlastní souřadnice v `activityPositions`.

Nový obsah monitoru se přidává do stejného vykreslovače, bez změny přehrávače. Efekty `playbackFrom` a `playbackTo` určují rozsah lokální animace videa v daném kroku (0–3 pro tuto krátkou ukázku). Přehrávač mezi nimi postupuje podle času kroku. `playback` zapíná obrazovou ukázku a `soundPlaying` vizuální indikátor zvuku. V základním režimu zapíná krok `playback` obraz a zvuk zároveň. Jeho vnitřní fáze ponechávají oba výstupy aktivní a postupně přidávají příjem server → síťová část → RAM, bez opakování celé úvodní sekvence. Podrobný režim ponechává své rozvedené kroky `image-output` a `sound-output`. Pauza zastaví jejich společný čas a reset obnoví oba výstupy.

RAM je umístěná nad CPU, SSD vlevo na úrovni středu CPU. V pravém sloupci jsou shora síťové rozhraní, zvuková část a grafická část. Spoje vycházejí ze středů stran. Mezi RAM, CPU a pravým sloupcem vede společná svislá cesta s odbočkami; SSD–RAM má zaoblený ohyb. CPU a RAM navíc spojuje přímá obousměrně používaná cesta. V detailu její pokračování obchází nadpis procesoru a vstupuje do cache uvnitř CPU. Myš je pod procesorem mimo hranici počítače. Vpravo mimo počítač jsou reproduktory nad monitorem a u videa ještě vzdálený server nad reproduktory. Vnitřní propojení zůstávají viditelná i v neaktivním stavu.

Komponenty jsou jednoduché ploché bloky s názvy a funkčním obsahem. Dekorativní čipy, vývody, kontakty, plošné spoje, konektory a ventilátor zdroje se nekreslí. RAM, SSD, VRAM a UEFI zobrazují uložený obsah; volitelné bloky cache a registrů uvnitř CPU zůstávají zachované. Zdroj ukazuje převod napětí a periferie si ponechávají rozpoznatelný tvar i stavové indikátory. Rozměry bloků a souřadnice portů se nemění.

Plocha SVG má rozměry `1320 × 730`; pod GPU je místo pro VRAM a myš zůstává mimo hranici počítače. Rozšíření využívá větší svislé rozestupy a volné místo vlevo; rozměry komponent se nemění. Hranice počítače je definovaná v `layout.boundary`. Výška SVG se odvozuje od jeho poměru stran, takže širší či vyšší prostor není dosažen zvětšením bloků.

## Technický model

`completionEffects` kroku nebo fáze doplní vizuální stav až po jeho dokončení, stejně jako `memoryWrites`. Start počítače je používá pro připravenost RAM, označení vykonávaného softwaru CPU a výslednou přihlašovací obrazovku. Rozpracovaný krok je při pauze či resetu předčasně neprovede.

Čas je didakticky zpomalený a spojnice vyjadřují logickou komunikaci, nikoli přesné fyzické zapojení sběrnic. Výchozí model používá integrovanou grafiku a společnou systémovou RAM. Grafika je pro přehlednost nakreslená jako funkční blok odděleně od CPU, nikoli jako samostatná rozšiřující karta. Volitelný model představuje desktopovou dedikovanou kartu s vlastní VRAM a monitorem připojeným přímo ke kartě. Zvuková část dále používá systémovou RAM. Operační systém a ovladače nevystupují jako další komponenty; jejich činnost je zahrnuta v práci CPU.

Vlevo od CPU je samostatný blok flash paměti s uloženým firmwarem UEFI. Uchovává kód i bez napájení; jeho úlohou je příprava hardwaru a zahájení zavádění systému při startu počítače. Kód vykonává CPU. Spojení `uefiCpu` je logické, bez kreslení řadiče flash či konkrétní sběrnice. Poslední úsek k CPU sdílí podklad s cestou SSD–CPU. U kalkulačky, videa a ukládání je systém již spuštěný, proto se čip nezvýrazňuje. Ve scénáři zapnutí se z něj načte kód firmwaru do CPU; uložený obsah se tím nemění. Patří mezi napájené vnitřní součásti a jeho blesk se zobrazuje spolu s ostatními po zapnutí hlavního napájení. Podklad: [UEFI – Firmware Storage Design Discussion](https://uefi.org/specs/PI/1.9/V3_Design_Discussion.html) a [QEMU – Anatomy of a Boot](https://www.qemu.org/2020/07/03/anatomy-of-a-boot/).

Zdroj je ve spodní levé části počítače jako jednoduchý blok s názvem „Zdroj“, zásuvka pod ním vně počítače. Vstupní „Střídavé (AC) – 230 V“ je uvedený vedle zásuvky a výstupní „Stejnosměrné (DC) – 12 V · 5 V · 3,3 V“ nad výstupní napájecí cestou mimo blok zdroje. Uvnitř nejsou vlny, napěťové značky ani zkratka PSU. Popisky napětí jsou stále viditelné; při vypnutých hlavních výstupech ve scénáři startu je výstupní popisek ztlumený. Zobrazená klasická ATX varianta má výstupy 12 V, 5 V a 3,3 V. Měniče na desce a kartách napětí dále upravují pro jednotlivé čipy; nejde o tvrzení, že každý čip používá přímo napětí z výstupu zdroje.

Napájení má samostatnou zlatou vrstvu a nepatří do datových přenosů. Jedna trasa po obvodu společně představuje více rozvodů přes základní desku a napájecí kabely. Blesky označují napájené součásti, včetně právě neaktivních; nevzniká další kabel ke každému bloku. U dedikované grafiky je označená i VRAM na kartě. Myš má zvlášť uvedeno 5 V z USB; monitor, aktivní reproduktory a vzdálený server v tomto modelu používají vlastní napájení mimo zobrazený PSU. U běžících aplikací je zlatá vrstva stálá. Ve scénáři zapnutí se objeví až po prvním kroku; používá stejný čas přehrávače a nemá vlastní animaci.

Model energie je oddělený od `routes` a `connections` v objektu `HWLab.power`: `ac` je přívod zásuvka → zdroj, `dc` společně znázorněný rozvod a seznamy `components` / `dedicatedComponents` určují označené vnitřní součásti. Viditelnost vrstvy se řídí pouze zapnutým či vypnutým stavem počítače ve scénáři. Geometrie AC a DC se nekříží, aby nevznikl falešný elektrický uzel. Napětí vycházejí z [Intel – Power Supply Design Guide for Desktop Platform Form Factors](https://www.intel.com/content/dam/www/public/us/en/documents/design-guides/resellers-power-supply-design-guide-changes.pdf).

| Scénář | Integrovaná – základní | Integrovaná – podrobné | Dedikovaná – základní | Dedikovaná – podrobné |
| --- | ---: | ---: | ---: | ---: |
| Spuštění kalkulačky | 10 | 16 | 14 | 19 |
| Video na YouTube | 15 | 20 | 19 | 24 |
| Uložení souboru | 9 | 9 | 9 | 9 |
| Zapnutí počítače | 18 | 18 | 22 | 22 |

Scénář `boot` ukazuje studený start bez obnovy z hibernace. Místo myši se pod CPU zobrazí vypínač. Před spuštěním je hlavní napájecí vrstva skrytá, monitor černý a RAM nepřipravená; pohotovostní napájení řídicích obvodů není samostatně zakreslené. Stisk v prvním kroku aktivuje hlavní napájení, zvýraznění je potom trvale viditelné. CPU čte firmware UEFI přímo z flash; až dokončení inicializace zpřístupní RAM. Firmware pak načte zavaděč a ten potřebné části operačního systému. Pod CPU se postupně mění označení UEFI → Zavaděč → Operační systém. SSD si ponechává zavaděč i systém; RAM postupně doplní jejich kopie a podklady pro obraz. Čtení systému shrnuje více skutečných operací včetně souborů pro přihlašovací prostředí. Celý systém se najednou do RAM nekopíruje. Výstupní přenos dokončí zobrazení přihlášení. Varianta s cache používá tentýž počet kroků, pouze podrobnější čtení a zvýraznění uvnitř CPU; dedikovaná grafika přidává čtyři přenosy související s VRAM. Počáteční logo firmwaru a případné ověření Secure Boot nejsou samostatně animované.

Průběh startu vychází z [UEFI – Boot Manager](https://uefi.org/specs/UEFI/2.11/03_Boot_Manager.html), [QEMU – Anatomy of a Boot](https://www.qemu.org/2020/07/03/anatomy-of-a-boot/) a řízení zdroje z [Intel – PS_ON#](https://edc.intel.com/content/www/us/en/design/ipla/software-development-platforms/client/platforms/alder-lake-desktop/atx-version-3-0-multi-rail-desktop-platform-power-supply-design-guide/2.0/2.01/ps-on-required/). Cesty SSD po inicializaci RAM zachovávají stejný zjednodušený model požadavků jako ostatní scénáře; nejde o přesný záznam konkrétního firmwaru či platformy.

Následující číslování popisuje integrovanou grafiku. U kalkulačky a videa dedikovaná varianta přidává jednotlivé přenosy do vlastní paměti karty.

Kalkulačka začíná kliknutím, potřebné části jejího programu dosud nejsou v RAM. CPU připraví příkaz pro NVMe SSD v RAM a oznámí novou práci SSD. V základním režimu následuje rovnou animace přenosu kódu a dat z SSD do RAM pomocí DMA. Načtení příkazu řadičem a oznámení dokončení jsou v této úrovni zahrnuté v ději bez samostatných kroků; podrobný režim je nadále ukazuje jednotlivě. Oznámení zjednodušeně shrnuje informace o dokončení a upozornění CPU; interní fronty a stavové záznamy nekreslíme. Výpočetní jádra CPU nemusí jednotlivé bajty přenosu kopírovat. Přenos SSD ↔ RAM přitom používá rozhraní a řadiče; šipka neznamená samostatný fyzický vodič mezi SSD a paměťovým modulem.

Základní kalkulačka má přesně deset kroků i deset stisků tlačítka Další krok. V kroku 5 načte CPU z RAM „Instrukce a data“. Krok 6 zvýrazní pouze CPU s popiskem „Zpracování“ a bez přenosové šipky. Krok 7 zapíše z CPU do RAM „Podklady a příkazy“. Po oznámení nové práce grafické části v kroku 8 následuje jejich načtení RAM → grafická část v kroku 9, během něhož se připraví obraz. Až krok 10 odešle „Obrazový signál“ a zobrazí hotovou kalkulačku na monitoru. Závěrečný krok kalkulačky nemá další vnitřní fázi.

U videa jsou prohlížeč i YouTube již otevřené. CPU připraví požadavek v RAM a oznámí novou práci síťové části; ta požadavek odešle serveru a zapíše přijatý obsah do RAM pomocí DMA. Načtení požadavku z RAM a oznámení přijatých dat jsou v základním režimu zahrnuté v ději bez samostatných přenosových kroků, podrobný je zachovává. „Video a zvuk“ označuje obsah přenosu, nikoli hotový signál pro monitor a reproduktory. V kroku 7 CPU načte „Instrukce a data“. Krok 8 zvýrazňuje pouze CPU s popiskem „Příprava přehrávání“: zpracuje přijatá data, dešifruje obsah a připraví video, zvukové vzorky i příkazy. Krok 9 je samostatný zápis CPU → RAM označený „Data a příkazy“. Po oznámení nové práce v kroku 10 si grafika načte „Video a příkazy“ v kroku 11. Dekódování obrazu je samostatný krok 12 se zvýrazněnou pouze grafickou částí a popiskem „Zpracování videa“.

CPU nastaví umístění a formát zvukových dat a spustí zvukovou část. Ta načítá zvukové vzorky z RAM pomocí DMA. V posledním základním kroku 15 současně proudí obrazový a zvukový signál, pohybuje se místní obrázek a pulzují membrány reproduktorů. Přitom dvakrát navazuje server → síťová část → RAM. Nestahuje se nejprve celé video a úvodní požadavek se neopakuje. Ukázka po deseti didaktických sekundách posledního kroku automaticky skončí. SSD v tomto scénáři není aktivní; skutečné video, zvuk, síť ani YouTube API se nepoužívají.

Scénář „Uložení souboru“ začíná otevřeným editorem a rozepsaným dokumentem v RAM. Na SSD je kód editoru, soubor poznamky.txt tam ještě není. Ukázka končí trvalým zápisem do flash, celkem má přesně devět kroků a devět stisků Další krok:

1. Myš → CPU: Kliknutí na Uložit.
2. RAM → CPU: Instrukce a data.
3. Zvýraznění CPU: Příprava souboru.
4. CPU → RAM: Data souboru.
5. CPU → RAM: Požadavek na zápis.
6. CPU → SSD: Oznámení nové práce.
7. RAM → SSD: Požadavek na zápis.
8. RAM → SSD: Data souboru, převzatá řadičem pomocí DMA.
9. Zvýraznění SSD: Zápis do flash.

Po dokončení kroku 4 přibude v RAM položka poznamky.txt, po kroku 5 požadavek na zápis. Po přenosu v kroku 8 se v SSD objeví „Čeká na zápis“, což představuje přijatá data před trvalým uložením. Teprve dokončení kroku 9 změní položku na poznamky.txt. Kopie v RAM, rozepsaný dokument i kód editoru zůstávají zachované. Reset a změna scénáře obnoví výchozí stav bez uloženého souboru.

Přepínač „Cache a registry CPU“ zachovává stejných devět kroků. Při zapnutí čtení v kroku 2 pokračuje do cache uvnitř CPU a při přípravě souboru se zvýrazní i registry s právě používanými hodnotami. Přenos obsahu RAM → SSD probíhá po stejné přímé logické cestě pomocí DMA. Grafická varianta mění podobu hardwaru, ale v tomto scénáři se k ní neposílá nová práce a VRAM zůstává prázdná. Na monitoru je od začátku otevřený editor; po dokončení ukládání nepřidáváme oznámení CPU ani překreslení obrazovky.

Tato didaktická varianta sleduje data až do trvalé paměti SSD. Skutečné aplikace mohou potvrdit uložení už po předání dat systému a fyzický zápis nastane později kvůli vyrovnávacím pamětem; viz [Microsoft – systémová souborová cache](https://learn.microsoft.com/en-us/windows/win32/fileio/file-caching).

V RAM a SSD se zobrazují vybraná data související se scénářem. Prázdná RAM kalkulačky proto znamená, že v ní ještě nejsou její data; nejde o tvrzení, že zapnutý počítač nemá v RAM vůbec nic. Na SSD zůstává „Kód a data kalkulačky“, v RAM postupně přibude požadavek, načtený program, podklady pro obraz a grafické příkazy. U videa už RAM obsahuje kód a data prohlížeče, poté přibude požadavek, přijatá část videa a zvuku, připravené video se zvukovými vzorky a grafické příkazy. Další příjmy aktualizují souhrnnou položku na části 1–2 a 1–3. Čtení ani zobrazení obrazu tento obsah nemaže; kopie programu na SSD zůstává zachovaná. Vyrovnávací paměť se nezobrazuje jako zvláštní dílky či ukazatel zaplnění. Obsah pamětí zůstává viditelný i po skrytí vysvětlení.

U dedikované varianty se po oznámení CPU nejprve načtou grafické příkazy z RAM. Kopírovací část karty pak pomocí DMA přenese obrazové podklady kalkulačky nebo komprimované video do VRAM. GPU je odtud načte a vytvoří hotový obraz, který uloží zpět do VRAM. Zobrazovací část karty z VRAM čte snímek a pak odešle obrazový signál monitoru. Jeden přenos znázorňuje průběžně opakovanou práci; nejde o úplný popis všech grafických front a paměťových přístupů. Příkazy v tomto modelu zůstávají v systémové RAM, nemusí se všechny nejprve kopírovat do VRAM. Instrukce CPU ani zvukové vzorky se do VRAM nepřenášejí.

VRAM začíná s textem „Bez obrazových dat“. Po kopírování obsahuje „Podklady pro obraz“ nebo „Komprimované video“, po zpracování přibude „Obraz okna“ nebo „Obrazové snímky“. U závěrečného videa zůstávají připravené snímky ve VRAM a další přijaté části čekají v RAM. Schéma neukazuje hybridní notebook, v němž může dedikované GPU předávat obraz ještě integrovanému GPU. Základ rozdílu mezi sdílenou RAM a vlastní pamětí popisuje [Intel – integrovaná a dedikovaná grafika](https://www.intel.com/content/www/us/en/support/articles/000057824/graphics.html).

Podrobný režim zachovává rozvedené scénáře: samostatně ukazuje čtení instrukcí a dat, zápisy do RAM, předání grafických příkazů, cache a registry uvnitř CPU. Instrukce CPU se musí načítat v obou úrovních; základní režim je pojmenovává společně s daty, podrobný více rozvádí práci paměťové hierarchie. Cache a registry neznamenají univerzální cestu pro celý proud videa ani uložení celého programu do registru. Data mohou být dostupná v cache a změny se do RAM mohou zapsat později.

Technické podklady: [Intel – integrovaná grafika a sdílená paměť](https://www.intel.com/content/www/us/en/developer/articles/guide/quick-reference-guide-to-intel-processor-graphics.html), [Intel – hardwarové dekódování videa](https://www.intel.com/content/www/us/en/support/articles/000055741/graphics/processor-graphics.html), [SPDK – příkazy NVMe a DMA](https://spdk.io/doc/nvme_spec.html).

## Ověření

Bez závislostí lze spustit `node --test tests/player.test.cjs`. Celkem 52 testů kontroluje všech šestnáct kombinací scénáře, podrobnosti a grafiky, úplné dokončení, shodu krokování a přehrávání, přehrání jednoho kroku s automatickým zastavením, plynulost přenosu přes fáze, zápis paměti až při dokončení přenosu, zachování dat při čtení, pauzu i zrušení starého časovače po resetu a změně scénáře či grafiky. Kontroly dedikované varianty navíc ověřují pořadí příkazů a dat, použití VRAM až po dokončení zápisu, zachování RAM a SSD, nepřítomnost programu a zvuku ve VRAM a shodu krokování s automatikou. Kontroly ukládání ověřují přesných devět kroků, rozlišení přenosu a trvalého zápisu, stav před zápisem i během pauzy, zachování dokumentu v RAM, vyprázdnění VRAM a zrušení rozpracovaného zápisu při resetu. V prohlížeči je třeba také zkontrolovat popisky SVG, ovládání a rozložení na cílovém rozlišení.

Výsledky provedeného ověření jsou v [tests/PROVERENI.md](tests/PROVERENI.md).
