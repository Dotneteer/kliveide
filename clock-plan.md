# Clock Multiplier Migration Plan

This plan migrates the ZX Spectrum clock multiplier behavior from the original
TypeScript emulator into the current WebAssembly-backed implementation in small,
testable steps.

## Goals

- Support the original multiplier values: `1, 2, 4, 6, 8, 10, 12, 16, 20, 24`.
- Persist the selected multiplier in Klive settings and restore it on startup.
- Keep the video frame cadence unchanged while executing more CPU tacts per
  displayed frame.
- Apply multiplier changes at a frame boundary, matching the original
  `MachineFrameRunner` behavior.
- Preserve the static-memory C/Wasm design.
- Keep display, audio, tape, keyboard, and contention timing coherent after the
  multiplier changes.

## Original Behavior To Preserve

The original project wires clock multiplier through these areas:

- `src/main/app-menu.ts`
  - Builds the `Machine | Clock Multiplier` submenu.
  - Uses checkbox items for `Normal`, `2x`, `4x`, `6x`, `8x`, `10x`, `12x`,
    `16x`, `20x`, and `24x`.
  - Dispatches `setClockMultiplierAction(v)` and saves settings.

- `src/common/state/AppState.ts`
  - Stores the selected value in `emulatorState.clockMultiplier`.

- `src/common/state/emulator-state-reducer.ts`
  - Handles `SET_CLOCK_MULTIPLIER`.

- `src/main/settings.ts` and `src/main/settings-utils.ts`
  - Persist and restore the setting.

- `src/emu/machines/MachineController.ts`
  - Copies the selected state value to `machine.targetClockMultiplier`.
  - Keeps the UI frame delay based on the physical frame duration, not on the
    multiplier.

- `src/emu/machines/MachineFrameRunner.ts`
  - Applies `targetClockMultiplier` only at the beginning of a new frame.
  - Sets `tactsInCurrentFrame = tactsInFrame * clockMultiplier`.

- `src/emu/abstractions/Z80Cpu.ts`
  - Uses `currentFrameTact = floor(frameTacts / clockMultiplier)` so ULA-facing
    timing remains in the normal video-frame tact domain.

- `src/emu/machines/AudioDeviceBase.ts`
  - Advances the next audio sample tact by
    `audioSampleLength * machine.clockMultiplier`.

## Step 1 - Shared State And Settings

Add `clockMultiplier` to the current shared emulator state.

- Add `clockMultiplier?: number` to `EmulatorState`.
- Set the default value to `1`.
- Add `setClockMultiplierAction(numValue: number)`.
- Add the `SET_CLOCK_MULTIPLIER` reducer case.
- Persist the value in the current settings file.
- Restore it during startup and forward it through the existing shared-state
  flow.

Tests:

- Reducer test: `SET_CLOCK_MULTIPLIER` updates only the multiplier.
- Settings smoke test: saved multiplier is restored into shared state.

## Step 2 - Machine Menu Wiring

Replace the current placeholder `Clock Multiplier` menu with the real original
behavior.

- Use the original value list: `1, 2, 4, 6, 8, 10, 12, 16, 20, 24`.
- Label `1` as `Normal`; label others as `${value}x`.
- Check the currently selected value from
  `mainStore.getState().emulatorState.clockMultiplier ?? 1`.
- Dispatch `setClockMultiplierAction(value)` from the menu item click handler.
- Save Klive settings after a change.
- Keep menu availability aligned with the current machine type. For the first
  pass, enable it for the migrated ZX Spectrum models; later, honor the original
  `MF_ALLOW_CLOCK_MULTIPLIER` feature flag when more model metadata is moved.

Manual check:

- The selected menu item is checked.
- Changing the multiplier updates settings.
- Restarting the app restores the selected item.

## Step 3 - Renderer And Controller Propagation

Make the renderer-side machine controller aware of the target multiplier without
causing extra frame-status churn.

- Read `clockMultiplier` from shared state in the emulator renderer.
- Keep the latest value in a ref or controller field.
- Pass the value to the Wasm machine as a target multiplier before frame
  execution.
- Include the active multiplier in frame info/status data.
- Keep frame pacing based on the physical frame duration:
  `tactsInFrame / baseClockFrequency`.

Important detail:

The UI wait between frames must not be multiplied. At `2x`, the emulator should
execute twice as many CPU tacts inside the same displayed frame duration.

Tests:

- Frame info reports the active multiplier.
- Status updates remain throttled as they are today.

## Step 4 - Wasm ABI

Expose the minimum clock multiplier API from the C core.

Add C exports:

- `sp48SetTargetClockMultiplier(uint32_t value)`
- `sp48GetTargetClockMultiplier()`
- `sp48GetClockMultiplier()`
- `sp48GetTactsInCurrentFrame()`

Add TypeScript adapter methods in the Wasm machine wrapper.

Validation:

- Clamp invalid values to `1`, or to the closest supported value.
- Prefer accepting only the original value list.

Tests:

- Set/get target multiplier.
- Invalid values do not corrupt machine state.
- The active multiplier changes only after a frame boundary once the frame
  runner step is implemented.

## Step 5 - C Frame Runner Mechanics

Move the original frame-runner multiplier logic into the static C core.

Add static C state:

- `sp48ClockMultiplier = 1`
- `sp48TargetClockMultiplier = 1`
- `sp48TactsInCurrentFrame = sp48TactsInFrame`

At the beginning of each new frame:

- If the target differs from the active multiplier, copy target to active.
- Set `sp48TactsInCurrentFrame = sp48TactsInFrame * sp48ClockMultiplier`.
- Notify/reset frame devices with a `clockMultiplierChanged` flag if needed.

Frame completion:

- End the frame at
  `sp48CurrentFrameStartTact + sp48TactsInCurrentFrame`.
- Advance the frame start by `sp48TactsInCurrentFrame`.
- Preserve any CPU tact overshoot behavior.

Tests:

- At `1x`, frame count and tact behavior stays unchanged.
- At `2x`, one UI frame executes roughly twice the CPU work.
- Changing from `1x` to `2x` while running takes effect at the next frame.

## Step 6 - ULA Tact Mapping And Contention

Keep ULA-facing time in the base video-frame tact domain.

The original TypeScript CPU exposes:

```ts
currentFrameTact = Math.floor(frameTacts / clockMultiplier);
```

The C implementation should mirror that idea.

- Replace direct `sp48Tacts % sp48TactsInFrame` frame-tact calculations with a
  base-frame tact helper.
- Calculate the ULA tact from elapsed CPU tacts in the current frame:
  `baseFrameTact = floor(elapsedCpuTacts / sp48ClockMultiplier)`.
- Clamp the value to the valid range `0..sp48TactsInFrame - 1`.
- Use this base-frame tact for:
  - ULA rendering catch-up.
  - Border event placement.
  - Floating bus lookup.
  - Memory contention lookup.
  - Any port timing that depends on the current video-frame tact.

Tests:

- Border rendering remains visually stable at `1x` and `2x`.
- No out-of-bounds contention or floating-bus table reads occur.
- NTSC/PAL frame geometry remains correct.

## Step 7 - Audio Scheduler

Move the original audio sample scheduling rule into the C beeper.

The original code advances audio samples with:

```ts
audioNextSampleTact += audioSampleLength * machine.clockMultiplier;
```

Implement the same rule in the C beeper:

- Keep the audio sample count per displayed video frame stable.
- Multiply the audio tact step by the active clock multiplier.
- Reset or realign audio state when the multiplier changes at a frame boundary,
  only if the original behavior requires it.

Tests:

- At `1x`, current clean audio remains unchanged.
- At `2x`, generated sample count per UI frame is still stable.
- `BEEP 10,1` has no missing-sample spikes.
- Tape pilot audio remains synchronized with border rendering.

## Step 8 - Tape And Time-Based Devices

Review all tape timing calculations after the CPU tact multiplier is introduced.

Areas to check:

- Normal tape playback pulse timing.
- ROM load mode detection.
- Fast load mode.
- Tape status block position.
- EAR bit changes.

Implementation rule:

- CPU execution may run faster, but tape pulses represent physical time.
- Any tape comparison that currently uses raw CPU tacts must be checked against
  the original behavior and converted to the same effective timing domain.

Likely approach:

- Keep tape pulse lengths in base-machine tacts.
- Compare tape pulse timing against base-frame/physical elapsed tacts, not raw
  multiplied CPU tacts, unless the original code intentionally does otherwise.

Tests:

- Normal load works at `1x`.
- Normal load works at `2x`.
- Fast load still works and is not slowed by audio/tape playback timing.
- The tape status icon block count remains correct.

## Step 9 - Status Bar Polish

Update the emulator status bar to reflect the active multiplier.

- Display effective CPU frequency as:
  `baseClockFrequency * clockMultiplier`.
- Keep the machine model name unchanged.
- Do not add verbose text unless the original UI displayed it.

Manual check:

- At `1x`, ZX Spectrum 48K shows `3.500 MHz`.
- At `2x`, it shows `7.000 MHz`.
- Switching models and multipliers updates the status bar consistently.

## Step 10 - Regression Test Set

Run focused tests as each slice lands.

Recommended checks:

- `npm run build:wasm`
- `npm run typecheck`
- Reducer/action tests for clock multiplier.
- Wasm ABI tests.
- SP48 frame-runner tests at `1x` and `2x`.
- Audio renderer/beeper tests at `1x` and `2x`.
- Tape normal-load smoke test at `1x` and `2x`.
- Existing machine type selection tests, because model changes and multiplier
  state both affect machine setup.

## Step 11 - Rollout Order

Use this order to keep each step small and reversible:

1. Add state, settings, and menu wiring, with the C core still running at `1x`.
2. Add Wasm ABI set/get methods.
3. Add C frame-runner multiplier mechanics.
4. Fix ULA/base-frame tact mapping.
5. Fix audio scheduling.
6. Verify tape timing and fast load.
7. Polish the status bar and menu checked states.
8. Run the full focused regression set.

This order makes the UI visible early while keeping the risky timing changes
isolated until the state and ABI path are already proven.
