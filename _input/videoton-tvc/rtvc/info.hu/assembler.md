# rtvc assembler referencia

Ez a dokumentum a [Z80 segédassemblert](../src/emulator/asm.rs), az
[`rtvc-asm`](../src/bin/rtvc_asm.rs) és
[`rtvc-disasm`](../src/bin/rtvc_disasm.rs) parancssori programokat, valamint a
[`rtvc_debug.py`](../scripts/rtvc_debug.py) hibakereső betöltési folyamatát
ismerteti.

Az assembler szándékosan kicsi. Hibakereső javításokhoz, TVC
segédrutinokhoz és Spectrum-portolási illesztésekhez készült; nem teljes értékű
makróassembler.

## Belépési pontok

### Rust API

Az `asm.rs` két belépési pontot ad:

- az `assemble_line(source, pc)` egyetlen utasítást vagy `DB`/`DEFB` sort
  fordít le a megadott programszámlálónál;
- az `assemble_program(source, origin)` lefuttatja a kétmenetes assemblert, és
  visszaadja a szegmenseket, szimbólumokat, forrássor-metaadatokat, az
  összefűzött bájtokat és a `next_addr` értéket.

A TCP hibakereső `assemble` parancsa az `assemble_program` függvényt használja,
így egy kérés egy utasítást vagy egy kis forrásblokkot is tartalmazhat.

### Parancssori assembler

Segédforrás fordítása TOML formátumba:

```cmd
rtvc-asm --origin 8000H helper.asm -o helper.toml
```

A `-` bemeneti útvonal a szabványos bemenetről olvas. A `-o` elhagyásakor a
kimenet a szabványos kimenetre kerül.

| Opció | Jelentés |
| --- | --- |
| `--origin <cím>` | Kezdő fordítási cím a forrásbeli `ORG` előtt; alapértéke `0`. |
| `--format <toml\|cas\|bin>` | Kimeneti formátum; alapértéke `toml`. A `cas` egyetlen `BASIC_START` szegmenst, a `bin` egy összefüggő szegmenst vár. |
| `-d <NÉV=ÉRTÉK>`, `--define <NÉV=ÉRTÉK>` | Fordítás előtt lecseréli az assembly kódban lévő `%NÉV%` helyőrzőket. Többször is megadható; a hiányzó érték hiba. |
| `-o <útvonal>`, `--output <útvonal>` | Kimeneti fájl. |
| `-` bemenetként | Olvasás a szabványos bemenetről. |

A `<cím>` lehet decimális, `0x` vagy `$` előtagú, illetve `H` utótagú
hexadecimális szám.

A build során meghatározott értékek `%NÉV%` helyőrzőkkel tarthatók külön az
assembly forrástól:

```asm
        LD BC,%BLOCK_SIZE%
```

```cmd
rtvc-asm -d BLOCK_SIZE=0748H helper.asm -o helper.toml
```

A definíciók neve nem érzékeny a kis- és nagybetűkre, értékük szövegesen kerül
behelyettesítésre. A fenti példában a `-d BLOCK_SIZE=...` elhagyása hibát ad.
A behelyettesítés csak az assembly kódra vonatkozik: a pontosvesszős
megjegyzésekben és az idézett szövegliterálokban lévő helyőrzők változatlanok
maradnak. Az idézett szövegen belüli pontosvessző szintén nem kezd megjegyzést.

### Parancssori disassembler

Bináris adat visszafordítása `rtvc-asm` forrássá:

```cmd
rtvc-disasm --origin C000H roms\TVC12_D4.64K -o rom.asm
```

ROM-szimbólumok és adatterületek is megadhatók, hogy az ismert táblák `DB`
sorokként, a kód pedig utasításokként jelenjen meg:

```cmd
rtvc-disasm --origin C000H --symbols roms\rom_symbols_1_2.json --comments roms\rom_comments_1_2.json --bank sys --bank-offset 0000H --data-range C003H-C228H roms\TVC12_D4.64K -o rom.asm
```

| Opció | Jelentés |
| --- | --- |
| `--origin <cím>` | Az első bemeneti bájt CPU-címe; alapértéke `0`. |
| `-o <útvonal>`, `--output <útvonal>` | Assembly kimeneti fájl. |
| `--title <szöveg>` | Címmegjegyzés hozzáadása. |
| `--symbols <útvonal>` | ROM-címkék és megjegyzések betöltése JSON-ból. |
| `--comments <útvonal>` | Címhez rendelt megjegyzések; többször is megadható. |
| `--bank <név>` | Szimbólumbank, például `sys` vagy `exth`; a `--symbols` mellett kötelező. |
| `--bank-offset <cím>` | Az első bemeneti bájtnak megfelelő fizikai bankeltolás. |
| `--data-range <kezdet-vég>` | Inkluzív CPU-címtartomány kiírása `DB` sorokként; ismételhető. |
| `-` bemenetként | Bináris adatok olvasása a szabványos bemenetről. |

Az `rtvc-disasm` az emulátor saját Z80 disassemblerét használja, és minden
kiírt utasítást visszaellenőriz az `assemble_line()` függvénnyel. A nem
támogatott vagy bemeneti határt átlépő alakok `DB` sorokká válnak, ezért a
generált forrás bájtpontosan újrafordítható. A bemeneti tartományon belüli ugrás-
és híváscélok `Lxxxx` címkét kapnak.

### Hibakereső kliens

A `scripts/rtvc_debug.py` parancsai:

```text
asm [cím]
asmfile helper.asm [kezdőcím]
loadasm helper.toml
```

- Az `asm` egyetlen interaktív javítóutasítást ír be.
- Az `asmfile` elküldi a forrást a hibakereső assemblerének, majd a
  szegmenseket a leképezett memóriába írja.
- A `loadasm` egy `rtvc-asm-v1` TOML fájl összes szegmensét tölti be.

## Forrásformátum

A forrás sororientált. Az idézett szövegen kívüli pontosvessző megjegyzést
kezd:

```asm
; megjegyzés
START:  LD HL,MSG   ; sorvégi megjegyzés
MSG:    DB "OK",0
```

A címkék `név:` alakúak és nem érzékenyek a kis- és nagybetűkre; tároláskor
nagybetűssé válnak. A név ASCII betűt, számjegyet, `_` és `.` karaktert
tartalmazhat, de nem kezdődhet számjeggyel.

| Direktíva | Alak | Megjegyzés |
| --- | --- | --- |
| `ORG` | `ORG kifejezés[, név, leképezett-cím ...]` | Beállítja az aktuális címet; a név/cím párok tartós címleképezéseket definiálnak erről az eredetről. Több `ORG` több kimeneti szegmenst hoz létre. |
| `BASIC_START` | `BASIC_START` | Tokenizált TVC BASIC autorun sort ír `19EFH` címre, `1A30H`-ig kitölt, és ott definiálja a `BASIC_START` címkét. |
| `EQU` | `CÍMKE EQU kifejezés` vagy `CÍMKE: EQU kifejezés` | Konstans szimbólumot definiál. |
| `DB`, `DEFB` | `DB érték[, érték...]` | Bájtokat, illetve ASCII szövegeket ír ki. |
| `DW`, `DEFW` | `DW érték[, érték...]` | Little-endian 16 bites szavakat ír ki. |
| `DS`, `DEFS` | `DS darab[, kitöltés]` | Nulla vagy a megadott értékű kitöltőbájtokat ír ki. |

A `DB`/`DEFB` szövegliteráljai csak ASCII karaktereket tartalmazhatnak. Az
érvényes escape-ek: `\0`, `\n`, `\r`, `\t`, `\\`, `\"` és `\'`.

## Kifejezések

A támogatott elemek:

- decimális számok;
- `0x1234`, `$1234` és `1234H` hexadecimális számok;
- `0b1010` és `1010B` bináris számok;
- címkék és `EQU` szimbólumok;
- `$` mint aktuális cím;
- `címke@leképezés` címátalakítások;
- `+` és `-` műveletek.

A `+` és `-` balról jobbra értékelődik; zárójeles aritmetika nincs. A Z80
memóriaoperandusai, például `(4000H)` és `(IX+2)`, természetesen használnak
zárójelet. A `címke@leképezés` alak az `ORG` sorban rögzített eredetből a
leképezett címre alakít át; a későbbi `ORG` ezt nem módosítja. Az ismeretlen
vagy ismételten definiált leképezés assemblerhiba.

## Futtatható TVC BASIC programok

Kis, automatikusan induló TVC BASIC programhoz `ORG` helyett `BASIC_START`
használható:

```asm
        BASIC_START

        LD A,02H
FLASH:  OUT (00H),A
        XOR 0AH
        JP FLASH
```

Közvetlen CAS-kimenet:

```cmd
rtvc-asm --format cas experiment.asm -o experiment.cas
```

A `toml` formátum a hibakereső `loadasm` parancsához, a `bin` formátum pedig
az összefüggő nyers gépi kódhoz használható.

## Utasításkészlet

Az encoder többek között az alábbi alakokat támogatja:

- `LD`, `INC`, `DEC`;
- `ADD`, `ADC`, `SBC`, `SUB`, `AND`, `XOR`, `OR`, `CP`;
- `JP`, `JR`, `DJNZ`, `CALL`, `RET`, `RST`;
- `PUSH`, `POP`, `EX`, `EXX`;
- `IN`, `OUT`, `IM`;
- `BIT`, `RES`, `SET`, `RLC`, `RRC`, `RL`, `RR`, `SLA`, `SRA`, `SLL`, `SRL`;
- rögzített alakok, például `NOP`, `HALT`, `DI`, `EI`, `NEG`, `RETN`,
  `RETI`, `RRD`, `RLD`, `LDI`, `LDIR`, `LDD`, `LDDR`, `CPI`, `CPIR`, `CPD`,
  `CPDR`, `INI`, `INIR`, `IND`, `INDR`, `OUTI`, `OTIR`, `OUTD`, `OTDR`.

A nem támogatott mnemonikok és operandusalakok hibát adnak. Nincsenek makrók,
include-ok, feltételes fordítás, lokális címketartományok, relokációs rekordok,
listafájlok vagy más assemblerekkel kompatibilis szintaxis.

## TOML-kimenet

Az `rtvc-asm` verziózott, olvasható TOML fájlt ír:

```toml
format = "rtvc-asm-v1"
source = "helper.asm"
requested_origin = 0x7000
origin = 0x8000
next_addr = 0x8009

[symbols]
MSG = 0x8006
START = 0x8000

[[segments]]
addr = 0x8000
len = 0x09
bytes = [
  0x21, 0x06, 0x80, 0xC3, 0x00, 0x80, 0x4F, 0x4B, 0x00,
]
```

| Mező | Jelentés |
| --- | --- |
| `format` | Ennél a verziónál mindig `rtvc-asm-v1`. |
| `source` | Forrásútvonal, vagy szabványos bemenetnél `-`. |
| `requested_origin` | A CLI/API kezdőcíme a forrásbeli `ORG` előtt. |
| `origin` | Az első kibocsátott szegmens címe, üres kimenetnél a kért kezdőcím. |
| `next_addr` | Az utolsó utasítás vagy `ORG` utáni aktuális cím. |
| `segments` | Címzett bájttartományok; nem folytonos `ORG` esetén több elem. |
| `symbols` | Nagybetűs szimbólumnevek és 16 bites értékeik. |
| `mappings` | Az `ORG` sorok névvel ellátott leképezései: `name`, `source_base`, `mapped_base`. |
| `lines` | A kibocsátott forrássorok sorszáma, címe és bájthossza. |

A betöltők számára a `segments[].bytes` a mérvadó adat. A `segments[].len`
értékének egyeznie kell a bájttömb hosszával.

### Névvel ellátott címleképezések

Az `ORG` sor egy vagy több, az adott címtartományból kiinduló névvel ellátott
átalakítást definiálhat:

```asm
ORG C000H, SYS0, 0000H, SYS1, 4000H

START:  JP MAIN@SYS0
MAIN:   NOP

ORG C100H
TABLE:  DW TABLE@SYS0, TABLE@SYS1, MAIN

ORG D000H, DATA0, 8000H
OTHER:  JP TABLE@SYS0
```

Ez a `SYS0` leképezést `C000H -> 0000H`, a `SYS1` leképezést pedig
`C000H -> 4000H` értékekkel rögzíti. A leképezés deklarációja nem ír ki bájtokat.
`START` címe `C000H`, `MAIN` címe `C003H`, `TABLE` címe pedig `C100H`. A
leképezett hivatkozás jelentése:

```text
címke@leképezés = címke - forrás-alapcím + leképezett-alapcím
```

Ezért a `DW` értékei `0100H`, `4100H` és `C003H`, a kibocsátott little-endian
bájtok pedig `00 01 00 41 03 C0`. Az utolsó ugrásban a `TABLE@SYS0` értéke
`0100H`, ezért az utasítás bájtjai `C3 00 01`. A `DATA0` leképezés `D000H ->
8000H` értéket rögzít; a későbbi `ORG` sorok nem módosítják a korábbi
leképezéseket. A sima `TABLE` továbbra is `C100H`.

A leképezésnevek egy assemblált modulon belül egyediek. Ismeretlen vagy
ismételten definiált leképezés assemblerhibát okoz.

## Tipikus munkafolyamat

1. Írj egy kis segédforrást:

   ```asm
   ORG 8000H
   START:  LD HL,MSG
           JP START
   MSG:    DB "OK",0
   ```

2. Fordítsd le:

   ```cmd
   rtvc-asm --origin 7000H helper.asm -o helper.toml
   ```

3. Töltsd be az aktív gépbe:

   ```text
   rtvc> loadasm helper.toml
   ```

4. A `disasm`, `read`, töréspont- és léptetőparancsokkal vizsgáld vagy futtasd.

## Hibák

A programfordítási hibák tartalmazzák a forrás sorszámát:

```text
line 2: unknown symbol 'MISSING'
line 4: relative target 9000H is out of range from 8000H
```

A `loadasm` ellenőrzi az `rtvc-asm-v1` formátumot, a legalább egy szegmenst, a
16 bites szegmenscímeket, a `0..255` tartományú bájtokat és – ha jelen van – a
`len` mező egyezését.
