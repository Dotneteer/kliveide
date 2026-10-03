# Closing the Gaps — Feature Roadmap for Klive's Weak Spots

Status: **decisions recorded** (2026-10-02; see [Decisions](#decisions)). This is a roadmap, not an implementation plan: each feature
gets its own plan before work starts.
Source of the gap list: §4 of [LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md).

> **Standing rule:** when a feature from this plan is implemented, update
> [LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md) in the same change:
> its §2 comparison table (the Klive column), and its §4 gap table, where you move or remove the
> closed gap. Also mark the feature as done here.

## How to read the effort ratings

| Size | Meaning |
|---|---|
| **S** | Days. Fits existing infrastructure; mostly UI or a parser. |
| **M** | 1–3 weeks. A new subsystem or new WASM exports, but a clear design. |
| **L** | Over a month. Touches every machine core or needs a new protocol or format. |
| **XL** | A project of its own, with open design questions or determinism or hardware risks. |

The ratings come from a quick look at the existing code, noted per item as **Foundation**. They
are estimates for prioritising, not commitments.

---

## Overview

| # | Gap | Overall | Low-hanging pieces |
|---|---|---|---|
| G1 | Conditional breakpoints, hit counts, logpoints | **S–M** | ✅ G1.1–G1.3 done (2026-10-03); logpoints and one-shot breakpoints remain |
| G2 | Load and save snapshots (.sna/.z80/.szx), RZX | **S → L** | .sna and .z80 loading |
| G3 | Live Next hardware inspectors | **M** (layers: L) | Copper list viewer, sprite table |
| G4 | Execution history and reverse debugging | **M → XL** | Read-only history viewer on the Next |
| G5 | Code coverage, profiler, unit tests | **M → L** | Coverage map in the disassembly |
| G6 | Remote debugging, real hardware, external API | **M → XL** | Command API for scripts and CI |
| G7 | 48K/128K reverse-engineering depth | **M → L** | Generalising the NEX annotation sidecar |
| G8 | BASIC editor intelligence | **M** | Hover and go to definition |
| G9 | Machine breadth (ZX80/81, clones) | **M → XL** | Pentagon on top of the 128K core |
| G10 | Proof points (accuracy evidence) | **S–M** | Publishing results of known test suites |

---

## G1. Rich breakpoints — **S–M, the clearest low-hanging fruit**

**Why it matters:** every serious competitor has it, the README roadmap still lists it, and its
absence is the first thing an experienced developer notices.

**Status:** G1.1–G1.3 are **done** (2026-10-03), implemented by
[CONDITIONAL_BREAKPOINTS_PLAN.md](CONDITIONAL_BREAKPOINTS_PLAN.md). Its condition engine
(`src/common/utils/breakpoint-condition/`) is the one G1.4 and G1.5 build on.

**Plan:** G1.1–G1.3 are planned in [CONDITIONAL_BREAKPOINTS_PLAN.md](CONDITIONAL_BREAKPOINTS_PLAN.md).
G1.5 and G1.6 are planned in
[ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md](ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md).
That plan found one exception to the "no C core changes" note below: the WASM cores record only the
last memory access of an instruction, so its Phase 0 makes them record every one (which also fixes
memory breakpoints that miss multi-byte accesses today).

**Foundation:** breakpoints are a 64K flag table plus per-address data in `DebugSupport`
(`src/emu/machines/DebugSupport.ts`), pushed to the WASM cores, which stop the frame on a hit.
A `hitCount` field already exists for memory breakpoints and is shown in `BreakpointDialog`.
None of the extensions below has to change the C cores: the core stops, the TypeScript side
evaluates, and it either stays stopped or resumes silently.

| Feature | What it does | Size |
|---|---|---|
| G1.1 Hit-count breakpoints ✅ **done** | Stop only on the Nth hit, every Nth hit, or after N hits (`bp-set $8000 -hit >=10`). Shows the live count in the Breakpoints panel. | S |
| G1.2 Register / flag conditions ✅ **done** | Stop only when an expression is true, e.g. `A == $FF && !Z` or `HL > $C000`. | S–M (needs an expression evaluator over registers; check whether the watch or command expression code can be reused) |
| G1.3 Memory and value conditions ✅ **done** | Conditions on memory contents (`[IX+3] == 0`, `w[$5C3A] > 100`), on the value being written (memory or I/O value breakpoints, like SpecEmu's MWV/PWV), and on the current paging or bank. | M |
| G1.4 Logpoints | A breakpoint that does not stop: it writes a formatted message (`"x={A} at {PC}"`) to the output pane and resumes. Also recognised from source comments using DeZog's LOGPOINT convention (decision D3). | S, once G1.2 exists |
| G1.5 Assertions and watchpoints in source | DeZog-compatible ASSERTION and WPMEM source comments (decision D3) become conditional breakpoints and memory watchpoints when the program is debugged, so annotated DeZog projects work unchanged. | M |
| G1.6 Temporary / one-shot breakpoints | Remove themselves after the first hit. | S |

**Risk:** a conditional breakpoint inside a hot loop stops and resumes the frame on every pass,
which is slow. That is acceptable at first; the fix, if needed, is evaluating simple register
conditions in C (M).

---

## G2. Snapshots and recordings — **S for loading, L for RZX**

**Why it matters:** sharing a machine state is everyday practice for 48K/128K users, and games
are commonly distributed as snapshots.

**Foundation:** none for the Spectrum. `SnaFileViewerPanel` and `Z80FileViewerPanel` are
"not implemented" stubs. The code-injection flow already writes memory and registers into a
running machine. The Next core has a checkpoint (whole-state capture) used internally by
`MachineController`. Z88 snapshot loading exists (`Z88SnapshotCommand`) as a UX reference.

| Feature | What it does | Size |
|---|---|---|
| G2.1 Load .sna (48K and 128K) | Open a snapshot from the file menu, by drag and drop, or with a command; switches to the right machine and restores RAM, registers, paging and border. | S |
| G2.2 Load .z80 (v1–v3, compressed) | The most common format in archives; includes 128K paging and AY state. | S–M |
| G2.3 Load .szx | Modern chunked format (zlib) with full peripheral state: AY, +3 disk, keyboard, ULA timing. | M |
| G2.4 Save snapshots | Save the current machine as .z80 / .szx (and .sna). Lets users bookmark a debugging situation or share a bug repro. | M |
| G2.5 Real snapshot viewers | Replace the stubs: header, registers, a memory map, and a screen preview. | S |
| G2.6 Klive state files (all machines, including Next) | Save and restore the full emulator state, building on the Next checkpoint mechanism; formats are Klive-specific. | M–L (each core needs a complete, versioned state serialiser) |
| G2.7 RZX playback | Plays a recorded input stream frame by frame (the standard for verified game recordings and speedruns). | L (needs per-frame IN-value replay and fully deterministic emulation) |
| G2.8 RZX recording | Record your own session for exact replay or bug reports. | L, after G2.7 |

---

## G3. Live Next hardware inspectors — **M; the "Next IDE" credibility item**

**Why it matters:** a Next IDE that cannot show what the sprites, Copper or layers are doing
at a breakpoint loses to ZEsarUX on the platform it should own.

**Foundation:** the C core has dedicated modules (`zxnext-sprites.c`, `zxnext-copper.c`,
`zxnext-layer2.c`, `zxnext-tilemap.c`, `zxnext-palette.c`). The loader exports very little of
their state (`zxnextCopperRead`), so each inspector needs a small state-export API first. The
renderer already draws sprite patterns, palettes and Layer 2 images for NEX files and asset
editors (`NexBankSpritesView`, the image viewers, the palette editor), so most drawing code can
be reused.

| Feature | What it does | Size |
|---|---|---|
| G3.1 Copper list viewer | The 1K Copper program decoded as `WAIT line,h` / `MOVE reg,val`, with the current Copper PC highlighted and NextReg names. | S–M |
| G3.2 Sprite table inspector | All 128 sprite attribute slots: position, pattern, palette offset, mirror/rotate/scale, relative/anchor, visible; click to show the pattern. | M |
| G3.3 Pattern memory viewer | All 16K of sprite pattern RAM as 8-bit or 4-bit images with the active palette. | S (reuses the sprite drawing) |
| G3.4 Tilemap / tile definition viewer | The live tilemap with tile indices and attributes, plus the tile definitions. | M |
| G3.5 Layer 2 live viewer | Current Layer 2 banks as an image at its resolution (256×192 / 320×256 / 640×256), with scroll and clip shown. | S–M (reuses the `.sl2`/`.shr` viewers) |
| G3.6 Layer composition view | Toggle individual layers (ULA, Layer 2, sprites, tilemap) on and off in the emulator screen; show the priority order, clip windows and transparency. | L (the C renderer must compose selectively) |
| G3.7 Beam-position overlay | Show the raster position on the paused screen; useful with Copper and with the ULA panel's beam phase. | S–M |
| G3.8 Copper / sprite breakpoints | Stop when the Copper reaches an instruction, or when a sprite attribute is written. | M, after G1 |

---

## G4. Execution history and reverse debugging — **M → XL; full reverse debugging is in scope (D2)**

**Why it matters:** this is DeZog's most-praised feature: "how did I get here?" answered by
stepping backwards.

**Foundation:** the Next core already records a per-instruction **frame trace**
(`zxnext-trace.c`: 160,000 records × 128 bytes, PC plus memory-map context), used for boot
traces and diagnostics. The Next also has full-state checkpoints. The 48K/128K/+3 cores have
neither.

| Feature | What it does | Size |
|---|---|---|
| G4.1 History viewer (Next) | After a stop, list the last N executed instructions with registers, disassembly and source line; click one to jump to its source. Read-only. | M (the data exists; needs an export, a UI and source mapping) |
| G4.2 History in the other cores | The same trace recording for 48K/128K/+3E (and Z88). | M |
| G4.3 "Lite" step back | Step backwards through the trace and show the historical registers and PC in the CPU panel and editor. Memory stays at the present. This is DeZog's "lite" mode. | M, after G4.1 |
| G4.4 Full reverse debugging | Step back and reverse-continue with exact memory and device state: periodic checkpoints plus deterministic re-execution to the target instruction. | XL (every core needs cheap state capture; input, tape, disk and audio must replay deterministically) |
| G4.5 Trace export | Save a history range as a text or CSV trace for diffing two runs. | S, after G4.1 |

---

## G5. Coverage, profiling and unit tests — **M → L**

**Why it matters:** DeZog's unit tests and coverage are unique in the field. Klive has a strong
*internal* test harness (`test/harness/sp48`, `test/harness/zxnext`), but nothing for users.

| Feature | What it does | Size |
|---|---|---|
| G5.1 Code coverage map | A per-address (and per-bank) "executed" bitmap in the core; executed lines are marked in the editor gutter and disassembly, and can be reset. | M (a C bitmap in each core, then source mapping through the existing debug info) |
| G5.2 Memory access heat map | Read, write and execute counts per address, shown as a heat map in the memory view; also spots self-modifying code. | M, alongside G5.1 |
| G5.3 Flat profiler | T-states spent per address, rolled up per label or procedure; a "top routines" table. | M |
| G5.4 Call-graph profiler | Inclusive and exclusive time per routine using the call stack. | L |
| G5.5 Z80 unit tests | **DeZog-compatible** (decision D3): the same test-case labelling and assertion-macro conventions, so DeZog unit-test projects run in Klive unchanged, with both Klive asm and sjasmplus. A runner sets up the machine headlessly, calls each test, checks results, and reports pass/fail in a Test panel with click-to-source. Debug a failing test. | L (assembler support for the conventions, a headless runner, UI; the exact DeZog conventions are researched in this feature's own plan) |
| G5.6 Tests from the command line / CI | Run the G5.5 tests without the UI (`klive test project/`), with exit codes and JUnit output. | M, after G5.5 and G6.1 |

---

## G6. Remote, hardware and external integration — **M → XL**

**Why it matters:** this connects Klive to the VS Code/DeZog ecosystem and to real Next
hardware, where competitors lead.

| Feature | What it does | Size |
|---|---|---|
| G6.1 Command line / automation | Drive Klive from a CLI or script: build, run, test and read memory headlessly. Scoped to CI and automation, **not** editor integration (decision D1). | M (the IDE command service already exists; this needs a transport and a security model) |
| ~~G6.2 Debug-adapter protocol server~~ | **Dropped** (decision D1): Klive stays a standalone IDE. | — |
| ~~G6.3 DeZog-compatible remote~~ | **Dropped** (decision D1). DeZog compatibility applies to source conventions instead (D3). | — |
| G6.4 Real Next hardware debugging | Run and debug on a physical Next over UART **from Klive's own debugger UI**, with an on-Next agent program handling breakpoints and memory. Fits D1: Klive is the client. | XL (hardware, a Z80N agent, timing and banking constraints) |
| G6.5 Send to Next | Push a built `.nex` to real hardware over serial or Wi-Fi without debugging. | M |

---

## G7. Reverse-engineering depth for 48K/128K — **M → L**

**Why it matters:** Spectrum Analyser owns this niche on the classic machines. Klive already has
the model (labels, comments, regions, sidecar); it just exists for NEX files only.

| Feature | What it does | Size |
|---|---|---|
| G7.1 Annotations for any machine | Generalise the `.nex.dis` sidecar: label, comment and region-mark code in a running 48K/128K program and in snapshots (G2), shown in the live disassembly. | M |
| G7.2 Annotated ROMs | Ship labels and comments for the 48K/128K/+3 ROMs so ROM calls and jumps read by name. | M–L (mostly data, but **written from scratch** (decision D4): existing commented disassemblies are not copied or used as a source, as with Klive BASIC's provenance rule) |
| G7.3 Code/data auto-detection | Use the coverage and heat maps (G5.1–G5.2) to classify executed bytes as code and data-only bytes as data. | M, after G5 |
| G7.4 Graphics finder | Browse memory as bitmaps at a chosen width (UDGs, sprites, fonts) to find and name graphics. | M |
| G7.5 SkoolKit import / export | Exchange annotations with SkoolKit's skool files, the community standard for published disassemblies. | M |
| G7.6 Export as source | Export an annotated region as re-assemblable Klive asm source. | M, after G7.1 |

---

## G8. BASIC editor intelligence — **M**

**Why it matters:** BASIC debugging (on main) is a headline feature, but editing BASIC gets only
diagnostics, while asm gets 11 language providers.

**Foundation:** Klive BASIC is a TypeScript compiler in-process (`src/main/kbasic/`), so its
symbol tables are available. The asm providers (`services/z80-providers.ts`) give the pattern to
follow.

| Feature | What it does | Size |
|---|---|---|
| G8.1 Hover | Types of variables and functions, `SUB`/`FUNCTION` signatures, keyword help. | S–M |
| G8.2 Go to definition / find references | For SUBs, FUNCTIONs, labels, variables, constants, across `#include`d files. | M |
| G8.3 Completion | Keywords, in-scope identifiers, library functions from the stdlib API. | M |
| G8.4 Rename | Cross-file rename of user symbols. | M, after G8.2 |
| G8.5 Signature help, outline, folding | Parameter hints while typing calls; document symbols; folding for `SUB`/`IF`/`FOR` blocks. | S–M |

---

## G9. Machine breadth — **M → XL**

| Feature | What it does | Size |
|---|---|---|
| G9.1 Pentagon 128 | Popular Russian clone, built on the 128K core (different timing and no contention). | M |
| G9.2 ZX Spectrum +2A/+3 (non-E ROMs) | The original Amstrad ROMs alongside the +E ones. | S–M |
| G9.3 ZX80 / ZX81 | Already planned in `.plans/ZX8081_WASM_PLAN.md`. | XL |
| G9.4 Timex TC2048/2068, Scorpion | Long-tail clones. | L each; low priority |

---

## G10. Proof points — **S–M; cheap credibility**

| Feature | What it does | Size |
|---|---|---|
| G10.1 Published Z80 test results | Run the well-known instruction exercisers and timing suites (ZEXALL/ZEXDOC, FUSE's tests, z80test) and publish the results on the site. | S–M (much is probably covered by `test/z80`; this is about publishing it) |
| G10.2 Next accuracy page | Publish the hardware test catalogue's coverage (the ~30 areas checked against the VHDL) as a page. | S |
| G10.3 sjasmplus on 128K / Next | Verify, and fix if needed, SLD source-level debugging for banked targets (tested on 48K only). | S–M |
| G10.4 Docs and README accuracy | Fix the stale items found in the competitive analysis (Next "in development", roadmap, "pure TypeScript"). | S |

---

## Decisions

Answers from the project author, 2026-10-02:

- **D1. Klive remains a standalone IDE. No VS Code integration.**
  - G6.2 (DAP server) and G6.3 (DeZog remote) are dropped.
  - G6.1 is narrowed to a CLI and automation for CI.
  - G6.4 (real hardware) stays, with Klive as the debugger client.
- **D2. Aim for a very strong feature set.**
  - Full reverse debugging (G4.4) is in scope, not just the "lite" history (G4.3); G4.3 is now a
    milestone on the way.
  - The same ambition keeps G3.6 (layer composition) and RZX (G2.7–G2.8) on the roadmap.
- **D3. Be compatible with DeZog's conventions.**
  - Unit tests (G5.5) use DeZog's test-case and assertion conventions.
  - For consistency, the ASSERTION, LOGPOINT and WPMEM source comments are honoured too (G1.4,
    G1.5).
  - Goal: a DeZog-annotated project debugs and tests in Klive unchanged.
  - The exact syntax is researched from DeZog's documentation when those features are planned.
    Only the conventions are adopted; no DeZog code is copied.
- **D4. ROM annotations are written from scratch** (G7.2), under the same provenance discipline as
  Klive BASIC.

## Suggested order (revised for the decisions)

**Wave 1 — low-hanging fruit:**
G1.1 hit counts · G1.2 register conditions · G1.4 logpoints · G1.6 one-shot breakpoints ·
G2.1 .sna load · G2.2 .z80 load · G2.5 snapshot viewers · G3.1 Copper list · G3.3 pattern viewer ·
G10.1–G10.4 proof points.

**Wave 2 — the Next leadership set:**
G3.2 sprite inspector · G3.4 tilemap · G3.5 Layer 2 · G4.1 history viewer (Next) · G4.3 lite
step back · G5.1 coverage · G1.3 memory and value conditions · G1.5 DeZog-compatible ASSERTION
and WPMEM comments.

**Wave 3 — depth:**
- G5.5 DeZog-compatible unit tests and G6.1 CLI, which together enable G5.6 (CI).
- G7.1 annotations for any machine, G7.2 ROM annotations written from scratch.
- G8.x BASIC intelligence, G2.4 snapshot saving, G5.2–G5.3 heat map and profiler.
- **G4.2 history in every core**, which is the groundwork for G4.4.

**Wave 4 — the big bets:**
- **G4.4 full reverse debugging.** Start with a design spike on cheap state capture and
  deterministic replay across all cores; that same work also unblocks RZX (G2.7–G2.8) and Klive
  state files (G2.6).
- G3.6 layer composition.
- G6.4 real Next hardware debugging, with G6.5 send-to-Next as its first milestone.
- G9.3 ZX80/81.

**Cross-cutting note:** deterministic replay is the shared foundation of G4.4, G2.6 and
G2.7–G2.8. Designing it once, early in Wave 4 (or as a spike during Wave 3), is the key
technical decision of this roadmap.
