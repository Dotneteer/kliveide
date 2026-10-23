# ZX Spectrum timing test programs

Third-party test programs for the ZX Spectrum's ULA, contention, floating bus, snow and interrupt
timing, kept here so they can be run in Klive at any time. They are the test kit of
`.plans/SPECTRUM_ULA_ACCURACY_PLAN.md` (Phase 0).

They are **not** part of Klive and are never packaged with it (the app ships only `out/`). Each one
belongs to its author; Klive's MIT licence does not apply to anything in this folder.

## Where they come from

Every file was downloaded from the **ZXE depot** (`https://zxe.io/depot/software/ZX%20Spectrum/`),
which the ZXE wiki's test catalogue (https://github.com/redcode/ZXSpectrum/wiki/Tests) links to.
`kit.json` records, for every download, its URL, size and SHA-256, and whether it was an archive that
was extracted here. Archives (`.zip`, `.7z`) are stored extracted, not as archives; files that were
not archives are stored byte for byte with the depot's file names.

To check a file against its record, download it again from the URL in `kit.json` and compare the
SHA-256.

## The programs

| Folder | Program | Author, date | Machines (per the ZXE wiki) | Licence |
|---|---|---|---|---|
| `ula48-simple` | ULA 48 Simple Test | azesmbog, 2012 | 48K | not stated |
| `ula128-timing` | ULA 128 Timing Test | azesmbog, 2012 | 128K | not stated |
| `ula128e-plus3` | ULA 128E +3 Test | azesmbog, 2012 | +2A/+3 | not stated |
| `timing-test` | Timing Test v0.3 | Patrik Rak, 2013 | any | GPL (ZXE wiki); source included |
| `timing-tests-48k` | ZX Spectrum Timing Tests - 48K v1.0 | Richard and Tim Butler, 2010 | 48K | not stated |
| `timing-tests-128k` | ZX Spectrum Timing Tests - 128K v1.0 (`.szx`) | Richard and Tim Butler, 2015 | 128K | not stated |
| `border-time` | Border Time | Jan Bobrowski, 2011 | any | not stated |
| `screen-time` | Screen Time | Jan Bobrowski, 2011 | any | not stated |
| `floating-spy` | Floating Spy v0.33 (FloatSpy) | RAMSOFT, 2002 | any | not stated; `floatspy.txt` included |
| `float48k` | Float48K | Mark Woodmass, 2008 | 48K | not stated |
| `float128k` | Float128K | Mark Woodmass, 2008 | 128K | not stated |
| `snow` | Snow | Hikaru, 2014 | any | not stated |
| `snow-contention` | Snow Contention | Mark Woodmass, 2009 | any | not stated |
| `snow-hold` | Snow Hold | Mark Woodmass, 2025 | any | GPLv2 (`COPYING`); source included |
| `snow-r` | Snow R | Neo Spectruman, 2022 | any | not stated |
| `snow-tests` | Snow Tests | Weiv, 2022 | any | not stated |
| `snow48` | Snow48 and its ten variants | azesmbog, 2021 | 48K | not stated |
| `snow128n` | Snow128N | Weiv, 2023 | 128K | not stated |
| `ula-snow-crash` | ULA Snow Crash | Astamur Panov, 2018 | any | not stated |
| `ir-contention` | IR Contention | Mark Woodmass, 2023 | 48K | not stated |
| `ir-contention-128` | IR Contention 128 | Mark Woodmass, 2023 | 128K/+2 | not stated |
| `halt2int` | HALT2INT v3 (`halt2int.tap`, `halt2int128.tap`) | Mark Woodmass, 2022 | 48K, 128K | GPLv2 (`COPYING`); source included |
| `time-to-first-int` | Time to First INT | Peter Helcmanovsky, 2022 | any | MIT (in `rom_first_int.asm`) |

"Any" means the wiki gives no machine. Each program's wiki page (linked in `kit.json`) describes
what it tests and, for many, shows its result on real hardware.

### Notes

- **Real-hardware references.** `halt2int/Real 48k (early).png` and `Real 48k (late).png` are the
  author's photos of a real 48K in early and late timing: the reference for the plan's Phase 4.
- **Time to First INT is a ROM**, not a tape: `1stint.rom` replaces the machine's ROM.
- **Snow48** comes in eleven builds that test different cases; all are kept.
- **Licences.** Where the table says "not stated", the program was published freely by its author
  but without a licence. If an author asks for a program to be removed, remove it here and from
  `kit.json`.
