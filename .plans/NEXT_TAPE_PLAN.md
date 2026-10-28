# ZX Spectrum Next: tape loading and saving — plan

Klive's ZX Spectrum Next has no tape. Its core keeps a constant EAR input (`zxnext-tape.c`), port
`$FE` bit 6 never sees a tape (`zxnextUlaReadPortFe`: "the physical tape input is not modelled"), and
the mixer cannot play a loading tape at MIC level. This plan gives the Next the tape the 48K, 128K and
+3 already have, with the Next's own input stage. It is the last "What Klive leaves out" item of the
audio series (`.plans/NEXT_AUDIO_ARTICLES_PLAN.md`, article 7).

Status: **done** (2026-10-28). The author accepted D1–D5 as written, with D3's 1 MB / 256 KB and the
tape data volatile.

**As built.**
- Core: `zxnext-tape.c` includes the shared player after the CPU (it uses the shared Z80's registers),
  with `sp48Tacts` as the 28 MHz clock ÷ 8 (`zxnext-clock28.c`), the trap gated on slot 0 reading ROM 3
  with no DivMMC/Multiface/Layer 2 overlay, and the player's own beeper hooks stubbed. The input stage
  steps the 1.75 MHz enables lazily (`zxnextTapeInputSync`), with a fast path once settled at rest;
  `zxnextTapeBeforeInstruction` runs it and the trap at the top of every instruction (fast and debug
  paths alike), port `$FE` reads and audio samples sync it, its changes reach the MIC line through
  `zxnextBeeperSetTapeEarAt`. Port `$FE` writes feed the SAVE capture. The enables' phase is clock
  ≡ 15 (mod 16) and ≡ 511 (mod 512); a reset that started the count at 0 never met a membrane enable
  (caught by TAPE-006).
- `zxnextTapeGetInputBit` returns the last stepped value: the export contract test treats a getter
  that steps state as a defect.
- The upload goes through `writeCoreBytes` (journaled); `sp48TapeData` is volatile in the build.
- IDE: `MF_TAPE_SUPPORT` on, the Spectrum's Tape menu; the IDE's one-click "Load and run tape" stays
  limited to the 48K/128K/+3 family (`tapeLoadGuard`): on the Next it would type into NextZXOS.
- Tests: `test/zxnext-hw/tape/tape.test.ts` (TAPE-001–008: fast load at 3.5 and 28 MHz, real time
  with the MIC-level sound, failure at 7 MHz, rest, a standard pilot, the relaxation, the debounce,
  SAVE to TZX and back), the rewritten `test/wasm/zxNext/wasm-next-tape.test.ts`, and a "zxnext
  (tape)" case in `journal-replay-determinism.test.ts`.

## 1. What the hardware does (checked in `_input/next-fpga/src`)

- **The EAR input stage** (`zxnext_top_issue4.vhd` ~620–690, same on issue 2): the EAR socket's pin
  (inverted) is debounced on the 1.75 MHz enable with a counter of 1 bit, which rejects pulses shorter
  than about 1.14 µs; then a relaxation stage turns a level stuck at 1 into 0 after about 1,150 µs
  (64 ticks of the 18 µs membrane enable). Idle, the conditioned input is **0**.
- **Port `$FE` bit 6** reads `(EAR input xor Pi EAR) or EAR output or (MIC output and issue 2)`
  (`zxnext.vhd` ~3456).
- **The mixer's MIC input** is `port $FE bit 3 xor EAR input xor Pi EAR` (~6449): a loading tape is
  heard at MIC's level, 128 units. The same line drives the MIC socket (saving).
- **ROM 3** of `enNextZX.rom` has the 48K ROM's LD-BYTES byte for byte (`$0556`–`$0604`) and SA-BYTES
  from `$04C2`: the Spectrum player's trap addresses (`$056C`, `$05B6`, `$05E2`, `$04C2`) hold. The
  bytes differ at `$0550`–`$0553` and from `$0605` (LD/SA return and the LOAD command), outside the
  routines the trap touches.
- At a CPU speed above 3.5 MHz the ROM's timing loops run faster than the tape: real-time loading fails
  on the real machine. Fast load does not depend on timing.

## 2. Design

**One player, the Spectrum's.** `src/emu/machines/zxSpectrum/wasm/common/zx-spectrum-tape.c` already
plays TAP/TZX blocks (with turbo pilots, pauses and partial last bytes), traps LD-BYTES for fast load and
captures SA-BYTES pulses into a saved TZX. The Next core includes it, as the 128K and +3 cores do, with
its host names aliased (`sp48Tacts`, `sp48CpuReadMemory`/`WriteMemory`, `sp48BaseClockFrequency`, the
state declarations). Differences the Next needs, each behind a macro the shared file already has or a
new one with the old behaviour as its default (so the Spectrum cores stay byte-identical):

- **Time** is real time, not CPU T-states: `sp48Tacts` is the Next's 28 MHz clock (`zxnext-clock28.c`)
  divided by 8, so pulses keep their length at any CPU speed (and real-time loading at 7–28 MHz fails,
  as on the hardware).
- **The trap** (`SP48_TAPE_TRAP_ACTIVE()`) applies only while ROM 3 is what the CPU executes at the trap
  address: not the DivMMC or Multiface overlay, not the Alt ROM, not RAM in slot 0.
- **The EAR level** goes through the Next's input stage (debounce, relaxation; §1) into one bit, the
  *conditioned tape input*, and from there into port `$FE` bit 6 (XOR with the Pi's EAR bit) and the
  beeper's MIC line (`zxnext-beeper.c`: `portMic ^ tapeEar ^ piEar`). The shared file's
  `setTapeEarBit` beeper hooks are aliased to the Next's.
- **Saving**: SA-BYTES capture works unchanged (MIC → the saved TZX), surfaced through `SAVED_TO_TAPE`
  like the 48K.

**The TypeScript side** follows `ZxSpectrum48WasmV2Machine`'s tape code (upload on `MEDIA_TAPE`,
`TAPE_MODE`, `REWIND_REQUESTED`, `FAST_LOAD`, saved-tape publishing) and replaces the Next's local
`tapeDevice` lines with the real ones; the Next gets `MEDIA_TAPE` in its media list and
`tapeMenuRenderer` in its menus (Insert, Rewind, Eject, Fast load).

## 3. Decisions for the author

- **D1 — Reuse the Spectrum player** in the Next core (above), rather than a Next-specific player.
- **D2 — Real-time playback runs on real time**, so it fails at CPU speeds above 3.5 MHz as the real
  machine does; fast load works at any speed.
- **D3 — The tape buffers' size.** The Spectrum cores keep 4 MB of tape data and 1 MB for saving in
  their linear memory, which every checkpoint and reverse-debugging keyframe copies. Proposed for the
  Next: **1 MB** of tape data and **256 KB** for saving (TZX files beyond 1 MB are rare), and the tape
  data listed as *volatile* (left out of state files and keyframes; the inserted tape is media, re-sent
  by the IDE, while the playback position stays in the state).
- **D4 — The trap only in ROM 3**, as §2. NextZXOS's own tape support (`LOAD "t:"` and its browser) is
  whatever reaches ROM 3's LD-BYTES; nothing is added for NextZXOS's SD-card ".tap" mounting.
- **D5 — The input stage is modelled** (debounce and relaxation), checked by tests that feed pulses
  shorter than 1.14 µs and a level held past 1,150 µs.

## 4. Phases

1. **Core**: include the player with the Next's aliases and macros; the input stage; port `$FE` bit 6;
   the MIC line; exports and loader entries (`zxnextTape*`, the data and save buffers); D3's sizes and
   volatile entry. The 48K/128K/+3 cores rebuild byte-identical (`test/wasm/` snapshot and equivalence
   tests).
2. **Machine and IDE**: `ZxNextWasmV2Machine` tape properties, upload and saved-tape publishing; the
   media list and the Tape menu; fast load and the rocket button.
3. **Harness and tests** (`test/zxnext-hw/tape/`, harness method `insertTape(blocks | path)`):
   - LOAD "" of a TAP in 48K BASIC (`prepareBasic`), fast and real time; a CODE block lands in memory.
   - Real time at 7 MHz fails; fast load at 28 MHz works.
   - Port `$FE` bit 6 follows the conditioned input; the debounce drops a sub-1.14 µs pulse; a held
     level relaxes to 0.
   - The loading sound is in the mix at MIC level, on every output.
   - SAVE "x" CODE captures a TZX that loads back.
   - Reverse debugging across a tape load replays exactly (`test/emu/reverse-next-*`).
4. **Docs**: the Next guide and the tapes guide; the audio articles (article 7's "What Klive leaves
   out", the overview's Part 9); `.plans/LANDING_PAGE_COMPETITIVE_ANALYSIS.md` if the Next column
   lists tape; a `feature` changeset.
