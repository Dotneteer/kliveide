# ZX Spectrum Next Joystick & Mouse Emulation — Implementation Plan

## 0. Current state of the code (what's already wired)

The emulation core is **largely already in place** for both devices. The work remaining is host-input plumbing, NextReg edge cases, NR `$83` mouse-disable enforcement, NR `$0B` IO-mode, and the UX shell.

| Concern | File | Notes |
|---|---|---|
| Joystick FPGA-accurate decode | `src/emu/machines/zxNext/JoystickDevice.ts:1-139` | `JoystickMode` enum, `leftState`/`rightState`, `readPort1f()`/`readPort37()` reproduce `joyL_1f \| joyR_1f` OR-merge. Only Kempston1/Kempston2/MD1/MD2 contribute to Kempston ports; Sinclair/Cursor/UserDefined return 0 (correct: they map to keyboard matrix instead). |
| Mouse FPGA-accurate decode | `src/emu/machines/zxNext/MouseDevice.ts:1-134` | 8-bit wrapping X/Y, 4-bit wheel, DPI shift logic mirrors `ps2_mouse.v`, `swapButtons`, port `$FBDF`/`$FFDF`/`$FADF` readers. |
| Port routing | `src/emu/machines/zxNext/io-ports/NextIoPortManager.ts:441-515` and `KempstonHandler.ts` | Ports `$1F`, `$37`, `$DF` (joy1 alias), `$FBDF`, `$FFDF`, `$FADF` already routed. Port `$DF` mouse/joy aliasing depends on NR `$83` bit 5. |
| NextReg `$05` (Peripheral 1) | `NextRegDevice.ts:332-382` | Encodes joy mode bits `[7:6,3]` for joy1, `[5:4,1]` for joy2. Already writes through to `joystickDevice`. |
| NextReg `$0A` (Mouse control) | `NextRegDevice.ts:610-665` | DPI bits 1:0, swap bit 3 already wired. |
| NextReg `$0B` (Joy IO mode) | `NextRegDevice.ts:668-702` | `ioModeEnabled`/`ioMode`/`ioModeParam` fields on `JoystickDevice` are present but not yet used by anything (UART-on-joy port, MD 6-button toggle, etc. are stubs). |
| NextReg `$83` peripheral disable | `NextRegDevice.ts:1860-1900` | Stores bits but **does not yet gate** `$DF`/`$FBDF`/`$FFDF`/`$FADF` reads. |
| Machine wiring | `src/emu/machines/zxNext/ZxNextMachine.ts:32-37, 110-112, 213-214, 282-285` | Devices constructed and reset alongside the rest. No frame-loop tick is needed — joystick/mouse are passive. |
| Existing tests | `test/zxnext/KempstonJoystick.test.ts`, `KempstonMouse.test.ts`, `NextRegDevice.test.ts`, `NextIoPortManager.test.ts`, `TestNextMachine.ts` | Use `createTestNextMachine()` factory. Hard reset sets NR `$05 = $41` → joy1=Kempston1, joy2=Sinclair2; NR `$0A = $01` → DPI 1, no swap. |
| Renderer keyboard pipeline | `src/renderer/appEmu/EmulatorArea/useEmulatorKeyboard.ts` and `EmulatorPanel.tsx` | `useEmulatorKeyboard` reads `state.keyMappings`, normalises with `defaultKeyMappings`, calls `keyStatusSet(code, down)`. This is the pattern joystick host-mapping should follow. |
| Menu layer | `src/main/app-menu.ts:159, 683-812, 925`, `src/main/machine-menus/zx-next-menus.ts`, `src/main/machine-menus/machine-menu-registry.ts:75-83` | Per-machine items injected via `machineMenus.machineItems(...)`. Add a `joystickMenuRenderer` and `mouseMenuRenderer` returning `MachineMenuItem[]`, then push them into the `MI_ZXNEXT` entry. |
| Custom-command bridge | `ZxNextMachine.ts:594-...` `executeCustomCommand` | Already used by hotkey menu items. Use the same channel for `attachJoystick`, `setMouseCapture`, etc. |

What is **not** yet present and must be added:

1. Sinclair-1, Sinclair-2, Cursor/Protek emulation paths — these are *keyboard-matrix* joysticks. The current `JoystickDevice` correctly returns 0 on Kempston ports for them, but no code presses the corresponding keyboard matrix keys when the host fires a "joystick" input.
2. MD 6-button protocol (timed Select pulses cycling between B/C/A/Start and X/Y/Z/Mode). The `JoystickDevice` exposes the byte but does not implement the cycling state machine driven by the Z80 toggling the `Select` line via NR `$0B` IO-mode.
3. Real host input → emulated state. No `useEmulatorJoystick` / `useEmulatorMouse` hooks exist; the canvas does not request pointer-lock.
4. NR `$83` gating in port handlers.
5. Settings persistence for bindings.
6. Menu UI.

---

## 1. Hardware emulation table

Bit ordering for all Kempston-style ports (active **HIGH**): `bit0=Right, bit1=Left, bit2=Down, bit3=Up, bit4=Fire1/B, bit5=Fire2/C, bit6=A (MD only), bit7=Start (MD only)`.

| Device | NR `$05` selector | Port(s) | FPGA exposure | Notable Next-era games |
|---|---|---|---|---|
| **Sinclair 2** (12345) | joy1 mode `000` | ULA `$FE` (keyboard matrix half-row 1=`1..5`) | Maps to keys `1`,`2`,`3`,`4`,`5` (L,R,D,U,Fire) — emulated by setting keyboard-matrix bits, **not** Kempston ports | *Manic Miner Next*, *Lonely Mountains*, anything with "Sinclair joystick" prompt |
| **Sinclair 1** (67890) | joy1 mode `110` | ULA `$FE` (half-row `6..0`) | Keys `6`,`7`,`8`,`9`,`0` | *Eye of the Beholder Next*, classic 128k titles |
| **Cursor/Protek/AGF** (56780) | joy1 mode `100` | ULA `$FE` | Keys `5`,`6`,`7`,`8`,`0` (L,D,U,R,Fire) | Many 1985-era games; *Highway Encounter Next* |
| **Kempston 1** | joy1 mode `001` | `$1F` (also `$DF` alias if NR `$83` bit 5 = 0) | `JoystickDevice.readPort1f`, low 6 bits | *Baggers in Space*, *NextDaw demos*, almost every modern Next-only release defaults here |
| **Kempston 2** | joy2 mode `010` | `$37` | `readPort37`, low 6 bits | Two-player Next titles (*Sk8 Lab*, *PuzzleQuest*) |
| **MD1 — 3-button** | joy1 mode `011` | `$1F` | All 8 bits; bits 6/7 = A/Start static | *Goody Next*, MD-pad-aware ports |
| **MD2 — 3-button** | joy2 mode `011` | `$37` | All 8 bits | Twin-pad MD games |
| **MD1 — 6-button** | joy1 `011` + NR `$0B` IO-mode = MD-6 | `$1F` (multiplexed) | Pad cycles every Select pulse: phase A returns `B/C/Up/Dn/Lf/Rt/A/Start`, phase B returns `X/Y/Z/Mode/...`. Driven by host Z80 writes toggling `Select` via NR `$0B`. | *Nextor Quest*, *Castle Capers* |
| **MD2 — 6-button** | mirror to `$37` | `$37` | Same multiplex on right pad | Same |
| **User-defined** | joy mode `111` | none | Maps physical pad to user-assigned ULA keys (configured via NextZXOS NextOS `.cfg` or app-internal settings) | NextOS apps, **DOT** commands |
| **Kempston Mouse** | not selected via NR `$05`; enabled by default. Disabled by NR `$83` bit 5 = 1 | `$FBDF` (X), `$FFDF` (Y), `$FADF` (wheel+buttons). When mouse disabled, port `$DF` becomes a Kempston joy1 alias. | `MouseDevice.readPortFbdf/Ffdf/Fadf` | *Time Gentlemen Please Next*, GUI apps (NextZXOS), *Painter Next* |

Joystick *mode encoding* in NR `$05`: per `NextRegDevice.ts:335-336`, joy1 mode = `((v & $C0) >> 6) | ((v & $08) >> 1)` and joy2 mode = `((v & $30) >> 4) | ((v & $02) << 1)`.

---

## 2. Hot-plug semantics

| Action | Runtime-safe? | Reason |
|---|---|---|
| Switch joy1 between Kempston1 / Kempston2 / MD1 / MD2 / Sinclair / Cursor / UserDefined via NR `$05` | **Yes** | The FPGA reads NR `$05` combinationally on each port read. `JoystickDevice.readPort1f`/`37` already re-evaluates mode every read. No reset needed. |
| Switch joy2 likewise | **Yes** | Same. |
| Change MD-pad button count (3 vs 6) via NR `$0B` IO-mode flag | **Yes** | But the MD6 cycle counter must be *resettable* when toggled — drop the phase to 0 to avoid stuck phase. |
| Enable/disable mouse via NR `$83` bit 5 | **Yes** | Pure IO gate. Mouse state (xPos/yPos/wheel/buttons) **persists** across the toggle, matching real hardware which keeps the PS/2 controller running. The port handlers must consult NR `$83` bit 5 *and* the `$DF` alias becomes joy1 only when bit 5 is 1 (mouse off). |
| Hard reset (`reset()`) | Both devices clear state and Joystick reverts to NR `$05 = $41` (joy1=Kempston1, joy2=Sinclair2). Mouse `xPos/yPos/wheel/buttons` cleared; DPI/swap re-read from NR `$0A` (`MouseDevice.ts:43-46`). |
| Soft reset (NextReg `$02`) | Joystick mode bits in NR `$05` **persist**; mouse position/buttons **persist** on real hardware (a soft reset doesn't power-cycle the PS/2 mouse). The current `MouseDevice.reset()` clears them, which is fine for hard reset but should be skipped on soft reset — minor bug to address. |
| Plug a *physical* host gamepad mid-session | **Yes** | Browser `gamepadconnected` event fires while running — surface as a UI toast and update the menu's "Detected pads". |
| Switch *which* host gamepad drives joy1 | **Yes** | Pure renderer-side mapping table change. No Z80 visibility. |
| Switch from "keyboard-emulated joystick" to "physical gamepad" | **Yes** | Same channel: both feed `joystickDevice.setLeftState/setRightState`. |
| Capture / release mouse pointer-lock | **Yes** | UI-only; the underlying Z80 can read `$FADF`/`$FBDF`/`$FFDF` regardless. When pointer is uncaptured we simply stop adding deltas. |

**Power-on-only**: nothing in this feature set genuinely requires a reset. The only "needs reset" scenarios are emulator-side bookkeeping (e.g. user resets all bindings to defaults via the menu — purely a UI choice).

---

## 3. Host-input mapping strategy

### 3.1 Joystick — keyboard-emulated default bindings

For each emulated mode, the *renderer* provides a default host-key → joystick-bit (or ULA-matrix-key) map. The user can override per-mode via the bindings dialog.

**Kempston1 / Kempston2 / MD1 / MD2 — bits packed into `leftState`/`rightState`:**

| Host key (joy1 default) | Joystick bit |
|---|---|
| `ArrowRight` | bit0 (Right) |
| `ArrowLeft` | bit1 (Left) |
| `ArrowDown` | bit2 (Down) |
| `ArrowUp` | bit3 (Up) |
| `RControl` / `Space` | bit4 (Fire1 / B) |
| `RShift` | bit5 (Fire2 / C) |
| `Backslash` | bit6 (A, MD only) |
| `Enter` (numpad) | bit7 (Start, MD only) |

For joy2 default we suggest WASD + `LShift`/`Tab`/`Q`/`E`. The merging of left+right connector state happens inside `JoystickDevice` (already), so the renderer just calls `setLeftState`/`setRightState`.

**Sinclair-1 / Sinclair-2 / Cursor — must press emulated ULA keys**, not Kempston bits. Implementation: when the host arrow/fire key fires under one of these modes, call `keyboardDevice.setKeyStatus(code, down)` for the appropriate `SpectrumKeyCode` (e.g. Sinclair-2: Left=`N1`, Right=`N2`, Down=`N3`, Up=`N4`, Fire=`N5`). Use the same dispatch pattern as `useEmulatorKeyboard`.

**User-defined**: the user assigns each of the 5 logical actions (L/R/U/D/Fire) to *any* `SpectrumKeyCode`, persisted alongside other bindings.

### 3.2 Joystick — Browser GamepadAPI

Add `useEmulatorGamepad` hook (mounted from `EmulatorPanel.tsx`):

- Listen for `gamepadconnected` / `gamepaddisconnected`.
- On each animation frame poll `navigator.getGamepads()`. Build a fresh 8-bit state with this mapping (standard mapping):
  - `axes[0]` < -0.5 → Left; > 0.5 → Right (deadzone = 0.25 default, configurable)
  - `axes[1]` < -0.5 → Up; > 0.5 → Down
  - `buttons[0]` (A/cross) → bit4; `buttons[1]` (B/circle) → bit5; `buttons[2]` (X/square) → bit6; `buttons[9]` (Start) → bit7.
  - D-pad (`buttons[12..15]`) OR'd with axis-derived directions.
- Call `joystickDevice.setLeftState(byte)` (or `setRightState` if user assigned the pad to joy2).
- Per-pad selector lets the user decide whether pad index → connector L or R.
- A "Test pad" debug overlay on the bindings screen shows live raw axis/button state.

Optional: rumble via `gamepad.vibrationActuator.playEffect("dual-rumble", ...)` — exposed only as a future feature; see open questions.

### 3.3 Mouse — host pointer mapping

Three host modes, user-selectable:

1. **Pointer-locked relative** (default & recommended). Click on canvas → `canvas.requestPointerLock()`. On `mousemove` consume `e.movementX`/`e.movementY`, call `mouseDevice.addDelta(dx, -dy)` (Y inverted because Kempston mouse Y *increments* upward, see `MouseDevice.ts:9`). Press `Esc` to exit. Show a small "Mouse captured — Esc to release" overlay (reuse `EmulatorOverlay.tsx`).
2. **Absolute (windowed)**. While unlocked but pointer-over-canvas, derive deltas from successive `clientX/Y` differences — gives "windowed mouse" behaviour useful for casual GUI use without pointer lock. Subject to the host moving the cursor outside the canvas.
3. **Disabled**. Useful while debugging UI.

**Sensitivity**: a renderer-side multiplier (default 1.0, user-adjustable 0.25–4.0) applied *before* `addDelta`. The hardware DPI shift (NR `$0A` bits 1:0, in `MouseDevice.ts:60-76`) is preserved; sensitivity is purely host scaling.

**Buttons**: `mousedown`/`mouseup` on the canvas → `mouseDevice.setButtons(left, right, middle)`. Suppress browser context menu when captured. Note `MouseDevice.readPortFadf` already handles the NR `$0A` bit 3 swap (`MouseDevice.ts:122-133`).

**Wheel**: `wheel` event → `mouseDevice.addWheelDelta(Math.sign(-e.deltaY))` (one tick per wheel notch — Kempston mouse wheel is a 4-bit accumulator, `MouseDevice.ts:87-89`).

**Kempston mouse semantics already encoded in stub** (`MouseDevice.ts:7-13`): X/Y are 8-bit *wrapping accumulators* (i.e. signed deltas, but stored as `mod 256`). Software polls and computes its own delta against the previous read. We must *not* reset position to 0 when the host pointer warps — the wrapping behaviour is the API. Y increases as the mouse moves up.

### 3.4 Per-joystick remapping UI

A modal "Configure ZX Spectrum Next Joystick" reachable from the menu and from a settings panel.

- Two columns: Joystick 1, Joystick 2.
- Each column: source dropdown (Off / Host keyboard / Host gamepad #N), then per-action key-capture rows.
- "Reset to defaults" button per column.
- Bindings persisted into `appSettings` under a new key `nextJoystickBindings`. Reuse `setSettingValue` from `src/main/settings-utils.ts`.
- A live indicator dot lights up when the corresponding emulated bit is set (debug aid).

---

## 4. Implementation details (file-level)

### 4.1 New files

- `src/renderer/appEmu/EmulatorArea/useEmulatorJoystick.ts`
  - Subscribes to `state.nextJoystickBindings`.
  - Listens for `keydown`/`keyup` *and* polls Gamepad API on each frame (driven by `requestAnimationFrame` or piggyback on screen-render hook).
  - Maintains two 8-bit state bytes; on each change calls into the machine via `getEmuApi().issueMachineCommand("custom", "setJoystickState", { left, right })` or, if running in-process, directly `machine.joystickDevice.setLeftState/setRightState`.
  - Also dispatches matrix-key presses for non-Kempston modes by reading `joystickDevice.joystick1Mode`/`joystick2Mode` and translating to `SpectrumKeyCode` calls.

- `src/renderer/appEmu/EmulatorArea/useEmulatorMouse.ts`
  - Wires pointer-lock, mousemove, mousedown/up, wheel, sensitivity scaling, and capture-toggle.
  - Receives a redux-stored "mouseCaptureRequested" flag toggled by the menu.
  - Calls `machine.mouseDevice.addDelta/addWheelDelta/setButtons`.

- `src/main/machine-menus/zx-next-input-menus.ts`
  - Exports `joystickMenuRenderer` and `mouseMenuRenderer`.

- `src/renderer/appEmu/dialogs/JoystickBindingsDialog.tsx`
  - Modal component with capture rows.

- `src/common/state/nextInputBindings.ts`
  - Types for bindings + redux action creators (`setNextJoystickBindingsAction`, `setNextMouseSettingsAction`).

### 4.2 Files to extend

- `src/emu/machines/zxNext/JoystickDevice.ts`
  - Add MD-6-button cycling state machine: `mdSixPhase: 0|1|2|3` plus `setSelectLine(level: boolean)` driven by NR `$0B` (or by a write to the joystick-side IO whatever real Next uses — research note: Next implements this through external pad firmware, but emulation can be driven directly from the `setLeftState/setRightState` payload that already includes 8 bits — extend to a 16-bit `setLeft6Btn(byte0, byte1)` API, then pick the active byte by phase).
  - Add `attachAsJoy1Source(source: "kempston1"|"kempston2"|"md1"|...)` only as a *default* convenience that writes through to NR `$05` — the canonical state still lives in NR `$05`.

- `src/emu/machines/zxNext/MouseDevice.ts`
  - Distinguish hard vs soft reset (add `hardReset()` separate from `reset()`); `ZxNextMachine` soft-reset should *not* clear position. Currently `reset()` is called on both paths.

- `src/emu/machines/zxNext/io-ports/KempstonHandler.ts`
  - Wrap `readKempstonMouseXPort/YPort/WheelPort` to return `0xFF` when `nextRegDevice.peripheralEnable.mouse === false` (NR `$83` bit 5 = 1).
  - Wrap `readKempstonJoy1AliasPort` to read mouse buttons/wheel only when mouse enabled, and joy1 (`$1F` aliased) when disabled. Inspect `NextRegDevice.ts:1860-1900` to expose a getter for this bit.

- `src/emu/machines/zxNext/NextRegDevice.ts`
  - Add a `peripheralEnable` accessor (or expose the gate flags as named getters: `port_df_kempston_alias`, `port_mouse_enabled`).
  - Wire NR `$0B` write to enable MD-6-button cycling on `JoystickDevice`.

- `src/emu/machines/zxNext/ZxNextMachine.ts`
  - In `executeCustomCommand` (around line 594) add cases:
    - `"setJoystickState"` (args: `{ left?: number; right?: number }`)
    - `"setMouseDelta"` (args: `{ dx, dy }`)
    - `"setMouseButtons"` (args: `{ left, right, middle }`)
    - `"setMouseWheel"` (args: `{ dz }`)
    - `"attachJoystickSource"` (args: `{ slot: 1|2; mode: JoystickMode }`) — writes through to NR `$05`.
  - In `hardReset()` path keep the existing `mouseDevice.reset()`; wire a `softReset()` helper that skips it.

- `src/main/machine-menus/machine-menu-registry.ts:75-83`
  - Add `joystickMenuRenderer` and `mouseMenuRenderer` to the `MI_ZXNEXT.machineItems` array.

- `src/renderer/appEmu/EmulatorArea/EmulatorPanel.tsx`
  - Mount `useEmulatorJoystick(machine)` and `useEmulatorMouse(machine, hostElement)`.
  - Forward `requestPointerLock` calls and overlay state.

- `src/common/state/AppState.ts`
  - Add `nextJoystickBindings`, `nextMouseSettings` fields.

### 4.3 Frame-loop integration

`JoystickDevice` and `MouseDevice` are passive — they don't tick per frame. The host-input hooks run on `requestAnimationFrame` (gamepad polling) and on DOM events (keyboard, mouse). They write into the device asynchronously from the renderer; the Z80 reads them via port reads on its own schedule. No locking required because writes are scalar and the renderer/emulator share the same JS event loop (single-threaded).

If the emulator runs in a worker, the writes go via `getEmuApi().issueMachineCommand("custom", ...)`, which is already used by hotkey menus. Keep updates frequency-bounded to ~60 Hz to avoid worker-message flooding; coalesce multiple gamepad-state changes per frame.

### 4.4 Reset / hard-reset handling

- `JoystickDevice.reset()` — already correct (`leftState=0`, `rightState=0`, modes default to Sinclair2). Hard reset writes NR `$05 = $41` which moves joy1 to Kempston1.
- `MouseDevice.reset()` — split into `hardReset()` (full clear) and `reset()` (soft reset = preserve xPos/yPos/wheelZ; clear buttons because real hardware might glitch the line). Adjust `ZxNextMachine.reset()` accordingly.
- Bindings persistence is *outside* the device; it lives in `appSettings` and is unaffected by emulator reset.

---

## 5. Testing approach

### 5.1 Unit tests (vitest, mirror existing patterns in `test/zxnext/`)

Use `createTestNextMachine()` from `test/zxnext/TestNextMachine.ts`. Tests already exist and pass for the *core* port reads — extend with:

**`KempstonJoystick.test.ts` additions** (`test/zxnext/`):
- NR `$0B` IO-mode write enables MD-6-button cycling; verify phase advance on Select pulse.
- Mid-frame mode switch: set `leftState` while in Kempston1, write NR `$05` to switch to Sinclair while between port reads, confirm port `$1F` returns 0x00 immediately on next read (no latency).
- Both connectors mapped to MD1: Start bit OR-merges correctly across pads.

**`KempstonMouse.test.ts` additions**:
- 8-bit wrap on negative delta: addDelta(-1,0) from xPos=0 → xPos=0xFF.
- Wheel 4-bit wrap: addWheelDelta(-1) from wheelZ=0 → wheelZ=0x0F.
- DPI scaling: at DPI=0 (`<<1`), addDelta(5,5) → +10 each axis.
- Button swap via NR `$0A` bit 3: press left, read `$FADF`, expect right-bit set instead.
- Soft-reset preserves position; hard-reset zeros it (after the proposed split).

**New `NextPeripheralGate.test.ts`**:
- NR `$83` bit 5 = 1 ⇒ port `$FBDF` returns floating bus (or `$FF`); port `$DF` returns joy1 alias.
- NR `$83` bit 5 = 0 ⇒ port `$DF` returns mouse buttons (current behaviour); `$FBDF/$FFDF/$FADF` active.
- Toggle bit at runtime, verify both behaviours flip without resetting accumulator.

**New `NextJoystickIoMode.test.ts`** (NR `$0B`):
- UART-on-left-joystick mode (`ioMode = 0b10`) routes UART RX/TX bits to `$1F` per FPGA spec.
- IO-mode disabled ⇒ NR `$0B` bits ignored.

### 5.2 Integration tests (renderer-level)

These can use jsdom + a fake `Gamepad` polyfill:

- **Pointer-lock acquire/release flow**: simulate click on canvas, expect `requestPointerLock` called; simulate `pointerlockchange` then `mousemove` events, assert `mouseDevice.xPos` advances.
- **Gamepad polling**: fake `navigator.getGamepads()` returning a pad with `axes=[1, 0]` and a pressed button-0; advance frame; assert `joystickDevice.leftState === (RIGHT|FIRE1)`.
- **Bindings persistence**: dispatch `setNextJoystickBindingsAction`, reload the renderer, confirm the dialog reflects the saved values.
- **Multiple-device-on-one-port edge case**: set joy1=Kempston1 and joy2=Kempston1, press Up on the joy1 source and Fire on the joy2 source — port `$1F` reads `Up | Fire` (already covered partially by `KempstonJoystick.test.ts:290-298`).

---

## 6. Menu / UI extension

### 6.1 Where in the menu

Following the `MI_ZXNEXT.machineItems` chain in `src/main/machine-menus/machine-menu-registry.ts:75-83`, append two renderers:

```
Machine
  Hotkeys ▶ (existing)
  Select SD Card Image... (existing)
  ─────────
  Attach Joystick ▶            ← new
    Joystick 1 ▶
      Off
      Kempston 1 (port $1F)
      Kempston 2 (port $37)
      MD 1 (3-button)
      MD 1 (6-button)
      Sinclair 1 (67890)
      Sinclair 2 (12345)
      Cursor / Protek (56780)
      User-defined…
      ─────
      Source ▶
        Host keyboard (default arrows)
        Host gamepad: <pad name>
        Host gamepad: <other pad>
      Configure bindings…
    Joystick 2 ▶  (same submenu)
  Attach Mouse ▶                ← new
    Mode ▶ (radio)
      Disabled
      Captured (pointer lock)  [default]
      Windowed (relative, no lock)
    Capture Mouse Now            (Ctrl+M shortcut)
    Sensitivity ▶ (radio: 0.25, 0.5, 1.0, 1.5, 2.0, 4.0)
    Reset accumulator
```

### 6.2 Implementation notes

- New file `src/main/machine-menus/zx-next-input-menus.ts` exporting `joystickMenuRenderer` and `mouseMenuRenderer`. Each is a `MachineMenuRenderer` returning `MachineMenuItem[]`. Pattern: copy `hotkeyMenuRenderer` from `zx-next-menus.ts`.
- "Configure bindings…" opens the `JoystickBindingsDialog` in the renderer via `getIdeApi()` or by dispatching a redux action to show the dialog (depending on existing dialog patterns — search for `.tsx` modal dialogs already invoked from menu).
- Each radio item dispatches a `setNextJoystickBindingsAction` and (for the live mode) issues `executeCustomCommand("attachJoystickSource", { slot, mode })`, which writes through to NR `$05`.
- "Capture Mouse Now" toggles a redux flag consumed by `useEmulatorMouse`; the hook calls `requestPointerLock()` next render.
- Add a global accelerator `Ctrl+M` (Cmd+M on macOS) for capture toggle. Coordinate with existing accelerators in `app-menu.ts`.

### 6.3 Files that change

| File | Change |
|---|---|
| `src/main/machine-menus/zx-next-input-menus.ts` | NEW — renderers |
| `src/main/machine-menus/machine-menu-registry.ts` | Add the two renderers to MI_ZXNEXT |
| `src/main/app-menu.ts` | Likely no change; `specificMachineMenus` is already spread in. Add accelerator handling if Ctrl+M is wanted. |
| `src/renderer/appEmu/dialogs/JoystickBindingsDialog.tsx` | NEW — bindings UI |
| `src/common/state/AppState.ts` | New state slices |
| `src/common/state/actions.ts` | New actions |
| `src/main/settings-utils.ts` | New SETTING constants for persistence keys |

---

## 7. Open questions / risks

1. **Gamepad rumble** — defer; not part of the FPGA spec, no Next game expects it. Add as a v2 wishlist item.
2. **Touch / on-screen joystick overlay** — Klive runs as Electron desktop, no touch UX expected. Skip unless explicitly requested.
3. **Autosave bindings** — assumed yes (mirroring how `appSettings` already persists scanline-effect, font-size, etc.). Confirm with user whether bindings live under per-project settings or global.
4. **MD 6-button cycling driver** — unclear if real Next emulates the Select-pulse multiplexing in the FPGA, or relies on userland (NextOS) firmware. Need to consult the **TBBlue MD pad spec**. May affect whether MD6 can be selected at all from within emulation, or whether we need to implement the timing logic.
5. **NR `$83` `$DF` aliasing semantics** — current code does not yet route `$DF` to mouse-or-joy depending on the bit. Confirm by running existing tests; if they currently pass, the gating already works; if not, this is the first thing to fix.
6. **Soft vs hard reset of mouse state** — proposed split. Confirm with user — some emulators clear mouse position on every reset for predictability.
7. **Multiple pads of the same type** — e.g. user has two USB pads, both mapped to joy1: should we OR them or pick the most-recent? Current proposal: per-slot single source assignment; OR-merging only happens at the FPGA (left-vs-right connector).
8. **Capture indicator visuals** — the proposed "Mouse captured — Esc to release" overlay needs a designer-approved style; placeholder in `EmulatorOverlay.tsx`.
9. **Per-game bindings profile** — out of scope unless requested. Could be layered on later by saving bindings inside `.kliveproj`.
10. **Cursor/Protek vs Sinclair2 default** — should the *fresh-install* default be Kempston1 (matches NR `$05=$41` hard-reset) or Cursor (matches the on-screen prompt of many older games)? Recommend Kempston1, since hardware default agrees.
11. **NR `$0B` IO-mode** — UART-on-joy-port: do we plumb UART through to actual host I/O (already partly handled by `UartDevice`), or stub? Risk: forgetting this will silently break esp8266-based features like ESP-Wi-Fi.

---

## Critical Files for Implementation

- `src/emu/machines/zxNext/JoystickDevice.ts`
- `src/emu/machines/zxNext/MouseDevice.ts`
- `src/emu/machines/zxNext/io-ports/KempstonHandler.ts`
- `src/emu/machines/zxNext/NextRegDevice.ts`
- `src/main/machine-menus/machine-menu-registry.ts`

---

## 8. Incremental implementation steps

Each step follows the same strict flow to minimise regression risk:

1. **Implement** the change (code only, smallest possible diff).
2. **Lint** the changed files (`npm run lint -- <changed paths>` or repo-wide `npm run lint`).
3. **Write/extend unit tests** for the change (vitest, mirroring existing patterns in `test/zxnext/`).
4. **Run all tests** (`npm test`) — fix failures before moving on.
5. **Commit** the step with a descriptive message; do not bundle multiple steps.

### 8.1 Decisions taken on open questions (low-risk path)

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

### Step 1 — NR `$83` peripheral gate getters ✅

**Goal:** Expose `isMouseEnabled()` and `isPortDfKempstonAlias()` from
`NextRegDevice` so port handlers can gate behaviour without re-decoding NR `$83`.

**Files:**
- `src/emu/machines/zxNext/NextRegDevice.ts` — add public getters that read the
  already-stored NR `$83` bits.

> **Note on polarity:** NR `$83` is "Internal Port Decoding Enables #2" —
> bit 5 = 1 **enables** mouse ports; bit 5 = 0 disables them (FPGA hard-reset
> value is 0xff, all enabled). The plan table that said "Disabled by bit 5 = 1"
> had the polarity inverted. The getters and tests below reflect the actual
> FPGA behaviour.

**Tests:** extend `test/zxnext/NextRegDevice.test.ts`:
- After `writeNextReg(0x83, 0x00)` → `isMouseEnabled() === false`,
  `isPortDfKempstonAlias() === true`.
- After `writeNextReg(0x83, 0x20)` (bit 5 set) → `isMouseEnabled() === true`,
  `isPortDfKempstonAlias() === false`.
- Hard reset sets NR `$83 = 0xff` → mouse enabled, alias off.

**Emulator test:** Step 1 changes are read-only getters with no observable
behaviour change yet — the only hands-on check is *negative*: boot the Next
machine, open the NextReg view (or use the debugger watch), and confirm NR
`$83` reads `$FF` after a hard reset (all port enables = 1, mouse enabled).
No port-level effect is expected at this step; verification is deferred to Step 2.

---

### Step 2 — Gate Kempston mouse ports on NR `$83` ✅

**Goal:** When mouse is disabled, `$FBDF`/`$FFDF`/`$FADF` return `0xFF`.

**Files:**
- `src/emu/machines/zxNext/io-ports/KempstonHandler.ts` — wrap the three readers
  to consult `nextRegDevice.isMouseEnabled()`.

**Tests:** extend `test/zxnext/KempstonMouse.test.ts`:
- Clear NR `$83` bit 5 (write `$00`); `readPort(0xFBDF)` returns `0xFF`; same for `$FFDF`,
  `$FADF`.
- After `addDelta(10,10)` while disabled, then re-enable: position is preserved
  (state persists across the toggle).

**Emulator test:** From NextBASIC (or via Klive's debug command line):

```
10 reg $83,$df    : REM NR $83 = $DF, clear bit 5 only → mouse disabled
20 PRINT IN 64479; " ";IN 65503;" ";IN 64223  : REM $FBDF, $FFDF, $FADF
30 reg $83,$ff    : REM NR $83 = $FF, restore all enables → mouse enabled
40 PRINT IN 64479; " ";IN 65503;" ";IN 64223
```

Expected: line 20 prints `255 255 255` (mouse disabled); line 40 prints values
reflecting actual mouse state (move the mouse first to vary X/Y). Toggle a few
times and verify that the X/Y values resume from where they were before
disabling — they should not be reset.

---

### Step 3 — Route port `$DF` to mouse or joy1 alias

**Goal:** Port `$DF` returns mouse buttons when mouse enabled, otherwise reads
joy1 (`$1F` value).

**Files:**
- `src/emu/machines/zxNext/io-ports/KempstonHandler.ts` (or wherever `$DF` is
  currently routed — verify against `NextIoPortManager.ts:441-515`).

**Tests:** new `test/zxnext/NextPeripheralGate.test.ts`:
- Default (mouse enabled, NR `$83` = `$FF`): `$DF` returns mouse buttons.
- NR `$83` bit 5 = 0 (write `$00`): set `joystickDevice.leftState = 0x09` and
  read `$DF` → `0x09`.
- Toggle the bit at runtime; verify both behaviours flip without reset.

**Emulator test:** With Kempston1 selected on joy1 (default after hard reset),
in NextBASIC:

```
10 reg $83,$ff    : REM NR $83 = $FF — all enabled, $DF = mouse buttons
20 PRINT IN 223                  : REM $DF — press a mouse button to vary
30 reg $83,$df    : REM NR $83 = $DF — clear bit 5 → $DF aliases joy1
40 PRINT IN 223; " "; IN 31      : REM $DF should equal $1F now
```

Hold ArrowRight (Kempston Right = bit0) before line 40 and verify both
columns print `1`. Release and rerun: both print `0`. Re-enable mouse (write
`$FF` to NR `$83`) and confirm `$DF` again reflects mouse buttons (not joystick).

---

### Step 4 — Custom-command channel for input

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

**Emulator test:** Use Klive's interactive command (or the dev console) to
issue custom commands and verify in NextBASIC:

1. Run `emu-cmd custom setJoystickState {"left":16}` (or equivalent Klive
   command-palette form). In NextBASIC: `PRINT IN 31` → `16`. Reissue with
   `{"left":0}` → `PRINT IN 31` → `0`.
2. Run `setMouseDelta {"dx":5,"dy":-3}` while mouse is enabled. In NextBASIC:
   `PRINT IN 64479; " ";IN 65503` → values move by `+5` and `+3` (Y inverted)
   relative to previous read, scaled by current DPI (NR `$0A`).
3. Run `attachJoystickSource {"slot":1,"mode":"kempston2"}`. Open the NextReg
   view and confirm NR `$05` joy1-mode bits now encode Kempston2.

---

### Step 5 — Redux state for input bindings

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

**Emulator test:** Bindings are not yet consumed by any host-input hook, so
runtime joystick behaviour is unchanged. Verify persistence only:

1. Launch Klive; open the redux/devtools panel (or inspect
   `appSettings.json`) and confirm `nextJoystickBindings` is present with the
   Kempston1 defaults.
2. Dispatch a binding change manually (e.g. via devtools or a temporary debug
   action). Quit Klive, relaunch, and confirm the new binding is restored.
3. No `IN 31` change is expected — that is verified in Step 6.

---

### Step 6 — `useEmulatorJoystick` keyboard mode (Kempston/MD)

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

**Emulator test:** With joy1 = Kempston1 (default), in NextBASIC:

```
10 PRINT AT 0,0; IN 31;"   ": GO TO 10
```

- Press and hold ArrowRight → display shows `1`. Release → `0`.
- Hold ArrowRight + ArrowUp → `9` (`bit0|bit3`).
- Hold RControl alone → `16` (`bit4`).
- Hold all four directions + fire → `31`.

Switch joy1 to Sinclair2 via menu (or `attachJoystickSource`) and confirm the
loop now prints only `0` regardless of arrow keys (handled in Step 7).

---

### Step 7 — Keyboard-matrix dispatch for Sinclair / Cursor modes

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

**Emulator test:** Switch joy1 to **Sinclair 2** from the menu and run the
following BASIC `INKEY$` loop:

```
10 LET k$ = INKEY$: IF k$ = "" THEN GO TO 10
20 PRINT k$: GO TO 10
```

- ArrowLeft → `1`, ArrowRight → `2`, ArrowDown → `3`, ArrowUp → `4`,
  Fire (RControl) → `5`. Each release stops the auto-repeat.

Switch joy1 to **Cursor / Protek** and rerun:
- ArrowLeft → `5`, ArrowDown → `6`, ArrowUp → `7`, ArrowRight → `8`,
  Fire → `0`.

Switch to **Sinclair 1**: directions and fire should produce keys `6..0`.

---

### Step 8 — Gamepad API polling

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

**Emulator test:** Plug in a USB gamepad **before or after** launching Klive
(connect-while-running must work). Keep the `PRINT IN 31` loop from Step 6
running.

- Push the left stick fully right → `1`. Centre → `0`. Light push within the
  deadzone (~10% deflection) → still `0`.
- Press the south face button (A/cross) → bit4 set, e.g. `16`.
- Press D-pad up while pushing stick right → `9` (`bit0|bit3`).
- Plug a second pad, assign it to joy2 via the menu, and confirm
  `PRINT IN 55` reflects the second pad while `IN 31` ignores it.

---

### Step 9 — Mouse pointer-lock + relative motion

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

**Emulator test:** In NextBASIC, run a polling loop on the mouse X port:

```
10 PRINT AT 0,0; IN 64479;"   ": GO TO 10
```

- Click on the emulator canvas: pointer disappears (locked). Move the host
  mouse right → printed value increases (mod 256). Move left → decreases /
  wraps from 0 to 255.
- Press Esc: pointer reappears; further mouse motion no longer changes the
  value.
- Repeat for Y on `IN 65503` — moving the mouse **up** must increase the
  value (Kempston Y is inverted relative to screen).
- Change sensitivity in the menu (e.g. 0.25 → 4.0) and confirm the rate of
  change scales accordingly for the same physical mouse motion.

---

### Step 10 — Mouse buttons & wheel

**Goal:** Dispatch button state and wheel deltas; suppress browser context menu
while captured.

**Files:**
- Extend `useEmulatorMouse.ts`.

**Tests:**
- `mousedown` left → `setMouseButtons` `{ left:true }`.
- `wheel` event with `deltaY=-100` → `setMouseWheel` with `dz=1`.
- `contextmenu` event is `preventDefault`-ed while captured.

**Emulator test:** In NextBASIC, poll the buttons/wheel port:

```
10 LET v = IN 64223                         : REM $FADF
20 PRINT AT 0,0; "btn=";v BAND 7;" wheel=";(v >> 4) BAND 15;"   "
30 GO TO 10
```

Capture the mouse first.
- Press left button → `btn` reflects the left bit (active-low per
  `MouseDevice.readPortFadf`); release → reverts. Repeat for right & middle.
- Roll the wheel one notch up → `wheel` increments by 1 (mod 16). One notch
  down → decrements / wraps from 0 to 15.
- Right-click on the canvas while captured → no browser context menu appears.
- Toggle NR `$0A` bit 3 (button swap) and verify left/right report swapped.

---

### Step 11 — Capture overlay

**Goal:** Plain "Mouse captured — Esc to release" message via existing
`EmulatorOverlay.tsx`. Triggered by redux flag mirroring pointer-lock state.

**Files:**
- `EmulatorOverlay.tsx` (extend), `useEmulatorMouse.ts` (set flag on
  `pointerlockchange`).

**Tests:**
- Fire `pointerlockchange` with locked element = canvas → overlay state true.
- Fire again with no locked element → false.

**Emulator test:**
- Click on the canvas: an overlay reading "Mouse captured — Esc to release"
  appears.
- Press Esc: overlay disappears.
- Click again: overlay reappears. Switch focus away from the Klive window
  (Cmd/Alt+Tab) and confirm the OS releases pointer-lock and the overlay
  hides.

---

### Step 12 — Joystick bindings dialog

**Goal:** Modal with two columns (joy1/joy2), source dropdown, key-capture
rows, "Reset to defaults".

**Files:**
- `src/renderer/appEmu/dialogs/JoystickBindingsDialog.tsx`.

**Tests:**
- Renders with current bindings from redux.
- Capture row records the next keydown and updates redux on save.
- "Reset to defaults" restores Kempston1 + arrows + RControl.

**Emulator test:**
- Open the dialog from the menu. Each row shows the currently bound key.
- Click a row (e.g. "Right"), press `D` → row updates to show `D`. Save the
  dialog. With `PRINT IN 31` running (joy1 = Kempston1), holding `D` now
  drives bit0 instead of ArrowRight.
- Reopen the dialog, click "Reset to defaults": rows revert to arrows +
  RControl. Confirm `D` no longer triggers, ArrowRight does.
- Quit and relaunch Klive: customised bindings (before reset) persist if
  saved.

---

### Step 13 — Menu renderers

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

**Emulator test:**
- Boot the ZX Spectrum Next machine. The Machine menu must contain
  "Attach Joystick ▶" and "Attach Mouse ▶".
- Under "Attach Joystick ▶ Joystick 1 ▶", radio-select Kempston 1 → with
  `PRINT IN 31` running, ArrowRight produces `1`. Switch to Sinclair 2 → the
  same arrow now produces no Kempston bit but emits BASIC key `2`.
- "Attach Mouse ▶ Mode ▶ Disabled" → mouse motion no longer affects
  `IN 64479` and the canvas does not capture pointer on click.
- "Capture Mouse Now" (or Ctrl/Cmd+M) → pointer locks, overlay shown. Same
  shortcut releases.
- "Sensitivity ▶ 4.0" → mouse moves 4× faster than at 1.0.
- After switching machines (e.g. to ZX Spectrum 48k) and back, the menus and
  selections persist.

---

### Step 14 — End-to-end smoke (manual + scripted)

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

### 8.2 Out of scope (tracked for later)

- MD 6-button Select-pulse multiplexing (Step plan: research TBBlue MD pad
  spec, then add `mdSixPhase` state machine + NR `$0B` driver hookup).
- UART-on-joy-port plumbing through `UartDevice`.
- Gamepad rumble.
- Soft/hard reset split for `MouseDevice`.
- Per-project bindings profiles.
- Touch / on-screen joystick.
