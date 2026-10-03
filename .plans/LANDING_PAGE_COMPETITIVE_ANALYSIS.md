# Klive vs. ZX Spectrum Development Environments — Competitive Analysis and Landing-Page Content

Status: **for review** (2026-10-02). Feeds the next phase of
[LANDING_PAGE_PROTOTYPE_PLAN.md](LANDING_PAGE_PROTOTYPE_PLAN.md).

How this was produced: a repo sweep of Klive (README, CHANGELOG, `docs/content`, `.ai/`, `.plans/`,
`src/`), plus web research on the competing tools (official docs, GitHub READMEs and APIs,
release notes, Marketplace pages, Spectrum Computing forums), all as of 2026-10-02. The research
marked which competitor facts were checked against a page and which were not; those it could
not check are marked **(unverified)** here. Check them before anything is said on a public page.

---

## 1. The field

| Tool | What it is | Machines | Platforms | Licence / activity |
|---|---|---|---|---|
| **ZEsarUX** | Emulator with a deep built-in debugger; ZRCP remote protocol | 16K–+3, Next, and many others (QL, Z88, CPC, MSX…) | Win / Mac / Linux | GPLv3; 13.0, Jun 2026; 431★ |
| **CSpect** | Mike Dailly's Next emulator and dev kit, text-mode debugger | Next only | Win (Mac/Linux via Mono) | Free, closed source, "no support"; 3.3.x |
| **DeZog** | VS Code debugger front end for zsim, ZEsarUX, CSpect, MAME and real Next hardware | 48K/128K/ZX81/Next via its remotes | Wherever VS Code runs | MIT; 3.7.x; 276★, about 10.8k installs |
| **Fuse** | The accuracy reference emulator | 16K–+3e, Pentagon, Scorpion, Timex; **no Next** | Win / Mac / Linux | GPLv2+; active again in 2026 (1.10.0) |
| **sjasmplus** | The de facto Next assembler (Lua, `SAVENEX`, SLD debug output) | — | All | BSD-3; 1.24.0 |
| **NextBuild + Boriel ZX Basic** | Boriel compiler, NextLib, VS Code extension, CSpect | Next | All | 0.7.6 (Sep 2025) |
| **ZX Basic Studio** | Avalonia IDE for Boriel BASIC; BASIC breakpoints (reported buggy) | 48K/128K; Next via MAME (beta) | All | MIT; 1.8 beta |
| **Spectrum Analyser** | Best-in-class reverse-engineering workbench | 48K/128K; **no Next** | Win / Mac / Linux | MIT; weekly builds |
| **SpecEmu / ZX Spin / Zeus** | Windows emulators and IDEs with debuggers (Spin has a built-in assembler; Zeus has an editor, assembler and emulator) | 48K/128K(/+3) | **Windows only** | Freeware; SpecEmu last released 2023, Spin abandoned, Zeus 4.17 (2025) |
| **MAME** | General emulator; expression breakpoints, Lua, gdbstub (used by DeZog) | Includes a Next driver (unverified depth) | All | GPL; ongoing |

What the field looks like:
- **Next developers today combine several tools**: an assembler (sjasmplus), an editor (VS Code plus
  Z80 Macro-Assembler or ASM Code Lens), an emulator (CSpect or ZEsarUX) and a debugger bridge (DeZog).
- **No other tool offers one integrated IDE** with emulator, editor, assembler, compiler and debugger
  in a single app on all three desktop platforms. The ones that come close (Zeus, ZX Spin) are
  Windows-only, 48K/128K-only, and in Spin's case abandoned.

---

## 2. Feature comparison

**Key:**
- ✅ strong / ◐ partial / ✗ missing / ? unverified.
- Klive items marked **(main)** are merged but **unreleased** — the last tag is v0.61.0.
- The **ZEs + DeZ** column is ZEsarUX used through DeZog, which is how most developers use it.

| Capability | **Klive** | ZEs + DeZ | CSpect | Fuse | Spectrum Analyser | NextBuild / ZXBS |
|---|---|---|---|---|---|---|
| All-in-one app (no tool assembly needed) | ✅ | ✗ (3–4 tools) | ✗ | ✗ | ✗ | ◐ (VS Code + CSpect) |
| Win / Mac / Linux | ✅ | ✅ | ◐ (Mono) | ✅ | ✅ | ✅ |
| 48K / 128K / +2E / +3E | ✅ | ✅ | ✗ | ✅ (reference accuracy) | ◐ (48/128) | ◐ |
| ZX Spectrum Next | ✅ C/WASM core that cites the FPGA VHDL; about 30-area hardware test suite | ✅ | ✅ (reference dev kit) | ✗ | ✗ | via CSpect / MAME |
| Other machines | Z88, **ZX80 / ZX81 (main)** (C/WASM core: SLOW and FAST modes, WRX hi-res, `.P`/`.O` fast and real-time load, debugger), C64 (experimental) | Very wide | ✗ | Many clones | CPC, C64 | ✗ |
| Editor with language intelligence | ✅ Monaco with compiler-driven completion, hover (incl. macro expansion), rename, references, inlay hints, colour pickers — for asm **and Klive BASIC** (scope-correct hover, definition, references, rename, completion with auto-`#include`, signature help, outline, folding; unreleased) | ✅ (VS Code extensions) | ✗ | ✗ | ✗ | ◐ |
| Built-in assembler | ✅ Klive Z80/Z80N: macros, structs, modules, `.savenex`, `.dma` DSL | ✗ (external) | ✗ | ✗ | ✗ | ✗ |
| External toolchains | ✅ sjasmplus (with SLD), zxbc, z88dk, PASTA/80 | ✅ sjasmplus, z80asm, z88dk | map files | ✗ | SkoolKit | Boriel |
| Built-in BASIC compiler | ✅ **(main)** Klive BASIC, Boriel 1.19 + CODEBANK compatible | ✗ | ✗ | ✗ | ✗ | Boriel (external) |
| **BASIC source-level debugging** | ✅ **(main)** statement stepping, symbolic call stack, editable variables, Just My Code, error stops | ◐ (BASIC/vars viewers only) | ✗ | ✗ | ✗ | ◐ (ZXBS, reported buggy) |
| Asm source-level debugging | ✅ (Klive asm; sjasmplus only tested on 48K) | ✅ | labels only | ✗ | ✗ | ✗ |
| Exec / memory / I/O breakpoints | ✅ incl. bank-relative and partition-scoped; **(main)** every data access of an instruction is watched | ✅ | ◐ | ✅ | ✅ | via CSpect |
| NextReg write breakpoints (value/mask, copper, old→new) | ✅ **(apparently unique)** | ? | ? | ✗ | ✗ | ✗ |
| **Conditional / hit-count breakpoints, logpoints** | ✅ **(main)** conditions (registers, flags, memory in any bank, accessed value/address, paging, NextRegs, program and NEX labels) and hit counts on every breakpoint type, with a live count; logpoints with formatted messages, groups and DeZog `LOGPOINT` source comments (Klive assembler and sjasmplus); DeZog `ASSERTION` and `WPMEM` comments with value-reporting stop messages and per-project switches; one-shot breakpoints of every kind (Shift+click); memory watchpoints over ranges, also made from a Watch row | ✅ | ? | ✅ | ✅ (SpecEmu too) | ✗ |
| **Reverse debugging / execution history** | ✗ | ✅ | ? | ✗ | frame trace | ✗ |
| **Unit tests / code coverage / profiler** | ✗ | ✅ (DeZog only) | ✗ | profiler | memory diff | ✗ |
| Call stack, watches | ✅ (+ BASIC call stack) | ✅ | ? | ✗ | ✅ | ◐ |
| Disassembly insight | ✅ branch verdicts (taken/not-taken, T-state cost), system-variable operands, T-state measuring | ✅ | ◐ | ◐ | ✅ | ✗ |
| NEX reverse engineering | ✅ debug any .nex with no project, live bank vs. file diff, `.nex.dis` annotations, `nex-label` | ◐ (DeZog Analyze: call graph, flowchart) | ✗ | ✗ | ✗ (no Next) | ✗ |
| General reverse engineering (48K/128K) | ◐ (live disassembly only) | ◐ | ✗ | ✗ | ✅ auto code/data detection, annotated ROM, SkoolKit, graphics finder | ✗ |
| **Live Next sprite / Copper / layer inspectors** | ✗ (NextReg, MMU, palette panels only) | ✅ (ZEsarUX) | ? | — | — | ✗ |
| Next asset editors | ✅ sprite editor (.spr), palette editors (.pal/.npl/.nxi), image viewers | ✗ | ✗ | — | — | ✗ |
| NextZXOS boot, SD image | ✅ cached boot; `ncp` host↔image copy through a built-in FAT32 driver | ✅ | ✅ (bundled hdfmonkey) | — | — | via CSpect |
| Load .sna / .z80 / .szx snapshots | ✗ (viewers only) | ✅ | ✗ | ✅ | ✅ | — |
| RZX recording / playback | ✗ | ? | ✗ | ✅ | ✅ | ✗ |
| Tape / disk | ✅ TAP/TZX (all blocks), tape viewer, DSK create/view | ✅ | — | ✅ | ◐ | — |
| Export | ✅ TAP / TZX / HEX with generated BASIC loader and loading screen, NEX | ◐ | — | — | ✅ SkoolKit | NEX |
| Scripting / automation | ◐ Klive Script (.ksx) with build-pipeline hooks; no remote protocol | ✅ ZRCP, JS peripherals | ✅ C# plugins | ✗ | ✅ Lua | ✗ |
| Debug on real Next hardware | ✗ | ✅ (DeZog serial) | ✗ | — | — | ✗ |
| Video recording of emulator plus IDE | ✅ (bundled FFmpeg; side-by-side capture verified on macOS) | ✗ | ✗ | ◐ | ✗ | ✗ |
| Integrated hardware reference | ◐ "Inside the ZX Spectrum Next" book (chapters 1–8 and three appendices written) | ✗ | ✗ | ✗ | ✗ | ✗ |

---

## 3. Where Klive is strong

1. **One app, no assembly required.** The emulator, a Monaco editor with real language intelligence,
   the assembler, a BASIC compiler and the debugger ship together on Mac, Windows and Linux.
   Compile, inject, run and debug take one click, and project templates cover sp48, sp128, +3E,
   Z88 and Next × Klive asm, ZX BASIC, sjasmplus, PASTA/80 and z88dk. Competitors need three or four
   separately installed tools wired together through launch.json and map files.
2. **BASIC as a first-class debug language** (on main). No competitor offers reliable
   source-level debugging for ZX BASIC: ZEsarUX only views BASIC, and ZX Basic Studio's breakpoints
   are reported broken. This is the clearest gap in the market, and Klive fills it.
3. **Next-native workflow.** NextReg write breakpoints, bank-relative breakpoints and watchpoints,
   Next register and MMU panels, a `.dma` assembler DSL, `.savenex` with copper, palette and
   loading bar, sprite and palette editors, SD-image file copy and a cached NextZXOS boot.
4. **NEX reverse engineering.** You can debug any `.nex` with no project, break at its entry point,
   compare a live bank with the file, and keep labels, comments and regions in a sidecar. Spectrum
   Analyser, the reverse-engineering leader, has no Next support at all.
5. **Code understanding in the disassembly.** It shows branch verdicts with the actual T-state
   cost, names system variables as operands, measures T-states between points, and has an Instant
   Screen view, a BASIC listing read from live memory, and a ULA panel showing beam phase,
   contention and floating bus.
6. **Engineering credibility.** The Next core is C/WASM and cites the VHDL in about 150 places;
   there are per-opcode Z80 tests, a hardware test catalogue, and visual tests on the real ROMs.
7. **Content creation.** Built-in emulator and IDE video recording, which is useful for tutorials
   and streams.

## 4. Where Klive is weak (missing features)

Ranked by how much each gap would matter to an experienced Spectrum or Next developer comparing
tools:

| # | Gap | Who has it | Notes |
|---|---|---|---|
| W1 | ~~**Logpoints**~~ — closed on main (G1.4, with conditional breakpoints and hit counts; G1.5 DeZog ASSERTION/WPMEM comments and G1.6 one-shot breakpoints done too; unreleased) | ZEsarUX, DeZog, Fuse, SpecEmu, MAME | An annotated DeZog project's LOGPOINT, ASSERTION and WPMEM comments all work unchanged. Remove the README roadmap entry for conditions and logpoints once released. |
| W2 | **Reverse debugging / execution history** | DeZog (zsim, ZEsarUX), ZEsarUX, Zeus | DeZog's most-praised feature. |
| W3 | **Unit tests and code coverage, profiler** | DeZog; Fuse and Zeus profilers | Klive has a strong internal test harness, but nothing user-facing. |
| W4 | **Live Next hardware inspectors** (sprites, Copper list, Layer 2 / tilemap / layer composition) | ZEsarUX; DeZog sprites | Large impact for a "Next IDE"; Klive has only NEX-file sprite and image views. |
| W5 | **Snapshot loading (.sna / .z80 / .szx) and RZX** | Fuse, ZEsarUX, Spectrum Analyser | Basic table stakes for 48K/128K users; Klive only *views* them. |
| W6 | **No remote or real-hardware debugging**, no external API | DeZog (serial), ZEsarUX ZRCP, CSpect plugins, MAME gdbstub | Shuts Klive out of the VS Code/DeZog ecosystem. |
| W7 | **48K/128K reverse-engineering depth** (automatic code/data detection, annotated ROMs, SkoolKit, graphics finders) | Spectrum Analyser | Klive's annotation model exists for NEX only. |
| W8 | ~~**BASIC editor intelligence**~~ — closed on main (G8.1–G8.5; unreleased) | — (also weak elsewhere) | Hover, definition, scope-correct references and rename, completion (library routines add their `#include`), signature help, outline and folding for `.zxbas`, from the compiler's own binder. With zxbc selected, keyword help, completion and folding remain. |
| W9 | **Machine breadth**: ~~ZX80/ZX81~~ (closed on main, G9.3; unreleased), Pentagon/Scorpion/Timex | ZEsarUX, Fuse | The ZX80 and ZX81 (1K/16K/64K, PAL and NTSC, the ZX80 with the 8K ROM) run on one C/WASM core built on the shared Z80 (.plans/ZX8081_WASM_PLAN.md). Pentagon/Scorpion/Timex remain. |
| W10 | **Proof points**: Next accuracy is unbenchmarked against CSpect/ZEsarUX publicly; sjasmplus debugging tested on 48K only | — | A credibility gap more than a feature gap. |

### Housekeeping found during the sweep (fix before marketing anything)
- **Klive BASIC is unreleased.** The BASIC compiler and its debugger are on main after v0.61.0
  with no CHANGELOG entry. The landing page must not lead with them until a release ships them.
- **`docs/content/machine-types.mdx` still says the Next is "still in development"**, which
  contradicts the README.
- **The README roadmap lists memory and I/O breakpoints and custom ROMs as planned**, but both
  are shipped. The README "Technology" section still describes pure-TypeScript emulators; they
  are now C/WASM.
- **The book is partial**: chapters 9–22 are stubs. Present it as "in progress" if it is mentioned.

---

## 5. Landing page: the five features where Klive is ahead

The choice follows two rules: each feature must be **something no single competitor matches**,
and it must be **visible in a screenshot or a 20–40-second clip**. Order: broadest appeal first,
deepest specialism last.

### Hero
- **Headline:** *The complete ZX Spectrum and Next development studio.*
- **Subhead:** *Write, assemble, compile, run and debug Z80 code and ZX BASIC in one app, on Mac,
  Windows and Linux. No toolchain to wire up.*
- **CTAs:** Download (OS-detected) · Documentation.
- **Media:** a 30-second looped, muted clip of the whole loop: edit code → Ctrl+F5 → the program
  runs in the emulator → a breakpoint hits → step. Record it with Klive's own IDE and emulator
  recording.

### Feature 1 — Everything in one place
- **Title:** *One app. Zero glue.*
- **Copy:** Emulator, editor, assembler, BASIC compiler and debugger, built to work together.
  Start from a template for 48K, 128K, +3E, Next or Z88 and press Run. Elsewhere this takes an
  assembler, an editor, an emulator and a debugger bridge, configured by hand.
- **Proof bullets:** one-click Compile → Inject → Run → Debug · project templates · works with
  sjasmplus, Boriel zxbc, z88dk and PASTA/80 when you want them.
- **Media:** a screenshot of the dual-window layout (IDE + emulator) on a project.
- **Beats:** DeZog + CSpect/ZEsarUX + VS Code; NextBuild.

### Feature 2 — Debug ZX BASIC like a modern language *(feature only after Klive BASIC is released)*
- **Title:** *Step through your BASIC, line by line.*
- **Copy:** Klive's built-in ZX BASIC compiler, compatible with Boriel ZX Basic and NextBuild
  CODEBANK, debugs at the source level: breakpoints on statements, Step Over and Step Into, a
  real call stack, live variables you can edit, and stops on runtime errors.
- **Media:** a clip of a breakpoint in a `SUB`, stepping, then editing a variable in the
  Variables panel.
- **Beats:** everyone; this need is currently unmet (ZX Basic Studio's version is reported broken).
- **Fallback if not yet released:** swap in Feature 6 below.

### Feature 3 — Built for the Next, down to the registers
- **Title:** *Speaks Next natively.*
- **Copy:** Break when a game writes a NextReg, with value and mask filters, Copper writes and
  old→new values. Set breakpoints and watches on banks rather than addresses. Program the DMA with
  a symbolic `.dma` assembler syntax, and build `.nex` files with palettes, copper and loading
  bars. Edit sprites and palettes in the IDE, copy files onto the SD image, and boot NextZXOS
  from a cached state.
- **Media:** a three-image strip: a NextReg breakpoint hit with old→new values · the Memory
  Mapping panel · the sprite editor.
- **Beats:** CSpect (text debugger), ZEsarUX (general-purpose UI).

### Feature 4 — Take any .nex apart
- **Title:** *Open a .nex. Understand it.*
- **Copy:** Debug any NEX file without a project and stop at its entry point. Watch a bank change
  live against the file on disk, name routines as you discover them, and keep your labels,
  comments and data regions in a sidecar file that is there next time.
- **Media:** a clip of `nex-run -d -e`, the popped-out bank's diff highlighting, then adding a
  label with `nex-label` and seeing it appear everywhere.
- **Beats:** Spectrum Analyser (no Next), DeZog (no NEX-specific workflow).

### Feature 5 — See what the CPU will do
- **Title:** *Disassembly that explains itself.*
- **Copy:** Every conditional branch shows whether it will be taken and what it costs in
  T-states, worked out from the live flags. System variables appear by name, you can measure
  T-states between any two points, and the ULA panel shows beam position, contention and
  floating bus as you step.
- **Media:** a close-up of the branch-verdict column ("NC met · 12 T"), plus the ULA panel.
- **Beats:** every competitor's plain disassembly.

### Feature 6 — reserve (use if Feature 2 isn't released yet)
- **Title:** *An editor that knows your assembler.*
- **Copy:** Completion, go to definition, find references and rename across files; hover over a
  macro to see its expansion, hover over an address to see its bytes; inline hex/decimal hints and
  colour pickers for `attr()`/`ink()`/`paper()`, all driven by the real compiler.
- **Beats:** standalone emulators. It is on par with VS Code + Z80 Macro-Assembler, so it is
  positioned as integration, not uniqueness.

### Supporting strip (below the five)
Small cards: *Cycle-accurate 48K/128K/+3E* · *Next core built from the FPGA's VHDL* · *Z88 and
experimental C64* · *Record your session as video* · *Klive Script automation* · *Free and open
source*.

### Deliberately **not** claimed
- Conditional breakpoints and logpoints until a release ships them (they are on main), reverse debugging, unit
  tests and coverage, live Copper/sprite inspectors, snapshot/RZX loading, real-hardware debugging
  (see §4).
- "Most accurate" anything. There is no public benchmark against CSpect, ZEsarUX or Fuse.
- No named competitor on the page. Comparisons stay implicit ("no toolchain to wire up").

---

## 6. Suggested next steps

1. **Review this document**, especially the five-feature choice and the Feature 2 timing.
2. **Fix the housekeeping items in §4** (machine-types.mdx, README roadmap and Technology sections).
3. **Capture the media** with `scripts/doc-shots/` (screenshots) and Klive's built-in recording
   (clips). This needs a fixture project per feature, which is a separate plan.
4. **Implement the content** on the landing page prototype: hero video, five feature sections,
   supporting strip, and OS-detected download links.
5. **Separately, consider the roadmap**: W1 (conditional breakpoints, logpoints, DeZog's ASSERTION/WPMEM
   comments and one-shot breakpoints — all done on main) and W5 (snapshot loading) look like the cheapest gaps to close with the biggest
   perception payoff. W4 (live Next
   inspectors) and W2 (history) are the ones that would make Klive the clear Next leader.

## Sources (competitors)
ZEsarUX github.com/chernandezba/zesarux (FEATURES, releases) · CSpect mdf200.itch.io/cspect ·
DeZog github.com/maziac/DeZog (Usage.md), Marketplace maziac.dezog · Fuse
fuse-emulator.sourceforge.net, sourceforge news · sjasmplus github.com/z00m128/sjasmplus ·
NextBuild github.com/em00k/NextBuild · Boriel github.com/boriel-basic/zxbasic ·
ZX Basic Studio github.com/boriel-basic/ZXBasicStudio, forum.boriel.com tid=2571 ·
Spectrum Analyser colourclash.co.uk/spectrum-analyser, github.com/TheGoodDoktor/8BitAnalysers ·
SpecEmu / ZX Spin: spectrumcomputing.co.uk forums · Zeus desdes.com · MAME docs.mamedev.org/debugger ·
Spectrum Computing dev FAQ spectrumcomputing.co.uk/faq/Developing_software.html.
