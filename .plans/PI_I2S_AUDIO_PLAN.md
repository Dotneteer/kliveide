# ZX Spectrum Next Pi I2S Audio — Implementation Plan

**Status:** Phases 1-3 built (2026-10-27), except the Guides page with screenshots and an IDE status
indicator (see "As built"). Phase 4 (NextPi commands) is a separate, later plan.
**Written 2026-10-27.**

## As built (2026-10-27)

- **Core:** `src/emu/machines/zxNext/wasm/zxnext/zxnext-pi-i2s.c/.h`, included after `zxnext-clock28.c`.
  Hooks: the `$2C`/`$2E` reads in `zxnext-dac.c`, the `$253B` read (`zxnext-ports.c`, latches `$2D`), the
  `$A2` write (`zxnext-nextreg.c`), port `$FE` bit 6 (`zxnext-ula.c`), the mixer
  (`zxnext-audio-mixer.c`) and the beeper's MIC line, now `port_fe_mic xor pi_fe_ear`
  (`zxnext-beeper.c`).
- **Pure reads stay pure:** `Sync` advances the receiver on the paths that may change state. The getters
  and the NextReg read mux compute the same values on a copy (`zxnextPiI2sPeek`), so
  `zxnextGetNextRegisterDirect` and the `zxnextGetPiI2s*` exports leave the image unchanged
  (`test/wasm/reverse/export-contract.test.ts`).
- **Replay (D4) works through the input journal, not through a pure source.** The machine writes the
  samples into the ring with `writeCoreBytes` and calls `zxnextPiI2sAppend`. `PiI2s` is a journaled
  device noun in `exportContract.ts`. A reverse-debugging replay re-applies both where they happened,
  so the host's source is never consulted again. The journal grows by about 3.5 KB per frame at
  44.1 kHz stereo while a stream plays.
- **Trap found:** the amount to deliver (`zxnextGetPiI2sWant`) must not depend on *when* in a frame the
  host asks. The debug loop enters a frame at other moments than the fast path, so the first version
  (counted from now) delivered different amounts, and the debug-path replay test failed on
  `zxnextPiI2sFilled`. The target is now counted from the current frame's start: up to three frames
  past it. The ring holds 16384 samples, more than three frames at 192 kHz.
- **Host:** `src/emu/machines/zxNext/piI2s/` (`PiI2sSource.ts`: silence, tone, PCM, the machine guard;
  `wavDecoder.ts`; `piI2sSourceFromSpec.ts`), and `ZxNextWasmV2Machine.connectPiI2sSource` /
  `getPiI2sStatus` / `feedPiI2s`. The feed runs before the fast frame and at every debug-loop entry.
- **IDE:** the `pi-audio` command (`src/renderer/appIde/commands/PiAudioCommand.ts`) through
  `EmuApi.setPiI2sSource` / `getPiI2sStatus`. The WAV file is decoded in the emulator, which reports
  why a file is refused. The command is documented in `docs/content/en/reference/commands.mdx`.
- **Not done:**
  - a status indicator in the emulator's UI (the command with no argument shows the state)
  - the Guides page with generated screenshots
  - checking the change by hand in the running IDE
- **Tests:**
  - `test/zxnext-hw/audio/pi-i2s.test.ts` (I2S-001 - I2S-012, catalogue §4.39)
  - `test/audio/pi-i2s-sources.test.ts`
  - `test/commands/PiAudioCommand.test.ts`
  - the session self-test
  - a "zxnext (Pi I2S)" machine in `test/wasm/debug-loop-equivalence.test.ts` and in
    `test/wasm/reverse/journal-replay-determinism.test.ts` (slow tier)


The Next can take digital audio from the Raspberry Pi accelerator over I2S, and can send its own mix
the other way. Klive emulates the Next's side of the link only up to NextReg `$A2`: the register
reads back correctly, but no sample ever arrives. `zxnext-dac.c` returns the fixed "I2S off" values
from `$2C`–`$2E`, and the mixer's I2S input is always silent.

This plan emulates **the Next's half of the link, and nothing of the Pi**. The Pi is replaced by a
*sample source*: a stream of stereo samples at a fixed rate, which the host feeds into the core.
What the Pi *does* to make sound (NextPi's software and its UART commands) is a separate, later phase
(§5 Phase 4), and it will build on this one without changing it.

---

## 0. Decisions

- **D1 — No Pi.** No ARM, Linux or NextPi emulation, now or in Phase 4. The Pi exists only as the
  far end of two links: I2S (this plan) and UART 1 (the existing peer in `zxnext-uart.c`).
- **D2 — Model frames, not bits.** The Pi is always the I2S clock master (the FPGA's master mode and the
  `$A3` clock divider are commented out; see §1). The Next therefore observes only *when* each word's
  value becomes visible. The core models one event per channel per sample and does not toggle SCK, WS
  or SD.
- **D3 — The reference is the VHDL** (`_input/next-fpga/src/audio/i2s*.vhd`,
  `audio/audio_mixer.vhd`, `zxnext.vhd`). Line numbers below are from that copy.
- **D4 — Replay-exact.** Samples change machine-visible state: port `$FE` bit 6, NextRegs `$2C`–`$2E`
  and the mix. Everything that decides what the Next sees therefore lives in the core's linear memory
  and is part of the state image. None of it is volatile. A sample source is a pure function of the
  sample index, so after a restore the host can refill it from the cursor stored in the core. This
  keeps reverse debugging and `debug-loop-equivalence` honest (`src/emu/z80/wasm/README.md`, "volatile").
  *As built:* reverse debugging replays the journaled sample writes rather than asking the source
  again (see "As built").
- **D5 — No source means no Pi.** With nothing connected, SCK never toggles and nothing is latched.
  The receiver keeps its reset value, which reads as the rest level ($80/$00/$80, as today). This is
  the default and changes no existing behaviour or golden.
- **D6 — Next → Pi is a tap, not a feature.** The transmit side (`i2s_transmit`, the Next's own mix
  sent to the Pi) is only exposed for tests in Phase 1 if it comes cheaply. Nothing consumes it until
  Phase 4.

## 1. The contract (what the VHDL does)

### 1.1 Wiring and control — `zxnext.vhd` ~2239–2330, ~6410

- NR `$A2`:
  - bit 7 = left enable, bit 6 = right enable (`pi_i2s_en` = either)
  - bit 4 = data pin (`1`: SD in on GPIO 21, out on 20; `0`: the reverse)
  - bits 3/2 = mute left/right
  - bit 0 = route to EAR
  - The read value is already right: `(v & $DD) | $02` (`zxnext-nextreg.c:690`, GPIO-004).
- The Next is always the I2S slave: SCK/WS come from GPIO 18/19 (`pi_si2s_*`). The `$A3` divider and
  `pi_i2s_slave` are commented out.
- The `i2s` entity is held in reset while `pi_i2s_en = 0` (`i_reset => reset or not pi_i2s_en`, ~6415).
  Disabling clears the latched samples; re-enabling starts from the reset value.

### 1.2 Receiver — `i2s/i2s_slave.vhd`, `i2s/i2s_receive.vhd`, `i2s.vhd`

- `i2s_slave` produces `wsp`, a one-SCK pulse after each WS edge (the standard I2S one-bit delay).
- `i2s_receive` (`LR_WIDTH => 13`) shifts in the word MSB first and keeps its **top 13 bits**, whatever
  the slot width (16/24/32-bit slots all work). At the WS edge that ends the word it latches the
  result: **WS rising latches the left word, WS falling the right word** (WS low = left, the standard
  framing). Each channel therefore updates once per sample period, half a period apart.
- `i2s.vhd` keeps the top 10 of the 13 bits and inverts the sign bit, turning signed values into
  offset binary: `o = (not r(12)) & r(11 downto 3)`. For a signed 16-bit sample `s` this is
  **`v = ((s >> 6) & $3FF) ^ $200`**: 0 → $200, full negative → $000, full positive → $3FF.
- After reset the receiver holds 0, which reads as **$200** (the rest level) until the first latch.

### 1.3 What the latched samples feed — `zxnext.vhd` ~2314–2330, 3456, 5951–5961, 6449

- **The selection.** `pi_audio_L/R` is `"10" & X"00"` ($200) when I2S is off, that side is muted, or
  EAR routing is on. Otherwise a side whose enable is set gets its own sample, and a side whose enable
  is clear gets the other side's sample (mono duplication).
- **NR reads:** `$2C` returns `pi_audio_L(9..2)` and latches `L(1..0)`; `$2E` returns `pi_audio_R(9..2)`
  and latches `R(1..0)`; `$2D` returns the last latched pair in bits 7..6.
- **The mixer** (`audio_mixer.vhd:89-100`) adds `"000" & pi_i2s_X_i` (0–1023) per side, one unit
  per LSB. In Klive's signed, centred mixer this is `+ (v - 512)` per side. That gives I2S silence the
  same zero centre as the DACs, and the unit is ¼ of a DAC step.
- **EAR routing** (`pi_fe_ear`, a 28 MHz process):
  - It uses the *raw* receiver outputs, not the muted selection.
  - Threshold: `t = L(9..8) or R(9..8)`.
  - The bit goes to 1 when `t = "11"` and to 0 when `t = "00"`, and holds otherwise (hysteresis).
  - It is forced to 0 when I2S is off or EAR routing is off.
- **Port `$FE` bit 6:** `(i_AUDIO_EAR xor pi_fe_ear) or port_fe_ear or (mic and issue2)`. Klive's
  `zxnextUlaReadPortFe` has no physical tape input (`i_AUDIO_EAR` is effectively 0), so `pi_fe_ear`
  ORs straight into bit 6.
- **The speaker:** `beep_mic_final = port_fe_mic xor i_AUDIO_EAR xor pi_fe_ear` (~6449), so with EAR
  routing on, the Pi's audio is heard as a 1-bit signal through the MIC path. The beeper module
  needs that XOR.

## 2. Architecture

```
   host (TypeScript)                       core (C, state image)
 ┌─────────────────────┐  per frame   ┌──────────────────────────────────────────┐
 │ PiI2sSource          │ ───────────▶ │ window ring: int16 L/R, indexed by k     │
 │  sample(k) -> L,R    │  fill k0..k1 │ cursor k, start clock, rate (phase acc.) │
 │  rate, length        │              │ receiver: latchL, latchR, pi_fe_ear      │
 └─────────────────────┘              │ lazy sync to the 28 MHz clock            │
                                       └──────┬───────────┬───────────┬──────────┘
                                         NR $2C-$2E    mixer      port $FE / MIC
```

- **New core file** `zxnext-pi-i2s.c/.h`, in the unity build next to `zxnext-dac.c`.
- **Time:** sample `k` of a stream that starts at 28 MHz clock `c0` with rate `Fs` (both stored in the
  core) is latched at:
  - left: `c0 + floor((2k + 1) · 28e6 / (2·Fs))`, i.e. mid-period, when WS rises
  - right: `c0 + floor((k + 1) · 28e6 / Fs)`, i.e. end of the period

  `zxnextClock28Now` (`zxnext-clock28.c`) is the clock, the same one the UARTs use. Integer
  arithmetic only, so there is no drift.
- **Lazy sync,** like `zxnextUartSync`: `zxnextPiI2sSync()` advances the latches to "now" before
  every reader: the NR `$2C`/`$2E` reads, the port `$FE` read, the mixer's per-sample refresh
  (`zxnextAudioMixerRefreshCurrentSources`, at that sample's end tact) and the beeper's MIC level.
  `pi_fe_ear`'s hysteresis is evaluated at each latch event, since it can only change when a latch
  changes.
- **The window:** a ring of `N` stereo int16 samples (`N = 4096`: more than two frames at 96 kHz, 16 KB),
  with the index of the next sample to fill. The core exports what it needs for the coming frame:
  `zxnextPiI2sWant(&from, &count)`, computed from the frame's length in 28 MHz tacts. The host writes
  exactly those samples. If the stream has ended, the host says so (`zxnextPiI2sEnd(k)`). After the
  last sample no more WS edges happen, so the latches hold their last values; a real Pi that stops
  clocking behaves the same way.
- **When the host fills:** at frame begin, in both paths, so fast frames and debug runs see identical
  windows:
  - the fast frame's entry
  - the debug loop's `enter()` (`wasmDebugLoop.ts`: "frame-level work ... audio and clock syncs")

  `Want` returns 0 when the window for this frame is already full, which makes the fill idempotent
  for a debug run that re-enters mid-frame.
- **Disconnected** (D5) is a core flag: there are no events, and the latches keep their reset value.
- **Enable/disable:** a write to `$A2` that clears both enables resets the latches and `pi_fe_ear`
  (§1.1). The stream keeps running regardless, as the Pi does: the cursor follows time, not the enable.

### 2.1 Known simplifications (recorded, deliberate)

- **A word in progress when I2S is enabled.** On hardware it is shifted in from a mid-word bit position,
  so the first latch after enabling can be garbage. Klive latches the clean value. No software
  can rely on the garbage.
- **Latch timing:** the `wsp` one-SCK delay and the 28 MHz edge detection are ignored. Together they
  are about one SCK period (~0.35 µs at 44.1 kHz/32-bit slots), well under one CPU instruction.
- **Sources that are not 16-bit** are converted to int16 on the host. Only the top 10 bits ever
  reach the Next (§1.2), so nothing visible is lost.

## 3. Host side

- `PiI2sSource` (TypeScript): `rate`, `length | undefined` (endless), `fill(from, count, outL, outR)`.
  It must be pure in `k` (D4).
- Built-in sources:
  - **silence**
  - **test tone** (frequency, level, L/R/both): for tests and for a user to check their program's
    routing
  - **WAV file** (PCM 8/16/24-bit, mono or stereo, any rate; decoded once into memory)

  Compressed formats are out of scope.
- `ZxNextWasmV2Machine` owns the connected source, its start clock and its identity:
  - `connectPiI2sSource(source)` and `disconnectPiI2sSource()` change the stream, so they invalidate
    checkpoints. Restoring a machine to a time before the switch cannot bring the old stream back,
    the same reasoning as the SD-card write (`captureCheckpoint`'s comment).
  - After `loadMachineState` / `tryRestoreCheckpoint`, the next frame's `Want` re-requests from the
    restored cursor. No extra code should be needed, and a test proves it (§6).
- A saved machine state records only the *fact* that a source was connected and its rate/start, not
  the samples. Loading such a state with no source connected behaves as "the stream ended at the
  cursor" (§2 window: hold the last values). This is documented, not hidden.

## 4. IDE surface (Phase 3)

- An IDE command to connect a source, e.g. `pi-audio <file.wav>` / `pi-audio tone 440` /
  `pi-audio off`. Before naming it, check the existing command vocabulary for conventions (the
  `.ai/doc-screenshots-guide.md` vocabulary lists them). The file reaches the machine the way tape
  files do today; find that path and reuse it, do not add a second one.
- A status indicator while a source is connected (its name, position, "ended").
- All text through `t()` with translator context (`.ai/i18n-guide.md`), then `npm run i18n:keys`.
- Any visual element follows `.ai/ui-theming-intent-and-lessons.md` and updates it in the same change.

## 5. Phases

### Phase 1 — The receiver in the core (no host source yet)

1. `zxnext-pi-i2s.c/.h`: state (window ring, cursor, `c0`, `Fs`, connected/ended flags, latches,
   `pi_fe_ear`), reset/soft reset (`$A2` = 0 → latches at reset value), `Sync`, `Want`, `End`.
2. Hook the readers:
   - `zxnext-dac.c`: replace `zxnextDacGetNextReg`'s constants with the selection of §1.3, keeping the
     `$2D` latch behaviour
   - `zxnext-audio-mixer.c`: add `(v - 512)` per side in `zxnextAudioMixerGetMixedSide`, and update
     its header comment, which already names `i2s`
   - `zxnext-ula.c` `zxnextUlaReadPortFe`: OR in `pi_fe_ear`
   - the beeper: XOR `pi_fe_ear` into the MIC level
3. `$A2` writes reset the receiver when both enables go to 0.
4. Exports in `zxnext.c`, `scripts/build-zxnext-wasm.cjs`, `ZxNextWasmV2Loader.ts`: connect (rate,
   start), fill a span, end, disconnect, and a read of the raw latches for tests.
5. Harness: a session method that connects a test stream and fills it from a function of `k`
   (README "Adding a method": name it after the hardware action, add a self-test, and add a row to the
   API table).
6. Tests in `test/zxnext-hw/audio/pi-i2s.test.ts`, registered in `build/e2e-tests.ts` (§6). Add an
   **I2S section to `.plans/ZX_SPECTRUM_NEXT_HARDWARE_TEST_CATALOGUE_PLAN.md`** with the rows, and
   update DAC-011's note.

Done when all §6 Phase-1 tests pass, every existing audio/nextreg/gpio test and the WASM core
snapshot tests are unchanged, and `npm run benchmark:debug-overhead -- --reference HEAD` shows no
cost with no source connected.

### Phase 2 — Deterministic feeding from the host

1. `PiI2sSource` and the silence / tone / WAV sources (§3), with unit tests (tier `node`) of the
   decoding and of `v = ((s >> 6) & $3FF) ^ $200` on known samples.
2. `ZxNextWasmV2Machine`: connect/disconnect, the fill at frame begin in both the fast path and the
   debug loop's `enter()`, and checkpoint invalidation on connect/disconnect.
3. Replay tests (§6).

### Phase 3 — In the IDE

1. The command, the status indicator, i18n (§4).
2. Docs:
   - a Guides page on feeding Pi audio, with generated screenshots (`guides-*` recipe)
   - the planned `pi-audio` Under-the-hood article (`.plans/NEXT_AUDIO_ARTICLES_PLAN.md` §7) can now
     show Klive. Update that plan's lines 130–131 and 579 ("Pi I2S audio is not emulated").
3. Changeset (`feature`) with the commit that completes Phase 3, describing the whole plan's result
   (AGENTS.md: no changeset for intermediate phases).
4. If the feature is then listed in `CLOSING_THE_GAPS_PLAN.md` / the competitive analysis, update both
   tables (standing instruction). Neither mentions Pi audio today.

### Phase 4 — NextPi commands (later, separate plan)

Out of scope here; written down so Phases 1–3 do not block it.

- On a real Next, software asks NextPi for sound over UART 1, e.g. to play a module or a sample. The
  replacement is a **host-side NextPi responder** on the existing UART 1 peer (`zxnextUartPeer*`) that
  understands a documented subset of commands and answers by connecting a `PiI2sSource` (a WAV it
  decodes, a module player).
- First tasks for that plan:
  - Collect the NextPi command set from its public documentation, recorded in Klive's own words.
  - Decide which subset is worth answering, and how a Pi-side file (on the Pi's SD) maps to a host file.
- The transmit tap (D6) becomes useful here, for Pi software that processes the Next's own audio.
- Phases 1–3 need no change for this: the responder is just another way to call `connectPiI2sSource`.
  It must be replay-safe in the same way: whatever it decides depends only on the bytes the Next sent.

## 6. Tests

Phase 1 (harness, real core, `test/zxnext-hw/audio/pi-i2s.test.ts`):

- **Rest values:** with no source, `$2C/$2D/$2E` = $80/$00/$80 for every `$A2` setting
  (the current DAC-011 behaviour, kept).
- **Conversion:** a stream of known int16 values reads back as `((s >> 6) & $3FF) ^ $200` through
  `$2C`+`$2D` and `$2E`+`$2D`, including both extremes and 0.
- **Selection:** stereo, left-only (both sides read the left sample), right-only, mute per side, EAR
  routing (both sides read $200).
- **Timing:** the left value changes half a period before the right one; with a 28 MHz-exact rate, a
  read just before and just after the latch tact sees the old and the new value.
- **Disable resets:** clear `$A2` bits 7–6, then re-enable: the rest value is read until the next latch.
- **Ended stream holds** its last values.
- **EAR:** port `$FE` bit 6 follows the hysteresis: it goes to 1 only at `11`, to 0 only at `00`, and
  holds through `01`/`10`. It is 0 with routing off. A ROM `LOAD ""` fed a tone-encoded tape signal
  through I2S loads a block (this one may belong in the slow tier).
- **Mix:** with only I2S active, `getAudioSamples` follows the stream's shape, centred at 0, with the
  expected amplitude ratio to a DAC step (1:4).

Phase 2:

- **Replay:** capture a checkpoint mid-stream, run N frames, restore, run N frames again: identical
  NR reads, port reads and audio samples.
- **Debug loop:** a debug run (breakpoints, steps) over a frame with I2S reads stops exactly where an
  instruction-by-instruction run does. Extend `test/wasm/debug-loop-equivalence.test.ts` with a
  connected stream.
- **Connect invalidates checkpoints.**

All new core-running tests go in `build/e2e-tests.ts` (fast tier unless over 20 s).
