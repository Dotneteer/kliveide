# ULA Contention: MAME vs Klive Discrepancy Report

This document compares the ZX Spectrum ULA contention implementation in MAME (`_input/src/mame/sinclair/spectrum_ula.cpp`) against Klive (`src/emu/machines/ZxSpectrumBase.ts` and derived classes), identifying concrete discrepancies.

---

## Architecture Overview

| Aspect | MAME | Klive |
|---|---|---|
| Contention model | Per-bus-operation callbacks (`m1`, `data_r`, `data_w`, `nomem_rq`, `ula_r/w`, `io_r/w`) | Pre-computed per-frame-tact contention table, applied via `delayAddressBusAccess` and `delayContendedIo` |
| Pattern storage | 8-element array, indexed at runtime by `(now - cf) % 8` | Pre-computed full-frame table (`contentionValues[currentFrameTact]`) |
| I/O separation | ULA port (A0=0) and non-ULA port (A0=1) handled by **separate** callbacks (`ula_r/w` vs `io_r/w`) | Single `delayContendedIo(address)` method with 4-case switch on address range and A0 |

---

## D1 — I/O Contention Address Range Is Too Narrow for 128K and +3E

**Severity: High**

### MAME Behavior

`io_r`/`io_w` and `ula_r`/`ula_w` all call the polymorphic `is_contended(offset)` using the **full 16-bit port address**:

- **48K**: `offset >= 0x4000 && offset < 0x8000`
- **128K**: above, OR `(offset >= 0xC000 && m_bank3_page & 1)` (odd banks 1,3,5,7)
- **+2A/+3**: above, OR `(offset >= 0xC000 && m_bank3_page & 4)` (banks 4,5,6,7)

So port addresses like `0xFFFD` (AY register) trigger I/O contention on 128K when an odd bank is paged in at 0xC000.

### Klive Behavior

`delayContendedIo` in `ZxSpectrumBase.ts:315` hardcodes:

```ts
if ((address & 0xc000) === 0x4000) { /* contended path */ }
else { /* non-contended path */ }
```

This **only** checks the `0x4000–0x7FFF` range. Neither `ZxSpectrum128Machine` nor `ZxSpectrumP3eMachine` overrides `delayContendedIo`.

### Impact

- Any I/O port with a high address in `0xC000–0xFFFF` (e.g. `0xFFFD`, `0x7FFD` remapped) will **never** get I/O contention on 128K or +3E, even when a contended bank is paged in at 0xC000.
- The base-class `delayContendedIo` should call the model-specific `isContendedAddress` logic used by `delayAddressBusAccess` instead of the hardcoded `0x4000` test.

### Fix

Override `delayContendedIo` in `ZxSpectrum128Machine` and `ZxSpectrumP3eMachine` (or refactor the base to call a virtual `isContendedAddress(address)` method) so that the I/O contention address check matches the memory contention address check for each model.

---

## D2 — HALT Does Not Apply Contention

**Severity: Medium**

### MAME Behavior

When halted, MAME executes a **full M1 cycle** (`@rop` macro) every iteration:
1. Opcode fetch at PC → contention on PC address (via `m1` callback)
2. Refresh cycle → `m_refresh_cb` fires with IR address
3. PC is incremented then decremented (stays at HALT)
4. R is incremented

This means contention is applied every 4 T-states based on the PC address (screen RAM at `0x4000–0x7FFF` causes heavy delays).

### Klive Behavior

`Z80Cpu.ts:871–877`:
```ts
if (this.halted) {
    this.refreshMemory();   // only increments R; no contention
    this.tactPlusN(4);      // flat 4T, no contention check
    return;
}
```

No contention is ever applied during HALT. `refreshMemory()` only manipulates the R register. `tactPlusN(4)` is a plain delay.

### Impact

Programs that HALT with PC in contended memory (a very common pattern — e.g. the main loop `HALT` at `0x7FFE` waiting for interrupt) will run too fast in Klive. The missing contention can be 0–6 T-states per HALT cycle, significantly affecting frame timing.

### Fix

Replace the halted loop with:
```ts
if (this.halted) {
    this.delayMemoryRead(this.pc);  // contention + 3T for M1 fetch
    this.refreshMemory();
    this.tactPlusN(1);              // 1T for refresh half of M1
    return;
}
```

This applies contention on the PC address (like MAME's `@rop`) and correctly models the 4T M1 cycle.

---

## D3 — M1 Refresh Does Not Apply Contention on IR Address

**Severity: Low–Medium**

### MAME Behavior

After the opcode fetch, the `rop` macro fires `m_refresh_cb` with the IR register value. In the Spectrum ULA hookup, this callback calls `spectrum_refresh_w`, allowing the ULA to track the refresh address. Additionally, for instructions with extra internal cycles (PUSH, ED-bloc ops, etc.), the `nomreq_ir` macro explicitly fires `m_nomreq_cb` with the IR address for each cycle — applying contention per-tact.

### Klive Behavior

`Z80Cpu.ts:893–895`:
```ts
this.refreshMemory();      // only increments R
this.tactPlusN(1);         // flat 1T, no contention
```

The 1T refresh portion of M1 uses `tactPlusN(1)` rather than `tactPlus1WithAddress(this.ir)`. No contention is checked against the IR address.

### Impact

When the I register points to contended memory (e.g. `I = 0x40–0x7F`), every M1 cycle should incur an additional contention delay during the refresh phase. This is relatively rare in practice (most programs set I to ROM space), but some demos and timing-critical code exploit this.

### Fix

Change the M1 refresh line from `this.tactPlusN(1)` to `this.tactPlus1WithAddress(this.ir)`.

---

## D4 — Contention Pattern Values: 128K vs MAME

**Severity: Medium**

### MAME Values

- **48K**: `{6, 5, 4, 3, 2, 1, 0, 0}`, `base_offset = -1`
- **128K**: `{6, 5, 4, 3, 2, 1, 0, 0}`, `base_offset = -1` (SAME pattern as 48K)
- **+2A/+3**: `{1, 0, 7, 6, 5, 4, 3, 2}`, `base_offset = +1`

### Klive Values

- **48K**: `[6, 5, 4, 3, 2, 1, 0, 0]`
- **128K**: `[4, 3, 2, 1, 0, 0, 6, 5]` (rotated by 2 positions vs MAME)
- **+3E**: `[0, 7, 6, 5, 4, 3, 2, 1]` (rotated by 1 position vs MAME)

### Analysis

Klive uses a different indexing convention: the `contentionValues` array is indexed by rendering phase within the `initializeRenderingTactTable` method, which maps `pixelTact` positions to contention indices via a fixed mapping:

| `pixelTact` | Contention index |
|---|---|
| 0 | `contentionValues[1]` |
| 1 | `contentionValues[2]` |
| 2 | `contentionValues[3]` |
| 3 | `contentionValues[4]` |
| 4 | `contentionValues[5]` |
| 5 | `contentionValues[6]` |
| 6 | `contentionValues[7]` |
| 7 | `contentionValues[0]` |

So the rotation in Klive's array is compensated by this offset mapping. The effective contention at each pixel position should be equivalent — **but this needs verification** against timing tests (e.g. the `Timings_Test` program) because:

1. MAME's `base_offset` provides a per-model shift of the contention window relative to the screen position. It's unclear whether Klive's `initializeRenderingTactTable` accounts for this offset correctly.
2. MAME's 128K has `base_offset = -1` with a comment: *"leave it one for now, but according to Timings_Test it must be -3"*. This suggests even MAME's 128K timing may not be finalized.
3. The +2A/+3's `base_offset = +1` (a 2-position shift relative to 48K/128K's `-1`) needs to align with Klive's +3E pattern rotation.

### Recommendation

Run the standard contention timing test ROMs (e.g. Woody's `contention.tap`, or `Timings_Test`) on both MAME and Klive for each model and compare cycle counts. If discrepancies are found, adjust the contention values or table generation offset.

---

## D5 — Contention Delay Statistics Double-Counting

**Severity: Cosmetic**

### Issue

`ZxSpectrumBase.ts:345–346`:
```ts
this.totalContentionDelaySinceStart += 4;
this.contentionDelaySincePause += 4;
```

After the 4-case I/O contention logic, a flat `+4` is always added to the contention delay counters. However, the actual contention delays from `applyContentionDelay()` are **also** added inside that function (lines 352–353). The `+4` represents the base I/O cycle time, not contention — it should not be counted as contention delay.

### Fix

Remove the two `+= 4` lines at the end of `delayContendedIo`.

---

## D6 — Missing `m_is_timings_late` Equivalent

**Severity: Low**

### MAME Behavior

MAME provides a configurable DIP switch (`m_is_timings_late`) that shifts the contention window by 1 T-state and extends IRQ duration by 1 cycle (from 32 to 33 T-states). This models the known "early" vs "late" timing variants of the Spectrum 48K/128K ULA.

For the +2A/+3, this is forced to `false` (always "early" timing).

### Klive Behavior

Klive has no equivalent configurable timing shift. The contention table is pre-computed with a single fixed phase per model.

### Impact

Low — this is primarily a debugging/testing convenience. Most real hardware follows a single timing variant. However, if Klive aims to match specific hardware revisions, this may become relevant.

---

## D7 — `delayContendedIo` Non-contended ULA Port (A0=0): C:3 Should Be N:1, C:3

**Severity: Needs Verification**

### Klive Code

For non-contended + ULA port (A0=0), `ZxSpectrumBase.ts:338–341`:
```ts
this.tactPlusN(1);            // N:1
applyContentionDelay();        // C
this.tactPlusN(3);            // :3
```

This applies a contention lookup at tact+1, then advances 3T. Total: 1T + delay + 3T = 4T + delay.

### MAME Code

For ULA port when address is **not** contended:
```cpp
// ula_r:
// content_early(offset) is SKIPPED (not contended)
content_early(1);   // always: checks pattern at now+1
```

MAME's `content_early(1)` checks the contention pattern with a +1 shift on the current cycle. It applies the pattern delay. The base I/O cycle time (4T) comes from the Z80 opcode timing, not from the ULA handler.

### Analysis

The two approaches are functionally equivalent: both apply one contention lookup shifted by +1T. In Klive, the shift is implicit (the `tactPlusN(1)` advances time by 1 before the lookup). In MAME, the shift is explicit (the `+1` parameter to `content_early`).

However, there is a subtle ordering difference: Klive advances time by 1T **first**, then checks contention at the new position. MAME checks contention at `current_time + 1` **without** first advancing time, then the delay occurs. After the delay, time continues. In practice these produce the same result because the contention table lookup is position-based.

**This item needs verification with timing tests but is likely correct.**

---

## Summary

| ID | Discrepancy | Severity | Files to Change |
|----|------------|----------|-----------------|
| D1 | I/O contention address range too narrow (128K/+3E) | High | `ZxSpectrumBase.ts`, `ZxSpectrum128Machine.ts`, `ZxSpectrumP3eMachine.ts` |
| D2 | HALT does not apply contention | Medium | `Z80Cpu.ts` |
| D3 | M1 refresh does not apply contention on IR address | Low–Medium | `Z80Cpu.ts` |
| D4 | Contention pattern phase needs verification vs MAME | Medium | `CommonScreenDevice.ts` (if adjustments needed) |
| D5 | Contention delay statistics double-counting | Cosmetic | `ZxSpectrumBase.ts` |
| D6 | Missing early/late timing variant toggle | Low | `ZxSpectrumBase.ts`, `CommonScreenDevice.ts` |
| D7 | Non-contended ULA port contention ordering | Needs Verification | Likely correct |
