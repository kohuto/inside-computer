# Ověření aplikace

Ověřeno 2. 11. 2026 v prohlížeči Chromium, otevřením `index.html` přímo z disku.

## Čip s UEFI

Flash čip je viditelný ve všech šestnácti variantách, obsahuje stálou položku „Firmware UEFI“ a je logicky připojený k CPU. Středové porty i návaznost nové trasy na viditelný podklad ověřuje rozšířená kontrola geometrie. Při kalkulačce, videu a ukládání čip zůstává neaktivní. Při startu je čtený CPU; uložený obsah se nemění. Označení napájení se skrývá a zobrazuje se společnou vrstvou energie. Znovu prošlo všech 48 testů a prohlížečová kontrola 10 865 poloh, včetně kolizí s názvem, uloženým firmwarem a popiskem nového čipu.

## Přehled scénářů

| Varianta | Číslované kroky | Stisky Další krok z výchozího stavu | Automatické dokončení | Shodné výsledné SVG | Reset |
| --- | ---: | ---: | --- | --- | --- |
| Kalkulačka – integrovaná, základní | 10 | 10 | ano | ano | ano |
| Kalkulačka – integrovaná, podrobné | 16 | 16 | ano | ano | ano |
| YouTube – integrovaná, základní | 15 | 21 | ano | ano | ano |
| YouTube – integrovaná, podrobné | 20 | 20 | ano | ano | ano |
| Kalkulačka – dedikovaná, základní | 14 | 14 | ano | ano | ano |
| Kalkulačka – dedikovaná, podrobné | 19 | 19 | ano | ano | ano |
| YouTube – dedikovaná, základní | 19 | 25 | ano | ano | ano |
| YouTube – dedikovaná, podrobné | 24 | 24 | ano | ano | ano |
| Uložení souboru – integrovaná, bez cache | 9 | 9 | ano | ano | ano |
| Uložení souboru – integrovaná, cache | 9 | 9 | ano | ano | ano |
| Uložení souboru – dedikovaná, bez cache | 9 | 9 | ano | ano | ano |
| Uložení souboru – dedikovaná, cache | 9 | 9 | ano | ano | ano |
| Zapnutí – integrovaná, bez cache | 18 | 18 | ano | ano | ano |
| Zapnutí – integrovaná, cache | 18 | 18 | ano | ano | ano |
| Zapnutí – dedikovaná, bez cache | 22 | 22 | ano | ano | ano |
| Zapnutí – dedikovaná, cache | 22 | 22 | ano | ano | ano |

## Pohyb dat

Každý přenos má jednu pohyblivou značku se štítkem. Značka projde celou orientovanou SVG trasu od zdroje do cíle, včetně opačných směrů a zaoblené cesty SSD–RAM. Štítek ji doprovází a zůstává vodorovný. U vstupu do cache se zastaví před CPU, aby nezakrýval vnitřní detail; značka pokračuje po trase do cache. Popisky samotného zpracování v CPU, GPU a SSD zůstávají statické. U portu RAM zůstává štítek přenosu SSD ↔ RAM pod blokem paměti, aby nezakryl uložená data ani při jejich větším počtu.

Kontrola ve skutečném SVG prošla všech 253 číslovaných kroků a 265 fází ve všech šestnácti kombinacích scénáře, podrobnosti a grafiky. Celkem zkontrolovala 10 865 poloh (41 vzorků na fázi): značka ležela na příslušné orientované cestě, štítky zůstaly uvnitř SVG a nepřekrývaly názvy komponent, cache ani registrů. Všechna data používají stejnou barvu, plnou čáru a stejnou animaci. Automatické i krokované přehrání skončily ve shodném výsledném SVG.

V závěrečném kroku základního videa pokračují obrazový a zvukový signál plynule přes všechny fáze. Při přidání dalšího přenosu se nevracejí na začátek. Dvakrát navazuje další příjem server → síťová část → RAM; každá nová zpráva absolvuje svou vlastní cestu. Současně běží místní animace na monitoru a vizuální indikátor zvuku. Ukázka se sama ukončí.

## Ovládání a rozložení

Skutečným tlačítkem Další krok bylo ověřeno spuštění značky u myši, její dojezd k CPU a automatické zastavení na konci prvního kroku. Další stisk zahájil druhý krok. Rozpracovaný přenos se při krokování nejprve dokončí. Vnitřní fáze závěrečného videa se přehrávají jednotlivě, se zachováním čísla 15 u integrované a 19 u dedikované grafiky.

Pauza zmrazila celé SVG a po čekání se nezměnila ani značka, ani její štítek. Pokračování navázalo. Reset i změna scénáře nebo úrovně odstranily předchozí zprávy a zrušily čekající snímek animace. Skrytí vysvětlení ponechalo pohyblivé datové štítky viditelné.

Vzhled byl zkontrolován na snímcích při 763 × 743 a 1280 × 720, včetně vstupu do cache a souběžných tří přenosů videa. Po přidání volby grafiky končilo okno včetně nejdelšího vysvětlení nejpozději na 727 px, respektive 684 px. RAM a SSD jsou vyšší, aby obsahovaly čitelné datové položky. Jejich středové porty zůstaly ve stejné výšce, pro vlastní VRAM pod GPU se rozšířila spodní část schématu a myš se posunula níže mimo počítač. Po následném zjednodušení jsou paměti plochými bloky s uloženým obsahem; samostatné dílky vyrovnávací paměti se nevrátily.

## Automatické testy

Příkaz `node --test tests/player.test.cjs` spouští 48 testů bez závislostí. Všechny prošly. Kontrolují definice, přesné základní sekvence, směry přenosů, návaznost základního a podrobného režimu, dokončení všech scénářů, shodu krokování s automatikou, pauzu, reset a přepnutí scénáře i režimu. Nové kontroly ověřují animované krokování s automatickým zastavením, opakované stisky bez přeskoku, pauzu přímo na začátku fáze, plynulý postup signálů přes změny fází a plnou cestu každé nově přijaté části dat.

V konzoli nejsou chyby ani varování. Aplikace nadále používá jen lokální HTML, CSS, JavaScript a SVG; nevyžaduje sestavení, skutečné video, zvuk ani vzdálené služby.

## Uložený obsah RAM a SSD

V obou režimech kalkulačky je na začátku v SSD kód a data kalkulačky, RAM nemá její data a zobrazuje „Bez dat kalkulačky“. Po dokončení zápisů v RAM postupně přibude požadavek, kód a data programu, obrazové podklady a grafické příkazy. V obou režimech videa už RAM i SSD obsahují kód a data prohlížeče; v RAM poté přibude požadavek, přijatý obsah, připravené video a zvukové vzorky a příkazy pro grafiku. Další příjem aktualizuje přijaté části na 1–2 a 1–3. Zobrazení se týká dat vybraného scénáře.

Nové testy ověřují stav před zápisem, v průběhu přenosu i po dojezdu, zachování obsahu při pauze a čtení, nezměněnou kopii na SSD, příchod dalších částí videa až na konci příslušné fáze a odstranění starého obsahu při resetu nebo přepnutí scénáře. Automatika a krokování dávají shodný obsah pamětí. Změna vráceného snímku nemění definice scénářů ani následné snímky.

Prohlížečová kontrola všech 10 865 vzorků navíc porovnala texty v RAM, SSD a u dedikované grafiky i VRAM se stavem přehrávače, ověřila, že se položky vejdou do bloků, a zahrnula je do kontroly kolizí s pohyblivými zprávami. Nebyly zjištěny přesahy ani kolize.

## Přepínač vysvětlení pod vizualizací

Přepínač je součástí spodní oblasti vizualizace, v postranním nastavení už není. Po otevření stránky je vypnutý a v dolní oblasti je vidět pouze přepínač. Zapnutí zobrazí aktuální číslo kroku, průběhový proužek, titulek a vysvětlení; vypnutí celou tuto část opět skryje. Schéma, jeho popisky a uložený obsah pamětí zůstávají viditelné.

V prohlížeči při 1010 × 858 a 763 × 743 bylo ověřeno výchozí vypnutí, rozbalení a sbalení. Přepnutí během pozastaveného přenosu nezměnilo SVG ani jeho průběh a zobrazilo vysvětlení právě aktuálního kroku. Změna scénáře nebo režimu zachovala zvolený stav přepínače a aktualizovala texty. V konzoli nebyly chyby ani varování.

## Vizualizace přes celou šířku

Nastavení činnosti a podrobnosti je vždy nad oknem vizualizace. Na šířkách 390, 763, 1010, 1280, 1366, 1920 a 2560 px bylo změřeno, že okno vyplňuje šířku stránky mezi jejími krajními odsazeními. Žádný postranní sloupec ani omezení maximální šířky nezůstaly. Nastavení je na širších displejích vedle sebe, na telefonu pod sebou.

Na kontrolovaných notebookových a desktopových rozlišeních 763 × 743, 1010 × 858, 1280 × 720, 1366 × 768, 1920 × 1080 a 2560 × 1440 zůstalo okno s ovládáním a vysvětlením ve výšce obrazovky. Schéma zachovává poměr stran a omezuje výšku podle dostupného místa. Při 390 × 844 nevznikl vodorovný posun celé stránky; úzké schéma lze nadále posouvat uvnitř jeho okna.

Po úpravě bylo skutečnými ovládacími prvky znovu ověřeno přepnutí obou scénářů a režimů, pohyb dat, pozastavení a reset. Přepínač vysvětlení zůstává pod vizualizací a po načtení je vypnutý. V konzoli nejsou chyby ani varování.

## Integrovaná a dedikovaná grafika

Výchozí volba je Integrovaná. Grafický blok používá systémovou RAM a není označený jako samostatná karta. Dedikovaná volba zobrazí ohraničenou kartu s GPU a vlastní VRAM, včetně větve RAM–VRAM a vnitřní obousměrně používané cesty GPU–VRAM. Všechny nové porty jsou ve středech stran a animace sledují viditelné podkladové spoje. Barva a styl přenosů zůstaly jednotné.

U kalkulačky a videa se ve všech čtyřech dedikovaných kombinacích nejprve načtou příkazy z RAM, potom se obrazová data zkopírují do VRAM, GPU je načte a vytvoří hotový obraz ve VRAM. Zobrazovací část jej přečte před odesláním monitoru. Programy CPU ani zvukové vzorky se do VRAM neukládají. Příjem sítě a zvuková část nadále používají RAM; SSD se při videu neaktivuje. Nové přípravné kroky mají nejvýše jeden přenos a základní popisky nejvýše tři slova.

Testy kontrolují prázdnou VRAM před zápisem, neměnný obsah v průběhu přenosu, uložení až při dojezdu, zachování kopie v RAM a SSD, nemazání při čtení a shodu automatického a krokovaného přehrání. Přepnutí během rozpracovaného zápisu GPU–VRAM zruší časovač a obnoví výchozí stav. Zvolený scénář a podrobnost se zachovají.

Skutečnými ovládacími prvky v prohlížeči bylo ověřeno přepnutí grafiky, obou scénářů a podrobnosti, krokování, pauza, reset i zachování přepínače vysvětlení. Integrovaná varianta skryje kartu, VRAM i její čáry; návrat na dedikovanou začíná s prázdnou VRAM a správným počtem kroků. Konzole je bez chyb a varování.

Rozložení bylo zkontrolováno na 390, 763, 1010, 1280, 1366, 1920 a 2560 px. Nevznikl vodorovný posun celé stránky a vizualizace dál vyplňuje dostupnou šířku. Při 1010 × 858 končí i nejdelší vysvětlení nejpozději na 814 px. Na telefonu zůstává vnitřní posun schématu a běžný svislý posun stránky.

## Zdroj, zásuvka a napájení – 2. 11. 2026

Zdroj je pod SSD uvnitř počítače a zásuvka pod ním mimo počítač. Byl ověřen přívod do středu spodní strany zdroje a výstup DC ze středu pravé strany. Po zjednodušení má blok zdroje jen název „Zdroj“. Střídavých 230 V je popsaných vedle zásuvky; stejnosměrné výstupy 12 V, 5 V a 3,3 V nad výstupní cestou vně zdroje. Vlny, napěťové značky a zkratka PSU byly odstraněné. Napájení čipů dále upravují měniče na desce či kartě; informace je také v přístupném popisu schématu a titulku zdroje.

Zlatá vrstva obsahuje společně znázorněný obvodový rozvod a blesky u napájených komponent, bez dalších čar ke každému bloku. Pro integrovanou grafiku je vidět sedm vnitřních značek včetně UEFI a u běžících aplikací také myš s údajem 5 V z USB; u dedikované přibude VRAM. Monitor, reproduktory a server se nezapojují na zdroj počítače. Napájení je přítomné i u součástí, které se právě neúčastní datového přenosu.

Ve všech osmi kombinacích scénáře, grafiky a zobrazení cache bylo ověřeno zapnutí a skrytí vrstvy, zachování viditelnosti zdroje, zásuvky a převodu i po skrytí zvýraznění, zachování volby při resetu a shodná geometrie datových spojů. Přepnutí vrstvy během pauzy nezměnilo pohyblivé zprávy ani jejich polohu. Samostatný test chrání umístění nových komponent, středové porty, oddělení napájení od datových tras a nepřítomnost křížení AC a DC.

Opakovaná prohlížečová kontrola 10 865 poloh všech přenosů prošla bez přesahů a bez kolizí datových štítků s názvy komponent, paměťovým obsahem i novými popisky napětí a napájení. Automatické a krokované přehrání dávají shodné SVG; reset odstraní animaci; u běžících aplikací ponechá napájení, u startu hlavní napájení opět vypne. Všech 48 testů prošlo. Konzole je bez chyb a varování.

Na šířkách 390, 763, 1010, 1280, 1366, 1920 a 2560 px nebyl zjištěn vodorovný posun celé stránky. Na ověřených počítačových rozlišeních zůstává i nejdelší vysvětlení ve výšce obrazovky; na telefonu se přepínače zalomí a stránka se běžně posouvá svisle.

## Uložení souboru – 2. 11. 2026

Třetí volba obsahuje devět dohodnutých kroků. Po přenosu RAM → SSD následuje pouze zvýraznění SSD „Zápis do flash“. Uložení už nepokračuje oznámením CPU ani přípravou grafického výstupu. Editor s rozepsaným dokumentem je na monitoru od výchozího stavu a jeho obraz zůstává zachovaný.

Ve všech čtyřech kombinacích grafiky a zobrazení cache je počet číslovaných kroků i stisků Další krok roven devíti. Zapnutí cache vede čtení do cache uvnitř CPU a při přípravě zvýrazní také registry; nepřidává fáze ani další kroky. Nové přípravné přenosy mají vždy nejvýše jednu zprávu. Síť, zvuk a grafická část se neúčastní ukládání; u dedikované karty zůstává VRAM prázdná. Napájecí vrstva zůstává zachovaná.

Výchozí RAM obsahuje kód a data editoru a rozepsaný dokument, SSD pouze kód editoru. Po dokončení čtvrtého kroku přibude v RAM poznamky.txt a po pátém požadavek na zápis. Přenos v kroku 8 uloží do modelu SSD položku „Čeká na zápis“. Během posledního kroku zůstává rozpracovaná a název poznamky.txt dostane až po jeho dokončení. RAM stále obsahuje připravený soubor i původní dokument; kód editoru zůstává na SSD.

Pět nových testů ukládání kontroluje všechny čtyři kombinace, pauzu uprostřed každého zápisu, neměnný obsah pamětí před dokončením kroku, shodu automatiky a krokování, zrušení rozpracovaného zápisu do flash a obnovení výchozího stavu po přepnutí scénáře. Dva další obecné testy nově zahrnují celý průběh třetího scénáře. Všech 48 testů prošlo.

Skutečné ovládací prvky aplikace byly ověřeny také s řízeným časem requestAnimationFrame: devět kliknutí, zastavení po každém kroku, stav po přenosu a po trvalém zápisu, zakázání Dalšího kroku na konci, opětovné přehrání, pauza, reset, změna scénáře a přepínání napájecí vrstvy. Po kontrole byl obnoven běžný prohlížečový časovač.

Kontrola 10 865 poloh všech šestnácti variant nenašla přesahy ani kolize pohyblivých a statických popisků s názvy, paměťovým obsahem, převodem napětí a editorem. Čtyři karty scénářů se při 763–1150 px skládají vedle sebe nad oběma dalšími přepínači, při 1151–1499 px tvoří mřížku 2 × 2 vedle nastavení cache a grafiky. Na širokém displeji jsou v jednom řádku a na telefonu ve dvou řadách. Na šířkách 390, 763, 1010, 1280, 1366, 1920 a 2560 px nevznikl vodorovný posun celé stránky. Na ověřených počítačových rozlišeních se i nejdelší vysvětlení vešlo do výšky obrazovky.


## Zapnutí počítače – 2. 11. 2026

Čtvrtá volba má 18 kroků s integrovanou a 22 s dedikovanou grafikou; přepínač cache počet kroků nemění. Výchozí stav ukazuje vypínač místo myši, černý monitor, nepřipravenou RAM, firmware ve flash a zavaděč i systém na SSD. Hlavní napájení se objeví po stisku vypínače. Inicializace RAM a přechody CPU mezi firmwarem, zavaděčem a systémem nastanou až při dokončení příslušných kroků. Přihlášení se zobrazí až po dokončení posledního obrazového přenosu.

Ve všech čtyřech kombinacích byl skutečnými ovládacími prvky ověřen automatický průběh, pauza, pokračování, zachování polohy zprávy při přepnutí napájecí vrstvy a reset do vypnutého stavu. Integrovaná varianta byla navíc celá prošlá osmnácti stisky Další krok. Přepnutí na ukládání obnovilo myš a skrylo označení softwaru CPU; návrat na start vyprázdnil RAM a vypnul hlavní napájení. Pět dalších testů chrání dokončení inicializace, čtení a obrazového výstupu, postupné zápisy, neměnné SSD, zrušení rozpracovaného kroku i obnovu výchozího stavu.

Kontrola všech 16 variant prošla 10 865 poloh bez kolizí či přesahů, včetně nové cesty UEFI → CPU, popisku napájení a softwaru CPU. Automatika a krokování dávají shodné SVG. Na kontrolovaných počítačových rozlišeních se i nejdelší vysvětlení vešlo do okna: 763 × 743 (spodní okraj 727 px), 1010 × 858 (840 px), 1280 × 720 (699 px), 1366 × 768 (729 px), 1920 × 1080 (1062 px) a 2560 × 1440 (1387 px). Telefon 390 × 844 zachovává vnitřní posun schématu bez vodorovného posunu celé stránky.

## Zjednodušení grafiky komponent

Odstraněny dekorativní čipy, vývody, kontakty, plošné spoje, konektory, pixelové vzory a ventilátor zdroje. Zachovány názvy, uložený obsah, volitelné cache a registry, znázornění převodu napětí i indikátory napájení a aktivity. Rozměry komponent, porty a datové cesty zůstaly zachované. V prohlížeči ověřen jednoduchý základní vzhled i zobrazení cache, dedikované karty a VRAM. Všech 48 testů a kontrola 10 865 poloh všech 16 variant prošly bez chyb, přesahů a kolizí popisků.

## Vnější popisky napětí zdroje

Zdroj má kompaktní blok 160 × 60 jednotek SVG a pouze název „Zdroj“. Zkratka PSU a vnitřní značky převodu napětí byly odstraněné. Popisek „Střídavé (AC) / 230 V“ je vedle zásuvky; „Stejnosměrné (DC) / 12 V · 5 V · 3,3 V“ je nad výstupní napájecí cestou mimo zdroj. Napájecí spoje se přizpůsobily jeho středovým portům. Ověřeno, že všechny údaje leží vně bloku a zůstávají viditelné i při skrytí napájecí vrstvy. Před zapnutím hlavního napájení je výstupní popisek ztlumený. Všech 48 testů i kontrola 10 865 poloh všech scénářů prošly bez kolizí a přesahů.


## Jednoduché přepínače cache a grafiky

Původní dvojice tlačítek nahradily dva nativní checkboxy s rolí přepínače: „Cache a registry“ a „Dedikovaná grafika“. Výchozí stav je u obou vypnutý, tedy bez cache a registrů a s integrovanou grafikou. U všech čtyř scénářů byly ověřeny všechny kombinace, správné počty kroků, viditelnost cache a VRAM, zachování druhé volby i zachování nastavení při resetu a změně scénáře. Přepnutí za běhu zastaví animaci, odstraní zprávy a obnoví výchozí stav. Všech 48 testů prošlo.


## RAM zobrazuje pouze aktuální obsah – 4. 11. 2026

RAM už nezobrazuje narůstající seznam položek. Po dokončení načtení kalkulačky se požadavek nahradí kódem a daty, po přípravě obrazu podklady a příkazy. Podrobný režim přepíná mezi příkazy a obrazovými podklady; video při čtení zvuku ukazuje zvukové vzorky. Uložení souboru po čtení požadavku zobrazí přenášený soubor a start počítače postupně nahradí zavaděč částmi systému. Jde o výběr zobrazovaného obsahu, úplný model paměti zůstává zachovaný pro pozdější čtení.

Čtyři nové testy ověřují nejvýše jednu zobrazenou položku ve všech 16 variantách, návaznost zápisu až po dojezdu, zvolený obsah při čtení, zachování při pauze, neměnný model paměti, reset a shodu automatiky s krokováním. Všech 52 testů prošlo. Opakovaná prohlížečová kontrola 10 865 poloh všech 16 variant porovnala obsah vykreslených pamětí s `displayMemory` a neodhalila přesahy ani kolize.

## Čitelnější uložený obsah – 4. 11. 2026

Obsah pamětí využívá celou vyhrazenou plochu pod názvem komponenty. RAM používá písmo až 24 jednotek SVG místo původních 16; SSD a VRAM až 20 a UEFI 24. Písmo je tmavší a tučnější, podklad bílý s výraznějším okrajem. Více položek si rozděluje dostupnou výšku a velikost písma se upraví podle změřených rozměrů zalomeného textu. Prázdný stav má přerušovaný rámeček. Rozměry komponent a porty se nemění.

Všech 52 testů prošlo. Prohlížečová kontrola všech 16 variant a 10 865 poloh ověřila obsah podle `displayMemory`, text uvnitř jeho plochy, návaznost animací, pauzu, reset a shodu automatiky s krokováním. Žádné přesahy ani kolize s datovými popisky nebyly zjištěné. Vizuálně ověřeno načtení kalkulačky při 1010 × 858 a dvě položky VRAM při 728 × 743; stránka nemá vodorovný přesah. Konzole je bez chyb a varování.
