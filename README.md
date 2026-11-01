# Uvnitř počítače

Statická vzdělávací aplikace v češtině pro 9. třídu ZŠ a 2. ročník SŠ. Ukazuje spolupráci hardwaru při spuštění kalkulačky a přehrávání videa. Používá čisté HTML, CSS, JavaScript a SVG; nemá závislosti, sestavování, externí požadavky, skutečné video ani zvuk.

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

Tlačítka přehrávání, krokování a návratu na začátek jsou v pravém horním rohu okna vizualizace vedle názvu scénáře. V úzkém okně se zarovnají doprava pod název, aby nepřekrývala schéma.

- Vyberte činnost a režim **Základní / Podrobné**. Změna vždy vrátí scénář do výchozího stavu.
- **Spustit / Pozastavit / Pokračovat** ovládá celý děj včetně částic, obrazu na monitoru a indikátoru zvuku. Po dokončení lze ukázku přehrát znovu.
- **Další krok** zastaví automatické přehrávání a ukáže dokončený následující krok. U kroků s vnitřními fázemi postupuje po těchto fázích: například při přehrávání ukáže příjem a potom uložení další části dat. Číslo kroku přitom zůstává stejné. **Pokračovat** naváže další fází nebo krokem; z výchozího stavu krokování zobrazí první krok.
- **Od začátku** vymaže průběh, pohyby i obsah monitoru a obnoví výchozí stav aktuálního scénáře.
- Animace běží stálou rychlostí. Vypnutí **Zobrazit vysvětlení** úplně skryje text aktuálního kroku, ale zachová názvy komponent a datové popisky.
- Při přechodu na jinou kartu se děj pozastaví. Na úzkém telefonu lze schéma vodorovně posunout; hlavní rozhraní je určené pro notebook a promítání.

## Organizace kódu a další scénáře

| Soubor | Účel |
| --- | --- |
| `index.html` | Struktura rozhraní, bez vložených scénářů. |
| `styles.css` | Vzhled, čitelnost, responzivní rozložení a SVG styly. |
| `js/scenarios.js` | Obsah, výchozí stavy a kroky všech scénářů. |
| `js/diagram.js` | Společné SVG, logické trasy, částice a vizuální stavy. |
| `js/player.js` | Nezávislý přehrávač s jediným časem, pauzou, krokováním a resetem. |
| `js/app.js` | Napojení přehrávače na ovládací prvky. |

Nový scénář přidejte do `HWLab.scenarios` v `js/scenarios.js`. Výběr se vytvoří automaticky. Definujte `id`, `title`, `shortTitle`, `subtitle`, `icon`, `diagram`, `initial` a funkci `createSteps(detailed)`. Ta vrací pole kroků. `flows` může obsahovat jeden přenos, souběžné přenosy nebo být prázdné při společném zvýraznění komponent. Základní varianty jsou ve funkcích `calcBasic()` a `youtubeBasic()`, podrobné v `calc(true)` a `youtube(true)`. Obě úrovně popisují stejný příběh; základní odděluje hlavní přenosy a zpracování v CPU, podrobná navíc rozvádí dílčí příkazy, cache a registry. Nastavení `diagram.server` zapíná vzdálený server a jeho spojení; vnitřní propojení síťové části jsou viditelná stále. RAM má podobu plochého paměťového modulu se statickými čipy a kontakty; vyrovnávací paměť se samostatně nekreslí.

```js
{
  id: 'vlastni-scenar',
  title: 'Název činnosti',
  shortTitle: 'Krátký název',
  subtitle: 'Popis činnosti',
  icon: 'calculator',
  diagram: { server: false },
  initial: { title: 'Výchozí stav', description: 'Co už je připraveno.',
    screen: 'desktop', buffer: 0, playback: false, ramLoaded: false },
  createSteps: detailed => [
    {
      id: 'prvni-krok', title: 'Titulek kroku', description: 'Jedna až dvě věty.',
      duration: 3000, active: ['ssd', 'ram'],
      flows: [{ route: 'ssdRam', type: 'data', label: 'kód a data' }],
      effects: { ramLoaded: true }
    }
  ]
}
```

`active` a `flows` platí pouze v daném kroku. Všechny přenosy používají stejnou plnou čáru, barvu a animované šipky; význam určuje textový popisek. Barvu společně nastavuje `--flow` v `styles.css`. Pole `type` v definici zůstává obsahovým označením, neovlivňuje vzhled. Přenos může mít `reverse: true`, čímž se obrátí jeho směr po stejné trase, včetně koncové šipky a částic. Například `{ route: 'ramCpu', type: 'data', label: 'zápis dat', reverse: true }` představuje zápis CPU → RAM. `effects` se skládají od výchozího stavu přes všechny dosud dosažené kroky. Výchozí stav proto vždy uveďte úplný. Přehrávač při resetu neobnovuje starý DOM, ale znovu odvodí čistý stav. Použitelné identifikátory součástí jsou `mouse`, `cpu`, `ram`, `ssd`, `gpu`, `network`, `audio`, `monitor`, `speakers`, `server`, a v detailu `cache`, `registers`.

Přípravný krok může mít `active: ['cpu', 'ram']`, `flows: []` a `highlights: [{ target: 'cpuRam', label: 'Příprava přehrávání' }]`. Cíl `cpu` umisťuje popisek dovnitř CPU a cíl `gpu` pod grafickou část. Polohy těchto popisků nastavuje `activityPositions` ve vykreslovači. Popisky zpráv a zvýraznění základního režimu mají nejvýše tři slova.

Volitelné `phases` rozděluje tentýž číslovaný krok. Každá fáze má `at` (začátek jako podíl celkové délky kroku, první musí být 0) a může přepsat `active`, `flows`, `highlights` a přidat `effects`. Například v posledním kroku videa od času 0 běží oba výstupy, od času 0,18 přibude příjem ze serveru a od času 0,36 zápis do RAM. Neuvedené vizuální údaje fáze přebírá ze základní definice kroku; efekty se skládají přes dosažené fáze. Všechny fáze, částice a výstupy používají jediný čas přehrávače, takže se společně pozastaví a resetují.

Rozmístění je definované v `layout.nodes` v `js/diagram.js`. Funkce `port(id, side)` určuje střed zvolené strany komponenty (`top`, `bottom`, `left`, `right`). Logické trasy a polohy popisků jsou v `routes`; trasa může mít více bodů a parametr `radius` pro zaoblené rohy. `connections` obsahuje jednotlivé čáry podkladu: společné úseky se vykreslují pouze jednou, i když je používá více logických tras. Nová trasa musí sledovat tyto úseky; nový fyzicky zobrazený spoj přidejte také do `connections`. Opačný přenos například z RAM na SSD může využít `ssdRam` s `reverse: true`. Popisky se automaticky zalamují podle skutečné šířky textu a nastavení `labelWidth`.

Nový obsah monitoru se přidává do stejného vykreslovače, bez změny přehrávače. Efekty `playbackFrom` a `playbackTo` určují rozsah lokální animace videa v daném kroku (0–3 pro tuto krátkou ukázku). Přehrávač mezi nimi postupuje podle času kroku. `playback` zapíná obrazovou ukázku a `soundPlaying` vizuální indikátor zvuku. V základním režimu zapíná krok `playback` obraz a zvuk zároveň. Jeho vnitřní fáze ponechávají oba výstupy aktivní a postupně přidávají příjem server → síťová část → RAM, bez opakování celé úvodní sekvence. Podrobný režim ponechává své rozvedené kroky `image-output` a `sound-output`. Pauza zastaví jejich společný čas a reset obnoví oba výstupy.

RAM je umístěná nad CPU, SSD vlevo na úrovni středu CPU. V pravém sloupci jsou shora síťové rozhraní, zvuková část a grafická část. Spoje vycházejí ze středů stran. Mezi RAM, CPU a pravým sloupcem vede společná svislá cesta s odbočkami; SSD–RAM má zaoblený ohyb. CPU a RAM navíc spojuje přímá obousměrně používaná cesta. V detailu její pokračování obchází nadpis procesoru a vstupuje do cache uvnitř CPU. Myš je pod procesorem mimo hranici počítače. Vpravo mimo počítač jsou reproduktory nad monitorem a u videa ještě vzdálený server nad reproduktory. Vnitřní propojení zůstávají viditelná i v neaktivním stavu.

Vzhled součástí doplňují ploché SVG motivy v `componentArt`: pouzdro CPU s vývody, paměťové čipy a kontakty RAM, modul SSD, síťový konektor, zvukový výstup a grafický čip. Jde o statickou výtvarnou podobu komponent. Čipy na RAM nejsou ukazatelem naplnění. V podrobném režimu nahradí motiv křemíku uvnitř CPU čitelné bloky cache a registrů. Grafická a zvuková část nadále označují funkční části počítače; rozměry a logické porty všech bloků zůstávají zachované. Motivy mají `aria-hidden`, aby nepřidávaly obsah k přístupným názvům součástí.

Plocha SVG má rozměry `1320 × 680`. Rozšíření využívá větší svislé rozestupy a volné místo vlevo; rozměry komponent se nemění. Hranice počítače je definovaná v `layout.boundary`. Výška SVG se odvozuje od jeho poměru stran, takže širší či vyšší prostor není dosažen zvětšením bloků.

## Technický model

Čas je didakticky zpomalený a spojnice vyjadřují logickou komunikaci, nikoli přesné fyzické zapojení sběrnic. Jde o jeden možný model s integrovanou grafikou a společnou systémovou RAM. Grafika a zvuk jsou funkční části, nikoli nutně rozšiřující karty. Operační systém a ovladače nevystupují jako další komponenty; jejich činnost je zahrnuta v práci CPU.

| Scénář | Základní režim | Podrobný režim |
| --- | ---: | ---: |
| Spuštění kalkulačky | 10 kroků | 16 kroků |
| Video na YouTube | 15 kroků | 20 kroků |

Kalkulačka začíná kliknutím, potřebné části jejího programu dosud nejsou v RAM. CPU připraví příkaz pro NVMe SSD v RAM a oznámí novou práci SSD. V základním režimu následuje rovnou animace přenosu kódu a dat z SSD do RAM pomocí DMA. Načtení příkazu řadičem a oznámení dokončení jsou v této úrovni zahrnuté v ději bez samostatných kroků; podrobný režim je nadále ukazuje jednotlivě. Oznámení zjednodušeně shrnuje informace o dokončení a upozornění CPU; interní fronty a stavové záznamy nekreslíme. Výpočetní jádra CPU nemusí jednotlivé bajty přenosu kopírovat. Přenos SSD ↔ RAM přitom používá rozhraní a řadiče; šipka neznamená samostatný fyzický vodič mezi SSD a paměťovým modulem.

Základní kalkulačka má přesně deset kroků i deset stisků tlačítka Další krok. V kroku 5 načte CPU z RAM „Instrukce a data“. Krok 6 zvýrazní pouze CPU s popiskem „Zpracování“ a bez přenosové šipky. Krok 7 zapíše z CPU do RAM „Podklady a příkazy“. Po oznámení nové práce grafické části v kroku 8 následuje jejich načtení RAM → grafická část v kroku 9, během něhož se připraví obraz. Až krok 10 odešle „Obrazový signál“ a zobrazí hotovou kalkulačku na monitoru. Závěrečný krok kalkulačky nemá další vnitřní fázi.

U videa jsou prohlížeč i YouTube již otevřené. CPU připraví požadavek v RAM a oznámí novou práci síťové části; ta požadavek odešle serveru a zapíše přijatý obsah do RAM pomocí DMA. Načtení požadavku z RAM a oznámení přijatých dat jsou v základním režimu zahrnuté v ději bez samostatných přenosových kroků, podrobný je zachovává. „Video a zvuk“ označuje obsah přenosu, nikoli hotový signál pro monitor a reproduktory. V kroku 7 CPU načte „Instrukce a data“. Krok 8 zvýrazňuje pouze CPU s popiskem „Příprava přehrávání“: zpracuje přijatá data, dešifruje obsah a připraví video, zvukové vzorky i příkazy. Krok 9 je samostatný zápis CPU → RAM označený „Data a příkazy“. Po oznámení nové práce v kroku 10 si grafika načte „Video a příkazy“ v kroku 11. Dekódování obrazu je samostatný krok 12 se zvýrazněnou pouze grafickou částí a popiskem „Zpracování videa“.

CPU nastaví umístění a formát zvukových dat a spustí zvukovou část. Ta načítá zvukové vzorky z RAM pomocí DMA. V posledním základním kroku 15 současně proudí obrazový a zvukový signál, pohybuje se místní obrázek a pulzují membrány reproduktorů. Přitom dvakrát navazuje server → síťová část → RAM. Nestahuje se nejprve celé video a úvodní požadavek se neopakuje. Ukázka po deseti didaktických sekundách posledního kroku automaticky skončí. SSD v tomto scénáři není aktivní; skutečné video, zvuk, síť ani YouTube API se nepoužívají.

Čtení data v RAM nemaže. Vyrovnávací paměť je součástí RAM a není znázorněná samostatným popiskem ani dílky. Interní stav přijatých dat při čtení neklesá a při doplňování přibývá. V reálném přehrávači může být obsah později znovu využit či přepsán, ale to není důsledek samotného čtení.

Podrobný režim zachovává rozvedené scénáře: samostatně ukazuje čtení instrukcí a dat, zápisy do RAM, předání grafických příkazů, cache a registry uvnitř CPU. Instrukce CPU se musí načítat v obou úrovních; základní režim je pojmenovává společně s daty, podrobný více rozvádí práci paměťové hierarchie. Cache a registry neznamenají univerzální cestu pro celý proud videa ani uložení celého programu do registru. Data mohou být dostupná v cache a změny se do RAM mohou zapsat později.

Technické podklady: [Intel – integrovaná grafika a sdílená paměť](https://www.intel.com/content/www/us/en/developer/articles/guide/quick-reference-guide-to-intel-processor-graphics.html), [Intel – hardwarové dekódování videa](https://www.intel.com/content/www/us/en/support/articles/000055741/graphics/processor-graphics.html), [SPDK – příkazy NVMe a DMA](https://spdk.io/doc/nvme_spec.html).

## Ověření

Bez závislostí lze spustit `node --test tests/player.test.cjs`. Testy kontrolují všechny čtyři varianty scénářů, úplné dokončení, shodu krokování a přehrávání, pauzu i zrušení starého časovače po resetu a změně scénáře. V prohlížeči je třeba také zkontrolovat popisky SVG, ovládání a rozložení na cílovém rozlišení.

Výsledky provedeného ověření jsou v [tests/PROVERENI.md](tests/PROVERENI.md).
