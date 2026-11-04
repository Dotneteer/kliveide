# Closing the Gaps: Feature Roadmap for Klive's Weak Spots

Status: **updated and compacted 2026-11-04.** G1-G5, G7, G8 and G9 are done; what is open is G6.4
(deferred), G6.5, and part of G10. This is a roadmap, not an implementation plan: each feature gets
its own plan before work starts. The gap list comes from §4 of
[LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md); the full history of
this roadmap (the per-feature notes and the waves) is in git history.

> **Standing rule:** when a feature from this plan is implemented, update
> [LANDING_PAGE_COMPETITIVE_ANALYSIS.md](LANDING_PAGE_COMPETITIVE_ANALYSIS.md) in the same change:
> its §2 comparison table (the Klive column) and its §4 gap table, where you move or remove the
> closed gap. Also mark the feature as done here.

Sizes: **S** days · **M** 1-3 weeks · **L** over a month · **XL** a project of its own.

## Decisions (binding)

From the project author, 2026-10-02:

- **D1. Klive remains a standalone IDE. No VS Code integration.** The DAP server (G6.2) and a
  DeZog remote (G6.3) are dropped; G6.1 is a CLI and automation for CI; G6.4 keeps Klive as the
  debugger client.
- **D2. Aim for a very strong feature set:** full reverse debugging, layer composition and RZX were
  in scope (all done).
- **D3. Be compatible with DeZog's conventions**, not its code: unit-test labels and assertion
  macros, and the ASSERTION, LOGPOINT and WPMEM source comments, so a DeZog-annotated project debugs
  and tests in Klive unchanged.
- **D4. ROM annotations are written from scratch**, under Klive BASIC's provenance discipline
  (`.ai/rom-annotations/README.md`).

## Status

| # | Gap | State |
|---|---|---|
| G1 | Rich breakpoints | ✅ done (2026-10-03): hit counts, register/flag and memory/value conditions, logpoints, DeZog ASSERTION/WPMEM comments, one-shot breakpoints |
| G2 | Snapshots and recordings | ✅ done (2026-10-04): `.sna`/`.z80`/`.szx` load and save, viewers, `.kls` state files with a quick slot, RZX playback and recording |
| G3 | Live Next hardware inspectors | ✅ done (2026-10-05 to 10-08): Copper list and breakpoints, Sprite, Tilemap and Layer 2 Inspectors, layer composition, beam-position overlay, sprite-attribute breakpoints, the `.copper` pragma |
| G4 | Execution history and reverse debugging | ✅ done (2026-10-07 to 10-08), every Z80 machine: history, step back, full reverse debugging, trace export, debug session recordings (`.klr`) |
| G5 | Coverage, profiling and unit tests | ✅ done (2026-10-08 to 10-09): coverage and heat map, flat and call-graph profiler, DeZog-compatible unit tests, `klive test` in CI |
| G6 | Remote, hardware and external integration | ◐ G6.1 done (automation API, `klive ide`, headless `klive run`/`build`/`test`); G6.2/G6.3 dropped (D1); **G6.4 deferred; G6.5 open** |
| G7 | Reverse-engineering depth | ✅ done: annotations on every machine with a bank space, code/data detection, graphics finder, SkoolKit import/export, export as source (2026-10-09); every shipped ROM annotated to level 2 (48K, 128K, every +2A/+3/+3E, the ZX80 and ZX81, every Next ROM set, the HT-1080Z, and since then the Enterprise and Videoton TVC ROMs) |
| G8 | BASIC editor intelligence | ✅ built for Klive BASIC (2026-10-03). **Reopened in effect:** while Klive BASIC is switched off (`.ai/klive-basic-switch.md`), Boriel BASIC builds get keyword help, completion and folding only. Turning Klive BASIC back on restores it; giving Boriel builds more would need a binder for Boriel 2.0's syntax |
| G9 | Machine breadth | ✅ done: Pentagon 128 and Beta 128/TR-DOS, +2A/+3 with the Amstrad ROMs, ZX80/ZX81, Timex TC2048/TC2068/TS2068, Scorpion ZS-256, disk images and file systems (DSK, TR-DOS, FAT, DivMMC/esxDOS), Interface 1 and Microdrives. Beyond the original list: z88dk C, the HT-1080Z, the Videoton TVC, the Enterprise 64/128 |
| G10 | Proof points | ◐ G10.1's ZX Spectrum part and G10.4 done; **G10.1's Z80 exercisers, G10.2 and G10.3's IDE check open** |

The G4/G5 group honours one feature switch, `features.advancedDebugging`
(`src/common/features/advancedDebugging.ts`, `docs/content/en/guides/customizing/advanced-debugging.mdx`):
a new G4/G5-style feature adds its machine feature to `ADVANCED_DEBUGGING_FEATURES` and gates its
commands, views and hooks on `isAdvancedDebuggingEnabled`.

## What is open

### G6.4 Real Next hardware debugging: **XL, deferred** (2026-10-08)

Run and debug on a physical Next over a joystick-port UART from Klive's own debugger UI, with a
Klive agent on the Next handling breakpoints and memory (D1: Klive is the client). Built only if the
future calls for it. Plan: [NEXT_HARDWARE_DEBUGGING_PLAN.md](NEXT_HARDWARE_DEBUGGING_PLAN.md) (draft;
its send-over-serial phase is replaced by G6.5).

### G6.5 Send to Next over Wi-Fi: **M, nothing built**

Push a `.nex` Klive built (or any `.nex`) to real hardware over the Next's ESP Wi-Fi and start it,
without debugging; it does not need G6.4. Plan:
[SEND_TO_NEXT_WIFI_PLAN.md](SEND_TO_NEXT_WIFI_PLAN.md) (draft, open questions): a small,
off-by-default, read-only HTTP server in Klive that the Next pulls from; a zero-install route through
the stock `.http` and `.nexload`, an everyday `.klive -w` dot command; a Wi-Fi setup guide; a fake
ESP on the emulated UART so the path runs in CI. **Next step: the author answers the plan's §10.**

### G10.1 Z80 instruction exercisers: **S-M**

The ZX Spectrum half is published (`under-the-hood/emulator-internals/spectrum-accuracy`, kept true
by the slow test tier). Open: run the instruction exercisers (ZEXALL/ZEXDOC, z80test) and publish
their results the same way, a picture per program generated by the slow tier and failing when it
drifts. Needs a check of each exerciser's licence before shipping its binary in a test fixture.

### G10.2 Next accuracy page: **S-M**

Publish what the Next's hardware tests check against the VHDL, area by area, as an Under the Hood
page. Plan: [ZX_NEXT_FIDELITY_PROOF_PLAN.md](ZX_NEXT_FIDELITY_PROOF_PLAN.md) (draft, research done,
nothing implemented; it goes beyond the page). **Next step: the author answers its §9.**

### G10.3 sjasmplus on banked machines: **S, check only**

Built: an SLD line's page becomes a Klive partition on the 128K, +3 and Next devices
(`sldPagesArePartitions` in `SjasmPCompiler.ts`), so breakpoints, the profiler and symbols are
bank-aware; unit-tested on SLD fixtures. Open: a run in the IDE (a banked sjasmplus project on the
128K and on the Next, a breakpoint in each bank, Step Into across a bank switch), as a part of an IDE
check script, before claiming it on the site.

## Done since the last update, recorded here once

- **G10.4:** the README's stale claims (memory/I/O breakpoints and custom ROMs as planned, "pure
  TypeScript" emulators) are gone; the only "in development" left on the site is the book's own
  notice, which is true (its later chapters are stubs).
- **G7.2:** the ZX80 and ZX81 ROMs (R4b) are at level 2; the roadmap entry for authoring is closed.
