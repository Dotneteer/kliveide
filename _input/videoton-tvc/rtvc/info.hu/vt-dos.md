# VT-DOS kompatibilis floppy diszkes rendszer

Használati útmutató a Videoton TV-Computer floppy diszkes kiegészítőjéhez.

## Tartalomjegyzék

- [Bevezetés](#bevezetes)
- [Üzembe helyezés és kezelés](#uzembe-helyezes-es-kezeles)
- [Használat a BASIC-ből](#hasznalat-a-basic-bol)
- [A BASIC CLI](#a-basic-cli)
- [Parancsok](#parancsok)
- [Kazetta és floppy együttes használata](#kazetta-es-floppy-egyueltes-hasznalata)

---

## Bevezetés

A TV-Computer alapkiépítésben adatok és programok tárolására magnókazetta
szolgál. A floppy diszkes kiegészítő berendezés gyorsabb, nagyobb kapacitású
tárolást biztosít.

A rendszer a következő egységekből épül fel:

- **Floppy csatoló kártya** (HBF kártya), amely bármely bővítő kártyahelyre
  tehető.
- **Nagykapacitású mini floppy periféria** — egy- vagy kétmeghajtós (duál)
  5,25 inch-es egység. Egy lemezre 720 KB (737 280 bájt) írható.

Kétféle TVC floppy csatoló létezik:

- **UPM kompatibilis** — az eredeti UPM lemezformátumot használja.
- **VT-DOS kompatibilis** — MS-DOS kompatibilis lemezformátumot használ a
  VT-DOS fájlkezelővel (FISH). Jelen leírás ezt a típust ismerteti.

A VT-DOS kompatibilis csatoló lehetővé teszi a diszkes háttértár használatát
BASIC alól, VT-DOS operációs rendszer modul nélkül is. Ha a VT-DOS programmodul
rendelkezésre áll, a CP/M 2.2 rendszer alá írt programok is futtathatók a
fájlszerkezet `CONVERT` paranccsal történő átalakítása után.

Egy TVC-ben egyszerre csak egy floppy csatoló képes helyesen működni.

---

## Üzembe helyezés és kezelés

### Fizikai telepítés

1. A TVC **kikapcsolt** állapotában helyezd az interfész kártyát a TVC egy
   bővítő kártyahelyébe.
2. Csatlakoztasd a floppy egység szalagkábelét az interfész kártyához.
3. Kapcsold be a TVC-t.
4. Kapcsold be a floppy egységet.
5. Helyezd a lemezt a meghajtóba úgy, hogy a címke jobb oldalra nézzen, majd
   rögzítsd a zárszerkezettel.

### Meghajtók azonosítása

Kétmeghajtós (duál) egységnél a meghajtók azonosítása:

| Fizikai | Logikai | Elhelyezkedés |
|---------|---------|---------------|
| 0. egység | A: | Bal oldali meghajtó |
| 1. egység | B: | Jobb oldali meghajtó |

### A floppy lemez kezelése

- Használat után tedd vissza a lemezt a védőtasakba.
- Tartsd távol mindenféle mágneses anyagtól.
- A védőborítékra ne írj; használj címkéket.
- Ne érintsd meg a hordozó felületét.
- Védd a hőtől, napsugárzástól, portól.
- Ne gyűrd, ne hajlítgasd a lemezt.

---

## Használat a BASIC-ből

A floppy automatikusan helyettesíti a kazettát, így a szokásos BASIC kazettás
utasítások változtatás nélkül használhatók. Lehetőség van meghajtóbetűjel és
könyvtárút megadására is.

### Program betöltése

```basic
LOAD"CY\*"         ' első CY kezdetű fájl az aktuális könyvtárban
LOAD"B:CYRUS"      ' CYRUS betöltése a B: meghajtóról
LOAD"B:CYRUS.CAS"  ' ugyanaz, explicit kiegészítéssel
LOAD"B:\KONY\CYRUS" ' CYRUS a B: meghajtó \KONY könyvtárából
```

### Program mentése

```basic
SAVE"PROG1"           ' mentés PROG1.CAS néven az aktuális meghajtóra
SAVE"B:\KONY\PROG1"  ' mentés a B:\KONY\PROG1.CAS fájlba
```

### Ellenőrzés

```basic
VERIFY"B:\KONY\PROG1.CAS"
```

### Adatfájl megnyitása

```basic
OPEN "NEV"          ' megnyitás olvasásra
OPEN OUTPUT "NEV"   ' megnyitás írásra
```

Ugyanaz a meghajtó- és útvonal szintaxis használható, mint a LOAD/SAVE
utasításoknál.

### Példa: adatírás

```basic
100 OPEN OUTPUT "ADATOK"
110 FOR I=0 TO 19
120 PRINT #5: B(I)
130 NEXT
140 CLOSE OUTPUT
```

### Példa: adatolvasás

```basic
200 DIM C(19)
210 OPEN "ADATOK"
220 FOR I=0 TO 19
230 INPUT #5: C(I)
240 NEXT
250 CLOSE
```

### BASIC hibakódok

Hiba esetén a rendszer kiírja:

```
***System error XXX
```

| Kód | Jelentés |
|-----|----------|
| 128 | Nem létező fájl (OPEN hiba) |
| 129 | Fájl létrehozási hiba |
| 131 | CLOSE hiba |
| 132 | Írási hiba |
| 133 | Olvasási hiba |
| 230 | Védett fájl másolási kísérlete |
| 231 | Belső hiba — érvénytelen fájltípus |
| 232 | Ellenőrzési (VERIFY) hiba |
| 233 | Nincs nyitott fájl |
| 235 | Túl sok nyitott fájl |
| 236 | Fájl vége |
| 239 | Érvénytelen fájlnév |
| 245 | Stop billentyű (CTRL-ESC) a konzolról |

---

## A BASIC CLI

A BASIC CLI (Command Line Interpreter) diszkes és könyvtárkezelő parancsokat
biztosít, melyek a BASIC-ből közvetlenül használhatók.

### Indítás és kilépés

- Belépés: `EXT2`
- Visszatérés a BASIC-be: **ESC** billentyű.
- A BASIC program és a változók érintetlenek maradnak a CLI használata során.

A CLI promptot (általában meghajtóbetűjelet) mutat. A parancsok a MOPS-nál
megszokott módon gépelhetők be. Hibák esetén:

```
***Unrecognised command
***Error XXX
```

### Jelölések

| Jelölés | Jelentés |
|---------|----------|
| **NAGYBETŰ** | Kulcsszavak (kis- és nagybetű nem számít) |
| *kisbetű* | Helyettesítendő paraméterek |
| `[ ]` | Nem kötelező elemek (a zárójeleket nem kell begépelni) |
| `I` | Választás a lehetőségek között |

### Paramétertípusok

**`d:`** — Meghajtónév (`A:` – `D:`). Ha elmarad, az alapértelmezett
(bejegyzett) meghajtó érvényes. A bejegyzett meghajtó megváltoztatásához gépeld
be a meghajtóbetűjelet kettősponttal, pl. `B:`.

**`path`** — Könyvtárút, az elemeket `\` választja el. A kezdő `\` a
gyökérkönyvtártól indulást jelenti; egyébként az elérés az aktuális
könyvtárhoz képest relatív. `..` a szülőkönyvtárat, `.` az aktuális könyvtárat
jelöli. A `\` helyett használható a `!` és a `'` is.

**`filename`** — Fájlnév `mainname.ext` formában:
- `mainname`: 1–8 karakter
- `.ext`: opcionális, 1–3 karakter
- `?` és `*` helyettesítő karakterek (`?` = egy karakter, `*` = tetszőleges
  karaktersorozat). A helyettesítő karaktereket tartalmazó fájlnevek
  **többértelműek**.

**`filespec`** — Fájlmegadás: `[d:] [path] [filename]`. A három részből
legalább egyet meg kell adni.

**`volname`** — Kötetnév, legfeljebb 11 karakter. Szóközöket és a
fájlnevekben nem engedélyezett karaktereket is tartalmazhat (kivéve a
vezérlőkódokat és a `\` jelet).

**`device`** — Eszköz:
- `CON:` — Konzol (billentyűzet/képernyő)
- `PRN:` — Párhuzamos nyomtató
- `AUX:` — RS-232 soros interfész
- `NUL:` — Üres eszköz (eldobja a kimenetet, fájl végét jelez olvasáskor)

**`number`** — Előjel nélküli egész szám 0–255 között.

A paramétereket szóköz vagy TAB választja el. Az opciók `/` jellel kezdődnek.

---

## Parancsok

### CD / CHDIR

Az aktuális könyvtár megjelenítése vagy megváltoztatása.

```
CHDIR [d:] [path]
CD    [d:] [path]
```

Útvonal nélkül a megadott (vagy implicit) meghajtó aktuális könyvtárát írja ki.
Útvonallal megváltoztatja az aktuális könyvtárat.

Példák:
```
CHDIR \BOOT\RAMDISK
CHDIR A:UTIL
CD
CHDIR A:
```

### CLS

Képernyő törlése.

```
CLS
```

### COPY

Fájlok vagy eszközadatok másolása.

```
COPY forrás [/A] [/H] [cél [/A] [/T]]
```

`forrás` és `cél` lehet `filespec` vagy `device`. `/A` ASCII mód (CTRL-Z-ig
olvas/ír). `/H` rejtett fájlokat is figyelembe vesz. `/T` az aktuális
dátumot/időt használja a célfájlnál.

Példák:
```
COPY FRED B:
COPY A:\BOOT\AUTOEXEC.BAT B:\
COPY A:\BOOT B:\BOOT
COPY *.TXT PRN:
```

### DATE

Rendszerdátum megjelenítése vagy beállítása.

```
DATE [dátum]
```

A dátumformátumot a DTFORM rendszerváltozó szabályozza (nap-hó-év,
hó-nap-év, vagy év-hó-nap).

Példák:
```
DATE 12-7-85
DATE
DATE 85/2/1
```

### DEL / ERASE

Fájlok törlése.

```
ERASE filespec [/H]
DEL   filespec [/H]
```

`/H` rejtett fájlok törlését is engedi. Csak olvasható fájlok kimaradnak.
`*.*` esetén megerősítést kér.

Példák:
```
ERASE TEST.BAK
DEL *.COM /H
DEL B:\BOOT
```

### DIR

Fájlok listázása.

```
DIR [d:] [path] [filename] [/H] [/W] [/T] [/S]
```

- `/H` — rejtett fájlok is
- `/W` — széles lista (csak nevek, soronként több)
- `/T` — dátum/idő megjelenítése a méret helyett
- `/S` — összes mező (két soros bejegyzés `/T`-vel)

Példák:
```
DIR
DIR B: /W
DIR A:\BOOT
DIR *.COM
```

### DOS

Áttérés BASIC-ből VT-DOS rendszerbe (VT-DOS programmodult igényel).

```
DOS
```

Megerősítést kér. Modul nélkül: `*** No VT-DOS cartridge`.

### FORMAT

Lemez formattálása.

```
FORMAT [d:] [volname] [/1] [/H] [/8]
```

- `/1` — egyoldalas (kétoldalas meghajtóban is)
- `/H` — 40 sáv (80 sávos meghajtóban is)
- `/8` — sávonként 8 szektor (alapértelmezés: 9)

Megerősítést kér a formattálás előtt.

Példák:
```
FORMAT B:
FORMAT B:SOURCE /1 /H /8
```

### HELP

A BASIC CLI parancsainak listázása.

```
HELP
```

### LDIR

Mint a DIR, de a lista a nyomtatóra kerül.

```
LDIR [d:] [path] [filename] [/H] [/W] [/T] [/S]
```

### LTYPE

Mint a TYPE, de a kimenet a nyomtatóra kerül.

```
LTYPE filespec [/H]
```

### MD / MKDIR

Új alkönyvtár létrehozása.

```
MKDIR [d:] path
MD    [d:] path
```

Példák:
```
MKDIR UTIL
MKDIR A:\UTIL\COM
```

### MOVE

Fájlok áthelyezése egyik könyvtárból a másikba.

```
MOVE filespec [/H] [path]
```

Példák:
```
MOVE FRED \
MOVE A:*.BAT /H \BOOT
MOVE \UTIL
```

### RD / RMDIR

Alkönyvtár(ak) törlése.

```
RMDIR [d:] path [/H]
RD    [d:] path [/H]
```

A könyvtárnak üresnek kell lennie. `/H` rejtett könyvtárakat is töröl.

Példák:
```
RMDIR UTIL
RMDIR A:\BOOT\FRED? /H
```

### REN / RENAME

Fájlok átnevezése.

```
RENAME filespec [/H] filename
REN    filespec [/H] filename
```

A helyettesítő karakterek az új névben a régi név megfelelő karaktereit őrzik meg.

Példák:
```
RENAME FRED WOMBAT
REN B:\SOURCE\*.MAC /H *.OLD
```

### RNDIR

Alkönyvtárak átnevezése.

```
RNDIR filespec [/H] filename
```

Példák:
```
RNDIR UTIL COM
RNDIR A:\SOURCE\FRED? /H BILL?
```

### TIME

Idő megjelenítése vagy beállítása.

```
TIME [idő]
```

Formátum: HH:MM. Elválasztójelek: `,-./:` vagy szóköz. 12 és 24 órás
formátum is támogatott (DTFORM változó).

Példák:
```
TIME 16:45
TIME
TIME 2:30p
```

### TYPE

Fájl vagy eszköz tartalmának megjelenítése.

```
TYPE device | filespec [/H]
```

A nem megjeleníthető karakterek biztonságos formátumra konvertálódnak.
Olvasás EOF-ig vagy CTRL-Z-ig tart.

Példák:
```
TYPE MYFILE
TYPE AUX:
```

### VAR

VT-DOS rendszerváltozó megjelenítése vagy beállítása.

```
VAR szám [[szám] | [ON] | [OFF]]
```

Példák:
```
VAR 0
VAR 0, 42
VAR 0 OFF
```

### VOL

Kötetnév megjelenítése vagy megváltoztatása.

```
VOL [d:] [filename]
```

Példák:
```
VOL B:
VOL BACKUP
```

---

## Kazetta és floppy együttes használata

A floppy csatoló telepítésekor a kazettás I/O alapértelmezésben a diszkes
kezelőre irányul át. A #5-ös csatorna (adat I/O) POKE utasítással
kapcsolható vissza kazettára.

### Bemenet átirányítása kazettára

```basic
POKE 2821, 5
```

### Kimenet átirányítása kazettára

```basic
POKE 2829, 5
```

### Bemenet visszaállítása diszkre

```basic
POKE 2821, Z
```

### Kimenet visszaállítása diszkre

```basic
POKE 2829, Z
```

Ahol `Z` értéke a csatolókártya bővítőhelyének számától függ (a 0. hely a
jobb szélső):

| Bővítőhely | Z értéke |
|------------|----------|
| 0 | 128 |
| 1 | 129 |
| 2 | 130 |
| 3 | 131 |

Meleg reset (WARM RESET) végrehajtása ajánlott a kazetta és CLI módok közötti
váltáskor, mivel ugyanazt a RAM-területet használják.
