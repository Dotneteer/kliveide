# ZX Spectrum Next Emulator — Performance Improvement Plan

Each step below is self-contained and can be applied independently. Steps are ranked by
estimated impact on per-frame throughput; highest-impact items come first.

---

## Tier 1 — Hot-Path Optimizations (per-tact / per-instruction level)

### 1. Optimize `Z80NCpu.tactPlusN()` — eliminate per-tact `onTactIncremented()` overhead
**Files:** `z80/Z80NCpu.ts`, `machines/zxNext/ZxNextMachine.ts`

`tactPlusN()` is called hundreds of times per instruction. Every call:
- multiplies `n * this.cpuTactScale`,
- checks frame boundary,
- calls `Math.floor` / bitwise shift for `currentFrameTact`,
- calls `onTactIncremented()` which enters a while-loop, performs integer division
  and modulo for the copper, calls `renderTact()`, and invokes 4 audio device methods.

**Changes:**
- Cache `cpuTactScale` in a local before multi-tact instruction sequences.
- In `onTactIncremented()`, pre-compute `1/totalHC` at frame start and use multiplication
  + bitwise truncation instead of division/modulo for the copper line/column.
- Cache `this.composedScreenDevice.config.totalHC` as a field updated on frame init.
- Cache the four audio device references (`turboSoundDevice`, `dacDevice`,
  `audioMixerDevice`, `beeperDevice`) as direct fields on the machine, set once in the
  constructor or `reset()`, instead of calling getter chains every tact.

---

### 2. Batch `tactPlusN(1)` sequences in `Z80Cpu` contention helpers
**Files:** `z80/Z80Cpu.ts`

`tactPlus4WithAddress`, `tactPlus5WithAddress`, `tactPlus7WithAddress` each call
`tactPlusN(1)` and `delayAddressBusAccess()` N times in a loop-unrolled fashion.
On the ZX Next, `delayedAddressBus` is always `false`, so the Z80NCpu overrides
already collapse to a single `tactPlusN(N)` — **no change needed for the Next path**.
However, for the base `Z80Cpu` used by Spectrum 48/128: cache `this.delayedAddressBus`
in a local at the top of each method, and consider batching when contention is off.

*(Lower priority for Next-only work; included for completeness.)*

---

### 3. Replace tilemap `applyTileTransformation()` object return with output parameters
**Files:** `machines/zxNext/screen/NextComposedScreenDevice.ts`

`fetchTilemapPattern()` calls `applyTileTransformation()` 8 times per tile per
scanline, and each call returns `{ transformedX, transformedY }` — a fresh object.
With ~8 000 tiles per frame this creates ~64 000 short-lived objects.

**Change:** Use two pre-allocated instance fields (e.g. `_txX` / `_txY`) or return a
packed integer `(transformedX << 16) | transformedY` to eliminate the allocation.

---

### 4. Pre-compute bit-unpack table for tilemap pattern bytes
**Files:** `machines/zxNext/screen/NextComposedScreenDevice.ts`

`fetchTilemapPattern()` in text mode unpacks a byte into 8 single-bit values with 8
shift-and-mask operations. Replace with a static `PATTERN_UNPACK: Uint8Array[]` table
(256 × 8 = 2 KB) indexed by the pattern byte, so one array copy replaces 8 bitwise ops.

---

### 5. Expand tilemap palette cache from 1 entry to 16
**Files:** `machines/zxNext/screen/NextComposedScreenDevice.ts`

The tilemap renderer has a 1-entry palette cache (`tilemapLastPaletteIndex` /
`tilemapCachedRgb333`). For tiles that alternate even two colors this produces ~50 %
miss rate. Use a small direct-mapped cache (e.g. 16 entries, index = paletteIndex & 0xF)
to reduce `getTilemapRgb333()` calls dramatically.

---

### 6. Hoist per-pixel conditionals to tile boundaries in tilemap rendering
**Files:** `machines/zxNext/screen/NextComposedScreenDevice.ts`

`renderTilemap_40x32Pixel()` checks `tilemapTextModeSampled` and the active buffer
pointer on every pixel, but these only change at tile boundaries.
Hoist the branch outside the 8-pixel tile loop and use two separate inner loops (text
mode vs. graphic mode) to eliminate per-pixel branch mispredictions.

---

### 7. Pre-calculate copper line/column at scanline boundaries
**Files:** `machines/zxNext/ZxNextMachine.ts`, `machines/zxNext/CopperDevice.ts`

In `onTactIncremented()` the copper tick receives `(tact / totalHC) | 0` and
`tact % totalHC`. Because rendering proceeds left-to-right, maintain an incrementing
`currentColumn` counter reset at each new line, avoiding the division/modulo entirely.

---

### 8. Cache device references on the machine instead of getter chains
**Files:** `machines/zxNext/ZxNextMachine.ts`

`afterInstructionExecuted()` and `onTactIncremented()` both call
`this.audioControlDevice.getTurboSoundDevice()`, `.getDacDevice()`, and
`.getAudioMixerDevice()` every instruction/tact. Store these as direct fields
(e.g. `this._turboSound`, `this._dac`, `this._audioMixer`) set once during init,
and reference them directly.

---

## Tier 2 — Per-Frame / Per-Instruction Optimizations

### 9. Replace event queue `splice` / `shift` with a ring buffer
**Files:** `machines/Z80MachineBase.ts` (and `machines/zxNext/Z80NMachineBase.ts`)

`queueEvent()` does a linear scan + `splice()` (O(n) insert).
`consumeEvents()` does `shift()` (O(n) per element).

Replace with a fixed-capacity ring buffer (pre-allocated array + head/tail indices).
Events are already consumed in tact order, so a simple FIFO suffices. If sorted
insertion is still needed, use binary search for the insert index.

---

### 10. Eliminate `LiteEvent.fire()` array copy
**Files:** `utils/lite-event.ts`

`fire()` calls `this._handlers.slice(0).forEach(...)`, creating a new array on every
event. Replace with a simple `for` loop over the original array. If handler removal
during iteration is a concern, iterate in reverse.

Also: `off()` uses `filter()` which allocates a new array. Replace with `splice()` on
the found index.

---

### 11. Pre-allocate audio sample buffers instead of per-frame allocation
**Files:** `machines/zxNext/ZxNextMachine.ts`, `machines/AudioDeviceBase.ts`

`getAudioSamples()` creates a new `AudioSample[]` array and pushes ~800 objects every
frame. Pre-allocate a reusable `Float32Array` (or a pair of left/right arrays) at frame
start and fill it in-place. Return a view/slice instead of allocating fresh objects.

---

### 12. Cache `isPortGroupEnabled` result as a bitmask
**Files:** `machines/zxNext/io-ports/NextIoPortManager.ts`, `machines/zxNext/NextRegDevice.ts`

Every gated IO port read/write calls `machine.nextRegDevice.isPortGroupEnabled(ri, bit)`,
which involves a register read + bit test. Pre-compute a single `portGroupEnabledMask`
integer updated only when the relevant NextRegs change, and test against it in the gate
wrappers.

---

### 13. Remove `typeof` check from hot IO `readPort` path
**Files:** `machines/zxNext/io-ports/NextIoPortManager.ts`

`readPort()` calls `typeof value === "number"` on every port read. Normalise all reader
functions to return a uniform type (always object, or always number) so the branch and
type check can be removed.

---

### 14. Eliminate redundant memory-read tracking conditional in hot path
**Files:** `z80/Z80Cpu.ts`

Every `readMemory()` call checks `if (this.lastMemoryReadsCount < 8)` to log the
address for debugging. This check runs on every memory read (the most frequent CPU
operation). Guard the entire tracking block behind a single `if (this.traceEnabled)`
flag, or compile it out in release builds.

---

### 15. Use lookup table for `mirrorA()` in Z80NCpu
**Files:** `z80/Z80NCpu.ts`

The `MIRROR` / `mirrorA` instruction reverses the bits of the A register using an
8-iteration loop. Replace with a 256-entry pre-computed lookup table (same pattern
already used for ALU flag tables).

---

## Tier 3 — Initialization & Structural Improvements

### 16. Skip bitmap clear (`fill(0)`) on new frame
**Files:** `machines/zxNext/screen/NextComposedScreenDevice.ts`

`initializeBitmap()` fills the entire pixel buffer with zeroes every frame. Since every
visible pixel is overwritten by the rendering pass, this fill is unnecessary and wastes
a SIMD-width memset over ~800 KB.

---

### 17. Lazy-init Layer 2 read/write maps
**Files:** `machines/zxNext/MemoryDevice.ts`

`_layer2ReadMap` and `_layer2WriteMap` (two 64 K-entry `Int32Array`s) are allocated
unconditionally at construction. Defer allocation until Layer 2 is first enabled.

---

### 18. Optimize IO port registration to avoid 65 536-iteration loops
**Files:** `machines/zxNext/io-ports/NextIoPortManager.ts`

`registerPort()` iterates all 65 536 port addresses for each descriptor (~80
descriptors → 5.2 M iterations at startup). Compute the set of matching ports
analytically from the mask/value pair instead. Also: mutate descriptors in-place
instead of spreading `{ ...mapping }` on collision.

*(Startup-only cost, but can shave 50–100 ms off machine creation.)*

---

### 19. Cache keyboard NextReg values on key-state change
**Files:** `machines/zxNext/NextKeyboardDevice.ts`

`nextRegB0Value` / `nextRegB1Value` / `nextRegB2Value` each compute 8 ternary
conditionals every time they are read. Cache the computed byte and invalidate it only
when a key state actually changes.

---

### 20. Replace SD card dual-field duplication with card array
**Files:** `machines/zxNext/SdCardDevice.ts`

Every state field is duplicated with a `1` suffix for the second card.
Extract an inner `SdCardState` object and use `[card0, card1]`.
Reduces memory footprint ~30 % and simplifies maintenance.

*(Structural improvement, not a direct hot-path gain.)*

---

### 21. Use power-of-2 bitmask for UART FIFO wrap
**Files:** `machines/zxNext/UartDevice.ts`

FIFO sizes are already powers of 2 (512, 64). Replace
`this.writePtr = (this.writePtr + 1) % this.capacity` with
`this.writePtr = (this.writePtr + 1) & (this.capacity - 1)`.

---

### 22. Pre-compute CRC7/CRC16 lookup tables
**Files:** `utils/crc.ts`

`calculateCRC7()` and `calculateCRC16()` use inner 8-bit loops per byte.
Replace with standard 256-entry lookup tables (computed once at module load)
to reduce from O(8n) to O(n).

---

### 23. Remove dead code in `_writeSlot0Simple` Layer 2 check
**Files:** `machines/zxNext/MemoryDevice.ts`

`_writeSlot0Simple()` computes `activeBank` but never uses it.
Remove the dead code branch.

---

## Summary Table

| # | Area | Estimated Impact | Complexity | Status |
|---|------|-----------------|------------|--------|
| 1 | CPU `tactPlusN` / `onTactIncremented` | Very High | Medium | ✅ Done |
| 2 | CPU contention batching | Medium | Low | N/A (Next path already optimal) |
| 3 | Tilemap object allocation | High | Low | ✅ Done |
| 4 | Tilemap pattern unpack table | Medium | Low | ✅ Done |
| 5 | Tilemap palette cache | Medium | Low | ✅ Done |
| 6 | Tilemap branch hoisting | Medium | Medium | N/A (fast path already exists) |
| 7 | Copper div/mod removal | Medium | Low | ✅ Done (part of #1) |
| 8 | Device getter caching | High | Low | ✅ Done (part of #1) |
| 9 | Event queue ring buffer | High | Medium | ✅ Done |
| 10 | LiteEvent allocation removal | Medium | Low | ✅ Done |
| 11 | Audio sample pre-allocation | Medium | Medium | ✅ Done |
| 12 | Port group enable cache | Medium | Low | ✅ Done |
| 13 | IO readPort typeof removal | Medium | Low | ✅ Done |
| 14 | Memory-read tracking guard | Low–Medium | Low | ✅ Done |
| 15 | mirrorA lookup table | Low | Low | ✅ Done |
| 16 | Skip frame bitmap clear | Low | Low | N/A (already conditional) |
| 17 | Lazy Layer 2 maps | Low | Low | ✅ Done |
| 18 | Port registration optimization | Low (startup) | Medium | ✅ Done |
| 19 | Keyboard reg caching | Low | Low | N/A (*Pressed fields never set to true) |
| 20 | SD card field dedup | Low (structural) | Medium | Skipped (no perf gain) |
| 21 | UART FIFO bitmask | Negligible | Trivial | ✅ Done |
| 22 | CRC lookup tables | Low | Low | ✅ Done |
| 23 | Dead code removal | Negligible | Trivial | ✅ Done |
