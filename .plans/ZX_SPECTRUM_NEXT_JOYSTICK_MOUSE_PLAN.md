# ZX Spectrum Next Joystick & Mouse — Implementation Plan

**Status:** emulation done, host plumbing not started. **Start at §6 Milestone A** — the mouse
capture experience is built and verified first, with the machine deliberately left unwired.
**Rewritten 2026-09-20** against the WASM core. Supersedes the 2026-08-30 draft that lived in
`src/emu/plan.md` + `src/emu/plan-steps.md` (the latter was a stale duplicate of the former's §8 and
carried an inverted NR `$83` polarity; both are gone, the history is in git).

---

## 0. What changed, and what is actually left to do

The old plan was written when the Next ran on the TypeScript device classes. It is now wrong in its
premise, not in its physics. Since then:

- **The shipped "ZX Spectrum Next" machine is the WASM core.** `ZxNextMachineFactory.ts:15-18`
  picks `ZxNextWasmV2Machine` whenever the implementation is `"wasm"`, and
  `ZxNextImplementation.ts:15` makes that the default. `machine-registry.ts:334-347` gives the
  TypeScript build its own model, *"ZX Spectrum Next Compatibility"*.
- **`MouseDevice.ts` / `JoystickDevice.ts` are not on the live path.** Only `ZxNextMachine.ts:234-235`
  constructs them. `ZxNextWasmV2Machine extends ZxNextWasmHost` (`ZxNextWasmV2Machine.ts:125`), which
  "constructs no TypeScript Next device" (`ZxNextWasmHost.ts:27-36`), and
  `test/wasm/zxNext/wasm-next-separation.test.ts` fails if one ever becomes reachable — *even through
  a type import*. Every `mouseDevice.` / `joystickDevice.` line in the old plan pointed at code the
  user never runs.
- **Both devices are fully emulated in C, to the VHDL.** `wasm/zxnext/zxnext-input.c` implements the
  two 12-bit connectors, the NR `$05` mode decode, `$1F` / `$37` / the `$DF` alias, MD `$B2`, the
  `$28`/`$29`/`$2B` joymap, the `membrane_stick.vhd` key pressing, and the whole PS/2 mouse — packet
  latching, DPI scaling, button reverse, the wrapping counters and `$FADF`'s active-low buttons.
- **They are covered by hardware tests.** `test/zxnext-hw/joystick/joystick.test.ts` (JOY-001 -
  JOY-008, KEY-007) and `test/zxnext-hw/mouse/mouse.test.ts` (MOU-001 - MOU-005) drive the real
  machine through ports and NextRegs. The catalogue rows are
  `.plans/ZX_SPECTRUM_NEXT_HARDWARE_TEST_CATALOGUE_PLAN.md:113` and §4.33.
- **The NR `$83` gating the old Steps 1-3 were about is done**, in the port decoder rather than in a
  device: `zxnext-ports.c:79-88` gates `$xADF`/`$xBDF`/`$xFDF` on port group (1,5) and turns `$DF`
  into the Kempston-joystick-1 alias when the mouse port is off. Fixed under bug B94
  (`.plans/ZX_NEXT_EMULATOR_BUGS_HANDOVER.md`, 2026-09-19). Button polarity was B31.

So **old Steps 1, 2, 3, 4 and 7 are dead**, and §5.1's mock-based test list is dead with them.

What is left is exactly one thing, and it is all on the host side:

> **Nothing in `src/` ever calls `zxnextSetJoystickLeftState`, `zxnextSetJoystickRightState` or
> `zxnextMousePacket`.** The only callers in the repo are the test harness
> (`test/harness/zxnext/script/joystick.ts:25-26`, `script/mouse.ts:20`). There is no pointer lock,
> no Gamepad API use, no mouse handler on the emulator canvas and no joystick or mouse menu item
> anywhere: `grep -rni "joystick\|kempston\|mouse" src/main/` returns nothing.

A user can therefore not move a mouse pointer or press a fire button in Klive today, even though the
machine underneath would answer perfectly if someone told it.

---

## 1. The contract the core already implements

Read this before writing any host code; it decides the whole design.

### 1.1 The joystick connectors

Each of the two connectors is **12 bits, active high** — the output of
`md6_joystick_connector_x2.vhd`, not a port value:

| bit | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| | RIGHT | LEFT | DOWN | UP | B | C | A | START | Y | Z | X | MODE |

`B` is fire 1 (pin 6), `C` fire 2 (pin 9); `A`, `START`, `X`, `Y`, `Z`, `MODE` exist only on a Mega
Drive pad. The host sets the whole word at once:

```c
void zxnextSetJoystickLeftState(uint32_t state);   /* masked & 0xfff */
void zxnextSetJoystickRightState(uint32_t state);
```
`zxnext-input.c:67-68`. **Left is joystick 1, right is joystick 2** (`zxnextJoystickMode(0)` reads NR
`$05` bits 3 and 7-6, side 1 reads bits 1 and 5-4, `:34-37`).

### 1.2 What the core does with those bits — the part that matters most

NextReg `$05` selects a mode per connector, and the mode decides where the bits *go*:

| NR `$05` mode | Name | Where the bits surface |
|---|---|---|
| `001` / `100` | Kempston 1 / 2 | Port `$1F` / `$37`, bits 5-0 |
| `101` / `110` | MD 1 / 2 (3-button) | Port `$1F` / `$37`, bits 7-0; X Y Z MODE in NR `$B2` |
| `000` / `011` | Sinclair 2 / 1 | **Presses membrane keys** `1`-`5` / `6`-`0` |
| `010` | Cursor / Protek | **Presses membrane keys** `5`,`6`,`7`,`8`,`0` |
| `111` | User-defined | **Presses the keys programmed through NR `$28`/`$29`/`$2B`** |

The key pressing is real: `zxnextJoystickKeys()` (`zxnext-input.c:134-158`) walks the joymap and ORs
the resulting matrix rows and extra-key bits into the keyboard read, and `zxnext-keyboard.c:130-134`
calls it on every `$FE` read. The joymap's power-on contents are `keyjoy_64_6.coe`
(`zxnext-input.c:29-32`).

**Consequence for this plan, and the answer to "how do I emulate a joystick through the keyboard":**

> The host never decides whether a joystick press becomes a port bit or a key press. It writes the
> 12 connector bits and stops. Sinclair, Cursor and user-defined modes then press ULA keys *inside
> the core*, exactly as the FPGA does. One host binding table works for every joystick mode, and it
> keeps working when a program changes NR `$05` mid-game.

The old plan's Step 7 ("Keyboard-matrix dispatch for Sinclair / Cursor modes" — the renderer calling
`setKeyStatus` with `N1`…`N5`) would have *duplicated* the core and fought it. It is deleted.

In I/O mode (NR `$0B` bit 7) a connector reports only its six raw pins and presses no keys at all
(`zxnext-input.c:39-45`) — free, nothing to do.

### 1.3 The mouse

```c
void zxnextMousePacket(uint32_t buttons, int32_t dx, int32_t dy, int32_t dz);
```
`zxnext-input.c:172-187`. One call is **one PS/2 packet**, which is the only way the hardware learns
about the mouse. Per packet:

- `buttons` — bit 0 left, bit 1 right, bit 2 middle, **1 = pressed**, held until the next packet.
  The core applies NR `$0A` bit 3 (reverse) as the packet arrives, and `$FADF` presents the buttons
  **active low** (`:189-192`, bug B31). The host must not swap or invert anything.
- `dx` / `dy` — **positive is right and *up***. Screen coordinates grow downwards, so `dy` is
  `-movementY`.
- `dz` — 4-bit wheel delta, sign-extended and added to a 4-bit counter.
- `zxnextMouseX += scaled(dx)` into an **8-bit wrapping counter**. Nothing resets it but power-on
  (`zxnextInputReset` is empty, `:48`) — so there is no reset handling to write, and no "recentre"
  to do when the host pointer warps. Software reads the counter and diffs it itself.

**The per-packet range limit, which is easy to get wrong.** `scaled()` starts with
`uint8_t b = (uint8_t)delta`, so a delta only survives if it fits a *signed byte*. Worse, at DPI `00`
the byte is doubled (`zxnext-input.c:161-169`):

| NR `$0A` bits 1-0 | scaling | largest host delta that still moves the right way |
|---|---|---|
| `00` | `b << 1` | **±63** (64 → 128 → software reads −128) |
| `01` | `b` | ±127 |
| `10` | `b >> 1`, sign kept | ±127 |
| `11` | `b >> 2`, sign kept | ±127 |

So **±63 per packet is the only universally safe chunk**, and the host must split a larger
accumulated movement across several packets. This is not a workaround: a real PS/2 mouse reporting
at 100-200 Hz never puts more than a few dozen counts in one packet either, and a real Next
mis-tracks in exactly the same way if one ever does. (The harness guard at `script/mouse.ts:18-19`
allows ±255 because that is the packet field's width; it is not the useful range.)

---

## 2. Host keyboard → joystick

### 2.1 Model

Two 12-bit words in the renderer, `leftBits` and `rightBits`. A binding is
`hostCode → { side, bit }`. On `keydown` set the bit, on `keyup` clear it, and push the changed word
into the machine. That is the entire mechanism.

```
keydown "ArrowRight"  →  leftBits |= 1 << 0   →  machine.setJoystickState("left", leftBits)
```

Everything else — Kempston vs MD vs Sinclair vs Cursor, port `$1F` vs the keyboard matrix, the OR
across the two connectors — is the core's job and is already done and tested.

### 2.2 Default bindings

Mirrors the old plan's table, retargeted to connector bits. Joystick 1 (left connector):

| Host `KeyboardEvent.code` | bit | |
|---|---|---|
| `ArrowRight` | 0 | RIGHT |
| `ArrowLeft` | 1 | LEFT |
| `ArrowDown` | 2 | DOWN |
| `ArrowUp` | 3 | UP |
| `ControlRight` | 4 | B — fire 1 |
| `ShiftRight` | 5 | C — fire 2 |
| `Backslash` | 6 | A (MD) |
| `NumpadEnter` | 7 | START (MD) |

Joystick 2 (right connector) defaults to `KeyD`/`KeyA`/`KeyS`/`KeyW`, `ShiftLeft`, `Tab`, `KeyQ`,
`KeyE`. X, Y, Z and MODE are unbound by default; the bindings dialog can reach them.

### 2.3 Arbitrating with the emulated keyboard — the one real conflict

`useEmulatorKeyboard` binds `keydown`/`keyup` on `window` and maps `e.code` through `keyMappings`
into `machine.setKeyStatus` (`useEmulatorKeyboard.ts:52-73, 108-109`). The arrow keys are already
mapped there for the Next's own cursor keys. Without arbitration, one `ArrowUp` would press both the
joystick's UP *and* the membrane `7`, and in Sinclair mode the core would press a third key on top.

Rule: **a host code bound to a joystick bit is consumed by the joystick and never reaches the
keyboard mapping.** Implement by giving `useEmulatorKeyboard` a `claimedCodes: Set<string>` (a ref,
so no re-binding churn) that `handleKey` checks before `handleMappedKey`, and have
`useEmulatorJoystick` own that set. A per-joystick "enabled" flag empties the set, which restores
today's behaviour exactly.

Two details that will otherwise produce stuck inputs:

- **Blur and machine stop must clear both words.** The keyboard hook has the same bug today and gets
  away with it: `pressedKeys` (`useEmulatorKeyboard.ts:16`) is written on keydown and deleted on
  keyup and **never read by anything**, and because the guard at `:80-85` drops events while the
  machine is not `Running` or a modal is open, a key held across either edge has its key-up
  swallowed and stays down in the matrix. A stuck *direction* is far more visible than a stuck
  letter, so do it properly here: clear both words on `window` `blur`, on `MachineControllerState`
  leaving `Running`, on `dimMenu` going true, and whenever the bindings change.
- **Modal dialogs.** Reuse the existing `dimMenu` gate (`useEmulatorKeyboard.ts:28-31`) so bindings
  do not fire behind a dialog.

### 2.3.1 The alternative that looks tempting and is wrong

`KeyMapping` already allows one host key to press up to three emulated keys
(`KeyMapping.ts:4`; the hook handles 1-3 at `useEmulatorKeyboard.ts:52-73`), and the stock Spectrum
table uses it — `ArrowLeft: ["CShift", "N5"]` (`SpectrumKeyMappings.ts:70-81`). So one *could*
"emulate a Sinclair joystick" by shipping a key-mapping file and writing no code at all.

Do not. That fakes a joystick by pressing keys, so it works only in the modes that happen to press
those keys, breaks the moment a program writes NR `$05`, never reaches port `$1F`, and cannot
produce MD buttons or the user-defined joymap. The connector-bit route is both less code and the
real thing. (Worth knowing anyway: the mapping *parser* rejects 3-element arrays at
`keymapping-parser.ts:39-43` although the type and the hook support them — a separate latent bug.)

### 2.4 Choosing the joystick mode

NR `$05` is the machine's state, not the emulator's. A menu item that "attaches a Kempston 1
joystick" can only write NR `$05`, the way the F-key hotkeys write NextRegs today
(`ZxNextWasmV2Machine.ts:951-961`, `zxnextSetNextRegisterDirect`).

**Flag this in the UI:** NextZXOS writes NR `$05` from its own configuration at boot, so a mode
chosen before the OS starts will be overwritten. The honest behaviours are (a) offer the write as a
convenience and say so, and (b) leave the mode alone by default, since a Next user normally sets it
in the Next's own menus. Recommend (a) with the caveat in the menu item's tooltip, defaulting to no
write at startup.

### 2.5 Gamepads

Unchanged from the old plan and still correct, because it feeds the same 12 bits: poll
`navigator.getGamepads()` on `requestAnimationFrame`, derive directions from `axes[0]`/`axes[1]`
against a dead zone plus D-pad buttons 12-15, map face buttons to B/C/A/START, OR into the same word
and write it. `gamepadconnected`/`gamepaddisconnected` keep the menu's pad list live. Nothing about
the core changes; a pad and the keyboard can drive the same connector because they contribute to one
word.

---

## 3. Host mouse → Kempston mouse

### 3.1 Capture

Pointer lock on the emulator canvas (`EmulatorPanel.tsx:386`). Relative motion is the only sane
model: the emulated pointer is drawn by the *guest*, the counters wrap, and there is no coordinate
system to map a host position onto.

**Transient activation is mandatory, and it decides the whole UI.** Per the Pointer Lock spec,
"transient activation is required when calling `requestPointerLock()`". A capture therefore has to
originate from a real DOM event **inside the emu renderer**.

> **An Electron menu item or a main-process accelerator cannot capture the mouse.** The F-key
> "hotkeys" in `zx-next-menus.ts:84-175` carry no `accelerator`; they run in main and reach the
> renderer over IPC (`getEmuApi().issueMachineCommand(...)`). A `requestPointerLock()` called from
> such a handler has no transient activation and is rejected. An earlier draft of this plan
> recommended "menu + `Ctrl+M` accelerator" — that does not work.

Working triggers, both renderer-side and both **explicit**:

- **The toolbar button** (§3.1.2).
- **A renderer-level `keydown`** for `Ctrl+M` — a real key event *is* an activation, so handle it in
  a hook beside `useEmulatorKeyboard`, never as an Electron accelerator.

A menu item may still *toggle the setting* ("Capture the mouse") — it just cannot perform the lock
itself.

**Clicking the screen does not capture.** It was built that way and taken out: a click on the
picture is what someone does to focus the window or bring the status pill back, and losing the
cursor to the machine for it is startling. The screen's click keeps restoring the overlay, as it
always did, and capture is never incidental.

Request raw input:

```ts
await canvas.requestPointerLock({ unadjustedMovement: true });
```

`unadjustedMovement` turns off OS pointer acceleration. It matters here more than in a game: the
core already scales every packet by NR `$0A`'s DPI, and letting the OS curve compound with that
would make the guest pointer non-linear in a way no real Next is.

**Electron:** `pointerLock` is one of the permission types `setPermissionRequestHandler` /
`setPermissionCheckHandler` cover. Klive sets neither, and Electron approves permission requests by
default — but confirm the first `requestPointerLock()` actually resolves, and if a handler is ever
added, allow `pointerLock` for the emu window.

### 3.1.1 Release — four doors, one event

| How | Who triggers it | Interceptable? |
|---|---|---|
| **Esc** | the user | **No.** The browser performs the default unlock gesture itself; you cannot `preventDefault` it |
| `document.exitPointerLock()` | us — setting turned off, machine stopped, window closing | — |
| Window focus lost / document hidden | the OS (Alt-Tab) | No |
| Renderer reload or navigation | — | No |

All four arrive as **one `pointerlockchange` on `document`** with `document.pointerLockElement` now
null, so the hook has a single release path. On release it must:

1. **Zero the buttons and send one final packet.** Buttons latch in the core until the next packet
   (`zxnext-input.c:172-180`) — release while a button is down and the guest sees it held forever.
2. Stop consuming `movementX/Y`, and drop the pending accumulators (§3.2) so nothing flushes after
   the user has left.
3. Clear the capture flag in `AppState`, which drops the overlay and unticks the menu.

**The Esc re-capture lockout — plan for it, it looks like a bug.** The spec is explicit: calling
`requestPointerLock()` "immediately after releasing the pointer lock via the default unlock gesture
(instead of through an `exitPointerLock()` call) ... will fail, even if a transient activation is
available." So Esc followed by an immediate click does nothing for about a second. Catch the
rejection rather than letting it look broken: leave the overlay up saying *click to capture* and let
the next click succeed.

**One consequence to document for users:** while captured, Esc belongs to the browser, so it can
never reach the guest. Harmless on the Next (BREAK is CAPS SHIFT + SPACE), but it is a real
limitation if this hook is ever reused for the Z88, which has a genuine ESC key.

### 3.1.2 The toolbar button

A toolbar click *is* a real DOM event in the emu renderer, so unlike the Electron menu it carries
transient activation and **can** perform the capture. It belongs in `ViewControls.tsx` — the
`!ide` toolbar group — built exactly like the Stay-on-top button beside it
(`iconName={stayOnTop ? "pinned" : "pin"}` + `selected`), so the icon and the lit state both follow
the capture flag in `AppState`.

> **It cannot be a two-way switch.** While the pointer is locked, every mouse event is delivered to
> the locked element, so the button is physically unclickable — the click lands on the Next's
> screen. The button captures and reports state; **releasing stays Esc or `Ctrl+M`**. Word the
> tooltip accordingly ("Capture mouse — Esc to release"), not as a toggle.

Icons: drop `mouse.svg` and `mouse-off.svg` (Lucide) into `src/renderer/assets/icons/`. The filename
is the icon id and Lucide art paints with `currentColor`, which `Icon` wires to the theme colour —
no entry in `icon-defs.ts` (see that folder's `README.md`).

### 3.1.3 The capture indicator pointer

While captured there is **no pointer position to draw** — the cursor is hidden and only deltas
arrive. So Klive keeps its own: seed it at the centre of the screen rectangle on capture, move it by
the same (sensitivity-scaled) deltas being fed to the machine, clamp it to that rectangle, drop it
on release.

**It moves by what the machine receives, not by the raw hand movement.** The core multiplies every
packet by NextReg `$0A`'s DPI before adding it to its counters, so at DPI `00` a program's pointer
travels exactly twice as far as the hand did. An indicator that ignored that would sit at half speed
beside the machine's own pointer and read as a delivery bug. `mouseDeltaScale()` on
`IZxNextHostInputMachine` reports the factor; it is read per frame, because software changes `$0A`
whenever it likes. The *packets* stay unscaled — the core applies the DPI itself, and doing it here
too would double it twice.

This is also the line between the two knobs, worth stating in the UI: **host sensitivity scales the
hand** and moves the indicator and the machine's pointer together, so it can never change the ratio
between them; **NextReg `$0A` is what sets that ratio**, and it belongs to the guest.

**Be clear about what it is.** This is *Klive's* pointer, not the Next's. When an app is reading the
mouse it draws its own, and the two diverge within seconds: the guest applies its own NR `$0A` DPI
scaling, starts from its own origin, and its counters wrap where this indicator clamps. Two pointers
that disagree are worse than none.

Hiding it while software is consuming the coordinates is therefore *offered*, not imposed. The
detection is a read counter on `zxnextMouseReadPortFbdf` / `...Ffdf` / `...Fadf` in `zxnext-input.c`
with one export (new exports also go in `scripts/build-zxnext-wasm.cjs` and
`ZxNextWasmV2Loader.ts`, then `npm run build:zxnext-wasm`); if the guest has read those ports within
roughly the last second, an app owns the mouse.

**But `always` is the default, and hiding is the option.** Auto-hide shipped as the only behaviour
first and was wrong twice over: the drift between the two pointers is exactly what someone wants to
*watch* when checking whether movement is being delivered correctly, and an indicator that vanishes
whenever software is running is indistinguishable from one that is broken. The setting is a three-way
choice — *Always* / *Only while no program reads the mouse* / *Never* — and it accepts the boolean it
used to be (`true` → always, `false` → never).

Drawing it:

- **Its own absolutely-positioned layer inside `.display`, `pointer-events: none`.** Not inside
  `.overlayStack` (`EmulatorPanel.module.scss:109-124`): that is a flex column of pills anchored
  top-left whose children re-enable pointer events, which would let the indicator swallow the very
  click that starts capture.
- Make it obviously **not** an OS cursor — a crosshair or ring in the accent colour, not an arrow —
  so a user never reads it as their real pointer being stuck.
- Fill or flash it while a mouse button is held: that is the only feedback that clicks are reaching
  the machine when nothing consumes them.
- Colours from tokens, no literals; and per the standing rule the change updates
  `.ai/ui-theming-intent-and-lessons.md` in the same commit.

For the "captured — press Esc to release" indicator, note what the overlay stack actually is.
`EmulatorOverlay` (`EmulatorOverlay.tsx:5-16`) holds two pills: `ExecutionStateOverlay`, whose text
is **local component state** in `EmulatorPanel` (`:62-63`) and which is a persistent status pill
rather than a timed toast, and `RecordingStateOverlay`, which reads
`useSelector(s => s.emulatorState?.screenRecordingState)`. **Copy the recording pill**: a capture
indicator driven from `AppState` is the right shape, and it makes the same flag available to the
menu builder in main for its checkbox (§5).

### 3.2 Accumulate, then emit packets

Do **not** call `zxnextMousePacket` from the `mousemove` handler. A high-polling-rate mouse fires
far above the machine's 50 Hz and each call is a discrete hardware event.

```
mousemove   →  pendingX += movementX * sensitivity
               pendingY -= movementY * sensitivity      // core's Y is up-positive
wheel       →  pendingZ += -Math.sign(deltaY)
mousedown/up→  buttons bit 0/1/2                         // no swap: NR $0A bit 3 is the core's job

on each animation frame:
  sent = 0
  loop:
     dx = clamp(trunc(pendingX), -63, 63)        // ±63: see §1.3
     dy = clamp(trunc(pendingY), -63, 63)
     dz = clamp(trunc(pendingZ),  -8,  7)
     if dx == 0 and dy == 0 and dz == 0: break   // sub-unit remainders stay pending
     pendingX -= dx;  pendingY -= dy;  pendingZ -= dz
     machine.mousePacket(buttons, dx, dy, dz);  sent++
     if sent == MAX_PER_FLUSH: pendingX = pendingY = pendingZ = 0;  break
  if sent == 0 and buttons changed since the last packet:
     machine.mousePacket(buttons, 0, 0, 0)
```

The `break` on an all-zero triple is what keeps the loop finite: `trunc` of a remainder below 1 is
0, so the leftover simply waits for the next frame. Keeping that fractional remainder is the point —
without it a sensitivity below 1.0 quantises slow movement away entirely. Cap `MAX_PER_FLUSH` (8 is
plenty) so a long stall cannot flush a hundred packets into one frame, and **discard** the excess
rather than carrying it: a real mouse's reports are lost the same way, and carrying them would make
the pointer keep gliding after the user stopped.

Sensitivity is a **host** multiplier, separate from NR `$0A`'s DPI, which belongs to the guest and
which the core already applies. Do not touch NR `$0A` to implement sensitivity.

### 3.3 Buttons and the wheel

- `mousedown`/`mouseup` → bits 0/1/2, sent on the next flush (or immediately, as a zero-motion
  packet, so a click is never delayed by a frame when the pointer is still).
- `contextmenu` must be `preventDefault`-ed while captured or the right button is unusable.
- One wheel notch per `wheel` event via `Math.sign`, not `deltaY` (which is 100 or 3 or 53 depending
  on the platform and the user's settings).
- **The wheel's sign needs checking against real software.** The core simply adds the delta
  (`zxnext-input.c:182-186`); nothing in the VHDL says which way a NextZXOS list scrolls. Verify with
  a mouse-aware program before fixing the sign, and note the answer here.

### 3.4 Availability

The guest can switch the mouse off through NR `$83` bit 5, and the ports then read `$FF` while the
counters keep counting (`zxnext-ports.c:79-82`, MOU-005). The host should keep sending packets
regardless — that is what the hardware does. Optionally surface the bit in the menu as a read-only
"mouse port: enabled/disabled" hint.

---

## 4. The transport

**The machine object is in the emu renderer process and the hooks can call it directly.**
`useEmulatorKeyboard.ts:55-57` already does exactly this — `controllerRef.current?.machine` then
`machine.setKeyStatus(...)`, no IPC, no `await`. Joystick and mouse input take the same road, which
deletes the old plan's §4.3 worry about "worker-message flooding" and its whole Step 4.

Do **not** use `executeCustomCommand`: its signature is `(command: string)` with no payload
(`IAnyMachine.ts:275`), it is `async` and it crosses IPC via
`EmuApi.issueMachineCommand` → `MainToEmuProcessor` → `MachineController.customCommand`. It is right
for a menu click, wrong for 50 Hz input.

### 4.1 New machine surface

`ZxNextWasmV2Machine` has no wrapper for the three exports today — only the harness reaches them.
Add, next to `setKeyStatus` (`ZxNextWasmV2Machine.ts:977-983`):

```ts
/** The 12-bit connector state, as md6_joystick_connector_x2.vhd reports it (active high). */
setJoystickState(side: "left" | "right", bits: number): void;

/** One PS/2 packet. Deltas are right/up positive and must fit ±63 — see the DPI note. */
mousePacket(buttons: number, dx: number, dy: number, dz: number): void;
```

Declare them on a small interface the hooks can type against. Note `IZxNextIdeMachine` deliberately
carries no mouse/joystick members and `IZxNextMachine` is the *TypeScript* machine's contract — do
not widen either one, or `wasm-next-separation.test.ts` starts arguing with you. A separate
`IZxNextHostInputMachine` that `ZxNextWasmV2Machine` implements keeps the hooks honest and the
separation test quiet.

Give the TypeScript machine the same two methods (forwarding to `JoystickDevice.setLeftState` /
`MouseDevice.receivePacket`, which exist) so the Compatibility model is not silently input-dead —
or decide it is, and say so in the menu.

---

## 5. Settings, menus and the bindings dialog

The in-flight **zoom-steps** change in the working tree is the template for all of this; copy it
rather than inventing a shape.

| Piece | Follow |
|---|---|
| Setting id | `setting-const.ts` — add `SETTING_EMU_JOYSTICK_BINDINGS`, `SETTING_EMU_MOUSE_CAPTURE`, `SETTING_EMU_MOUSE_SENSITIVITY` next to `SETTING_EMU_ZOOM_STEP` |
| Definition | `setting-definitions.ts` — `saveWithIde: true`, `boundTo: "emu"`, with a `DEFAULT_*` from a new `@common/settings/next-input.ts`. `saveWithProject: true` buys per-project bindings for free (`settings-utils.ts:90-99`) |
| Renderer read | `useGlobalSetting(SETTING_...)` (`RendererProvider.tsx:128`), as `useEmulatorScreen.ts` reads the zoom step; **normalize the value rather than trust it**, because older settings files never wrote it |
| Renderer write | `mainApi.setGlobalSettingsValue(id, value)` (`MainApi.ts:552` → `RendererToMainProcessor.ts:944-946` → `setSettingValue`) — the renderer never writes settings directly |
| Checkbox item | `createBooleanSettingsMenu(settingId, { enabledFn?, visibleFn? })` (`app-menu.ts:1487-1514`) — used from a machine renderer at `zx-specrum-menus.ts:39` (with the `as any` cast) |
| Radio group | `z88-menus.ts:27-54` is the template: read with `getSettingValue`, emit `type: "radio"` items whose `checked` compares against it, `click` calls `setSettingValue` |
| Next-only items | `machine-menu-registry.ts:73-81` `MI_ZXNEXT.machineItems` — add a `nextInputMenuRenderer` beside `hotkeyMenuRenderer` and `sdCardMenuRenderer` |
| Toolbar button | `ViewControls.tsx` (the `!ide` group), an `IconButton` like Stay-on-top: `iconName` follows the capture flag, `selected` lights it. §3.1.2 — **captures only, never releases** |
| Toolbar icons | `mouse.svg` / `mouse-off.svg` (Lucide) dropped into `src/renderer/assets/icons/`; the filename is the id, never an `icon-defs.ts` entry (that folder's `README.md`) |
| Bindings dialog | **Plain pattern** (`.docs/dialog-pattern.md`), not MVC — see §5.1. It belongs to the **emu** renderer: `src/renderer/appEmu/dialogs/joystick/`, an id from `EMU_DIALOG_BASE` (`dialog-ids.ts`), opened from main with `emuApi.displayDialog(id)`. Adding an id means updating the registry guard in `test/controls/AppShellStartup.test.tsx` |
| Dialog styling | tokens only, no colour literals; and per the standing rule, any visual change updates `.ai/ui-theming-intent-and-lessons.md` in the same commit |

### 5.1 Why the bindings dialog is not an MVC dialog

`.docs/dialog-mvc-pattern.md` is explicit about when it applies: **async orchestration plus derived
display rules** — several service calls that can interleave or fail. It says in as many words that
for a dialog without orchestration the Intent/Event split "would be pure ceremony".

The bindings dialog has none. It reads a setting, captures keystrokes, and writes once on Save. An
earlier draft of this plan specified MVC for it anyway, which would have bought four extra files and
no testability that mattered.

What it does have is *rules* worth testing without React — which key a binding takes from which pin,
what an assignment costs the emulated keyboard, how a reset is scoped. Those live in
`common/settings/joystick-binding-edit.ts` as pure functions and are tested in the fast `node`
project. The component is then a form with no decisions in it, which is the outcome MVC exists to
produce, reached without the ceremony.

Two menu mechanics worth knowing before writing the renderer:

- **`setupMenu` re-runs on every main-store change** (`index.ts:298-315`, cache at
  `app-menu.ts:1253-1275`), so a `checked` flag recomputes itself *provided the value it reads lives
  in the store or the settings*. A value kept only in the emu renderer cannot drive a checkbox — this
  is why `toggleScandoubler` is a plain item and not one. Put "mouse captured" in `AppState`.
- **A new `AppState` slice needs an `initialAppState` entry or its reducer never runs**
  (`store.ts:54` skips sub-reducers whose subtree is `undefined`). Renderers can force a menu
  rebuild with `incMenuVersionAction()`.

Menu shape (trimmed from the old plan — the mode list now writes NR `$05`, the source list feeds the
same connector word):

```
Machine ▸
  Joystick ▸
    Joystick 1 ▸  Mode ▸ (radio: leave alone · Kempston 1 · Kempston 2 · MD 1 · MD 2 ·
                          Sinclair 1 · Sinclair 2 · Cursor · User-defined)
                  Source ▸ (radio: off · host keyboard · <detected pad>)
    Joystick 2 ▸  (same)
    Configure bindings…
  Mouse ▸
    Enable mouse capture         (checkbox — arms the toolbar button and click-to-capture)
    Show pointer indicator       (checkbox — §3.1.3; auto once step 7 lands)
    Sensitivity ▸ (radio: 0.25 · 0.5 · 1.0 · 1.5 · 2.0 — the guest's DPI multiplies on top)
    (the capture itself is the toolbar button or Ctrl+M — a menu item
     cannot do it, and clicking the screen deliberately does not, §3.1)
```

---

## 6. Steps

Each step: implement, `npm run lint:renderer` when renderer React is touched, tests,
`npm run build:check`, commit alone.

**Milestone A — capture, with the machine left alone (steps 1-4).** The whole capture experience is
host-side and owes the Next nothing, so build it first and *do not wire it to the machine*. At the
end of step 3 you can press the toolbar button, watch the cursor vanish, move an indicator around
the Next's screen, press Esc and get everything back — with the emulated machine entirely unaware a
mouse exists. That is a real, demonstrable slice, it makes every pointer-lock quirk in §3.1 visible
early (the Esc lockout above all), and it is the part most likely to need hands-on iteration.
Keeping the machine out of it means nothing here can be blamed on packet arithmetic.

**The Mouse menu belongs to this milestone, not to step 13.** Capture is off by default, and with it
off the toolbar button is disabled - so with no menu there is no way to switch the feature on at
all, and Milestone A cannot even be tried. This was found the hard way: steps 1-3 were built with a
toolbar tooltip pointing at a menu that did not exist yet. A step that makes a feature reachable
belongs with the feature, not with the menu work for a different device.

| # | Step | Tests |
|---|---|---|
| **1** ✅ | **Capture state + pointer lock, no machine.** The three mouse settings first (`enable capture`, `show pointer`, `sensitivity`) in `setting-const.ts` / `setting-definitions.ts`, since Milestone A is gated on them. Then `useEmulatorMouse` requests the lock on the screen element and handles the single `pointerlockchange` release path (§3.1.1); a `mouseCaptured` flag in `AppState` (+ `initialAppState`); `Ctrl+M` as a **renderer** `keydown`; the Esc re-capture lockout caught and reported rather than swallowed. Deltas are accumulated and **discarded**. | jsdom: click requests the lock; `pointerlockchange` to unlocked clears the flag; a rejected request leaves the flag false and does not throw |
| **2** ✅ | **Toolbar button + overlay message** (§3.1.2). `mouse.svg` / `mouse-off.svg` in `assets/icons/`, an `IconButton` in `ViewControls.tsx` bound to the flag, tooltip worded as capture-only, and the *captured — Esc to release* pill driven from `AppState` like `RecordingStateOverlay`. | jsdom: the button reflects the flag; clicking it while released asks for the lock |
| **3** ✅ | **Indicator pointer** (§3.1.3) — own `pointer-events: none` layer in `.display`, centred on capture, moved by the scaled deltas, clamped, dropped on release; button-held styling. Gated on the `show pointer` setting from step 1. | jsdom: centred on capture; clamps at the rectangle's edges; hidden when released |
| **4** ✅ | **Machine ▸ Mouse menu** — `zx-next-input-menus.ts`, registered in `MI_ZXNEXT.machineItems`: capture on/off, show pointer, sensitivity. The only way to arm the feature; it cannot perform the capture itself (§3.1). | menu-renderer assertions: the checkbox writes the setting, the rest grey out while capture is off |
| **5** ✅ | `setJoystickState` / `mousePacket` on `ZxNextWasmV2Machine` via the neutral `IZxNextHostInputMachine` (+ the TS machine's forwarders) | `test/zxnext-hw/joystick/` and `mouse/` already prove the core; add one harness self-test that the *machine method* reaches it — see §7 |
| **6** ✅ | **Feed the machine**: the accumulate-and-chunk flush from §3.2 replaces step 1's discard — ±63 chunking, Y inversion, sensitivity remainder | jsdom: 200 px of movement in one frame emits ≥4 packets, all within ±63, summing to 200 |
| **7** ✅ | Mouse buttons (immediate zero-motion packet), wheel notches, `contextmenu` suppression, and the release packet (§3.1.1) | jsdom |
| **8** ✅ | Mouse-port read counter in the core + export; the indicator auto-hides while an app is consuming (§3.1.3) | harness: the counter rises after a program reads `$FBDF`, and not otherwise |
| **9** ✅ | `@common/settings/joystick-bindings.ts`: pin names, defaults, `normalize*`, the key→pin lookup, and the setting | plain vitest; round-trip through `appSettings` |
| **10** ✅ | `useEmulatorJoystick` — both connectors, blur/stop/dialog clearing | jsdom: keydown/keyup → the right bits on the right side; blur clears |
| **11** ✅ | `claimedCodes` arbitration in `useEmulatorKeyboard`; hooks mounted in order in `EmulatorPanel` | jsdom: a bound arrow does **not** call `setKeyStatus`; an unbound one still does |
| **12** ✅ | Gamepad polling into the same connector word | jsdom with a fake `getGamepads` |
| **13** ✅ | **Joystick** menu: source per connector, NextReg `$05` mode, and the bindings dialog | menu-renderer output assertions |
| **14** ✅ | Bindings dialog — **plain pattern, not MVC** (§5.1): the rules are pure functions, so there is no orchestration to isolate | the rules in the `node` project; capture and save rendered |
| 15 | End-to-end by hand — §7.2 | — |

---

## 7. Testing

### 7.1 The core is done; test the *path*

Do not re-test the hardware. `test/zxnext-hw/joystick/joystick.test.ts` and
`test/zxnext-hw/mouse/mouse.test.ts` already assert the behaviour against the VHDL, and per
`AGENTS.md` new Next-device tests belong in that harness, not in `test/zxnext/`. The mock tests the
old plan wanted to extend (`test/zxnext/KempstonJoystick.test.ts`, `KempstonMouse.test.ts`) were
deleted when those were written.

What is *not* covered is the new code: the machine wrapper methods, the accumulate-and-chunk
arithmetic, the binding tables and the arbitration. Test those.

For step 1, the harness's own rule applies — a test needing something new asks `session.ts` for it
rather than reaching into `s.machine` (`test/harness/zxnext/README.md`, "Adding a method"). The
exports are already reachable; what is worth one self-test in
`test/harness/zxnext/self-tests/session.test.ts` is that the *machine-level* method moves the same
counters the harness's `mouse()` does, so the two paths cannot drift.

### 7.2 Hands-on checklist

**After Milestone A (steps 1-4), with the machine still unwired.** Everything here is checkable
before a single packet exists, which is the point of ordering it this way:

- **Machine ▸ Mouse ▸ Capture the mouse.** Until this is ticked the toolbar button is greyed out
  and Ctrl+M does nothing - that is the intended default.
- Press the toolbar button: cursor vanishes, the pill says *captured — Esc to release*, the button
  lights, the indicator appears centred on the Next's screen.
- Move the mouse in circles: the indicator follows and stops at the screen edges rather than
  escaping the panel. Push hard into a corner and back out — it must come straight back, not lag by
  the distance you overshot.
- Press Esc: cursor returns, pill and indicator disappear, button unlights.
- **Press Esc and reach straight back for the toolbar button.** Nothing should happen the first
  time — verify the pill says *try again in a moment* rather than the app looking dead. A second
  press captures.
- `Ctrl+M` captures and releases; Alt-Tab away while captured releases cleanly.
- Confirm the indicator never swallows a click on the screen (that is the `pointer-events: none`
  layer) and that the keyboard still reaches the emulator while captured.

**After the machine is wired (step 5 onwards):**

- Bind arrows, set joy 1 to Kempston 1, run something that polls `$1F`.
- Switch joy 1 to Sinclair 2 **without touching the host bindings** — a game prompting "1=left"
  must respond to the same arrow keys. This is the check that proves §1.2; if it fails, the renderer
  is pressing keys it should not.
- Switch to Cursor, then to user-defined after a program programs the joymap.
- Capture the mouse and drag fast across the whole window: motion must stay smooth and directionally
  correct, with no jumps backwards — that is the ±63 chunking working.
- Set NR `$0A` DPI to `00` from a test program and repeat the fast drag.
- Toggle NR `$83` bit 5 off: the pointer freezes, `$DF` becomes Kempston joystick 1, and turning it
  back on resumes from the counters' current value, not from zero.
- Alt-Tab away mid-press: no stuck direction on return.

---

## 8. Out of scope

- **MD 6-button Select multiplexing.** The core reports X/Y/Z/MODE through NR `$B2`
  (`zxnext-input.c:101-105`) and does not multiplex `$1F`; JOY-005 covers what exists. Research the
  TBBlue pad spec before changing anything.
- **UART on the joystick port** (NR `$0B` bits below 7). The core honours only bit 7, the I/O-mode
  flag (`zxnext-input.c:39`).
- Gamepad rumble; touch / on-screen joystick; per-project binding profiles.
- **Soft/hard mouse reset** — no longer an open question: the core keeps the counters across a Next
  reset and clears them only on power-on, which is what the hardware does (MOU-001).
