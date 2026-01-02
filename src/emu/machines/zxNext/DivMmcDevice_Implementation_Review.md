# DivMMC Implementation Review

**Document**: DivMmcDevice.ts Implementation vs. DivMMC_Test_Cases.md Specification  
**Date**: 2 January 2026  
**Status**: Issues Identified and Documented

---

## Executive Summary

The DivMMC implementation in `DivMmcDevice.ts` had **9 identified issues**, ranging from critical to minor. **Issue #1 (Missing Manual CONMEM Control) has been successfully fixed and tested.**

### Issue Status Summary
- **CRITICAL**: 1 issue (manual CONMEM control) - ✅ **FIXED**
- **HIGH**: 2 issues (RETN detection, state machine)
- **MEDIUM**: 3 issues (rom3 dependency, auto-unmap, entry point detection)
- **LOW**: 3 issues (implementation clarity, incomplete handlers, code organization)

---

## Issues Identified

### Issue #1: CRITICAL - Missing Manual CONMEM Control - ✅ FIXED

**Location**: `beforeOpcodeFetch()` method, lines 229-305

**Specification Requirement** (from DivMMC_Test_Cases.md):
> "DivMMC maps in when ANY of these occur:
> 1. Instant entry point hit AND ROM 3 present (if required)
> 2. Delayed entry point hit (activates next instruction) AND ROM 3 present (if required)
> 3. NMI entry point (0x0066) AND NMI button pressed
> 4. **Manual enable via port 0xE3 bit 7 (conmem=1)**
> 5. Already mapped AND not at auto-unmap address (0x1FF8-0x1FFF)"

**Problem (FIXED)**:
- ✅ The `conmem` flag (this._conmem) is now correctly checked in `beforeOpcodeFetch()`
- ✅ Setting `conmem=1` via port 0xE3 now correctly activates DivMMC mapping
- ✅ Manual DivMMC paging control is now functional
- ✅ Entry points and manual control work independently

**Implementation Summary**:
Added a new private flag `_conmemActivated` to track whether mapping was activated by `conmem` or by entry points. The fix:
1. Activates automap when `conmem=1` and `enableAutomap=true`
2. Deactivates automap when `conmem=0` and mapping was activated by conmem
3. Properly handles the case where entry points activate mapping while `conmem=0`
4. Clears the `_conmemActivated` flag when automap is globally disabled

**Test Results**:
- ✅ All 5 regression tests pass (DivMmcDevice-regression.test.ts)
  - ✅ `conmem=1 should activate DivMMC mapping via beforeOpcodeFetch()`
  - ✅ `conmem=1 should persist across multiple beforeOpcodeFetch() calls`
  - ✅ `conmem=0 should disable DivMMC mapping`
  - ✅ `conmem=1 should work independent of entry points`
  - ✅ `enableAutomap=false should disable conmem control`
- ✅ All 127 existing DivMMC tests still pass (DivMmmc.test.ts)

**Impact**: ✅ RESOLVED - Manual DivMMC control via port 0xE3 is now fully functional

---

### Issue #2: HIGH - Missing RETN Instruction Detection

**Location**: `beforeOpcodeFetch()` and `afterOpcodeFetch()` methods

**Specification Requirement** (from DivMMC_Test_Cases.md):
> "DivMMC automatically unmaps when the Z80 executes `RETN` (return from NMI):
> - Detected by the Z80 state machine
> - Clears `automap_held` and `automap_hold`
> - Clears `conmem` bit in port 0xE3
> - Returns to normal memory mapping"

**Current Implementation**:
- No RETN detection in the code
- No interaction with Z80 state machine
- `automap_held` stays active until entry point clears it

**Problem**:
- When esxdos returns via RETN, DivMMC should automatically unmap
- Without RETN detection, DivMMC ROM stays mapped
- Program execution continues from DivMMC ROM address space instead of normal memory
- This breaks the separation between esxdos and application code

**Test Case**: Needs implementation:
```typescript
it("RETN instruction should unmap DivMMC and clear conmem", async () => {
  // ... set up automap active ...
  // ... execute RETN ...
  // expect(divmmc.autoMapActive).toBe(false);
  // expect(divmmc.conmem).toBe(false);
});
```

**Fix Required**:
1. Access Z80 CPU state to detect RETN instruction (opcode 0xED 0x45)
2. Clear `_autoMapActive` when RETN detected
3. Clear `_conmem` when RETN detected
4. Call `updateFastPathFlags()` to update memory mapping

**Impact**: HIGH - esxdos cannot properly return control to applications

---

### Issue #3: HIGH - Incomplete State Machine Implementation

**Location**: `beforeOpcodeFetch()` and `afterOpcodeFetch()` methods

**Specification Requirement** (from DivMMC_Test_Cases.md):
> "The DivMMC automap has three states:
> 1. **Inactive** (automap = 0): Normal operation, monitoring for entry points
> 2. **Hold** (automap_hold = 1): Entry point detected during M1 cycle, set immediately
> 3. **Held** (automap_held = 1): Automap active for subsequent instructions
> 
> State Transitions:
> - Inactive → Hold: Entry point detected during M1 (mreq=0, m1=0)
> - Hold → Held: After M1 completes (mreq=1)
> - Held → Inactive: RETN executed OR auto-unmap address (0x1FF8-0x1FFF)"

**Current Implementation**:
- Uses `_requestAutomapOn` and `_requestAutomapOff` flags instead of full state machine
- No distinction between M1 cycle detection and instruction completion
- No `automap_hold` state (immediate mapping instead of deferred)
- No `automap_held` state (uses `_autoMapActive` directly)

**Problem**:
- The implementation conflates two different phases of activation
- For delayed entry points, the code requests paging but doesn't strictly follow the two-stage model
- The timing of when mapping becomes active may not exactly match hardware behavior
- State transitions are implicit rather than explicit, making code harder to verify

**Test Cases**: Needs implementation for state transitions:
```typescript
it("Entry point detection sets automap_hold immediately during M1", async () => {
  // ... entry point detected ...
  // expect(machine.divmmc.autoMapHold).toBe(true);
  // expect(machine.divmmc.autoMapHeld).toBe(false);
});

it("After M1 completes, automap_hold→automap_held transition occurs", async () => {
  // ... M1 cycle completes ...
  // expect(machine.divmmc.autoMapHold).toBe(false);
  // expect(machine.divmmc.autoMapHeld).toBe(true);
});
```

**Fix Required**:
Refactor to use explicit state variables:
```typescript
private _autoMapHold: boolean = false;   // Entry point detected, M1 in progress
private _autoMapHeld: boolean = false;   // Automap active after M1 completes
```

Then implement proper state transitions in `beforeOpcodeFetch()` and `afterOpcodeFetch()`.

**Impact**: HIGH - Timing of automap activation may be slightly off from hardware

---

### Issue #4: MEDIUM - ROM 3 Dependency Logic Incomplete

**Location**: `beforeOpcodeFetch()` method, line 242

**Specification Requirement** (from DivMMC_Test_Cases.md):
> "Some entry points only trigger if **ROM 3** is present (128K +2A/+3 ROM):
> - Controlled by `divmmc_rst_ep_valid` flag
> - If ROM 3 not present, these entry points are disabled
> - Prevents unwanted trapping on 48K ROMs"

**Current Implementation**:
```typescript
const rom3PagedIn =
  //!memoryDevice.enableAltRom &&
  (memoryDevice.selectedRomMsb | memoryDevice.selectedRomLsb) === 0x03;
```

**Problem**:
- The ROM 3 check is incomplete
- The condition `(selectedRomMsb | selectedRomLsb) === 0x03` checks if both selected ROMs are 3
- Should check if ROM 3 is the *currently active* ROM
- Alternative ROM check is commented out (`enableAltRom`), losing functionality
- Different entry points have different ROM 3 requirements (some require it, some don't)

**Affected Entry Points**:
- RST 0-7: NextReg 0xB9 bit pattern determines ROM 3 requirement
- 0x04C6, 0x0562, 0x04D7, 0x056A: All require ROM 3 (rom3PagedIn check present)
- 0x3Dxx: Requires ROM 3 (rom3PagedIn check present)
- 0x1FF8-0x1FFF: No ROM 3 requirement

**Fix Required**:
1. Correct ROM 3 detection logic
2. Add `onlyWithRom3` flag for RST entry points (already in TrapInfo)
3. Only trigger entry points that don't have `onlyWithRom3` set, OR if ROM 3 is present

**Example**:
```typescript
const shouldTrigger = this.rstTraps[rstIdx].enabled && 
  (!this.rstTraps[rstIdx].onlyWithRom3 || rom3PagedIn);
```

**Impact**: MEDIUM - Entry points may trigger incorrectly on 48K systems

---

### Issue #5: MEDIUM - Auto-Unmap Range 0x1FF8-0x1FFF Logic

**Location**: `beforeOpcodeFetch()` method, lines 292-298

**Specification Requirement** (from DivMMC_Test_Cases.md):
> "**NextReg 0xBB bit 6** enables automatic unmapping when CPU executes from addresses 0x1FF8-0x1FFF.
> This allows esxdos ROM to unmap itself by jumping to these addresses before returning to Spectrum ROM."

**Current Implementation**:
```typescript
} else if (pc >= 0x1ff8 && pc <= 0x1fff) {
  if (this.disableAutomapOn1ff8) {
    this._requestAutomapOff = true;
  } else {
    this._autoMapActive = false;
    this.machine.memoryDevice.updateFastPathFlags();
  }
}
```

**Problem**:
- The logic is backwards/confusing
- `disableAutomapOn1ff8` should mean "enable auto-unmap at 0x1FF8", but the naming suggests it disables
- When `disableAutomapOn1ff8` is true, it *requests* off (delayed)
- When `disableAutomapOn1ff8` is false, it immediately sets off
- This is backwards from what the naming suggests

**Correct Behavior** (from spec):
- If `automapOn1ff8` (NextReg 0xBB bit 6) is set: auto-unmap when PC in range 0x1FF8-0x1FFF
- If `automapOn1ff8` is not set: no auto-unmap

**Fix Required**:
Rename `disableAutomapOn1ff8` to clarify its purpose, or invert the logic:
```typescript
// Currently: disableAutomapOn1ff8
// Should be: automapOn1ff8 (or automapOff1ff8)

if (pc >= 0x1ff8 && pc <= 0x1fff) {
  if (this.automapOff1ff8) {  // Enable auto-unmap
    this._requestAutomapOff = true;
  }
}
```

**Impact**: MEDIUM - Auto-unmap at 0x1FF8-0x1FFF may not work correctly

---

### Issue #6: MEDIUM - NMI Entry Point (0x0066) Not Implemented

**Location**: `beforeOpcodeFetch()` method, line 280

**Specification Requirement** (from DivMMC_Test_Cases.md):
> "NMI Entry Point (0x0066)
> - Configured via NextReg 0xBB bits 0-1 (instant and delayed modes)
> - Only triggers if NMI button is pressed (`enableDivMmcNmiByDriveButton`)
> - Allows manual invocation of esxdos via NMI button"

**Current Implementation**:
```typescript
case 0x0066:
  // TODO: Implement it when NMI button handling is implemented
  break;
```

**Problem**:
- Not implemented at all
- TODO comment indicates it's pending
- NMI button integration incomplete

**Fix Required**:
```typescript
case 0x0066:
  if (this.enableDivMmcNmiByDriveButton) {  // or check if NMI button was pressed
    const isInstant = this.automapOn0066;  // NextReg 0xBB bit 1 (instant)
    const isDelayed = this.automapOn0066Delayed;  // NextReg 0xBB bit 0 (delayed)
    
    if (isInstant) {
      this._autoMapActive = true;
      this.machine.memoryDevice.updateFastPathFlags();
    } else if (isDelayed) {
      this._requestAutomapOn = true;
    }
  }
  break;
```

**Impact**: MEDIUM - NMI button cannot trigger esxdos

---

### Issue #7: LOW - Instant Mapping at 0x3Dxx Range

**Location**: `beforeOpcodeFetch()` method, lines 288-291

**Specification Requirement** (from DivMMC_Test_Cases.md):
> "0x3Dxx Range (instant, ROM 3 only):
> - Any address in range 0x3D00-0x3DFF triggers automap
> - Instant activation during M1 cycle
> - Requires ROM 3 present"

**Current Implementation**:
```typescript
if (pc >= 0x3d00 && pc <= 0x3dff) {
  if (this.automapOn3dxx && rom3PagedIn) {
    this._autoMapActive = true;
    this.machine.memoryDevice.updateFastPathFlags();
  }
}
```

**Problem**:
- Implementation looks correct
- However, no distinction between instant/delayed for this entry point
- Comment in spec says "instant" but code doesn't explicitly differentiate

**Note**: This may be correct as-is; the behavior appears to match the spec's instant activation.

**Impact**: LOW - Likely working correctly

---

### Issue #8: LOW - Missing Entry Point: NMI at 0x0066 Delayed Mode

**Location**: `beforeOpcodeFetch()` method

**Specification Requirement** (from DivMMC_Test_Cases.md):
> "NextReg 0xBB bit 0: NMI at 0x0066 (delayed)"

**Current Implementation**:
- Property `automapOn0066Delayed` exists but is never checked
- NMI entry point not implemented (see Issue #6)

**Fix Required**:
Implement NMI entry point with both instant and delayed modes (covered by Issue #6 fix).

**Impact**: LOW - Part of larger NMI implementation issue

---

### Issue #9: LOW - Code Organization and Clarity

**Location**: Multiple locations in `beforeOpcodeFetch()` and `afterOpcodeFetch()`

**Observations**:
1. Delayed paging requests use `_requestAutomapOn` and `_requestAutomapOff` flags
2. Entry point checks are intermingled in a large switch statement
3. ROM 3 dependency check repeated in multiple places
4. No clear separation between different activation mechanisms:
   - Manual control (conmem)
   - Entry points (RST, custom addresses)
   - Auto-unmap
   - State transitions

**Recommendations for Future Refactoring**:
```typescript
// Separate concerns into helper methods
private checkManualConmem(): void { ... }
private checkRstEntryPoints(): void { ... }
private checkCustomEntryPoints(): void { ... }
private checkAutoUnmap(): void { ... }
private updateStateTransitions(): void { ... }
```

**Impact**: LOW - Code is functional but could be better organized

---

## Summary Table

| # | Issue | Severity | Category | Status |
|---|-------|----------|----------|--------|
| 1 | Missing Manual CONMEM Control | CRITICAL | Port 0xE3 Manual Control | ✅ **FIXED** |
| 2 | Missing RETN Detection | HIGH | State Management | Identified |
| 3 | Incomplete State Machine | HIGH | Architecture | Identified |
| 4 | ROM 3 Dependency Logic | MEDIUM | Entry Points | Identified |
| 5 | Auto-Unmap 0x1FF8-0x1FFF | MEDIUM | Entry Points | Identified |
| 6 | NMI Entry Point Not Implemented | MEDIUM | Entry Points | Identified |
| 7 | Instant Mapping at 0x3Dxx | LOW | Entry Points | Likely OK |
| 8 | NMI Delayed Mode | LOW | Entry Points | Identified |
| 9 | Code Organization | LOW | Maintainability | Enhancement |

---

## Next Steps

### Phase 1: Regression Tests ✅ COMPLETED
- ✅ Created regression test file: `test/zxnext/DivMmcDevice-regression.test.ts`
- ✅ All regression tests passing (5/5)
- ✅ All existing tests still passing (127/127)

### Phase 2: Critical Fix ✅ COMPLETED
- ✅ Implemented Issue #1: Manual CONMEM control in `beforeOpcodeFetch()`
- ✅ Run regression tests to verify fix - **ALL PASS**
- ✅ Verified no regressions in existing tests

### Phase 3: High Priority Fixes (NEXT)
- [ ] Implement Issue #2: RETN detection
- [ ] Implement Issue #3: Proper state machine (automap_hold → automap_held)
- [ ] Add regression tests for both

### Phase 4: Medium Priority Fixes
- [ ] Fix Issue #4: ROM 3 dependency logic
- [ ] Fix Issue #5: Auto-unmap 0x1FF8-0x1FFF naming/logic
- [ ] Implement Issue #6: NMI entry point
- [ ] Add regression tests

### Phase 5: Low Priority Enhancements
- [ ] Verify Issue #7 (0x3Dxx instant mapping)
- [ ] Clarify Issue #8 (NMI delayed mode)
- [ ] Refactor for Issue #9 (code organization)

---

## Regression Test File Location

`test/zxnext/DivMmcDevice-regression.test.ts`

Tests are organized by issue and use the pattern from `test/zxnext/DivMmmc.test.ts`:
- Uses `createTestNextMachine()` helper
- Uses `machine.writePort()` for port 0xE3 writes
- Uses `machine.divMmcDevice` for access to DivMMC state

---

## Related Files

- **Implementation**: `src/emu/machines/zxNext/DivMmcDevice.ts`
- **Specification**: `src/emu/machines/zxNext/DivMMC_Test_Cases.md`
- **VHDL Reference**: `_input/next-fpga/src/device/divmmc.vhd`
- **Tests**: `test/zxnext/DivMmcDevice-regression.test.ts`
- **Existing Tests**: `test/zxnext/DivMmmc.test.ts`
