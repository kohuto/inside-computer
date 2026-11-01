# Ověření aplikace

Ověřeno 31. 10. 2026 v prohlížeči Chromium, otevřením `index.html` přímo z disku.

| Varianta | Číslované kroky | Stavy při krokování | Automatické dokončení | Shodné výsledné SVG | Reset |
| --- | ---: | ---: | --- | --- | --- |
| Kalkulačka – základní | 10 | 10 | ano | ano | ano |
| Kalkulačka – podrobné | 16 | 16 | ano | ano | ano |
| YouTube – základní | 15 | 21 | ano | ano | ano |
| YouTube – podrobné | 20 | 20 | ano | ano | ano |

Základní kalkulačka má deset číslovaných kroků a dokončí se deseti stisky tlačítka Další krok. Video má 15 číslovaných kroků. Načtení do GPU a zpracování v GPU jsou nyní samostatné kroky 11 a 12. Jen poslední krok přehrávání zahrnuje vnitřní fáze doplňování dalších dat; při nich se číslo 15 nemění.

Příkaz `node --test tests/player.test.cjs` spouští 20 testů bez závislostí. Všechny prošly. Kontrolují přesné základní počty 10 a 15, předepsané směry a popisky, limit tří slov, samostatné čtení RAM → CPU, zvýraznění pouze CPU bez přenosu a následný zápis CPU → RAM u kalkulačky, zvýraznění pouze CPU a následný zápis CPU → RAM také u videa a návaznost na rozvedené kroky podrobného režimu. Podrobné varianty si zachovaly 16 a 20 kroků a své regresní kontroly.

Test SSD ověřuje v základním režimu požadavek CPU → RAM, oznámení CPU → SSD a přenos SSD → RAM, po kterém teprve CPU načte instrukce a data. Podrobný režim navíc zachovává načtení příkazu SSD z RAM i oznámení dokončení. Test kalkulačky ověřuje přesné pořadí všech deseti kroků a to, že v kroku 6 je aktivní pouze CPU s popiskem „Zpracování“, v kroku 7 tečou podklady a příkazy do RAM a hotové okno se zobrazí až s tokem do monitoru v kroku 10. U základního videa test ověřuje čtení „Instrukce a data“ v kroku 7, zvýraznění pouze CPU „Příprava přehrávání“ v kroku 8 a zápis „Data a příkazy“ v kroku 9. Načtení „Video a příkazy“ v kroku 11 předchází samostatnému kroku 12, ve kterém je aktivní pouze GPU s popiskem „Zpracování videa“.

Závěrečný krok 15 videa má po celou dobu současně obrazový a zvukový výstup. Během nich dvakrát naváže další příjem server → síťová část → RAM; úvodní sekvence se neopakuje. Interní stav přijatých dat při čtení neklesá a při doplnění roste. Grafické dílky vyrovnávací paměti a jejich popisek byly z RAM odstraněny v obou režimech. Plynulá místní animace skončí, nevrací se zpět a nezanechá čekající snímek. CPU zpracovává přijatý obsah a připravuje video i zvuk, grafická část dekóduje obraz a zvuková část načítá hotové vzorky.

Automatické průchody používaly řízený čas stejného přehrávače i stejné SVG jako aplikace. Ve všech čtyřech variantách je výsledné SVG shodné s úplným krokováním. Test porovnává také pořadí všech vnitřních fází, aby krokování nevynechalo souběžné přehrávání a doplňování dat v kroku 15. Po resetu nezůstaly aktivní cesty ani popisky.

V prohlížeči bylo skutečnými ovládacími prvky ověřeno všech 61 číslovaných kroků a 67 stavů při krokování. Počty cest, přesné popisky i počátky a konce šipek odpovídaly stavu přehrávače, včetně zpětných směrů a souběžných přenosů. Datové popisky nepřekrývaly komponenty. Popisky „Zpracování“ a „Příprava přehrávání“ jsou záměrně uvnitř zvýrazněného CPU a nepřekrývají jeho název. Zachována je jednotná barva, plná čára a stejný tvar částic; oznámení a obsah se odlišují textem.

Rozložení prošlo při 763 × 743, 1280 × 720 a 1366 × 701. Okno vizualizace včetně vysvětlení končilo nejpozději na 706 px, 657 px a 701 px. Vzhled zpracování v CPU byl zkontrolován také na snímku obrazovky; také bylo znovu ověřeno, že v kroku 15 současně tečou „Obrazový signál“ a „Zvukový signál“ a běží obraz i vizuální indikátor zvuku. Rozměry komponent a rozmístění se touto změnou neměnily.

Skrytí vysvětlení zachovalo názvy součástí, datové popisky i popisky zvýraznění. Pauza při skutečném přehrávání zmrazila celé SVG se třemi souběžnými cestami, obrazem i indikátorem zvuku. Pokračování navázalo; reset a změna na podrobný režim odstranily předchozí cesty, částice, popisky a naplnění bufferu. Automatické testy navíc kontrolují rušení časovače při změně scénáře a režimu, opakované spuštění a přehrání dokončeného příběhu.

V konzoli nejsou chyby ani varování. Aplikace nadále používá jen lokální HTML, CSS, JavaScript a SVG, bez závislostí, skutečného videa, zvuku či vzdálených služeb. GitHub Pages nebyly publikovány; návod ke spuštění a přidávání scénářů je v README.

Po výtvarné úpravě komponent znovu prošlo všech 20 testů a všech 67 stavů skutečným krokováním v rozlišeních 1280 × 720 a 763 × 743. Šest vnitřních komponent má statické 2D motivy pouzder, čipů, kontaktů a konektorů. Ověřeny byly směry šipek i nezměněné porty, popisky bez kolizí a přepínání motivu CPU na cache a registry v detailu. Statické čipy RAM nepředstavují dříve odstraněné dílky vyrovnávací paměti. Vzhled byl zkontrolován na snímcích celého schématu i aktivní cache; fyzické motivy nepřidávají nové kroky ani nemění tok dat.
