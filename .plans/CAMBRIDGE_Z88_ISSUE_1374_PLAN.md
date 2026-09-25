# Cambridge Z88 Issue #1374 Plan

Status: **Planned 2026-09-25.** Source: https://github.com/Dotneteer/kliveide/issues/1374
("Review of Cambridge Z88 WASM implementation", bits4fun).

The TypeScript Z88 is gone (`CAMBRIDGE_Z88_TYPESCRIPT_REMOVAL_PLAN.md`), so every fix lands in the
WASM core or in the shared renderer. The reporter saw each symptom on both backends, and that holds
up: none of the five is a WASM regression. Three are renderer/shared-code defects that other
machines mask.

| Step | Symptom | Root cause | Confidence | Where |
| ---- | ------- | ---------- | ---------- | ----- |
| 1 | Host cursor keys dead | Joystick hook claims arrow keys on every machine | Confirmed | renderer |
| 2 | Choppy sound | Worklet buffer sized in *frames*; a Z88 frame is 5 ms | Confirmed by analysis | renderer worklet |
| 3 | LCD corners clipped | Rounded `.display` clips a machine with no border | Confirmed | renderer |
| 4 | No auto-coma timeout | Unknown; stuck key and TSTA suspects | Needs repro | renderer + WASM core |
| 5 | Recording never starts | Unknown; strong suspects | Needs repro | renderer + main |

Steps are in execution order. Step 1 is small, affects the Spectrum too, and may partly explain
Step 4. Step 2 is the most audible. Steps 4 and 5 start with investigation.

---

## Step 1 - Host cursor keys (and right Shift, right Ctrl, `\`, NumpadEnter)

**Done 2026-09-25.** `useEmulatorJoystick` now returns `claimsKey(code)` in place of the
`claimedCodes` set. It answers `false`, and the keydown handler returns early, unless the current
machine has `setJoystickState`. It is asked at event time, so a machine-type switch needs no
re-render. Tests are in `test/controls/useEmulatorJoystick.test.tsx`: no claims on a machine
without connectors, the event travels on, claims start after a switch to a machine with
connectors, and the joystick and keyboard hooks together reach `setKeyStatus` for
ArrowLeft/ShiftRight.

**Cause.** `DEFAULT_JOYSTICK_BINDINGS.left` (`src/common/settings/joystick-bindings.ts:91-105`)
binds ArrowUp/Down/Left/Right, ControlRight, ShiftRight, Backslash and NumpadEnter. The joystick
hook was added for the ZX Spectrum Next in bb7239870 (#1359).
`useEmulatorJoystick.ts:55-58` puts those codes in `claimedCodes` whatever the machine is. Its
keydown handler (`:94-111`) calls `preventDefault()` + `stopImmediatePropagation()`, and
`useEmulatorKeyboard.ts:63` also skips claimed codes. Only `applyPins` checks for
`setJoystickState`, so on the Z88 the keys go nowhere. The on-screen keyboard works because it goes
through `queueKeystroke`, not `window` events. `Z88KeyMappings.ts:95-98` is correct.

The same defect also:
- swallows right Shift on the Z88, so the host keyboard cannot do the Shift+Shift coma/wake (only
  F6 can);
- swallows arrows (CShift+5..8) and right Shift on the ZX Spectrum 48/128/+3E.

**Fix.**
- In `useEmulatorJoystick`, claim codes and stop propagation only when the current machine has
  `setJoystickState`. `claimedCodes` becomes empty otherwise, which also frees
  `useEmulatorKeyboard`. Re-evaluate when the controller's machine changes (the machine type
  switch), not only when the bindings change.
- Keep the Next behaviour as it is: bound keys still belong to the joystick there.

**Tests** (`--project jsdom`):
- the hook with a machine without `setJoystickState` claims nothing and does not stop the event;
- with a Next-like machine it still claims;
- `useEmulatorKeyboard` reaches `setKeyStatus` for ArrowLeft on a Z88-shaped fake.

---

## Step 2 - Choppy sound

**Done 2026-09-25.**
- `initAudio(tacts, clock, rate, framesPerBurst)` passes `samplesPerFrame * uiFrameFrequency`
  (`EmulatorPanel` passes `machine.uiFrameFrequency`). The worklet's constants now mean bursts,
  and are unchanged for one frame per burst. Only the Z88 has `uiFrameFrequency > 1`: the C64, the
  Spectrum family and the Next are all 1.
- `z88-beeper.c` keeps the next sample point in [0, 2^32) and compares by signed distance, and
  `z88SetAudioSampleRate` schedules from the current tact. The WASM is rebuilt.
- Tests:
  - `SamplingWorklet.test.ts`: Z88 bursts played against an output clock give no gaps; sizing in
    machine frames is shown to chop.
  - `wasm-z88-machine.test.ts`: samples keep coming across the wrap. This test was confirmed to
    fail on the old core.
- Still to do: a listening check with the ManicMiner intro in the app.
- Found on the way, not fixed: `Z88WasmHost.emulateKeystroke` compares absolute tacts as well
  (`test/wasm/z88/wasm-z88-machine.test.ts` "queues and plays keystrokes"). A queued keystroke that
  straddles the wrap could hang. That code is TypeScript reading the 32-bit counter, so check it
  in Step 4 alongside the stuck-key suspect.

**Cause.**
- A Z88 frame is 16384 T-states at 3.2768 MHz, which is 5 ms. `uiFrameFrequency = 8`, so
  `MachineController` runs 8 frames back to back and then sleeps about 40 ms.
- Each frame posts about 240 samples to `Sampling.worklet.js`, so every 40 ms roughly 1920 samples
  arrive at once.
- The worklet is sized in frames: `FRAMES_BUFFERED = 6`, `MAX_LAG_FRAMES = 3`, `FRAMES_DELAYED = 1`
  (`samplesPerFrame` from `useEmulatorAudio.ts:10`). That is about 15 ms of allowed lag.
- `storeSamples` therefore throws away about 60% of each burst. What remains plays out, then the
  buffer runs dry until the next burst: about 15 ms of sound, then 25 ms of silence.
- The Spectrum is fine: its frames are 20 ms and it sends one per wake-up.
- This started with 5acb4cae2 (#1190, 40 → 6 frames, lag dropping added), not with the WASM work.

**Fix.** Size the worklet in **time, not frames**.
- Pass the batch size to `initAudio`, i.e. `samplesPerFrame * uiFrameFrequency`, or have the
  worklet take millisecond targets (for example capacity ≈ 120 ms, max lag ≈ 3 UI batches,
  priming ≈ 1 UI batch).
- Keep the #1356 echo fix intact. For `uiFrameFrequency = 1` the numbers must be unchanged, so the
  Spectrum/Next latency does not move.
- Check every other machine's `uiFrameFrequency`. Any machine above 1 has the same latent problem
  and gets the same fix.

**Also fix: silence after about 22 minutes.**
- `cpu.tacts` is `uint32_t`, while `z88AudioNextSampleTact` is a `double` that keeps growing
  (`z88-beeper.c:24,56,73`). After 2^32 T-states (about 21.8 min at 1×) no more samples are made.
- Port the wrap guard from `zx-spectrum-beeper.c:52-54,167-170`, then rebuild the WASM
  (`scripts/build-z88-wasm.cjs`).

**Tests.**
- `test/controls/SamplingWorklet.test.ts`: feed 8 × 240-sample bursts every 40 ms of simulated
  playback, and assert no samples are dropped and no dry gaps after priming. Keep the existing
  `uiFrameFrequency = 1` cases green.
- `test/wasm/z88/`: advance tacts across the 32-bit wrap and assert samples keep coming.
- Manual: the ManicMiner intro against the OZvm recording attached to the issue.

---

## Step 2b - OZ 4.7 keyboard freezes with Keyclick on (found while testing Step 1)

**Done 2026-09-25.** The report: with Keyclick on, an arrow key in the Index moved the highlight
once, then the keyboard was dead while the machine kept running. Step 1 made this reachable, since
host arrow keys had never reached the Z88 before it.

- **Cause:** the shared `z80.c` emulated the NMOS Z80's LD A,I / LD A,R interrupt glitch (added
  in #1191).
  1. OZ 4.7's `$003B` (save interrupt state, DI) got P/V = 0 from an RTC interrupt accepted right
     after its LD A,I.
  2. Its fallback at `$0042` then found the interrupt's return address in the stack slot and
     concluded "interrupts were off".
  3. The key-wait routine (`$CB2A`) exited through `$CBB3 JP C` without EI.

  The Z88's Z80 is CMOS, which does not have the glitch; MAME's `z80.cpp` lists it among the Z80
  types' differences.
- **Fix:** a compile-time `Z80_CMOS` option in `z80.c`, default 0 (NMOS). `z88.c` sets it to 1.
- **Tests:**
  - `test/z88/z88-interrupts.test.ts` "the Z80 is a CMOS part": 19 of 19 interrupts found P/V clear
    with NMOS, 0 with CMOS.
  - `test/z88/z88-oz47-keyclick.test.ts`: the reported key sequence. With NMOS the IM 1 handler
    never runs again; with CMOS it does.
  - Both tests were confirmed to fail with `Z80_CMOS 0`.
- **Not changed:** the Spectrum-family cores, which keep the NMOS behaviour. All `test/wasm`,
  `test/z80` and `test/z88` suites pass.

## Step 3 - LCD corners clipped by the rounded display

**Cause.**
- `.display` in `EmulatorPanel.module.scss:82-100` has `border-radius: var(--radius-md)` (6px) and
  `overflow: hidden`, and the canvas fills it edge to edge.
- Spectrum-family screens include an emulated border, so the clip only eats border pixels.
- The Z88 buffer is pure LCD (640×N), so the clip eats picture pixels.

**Fix (renderer, preferred).** Add an optional machine property, e.g.
`screenMargin?: { px: number; color: string }` on the machine interface. The Z88 sets about 4px
and the unlit LCD colour. Then:
- `EmulatorPanel` pads `.display` by that margin with that background;
- `useEmulatorScreen.calculateDimensions` subtracts the margin before fitting the zoom, so large LCD
  sizes (640×320/480) do not overflow.

Why not a border in the WASM frame buffer:
- it would restride every loop in `z88-screen.c`, `Z88_PIXEL_BUFFER_WORDS`, the memory
  `_Static_assert`, `applyLcdSize` and the goldens;
- it would add a border to recordings that the real machine does not have.

**Colour.**
- The unlit LCD is `Z88_PX_OFF` = #D2E0B9 (`z88-screen.c:16-19`). Per `AGENTS.md` no literal goes
  in a stylesheet: add an L1/L2 token (e.g. `--device-z88-lcd`) and reference it. The value is an
  emulated-hardware colour, so it must not follow the theme.
- When the LCD is switched off (`Z88_PX_SCREEN_OFF` #A0A0A0), either expose the LCD-on state and
  swap the margin colour, or accept a mismatched frame while the screen is off. Decide in review;
  swapping is cheap if the core exports `COM.LCDON`.

**Docs.** Update `.ai/ui-theming-intent-and-lessons.md` in the same change (standing rule): *a
machine whose frame buffer has no emulated border declares a margin; the rounded display clip must
never land on picture pixels.*

**Verify.** In the running app via the CDP recipe, at 640×64 and 640×480, at several zoom levels.
Not in a standalone replica.

---

## Step 4 - No automatic coma after the OZ timeout

**What is known.**
- OZ 4.0 decrements its inactivity counter (`$0264`) on the RTC MIN interrupt and sets the timeout
  flag (`$03F6` bit 2) at zero.
- It resets that counter from the Panel timeout (`$0201`) on every TICK where the keyboard matrix
  shows any key down (`$D95E`: `xor a; in a,($B2); inc a; call nz,$CEE0`).
- The sleep routine turns off `COM.LCDON` and snoozes on a KWAIT read.
- The core's RTC/TIM path matches the deleted TypeScript Blink line for line, which fits the
  reporter seeing it on both backends.

**Investigate first** (a short script on the harness in `test/harness/z88/`, not guesswork). Boot
OZ, set the Panel timeout to 1 minute, run about 70 emulated seconds with no input, and log each
second:
- `$0201`, `$0264`, `$03F6`, `$026B`;
- TMK/TSTA/INT;
- the eight keyboard lines.

Then repeat through the real IDE path (host keys pressed and released).

**Suspects, most likely first:**
1. **Stuck key in the matrix.** `useEmulatorKeyboard` has no `blur`/`visibilitychange` release.
   Key-ups are dropped while a modal is open or the machine is not Running (`:84-89`). On macOS,
   key-ups are lost while Cmd is held. One stuck bit resets the counter every tick, forever.
   - **Fix:** release every pressed machine key on blur, on visibility change, when a modal opens,
     and when leaving Running, mirroring `useEmulatorJoystick.releaseAll`. This helps every machine.
2. **TSTA overwritten, not accumulated.** `z88-blink.c:216` sets `z88Tsta = tickEvent`. The real
   Blink latches TSTA bits until they are acknowledged via TACK, so an unserviced MIN can be replaced
   by the next TICK and lost.
   - **Fix:** `z88Tsta |= tickEvent`, and acknowledge in the TACK write.
   - Add a harness test in which the CPU has interrupts disabled across a minute boundary and still
     sees MIN afterwards.
3. **TMK never enables MIN** in normal operation. Settled by the log above.
4. **OZ state** (timeout 0, `$026B` set, the app in a timed wait). Not an emulator bug; document it
   if so.

**Side note.** The core's "sleep mode" flag (`z88-keyboard.c:56-73`, HALT with I=$3F) never fires
for an OZ 4 timeout coma, which is a KWAIT snooze. It only drives the `battery_low` command today.
Decide whether it should also recognise KWAIT snooze with LCD off. Keep that out of this fix unless
the investigation shows the IDE needs it.

**Tests.** A harness test for the timeout coma: after about 1 min 10 s idle, `COM.LCDON` is off and
the CPU is snoozed. Place it in `test/wasm/z88/` or `test/z88/`, next to
`z88-sleep-and-boot.test.ts`.

---

## Step 5 - Screen recording never produces a file

**What is known.**
- The empty `~/KliveExports/video` folder proves `startScreenRecording` ran:
  `resolveRecordingPath` created the folder, and ffmpeg was spawned (or its spawn was attempted).
- Nothing that checks dimensions, fps (25), aspect ratio or audio rejects the Z88.
- Errors only reach the main-process console (`FfmpegRecordingBackend` `_dead`) and
  `console.error` (`RecordingManager.ts:251-255`).

**Investigate first.**
- Record a Z88 and a ZX Spectrum on the same build.
- Read the main-process `[FFmpegBackend] stderr:` lines.
- Ask the reporter whether they stopped the recording or the machine. Pause does not finalise the
  file.

**Suspects:**
1. **Whole WASM memory sent per frame.** `imageBuffer8.current` is a `subarray` view into the core's
   linear memory (`useEmulatorScreen.ts:236-239`), and it is passed to `appendRecordingFrame`.
   Structured clone copies the entire backing buffer: 8 MB per frame for the Z88, about 200 MB/s at
   25 fps. The Spectrum cores use the same pattern with smaller memories.
   - **Fix:** send `rgba.slice()` in `RecordingManager.appendFrame`. This is correct for every
     machine anyway.
2. **200 request/response audio IPCs per second** (one per 5 ms frame), while video goes once per
   UI batch. ffmpeg 4.1 opens its output only after probing both `pipe:0` and `pipe:3`.
   - **Fix:** batch audio per UI frame in `RecordingManager` (the same batching idea as Step 2).
3. **ffmpeg binary path in the packaged app** (`app.asar`). Not Z88-specific. The Spectrum
   comparison rules it in or out.

**Also.** Surface a backend failure to the user: a status-bar or notification message instead of
only a console line, so "nothing happened" can never be silent again.

**Tests.** `test/recording/RecordingManager.test.ts`:
- a frame that is a view into a larger buffer is sent as exactly `w*h*4` bytes;
- audio from several machine frames is coalesced per UI frame;
- a dead backend surfaces an error.

---

## Wrap-up

- Run focused tests, `npm run build:check`, and `npm run lint:renderer` (renderer React is
  touched).
- Rebuild the Z88 WASM (Steps 2 and 4) and commit `dist/cambridge-z88.wasm`.
- Update `CHANGELOG.md`, `src/emu/machines/z88/wasm/README.md` (TSTA latching, the tact-wrap
  guard), `.ai/wasm-migration-intent-and-lessons.md` (the worklet sized in time is a cross-machine
  lesson) and `.ai/ui-theming-intent-and-lessons.md` (Step 3).
- Reply on the issue with per-item status. Ask the reporter for the recording details (Step 5) and
  their Panel timeout setting (Step 4) if the repro is inconclusive.
