# Cambridge Z88 Issue #1374 Plan

Status: **Done 2026-09-25** (all five steps, plus the OZ 4.7 keyboard freeze found on the way). Source: https://github.com/Dotneteer/kliveide/issues/1374
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

**Done 2026-09-25.**
- **Machine side:** an optional `getScreenSurroundColor()` on `IAnyMachine` (ABGR, the machine's
  colour). The Z88 implements it through a new core export `z88GetLcdSurroundColor` (unlit
  `Z88_PX_OFF`, or `Z88_PX_SCREEN_OFF` once the LCD was painted off).
- **Renderer (`useEmulatorScreen`):**
  - adds `.surround` (padding `--radius-md`) and paints the colour on every shown picture;
  - keeps the padding and the display's border out of the zoom fit.
- **Changed from the plan:**
  - The colour comes from the core instead of an L1/L2 token. It is a machine colour, per "Colour
    That Belongs To The Machine".
  - The margin is the corner radius, not a fixed 4px.
- **Found by verifying in the running app:**
  - `.display` was `border-box`, so the canvas overflowed its box. On every machine the 1px border
    already clipped a pixel per edge. `.display` is `content-box` now.
  - Switching from the Z88 to a Spectrum left the green behind. The per-machine reset now uses a
    sentinel.
- **Verified in the app:**
  - Z88 640×64: display 974×110 around a 960×96 canvas.
  - Z88 640×320 and with the LCD off: correct.
  - Spectrum 48: no padding, bezel background, canvas 352×288 inside 354×290.
- **Tests:** `test/controls/useEmulatorScreen.test.tsx`, "a machine that reports a surround
  colour" (fit, colour, colour following the LCD, machine switch).

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

**Done 2026-09-25.** Reproduced in the harness: none of OZ 5.0, 4.7 and 4.0 switched off after
7 idle minutes (default timeout 5). Three different stories, two Blink bugs:

- **OZ 4.0** was fine. Its idle countdown (`$0264`) is loaded from the Panel timeout (`$0201`) only
  once a key is seen down. Idle from boot it never starts; after one key it counts 6→0 and sleeps.
  Not a bug.
- **OZ 5.0: COM.RESTIM reset TMK.**
  - OZ 5.0's TICK/SEC/MIN handler reads `TSTA & (TMK softcopy $04B5)`, handles TICK first, and only
    then SEC (`$D6CE`) or MIN (`$D68D`, which decrements the idle minutes at `$0505` and sets bit 2
    of `$0503`).
  - It writes TMK = `$07` once at `$805F`, then COM = `$15` (RESTIM) at `$C6A2` while booting.
    `z88BlinkResetRtc` also set TMK = TICK, and nothing ever enabled MIN again.
  - The Developers' Notes say RESTIM resets the clock to zero and hold it there. TMK is the
    software's mask.
  - **Fix:** RESTIM resets TIM0–4 and TSTA only; the power-on reset sets TMK.
- **OZ 4.7: TSTA was overwritten.**
  - OZ 4.7 keeps TMK = TICK while idle and sees the minute only as a MIN bit still in TSTA when its
    TICK handler runs.
  - `z88Tsta = tickEvent` replaced MIN with the next TICK 5 ms later (and a minute replaced its
    SEC).
  - **Fix:** TSTA accumulates (`|=`, SEC | MIN together). TACK clears named bits, and STA.TIME
    drops only when `TSTA & TMK` is empty.
  - The Developers' Notes ("Blink interrupts") say an enabled event must be acknowledged before a
    new similar one fires. They don't state the latching of disabled events outright; the ROM
    evidence decides it.
- **Each fix alone cures one ROM** (checked by building each separately). OZ 4.0 keeps working
  with both.
- **The stuck-key suspects** (no key release on blur, etc.) turned out not to be involved.
- **Goldens:** by the author's decision, re-recorded with a new opt-in `Z88_GOLDENS_RECORD=1`
  (`test/wasm/z88/z88-goldens.ts`) and reviewed.
  - 495/758 parity keys and 15/121 IDE-parity keys changed. That is the typing sessions and running
    digests, the boots from frame 200 (TSTA 1→3 first, then a few tacts), and the random-LCD runs
    (TSTA 1→3 only).
  - No `lcd.sha256` changed.
- **Tests:**
  - `test/z88/rtc.test.ts`: the table expects latched TSTA, plus three new cases (latching and
    TACK, STA.TIME while an enabled event is pending, RESTIM keeps TMK).
  - `test/z88/z88-timeout-coma.test.ts`: OZ 5.0/4.7/4.0 are on at 4 idle minutes and off at 6.
  - On the old Blink, the RTC table fails and the coma test fails for OZ 5.0 and 4.7.
- **Found on the way:** `Z88WasmHost.emulateKeystroke` compared absolute tacts (from Step 2). Fixed
  after Step 5, see "Follow-up: keystroke queue across the tact wrap".

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

**Done 2026-09-25.** Not a Z88 fault.
- **The Z88 records fine in a development build.** A scripted run recorded 5 s of OZ 5.0: 640×64,
  25 fps, 125 frames, with AAC audio. A Spectrum 48 recorded 352×288 at 50 fps.
- **The reporter's symptom is the packaged app.**
  - `@ffmpeg-installer/ffmpeg` computes its binary's path from its own `__dirname`, which in a
    package is inside `app.asar`. Electron's `fs` says it exists, so the menu shows recording, but
    `spawn` cannot execute a file inside an archive.
  - `asarUnpack` (`build/electron-builder.json5`) already puts the binary under
    `app.asar.unpacked`, and the installed 0.58.2 has it there. Nothing mapped the path, as the
    package's README says to.
  - Starting a recording created `~/KliveExports/video`, then the spawn failed. `finish()` still
    returned the path, and the failure only reached the main-process console.
- **Fixes:**
  - `toUnpackedAsarPath` in `ffmpegAvailable.ts`.
  - `FfmpegRecordingBackend` keeps the reason (spawn error, or exit code plus the last stderr lines)
    and `finish()` rejects with it.
  - `stopScreenRecording` shows it in an error box.
- **Tests:**
  - `test/recording/ffmpegAvailable.test.ts`.
  - Four failure cases in `FfmpegRecordingBackend.test.ts`, confirmed to fail on the old backend.
- **Not verified:** a packaged build, which the author should check with `npm run build:mac`.
- **Not needed:** the plan's other suspects (a whole WASM memory per frame, 200 audio IPCs per
  second). The development recording kept up without them.

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

## Follow-up: keystroke queue across the tact wrap

**Done 2026-09-25.**
- **Cause:**
  - `queueKeystroke` computed a keystroke's start and end in JS numbers, past 2^32.
  - `emulateKeystroke` compared them by value with the core's 32-bit counter.
  - Across the wrap (about 22 minutes on the Z88), a key queued just before it stayed pressed for
    good (a stuck key, which would also block OZ's idle timeout), and one starting past 2^32 never
    began and blocked the queue.
  - The on-screen keyboard uses this queue.
- **Fix:** `toTactCounter` and `tactsPast` in `src/emu/structs/EmulatedKeyStroke.ts`, which keep
  the points in the counter's range and compare by signed 32-bit distance. `Z88WasmHost` uses them.
- **Tests:**
  - `test/emu/emulated-keystroke-tacts.test.ts`.
  - Two wrap cases in `test/wasm/z88/wasm-z88-machine.test.ts`, confirmed to fail on the old
    comparison.
- **Not changed:** `ZxSpectrumBase.emulateKeystroke` (Spectrum 48/128/+3E, 32-bit counter at 3.5 MHz,
  wraps after about 20 min) and `ZxNextWasmHost.emulateKeystroke` (28 MHz, wraps about every
  2.5 min). They have the same comparison and can adopt the same helpers.

## Follow-up: recorded Z88 sound was a thump

**Done 2026-09-25**, reported by the author after Step 5.
- **Symptom:** the emulator played a short single-frequency beep, and the recording had a "thump".
- **Cause:** `renderMachineAudioFrame` copied the sample array with `slice()` but kept the machine's
  sample objects, which the Z88 core reuses every frame.
  - The speaker got each frame synchronously.
  - The recorder got it after `await play()`. By then the controller's eight-frame burst had
    overwritten the objects, so every frame recorded the burst's last 5 ms.
- **Fix:** snapshot the values before the first await.
- **Tests** (`test/controls/EmulatorAudioRendering.test.ts`), both confirmed to fail on the old
  hand-off:
  - reused sample objects;
  - the real Z88 core playing an SBIT square wave through an eight-frame burst, where the recording
    must equal what the speaker got.
- **Also fixed, on the author's request:** in "half fps" recording mode,
  `RecordingManager.submitAudioSamples` dropped the audio of every skipped video frame.
  - Measured with the real FFmpeg: 2 s of half-fps video carried 0.98 s of audio (2.00/1.98 s with
    all the audio kept).
  - Now every frame's audio is sent.
  - Tests in `test/recording/RecordingManager.test.ts` (including eight audio frames per video frame,
    as on the Z88) replace the one that asserted the drop, and fail on the old recorder.
  - `holdFrame()` (re-sending the last frame and audio chunk while paused) has no caller, so pausing
    adds no padding and needs no change.

## Follow-up: Spectrum and Next keystroke queue

**Done 2026-09-25.**
- **Fix:** `ZxSpectrumBase` (48/128/+3E) and `ZxNextWasmHost` now use `tactsPast` and
  `toTactCounter` like the Z88, plus a new `laterTact` for the queue's chaining step. Their
  `queueKeystroke` anchored a key to `Math.max(this.tacts, lastEndTact)`, which picks the wrong point
  across the edge.
- **The real edge is 2^31, not 2^32.**
  - The cores export the `uint32_t` counter as an i32, so the host's `tacts` runs smoothly through
    2^32 (-1, 0, 1) but jumps from +2^31 - 1 to -2^31.
  - For the Z88 that is about 11 minutes, for a Spectrum or a Next at 3.5 MHz about 10, and for a
    Next at 28 MHz about 80 seconds. The Next's `tacts` counts CPU T-states, and the queued points
    (`tactsInFrame / 8` per frame) are T-states too, so the two are in one domain.
  - The Z88 fix already handled both edges. Its changelog line said 22 minutes and now says 11.
- **Tests,** each confirmed to fail on the old host at the signed turn:
  - `test/wasm/zxSpectrum/wasm-keystroke-wrap.test.ts`: all three cores, both edges, plus chaining
    after the turn. These are host level, because the core cannot run across 2^32 (see below).
  - `test/zxnext-hw/keyboard/keystroke-queue.test.ts`: real frames across both edges, observed by
    the Z80 logger.
  - A signed-turn case in `test/wasm/z88/wasm-z88-machine.test.ts`.
  - `laterTact` and signed-input cases in `test/emu/emulated-keystroke-tacts.test.ts`.
  - The 2^32 cases pass on the old code too, as the signed export predicts. They are kept for the
    helpers.
- **C64:** not affected. `M6510VaCpu` counts `this.tacts++` in a JS number.
- **Found: the ZX Spectrum 48 core froze at the 2^32 wrap.** Fixed, see "Follow-up: Spectrum
  cores freeze at the tact wrap".

## Follow-up: Spectrum cores freeze at the tact wrap

**Done 2026-09-25.**
- **Symptom:** run naturally with a NOP ROM, the 48 stopped at frame 61,455 (about 20.5 minutes).
  `sp48Tacts` stuck at 4,294,967,041, the frame counter stopped, and the PC did not move.
- **Cause:** the frame loop (`frameEndTact = NextFrameStartTact + TactsInCurrentFrame; while (Tacts
  < frameEndTact)`) wraps `frameEndTact` while `Tacts` does not. The frame position, the beeper's
  `double` sample schedule and window, and the PSG clock compare absolute points too.
- **Approach: rebase with an epoch,** not wrap-safe comparisons, so that the beeper's window
  integration and the PSG, shared through macros by three cores, need no rewrite.
  - `<core>ShiftTactOrigin(amount)` moves every absolute tact point back:
    - the counter and the Z80's `cpu.tacts`;
    - the frame and border starts;
    - the beeper's next-sample point, floor, last level change, window start and pending transitions;
    - the ear-bit change points;
    - the three tape points;
    - on the 128 and +3E, the PSG's next clock and last accumulation.
  - Found by listing every tact-typed static *and* every assignment from the counter. The +3E disk
    controller runs per frame and has none.
  - Once a frame starts past 2^30, the completion rebases by that start and adds it to
    `<core>TactEpoch`.
  - The seven absolute exports add the epoch (`GetTacts`, `GetCpuTacts`, `GetNextFrameStartTact`,
    the three `TapeGet...Tact`), and `SetTacts` subtracts it. So the host sees the same continuous
    counter as before, and the queue fix above still applies.
  - Differences between points stay correct through a shift in `uint32` arithmetic. Order
    comparisons only involve recent points, now far below 2^31.
- **Also changed:** `ExecuteFrame`'s loop now also stops when the frame completes. It had cached
  `frameEndTact`, and after a mid-loop rebase it ran about 15,000 extra frames. The instruction that
  reaches `frameEndTact` is the one that completes the frame, so nothing else changes.
- **Test hooks** (in the build allow-lists, not the loaders'): `<core>TestAdvanceTacts` and
  `<core>TestGetTactEpoch`.
- **Verified:**
  - `test/wasm/zxSpectrum/wasm-tact-rebase.test.ts`: all three cores through five rebases, with the
    host counter crossing 2^31 and 2^32. Every frame completes, advances the host counter by one
    frame, runs the CPU and yields a full frame of beeper audio with the tone.
  - A natural run of the 48 without hooks: 61,476 frames, none irregular, one host wrap, four
    rebases. The old core froze at 61,455.
  - All Spectrum, emulator, audio, command, control, debug, memory, WASM and main suites pass.

## Follow-up: the surround in Z88 recordings

**Done 2026-09-25**, reported by the author after Step 3.
- **Symptom:** played on a Mac, a Z88 recording had rounded corners.
- **Checked the file:** `recording_20260925_152243.mp4` is 640×64 with square corners; pixel (0,0) is
  plain LCD green. The rounding is the player's window. As on the emulator display, it clipped an
  LCD that runs to the edge of the picture.
- **Fix:** `RecordingManager.onMachineRunning` takes the machine's `getScreenSurroundColor` (only
  when the machine has one). The recording is then started `2 × RECORDING_SURROUND` (4) pixels
  wider and taller, and each frame is copied into a reused buffer filled with the colour read for
  that frame. A Z88 at 640×64 records 648×72, and the surround turns grey with the LCD.
  - Machines without a surround (the Spectrum family, per the author) record exactly as before.
  - A side effect: a Z88 frame now crosses IPC as a compact buffer rather than a view into the
    core's memory.
- **Tests:** in `test/recording/RecordingManager.test.ts`, "the surround of a picture with no border
  of its own". Size, colour, picture and colour changes are confirmed to fail on the old recorder.
  The Spectrum case passes on both.

