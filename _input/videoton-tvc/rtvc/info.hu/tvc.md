# TVC gépmag

Ez a dokumentum a TVC fő gépvezérlőjének (`Tvc`) architektúráját foglalja össze. A kapcsolódó kód: [src/tvc.rs](../src/tvc.rs).

## Áttekintés

A `Tvc` típus a rendszerbusz és a hardver-orkesztrátor. Összeköti a fő modulokat:

- **CPU**: Z80 mag ([z80.md](z80.md))
- **MMU**: memóriakezelő ([mmu.md](mmu.md))
- **Videó**: Motorola 6845 CRTC ([vid.md](vid.md))
- **Hang**: hanggenerátor/időzítő ([angol referencia](../info/tvc.md#sound-and-timer))
- **Billentyűzet**: sor/oszlop mátrix
- **Bővítők**: például floppyvezérlő kártyák

A CPU minden `OUT` és `IN` művelete a gépmagon keresztül a megfelelő virtuális portra kerül.

## Rendszeróra és időzítések

- **CPU órajel**: 3 125 000 Hz (3,125 MHz).
- **Z80 T-state**: 320 ns.
- **Soridő**: 64 mikrosecundum, azaz 200 CPU ciklus.
- **Képkocka**: 20 ms, 50 Hz, azaz 62 500 CPU ciklus.

A videó, hang és interrupt komponensek CPU ciklusokban kapják az eltelt időt.

## Végrehajtási ciklus

A `run_for_a_frame()` képkockánként lépteti az emulációt:

1. CPU utasítások futtatása 62 500 ciklusnyi keretig.
2. `VidModel::FastFrame` esetén egy teljes képkocka renderelése a jelenlegi videóállapotból.
3. `VidModel::Interleaved` esetén a CRTC stream minden CPU utasítás után halad.
4. A kazettatranszport és a hanggenerátor minden utasítás eltelt ciklusaival
   halad. A hang mono, 44,1 kHz-es `f32` PCM mintákként kérhető le.
5. A kurzor interrupt azonnal összekapcsolja a CPU és CRTC időzítését.
6. A UI akkor kap új képet, amikor megjeleníthető framebuffer készült. Szinkronvesztéskor a gép fekete hátteret és mozgó fehér csíkokat jelenít meg.

A natív egui felület nem futtat TVC képkockát minden host repaintre. Futás közben folyamatos repaintet kér, de a TVC képkockák generálását valós időhöz, 50 Hz-hez köti.

## I/O portleképezés

### Írások

| Port | Modul | Leírás |
|:---:|:---:|---|
| `0x00` | Videó | keretszín |
| `0x02` | MMU | memória map |
| `0x03` | Billentyűzet / bővítő | billentyűsor és cartridge bővítőmap |
| `0x04` | Hang | frekvencia alsó bájt |
| `0x05` | Hang / kazetta | 0-3. bit: frekvencia felső nibble; 4. bit: oszcillátor az amplitúdóvezérlésen keresztül; 5. bit: hanginterrupt; 6-7. bit: kazettamotor |
| `0x06` | Többfunkciós | 0-1. bit: videomód; 2-5. bit: hangerő / 4 bites DAC; 7. bit: printer ACK |
| `0x07` | Interrupt | kurzor/hang interrupt nyugtázása |
| `0x0C - 0x0F` | MMU | videó bankválasztás TVC 64K+ gépen |
| `0x58 - 0x5B` | Bővítők | kártya konfiguráció |
| `0x60 - 0x63` | Videó | palettaregiszterek |
| `0x70 - 0x7F` | CRTC | tükrözött MC6845 portok; páros cím választja a címregisztert, páratlan cím írja a kiválasztott adatregisztert |
| `0x10 - 0x1F` | Slot 0 | kártya portok |
| `0x20 - 0x2F` | Slot 1 | kártya portok |

### Olvasások

| Port | Modul | Leírás |
|:---:|:---:|---|
| `0x58` | Billentyűzet | kiválasztott sor oszlopállapota |
| `0x59` / `0x5D` | Interrupt / rendszer | függő interruptok, monitorflag, kazettabemenet |
| `0x5A` | Bővítők | slot azonosítók |
| `0x5B` / `0x5F` | Hang | hangoszcillátor újraindítása |
| `0x70 - 0x7F` | CRTC | tükrözött MC6845 portok; a páros címregiszter olvasása `0xFF`, a páratlan adatregiszter olvasása a CRTC hozzáférési szabályait követi |
| `0x10 - 0x1F` | Slot 0 | kártyaolvasás |
| `0x20 - 0x2F` | Slot 1 | kártyaolvasás |

## Interruptok

A TVC a perifériainterruptokat egy latch állapotban tartja. A kurzor és a hangidőzítő közös biten osztozik, a bővítőkártyák a 0-3. biteken jeleznek.

Az interrupt életciklusa:

1. CRTC kurzoregyezés vagy hangidőzítő beállítja az aktív-alacsony interruptbitet. A hang 12 bites osztója a `0x04` és `0x05` porton állítható; a hallható oszcillátor frekvenciája `195312,5 / (4096 - n)` Hz, a `0xFFF` érték leállítja.
2. Ha a Z80 interrupt engedélyezett, a gépmag meghívja a Z80 interrupt rutinját.
3. A ROM szoftveresen különbözteti meg a kurzor és hangforrást.
4. A `0x07` portra írás törli a közös interrupt flaget.

## ROM és média

A ROM-ok a `roms/` könyvtárból töltődnek. A CAS betöltés közvetlen RAM-injektálással működhet, a DSK betöltés pedig a HBF/FD1793 útvonalon keresztül történik. Részletek: [cas.md](cas.md), [hbf.md](hbf.md).

A **Machine / Fast boot** beállítás a támogatott TVC ROM-ok kétmintás
RAM-tesztjét egyetlen `LDIR` nullázásra cseréli. Az 1.2 ROM módosított rutinja
a `TVC12_D4.64K` `0x0348`, a 2.2 ROM-é a `TVC22_D6.64K` `0x0357` offsetjén
kezdődik; a páros belépési pontok rendre `C338`/`C33E` és `C347`/`C34D`. A rutin
törli a teljes 16 KiB-os lapot, `HL`-t a következő laphatárra állítja, és
beállított zero flaggel tér vissza, így a BASIC továbbra is helyesen érzékeli a
memóriát.

Az 1.2 ROM-ban a `0x1A19` offseten a `11 15` bájtok `18 5C` értékre változnak,
ami kihagyja a bootképernyőt. A 2.2 ROM-ban a `0x0F21` offseten a feltételes
`JR NZ,CF96H` feltétel nélküli `JR CF96H` lesz, így a ROM kiegyensúlyozott
rajzolóblokkja kimarad. A beállítás kikapcsolása visszaállítja az eredeti
bájtokat; a módosítás csak ismert ROM-fájlnév és várt bájtsorozat esetén fut le.
