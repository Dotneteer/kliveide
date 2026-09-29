# NextBuild Studio — Feature Inventory

A reference inventory of what [NextBuild Studio](https://github.com/em00k/NextBuildStudio)
(NBS) offers for ZX Spectrum Next development in Boriel ZX Basic, collected so that Klive can
decide which ideas to adopt. It is a **living document**: extend it section by section as
questions come up (see [§17 Query log](#17-query-log)), rather than starting new files.

- **Researched:** 2026-09-26, against `em00k/NextBuildStudio@main` (last push 2026-09-16), the
  extension `em00k.nextbuild-viewers` 0.9.9 (Marketplace) and 0.9.10 (VSIX in the repo — its
  manifest contributions are identical to 0.9.9), the help repo `em00k/NextBuild-Studio-Help`,
  the product site, the SpecNext wiki and the author's public Patreon release posts.
- **Markers:** **(inferred)** = interpretation of code, not stated by the project;
  **(uncertain)** = sources disagree; **(not found)** = searched for, no evidence.
- Paths written `NB10/…` are relative to `bare-bones-files/NextBuildv10/` in the NBS repo.

---

## 1. At a glance

| Aspect | Summary |
|---|---|
| What it is | A **fork of VS Code** plus a bundled "root folder" toolchain for ZX Spectrum Next development in Boriel ZX Basic |
| Author | em00k (David Saphier) |
| Compiler | A **fork of Boriel zxbasic 1.18.7** (`1.18.7-nb10`) adding CODEBANK banked code |
| Emulator | **CSpect only** (closed-source freeware, downloaded from itch.io, not bundled) |
| Host platforms | Official installers: Windows 10/11 x64, Linux x64 (AppImage/DEB, needs `mono-complete`). macOS: barebones route or an unsigned Apple-Silicon test build |
| Runtime | Embedded Python 3.13 runs all build scripts; Mono runs CSpect on Linux/macOS |
| Licence | Repo `LICENSE`: MIT. Extension manifest says GPL-3.0 while its README says MIT **(uncertain)**. Upstream zxbasic's compiler is AGPL-3.0-or-later, while its runtime and stdlib are MIT (§17.2); the fork's licence is not stated. The IDE fork's own source and the extension source (`em00k/nextbuild-viewers`) are **not public** |
| Current version | NBS "v10" (product page says 1.1.25, release notes say 1.2.0 — **uncertain**), released 2026-08-28/29 |

### 1.1 Architecture — four cooperating parts

1. **The VS Code extension `em00k.nextbuild-viewers`** — language support for `.bas`, live
   linting, F1/hover help, asset custom editors, New Project wizard, "Open with CSpect".
   A second extension, **NextBuildStudio-Extra** (1.0.12), adds Outline, symbols, Peek
   references and signature-aware completion (per release notes; manifest not inspected).
2. **The root folder** (`NextBuildv10/`) — Python build drivers and BASIC runtime libraries in
   `Scripts/`, bundled tools in `Tools/`, docs and examples in `Sources/`, the forked compiler
   `zxbasic1.18.7-nb10/`, AI-agent guidance in `Agents/`. The shipped product adds `Emu/CSpect`,
   `img/` (NextZXOS HDF) and `python/`.
3. **VS Code tasks + status-bar "action buttons"** (third-party `seunlanlege.action-buttons`)
   that wire Build / Run / Modules / HDF sync / Settings. **Build and run are not in the
   extension** — they are tasks running Python scripts.
4. **CSpect**, launched either with a NEX and the project's `data/` folder mounted as the SD
   card, or booting NextZXOS from an HDF image.

---

## 2. Editor and language intelligence

| Feature | How it works | Source |
|---|---|---|
| Language `nextbuild` for `.bas` | TextMate grammar `source.nextbuild`; `'!` directive lines get their own scope (`meta.precompiler.asm.nextbuild`); NextReg names highlighted | extension manifest |
| As-you-type linting | Runs the **real compiler**: `python zxbasic/zxbc.py --parse-only -I <root>/Scripts … <file>`; parses `file:line[:col]: warning\|error: msg`; narrows ranges for a few message types; skips `nextlib.bas` | extension settings, build agent's reading of `runLint` |
| Warning filtering | `linting.hiddenWarnings` (e.g. W150, W160, W170, W190 hidden by default), `linting.hideAllWarnings` (errors only); command "Configure Warning Filters" | manifest |
| Completion | Keywords and constants (toggle each); variable suggestions (NBS 1.0.3+); signature-aware completion (Extra extension) | manifest, release notes |
| Hover help | From `nextbuild_constants.json` — 182 entries (NextReg names with numbers, colours, palette ids, screen modes, …) | help repo |
| F1 contextual help | Webview rendering Markdown from `keywords.json` (430 entries); F1 on a word → its page, on blank → index; **Ctrl+F1** search. F1 therefore replaces the Command Palette in `.bas` files | manifest keybindings, help repo |
| Snippets | 116: build directives, `#define NEX/IM2/DEBUG`, `#include <nextlib.bas>`, nextlib calls with placeholders, control flow, `BREAK`/`BBREAK` breakpoints, Layer 2 template | help repo `nextbuild_snippets.json` |
| Outline / go-to-definition / Peek references | Provided by NextBuildStudio-Extra; Peek references is same-file only | release notes |
| Formatter | Possibly — v9 workspace sets the extension as `[nextbuild]` default formatter **(inferred)** | v9 settings |
| Language server | None (no LSP) | manifest dependencies |
| Error mapping at build time | Task problemMatcher `^(.*):(\d+):\s+(warning\|error):\s+(.*)$` → Problems panel | v9 `tasks.json` |

### 2.1 Help system (`em00k/NextBuild-Studio-Help`)

Authored as Markdown, converted to three JSON files the extension loads (`keywords.json`,
`nextbuild_constants.json`, `nextbuild_snippets.json`). Page template: Syntax, Description,
Examples, Remarks, See also.

| Category | Entries | Coverage |
|---|---|---|
| manual | 145 | 123 NextReg pages (one per register), system variables, memory, global memory, palettes, DeZog console commands |
| nextlib | 132 | Library API by area (audio, file I/O, graphics, hardware, input, memory, strings, precompiler), 35 I/O-port pages |
| keywords | 106 | The Boriel language: statements, types, operators, maths/string functions |
| reference | 39 | Syntax, identifiers, zxbc CLI, Z80N asm, tutorials, sample programs, and the manuals for the Sprite/Palette/Importer/AYFX editors |
| esxdos | 7 | `F_OPEN`, `F_READ`, `F_WRITE`, `F_SEEK`, `F_UNLINK`, `M_GETSETDRV` |
| constants | 1 (+50 pages) | DMA, Copper, Layer 2 access flags, memory addresses, sprite status |

---

## 3. Asset editors and tools

All custom editors are the default editor for their file types (double-click opens them).

| Editor / tool | File types | Capabilities | Klive today (first pass) |
|---|---|---|---|
| Palette editor | `.pal`, `.nxp` | 9-bit RGB (`RRRGGGBB` + `-------B`), index display, undo/redo, range copy/paste; import Next `.pal`, JASC/GIMP `.pal`, `.rgb`, palette-from-image; sort by hue/sat/brightness; gradients, harmonies, reduce to 16, merge | `.pal`, `.npl` editor |
| Sprite / font / tile editor | `.spr`, `.til`, `.fnt`, `.nxt` | Modes: 8-bit 16×16, 4-bit 16×16 (palette offset 0–15), 8×8 font (256 col), 8×8 4-bit tile; zoom, grid, load palette; brushes 1×1–3×3, 2×4, 2×6; flip/rotate/shift/fill; reorder/copy/insert/delete sprites; priority bit; canvas rewrite in 1.1.0 adds undo, transparency, custom brushes, animation preview | `.spr` editor only |
| Sprite duplicate analysis | sprite files, `.nxb`, `.nxm` | Finds exact, flipped and rotated duplicates; report in Output; save deduplicated file and **rewrite block/map indices** | — |
| Block / map editor | `.nxb` (meta-sprite blocks), `.nxm` (maps of blocks) | Interactive block/map display and editing; collision/layer editing mentioned in docs only | — |
| Optimised block format | `.oxb` | NBS-specific: header `"OB"`, version, block w/h, count (LE16); per block a count then `(x, y, spriteIdx)` triples — stores only non-empty sprites. "Convert to Optimized Block" on `.nxb` | — |
| Image viewer | `.nxi`, `.sl2`, `.sll`, `.hxi` | Next image / layer files with correct colours | `.nxi` editor; `.sl2`, `.slr`, `.scr`, `.shc`, `.shr` viewers |
| Sprite / image importer | PNG, JPG, GIF, BMP, WebP | Grid, manual or block-capture selection; 16×16 or 8×8; 8-bit or 4-bit; quantise to a target palette; extract source palette; selection list; export `.spr`/`.til`, blocks, **panels for `DrawImage()`**, NXI 256×192 / 320×256 (640×256×16 claimed in 1.1.0, doc says unsupported — **uncertain**); dithering | — |
| AYFX editor | `.afb`, `.afx` | Port of Shiru's AYFX (via Remy Sharp's JS port): banks of up to 256 effects, per-frame tone/noise/volume/T-N flags, piano entry, PSG import, 4 preset banks; multi-channel WIP | — |
| PT3 player | `.pt3` | Originally external `playpt3(.exe)`; v10 moved to an in-webview TS PT3 player with TurboSound | — |
| Hex editor | any | v10: hex editor with data inspector | `.bin` viewer |
| Map-file RAM visualiser | `.map` | v10: memory usage including CODEBANKs | (NEX bank browser is a different view) |
| Animation Sequencer | sprites | 1.1.0; 256-colour sprites only, no runtime decoder | — |
| Snapshot Manager | project folder | 1.1.0; zipped project snapshots | — |
| Sample Packer | audio samples | 1.1.0 | — |
| Create New Sprite/Font File | — | Wizard with customisable parameters | — |
| File icon theme | pal nxp spr fnt til nxt nxb nxm nxi sl2 sll pt3 bas nex zx0 zx7 bin | Toggleable icon theme | Klive has its own icon set |
| NEX viewer | `.nex` | Delegated to the third-party `maziac.nex-fileviewer` | Full NEX viewer with bank browser and annotations |

Bundled command-line tools (`NB10/Tools/`): `gfx2next` (image converter, with a Tk GUI wrapper
`pyscripts/gfx2next_gui3.py`), `hdfmonkey` (HDF `mkdir`/`put`), `playpt3`, `tile4bit.exe`
(unreferenced), `sysvars.bin` (256-byte sysvar image packed into every NEX unless `'!nosys`).
**Not bundled but needed:** CSpect, Mono (Linux/macOS), sjasmplus (for `.asm` projects).

---

## 4. Project model

### 4.1 New Project wizard

Command `createNewProject` opens a webview: name, location (default `ROOT/Sources/`), template,
summary, open main file. Templates are JSON (`{name, description, type, directories[],
files[{name, template}]}`, placeholder `{projectName}`) in the extension's `data/templates/`:

| Template | Directories | Files |
|---|---|---|
| Simple Game (`single-file.json`) | assets, sprites, data, build | `{projectName}.bas` (`'!org=$8000 '!heap=4096`, nextlib, `WaitRaster` loop) |
| Classic ZX Spectrum (`classic-file.json`) | data | one `.bas` |
| Layer 2 (`layer2.json`) | assets, data, build | one `.bas` |
| Multi File (Modules) (`multi-file.json`) | modules, includes, assets, data, build | `Master.bas`, `Module001.bas`, `Module002.bas`, `includes/globals.bas` |

(`Docs/Templates.md` describes a `Scripts/templates/` folder with `{{PROJECT_NAME}}` tokens that
does not exist — stale doc.)

### 4.2 Folder conventions

- **Per project** (under `Sources/`): the `.bas`; `data/` (runtime assets, NEX-packed assets,
  module binaries — **mounted as the SD card in CSpect**); `build/` (intermediates);
  optionally `assets/` (source art) and `includes/`. The `.nex` is written **beside the source**.
- **`[]` path prefix** → `Scripts/system_data/` (shared stock assets: fonts `font1–25.fnt`,
  `bonky.spr`, `mouse.spr`, `music1–3.pt3`, `soundfx.afb`, player binaries `vt24000.bin`,
  `ts4000.bin`, `nextsid.bin`).
- `#include <x>` searches `Scripts/` and the compiler's `src/lib/arch/zxnext/stdlib`.

### 4.3 Header directives — the per-program "project file"

There is **no project JSON**: each program configures its build with `'!` comment directives in
its **first 64 lines** (`;!` in `.asm` sources). Case-insensitive, spaces tolerated (v10),
numbers as `$hex`, `0x…` or decimal. Global defaults come from `Scripts/nextbuild.config`
(`DEFAULT_ORG=32768`, `DEFAULT_HEAP=1024`, `DEFAULT_OPTIMIZE=4`).

| Directive | Effect |
|---|---|
| `'!org=N` | `zxbc -S`; also selects the 16K bank/offset for the main binary in the NEX; default PC |
| `'!heap=N` | `zxbc -H` |
| `'!opt=N` | `zxbc -O` (0–4) |
| `'!end=N` | First unused address, for the size gauge only |
| `'!pc=N`, `'!sp=N` | NEX entry PC / SP (defaults: org, PC−2) |
| `'!nosys` | Omit `sysvars.bin` from the NEX |
| `'!nosp` | Parsed but no effect **(inferred)**; nextlib's `#define NOSP` is the real switch |
| `'!asm` | Emit assembly only (`<name>.bas.asm`), no NEX |
| `'!headerless` | `zxbc --headerless` |
| `'!nonex` | Compile but skip NEX creation (needed when `LoadSDBank` arguments are variables) |
| `'!noemu` | Don't launch the emulator (effectively inert since launch moved to a task **(inferred)**) |
| `'!module` / `'!module=NAME` | Mark a module source (see §6.2) |
| `'!master=FILE` | For a module: launch the master NEX instead |
| `'!origin=FILE` | Build FILE instead — lets you press F5 from inside an include |
| `'!bmp=FILE` | NEX loading screen from `data/FILE` (`!BMP8`) |
| `'!bin=NAME` | "Make a BIN" (partly wired **(inferred)**) |
| `'!copy=PATH` | Copy the `.nex` (and autoexec) to PATH after build |
| `'!exe=CMD` | Post-build shell command(s); `{file}` → `<name>.nex`; `*.sh` via bash; failure doesn't fail the build |
| `'!hdf=DIR` | Sync build output into the emulator HDF without a loader |
| `'!nb=TEMPLATE(k=v,…)` | Generate a tokenised NextBASIC loader and sync to the HDF (§8) |
| `'!codebank=N` | First 8K page for CODEBANK 1 (default 30) |
| `'!codebankpages=a,b,…` | Explicit page list for code banks |
| `'!codewindow=A` | Code window address (default `$6000`) |
| `'!codewindowsize=N` | 8192 or 16384 |
| `'!codebankdepth=N` | Far-call nesting depth (default 16; 3 bytes/level) |

### 4.4 Feature `#define`s understood by nextlib

| Define | Effect |
|---|---|
| `NEX` | `LoadSDBank()` becomes an empty macro → assets must be packed into the NEX by the build |
| `IM2` | Layer 2-over-`$0000` routines skip their `di`/`ei` guard (program runs IM2) |
| `AYFX` / `CTC` | Auto-include the IM2 music/SFX driver / the CTC sample driver |
| `CUSTOMISR` | Library ISR calls the user's `SUB MyCustomISR()` |
| `NOAYFX` | ISR skips PT3/ayFX work |
| `NOSP` | nextlib does not relocate SP |
| `NOBREAK` | `BREAK` macros compile to nothing |
| `NOINTCHECK` | Omit `check_interrupts()` |
| `DEV` | Adds `dbMemory`, `Debug(x,y,s$)` |
| `__NSTR` | Adds `NStr()` |
| `DEBUG` | Failed `LoadSD` prints the file name and flashes the border |

---

## 5. Build pipeline

F5 = task "Build Source & Run CSpect" = `python Scripts/nextbuild.py -b <file> -s` then
`python Scripts/launch_cspect.py --map build/<file>.map --nex <file>.nex --echo`
(v10: `build.py -b <file> -s -e` does both). F6 builds only; F7 opens the config/task menu.

### 5.1 `nextbuild.py` CLI

`-b FILE` source · `-q` quiet · `-m` module build · `-t` TAP output · `-s` single file (no-op) ·
`-l` skip compile · `-D` build-date define · `--sync-hdf` sync only · `--nex-only` rebuild NEX
from existing `.bin` · `--config` alternate config.

### 5.2 Stages

1. **Setup** — read `nextbuild.config`; import `zxbc`, `nextcreator`, `txt2nextbasic`,
   `map_formatter` **in-process** (Python imports, not subprocesses). Create `data/`, `build/`.
2. **Parse directives** (`'!origin` may redirect the target file).
3. **Compile** — BASIC:
   `zxbc <src> --arch=zxnext -W160 -W140 -W150 -W170 -W190 -S <org> -O <opt> -H <heap>
   -M build/<name>.bas.map -o <name>.bin -I <zxbasic>/src/arch/zxnext/library -I Scripts
   -D ZXNEXT [--code-*] [-D BUILD_DATE=…]`.
   ASM sources: `sjasmplus --zxnext --fullpath --lst --lstlab` from PATH.
4. **Map patch** — `map_formatter` rewrites the zxbc map into CSpect's label format
   (`<map>.patched`).
5. **Code banks** (fork only) — compiler emits `<name>.bank<N>.bin` + `<name>.banks.json`
   (`{window, window_size, banks:[{bank,file,org,size,page,pages}]}`).
6. **NEX config** — `nexbuild.py` writes a Boriel `nextcreator` `.cfg`:
   `!COR3,0,0` · `!MMU Tools/sysvars.bin,10,$1C00` · optional `!BMP8` loading screen ·
   `!MMU` lines for packed assets and code banks · `!PCSP pc,sp` · the main `.bin`.
7. **Asset packing by text scan** — every `LoadSDBank("file", addr, len, offset, page)` call in
   the main source (comments and declarations skipped) becomes `!MMU <file>,<page>,<addr & $1FFF>`.
   `[]` → `system_data/`, otherwise `data/`. Arguments may be `CONST`/`#define` names ± n
   (resolved through `#include`s). Non-zero offset → a trimmed `data/tr_*.bnk` copy. `length`
   is ignored (whole file packed).
8. **Collision check** — byte ranges in a flat `page×8K+offset` space: code bank vs anything =
   fatal `##ERROR`; data vs data = `##WARNING`.
9. **NEX generation** — `nextcreator`: NEX V1.1 (V1.2 with entry bank), 2 MB RAM flag if any
   bank ≥ 48, core requirement 3.0.0, banks in NEX order 5,2,0,1,3,…
10. **Tidy + report** — intermediates move to `build/`; boxed report (8K banks used, per-bank
    sizes, total code, NEX size, PC/SP, free bytes) and a 32-slot memory gauge (yellow 60%,
    red 90%, warning 99%).
11. **Optional post-steps** — NextBASIC loader (`'!nb`), copy (`'!copy`), HDF sync, `'!exe`
    commands.

### 5.3 Outputs per project

| Path | Contents |
|---|---|
| `<name>.nex` | Final program, next to the source |
| `<name>_loader.bas` | Tokenised NextBASIC loader (`'!nb` only) |
| `build/<name>.bas.map` (+ `.patched`) | Label map (+ CSpect format) |
| `build/<name>.{bin,cfg,banks.json,bankN.bin}` | Intermediates |
| `data/` | Assets, module `.bin`s; SD-card root in CSpect |

### 5.4 Diagnostics

Compiler lines `<file>:<line>: error: <msg>` / `warning: [Wnnn] <msg>`; NextBuild's own coloured
`##ERROR` / `##WARNING` lines (missing bank file with expected path, bad `LoadSDBank` arguments,
page overlaps). The fork's bank-overflow error lists the 12 largest routines. No persistent log.

---

## 6. Programs larger than 32K

### 6.1 CODEBANK (v10, compiler fork) — the preferred mechanism

- **Syntax:** `CODEBANK n … END CODEBANK` around SUB/FUNCTION definitions, or
  `#pragma codebank = n` … `#pragma codebank = 0` (handy around `#include`). Call sites are
  unchanged.
- **Mechanism:** each banked routine keeps a 6-byte trampoline at its label
  (`call .core.__FAR_CALL / DEFB bank / DEFW body`). `__FAR_CALL` pages the bank into the code
  window (default `$6000–$7FFF` via NextReg `$53`; 16K window optional), keeps a 3-byte/level
  shadow stack and patches the return address to `__FAR_RETURN`, so stack frames are unchanged.
  Same-bank calls take a fast path. `__CODE_BANK_TABLE` maps logical banks to physical pages.
- **Bank-local data:** `DIM`s inside the block, module-level asm and labels, `INCBIN`. Reached
  from outside only via `FARPTR x` (uLong: bank in bits 16–23, address in 0–15) and
  `<farmem.bas>`: `FarPeek`, `FarPeekW`, `FarPoke`, `FarPokeW`, `FarCopy`, `FarCopyTo`, `FarStr`.
- **Stays resident:** runtime, strings, `DATA`, heap, non-bank globals.
- **Compiler-enforced rules:** bank fits the window; no direct cross-bank `GOTO`/`jp`/`call`; no
  outside references to bank-local symbols; no banked `#init`; no `ORG` in a bank; window must
  not overlap the program. Warnings W900 (ByRef across banks), W910 (bank with data but no
  routine), W920 (bare `@array`).
- **Not checked:** ISRs must not far-call or remap the window; SP must never be in the window.
- **Build integration:** directives → `--code-*` flags; the build reads `banks.json`, adds `!MMU`
  lines, checks overlaps, reports per-bank use. Map labels carry a `B<n>:` prefix.
- **Testing without hardware:** a Python `z80`-package harness (`CODEBANKS/run_far.py`) loads the
  `.bin`, bank bins and map and traps Next opcodes.

### 6.2 Modules (v8+, older overlay system)

- `Master.bas` (`'!org=57344`) owns the main loop, ISR and packed assets; modules are
  `Module<NNN>.bas` (`'!org=24576`, `'!module`, `'!master=Master.NEX`) compiled to `$6000`
  binaries copied into `data/`.
- At run time the master `LoadSD`s `moduleN.bin` to 24576 and calls it (SP saved by
  self-modifying code). **No linker** — the contract is fixed ORG, entry at ORG, and shared
  globals at fixed addresses (`includes/globals.bas`: `DIM … AT $4000+n`); `Game.cfg` on SD
  persists state between modules.
- Module binaries are **not packed into the NEX**; they load from SD (`data/` in CSpect, or HDF
  sync mode `modules`).
- Tasks: "MODULE: Build all modules & run" (`build.py -m -e`), "Build single module & run"
  (`build.py -s -e`). The help calls the system "not 100% complete".

---

## 7. The forked compiler `zxbasic 1.18.7-nb10`

| Aspect | Detail |
|---|---|
| Base | Upstream v1.18.7 (commit `e4d7f4ae`, 2025-11-23) + 10 cherry-picked v1.19.0 fixes |
| New language features | CODEBANK blocks, `#pragma codebank`, `FARPTR`, asm `CODEBANK` pseudo-op, `<farmem.bas>` |
| New CLI flags | `--code-window`, `--code-window-size 8192\|16384`, `--code-bank-base` (30), `--code-bank-pages a,b,…`, `--code-bank-depth` (16) |
| New outputs | `<name>.bank<N>.bin`, `<name>.banks.json`, banked labels in `.map` |
| Not added | No new arch (upstream already has `zxnext`), **no NEX output format** — NEX is built by NBS scripts + `nextcreator` |
| zxnext runtime changes (ROM/sysvar independence) | PAUSE polls raster NextReg `$1F` instead of ROM; RND seed and CHR$ temp moved off sysvars; STR$ wraps its ROM call with a sysvar-bank backup (needs `Scripts/zxnext_utils.asm` on the include path); heap fixes (alloc/free/calloc/realloc); `LBOUND_PTR` no longer uses MEMBOT |
| Other | `-O4` call/return-edge optimiser fix; `-O3/-O4` output not reproducible across runs; parser-cache fixes |
| Upstream status | Nothing submitted. Upstream v1.19 moved to Lark parsers (grammar source unpublished), so CODEBANK is "a port, not a merge" |
| Compatibility | Source that avoids CODEBANK/FARPTR/`#pragma codebank`/`farmem` is plain Boriel BASIC; the `Scripts/` libraries use no CODEBANK syntax and should build with upstream zxbc **(inferred, not compiled)**. Runtime behaviour of PAUSE/RND/CHR$/STR$/heap differs from upstream |

The NextBuild README warns against swapping in newer upstream compiler versions.

---

## 8. Runtime libraries (`NB10/Scripts/`)

Everything builds on `#include <nextlib.bas>` ("NextLib v10", ~4300 lines). nextlib starts with
`di`, sets `iy=$5C3A`, records IFF2, and (unless `NOSP`) moves SP into a 512-byte buffer inside
the program image.

### 8.1 nextlib core — by area

| Area | API |
|---|---|
| NextReg / Z80N | Macros `NextReg`, `nextregna`, `getreg`, `NextRegA`, `GetReg`; Z80N opcodes as `DB` (`MUL_DE`, `SWAPNIB`, `ADD_HL_A`, `PIXELADD`, `PIXELDN`, `OUTINB`, `TEST`, `PUSHD`, …); `out_dma(v)` |
| Paging | `PAGE_0000(A)`…`PAGE_E000(A)`, `MMU8`, `MMU8new`, `MMU16`, `GetMMU`, `swapbank` ($7FFD) |
| Bank memory | `BankPoke/Peek[Uint]`, `CopyToBanks`, `CopyBank`, `CopyFromBank`, `BankToRam`, `ClearBanks`, `ReserveBank`/`FreeBank` (NextZXOS `IDE_BANK`), `zx7Unpack` |
| Layer 2 | `InitLayer2(MODE256X192\|MODE320X256\|MODE640X256)`, `ShowLayer2`, `ClearLayer2`, `ClipLayer2`, `ScrollLayer`, shadow buffers (`EnableShadow`, `DisableShadow`, `FlipBuffer`/`SwapBuffers`) |
| Layer 2 drawing | `PlotL2`, `PointL2`, `PlotL2Shadow`, `CIRCLEL2`, `FPlotL2`, `FPlotLineV/W` (320×256), `DrawImage(x,y,table,frame)`, `LoadBMP`, `L2Text`, `FL2Text` |
| Software tiles on L2 | `DoTile8`, `DoTileBank8`, `DoTileBank16`, `FDoTile8`, `FDoTile16`, `TileMap(...)`, `ClipTile` |
| Sprites | `InitSprites`, `InitSprites2`, `ShowSprites`, `UpdateSprite(x,y,id,pattern,mflip,anchor)`, `RemoveSprite`, `ClipSprite` |
| Palette | `SetRGB`, `PalUpload`, `InitPalette`, `SelectPalette`, `SetPalette`, `GetPalette` |
| ULA | `ClipULA` |
| File I/O | `LoadSDBank(file,addr,len,offset,page)`, `LoadSD`, `SaveSD` (esxDOS) |
| Timing | `WaitRetrace(frames)`, `WaitRetrace2(line)`/`WaitRaster`, `RunAT(speed)` (CPU speed) |
| Audio switches | `EnableSFX`, `DisableSFX`, `EnableMusic`, `DisableMusic` |
| Input | `WaitKey()` (keys, Kempston 1/2, MD pad) — no mouse routine (examples ship their own) |
| Strings / debug | `NStr`, `BinToString`, `Console(s$)`, `dbMemory`, `Debug` |
| Emulator macros | `BREAK`/`BBREAK` = `DB $FD,$00` (CSpect breakpoint), `QUITEMU` = `DB $DD,$00`, `Console` uses `rst $18` |
| **Absent** | No copper, DMA or **hardware tilemap** routines — only constants; examples program them directly |

### 8.2 Companion libraries

| File | Purpose |
|---|---|
| `nextlib_primitives.bas` + `nb_PLOT.asm` | Mode-aware, clipping L2 primitives for all three modes (`L2SetMode`, `L2Plot`, `L2Line`, `L2Box`, `L2FillBox`, `L2Circle`, `L2FillCircle`, `L2Triangle`, `L2FillTriangle`, `L2Poly`, `L2FillPoly`, `L2ScrollTo`, `L2Cls`); designed to live in a CODEBANK (~4.1K) |
| `nextlib_rnd.bas` + `nb_RND.asm` | 32-bit xorshift PRNG: `RndSeed`, `RndByte`, `RndWord`, `RndBelow` (unbiased), `RndRange`, word variants |
| `nextlib_fmt.bas` + `nb_FMT.asm` | Heap-free number formatting: `FmtU8/16/32`, `FmtI16`, `FmtHex8/16`, `FmtFx` (8.8), `RJust`, `ZeroPad` |
| `nextlib_string.bas` | `PeekMem`, `PeekString`, `PeekMemLen`, `SplitString` |
| `nextlib_movie.bas` | L2 movie playback: raw frames (`PlayMovie`) and NMV delta-RLE (`NextMovieFrame`) |
| `nextlib_ay.bas` | Polled pure-BASIC AY access and simple SFX (`AYTone`, `AYNoise`, `AYEnvelope`, `AYPlaySFX`, `AYUpdate`) |
| `nextlib_filelib.bas` (v10) / `FileLib-inc.bas` (v9) | esxDOS file API: open/create/read/write/seek/size/delete, `fReadLine`, `fReadBanks`/`fSaveBanks`, directory listing/changing |
| `InputTile.bas`, `inputtile42.bas` | Text input on the hardware tilemap / 42-column input |
| `nb_constants.bas`, `nbs_constants.asm` | ~239 constants: ports, NextRegs, DMA commands, copper opcodes, palette selectors, esxDOS codes |
| `zxnext_utils.asm` | Save/restore MMU2 around ROM calls (sysvar bank `$0A`) |

### 8.3 Interrupt, music and sample drivers

Shared API: `InitMusic(playerbank, musicbank, offset)`, `NewMusic`, `PlayMusic`, `StopMusic`,
`InitSFX(bank)`, `PlaySFX(n)`, `SetUpIM`, `DisableIM`. PT3 player binaries (`vt24000.bin`,
`ts4000.bin` for TurboSound) and `.afb` effect banks live in 8K banks; during the ISR ROM is
paged out of MMU0/1. Drivers use fixed memory in `$FC00–$FDFF`.

| File | Timer | Extras |
|---|---|---|
| `nextlib_ints.bas` (`#define AYFX`) | IM2 on raster line 192 | PT3 + ayFX |
| `nextlib_ints_classic(_v2).bas` | same | v2: `PlaySFXA`, `SFXChip` (effects on AY2), bug fixes; must be included last |
| `nextlib_ints_ctc(2).bas` (`#define CTC`) | IM2 + CTC | `SetUpCTC`, `PlaySample`, `SetCTCSampleTable`, `StopSample`, `SetSampleVolume` |
| `nextlib_ctc_interrupts.bas` | CTC | 2 DAC channels (L/R) with volume tables; sample table `db count` + 8-byte entries (bank, offset, len, rate, vol, flags) |
| `nextlib_ctc_audio.bas` (newest) | CTC0 15625 Hz samples, CTC1 50 Hz music, line interrupt frame counter | 4 voices on the 4 DAC ports, 8.8 pitch, looping, bank auto-advance, `WaitFrame()` |

---

## 9. Running and debugging

### 9.1 Emulator contract (CSpect)

| Mode | Command |
|---|---|
| Run NEX | `CSpect.exe <CSPECT_ARGS> -map=<map>.patched -zxnext <nex> -mmc=<project>/data` (project `data/` = SD card) |
| Boot NextZXOS | `CSpect.exe <CSPECT_ARGS> -zxnext -mmc=img/cspect-next-2gb.img` |
| Default args (v10 config) | `-w3 -16bit -brk -vsync -basickeys -nextrom -exit` |
| Extension "Open with CSpect" | `<cspectPath> -w3 -esc -r -basickeys -brk -zxnext -16bit -mmc="{directory}/data/" <nex>` in a terminal |

Mono is used on Linux (macOS launch is broken — issue #38). Several CSpect versions can be kept
side by side and chosen in v10 settings. MAME and ZEsarUX were considered only as fallbacks
during CSpect's brief withdrawal in Nov 2025.

**Emulator conventions the libraries rely on:** `DB $FD,$00` breaks into the debugger (`-brk`),
`DB $DD,$00` exits the emulator (`-exit`), `rst $18` writes to the host console (`Console()`,
streamed to the IDE terminal via `--echo`), and `sysvars.bin` is preloaded into bank 10 at
`$1C00`. The full set of CSpect fake opcodes, including the older `$DD,$01` break and the
range-breakpoint opcodes, is in [§17.1](#171-what-are-cspect-breakpoint-opcodes).

### 9.2 Debugging

- All debugging happens **inside CSpect**: its own debugger (F1), breakpoints from
  `BREAK`/`BBREAK` in source, labels from the patched map file.
- em00k's CSpect plugins: **Bank Viewer** (live bank heat-map/edit), **Palette Viewer**,
  **Symbol Viewer** (live Boriel variable values).
- `Console()` debug output streamed to the IDE.
- **(not found):** IDE-side breakpoints, source-level stepping, Debug Adapter Protocol, DeZog
  wiring (the help only documents DeZog console commands).

---

## 10. Deployment: HDF sync, NextBASIC and real hardware

- **HDF sync** (`'!nb=` / `'!hdf=`, task "Sync Files to HDF"): `hdfmonkey mkdir`/`put` copies the
  NEX, the loader and `data/` into CSpect's **NextZXOS HDF image** — emulator only.
  `'!nb` parameters: `dir=` (target folder), `sync=all|nex|modules|selective`, `files=`,
  `copy=` (loader destination; autostart → `/nextzxos/autoexec.bas`), `basic=file.txt`
  (replaces the template). Shift+Space at NextZXOS boot skips the autoexec.
- **NextBASIC** is supported only as **generated loaders**: `nextbuild_basic.py` templates
  (`nex`, `nex_autostart`, `binary`, `binary_autostart`, `custom_dir`, `binary_custom_dir`,
  `development`) tokenised by `txt2nextbasic.py` (Kounch, GPL) into +3DOS files with
  `#autostart`/`#program` support. There is no NextBASIC editing/compiling support.
- **Real hardware:** **(not found)** NextSync, serial, Wi-Fi or remote run. Routes are manual:
  copy the NEX to the SD card, `'!copy=<mounted SD path>`, `'!exe=<command> {file}`, or write an
  HDF image to a card.
- The author hosts daily NextZXOS SD images "for CSpect and real machines".

---

## 11. AI-assistant support

- `NB10/Agents/` ships context documents for coding agents: `AGENTS.md` (layout, canonical
  build/launch commands, style), `nextlib.md` (23 KB: API map, directives and defines, Boriel
  compiler traps, inline-asm calling convention, CODEBANK, Layer 2 layouts, interrupts, testing
  with the Python `z80` package), `nextbuild.md` (v9.1-level CLI reference), `launch_cspect.md`,
  and the official `nextreg.txt` / `ports.txt` references (Klive has near-identical copies in
  `_input/next-fpga/`).
- Product page lists an "AI Code Assistant" without detail **(uncertain)**. Copilot does not work
  on the old VS Code base; Claude, Codex, Kilo and OpenCode extensions from Open VSX do.
- No MCP server or tool integration.

---

## 12. Settings

**Extension (`nextbuild-viewers.*`, 25 keys):** `playpt3Path`, `cspectPath`, `cspectArgs`,
`respectExistingIconTheme`, `showSponsorPage`, `licenseKey`, `licenseType` (free/premium — gated
features undocumented), `keywordHelp`, `hoverHelp.enable`, `completion.enableKeywords`,
`completion.enableConstants`, `linting.enable`, `linting.pythonPath`, `linting.compilerPath`,
`linting.compilerArgs`, `linting.rootFolderForIncludes` (also the cwd of every task),
`linting.hiddenWarnings`, `linting.hideAllWarnings`, and seven update settings (`checkForUpdates`,
`autoCheckUpdates`, `updateServer`, `checkForComponentUpdates`, `checkForRootUpdates`,
`componentUpdateServer`, `rootUpdateServer` — the zxnext.uk URLs currently return 404).

**Toolchain (`Scripts/nextbuild.config`):** `CSPECT`, `ZXBASIC`, `TOOLS`, `IMG_FILE`, `HDFMONKEY`,
`CSPECT_ARGS`, `DEFAULT_HEAP`, `DEFAULT_ORG`, `DEFAULT_OPTIMIZE`, `NEXTZXOS_ENABLED`/`_PATH`
(written, never read). Edited through a Tk GUI (`module.py`, tabs Paths / CSpect / Settings /
NextZXOS / Editor) or `update-config.py` (CLI; also rewrites `tasks.json`).

**Updates:** `update.py` fetches the newest CSpect from itch.io (via `itch-dl`);
`image_wrapper.py` downloads the NextZXOS HDF; the extension has a three-tier self-updater
(extension, components, root folder).

---

## 13. Examples catalogue

159 `.bas` files under `Sources/NextBuild_Examples/`, using ~40 asset types (most common: `.spr`,
`.nxp`, `.nxt`, `.nxi`, `.bmp`, `.raw`, `.nxm`, `.pt3`, `.pcm`, `.afb`, `.zx7`, `.zx0`, `.mod`,
`.nmv`/`.nms`).

| Category | Highlights |
|---|---|
| `1_STARTHERE` | Program skeleton, Boriel basics, NextZXOS autostart sync |
| `2_INTRODUCTION` | Hello text, keyboard input |
| `CODEBANKS` (17) | Smallest banked program, asm blocks, banked screens (replacing MODULES), banked includes, Layer 2 in banks, deep nesting, ISR rules, bank-local data, 16K window, `farmem`, tests + `run_far.py` harness |
| `DISKIO` | FileLib: append log, copy, hex dump, read line, directory listing, load/save banks, PSG/VGM streaming from SD; SD BMP/`LoadSD`/`SaveSD` |
| `FULLPROGRAMS` | DOTJAM (NextSID, copper, hardware tilemap), MOD-player demos |
| `GAMES` | Crimbo (tilemap, L2, sprites, PT3, ayFX), HoleyMoley, JumpyMoley (scrolling, copper PCM) |
| `GRAPHICS` | Copper gradients and DMA-driven copper, DMA sprite upload, `DrawImage` panels, delta movies, primitives in a CODEBANK, hardware-tilemap text mode, L2 image/tile drawing, top-down world scrolling, Layer 2 mode switching, L2 text fonts, panel movies (streamed and banked), sprites (scale/rotate, 4-bit), ULA scroller |
| `INPUT` | Kempston / MegaDrive / keyboard tester |
| `MODULES` | ModuleDemoII (overlays, copper, mouse), ModuleTemplate |
| `OTHER` | CSpect console output, custom ISR, tilemap debug window, number formatting, RNG, mini examples |
| `SOUND` | Polled AY SFX, PT3 + ayFX, TurboSound, AY register tester, copper-driven PCM (1–2 voices) |

23 examples need the nb10 fork (all of CODEBANKS plus DrawPrimitives, NumberFormat,
RandomNumbers, TestAY, PanelMovies Example2, copper_2voice_CODEBANK).

---

## 14. Version history (headline features)

| Version | Date | Headline |
|---|---|---|
| NextBuild 0.2b–0.6 | 2018 | BorIDE + zxb + CSpect glue; NextLib; AYFX; post-compile copy directives |
| NextBuild v7 | 2020/21 | Moved to VS Code; hover help, snippets, NEX output, Python scripts |
| 7.51 | 2024-03 | `.map` output |
| NextBuild v8 | 2024-06 | Modules, F6 build menu, TurboSound PT3, CTC/copper samples |
| NextBuild 0.7.6.0 | 2025-09 | Last NextBuild release (CSpect 3.0.2, `BREAK` = `DB $FD,$00`) |
| NBS preview / public | 2025-07-06 / 07-28 | VS Code fork; linting, F1 help, block/palette/image editors, AYFX, installer (Windows) |
| NBS 1.0.1–1.0.4 | 2025-09/10 | Linux, CSpect/NextZXOS auto-setup, HDF sync, `Console()` output, Outline, Peek references, variable suggestions |
| NBS 1.1.0 | 2025-11-08 | Canvas sprite editor, Image Importer, Animation Sequencer, Snapshot Manager, Sample Packer, 3 CSpect plugins |
| NBS v10 (1.1.25 / 1.2.0) | 2026-08-28/29 | CODEBANK compiler fork, primitives/rnd/fmt/movie libraries, hex editor, webview PT3 player, rewritten help and settings, map RAM visualiser, `.asm` projects, `'!exe` hooks |

---

## 15. Known limitations and inconsistencies

- Build/run live in Python tasks, not the extension; the v10 `tasks.json` and `project_config.py`
  (imported by v10 `build.py`) are **missing from the repo**.
- Asset packing relies on a text scan of `LoadSDBank(` in the main file only; lengths ignored;
  variable arguments need `'!nonex`.
- `'!nb files=a,b` keeps only the first file; v10 syncs `data/*` to `<dir>/` while docs say
  `<dir>/data/`; `Docs/Templates.md` and `Agents/nextbuild.md` are stale.
- `nextbuild.config` says `ZXBASIC=zxbasic1.18.7` while the shipped folder is `-nb10`; some
  examples load `[]font*.spr` files that aren't shipped.
- CSpect is closed and non-redistributable — the project's single point of failure.
- macOS unofficial (issues #36–#38); AYFX multi-channel WIP; Peek references same-file only.
- Extension source and IDE-fork source are not public; the extension licence field conflicts
  with the README.

---

## 16. Relevance to Klive (first pass — to be refined)

| NBS capability | Klive today | Notes |
|---|---|---|
| Boriel zxbc integration | Yes — upstream `zxbc` via `src/main/zxb-integration/`, templates for sp48/sp128 only | No `--arch=zxnext`, no zxnext ZX BASIC template, no NEX output from zxbc builds yet |
| NEX creation | Yes for Klive's own assembler (`nexConfig` in `KliveCompilerCommands.ts`) | NBS packs via `nextcreator` + header directives + `LoadSDBank` scan |
| Header directives as project config | — | Candidate model: `'!org/heap/opt/pc/sp/bmp/nosys/codebank*` map cleanly to build settings |
| Live linting via `--parse-only` | Unverified | Cheap to replicate with the existing zxbc path |
| F1 / hover help content | — | NBS help JSON is authored separately (licence of the help repo to be checked) |
| Asset editors | `.spr`, `.pal`/`.npl`, `.nxi` editors; `.sl2`/`.slr`/`.scr`/`.shc`/`.shr` viewers | Gaps: tiles/fonts (`.til`/`.fnt`/`.nxt`), blocks/maps (`.nxb`/`.nxm`), image importer, AYFX, PT3 |
| Emulator run with SD folder | Klive has an SD-card path (`copyToSdCard`) | NBS mounts `data/` as the SD root; Klive would need the equivalent |
| CSpect conventions (`DB $FD,$00`, `DB $DD,$00`, `rst $18`, sysvars preload) | Fake opcodes: **not handled** by the Next WASM core (§17.1); `rst $18` and sysvars preload unverified | Needed to run NBS-style programs unchanged |
| Source-level debugging | Klive has an integrated debugger | **NBS has none** — the clearest area where Klive can add value |
| CODEBANK | — | Depends on the nb10 compiler fork; banked labels (`B<n>:` map prefix) would need debugger support |
| HDF/NextZXOS sync | — | NBS targets an emulator HDF via hdfmonkey |

---

## 17. Query log

Append a sub-section per follow-up question: the question, the answer, sources, and which
sections above were updated.

### 17.1 What are CSpect breakpoint opcodes?

_Asked 2026-09-26. Updated §9.1 and §16._

CSpect gives certain byte sequences, which do nothing useful on a real Z80N, a debugging meaning
when a command-line switch enables them. They are **emulator conventions, not Z80N
instructions**. sjasmplus assembles them as "fake instructions" only under
`--zxnext=cspect`; Boriel BASIC programs emit them as raw `DB` bytes through nextlib macros.

| Mnemonic (sjasmplus) | Bytes | CSpect switch | Effect | Since |
|---|---|---|---|---|
| `break` | `FD 00` | `-brk` | Stop and open the debugger at this point | CSpect 2.19.9.1 |
| `break` (old) | `DD 01` | `-brk` | Same, older encoding | before 2.19.9.1 |
| `exit` | `DD 00` | `-exit` | Quit the emulator | — |
| `setbrk tt,start,end` | `ED 01 tt ss ss ee ee` | `-cspect` | Set a breakpoint over an address range | CSpect 3.0.1.5b (~Feb 2025) |
| `clrbrk tt,start,end` | `ED 02 tt ss ss ee ee` | `-cspect` | Clear a range breakpoint | CSpect 3.0.1.5b |

For `setbrk`/`clrbrk`, `tt` is the breakpoint type (0 execute, 1 memory read, 2 memory write,
3 port out, 4 port in), and start and end are 16-bit little-endian addresses.

**How NextBuild uses them.** nextlib defines `BREAK`/`BBREAK` as `DB $FD,$00` and `QUITEMU` as
`DB $DD,$00`; `#define NOBREAK` compiles the breakpoints away. Before NextBuild 0.7.6.0 (which
moved to CSpect 3.0.2.0) the macro was `DB $C5,$DD,$01,$00,$00,$C1`: the old break wrapped in
`push bc`/`pop bc` with two NOPs. NBS always launches CSpect with `-brk`, and the v10 config
adds `-exit`. NextBuild does not use `setbrk`/`clrbrk`.

**Behaviour outside CSpect (inferred from standard Z80 prefix rules).**
- `FD 00`, `DD 00` and `DD 01`: an index prefix followed by a non-indexed opcode is ignored, so
  these run as a NOP, or as `ld bc,nn` for `DD 01`. The old `DD 01` break therefore consumed the
  next two bytes as an operand, which is why the old macro padded it with `$00,$00` and saved BC.
- `ED 01` / `ED 02` run as a two-byte NOP, and **the five operand bytes after them then execute
  as code**. `setbrk`/`clrbrk` are therefore not safe to leave in a build for real hardware
  or other emulators.

**Klive today.** The Next WASM core (`src/emu/machines/zxNext/wasm/zxnext/`) has no handling
for any of these sequences (searched for CSpect, fake-opcode and byte-pattern references;
none found), so an NBS program's `BREAK` runs as a NOP in Klive. Klive's sjasmplus integration
selects the Next device but was not checked for `--zxnext=cspect`. Supporting `FD 00` as a
break and `DD 00` as exit would let NextBuild-style programs stop in Klive's debugger unchanged,
ideally behind a machine option equivalent to `-brk`/`-exit`.

**Sources:** sjasmplus `sjasm/z80.cpp` (`OpCode_Next_BREAK`, `_EXIT`, `_SETBRK`, `_CLRBRK`) and
`tests/z80n/op_cspect_emulator.asm`; sjasmplus documentation (`--zxnext=cspect`, version notes);
[sjasmplus issue #238](https://github.com/z00m128/sjasmplus/issues/238) (break changed to
`FD 00`); NextBuild `CHANGELOG.md` (0.7.6.0) and the v9 `nextbuild.py` macro;
NBS `Scripts/nextlib.bas` and `nextbuild.config`.

### 17.2 What does the zxbasic licence allow for a TypeScript ZX BASIC compiler in Klive?

_Asked 2026-09-26. Not legal advice; a reading of the licence texts and the repo._

**The licences in `boriel-basic/zxbasic`**, checked 2026-09-26 on branch `main`:

| Part | Where | Licence |
|---|---|---|
| Compiler: `zxbc`, `zxbasm`, `zxbpp`, parser, semantic checks, backend, optimiser, peephole rules | `src/` except `src/lib/`, plus the root `.py` launchers | **AGPL-3.0-or-later**: `LICENSE.txt`, plus SPDX headers in the `.py` files. Copyright Boriel and contributors (`CONTRIBUTORS.md`) |
| Runtime (asm) and standard library (`.bas`) | `src/lib/arch/<arch>/runtime`, `src/lib/arch/<arch>/stdlib` | **MIT**, per the README. The README still names these folders by their old names, `library/` and `library-asm`. Most files carry an MIT header; some zx48k/zx81sd runtime files have no header and rely on the README's rule |
| Documentation | `docs/` | **CC BY 4.0** (`docs/LICENSE.txt`) |
| Programs you compile | — | Yours. The README explicitly allows closed-source and commercial programs |

The README also states the intent: the compiler may not be released closed-source, and anyone
who modifies it and runs it as part of a SaaS service must publish the changes.

**What this means for a TypeScript compiler.**

1. **An independent implementation can be MIT, like Klive.** Copyright protects code, not the
   language, its syntax and semantics, CLI flag names, or file formats. A compiler for the same
   language written from the documentation and from black-box behaviour carries no AGPL
   obligation. Running zxbc to compare outputs (differential testing) is allowed: the AGPL
   doesn't restrict running the program, and its output isn't covered.
2. **A port is a derivative work, and would be AGPL.** Translating the Python source to
   TypeScript produces an AGPL-3.0-or-later program. That covers the parser grammar, AST and
   visitors, backend code templates, optimiser and peephole rule files, whether the translation
   is done by hand or by an AI tool. Writing new code with the Python open side by side is where
   the risk sits; keep to specifications, docs and observed behaviour.
3. **The MIT runtime and stdlib can be reused directly.** These are the parts that matter most
   for compatibility: calling conventions, the 5-byte float format, the heap, strings, PRINT and
   the ROM-free Next routines. They may be bundled into Klive, modified and redistributed, as
   long as the copyright and MIT notice are kept. A TypeScript compiler that emits calls into
   this runtime stays MIT. The files with no header are covered only by the README rule, which
   names old folder paths; it is worth asking the author for written confirmation.
   *Project decision (2026-09-26): Klive BASIC does **not** reuse the upstream runtime at all; it
   writes its own, compatible at the interface level. See `.plans/ZXBASIC_COMPILER_PLAN.md` D2.*
4. **The docs can be adapted with attribution** (CC BY 4.0), for example as F1 help. Credit the
   source, link the licence, and say what was changed.
5. **If Klive ever uses an AGPL compiler** (a port, or zxbc or the NextBuild fork bundled in),
   keep it as a separate program that Klive calls through a CLI or IPC, as Klive does with zxbc
   today. The pair is then "aggregation" and Klive stays MIT; the compiler's source must still
   be offered under AGPL. Linking it into Klive's own bundle would make the distributed whole
   AGPL. The network clause only matters if the compiler is offered as a service, such as a
   web version of Klive.
6. **NextBuild's `1.18.7-nb10` fork is AGPL too.** Its CODEBANK implementation can't be copied
   into an MIT compiler, but the feature can be reimplemented from its documentation:
   the syntax, the trampoline design and the `banks.json` manifest are ideas and interfaces.
   The test suites (`tests/`) are AGPL; run them from a separate checkout rather than copying
   test programs into Klive.
7. **The licence can't be changed after the fact.** Code by several contributors can't be
   relicensed without all of them. Boriel could give permission for his own code only.
8. **Use a distinct name.** Presenting the new compiler as "Boriel ZX Basic" or as official
   isn't a copyright issue, but avoiding it prevents confusion.

**Sources:** <https://github.com/boriel-basic/zxbasic>: `LICENSE.txt`, `README.md` (licence
section, last changed 2026-01-13), `docs/LICENSE.txt`, SPDX headers in `src/zxbc/zxbc.py` and
`src/arch/z80/backend/__init__.py`, and MIT headers in `src/lib/arch/*/runtime` and `stdlib`.

---

## Sources

- NBS repo: <https://github.com/em00k/NextBuildStudio> (README, LICENSE, `bare-bones-files/NextBuildv10/**`, `bare-bones-files/LegacyV9/**`, `vsix-extensions/`)
- Extension manifest (Marketplace, 0.9.9): `em00k.nextbuild-viewers`
- Help content: <https://github.com/em00k/NextBuild-Studio-Help>
- NextBuild (pre-NBS): <https://github.com/em00k/NextBuild> (CHANGELOG), <https://github.com/em00k/NextBuildStudio-barebones>, <https://github.com/em00k/NextBuildPro>
- Product site: <https://zxnext.uk/nextbuildstudio/>, docs <https://zxnext.uk/docs/>, CSpect plugins <https://zxnext.uk/cspectplugins/>
- Wiki: <https://wiki.specnext.dev/NextBuildStudio:Main_Page>
- Release posts: <https://www.patreon.com/cw/u27217558>
- CSpect: <https://mdf200.itch.io/cspect>
- Upstream compiler: <https://github.com/boriel-basic/zxbasic>
