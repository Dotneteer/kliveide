# Sources

All retrieved on 2026-11-06. Web pages are linked, not copied, and links to the two GitHub projects follow their `master` branches, so
line details can drift.

## Local copies

[head-over-heels-asm/](head-over-heels-asm/) holds 19 unmodified `.asm` files from
[Simon Frankau's repository](https://github.com/simon-frankau/head-over-heels), downloaded from `master` on 2026-11-06 (the branch head that
day was `f4f318f9dea624b1760064a1da76b20b125a519d`). The folders match its `src/` layout, so the paths in
[04_HEAD_OVER_HEELS_ENGINE.md](04_HEAD_OVER_HEELS_ENGINE.md) apply. It is a subset, so the files do not assemble on their own. The repository
states no licence, and the code is a disassembly of a copyrighted game.

[binaries/](binaries/) holds game images for reverse engineering, downloaded on 2026-11-06. **Its own `.gitignore` keeps them out of git**, so they
exist only on this machine and can be downloaded again from these links. Nothing was run or disassembled. The tape block checksums were verified.

| File | Game | From | SHA-256 |
|---|---|---|---|
| `head-over-heels/memimage.z80` | Head over Heels, the snapshot Frankau's source is checked against; a version 2 or later `.z80`, so it needs decoding first | [Frankau](https://github.com/simon-frankau/head-over-heels/tree/master/memimage) | `bb3a03ca2cf43c1b2c837abad1ff83bb5c879cac8e0f788141e9c4285153e929` |
| `head-over-heels/Head Over Heels .tap` | Head over Heels, 48K tape | [Spectrum Computing](https://spectrumcomputing.co.uk/entry/2259/ZX-Spectrum/Head_over_Heels) | `462ba6d357fe9cebc213aa52dce8f31844f01ef9623a13ea698a0041b436891d` |
| `batman/Batman.tap` | Batman (1986), Ritman's earlier engine, with no public disassembly found | [Spectrum Computing](https://spectrumcomputing.co.uk/entry/438/ZX-Spectrum/Batman) | `66f60a07f6f7a901a4b974c9efc401dffef0573f15e84fb1263b9e018e01b84a` |
| `sweevos-world/SWEEVO.TAP` | Sweevo's World (1986), an independent isometric engine | [Spectrum Computing](https://spectrumcomputing.co.uk/entry/5087/ZX-Spectrum/Sweevos_World) | `b5175a58f8f0f218c6609e90ac8dbd820ccb5858d6f14042f6685201d251d14d` |
| `la-abadia-del-crimen/La Abadia Del Crimen.tap` | La Abadía del Crimen (1988), 128K | [Spectrum Computing](https://spectrumcomputing.co.uk/entry/47/ZX-Spectrum/La_Abadia_del_Crimen) | `4435922fe4f4de24adde0ebcd00ee9654267069e7f046e5cf42551467f3d7d40` |

"Available" is Spectrum Computing's status for its preservation archive, not a licence: the games remain copyrighted, and that site lists a 2021
re-release of La Abadía. Sweevo's World's tape has plain header blocks with load addresses. The Batman and Head over Heels tapes use a BASIC header
and code loader followed by headerless blocks, so the simplest way to get their memory is to load them in an emulator and save a snapshot.

Not downloaded: **Knight Lore** and **Alien 8** are marked "Distribution denied" on Spectrum Computing, so no copy was sought elsewhere. **Fairlight** is
listed as available, but its page says its files are distribution denied and offers no download links. The CPC `HEADOVER.DSK` in Limouzin's repository
was also left out, because its status could not be checked in the same archive.

## Read and used

| Source | What it is | Reliability | Used for |
|---|---|---|---|
| [Jon Sole, Knight Lore RAM disassembly](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/) ([GitHub](https://github.com/jonsole/zx-spectrum-disassemblies)) | SkoolKit disassembly with explanatory pages; the examples are produced by running the game's code | High. Reassembled and compared with the snapshot on each build. Some things are flagged as unmeasured or not traced | 01, 02, 03 |
| Its pages: [DepthSort](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/DepthSort.html), [MovingObjects](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/MovingObjects.html), [Collision](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/Collision.html), [Architecture](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/Architecture.html), [RoomStructure](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/RoomStructure.html), [Templates](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/Templates.html), [Scenery](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/Scenery.html), [Objects](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/Objects.html), [Sprites](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/Sprites.html), [Animations](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/Animations.html), [Provenance](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/Provenance.html) | | Objects, Sprites, Templates, Scenery and Animations were read in their opening sections and format tables, not every entry | |
| Its [routines](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/maps/routines.html) and [data](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/maps/data.html) maps, 30 routine pages, and its [DayNight](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/DayNight.html), [Charms](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/Charms.html), [Sounds](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/Sounds.html), [Bugs](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/reference/bugs.html) and [Trivia](https://jonsole.github.io/zx-spectrum-disassemblies/knightlore/reference/facts.html) pages | Own prose and maps | The routine notes were read, and the instruction listings were not checked line by line. Summarized in 06; the listings are not copied | 06 |
| [Simon Frankau, head-over-heels](https://github.com/simon-frankau/head-over-heels) | Reverse-engineered Spectrum source, cleaned up from a memory image | Code is exact (it reassembles to the original image). Comments are the author's partial understanding, with open TODOs | 02, 04 |
| [Fred Limouzin, headoverheels_cpc](https://github.com/fphenix/headoverheels_cpc) | CPC disassembly, built on Frankau's work; room decoder script | Work in progress. Only the README and `hoh_rooms.py` were read. The script reads the CPC data, and its README calls the versions very similar | 04 |
| [Shaun Lebron, Drawing isometric boxes in the correct order](https://shaunlebron.github.io/IsometricBlocks/) ([project](https://github.com/shaunlebron/IsometricBlocks)) | Illustrated article | Good on theory | 01, 02 |
| [TextureMind, How to write an Isometric Engine in pure 2D](https://www.texturemind.com/post2354/) | Short blog post, 2026 | Author's own formula, unproved. Its order test is not checked here | 02 |
| [Juwal Bose, Isometric Depth Sorting for Moving Platforms](https://code.tutsplus.com/isometric-depth-sorting-for-moving-platforms--cms-30226t) | Unity tutorial, 2018 | Fine for grids. Not read in full. Applies poorly to free-form stacking | 01, 02 |
| [On Filmation](https://web.archive.org/web/20230227014207/http://retrospec.sgn.net/users/nwalker/filmation/) (Internet Archive; the live site returns 404) | Older site on the file formats of Knight Lore, Alien 8 and Pentagram, drawing on Chris Wild's work | Useful for comparing games. Some history claims are opinion. Its IsoCis tutorial was unfinished by its own note and was not followed | 03 |
| [SpecNext Wiki: Sprites](https://wiki.specnext.dev/Sprites), [Layer 2](https://wiki.specnext.dev/Layer_2) | Community hardware reference | Good. Differs from Klive's article on sprites per line | 05 |
| [Klive Next display articles](../../../docs/content/en/under-the-hood/emulator-internals/next-display/overview.mdx) | This repository's own explanation, written alongside the emulator | Good, and specific on timing | 05 |
| [Developer guide r3](../zx-next-dev-guide-r3.pdf) | Local PDF: instructions, DMA, memory | Good. Checked for `LDIRX`, `LDWS` and DMA speed only | 05 |
| [Steve Monks, machine code guides](https://github.com/stevemonks/ZXSpectrumNextMachineCodeGuides) | Small annotated examples, including sprites, tilemaps and Layer 2 | README read, the code was not. Good starting code for the prototype | Pointer only |

## Looked at, little to offer

| Source | Why |
|---|---|
| [CRASH 51, Run It Again](https://www.crashonline.org.uk/51/runagain.htm) | History and review scores, with no programming detail |
| [Wikipedia, Filmation](https://en.wikipedia.org/wiki/Filmation_(game_engine)) | History, and links to other sources |
| [Knight Lore 2006](https://imae.udg.edu/~dagush/Projects/KnightLore2006) | University project reusing the game's data for a 3D view in an emulator. Its report is a Spanish PDF that was not read |

## Not found or not checked

- **Batman (1986):** no disassembly found, though the game image is in `binaries/`. Its link to Head over Heels rests on general descriptions.
- **La Abadía del Crimen:** no technical write-up of its engine found. Manuel Abadía's C++ Vigasoco rewrite exists
  ([Wikipedia](https://en.wikipedia.org/wiki/La_Abad%C3%ADa_del_Crimen)), but was not read. It is a possible later case study.
- **River City Ransom: Underground:** linked from Lebron's article as a real example of allowing boxes to intersect by using height maps. Not
  followed.
- **A Next isometric engine:** none found; see [05_NEXT_HARDWARE_MAPPING.md](05_NEXT_HARDWARE_MAPPING.md).

## The simulation

The figures marked *simulation* come from one throwaway Python script, kept outside the repository. It checks:

- Knight Lore's 27 table entries against the stated rule, and both projections' invisible steps.
- Pair rules against an exact test: A covers B if a line of sight meets A and then B, computed from interval overlap along the line.
- Whole-scene orders, for the search and insertion methods, on random non-intersecting boxes.

It models the published rules, not the Z80 code, so it cannot catch an error in how the games implement them. It can be rewritten from
the description in [02_DEPTH_SORTING.md](02_DEPTH_SORTING.md).
