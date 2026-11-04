# Klive vs. ZX Spectrum Development Environments: Competitive Analysis

Status: **current as of 2026-11-04** (compacted; the original 2026-10-02 analysis and its
landing-page drafts are in git history). The field (§1) and the competitor columns of §2 are from
web research of 2026-10-02 (official docs, READMEs, release notes, forums); facts that could not be
checked against a page are marked **(unverified)** and must be checked before a public page says
them. The Klive column is kept current under `AGENTS.md`'s standing rule: when a feature from
`dev/plans/CLOSING_THE_GAPS_PLAN.md` is implemented, update §2 (the Klive column) and §4 (the gaps) in
the same change.

Klive features are released unless marked **(after v0.66.0)**, meaning they wait in `dev/changes/` for
the next release.

---

## 1. The field

| Tool | What it is | Machines | Platforms | Licence / activity |
|---|---|---|---|---|
| **ZEsarUX** | Emulator with a deep built-in debugger; ZRCP remote protocol | 16K-+3, Next, and many others (QL, Z88, CPC, MSX…) | Win / Mac / Linux | GPLv3; 13.0, Jun 2026 |
| **CSpect** | Mike Dailly's Next emulator and dev kit, text-mode debugger | Next only | Win (Mac/Linux via Mono) | Free, closed source, "no support"; 3.3.x |
| **DeZog** | VS Code debugger front end for zsim, ZEsarUX, CSpect, MAME and real Next hardware | 48K/128K/ZX81/Next via its remotes | Wherever VS Code runs | MIT; 3.7.x; about 10.8k installs |
| **Fuse** | The accuracy reference emulator | 16K-+3e, Pentagon, Scorpion, Timex; **no Next** | Win / Mac / Linux | GPLv2+; 1.10.0 (2026) |
| **sjasmplus** | The de facto Next assembler (Lua, `SAVENEX`, SLD debug output) | — | All | BSD-3; 1.24.0 |
| **NextBuild + Boriel ZX Basic** | Boriel compiler, NextLib, VS Code extension, CSpect | Next | All | 0.7.6 (Sep 2025) |
| **ZX Basic Studio** | Avalonia IDE for Boriel BASIC; BASIC breakpoints (reported buggy) | 48K/128K; Next via MAME (beta) | All | MIT; 1.8 beta |
| **Spectrum Analyser** | Best-in-class reverse-engineering workbench | 48K/128K; **no Next** | Win / Mac / Linux | MIT; weekly builds |
| **SpecEmu / ZX Spin / Zeus** | Windows emulators and IDEs with debuggers | 48K/128K(/+3) | **Windows only** | SpecEmu 2023, Spin abandoned, Zeus 4.17 (2025) |
| **MAME** | General emulator; expression breakpoints, Lua, gdbstub (used by DeZog) | Includes a Next driver (unverified depth) | All | GPL; ongoing |

Next developers today combine several tools: sjasmplus, an editor (VS Code with Z80 Macro-Assembler
or ASM Code Lens), an emulator (CSpect or ZEsarUX) and a bridge (DeZog). **No other tool offers one
integrated IDE** (emulator, editor, assembler, compiler, debugger) on all three desktop platforms;
the nearest (Zeus, ZX Spin) are Windows-only, 48K/128K-only, and Spin is abandoned.

---

## 2. Feature comparison

✅ strong · ◐ partial · ✗ missing · ? unverified. **ZEs + DeZ** is ZEsarUX used through DeZog, as most
developers use it.

| Capability | **Klive** | ZEs + DeZ | CSpect | Fuse | Spectrum Analyser | NextBuild / ZXBS |
|---|---|---|---|---|---|---|
| All-in-one app | ✅ | ✗ (3-4 tools) | ✗ | ✗ | ✗ | ◐ (VS Code + CSpect) |
| Win / Mac / Linux | ✅ | ✅ | ◐ (Mono) | ✅ | ✅ | ✅ |
| 48K / 128K / +2A / +3 / +2E / +3E | ✅ incl. the Amstrad +2A/+3 ROMs; ULA timing checked against the real-machine timing suites (snow, late timing), results published beside real-machine photos | ✅ | ✗ | ✅ (reference) | ◐ (48/128) | ◐ |
| ZX Spectrum Next | ✅ C/WASM core citing the FPGA VHDL, a hardware test suite of about 30 areas; two models by core version **(after v0.66.0)** | ✅ | ✅ (reference dev kit) | ✗ | ✗ | via CSpect / MAME |
| Other machines | Z88, Pentagon 128 with Beta 128/TR-DOS, Timex TC2048/TC2068/TS2068, Scorpion ZS-256, ZX80/ZX81 (with machine code run and debugged as a `1 REM` program), HT-1080Z, Videoton TVC 64K/64K+, Enterprise 64/128 **(after v0.66.0)**, C64 (experimental) | Very wide | ✗ | Many clones | CPC, C64 | ✗ |
| Editor with language intelligence | ✅ asm: compiler-driven completion, hover (macro expansion), rename, references, inlay hints, colour pickers. ◐ BASIC: keyword help, completion, signature help and folding while Boriel builds BASIC | ✅ (VS Code extensions) | ✗ | ✗ | ✗ | ◐ |
| Built-in assembler | ✅ Klive Z80/Z80N: macros, structs, modules, `.savenex`, `.dma` and `.copper` DSLs | ✗ | ✗ | ✗ | ✗ | ✗ |
| External toolchains | ✅ sjasmplus (SLD), Boriel BASIC 2.x (bundled, installed on first run), z88dk C (line-level debugging), PASTA/80; SkoolKit import/export | ✅ sjasmplus, z80asm, z88dk | map files | ✗ | SkoolKit | Boriel |
| BASIC compiler | ◐ Boriel BASIC 2.x (beta, bundled), the only BASIC compiler **(after v0.66.0)**; Klive BASIC switched off; banked modules on the 128K and Next | ✗ | ✗ | ✗ | ✗ | Boriel (external) |
| **BASIC source-level debugging** | ✅ breakpoints, statement stepping, call stack (FASTCALL and far calls), variables, Just My Code, error stops; 48K, 128K, Next; a `.nex` built outside Klive from zxbc's `.dbg` **(after v0.66.0)** | ◐ (viewers only) | ✗ | ✗ | ✗ | ◐ (ZXBS, reported buggy) |
| Asm source-level debugging | ✅ Klive asm; sjasmplus with bank-aware SLD on the 128K, +3 and Next (not yet checked in the IDE, G10.3) | ✅ | labels only | ✗ | ✗ | ✗ |
| **C source-level debugging** | ✅ z88dk (sccz80): C-line breakpoints, stepping, call stack, typed parameters, locals and globals | ◐ (line level) | ✗ | ✗ | ✗ | ✗ |
| Exec / memory / I/O breakpoints | ✅ bank-relative and partition-scoped; every data access of an instruction watched | ✅ | ◐ | ✅ | ✅ | via CSpect |
| Next-specific breakpoints | ✅ **(apparently unique)** NextReg writes (value/mask, old→new), Copper (`cu:`, Step Copper), sprite attributes (`sp:`, by CPU, DMA or Copper) | ? | ? | — | — | ✗ |
| **Conditional / hit-count breakpoints, logpoints** | ✅ conditions on registers, memory in any bank, values, paging, NextRegs and labels on every kind; logpoints; DeZog `LOGPOINT`/`ASSERTION`/`WPMEM` comments; one-shots; range watchpoints | ✅ | ? | ✅ | ✅ (SpecEmu too) | ✗ |
| **Reverse debugging / execution history** | ✅ every Z80 machine: the whole machine in the past (keyframes and a self-checking input journal), every breakpoint kind in reverse, Take over here; history viewer; trace export for diffing; debug recordings (`.klr`) that reopen with their past | ✅ | ? | ✗ | frame trace | ✗ |
| **Unit tests / coverage / profiler** | ✅ per-bank coverage and heat map, SMC detection, LCOV; flat and call-graph profiler with interrupts as roots, speedscope/callgrind exports; DeZog-compatible unit tests with both assemblers, deterministic, T-states per test; `klive test` in CI (JUnit, LCOV) | ✅ (DeZog; VS Code only, no CI) | ✗ | profiler | memory diff | ✗ |
| Call stack, watches | ✅ (+ BASIC and C call stacks) | ✅ | ? | ✗ | ✅ | ◐ |
| Disassembly insight | ✅ branch verdicts with T-state cost, system-variable operands, T-state measuring | ✅ | ◐ | ◐ | ✅ | ✗ |
| NEX reverse engineering | ✅ debug any `.nex` with no project, bank breakpoints and watchpoints, entry stop, live bank vs. file diff, `.nex.dis` annotations with Copper/DMA regions **(after v0.66.0)** | ◐ (DeZog Analyze) | ✗ | ✗ | ✗ (no Next) | ✗ |
| General reverse engineering | ✅ annotations on every machine; every shipped ROM annotated to level 2 (48K, 128K, +2A/+3/+3E, ZX80/ZX81, every Next ROM set, HT-1080Z, TVC, and the Enterprise's **(after v0.66.0)**); code/data detection from coverage, graphics finder, SkoolKit, source export verified by reassembly | ◐ | ✗ | ✗ | ✅ | ✗ |
| **Live Next inspectors** | ✅ Copper (with a raster ruler and list checks), Sprite, Tilemap and Layer 2 Inspectors, layer composition with a pixel probe naming the mixer rule (apparently unique) | ✅ (ZEsarUX) | ? | — | — | ✗ |
| Beam position on the paused screen | ✅ on the Next and every Spectrum model, the picture drawn up to the beam | ✅ (ZEsarUX) | ? | ? | ? | ✗ |
| Next asset editors | ✅ sprites, palettes, Layer 2 pictures, images | ✗ | ✗ | — | — | ✗ |
| NextZXOS boot, SD image | ✅ cached boot, a FAT32 driver; tapes on the Next | ✅ | ✅ | — | — | via CSpect |
| Snapshots and machine state | ✅ `.sna`/`.z80`/`.szx` load, run and save; `.kls` state files with a quick slot on every machine | ✅ | ✗ | ✅ | ✅ | — |
| RZX recording / playback | ✅ including under the debugger; render to video | ? | ✗ | ✅ | ✅ | ✗ |
| Tape / disk / storage | ✅ TAP/TZX/`.cas`; DSK and TR-DOS byte-exact with a Disk Explorer; DivMMC/esxDOS with FAT hard-disk images; Interface 1 and Microdrives; a two-pane File Manager across host, images, tapes and machine storage **(after v0.66.0)** | ✅ | — | ✅ | ◐ | — |
| Export | ✅ TAP/TZX/HEX with loaders, NEX, DSK/TRD/MDR, `.p`/`.o`, `.com`; annotated source; SkoolKit | ◐ | — | — | ✅ SkoolKit | NEX |
| Scripting / automation | ✅ Klive Script; a token-authenticated JSON-RPC API and `klive ide`; headless `klive test`/`build`/`run` | ✅ ZRCP | ✅ C# plugins | ✗ | ✅ Lua | ✗ |
| Debug on real Next hardware | ✗ (G6.4, deferred) | ✅ (DeZog serial) | ✗ | — | — | ✗ |
| Video recording of emulator plus IDE | ✅ (bundled FFmpeg) | ✗ | ✗ | ◐ | ✗ | ✗ |
| Integrated hardware reference | ◐ the Under the Hood articles, the Library of machine manuals; the Next book (partial, unlinked) | ✗ | ✗ | ✗ | ✗ | ✗ |

---

## 3. Where Klive is strong

1. **One app, no assembly required:** emulator, editor with real language intelligence, assembler,
   compilers and debugger on Mac, Windows and Linux; templates for every machine and language.
2. **BASIC and C as debug languages:** source-level debugging that no competitor offers reliably.
3. **Next-native:** NextReg, Copper and sprite breakpoints, bank breakpoints, the live inspectors, the
   `.dma`/`.copper` DSLs, `.savenex`, asset editors, a cached NextZXOS boot.
4. **NEX and ROM reverse engineering:** debug any `.nex` with no project; annotations on every
   machine; every shipped ROM annotated from scratch.
5. **Modern debugging on 1980s machines:** full reverse debugging, coverage, a call-graph profiler,
   deterministic unit tests in CI.
6. **Engineering credibility:** C/WASM cores citing the hardware sources, real-machine timing suites
   with published results, per-opcode Z80 tests.

## 4. Where Klive is weak (open gaps)

| # | Gap | Who has it | Roadmap |
|---|---|---|---|
| W6 | **No remote or real-hardware debugging** (the external-API half is closed) | DeZog (serial), ZEsarUX ZRCP, CSpect plugins, MAME gdbstub | G6.4 (deferred); G6.5 sends a `.nex` to real hardware without debugging (open) |
| W8 | **BASIC editor intelligence**: built for Klive BASIC, but Boriel BASIC builds have keyword help, completion and folding only while Klive BASIC is switched off | — (weak elsewhere too) | G8 (reopened in effect) |
| W10 | **Proof points**: Next accuracy is unbenchmarked publicly; the Z80 exercisers' results are unpublished; sjasmplus banked debugging is unchecked in the IDE | Fuse (reference accuracy) | G10.1-G10.3 |

Closed: W1 logpoints and rich breakpoints (G1), W2 reverse debugging (G4), W3 unit tests, coverage and
profiler (G5), W4 live Next inspectors (G3), W5 snapshots, state files and RZX (G2), W7 reverse
engineering depth (G7), W9 machine breadth (G9). Their detail is in §2.

**Release status note** (update it to each release; the release PR's checklist asks for it):
everything above shipped by **v0.66.0** except what §2 marks **(after v0.66.0)**. The landing page
gates each feature and machine on the latest release tag (`docs/landing/features.ts` `since`), so it
never claims ahead of a release.

Housekeeping: the book (`docs/content/en/book`) is partial, chapters 9-22 are stubs; mention it only
as "in progress".

## 5. Landing page

The landing page is built (`docs/landing/`, texts in `docs/i18n/landing/en.json`, design rules in
`docs/design.md`). Its feature choice follows two rules: each feature is **something no single
competitor matches**, and it is **visible in a screenshot or a short clip**.

### Deliberately **not** claimed

- Anything not in a release (the `since` gate does this).
- Real-hardware debugging (W6).
- "Most accurate" anything: there is no public benchmark against CSpect, ZEsarUX or Fuse.
- No named competitor on the page. Comparisons stay implicit ("no toolchain to wire up").

## Sources (competitors)

ZEsarUX github.com/chernandezba/zesarux · CSpect mdf200.itch.io/cspect · DeZog
github.com/maziac/DeZog, Marketplace maziac.dezog · Fuse fuse-emulator.sourceforge.net · sjasmplus
github.com/z00m128/sjasmplus · NextBuild github.com/em00k/NextBuild · Boriel
github.com/boriel-basic/zxbasic · ZX Basic Studio github.com/boriel-basic/ZXBasicStudio,
forum.boriel.com tid=2571 · Spectrum Analyser colourclash.co.uk/spectrum-analyser,
github.com/TheGoodDoktor/8BitAnalysers · SpecEmu / ZX Spin: spectrumcomputing.co.uk forums · Zeus
desdes.com · MAME docs.mamedev.org/debugger · Spectrum Computing dev FAQ.
