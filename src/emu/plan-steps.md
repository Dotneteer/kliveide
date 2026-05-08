# ZX Spectrum Next Joystick & Mouse — Incremental Implementation Plan

This document refines `plan.md` into small, sequentially-testable steps. Each step
follows the same strict flow to minimise regression risk:

1. **Implement** the change (code only, smallest possible diff).
2. **Lint** the changed files (`npm run lint -- <changed paths>` or repo-wide `npm run lint`).
3. **Write/extend unit tests** for the change (vitest, mirroring existing patterns in `test/zxnext/`).
4. **Run all tests** (`npm test`) — fix failures before moving on.
5. **Commit** the step with a descriptive message; do not bundle multiple steps.

## Decisions taken on open questions (low-risk path)

| # | Question | Chosen path |
|---|---|---|
| 1 | Gamepad rumble | **Defer** to v2. |
| 2 | Touch / on-screen overlay | **Skip** (Electron desktop only). |
| 3 | Autosave bindings | **Global** (`appSettings`), not per-project. |
| 4 | MD 6-button cycling | **Stub**: accept NR `$0B` writes but always present 3-button view; UI hides the MD6 entry until implemented. |
| 5 | NR `$83` `$DF` aliasing | **Implement gating** explicitly (Step 1) with tests. |
| 6 | Soft vs hard mouse reset | **Keep current behaviour** (clear on both) — predictable, no caller change. |
| 7 | Multiple pads of same type | **Single source per slot**; OR-merge only across joy1/joy2 connectors. |
| 8 | Capture-indicator visuals | **Plain text overlay** in `EmulatorOverlay.tsx`. |
| 9 | Per-game profiles | **Skip** (global only). |
| 10 | Fresh-install default | **Kempston 1** (matches NR `$05=$41`). |
| 11 | UART-on-joy (NR `$0B`) | **Stub**: store the bits, do not plumb to UartDevice yet. |

The MD6 cycling state machine, UART plumbing, and soft/hard reset split are
explicitly excluded from this plan and tracked as future work.

---

## Step 1 — NR `$83` peripheral gate getters

**Goal:** Expose `isMouseEnabled()` and `isPortDfKempstonAlias()` from
`NextRegDevice` so port handlers can gate behaviour without re-decoding NR `$83`.

**Files:**
- `src/emu/machines/zxNext/NextRegDevice.ts` — add public getters that read the
  already-stored NR `$83` bits.

**Tests:** extend `test/zxnext/NextRegDevice.test.ts`:
- After `writeNextReg(0x83, 0x00)` → `isMouseEnabled() === true`,
  `isPortDfKempstonAlias() === false`.
- After `writeNextReg(0x83, 0x20)` (bit 5 set) → both flip.
- Hard reset clears NR `$83` → mouse enabled, alias off.

---

## Step 2 — Gate Kempston mouse ports on NR `$83`

**Goal:** When mouse is disabled, `$FBDF`/`$FFDF`/`$FADF` return `0xFF`.

**Files:**
- `src/emu/machines/zxNext/io-ports/KempstonHandler.ts` — wrap the three readers
  to consult `nextRegDevice.isMouseEnabled()`.

**Tests:** extend `test/zxnext/KempstonMouse.test.ts`:
- Set NR `$83` bit 5 = 1; `readPort(0xFBDF)` returns `0xFF`; same for `$FFDF`,
  `$FADF`.
- After `addDelta(10,10)` while disabled, then re-enable: position is preserved
  (state persists across the toggle).

---

## Step 3 — Route port `$DF` to mouse or joy1 alias

**Goal:** Port `$DF` returns mouse buttons when mouse enabled, otherwise reads
joy1 (`$1F` value).

**Files:**
- `src/emu/machines/zxNext/io-ports/KempstonHandler.ts` (or wherever `$DF` is
  currently routed — verify against `NextIoPortManager.ts:441-515`).

**Tests:** new `test/zxnext/NextPeripheralGate.test.ts`:
- Default (mouse enabled): `$DF` returns mouse buttons.
- NR `$83` bit 5 = 1: set `joystickDevice.leftState = 0x09` and read `$DF` →
  `0x09`.
- Toggle the bit at runtime; verify both behaviours flip without reset.

---

## Step 4 — Custom-command channel for input

**Goal:** Add command cases consumed by the renderer hooks. No host plumbing
yet — purely the back-channel.

**Files:**
- `src/emu/machines/zxNext/ZxNextMachine.ts` — extend `executeCustomCommand`
  with: `setJoystickState`, `setMouseDelta`, `setMouseButtons`, `setMouseWheel`,
  `attachJoystickSource` (writes through to NR `$05`).

**Tests:** new `test/zxnext/ZxNextCustomCommands.test.ts`:
- `executeCustomCommand("setJoystickState", { left: 0x10 })` → port `$1F`
  reads `0x10`.
- `executeCustomCommand("setMouseDelta", { dx: 5, dy: -3 })` → `mouseDevice.xPos`
  / `yPos` advance per DPI.
- `executeCustomCommand("attachJoystickSource", { slot: 1, mode: "kempston2" })`
  → NR `$05` reflects new joy1 mode bits.

---

## Step 5 — Redux state for input bindings

**Goal:** Add `nextJoystickBindings` and `nextMouseSettings` to `AppState` plus
redux action creators. Persist via existing `appSettings` infrastructure.

**Files:**
- `src/common/state/nextInputBindings.ts` — types + defaults (Kempston1 +
  arrows + RControl).
- `src/common/state/AppState.ts` — new fields.
- `src/common/state/actions.ts` — `setNextJoystickBindingsAction`,
  `setNextMouseSettingsAction`.
- `src/main/settings-utils.ts` — new SETTING keys.

**Tests:** new `test/state/nextInputBindings.test.ts`:
- Default state matches Kempston1 + recommended keys.
- Action dispatch updates state.
- Round-trip through `appSettings` save/load.

---

## Step 6 — `useEmulatorJoystick` keyboard mode (Kempston/MD)

**Goal:** Map host keys to the 8-bit Kempston/MD byte and call
`setJoystickState` via the custom-command channel.

**Files:**
- `src/renderer/appEmu/EmulatorArea/useEmulatorJoystick.ts` — keydown/keyup
  handlers, build left/right state bytes, dispatch to machine.
- `src/renderer/appEmu/EmulatorArea/EmulatorPanel.tsx` — mount the hook.

**Tests:** new `test/renderer/useEmulatorJoystick.test.ts` (jsdom):
- Press ArrowRight + RControl → `setJoystickState` invoked with bit0|bit4.
- Release one key → next dispatch reflects the cleared bit.
- Mode set to Sinclair2 → keys are *not* dispatched as Kempston bits in this
  step (handled in Step 7).

---

## Step 7 — Keyboard-matrix dispatch for Sinclair / Cursor modes

**Goal:** When joy1/joy2 mode is Sinclair-1, Sinclair-2, or Cursor, the same
host keys press the appropriate ULA matrix keys instead of Kempston bits.

**Files:**
- Extend `useEmulatorJoystick` to read the active joystick modes from the
  machine and translate to `SpectrumKeyCode` calls (mirroring
  `useEmulatorKeyboard`).

**Tests:**
- Set joy1 mode = Sinclair2; press ArrowRight → keyboard matrix key `N2`
  becomes pressed in `keyboardDevice`.
- Set joy1 mode = Cursor; press ArrowUp → `N7` pressed.
- Releasing the host key clears the matrix key.

---

## Step 8 — Gamepad API polling

**Goal:** Poll `navigator.getGamepads()` each animation frame and OR the
resulting state into the Kempston/MD byte (no Sinclair/Cursor handling for
gamepads in this step — defer if not trivial).

**Files:**
- Extend `useEmulatorJoystick.ts` with `requestAnimationFrame` polling and
  `gamepadconnected`/`disconnected` listeners.

**Tests:** with a fake `navigator.getGamepads()`:
- Pad with `axes=[1,0]`, `buttons[0].pressed=true` → emitted state
  `RIGHT|FIRE1`.
- Deadzone 0.25 → `axes=[0.2,0]` produces no direction bits.
- D-pad button 12..15 OR-merged with axis-derived directions.

---

## Step 9 — Mouse pointer-lock + relative motion

**Goal:** Click canvas → `requestPointerLock`; `mousemove` deltas pumped via
`setMouseDelta` (Y inverted). Esc cancels.

**Files:**
- `src/renderer/appEmu/EmulatorArea/useEmulatorMouse.ts` — new hook.
- `EmulatorPanel.tsx` — mount with canvas ref.

**Tests:** jsdom integration test:
- Simulated click → `requestPointerLock` called on canvas.
- After `pointerlockchange`, simulated `mousemove` with `movementX=3` →
  custom-command `setMouseDelta` with `dx=3, dy=0` (sign-flipped on Y).
- Sensitivity multiplier scales delta before dispatch.

---

## Step 10 — Mouse buttons & wheel

**Goal:** Dispatch button state and wheel deltas; suppress browser context menu
while captured.

**Files:**
- Extend `useEmulatorMouse.ts`.

**Tests:**
- `mousedown` left → `setMouseButtons` `{ left:true }`.
- `wheel` event with `deltaY=-100` → `setMouseWheel` with `dz=1`.
- `contextmenu` event is `preventDefault`-ed while captured.

---

## Step 11 — Capture overlay

**Goal:** Plain "Mouse captured — Esc to release" message via existing
`EmulatorOverlay.tsx`. Triggered by redux flag mirroring pointer-lock state.

**Files:**
- `EmulatorOverlay.tsx` (extend), `useEmulatorMouse.ts` (set flag on
  `pointerlockchange`).

**Tests:**
- Fire `pointerlockchange` with locked element = canvas → overlay state true.
- Fire again with no locked element → false.

---

## Step 12 — Joystick bindings dialog

**Goal:** Modal with two columns (joy1/joy2), source dropdown, key-capture
rows, "Reset to defaults".

**Files:**
- `src/renderer/appEmu/dialogs/JoystickBindingsDialog.tsx`.

**Tests:**
- Renders with current bindings from redux.
- Capture row records the next keydown and updates redux on save.
- "Reset to defaults" restores Kempston1 + arrows + RControl.

---

## Step 13 — Menu renderers

**Goal:** Add `Attach Joystick ▶` and `Attach Mouse ▶` submenus to the ZX Next
machine menu. Radios for mode/source; "Configure bindings…" opens dialog;
"Capture Mouse Now" toggles redux flag (Ctrl/Cmd+M accelerator).

**Files:**
- `src/main/machine-menus/zx-next-input-menus.ts` (new).
- `src/main/machine-menus/machine-menu-registry.ts` — register both renderers
  in `MI_ZXNEXT.machineItems`.
- `src/main/app-menu.ts` — add Ctrl/Cmd+M accelerator only.

**Tests:**
- Snapshot-style test of the renderer output for joy1 in Kempston1 vs Sinclair2.
- Click "Capture Mouse Now" → redux capture flag toggles.

---

## Step 14 — End-to-end smoke (manual + scripted)

**Goal:** Verify the full chain works on the running emulator with a simple
ROM/test program that polls `$1F` and `$FBDF`.

**Manual checklist:**
- Default install → arrows + RControl produce movement in a Kempston-aware
  game.
- Switch to Sinclair2 from menu → game prompting for "1=L 2=R" responds.
- Toggle NR `$83` from a test program → mouse goes silent / `$DF` becomes joy1.
- Connect a USB pad mid-session → menu shows it; assigning to joy1 makes it
  drive port `$1F`.
- Click canvas → pointer locks; mouse demo program tracks motion; Esc
  releases.

**Scripted regression:** rerun the full vitest suite (`npm test`) and confirm
no test from earlier steps regresses.

---

## Out of scope (tracked for later)

- MD 6-button Select-pulse multiplexing (Step plan: research TBBlue MD pad
  spec, then add `mdSixPhase` state machine + NR `$0B` driver hookup).
- UART-on-joy-port plumbing through `UartDevice`.
- Gamepad rumble.
- Soft/hard reset split for `MouseDevice`.
- Per-project bindings profiles.
- Touch / on-screen joystick.
