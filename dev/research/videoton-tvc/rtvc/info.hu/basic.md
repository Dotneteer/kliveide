# TVC BASIC referenciakalauz

A Videoton TV-Computer BASIC nyelvének használati útmutatója.

## Tartalomjegyzék

- [Bevezetés](#bevezetes)
- [A program felépítése](#a-program-felepitese)
- [Konstansok, változók és operátorok](#konstansok-valtozok-es-operatorok)
- [Parancsok](#parancsok)
- [Utasítások](#utasitasok)
- [Grafika és hang](#grafika-es-hang)
- [Fájlkezelés](#fajlkezeles)
- [Rendszer és gépi kód](#rendszer-es-gepi-kod)
- [Függvények](#fuggvenyek)
- [Rendszerváltozók](#rendszervaltozok)
- [Függelék](#fuggelek)
  - [Tokenizált programformátum](#tokenizalt-programformatum)

---

## Bevezetés

A TVC BASIC a Microsoft BASIC egy dialektusa, amely a Videoton TV-Computeren
fut. Ez a referencia az összes parancsot, utasítást, függvényt és
rendszerváltozót leírja. Nem programozási tankönyv, hanem tömör segédlet a
BASIC alapjait már ismerők számára.

**Perifériák** azonosítószámai:

| # | Eszköz |
|---|--------|
| 0 | Képernyő |
| 1 | Billentyűzet |
| 2 | Editor |
| 3 | Hanggenerátor |
| 4 | Párhuzamos nyomtató |
| 5 | Kazettás magnetofon / floppy diszk |
| 6 | Bővítő kártya |

A perifériákra `#n` formában lehet hivatkozni az I/O utasításokban (pl.
`PRINT #4:` a nyomtatóhoz).

---

## A program felépítése

A BASIC program sorszámozott sorokból áll:

```
100 REM Ez egy megjegyzés
110 LET A = 5 : PRINT A
```

- A sorszám értéke 1 és 9999 közötti szám lehet.
- Egy sorba több utasítás is írható, ezeket `:` választja el.
- Egy sor maximális hossza 250 karakter.
- A megjegyzés a `REM` kulcsszó után helyezhető el, és az utolsó utasításnak
  kell lennie a sorban.

### Sorszámozási szokások

A sorszám azonosítja a sort a GOTO, GOSUB stb. utasítások számára.
Célszerű a programot ötösével vagy tízesével sorszámozni, hogy utólag
lehessen sorokat beszúrni.

---

## Konstansok, változók és operátorok

### Konstansok

- **Numerikus**: tartomány ±0,1E−63 – ±0,9999999999E+63.
- **String**: idézőjelek `"..."` között, maximum 254 karakter.
  Az idézőjel elhagyható a `DATA` és `INPUT` utasításokban, kivéve ha a
  string vesszőt, felkiáltójelet, kettőspontot vagy vezető szóközt tartalmaz.

### Változók

- A név tartalmazhat betűket, számjegyeket, `?`, `[`, `\`, `]`, `_`, `.`
  karaktereket, és betűvel kell kezdődnie.
- **Numerikus**: nincs típusazonosító.
- **String**: a név `$`-ra végződik.
- A nem dimenzionált string változók maximum 18 karaktert tárolnak; a
  hosszabb stringekhez `DIM` szükséges.

### Tömbök

Deklaráció a `DIM` utasítással. Az első elem indexe mindig 0.

```basic
DIM A(10)       ' numerikus tömb 11 elemmel (0–10)
DIM N$(5)*30    ' string tömb, 6 elem, max. 30 karakter/elem
```

### Operátorok és precedencia

| Szint | Operátorok | Megjegyzés |
|-------|-----------|------------|
| 1 (legmagasabb) | `( )` | Zárójel |
| 2 | `^` | Hatványozás |
| 3 | `*`, `/` | Szorzás, osztás |
| 4 | `+`, `-` | Összeadás, kivonás |
| 5 | `=`, `<>`, `<`, `<=`, `>`, `>=` | Relációs |
| 6 | `NOT` | Bitenkénti negáció |
| 7 | `AND` | Bitenkénti ÉS |
| 8 (legalacsonyabb) | `OR`, `XOR` | Bitenkénti VAGY, KIZÁRÓ VAGY |

Az azonos szintű műveletek balról jobbra hajtódnak végre.

---

## Parancsok

A parancsok sorszám nélkül, közvetlen végrehajtásra kerülnek.

### NEW

```
NEW
```

Aktuális program törlése a memóriából. Kikapcsolja a TRACE-t.

### RUN

```
RUN [sorszám]
```

Program indítása. Sorszám nélkül a legkisebb sorszámú sortól indul. Törli
az összes változót és függvénydefiníciót.

### LIST

```
LIST [szegmensek] | LIST [#periféria:] [szegmensek]
```

Program (vagy megadott szegmensek) listázása a képernyőre vagy perifériára.

`szegmensek` példák: `50`, `100-200`, `50, 100-200, 600-`.

Szünet: CTRL-P; folytatás bármely billentyűvel.

### LLIST

```
LLIST [szegmensek] | LLIST [#periféria:] [szegmensek]
```

Mint a LIST, de a kimenet a nyomtatóra kerül.

### DELETE

```
DELETE szegmensek
```

Sor(ok) törlése a programból. Megszakítás: CTRL-ESC.

Példák:
```
DELETE 100        ' 100-as sor törlése
DELETE 100-200    ' 100–200 sorok törlése
DELETE 100-200,540,600-  ' tartományok és egyes sorok törlése
```

### TRACE

```
TRACE [#periféria:] ON | TRACE [#periféria:] OFF
```

Programnyomkövetés be-/kikapcsolása. BE állapotban minden végrehajtott sor
sorszáma kiíródik a megadott perifériára (alapértelmezés: képernyő).

### CONTINUE

```
CONTINUE
```

Program folytatása `STOP` vagy CTRL-ESC utáni megszakítás után. Nem
használható szintaktikai/szemantikai hiba, programmódosítás, `END` vagy
`DELETE` után.

---

## Utasítások

### LET

```
LET változó = kifejezés
```

Értékadás változónak, tömbelemnek vagy rész-stringnek. A `LET` kulcsszó
elhagyható. Többszörös értékadás (pl. `A = B = C = 2`) nem megengedett.

Példák:
```basic
10 LET A = 625 : LET B = A/5
20 LET KUTYA$ = "PULI"
50 LET ADATTÖMB(2,1) = 3
60 LET NEVEK$(0:0) = "KISS"
```

Rész-string értékadás: `LET A$(m:n) = "szöveg"`, ahol `m` és `n` a kezdő- és
végpozíció (1-től számozva). Üres string (`""`) törli a tartományt.

### CLS

```
CLS
```

Képernyő törlése, kurzor a bal felső pozícióba. A háttérszínt a `SET PAPER`
beállítása határozza meg.

### PRINT

```
PRINT [paraméterek:] [elem [[,|;|TAB(n)] elem]...]
```

A paraméterek vesszővel válnak el, és a kiírandó elemek előtt kettőspont kell:

```
#n
AT sor, oszlop
USING formátum$
```

Példák:

```
PRINT "hello"
PRINT AT 10,5: "hello"
PRINT AT 1,1: A; TAB(10); B
PRINT AT 1,64: "X";
PRINT USING "###.###": 1
PRINT #4: A,B,C$
PRINT #0, AT 24,1, USING "##": N
```

- `AT sor, oszlop` — kurzorpozíció. A sor 1–24. Az oszlop 1-től indul, és a
  `GRAPHICS` módtól függ: 64 a 2 színű, 32 a 4 színű, 16 a 16 színű módban.
  Az `AT` és a `TAB` a 0, 2 és 6 perifériákon hat. A `PRINT AT 1,1` a bal
  felső karakter.
- `USING formátum$` — formázott kiírás (lásd alább).
- `,` (vessző) az elemlistában — következő tabulációs mező (8 karakter).
- `;` (pontosvessző) — nincs hézag az elemek között.
- `TAB(n)` — következő elem az n. oszlopban.
- Záró `,` vagy `;` csak a PRINT saját CR/LF-jét (`0DH`/`0AH`) nyomja el. Az
  utolsó oszlopba írás után a szerkesztő akkor is a következő sorra lép, és ha
  az a sor nem üres, üres sort szúr be. Erre nincs PRINT-szintaxis. Kerülőút:
  a `0E6BH` (3691) szerkesztő-szélesség bájt ideiglenes növelése a kiírás
  idejére (`POKE 3691,65` / `POKE 3691,64` GRAPHICS 2-ben). A `PRINT #0` a
  videóeszközt használja, ezért nem szúr be szerkesztősort, de a grafikus
  tollat az utolsó oszlop után akkor is CR/LF-ezi.
- Paraméter nélküli `PRINT` a következő sor elejére visz.

**PRINT USING formátumkarakterek:**

| Formátum | Hatás |
|--------|-------|
| `#` | Számjegy helyőrző |
| `.` | Tizedespont |
| `^^^^` | Tudományos formátum |
| `$` | Dollárjel |
| `+` | Előjel kényszerítése |
| `-` | Utójel mínusz negatívoknál |
| `*` | Vezető kitöltés `*`-gal |
| `%` | Vezető kitöltés `0`-val |
| `<` | Balra igazított string |
| `>` | Jobbra igazított string |

### LPRINT

```
LPRINT [AT sor, oszlop] [, USING formátum$]: [elem [[,|;|TAB(n)] elem]...]
```

Mint a `PRINT`, de a kimenet a nyomtatóra kerül (megegyezik a `PRINT #4:`-gyel).
Az `AT` és a `USING` után itt is kettőspont kell az elemlista előtt.

### INPUT

```
INPUT [PROMPT "szöveg":] változó [, változó...]
INPUT #periféria: változó [, változó...]
```

Adatok beolvasása a billentyűzetről (alapértelmezés) vagy nyitott fájlból.
A `PROMPT` szó után szöveg adható, amely kiíródik a képernyőre. A bevitelt a
RETURN billentyű zárja le.

- Numerikus változók: számjegyek, `+`, `-`, `.`, `E`.
- String változók: 32–223 kódú karakterek; idézőjel csak akkor kell, ha
  a string vezető szóközt, `!` jelet vagy vesszőt tartalmaz.
- Hibás formátum esetén a numerikus változó 0, a string változó `""` értéket kap.
- Ha több változó van, mint adat, a többlet 0-t vagy `""`-t kap.
- Megszakítás: CTRL-ESC; folytatás: `CONTINUE`.

### INKEY$

```
A$ = INKEY$
```

A legutóbb lenyomott, még be nem olvasott billentyű karakterét adja
egykarakteres stringként, vagy `""`-t, ha nincs karakter. Az `INPUT-tól
eltérően nem vár, nem jelzi ki a karaktert, és minden kódot (0–255) elfogad.

### GET

```
GET [#periféria:] string-változó
```

Egy karakter beolvasása a billentyűzetről (alapértelmezés) vagy nyitott
fájlból. Fájl végén `""`-t ad vissza.

### REM

```
REM megjegyzés szövege
```

Megjegyzés elhelyezése a programban. Végrehajtáskor figyelmen kívül marad.

### IF — THEN — ELSE

```
IF feltétel THEN utasítás(ok) | sorszám [ELSE utasítás(ok) | sorszám]
```

Ha a feltétel igaz (nem nulla), a THEN ág hajtódik végre; egyébként az ELSE
ág (ha van), vagy a következő soron folytatódik a végrehajtás.

Csak az első `ELSE` érvényesül egy sorban — egymásba ágyazott IF-THEN-ELSE
egy sorban nem támogatott.

### FOR — NEXT

```
FOR ciklusváltozó = kezdőérték TO végérték [STEP lépésköz]
...
NEXT [változó [, változó...]]
```

A ciklusmag a ciklusváltozó minden értékénél egyszer hajtódik végre,
a kezdőértéktől a végértékig a lépésköz szerint haladva (alapértelmezett
lépésköz +1). A ciklus legalább egyszer lefut. Ciklusok egymásba ágyazhatók.
Egy `NEXT` több egymásba ágyazott ciklust is lezárhat:

```
NEXT J, I   ' belső J, majd külső I ciklus zárása
```

### DATA

```
DATA konstans [, konstans...]
```

Numerikus vagy string konstansok elhelyezése a programban. Az adatokat a
`READ` utasítás olvassa ki. Stringeknél idézőjel csak akkor kell, ha a
string vesszőt, `!`, `:` jelet vagy vezető szóközt tartalmaz. Több `DATA`
utasítás logikai láncot alkot.

### READ

```
READ változó [, változó...]
```

A `DATA` lánc következő értékének beolvasása a változó(k)ba. A változó
típusának meg kell egyeznie a konstans típusával. Elfogyott adat esetén:
`*** No DATA`.

### RESTORE

```
RESTORE [sorszám]
```

Az adatmutató visszaállítása a program elejére (vagy a megadott sorszámú
`DATA` utasításra), lehetővé téve az adatok újbóli beolvasását.

### STOP

```
STOP
```

Program végrehajtásának megszakítása, BASIC parancs módba lépés. Folytatható
a `CONTINUE` paranccsal.

### END

```
END
```

A program logikai végét jelzi. Ha a fizikai vége egybeesik a logikai
végével, az `END` elhagyható.

### DIM

```
DIM változó(dim1 [, dim2...]) [, változó(dim2...)]...
DIM string-változó(dim1...) * max-hossz
```

Memória foglalása tömbök számára. Az elemek 0 (numerikus) vagy `""` (string)
kezdőértéket kapnak. Már létező tömb újradimenzionálása:
`*** Variable declared twice`.

Az opcionális `* max-hossz` megadja a string tömb maximális elemehosszát
(alapértelmezés: 18). Numerikus tömb dimenziószámát csak a 250 karakteres
sorhossz korlátozza.

### GOTO

```
GOTO sorszám
```

Feltétel nélküli ugrás a megadott sorszámú sorra. Törekedj a GOSUB használatára
az áttekinthetőbb kód érdekében.

### GOSUB — RETURN

```
GOSUB sorszám
...
RETURN
```

Szubrutin hívása a megadott sorszámról. A `RETURN` a hívás utáni utasításon
folytatja a végrehajtást. Szubrutinok egymásba ágyazhatók (rekurzió is
lehetséges). `RETURN` előzetes `GOSUB` nélkül hibát okoz.

### ON — GOTO / ON — GOSUB

```
ON kifejezés GOTO sor1 [, sor2...] [ELSE utasítás | sor]
ON kifejezés GOSUB sor1 [, sor2...] [ELSE utasítás | sor]
```

A kifejezés értéke kijelöli a listából a megfelelő sorszámot (1-től kezdve).
Ha az érték 0 vagy nagyobb, mint a listaelemek száma, az ELSE ág (ha van)
hajtódik végre, vagy a következő sor.

---

## Grafika és hang

### GRAPHICS

```
GRAPHICS üzemmód
```

Grafikus üzemmód kiválasztása. Az `üzemmód` a színek száma (2, 4 vagy 16).

| Üzemmód | Karakter/sor | Grafikus képpont/sor | Képpont/oszlop |
|---------|--------------|----------------------|----------------|
| 2 színű | 64 | 512 | 240 |
| 4 színű | 32 | 256 | 240 |
| 16 színű | 16 | 128 | 240 |

Alapértelmezés a 4 színű mód. A képernyő 24 sorból áll. Új üzemmód
beállításakor a színek alaphelyzetbe állnak és a képernyő törlődik.

### PLOT

```
PLOT x, y [; x, y...] [, PAINT]
```

Rajzolás logikai koordinátákkal (960 x 1024). A rendszer az aktuális
GRAPHICS üzemmódnak megfelelő fizikai koordinátákra konvertál.

- `,` (vessző) — toll felemelése (mozgás rajzolás nélkül)
- `;` (pontosvessző) — toll leengedése (vonal húzása)
- `PAINT` — zárt alakzat kifestése az aktuális INK színnel

Sarokkoordináták: (0,0) bal alsó, (1023,959) jobb felső.

### SET

```
SET paraméter [, érték...]
```

Színek, vonaltípusok, karakterdefiníciók és billentyűzet-időzítés beállítása.

**SET PALETTE** — Paletta színeinek kiválasztása (2 és 4 színű módban).
```
SET PALETTE palettakód0, palettakód1 [, palettakód2, palettakód3]
```

**SET INK színsorszám** — Rajzolás (tinta) színe.
**SET PAPER színsorszám** — Háttérszín.
**SET BORDER palettakód** — Képernyő keretszíne (minden módban működik).
**SET STYLE vonaltípus-sorszám** — Vonal típusa PLOT-hoz.
**SET MODE móduszám** — Képpont felülírási mód (0=felülírás, 1=VAGY, 2=ÉS, 3=XOR).
**SET CHARACTER ascii-kód, sor0, sor1, ... sor9** — Felhasználói karakter
definiálása 10 sor x 8 bit pontmátrixként (decimális bájtértékekkel).
**SET RATE időállandó** — Auto-repeat sebesség (időállandó/50 másodperc).
**SET DELAY időállandó** — Auto-repeat indulása előtti késleltetés
(időállandó/50 másodperc).

### SOUND

```
SOUND [;] [PITCH hangmagasság] [VOLUME hangerő] [DURATION időtartam] ...
```

Hang előállítása. `;` az előző hang befejeződésére vár. Paraméterek
ismételhetők több hang lejátszásához.

- `PITCH`: 0–4094 (97656 Hz – ~48 Hz), 4095 = szünet.
  Frekvencia = 195312,5 / (4096 * pitch). Középső C (~261 Hz) = pitch 3349.
- `VOLUME`: 0 (csend) – 15 (maximum). Alapértelmezés: 8.
- `DURATION`: 0–255 (egy egység = 1/50 másodperc). Alapértelmezés: 100 (2 mp).

Ha egy paraméter elmarad, az előző hang értéke használódik.

---

## Fájlkezelés

### OPEN

```
OPEN "fájlnév"
OPEN INPUT "fájlnév"
OPEN OUTPUT "fájlnév"
OPEN #periféria: [INPUT | OUTPUT] "fájlnév"
```

Fájl megnyitása olvasásra (`INPUT`, alapértelmezés) vagy írásra (`OUTPUT`).
Az alapértelmezett eszköz a #5 (kazetta/floppy). Floppy rendszeren a meghajtó-
és útvonal szintaxis használható (lásd [vt-dos.md](vt-dos.md)).

### CLOSE

```
CLOSE [INPUT | OUTPUT] | CLOSE #periféria: [INPUT | OUTPUT]
```

Korábban megnyitott fájl bezárása.

### LOAD

```
LOAD ["fájlnév"] | LOAD #periféria: "fájlnév"
```

Program betöltése kazettáról, diszkről vagy bővítő kártyáról. Az aktuális
program és szimbólumtábla törlődik. Ha nincs fájlnév megadva, az első
megtalált program töltődik be.

### SAVE

```
SAVE "fájlnév" | SAVE #periféria: "fájlnév"
```

Aktuális program mentése kazettára, diszkre vagy bővítő egységre bináris
belső formátumban.

### VERIFY

```
VERIFY ["fájlnév"] | VERIFY #periféria: "fájlnév"
```

A memóriában lévő program összehasonlítása a megadott fájllal a mentés
helyességének ellenőrzésére.

---

## Rendszer és gépi kód

### EXT

```
EXT alszám [, HL-érték, DE-érték, BC-érték]
```

Felhasználói gépi kódú szubrutin hívása. `alszám` 0–6, az USRTAB táblázat
bejegyzését választja ki. A HL, DE, BC értékek a processzor regisztereibe
kerülnek. A szubrutint `RET` utasítással kell befejezni.

### LOMEM

```
LOMEM cím
```

A BASIC programterület kezdőcímének áthelyezése, felszabadítva a memóriát
gépi kódú rutinok számára. Minden változó törlődik. Az alapértelmezett
kezdőcímet a VLOMEM rendszerváltozó (5920) tárolja. A NEW és LOAD
visszaállítják az alapértelmezett címet, de a VLOMEM POKE-kal történő
módosítása megvédi a rutinokat a LOAD során.

### OUT

```
OUT port, érték
```

Egy bájt kiírása egy hardver I/O portra. A portcímek és portfunkciók
ismeretét igényli. Használata körültekintést igényel — hibás értékek
összeomlaszthatják a rendszert.

### POKE

```
POKE cím, érték
```

Egy bájt írása egy memóriacímre. Ha a cím a BASIC ROM területre mutat,
a video RAM kerül kiválasztásra. Rendszerváltozók módosítására vagy gépi kód
elhelyezésére használható.

### USR

```
eredmény = USR(cím [, param])
```

Gépi kódú szubrutin hívása a megadott címen. `param` a HL regiszterpárba
kerül a hívás előtt. Az eredmény a HL regiszterpár végső tartalma előjeles
egészként értelmezve.

---

## Függvények

A függvények listája szintaxissal. `X` numerikus, `X$` string kifejezést
jelöl.

### Numerikus függvények

| Függvény | Eredmény |
|----------|----------|
| `ABS(X)` | X abszolút értéke |
| `ATN(X)` | X arkusz tangense (radiánban) |
| `COS(X)` | X koszinusza (radiánban) |
| `EXP(X)` | e^X |
| `FREE` | Szabad RAM bájtok száma |
| `IN(port)` | I/O port beolvasása |
| `INT(X)` | X-nél nem nagyobb egész szám |
| `LOG(X)` | X természetes logaritmusa (X > 0) |
| `ORD(X$)` | X$ első karakterének ASCII kódja |
| `PEEK(cím)` | Memóriacella tartalma (ROM cím esetén video RAM) |
| `PI` | π konstans (3,141592654) |
| `RND` | Véletlen szám [0, 1) tartományban |
| `RND(X)` | Véletlen egész szám [0, X−1] tartományban |
| `SIN(X)` | X szinusza (radiánban) |
| `SGN(X)` | X előjele (−1, 0 vagy +1) |
| `SQR(X)` | X négyzetgyöke (X ≥ 0) |
| `TAN(X)` | X tangense (radiánban) |
| `VAL(X$)` | X$-ból kiolvasott numerikus érték |
| `VARPTR(változó)` | A változó memóriacíme |
| `VERNUM` | BASIC interpreter verziószáma |

### String függvények

| Függvény | Eredmény |
|----------|----------|
| `CHR$(X)` | Egykarakteres string az X ASCII kódhoz (0–255) |
| `LEN(X$)` | X$ karaktereinek száma |
| `STR$(X)` | X szám string reprezentációja |
| `STRING$(n, X)` | n darab CHR$(X) karakterből álló string |
| `STRING$(n, X$)` | n darab X$ első karakteréből álló string |

### RANDOMIZE

```
RANDOMIZE
```

A véletlenszám-generátor kezdőértékének véletlenszerű beállítása. Használata
biztosítja, hogy minden futtatás más RND sorozatot adjon.

---

## Rendszerváltozók

A rendszerváltozók `PEEK` és `POKE` segítségével érhetők el. Fontosabb
címek:

| Név | Cím | Bájt | Funkció |
|-----|-----|------|---------|
| USRTAB | 33 (21H) | 14 | EXT szubrutin címek táblázata (7 bejegyzés x 2 bájt) |
| STOPFL | 2838 (B16H) | 1 | ≠0 ha CTRL-ESC-t nyomtak |
| HIMEM | 2841 (B19H) | 2 | Legmagasabb RAM cím |
| P3RAM | 2843 (B1BH) | 1 | 0 = RAM 3. lap jó; FF = hiba |
| INTINC | 2845 (B1DH) | 2 | Számláló, 20 ms-onként nő |
| COLD FLAG | 2850 (B22H) | 1 | 0 = WARM RESET engedélyezve; FF = tiltva |
| MODE | 2891 (B4BH) | 1 | Grafikus pont felülírási mód (0–3) |
| STYLE | 2892 (B4CH) | 1 | Vonaltípus PLOT-hoz |
| INK | 2893 (B4DH) | 1 | Aktuális tintaszín |
| PAPER | 2894 (B4EH) | 1 | Aktuális papírszín |
| BORDER | 2895 (B4FH) | 1 | Keretszín palettakódja |
| VFLAG | 2896 (B50H) | 1 | Karakter felülírási jelző |
| PICTURE | 2897 (B51H) | 10 | Utoljára beolvasott billentyű mátrixa |
| DELAYKEY | 2917 (B65H) | 1 | Auto-repeat késleltetés |
| LOCK KEY | 2918 (B66H) | 1 | CTRL/SHIFT/ALT lock állapot |
| RATEKEY | 2919 (B67H) | 1 | Auto-repeat időzítés |
| HOLD DIS | 2920 (B68H) | 1 | 0 = HOLD engedélyezve; FF = tiltva |
| EOF | 2926 (B6EH) | 1 | ≠0 = fájl vége |
| AUTO | 5895 (1707H) | 1 | 255 = automatikus indítás LOAD után |
| TYPE | 5896 (1708H) | 1 | Szimbólumtábla aktuális elemének típusa |
| START | 5900 (170CH) | 2 | Aktuális BASIC sor kezdőcíme |
| VLOMEM | 5920 (1720H) | 2 | BASIC programterület kezdőcíme |
| TEXT | 5922 (1722H) | 2 | BASIC program kezdőcíme |
| CHAIN | 5924 (1724H) | 2 | Szimbólumtábla utolsó elemének címe |
| TOP | 5926 (1726H) | 2 | Következő szabad bájt a szimbólumtáblában |
| COMMAND | 5938 (1732H) | 255 | Aktuális BASIC utasítássor puffere |
| BUFFER | 6193 (1831H) | 255 | Billentyűzet bemeneti puffer |
| FILENAME | 6606 (19CEH) | 17 | Fájlnév puffer (1 bájt hossz + 16 név) |
| PROGRAM | 6639 (19EFH) |  | Program előre definiált kezdete |

---

## Függelék

### Tokenizált programformátum

A TVC BASIC a programot hossz-prefixelt sorokként tárolja a
[PROGRAM](#rendszervaltozok) (`19EFH`) címen. Egy sor felépítése:

```text
hossz     1 bájt   a sor mérete, a hosszbájttal és az FFH lezáróval együtt
sorszám   2 bájt   sorszám, little-endian
tokenek   n bájt   tokenizált utasításszöveg
FFH       1 bájt   sor vége
```

A programot egy `00H` hosszbájt zárja. A kulcsszavak és operátorok a BASIC 1.2
kulcsszótábla (SYS `DE6DH`) egybájtos tokenjei; a keresés a `FEH` tokentől
lefelé halad, ezért a hosszabb szavak (például `OUTPUT`) az `OUT` előtt
illeszkednek. A stringeken, valamint a `REM`/`!`/`DATA` farokrészen kívül a
betűk nagybetűsen tárolódnak. A szóközök, a string literálok és a `REM` vagy
`DATA` utasítás maradéka karakterként marad. A nem idézőjelek közötti
kettőspont lezárja a `DATA` utasítást, és újraindítja a tokenizálást;
a `REM` és a `!` a sor teljes hátralévő részét változatlanul hagyja. A kulcsszótáblában nem szereplő
függvények, például `USR`, `SIN` és `CHR$`, ASCII azonosítók maradnak.

Az `rtvc-basic` számozott forrást fordít erre a payloadra, és CAS tárolóba
csomagolja. A 42 256 bájtnál nagyobb programokat (a lezáró `00H` bájttal együtt)
elutasítja. Ez a foglalások nélküli 64K TVC BASIC 1.2 felső határa:
`BFFFH` HIMEM mínusz `19EFH` programkezdet mínusz az `FC8EH` ROM-rutin
által megkövetelt `0100H` tartalék. Az üres program is tartalmaz egy
`00H` lezáróbájtot, ezért indításkor **42 255 szabad bájt** jelenik meg.
A program, a változók, a tömbök és a
BASIC verem közös RAM-ot használnak, ezért a mérethatár betartása önmagában
nem garantálja a futtathatóságot. Kisebb gép, a HIMEM-et csökkentő DOS vagy
más foglalás, illetve magasabb LOMEM tovább csökkenti a helyet; a fordító
a szabványos 64K memóriakiosztást feltételezi.
Az alapértelmezett fejléc a BASIC `SAVE` mentésnek felel meg
(fájltípus `01H`, autostart `00H`). Az `rtvc-tocas` ugyanezt a CAS képet a
forrás mellé írja:

```bash
rtvc-basic coding/crtc-register-explorer.bas -o target/coding/crtc-register-explorer.cas
rtvc-tocas coding/crtc-register-explorer.bas
```

A `--auto` a CAS autostart bájtot állítja; a `--format bin` fejléc nélküli
nyers programbájtokat ír. A parancssori opciókat az
[rtvc.md](rtvc.md#command-line-basic-compiler) ismerteti.

### Színsorszámok és palettakódok

| Színsorszám | Palettakód | Szín |
|:---:|:---:|---|
| 0 | 0 | Fekete |
| 1 | 1 | Sötétkék |
| 2 | 4 | Sötétvörös |
| 3 | 5 | Sötétlila |
| 4 | 16 | Sötétzöld |
| 5 | 17 | Sötét cián |
| 6 | 20 | Sötétsárga |
| 7 | 21 | Szürke |
| 8 | 64 | Fekete (világos) |
| 9 | 65 | Kék |
| 10 | 68 | Vörös |
| 11 | 69 | Lila |
| 12 | 80 | Zöld |
| 13 | 81 | Cián |
| 14 | 84 | Sárga |
| 15 | 85 | Fehér |

Palettakód bitek: 7. bit = intenzitás, 4. bit = zöld, 2. bit = vörös, 0. bit = kék.

### Vonaltípusok

| STYLE | Minta |
|:---:|---|
| 1 | Folyamatos |
| 2–15 | Különböző szaggatott minták |

### Példaprogram: másodfokú egyenlet

```basic
100 INPUT PROMPT "Együtthatók: ":a,b,c
110 d = b^2 - 4*a*c
120 IF d < 0 THEN PRINT "Nincs valós gyök" : GOTO 100
130 ds = SQR(d)
140 x1 = (-b + ds) / (2*a)
150 x2 = (-b - ds) / (2*a)
160 PRINT x1, x2
```

### Példaprogram: szinuszgörbe

```basic
10 GRAPHICS 4
20 SET PAPER 0 : SET BORDER 4 : SET INK 3
30 PLOT 0,120 ; 255,120
40 PLOT 19,239 ; 19,0
50 SET INK 1
60 FOR I = 0 TO 2*PI STEP 0.02
70   PLOT 19+(30+I),120+(120+SIN(I));
80 NEXT I
```

### Származtatott matematikai függvények

| Függvény | BASIC kifejezés |
|----------|-----------------|
| Szekáns | `1 / COS(X)` |
| Koszekáns | `1 / SIN(X)` |
| Kotangens | `1 / TAN(X)` |
 | Arkusz szinusz | `ATN(X / SQR(1 - X*X))` |
| Arkusz koszinusz | `ATN(SQR(1 - X*X) / X)` |
| Hiperbolikus szinusz | `(EXP(X) - EXP(-X)) / 2` |
| Hiperbolikus koszinusz | `(EXP(X) + EXP(-X)) / 2` |
| Hiperbolikus tangens | `(EXP(X) - EXP(-X)) / (EXP(X) + EXP(-X))` |
| 10-es alapú logaritmus | `LOG(X) / LOG(10)` |
| N-edik hatvány | `EXP(N * LOG(X))` |
