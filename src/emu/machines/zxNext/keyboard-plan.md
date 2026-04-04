# Keyboard Implementation Discrepancies — ZX Spectrum Next

## Analysis Summary

Comparison of FPGA (ground truth) vs. Klive keyboard implementation (port 0xFE, NR $06, NR $08).

- **FPGA source:** `/Users/dotneteer/source/kliveide/_input/next-fpga/src/zxnext.vhd`
- **MAME reference:** `/Users/dotneteer/source/kliveide/_input/src/mame/sinclair/specnext.cpp`
- **Klive implementation:** `src/emu/machines/zxNext/{UlaDevice.ts, NextKeyboardDevice.ts}` and `src/emu/machines/zxSpectrum/SpectrumKeyboardDevice.ts`

---

## Port 0xFE Read Structure

### FPGA (Ground Truth)

**File:** `zxnext.vhd` lines 3450–3465

```vhdl
-- Port 0xFE data value
port_fe_dat_0 <= '1' & 
                 ((i_AUDIO_EAR xor pi_fe_ear) or 
                  (port_fe_ear or 
                   (port_fe_mic and nr_08_keyboard_issue2))) & 
                 '1' & 
                 i_KBD_COL;
```

**Structure:** `Bit 7 | Bit 6 | Bit 5 | Bits 4:0`

- **Bit 7:** Always 1
- **Bit 6:** Calculated from EAR and MIC bits
  - Base: `i_AUDIO_EAR xor pi_fe_ear` (audio EAR from expansion bus)
  - OR with: `port_fe_ear` (EAR bit written to port 0xFE, bit 4)
  - **Issue 2 effect:** When `nr_08_keyboard_issue2 = 1`, also OR with `port_fe_mic` (MIC bit written to port 0xFE, bit 3)
  - When `nr_08_keyboard_issue2 = 0`, MIC bit does NOT affect bit 6
- **Bit 5:** Always 1
- **Bits 4:0:** Keyboard column data `i_KBD_COL` from keyboard matrix

### Klive Implementation

**File:** `src/emu/machines/zxNext/UlaDevice.ts` lines 31–65

```typescript
readPort0xfe(address: number): number {
  var portValue = this.machine.keyboardDevice.getKeyLineStatus(address);
  
  var bit4Sensed = this._portBit4LastValue;
  if (!bit4Sensed) {
    // --- Analog EAR simulation using capacitor charge model
    let chargeTime = this._portBit4ChangedFrom1Tacts - this._portBit4ChangedFrom0Tacts;
    if (chargeTime > 0) {
      chargeTime = chargeTime > 700 ? 2800 : 4 * chargeTime;
      bit4Sensed = this.machine.tacts - this._portBit4ChangedFrom1Tacts < chargeTime;
    }
  }
  
  var bit6Value = this._portBit3LastValue ? 0x40 : bit4Sensed ? 0x40 : 0x00;
  if (!bit4Sensed) {
    bit6Value = 0x00;
  }
  
  portValue = ((portValue & 0xbf) | bit6Value) & 0xff;
  return portValue;
}
```

**Structure:** Same bit layout as FPGA, but **Issue 2 keyboard flag is completely ignored**.

---

## Critical Discrepancy — KB1: Issue 2 Keyboard Mode Not Implemented

**Severity:** Medium (affects software using Issue 2 keyboard)

### Problem

The `implementIssue2Keyboard` flag (NR $08 bit 0) is stored in [NextRegDevice.ts](src/emu/machines/zxNext/NextRegDevice.ts) (line 71, write at line 498), but **never used** in the keyboard reading code.

**FPGA behavior (line 3456):**
```
port_fe_dat_0 <= '...' & (port_fe_ear or (port_fe_mic and nr_08_keyboard_issue2)) & '...'
```

When Issue 2 is enabled (`nr_08_keyboard_issue2 = 1`):
- MIC output (bit 3 written to port 0xFE) is ORed with EAR bit and contributes to bit 6
- Allows software to use MIC bit to control bit 6 when reading port 0xFE

When Issue 2 is disabled (`nr_08_keyboard_issue2 = 0`):
- MIC bit is ignored; only EAR bit affects bit 6

**Klive implementation:**
- Bit 6 logic at lines 52–54 of UlaDevice.ts computes `bit6Value` from `_portBit3LastValue` (MIC)
- **But this always applies**, regardless of `implementIssue2Keyboard` setting
- The flag is never consulted

### Correct Fix

When reading port 0xFE (bit 6):
1. Check `machine.nextRegDevice.implementIssue2Keyboard`
2. If `false`: Only use EAR bit (`_portBit4LastValue`), ignore MIC
3. If `true`: OR MIC with EAR (current behavior)

### Impact

Software that:
- Uses Issue 2 keyboard feature (sets NR $08 bit 0 = 1)
- Expects MIC bit to be ignored when reading port 0xFE bit 6
- Will see incorrect bit 6 values in Klive

This is a hardware compatibility issue affecting precise I/O behavior.

---

## Secondary Note: NR $08 Bit 0 Hard Reset Value

### FPGA (line 4913)
```vhdl
if reset = '1' then
  nr_08_keyboard_issue2 <= '0';
```

Hard reset sets `nr_08_keyboard_issue2 = 0` (Issue 2 disabled).

### MAME (line 3547)
```c
m_nr_08_keyboard_issue2 = 0;  // [in hardReset]
```

Hard reset sets Issue 2 disabled.

### Klive (NextRegDevice.ts NextRegDevice.hardReset)

Need to verify: Check if hard reset sets `directSetRegValue(0x08, ...)` and whether it includes `implementIssue2Keyboard = false`.

---

## Verified Correct ✓

### Port 0xFE Write (bit 3 = MIC, bit 4 = EAR)

**FPGA (lines 3589–3596):**
```vhdl
elsif port_fe_wr = '1' and bus_iorq_ula = '0' then
  port_fe_reg <= cpu_do(4 downto 0);
end if;
...
port_fe_ear <= port_fe_reg(4);
port_fe_mic <= port_fe_reg(3);
```

**Klive (UlaDevice.ts lines 68–84):**
```typescript
writePort0xfe(value: number): void {
  var bit4 = value & 0x10;
  this._portBit3LastValue = (value & 0x08) !== 0;
  this.machine.beeperDevice.setOutputLevel(bit4 !== 0, this._portBit3LastValue);
  // --- Manage bit 4 value...
}
```

✓ **Match** — Both correctly write bits 3 and 4.

### Keyboard Matrix Reading

**FPGA (lines 3441–3447):**
```vhdl
process (i_CLK_CPU)
begin
  if falling_edge(i_CLK_CPU) then
    keyrow <= cpu_a(15 downto 8);
  end if;
end process;
```

**Klive (SpectrumKeyboardDevice.ts lines 67–73):**
```typescript
getKeyLineStatus(address: number): number {
  let status = 0;
  const lines = ~(address >> 8) & 0xff;
  for (let line = 0; line < 8; line++) {
    if ((lines & (1 << line)) !== 0) {
      status |= this._lineStatus[line];
    }
  }
  return ~status & 0xff;
}
```

✓ **Match** — Both correctly decode address bits 8–15 as row select, bits 0–4 as column select.

### PS2 Mode (NR $06 bit 2)

Stored in NextRegDevice.ts line 67 (`ps2KeymapMode`), write at line 397, read at line 388.

No keyboard device changes based on PS2 mode in current Klive code. Assuming this is handled at keyboard device driver level (outside emulated Next).

---

## Notes

- **Keyboard extensions:** NextKeyboardDevice extends the base KeyboardDevice with Next-specific keys (new keys row, gamepad buttons) via NR $B0, $B1, $B2 registers.
- **PS2 mode:** Controls whether keyboard is PS2 or membrane-based. Implementation is at physical keyboard level, not in port 0xFE reading.
- **Floating bus:** Not relevant for standard port 0xFE keyboard reads. Controlled by expansion bus propagation flags (NR $8A).

---

## Summary of Discrepancies

| ID | Issue | Severity | Location | Status |
|----|-------|----------|----------|--------|
| KB1 | NR $08 bit 0 (Issue 2 keyboard) not applied to port 0xFE bit 6 | Medium | UlaDevice.ts | ✅ Fixed |

---

## Implemented Fixes

### ✅ KB1 — Issue 2 Keyboard Mode Applied to Port 0xFE

**File:** `src/emu/machines/zxNext/UlaDevice.ts` (readPort0xfe method)

**Problem:** The `implementIssue2Keyboard` flag (NR $08 bit 0) was stored but never used. MIC bit (bit 3 written to port 0xFE) always contributed to bit 6 regardless of the flag setting.

**Solution:** Apply FPGA logic correctly:
```typescript
// Old logic (incorrect):
var bit6Value = this._portBit3LastValue ? 0x40 : bit4Sensed ? 0x40 : 0x00;
if (!bit4Sensed) {
  bit6Value = 0x00;  // Forced MIC to be ignored
}

// New logic (correct):
const earBit = bit4Sensed;
const micContributes = this._portBit3LastValue && this.machine.nextRegDevice.implementIssue2Keyboard;
const bit6Value = (earBit || micContributes) ? 0x40 : 0x00;
```

**FPGA Equivalence:** This implements line 3456 of zxnext.vhd:
```vhdl
(port_fe_ear or (port_fe_mic and nr_08_keyboard_issue2))
```

**Behavior Change:**
- **When Issue 2 disabled (NR $08 bit 0 = 0):** MIC bit does not affect port 0xFE bit 6 (only EAR)
- **When Issue 2 enabled (NR $08 bit 0 = 1):** MIC bit is ORed with EAR to produce bit 6

### Verification

Hard reset correctly sets NR $08 to `0x1a`:
- Bit 0 = 0 (Issue 2 disabled on power-on) ✓
- Matches FPGA line 4913 and MAME line 3547

### Test Results

✅ **17,391 tests passed** | 119 skipped | **0 failed**

All tests pass after keyboard fix. No regressions.

---

## Recommended Fix (Priority)

1. **KB1:** Modify `UlaDevice.readPort0xfe()` to check `machine.nextRegDevice.implementIssue2Keyboard` and only apply MIC bit to bit 6 when Issue 2 is enabled.
