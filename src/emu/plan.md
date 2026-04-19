# ZX Next Clock System — Simplification Plan

## Current Architecture

### Clock Domains

The ZX Next has four clock rates, all derived from a 28 MHz master:

| Label   | Frequency  | `clockMultiplier` | Use                         |
|---------|------------|--------------------|-----------------------------|
| CLK_CPU | 3.5 MHz    | 1                  | Default Z80 speed           |
| CLK_7   | 7 MHz      | 2                  | Screen rendering, copper    |
| CLK_14  | 14 MHz     | 4                  | Turbo CPU                   |
| CLK_28  | 28 MHz     | 8                  | Max CPU, CTC system clock   |

### How `tacts` Works Today

The CPU's `tacts` counter runs at the **current CPU speed** (variable). A single Z80 T-state always increments `tacts` by 1, regardless of whether the CPU is at 3.5 or 28 MHz.

**Z80Cpu base `tactPlusN`** (overridden by Z80NCpu):
```ts
// Z80Cpu.ts — base version (used by Spectrum 48K/128K, not Next)
tactPlusN(n: number): void {
  this.tacts += n;
  this.frameTacts += n;
  if (this.frameTacts >= this.tactsInCurrentFrame) { ... }
  this.currentFrameTact = Math.floor(this.frameTacts / this.clockMultiplier);
  this.onTactIncremented();
}
```

**Z80NCpu `tactPlusN`** (the actual hot path for Next):
```ts
// Z80NCpu.ts — optimized override
tactPlusN(n: number): void {
  this.tacts += n;
  // Cache 2/clockMultiplier to avoid division
  if (mult !== this.lastClockMultiplier) {
    this.frameTactsMultiplier = 2 / mult;
  }
  this.frameTacts += n * this.frameTactsMultiplier;  // → CLK_7 screen tacts
  if (this.frameTacts >= this.tactsInFrame) { ... }
  this.currentFrameTact = this.frameTacts | 0;
  this.onTactIncremented();
}
```

### The Conversion Mess

Every device that cares about real time must convert from CPU tacts:

| Device         | Clock Domain | Conversion in `onTactIncremented()`                                |
|----------------|--------------|---------------------------------------------------------------------|
| Screen/Copper  | CLK_7        | `currentFrameTact` (pre-converted via `frameTactsMultiplier`)       |
| CTC            | 28 MHz       | `tactsDelta * (8 / clockMultiplier)`                                |
| Beeper         | CPU tacts    | `machine.tacts` directly, `_audioSampleLength * clockMultiplier`    |
| TurboSound PSG | CPU tacts    | `machine.tacts` directly, `_audioSampleLength * clockMultiplier`    |
| Audio Mixer    | —            | Stateless, called on demand                                        |
| DMA            | CPU tacts    | `stepDma()` returns T-states, fed to `tactPlusN()`                  |
| ULA            | CPU tacts    | `machine.tacts` directly for EAR charge timing                      |

### Key Fields Involved

| Field                    | Domain      | Purpose                                              |
|--------------------------|-------------|------------------------------------------------------|
| `tacts`                  | CPU speed   | Total T-states since reset (variable rate)            |
| `frameTacts`             | CLK_7       | Screen tacts within current frame (Z80NCpu version)   |
| `currentFrameTact`       | CLK_7       | Integer version of `frameTacts`                       |
| `tactsInFrame`           | CLK_7       | Screen tacts per frame (e.g. 141,816 at 50 Hz)       |
| `tactsInFrame28`         | 28 MHz      | 28 MHz ticks per frame = `tactsInFrame * 4`           |
| `tactsInCurrentFrame`    | CPU speed   | CPU tacts per frame = `tactsInFrame * clockMultiplier`|
| `clockMultiplier`        | —           | 1, 2, 4, or 8                                        |
| `frameTactsMultiplier`   | —           | `2 / clockMultiplier` (cached)                        |
| `ctcSystemClock`         | 28 MHz      | Accumulated 28 MHz ticks for CTC                      |
| `_lastCtcTacts`          | CPU speed   | Last `tacts` value when CTC was updated               |
| `_audioSampleLength`     | CPU tacts   | Base sample interval (3.5M / sampleRate)              |
| `_audioNextSampleTact`   | CPU tacts   | Next sample trigger point (adjusted by multiplier)    |

### What Makes It Complex

1. **`tacts` has variable semantics** — 1 tact = 1/3.5M sec at 3.5 MHz, 1/28M sec at 28 MHz. Every consumer must know the current `clockMultiplier` to interpret `tacts`.

2. **Three frame-tact representations** — `frameTacts` (CLK_7), `tactsInCurrentFrame` (CPU speed), `tactsInFrame28` (28 MHz). All track the same physical progress through a frame.

3. **Per-tact conversions in the hot path** — `tactPlusN` multiplies by `frameTactsMultiplier` every call. `onTactIncremented` converts CPU→28 MHz for CTC.

4. **Audio sample interval changes with speed** — `_audioNextSampleTact += length * clockMultiplier` must compensate because `tacts` changes rate.

5. **`tactsInCurrentFrame` must be recalculated on speed change** — The MachineFrameRunner does `tactsInCurrentFrame = tactsInFrame * clockMultiplier` at frame boundaries.

---

## Chosen Approach: 28 MHz Internal Frame Counter (tacts unchanged)

**Core idea:** Keep `tacts` as Z80 T-states (speed-independent, all existing tests pass).
Move `frameTacts` and `tactsInFrame` to the 28 MHz domain so that the frame-completion
check, screen rendering, CTC, and audio all share a single clock base. Introduce
`cpuTactScale` (8/4/2/1) to convert T-states → 28 MHz ticks inside `tactPlusN`.

**Key invariant:** `tacts` always equals the sum of Z80 T-states consumed, regardless of
CPU speed. A NOP always costs 4 T-states whether the CPU runs at 3.5 MHz or 28 MHz.

#### Changes

**`tactPlusN` becomes:**
```ts
tactPlusN(n: number): void {
  this.tacts += n;                              // Z80 T-states (unchanged)
  const ticks28 = n * this.cpuTactScale;        // 28 MHz ticks for frame tracking
  this.frameTacts += ticks28;
  if (this.frameTacts >= this.tactsInFrame) {
    this.frames++;
    this.frameTacts -= this.tactsInFrame;
    this.frameCompleted = true;
  }
  this.currentFrameTact = (this.frameTacts >>> 2) | 0;  // ÷4 for CLK_7
  this.onTactIncremented();
}
```

**`onTactIncremented` simplifies to:**
```ts
onTactIncremented(): void {
  if (this.frameCompleted) return;

  // Screen & copper — currentFrameTact already in CLK_7
  while (this.lastRenderedFrameTact < this.currentFrameTact) {
    const tact = this.lastRenderedFrameTact;
    this.copperDevice.executeTick((tact / totalHC) | 0, tact % totalHC);
    this.composedScreenDevice.renderTact(this.lastRenderedFrameTact++);
  }
  this.beeperDevice.setNextAudioSample();

  // CTC — use frameTacts as the 28 MHz system clock directly
  this.ctcDevice.advanceToSysClock(this.frameTacts);

  // Audio — fixed sample interval in 28 MHz ticks, no clockMultiplier adjustment
  this.audioControlDevice.getTurboSoundDevice().setNextAudioSample(this.frameTacts);
  this.audioControlDevice.getDacDevice().setNextAudioSample();
  this.audioControlDevice.getAudioMixerDevice().setNextAudioSample();
}
```

**Fields eliminated or simplified:**
- `ctcSystemClock` → eliminated (use `frameTacts` directly)
- `_lastCtcTacts` → eliminated
- `tactsInCurrentFrame` → eliminated (frame boundary is fixed `tactsInFrame`)
- `frameTactsMultiplier` → eliminated (Step 2)
- `lastClockMultiplier` → eliminated (Step 2)
- `tactsInFrame28` → eliminated (now `tactsInFrame` IS 28 MHz)
- Audio `* clockMultiplier` adjustments → eliminated

**New/changed fields:**
- `cpuTactScale`: 8 (3.5 MHz), 4 (7 MHz), 2 (14 MHz), 1 (28 MHz)
- `tactsInFrame` = totalHC × totalVC × 4 (28 MHz ticks per frame, e.g. 567,264)
- `baseClockFrequency` = 28,000,000
- `frameTactMultiplier` = 1

**`tacts` is NOT changed:**
- All existing test expectations on `cpu.tacts` remain valid
- `tacts` still counts Z80 T-states: NOP = 4, LD A,n = 7, etc.
- Debugger/UI shows T-states directly (no conversion needed)

**`CpuSpeedDevice`:**
```ts
get effectiveCpuTactScale(): number {
  return 8 >>> this._effectiveSpeed;  // speed 0→8, 1→4, 2→2, 3→1
}
```

**Audio devices:**
```ts
// TurboSoundDevice / BeeperDevice
setAudioSampleRate(sampleRate: number): void {
  this._audioSampleLength = 28_000_000 / sampleRate;  // fixed, ~583 ticks at 48kHz
}
setNextAudioSample(frameTacts28: number): void {
  if (frameTacts28 <= this._audioNextSampleTact) return;
  // ... generate sample ...
  this._audioNextSampleTact += this._audioSampleLength;  // no multiplier needed
}
```

**DMA device:**
```ts
// stepDma() returns Z80 T-states → tactPlusN handles the scaling automatically
```

#### Impact Summary

| Aspect                      | Before                                    | After                         |
|-----------------------------|-------------------------------------------|-------------------------------|
| `tacts` meaning             | Z80 T-states                              | Z80 T-states (unchanged!)     |
| `frameTacts` meaning        | CLK_7 screen tacts                        | 28 MHz ticks                  |
| Frame boundary check        | `frameTacts >= tactsInFrame * mult`        | `frameTacts >= tactsInFrame`   |
| CTC clock derivation        | `delta * (8 / clockMultiplier)`            | `frameTacts` directly         |
| Screen tact derivation      | `frameTacts * (2 / clockMultiplier)`       | `frameTacts >>> 2`            |
| Audio sample interval       | `length * clockMultiplier`                 | `length` (fixed)              |
| Speed change at frame start | Recalculate `tactsInCurrentFrame`          | Just update `cpuTactScale`    |
| Fields to track             | 7+ clock-related fields                   | 3 (`tacts`, `frameTacts`, `cpuTactScale`) |
| Existing test changes       | Many (tacts values multiplied by 8)       | **None** — only new tests     |

#### Tradeoffs

**Pros:**
- One clock domain for frame tracking, CTC, and audio — 28 MHz
- CTC becomes trivial (direct `frameTacts` usage)
- Audio sample timing is constant regardless of speed
- No per-speed recalculations at frame boundaries
- `tactPlusN` is a simple multiply-and-add with a right-shift for screen tacts
- Frame boundary is a single fixed comparison
- **All existing unit tests pass unchanged**

**Cons:**
- Two counters in `tactPlusN`: `tacts` (T-states) and `frameTacts` (28 MHz)
- Code that needs wall-clock time must use `frameTacts` or `tacts * cpuTactScale`, not `tacts` alone
- The Z80Cpu base class shared with Spectrum 48K/128K machines needs care — either the base class becomes speed-aware, or Z80NCpu fully owns its `tactPlusN` (it already overrides it)
- DMA T-state return values need scaling (but `tactPlusN` does this automatically)
- Slight semantic adjustment: a "NOP at 3.5 MHz" costs 32 ticks, not 4

#### Risk Assessment: **Medium**
The Z80NCpu already fully overrides `tactPlusN`, so the base Z80Cpu is unaffected. The main risk is adapting all consumers of `tacts` (debugger, breakpoints, CPU state display) to understand 28 MHz ticks.

---


Searched all files under `src/renderer/` for references to `tacts`, `clockMultiplier`,
`baseClockFrequency`, `tactsInFrame`, `frameTactMultiplier`, `currentFrameTact`,
`ctcSystemClock`, `tactsAtLastStart`, and `CpuState`/`CpuStateChunk` types.

### Affected Components

#### 1. EmuStatusBar — CPU Frequency Display
**File:** `src/renderer/appEmu/StatusBar/EmuStatusBar.tsx`

Current code:
```tsx
const clockMultiplier = useSelector(s => s.emulatorState.clockMultiplier);
// ...
setFreq(controller.machine.baseClockFrequency * clockMultiplier);
// ...
<Label text={`(${(freq / 1_000_000).toFixed(3)} MHz)`} />
```

**Impact:** Reads `clockMultiplier` from Redux and `baseClockFrequency` from machine.
**Option A change:** With `baseClockFrequency = 28_000_000` and no `clockMultiplier`,
frequency is always 28 MHz. Instead, display the effective CPU speed:
```tsx
// cpuTactScale: 8=3.5MHz, 4=7MHz, 2=14MHz, 1=28MHz
const freq = 28_000_000 / cpuTactScale;
```
The Redux `clockMultiplier` state can be replaced with `cpuTactScale` (or we derive
the display frequency from `cpuTactScale`). **Straightforward change.**

#### 2. Z80CpuPanel — CLK and TSP Display
**File:** `src/renderer/appIde/SiteBarPanels/Z80CpuPanel.tsx`

Current code:
```tsx
<SimpleValue label="CLK" value={cpuState?.tacts ?? 0} tooltip="Current CPU clock" />
<SimpleValue label="TSP" value={(cpuState?.tacts ?? 0) - (cpuState?.tactsAtLastStart ?? 0)}
             tooltip="T-States since last start after pause" />
```

**Impact:** Displays raw `tacts` and `tacts - tactsAtLastStart`.
**Option A change:** Under Option A, `tacts` is in 28 MHz ticks. To show Z80 T-states:
```tsx
// getCpuState() returns cpuTStates = tacts / cpuTactScale (pre-computed on the emu side)
<SimpleValue label="CLK" value={cpuState?.tacts ?? 0} tooltip="Current 28 MHz clock" />
<SimpleValue label="TSP" value={(cpuState?.tacts ?? 0) - (cpuState?.tactsAtLastStart ?? 0)} />
```
**Two options:**
- **(a)** Keep displaying 28 MHz ticks (CLK = absolute system clock). Simpler.
- **(b)** Add a `cpuTStates` field to `CpuState` that pre-divides on the emu side.
  Then show `cpuTStates` for "CPU T-States" and `tacts` for "System Clock".
  
Either way, the panel itself is just displaying numbers — no formula change needed
in the component, only in what `getCpuState()` returns. **Straightforward change.**

#### 3. M6510CpuPanel — CLK and TSP Display
**File:** `src/renderer/appIde/SiteBarPanels/M6510CpuPanel.tsx`

Same pattern as Z80CpuPanel. **Not affected by ZX Next changes** (C64 machine does
not use Z80NCpu). No change needed.

#### 4. UlaPanel — Frame Clock / Raster / Pixel
**File:** `src/renderer/appEmu/MainToEmuProcessor.ts` (builds ULA state)

Current code:
```ts
fcl: machine.currentFrameTact ?? 0,
ras: Math.floor(machine.currentFrameTact / machine.screenWidthInPixels),
pos: machine.currentFrameTact % machine.screenWidthInPixels,
```

**Impact:** Uses `currentFrameTact` which is already in CLK_7 (screen tact) domain.
**Option A change:** `currentFrameTact` will still be in CLK_7 (`frameTacts >>> 2`),
so **no change needed** in MainToEmuProcessor or UlaPanel.

However, note: this code path uses `ZxSpectrumBase`, not `ZxNextMachine`. The Next
machine doesn't use this ULA state code. **No change needed.**

#### 5. EmulatorPanel — Audio Init and FPS Calculation
**File:** `src/renderer/appEmu/EmulatorArea/EmulatorPanel.tsx`

**Audio init:**
```tsx
await initAudio(ctrl.machine.tactsInFrame, ctrl.machine.baseClockFrequency, audioSampleRate);
```

**FPS calculation:**
```tsx
Math.round(
  (controller.machine.baseClockFrequency * controller.machine.frameTactMultiplier) /
    controller.machine.tactsInFrame / controller.machine.uiFrameFrequency
)
```

**Clock multiplier dispatch:**
```tsx
if (args.clockMultiplier) {
  store.dispatch(setClockMultiplierAction(args.clockMultiplier));
}
```

**Impact:** Three separate clock-related usages.
**Option A changes:**
- **Audio:** `tactsInFrame` becomes 28 MHz ticks, `baseClockFrequency` becomes 28 MHz.
  Formula `(tactsInFrame * audioSampleRate) / baseClockFrequency` is **still correct**
  because both numerator and denominator are in the same clock domain. **No change needed.**
- **FPS:** `frameTactMultiplier` can become 1 (since `tactsInFrame` is already in the
  master clock domain). Or the formula simplifies to `28_000_000 / tactsInFrame`.
  **Minor change: set `frameTactMultiplier = 1`** (or remove it).
- **Clock multiplier dispatch:** Replace with `cpuTactScale` dispatch, or derive the
  effective CPU speed from `cpuTactScale` on the emu side. **Straightforward change.**

#### 6. useEmulatorAudio — Samples Per Frame
**File:** `src/renderer/appEmu/EmulatorArea/useEmulatorAudio.ts`

```ts
const samplesPerFrame = (tactsInFrame * audioSampleRate) / baseClockFrequency;
```

**Impact:** Both `tactsInFrame` and `baseClockFrequency` shift to 28 MHz.
**Option A change:** Formula stays identical because `tactsInFrame / baseClockFrequency`
= frame duration in seconds, which is invariant. **No change needed.**

#### 7. MachineController — Frame Gap and Clock Multiplier Propagation
**File:** `src/emu/machines/MachineController.ts`

```ts
const nextFrameGap =
  (this.machine.tactsInFrame / this.machine.frameTactMultiplier /
    this.machine.baseClockFrequency) * 1000 * this.machine.uiFrameFrequency;
// ...
this.machine.targetClockMultiplier = store.getState()?.emulatorState?.clockMultiplier ?? 1;
// ...
clockMultiplier: this.machine.clockMultiplier
```

**Option A changes:**
- **Frame gap:** With `frameTactMultiplier = 1` and `baseClockFrequency = 28M`,
  simplifies to `tactsInFrame / 28_000_000 * 1000`. **Works correctly.**
- **targetClockMultiplier:** Replace with `targetCpuTactScale`. The Redux store
  dispatches cpuTactScale from the frame-completed callback. **Rename needed.**
- **FrameCompletedArgs:** Replace `clockMultiplier` with `cpuTactScale`. **Simple rename.**

#### 8. useStateRefresh — Change Detection via `tacts`
**File:** `src/renderer/appIde/useStateRefresh.ts`

```ts
this.oldState.tacts !== newState.tacts;
```

**Impact:** Uses `tacts` as a change-detection signal (did the machine advance?).
**Option A change:** `tacts` is still a monotonically increasing counter. Change
detection works identically. **No change needed.**

#### 9. Redux State & Actions
**Files:**
- `src/common/state/AppState.ts` — `clockMultiplier?: number` in `EmulatorState`
- `src/common/state/actions.ts` — `setClockMultiplierAction`
- `src/common/state/emulator-state-reducer.ts` — handles `clockMultiplier` payload

**Option A change:** Rename `clockMultiplier` → `cpuTactScale` throughout the Redux
store, actions, and reducer. Default value changes from `1` to `8` (3.5 MHz default).
**Mechanical rename.**

#### 10. Interface Definitions
**Files:**
- `src/renderer/abstractions/IAnyMachine.ts` — `targetClockMultiplier`, `frameTactMultiplier`
- `src/renderer/abstractions/IZxNextMachine.ts` — `ctcSystemClock`, `cpuSpeedDevice`
- `src/renderer/abstractions/IMachineController.ts` — `FrameCompletedArgs.clockMultiplier`

**Option A changes:**
- `targetClockMultiplier` → `targetCpuTactScale` (or keep generic name)
- `frameTactMultiplier` → set to `1` for Next (or remove; it becomes `1` for all 28 MHz machines)
- `ctcSystemClock` → remove from interface (no longer needed)
- `FrameCompletedArgs.clockMultiplier` → replace with `cpuTactScale`

#### 11. Disassembly T-states Display
**Files:**
- `src/renderer/appIde/disassemblers/z80-disassembler/z80-disassembler.ts`
- `src/renderer/appIde/DocumentPanels/DisassemblyPanel.tsx`
- `src/renderer/appIde/services/z80-tstates-data.ts`
- `src/renderer/appIde/services/z80-providers.ts`

**Impact:** These show per-instruction T-state counts (e.g., "NOP = 4 T-states").
**Option A change:** These are static instruction costs, not related to the machine's
`tacts` counter. **No change needed.**

#### 12. CpuState / CpuStateChunk Types
**File:** `src/common/messaging/EmuApi.ts`

```ts
type Z80CpuState = { tacts: number; tactsAtLastStart: number; ... };
type CpuStateChunk = { tacts: number; ... };
```

**Revised approach:** `tacts` stays as Z80 T-states. No change needed to `Z80CpuState` types.
The `tacts` field in CpuState/CpuStateChunk already represents T-states and remains valid.

### Summary: What Can Be Changed

| Component | Change Needed? | Difficulty | Notes |
|-----------|---------------|------------|-------|
| EmuStatusBar | Yes — frequency calc | Easy | `28M / cpuTactScale` instead of `baseClockFreq * clockMultiplier` |
| Z80CpuPanel | No | — | `tacts` still means T-states; no change |
| M6510CpuPanel | No | — | Not affected (C64 machine) |
| UlaPanel / MainToEmuProcessor | No | — | `currentFrameTact` stays CLK_7 |
| EmulatorPanel (audio init) | No | — | Formula still correct |
| EmulatorPanel (FPS calc) | Yes — `frameTactMultiplier` | Easy | Set to `1` or simplify formula |
| EmulatorPanel (clock dispatch) | Yes — rename field | Easy | `clockMultiplier` → `cpuTactScale` |
| useEmulatorAudio | No | — | Formula invariant |
| useStateRefresh | No | — | `tacts` still monotonic |
| Redux state/actions | Yes — rename | Mechanical | `clockMultiplier` → `cpuTactScale` |
| IAnyMachine interface | Yes — rename/simplify | Easy | `targetClockMultiplier`, `frameTactMultiplier` |
| IZxNextMachine interface | Yes — remove `ctcSystemClock` | Easy | Field eliminated |
| FrameCompletedArgs | Yes — rename field | Easy | `clockMultiplier` → `cpuTactScale` |
| CpuState types | Optional — add `cpuTStates` | Easy | Or just update tooltips |
| Disassembly T-states | No | — | Static per-instruction data |
| MachineController | Yes — rename + simplify | Easy | Frame gap formula, target speed |

**Conclusion:** All renderer components can be adapted. No blockers found.
Most changes are mechanical renames. `tacts` stays as Z80 T-states — no UI conversion
needed. The only visible change is the FPS formula simplification and speed display
using `cpuTactScale`.

---

## Files That Would Need Changes (Complete List)

### Engine (src/emu/)

| File | Change |
|------|--------|
| `z80/Z80NCpu.ts` | Rewrite `tactPlusN` (`frameTacts` in 28 MHz, `tacts` stays T-states), add `cpuTactScale`, remove `frameTactsMultiplier`/`lastClockMultiplier` |
| `machines/zxNext/Z80NMachineBase.ts` | Update `setTactsInFrame` (×4 for 28 MHz), remove `tactsInFrame28`, set `frameTactMultiplier=1` |
| `machines/zxNext/ZxNextMachine.ts` | Set `baseClockFrequency=28M`, simplify `onTactIncremented`, remove `ctcSystemClock`/`_lastCtcTacts`, update `beforeInstructionExecuted` |
| `machines/zxNext/CpuSpeedDevice.ts` | Emit `cpuTactScale` (8/4/2/1) alongside `effectiveClockMultiplier` |
| `machines/MachineFrameRunner.ts` | Replace `tactsInCurrentFrame` recalculation with `cpuTactScale` update |
| `machines/MachineController.ts` | Replace `targetClockMultiplier`/`clockMultiplier` with `cpuTactScale`, simplify frame gap |
| `machines/zxNext/CtcDevice.ts` | No change (called with `frameTacts` directly) |
| `machines/AudioDeviceBase.ts` (Beeper) | Use 28 MHz base for sample length, compare against `frameTacts` |
| `machines/zxNext/TurboSoundDevice.ts` | Use 28 MHz base for sample length, accept `frameTacts` param instead of `tacts`+`clockMultiplier` |
| `machines/zxNext/screen/NextComposedScreenDevice.ts` | No change (still passes CLK_7 to `setTactsInFrame`; conversion happens in Z80NMachineBase) |
| `machines/zxNext/DmaDevice.ts` | No internal change (T-states from `stepDma` flow through `tactPlusN` which scales them) |
| `machines/zxNext/UlaDevice.ts` | May need adjustment for EAR timing if it uses `tacts` |

### Renderer (src/renderer/)

| File | Change |
|------|--------|
| `appEmu/StatusBar/EmuStatusBar.tsx` | Use `cpuTactScale` to derive display frequency |
| `appEmu/EmulatorArea/EmulatorPanel.tsx` | Replace `clockMultiplier` dispatch with `cpuTactScale`; simplify FPS calc |
| `appIde/SiteBarPanels/Z80CpuPanel.tsx` | `tacts` already shows T-states (no conversion needed) |
| `appEmu/MainToEmuProcessor.ts` | Replace `clockMultiplier` in `getCpuStateChunk` (if exposed there) |

### Common (src/common/)

| File | Change |
|------|--------|
| `state/AppState.ts` | Rename `clockMultiplier` → `cpuTactScale`, default `8` |
| `state/actions.ts` | Rename `setClockMultiplierAction` → `setCpuTactScaleAction` |
| `state/emulator-state-reducer.ts` | Handle new action name |
| `messaging/EmuApi.ts` | No change — `tacts` in `CpuState` already means T-states |

### Abstractions (src/renderer/abstractions/)

| File | Change |
|------|--------|
| `IAnyMachine.ts` | Rename `targetClockMultiplier`; update `frameTactMultiplier` |
| `IZxNextMachine.ts` | Remove `ctcSystemClock` |
| `IMachineController.ts` | Rename `clockMultiplier` in `FrameCompletedArgs` |

---

## Step-by-Step Implementation Plan

The plan is organized so each step produces a testable, non-breaking checkpoint.
Steps 1–2 introduce `cpuTactScale` without changing behavior. Step 3 switches
`frameTacts`/`tactsInFrame` to 28 MHz. Steps 4–6 simplify dependent subsystems.
Steps 7–8 update the UI layer. **`tacts` stays as Z80 T-states throughout.**

### ~~Step 1: Add `cpuTactScale` alongside existing fields (no behavior change)~~ ✅ DONE

**Goal:** Introduce the new field without removing anything. All existing tests pass.

**Changes:**
1. `Z80NCpu.ts` — Add `cpuTactScale = 8` field (default = 8, meaning 3.5 MHz).
2. `CpuSpeedDevice.ts` — Add `effectiveCpuTactScale` getter: `8 >>> this._effectiveSpeed`.
3. `ZxNextMachine.ts` — In `beforeInstructionExecuted`, also set `this.cpuTactScale = this.cpuSpeedDevice.effectiveCpuTactScale`.

**Test:** Run existing test suite. All tests pass because nothing uses `cpuTactScale` yet.

### ~~Step 2: Refactor `tactPlusN` in Z80NCpu (behavior-preserving)~~ ✅ DONE

**Goal:** Rewrite `tactPlusN` to use `cpuTactScale` but produce **identical** results
by keeping `tacts` in the old CPU-speed domain (for now).

**Changes:**
1. `Z80NCpu.ts` — Refactor `tactPlusN` to compute screen tacts via `cpuTactScale`:
   ```ts
   tactPlusN(n: number): void {
     this.tacts += n;
     // cpuTactScale/4 gives the CLK_7 ratio: 8/4=2, 4/4=1, 2/4=0.5, 1/4=0.25
     this.frameTacts += n * this.cpuTactScale / 4;
     // ... rest unchanged
   }
   ```
   This is algebraically equivalent to `n * 2 / clockMultiplier` because
   `cpuTactScale = 8 / clockMultiplier` → `cpuTactScale / 4 = 2 / clockMultiplier`.
2. Remove `frameTactsMultiplier` and `lastClockMultiplier` fields.

**Test:** Run full test suite. Verify all Z80/ZxNext tests pass with identical results.

### ~~Step 3: Switch `frameTacts`/`tactsInFrame` to 28 MHz domain~~ ✅ DONE

**Goal:** `frameTacts` counts in 28 MHz ticks; `tacts` stays as Z80 T-states.
This is the core change. All existing tests pass because they check `tacts`, not `frameTacts`.

**Changes:**
1. `Z80NCpu.ts` — Rewrite `tactPlusN`:
   ```ts
   tactPlusN(n: number): void {
     this.tacts += n;                          // Z80 T-states (unchanged)
     const ticks28 = n * this.cpuTactScale;    // 28 MHz ticks
     this.frameTacts += ticks28;
     if (this.frameTacts >= this.tactsInFrame) { ... }
     this.currentFrameTact = (this.frameTacts >>> 2) | 0;  // back to CLK_7
     this.onTactIncremented();
   }
   ```
   Remove `tactsInFrame28` field (now redundant — `tactsInFrame` IS 28 MHz ticks).
2. `Z80NMachineBase.ts` — `setTactsInFrame(tacts)`:
   ```ts
   setTactsInFrame(tacts: number): void {
     // tacts arrives in CLK_7 from the screen device; multiply by 4 for 28 MHz
     super.setTactsInFrame(tacts * 4);
   }
   ```
3. `Z80NMachineBase.ts` — Set `frameTactMultiplier = 1`.
4. `ZxNextMachine.ts` constructor — Set `this.baseClockFrequency = 28_000_000`.
5. `CpuSpeedDevice.ts` — In `requestSpeedUpdate`, also sync `cpuTactScale` on the
   machine so that callers that set speed and immediately call timing methods see
   correct values without waiting for `beforeInstructionExecuted`.

**Test:** Run full test suite. All existing tests pass because `tacts` is unchanged.
Write a focused test: verify `frameTacts` = expected × `cpuTactScale` after a known
instruction sequence.

### Step 4: Simplify `onTactIncremented` and remove CTC conversion ✅

**Goal:** Eliminate `ctcSystemClock`, `_lastCtcTacts`, and all per-tact conversions.

**Changes:**
1. `ZxNextMachine.ts` — Simplify `onTactIncremented`:
   ```ts
   onTactIncremented(): void {
     if (this.frameCompleted) return;
     // Screen & copper (currentFrameTact already in CLK_7)
     while (this.lastRenderedFrameTact < this.currentFrameTact) { ... }
     this.beeperDevice.setNextAudioSample();
     // CTC — use frameTacts directly as 28 MHz system clock
     this.ctcDevice.advanceToSysClock(this.frameTacts);
     // Audio — fixed 28 MHz sample interval, no clockMultiplier param
     this.audioControlDevice.getTurboSoundDevice().setNextAudioSample(this.frameTacts);
     this.audioControlDevice.getDacDevice().setNextAudioSample();
     this.audioControlDevice.getAudioMixerDevice().setNextAudioSample();
   }
   ```
2. Remove `ctcSystemClock` and `_lastCtcTacts` fields from `ZxNextMachine`.
3. Remove `ctcSystemClock` from `IZxNextMachine` interface.
4. Update `reset()` to remove `ctcSystemClock`/`_lastCtcTacts` resets.

**Test:** Run CTC tests. Verify CTC channel advancement matches expected 28 MHz behavior.
All 18,221 tests pass.

### Step 5: Simplify audio devices ✅

**Goal:** Audio sample intervals become fixed (28 MHz based), no `clockMultiplier` compensation.

**Changes:**
1. `AudioDeviceBase.ts` (Beeper) — `setAudioSampleRate`:
   ```ts
   this._audioSampleLength = 28_000_000 / sampleRate;
   ```
   `setNextAudioSample()` — compare against `this.machine.frameTacts` (28 MHz).
2. `TurboSoundDevice.ts` — Same pattern. `setNextAudioSample(frameTacts28)` — remove
   `clockMultiplier` parameter. Sample length = `28_000_000 / sampleRate`.
   PSG clock divisor: PSG runs at 1.75 MHz = 28 MHz / 16, `_psgClockDivisor = 16` stays.
3. `ZxNextMachine.ts` — Update `afterInstructionExecuted` and `onTactIncremented` calls
   to pass `this.frameTacts` instead of `this.tacts` + `this.clockMultiplier`.

**Test:** Run audio tests. Verify sample generation rate matches expected 48 kHz output.
All 18,221 tests pass.

**Implementation notes (Steps 4+5):**
- `ctcSystemClock` and `_lastCtcTacts` removed from `ZxNextMachine` and `IZxNextMachine`.
- `CtcDevice._syncFromMachine()` now uses `this.machine.frameTacts` (28 MHz) directly.
- `TurboSoundDevice` constructor takes single `audioSampleRate` param (removed `baseClockFrequency`).
- `TurboSoundDevice.setAudioSampleRate()` uses `28_000_000 / sampleRate`.
- `TurboSoundDevice.setNextAudioSample(frameTacts28)` — single param, 28 MHz domain.
- `AudioDeviceBase` left unchanged (shared by non-Next machines, still works via `tacts`+`clockMultiplier`).
- `AudioControlDevice` constructor updated for single-arg `TurboSoundDevice(48_000)`.

### Step 6: Simplify MachineFrameRunner and MachineController ✅ (deferred renames)

**Goal:** Remove `tactsInCurrentFrame` recalculation, replace `clockMultiplier` flow.

**Changes:**
1. `MachineFrameRunner.ts` — Remove `tactsInCurrentFrame = tactsInFrame * clockMultiplier`
   on speed change. Frame boundary is now simply `frameTacts >= tactsInFrame` (fixed).
   Replace `targetClockMultiplier` with `targetCpuTactScale`.
2. `MachineController.ts` — Replace:
   - `targetClockMultiplier` → `targetCpuTactScale`
   - `clockMultiplier` in `FrameCompletedArgs` → `cpuTactScale`
   - Frame gap calculation: `tactsInFrame / baseClockFrequency * 1000` directly
     (no `frameTactMultiplier` division needed since both are 28 MHz).
3. `Z80Cpu.ts` — Mark `tactsInCurrentFrame` deprecated (keep for non-Next machines).
4. `IAnyMachine.ts` — Rename `targetClockMultiplier` → `targetCpuTactScale`.
5. `IMachineController.ts` — Rename `clockMultiplier` in `FrameCompletedArgs`.

**Test:** Run full machine frame tests. Verify frame timing, speed changes work correctly.

**Implementation notes (Step 6):**
- No functional changes needed. `Z80NCpu.tactPlusN` already handles frame boundary
  using `tactsInFrame` (28 MHz), making MachineFrameRunner's `tactsInCurrentFrame`
  recalculation harmless but unused for the Next path.
- Frame gap formula already works: `tactsInFrame / frameTactMultiplier / baseClockFrequency * 1000`.
- `targetClockMultiplier` → `targetCpuTactScale` rename deferred to Step 7
  (crosses `IAnyMachine` interface shared by all machines).

### Step 7: Update Redux state and renderer components

**Goal:** Propagate the rename through the UI layer.

**Changes:**
1. `src/common/state/AppState.ts` — Rename `clockMultiplier` → `cpuTactScale`, default `8`.
2. `src/common/state/actions.ts` — Rename `setClockMultiplierAction` → `setCpuTactScaleAction`.
3. `src/common/state/emulator-state-reducer.ts` — Handle new action name.
4. `src/renderer/appEmu/StatusBar/EmuStatusBar.tsx` — Read `cpuTactScale` from Redux,
   display `(28_000_000 / cpuTactScale / 1_000_000).toFixed(3)` MHz.
5. `src/renderer/appEmu/EmulatorArea/EmulatorPanel.tsx` — Dispatch `setCpuTactScaleAction`.
   Simplify FPS calc to `28_000_000 / tactsInFrame / uiFrameFrequency`.

**Automated test:** TypeScript compiler must report zero errors (`tsc --noEmit`).

**Manual test — Status bar frequency display:**
1. Start the ZX Next emulator (F5).
2. Status bar should read `(3.500 MHz)`.
3. Write `0x03` to NextReg `0x07` → `(28.000 MHz)`.
4. Write `0x02` → `(14.000 MHz)`. `0x01` → `(7.000 MHz)`. `0x00` → `(3.500 MHz)`.
5. Hard reset → `(3.500 MHz)`.

**Manual test — Speed change persists across pause/resume:**
1. Set speed to 14 MHz (NextReg 0x07 = 0x02).
2. Pause (F6). Status bar still shows `(14.000 MHz)`.
3. Resume (F5). Speed remains at 14 MHz.

### Step 8: Final cleanup

**Goal:** Remove remaining `clockMultiplier` references and update debug panel.

**Changes:**
1. `ZxNextMachine.ts` `getCpuState()` — `tacts` already shows Z80 T-states (no change).
2. `Z80CpuPanel.tsx` — Tooltip: "T-States" (it already is T-states, no conversion needed).
3. Remove any remaining references to `clockMultiplier` in comments/docs.
4. Remove `clockMultiplier` field from `Z80Cpu` if no other machine uses it, or mark
   deprecated for non-Next machines.

**Automated test:** Run `npm run test`. All existing tests pass. No new test expectations
needed beyond Steps 3–6.

**Manual test — Z80 CPU panel:**
1. Start the ZX Next emulator and open the Z80 CPU panel.
2. At 3.5 MHz, run a NOP; `tacts` increases by 4.
3. At 28 MHz, run a NOP; `tacts` still increases by 4.
4. Verify frame counter advances correctly at all four speeds.

**Manual test — CTC-driven audio (beeper timing):**
1. Load a ZX Next demo that plays beeper sound.
2. Verify audio sounds correct at 3.5 MHz.
3. Switch to 28 MHz — audio pitch and rhythm must remain identical.
4. Switch back to 3.5 MHz — no glitches or pitch shift.

---

### Step Dependency Graph

```
Step 1 (add cpuTactScale) ✅
  └── Step 2 (refactor tactPlusN, behavior-preserving) ✅
        └── Step 3 (switch frameTacts/tactsInFrame to 28 MHz) ◄── core change
              ├── Step 4 (simplify onTactIncremented, CTC) ✅
              ├── Step 5 (simplify audio devices) ✅
              └── Step 6 (simplify frame runner, controller) ✅ (deferred renames)
                    └── Step 7 (Redux + renderer updates)
                          └── Step 8 (final cleanup)
```
                          └── Step 8 (CPU state types, final cleanup)
```

Steps 4, 5, and 6 can be done in parallel after Step 3.
Steps 7 and 8 depend on Step 6 (for the renamed Redux actions).
