# Keyboard Device — MAME vs Klive Comparison

This document lists discrepancies found in the Klive ZX Spectrum Next keyboard device implementation
compared against MAME (`spectrum.cpp`, `specnext.cpp`) and the FPGA reference (`nextreg.txt`, `ports.txt`).

## Reference: Key Source Files

**MAME:**
- `spectrum.cpp` — `spectrum_ula_r` (port 0xFE read, keyboard matrix + Spectrum+ extra keys + joystick merge)
- `specnext.cpp` — NextReg handlers (0x05, 0x08, 0x68, 0xB0–0xB2), NMI triggers, joystick port decode

**Klive:**
- `src/emu/machines/zxSpectrum/SpectrumKeyboardDevice.ts` — 8×5 keyboard matrix (base class)
- `src/emu/machines/zxNext/NextKeyboardDevice.ts` — Extended key properties, regs 0xB0–0xB2 getters
- `src/emu/machines/zxNext/UlaDevice.ts` — Port 0xFE read/write
- `src/emu/machines/zxNext/NextRegDevice.ts` — NextReg handlers for 0x05, 0x08, 0x28–0x2B, 0x68, 0xB0–0xB2
- `src/emu/machines/zxNext/io-ports/KempstonHandler.ts` — Kempston joystick port stubs
- `src/emu/machines/zxNext/JoystickDevice.ts` — Joystick mode enum and configuration properties

**FPGA:**
- `nextreg.txt` — Reg 0x68 (ULA Control, bit 4 cancel extended keys), Regs 0xB0–0xB2 (extended key state)

## Reference: FPGA Keyboard Architecture

The real Next hardware has an 8×7 keyboard matrix (7 columns per row). Columns 0–4 are the standard
ZX Spectrum 40-key matrix. Columns 5–6 are extended keys (arrows, punctuation, editing keys) from the
PS/2 controller. NextReg 0x68 bit 4 controls whether extended keys also inject into the standard 8×5
matrix (for backward compatibility) or report only through regs 0xB0/0xB1.

## Reference: FPGA Extended Key Registers (`nextreg.txt`)

**Reg 0xB0 — Extended Keys 0 (active high, accent accent accent accent accent accent accent accent):**
```
Bit 7: ;          Bit 6: "          Bit 5: ,          Bit 4: .
Bit 3: UP         Bit 2: DOWN       Bit 1: LEFT       Bit 0: RIGHT
```

**Reg 0xB1 — Extended Keys 1:**
```
Bit 7: DELETE      Bit 6: EDIT       Bit 5: BREAK      Bit 4: INV VIDEO
Bit 3: TRUE VIDEO  Bit 2: GRAPH      Bit 1: CAPS LOCK  Bit 0: EXTEND
```

**Reg 0xB2 — Extended Joystick (MD Pad Buttons):**
```
Bits 7–4: Right pad (X, Z, Y, Mode)
Bits 3–0: Left pad (X, Z, Y, Mode)
```

**Reg 0x68 bit 4:** "Cancel entries in 8×5 matrix for extended keys" — when set, extended keys report
via 0xB0/0xB1 only and do NOT feed into the standard 8×5 matrix.

---

## Discrepancies

### D1 — Joystick values not merged into keyboard matrix on port 0xFE read

**FPGA:** The Kempston joystick values are AND'd into specific keyboard rows during port 0xFE reads
(joy1 into row 4 = keys 6–0, joy2 into row 3 = keys 1–5), providing Cursor/Sinclair joystick emulation.

**MAME** (`spectrum.cpp` lines 388–419, `spectrum_ula_r`):
```cpp
/* 1 - 5 */
if ((lines & 8) == 0)
    data &= m_io_line3->read() & cs_extra1 & joy2;

/* 6 - 0 */
if ((lines & 16) == 0)
    data &= m_io_line4->read() & cs_extra2 & joy1;
```
Joystick values `joy1` and `joy2` are AND'd directly into keyboard rows 3 and 4.

**Klive** (`SpectrumKeyboardDevice.ts` `getKeyLineStatus`):
Only reads the 8×5 keyboard matrix — no joystick values are merged.

**Fix:** Override `getKeyLineStatus` in `NextKeyboardDevice` to OR `joy1State` into row 4 and
`joy2State` into row 3. Joystick state stored in `JoystickDevice.joy1State`/`joy2State`.

**Status:** [x] Fixed

---

### D2 — Spectrum+ extra key groups not injected into matrix

**FPGA:** Extended keys on the Next keyboard inject their key combinations into the 8×5 matrix for
backward compatibility (unless cancelled by reg 0x68 bit 4).

**MAME** (`spectrum.cpp` lines 381–426, `spectrum_ula_r`):
Reads 5 "extra" Spectrum+ key groups (`cs_extra1`, `cs_extra2`, `cs_extra3`, `ss_extra1`, `ss_extra2`)
and merges them into specific keyboard rows. When any CAPS-extra group is pressed, CAPS SHIFT (row 0
bit 0) is automatically forced down. When any SYMBOL-extra group is pressed, SYMBOL SHIFT (row 7 bit 1)
is automatically forced down.

```cpp
/* CAPS for extra keys */
if (cs_extra1 != 0x1f || cs_extra2 != 0x1f || cs_extra3 != 0x1f)
    data &= ~0x01;
/* SYMBOL SHIFT for extra keys */
if (ss_extra1 != 0x1f || ss_extra2 != 0x1f)
    data &= ~0x02;
```

**Klive** (`SpectrumKeyboardDevice.ts` `getKeyLineStatus`):
Only reads the base 8×5 matrix. Relies on the host-side key mapping to generate the correct CAPS SHIFT
or SYMBOL SHIFT combinations. There are no extra key group inputs.

**Fix:** Override `getKeyLineStatus` in `NextKeyboardDevice` to compute and OR an extended key
overlay into the matrix. Each extended key maps to its CShift/SShift + base key combination.
Controlled by `cancelExtendedKeyEntries` flag.

**Status:** [x] Fixed

---

### D3 — Expansion bus not mixed into port 0xFE read

**MAME** (`spectrum.cpp` lines 387–388):
```cpp
/* expansion port */
if (m_exp) data = m_exp->iorq_r(offset);
```
External device data is mixed into the keyboard result before matrix rows are applied.

**Klive** (`UlaDevice.ts` `readPort0xfe`):
Only reads keyboard matrix and handles EAR bit. No expansion bus data is mixed in.

Note: Klive has NextReg 0x8A (expansion bus IO propagate) with bit 0 for port 0xFE propagation, but
the actual mixing of expansion bus responses into the port 0xFE return value is not implemented.

**Fix:** Requires adding an IO read framework to `ExpansionBusDevice`, which currently only manages
register-based configuration (NextRegs 0x80/0x81). Would need architecture changes to support
external device IO responses.

**Status:** [ ] Not fixed — architectural limitation, skipped

---

### D4 — Kempston joystick port handlers are stubs

**MAME** (`specnext.cpp`):
Full Kempston joystick implementation with mode-dependent port decoding (0x1F, 0x37, 0xDF), MD pad
button support via reg 0xB2, and joystick mode switching via NextReg 0x05.

**Klive** (`KempstonHandler.ts`, `NextIoPortManager.ts` lines 416–431):
All three Kempston port handlers (`readKempstonJoy1Port`, `readKempstonJoy1AliasPort`,
`readKempstonJoy2Port`) return `0xFF` — marked as TODO stubs.

**Fix:** Changed `KempstonHandler` functions to accept machine parameter. Port 0x1F and 0xDF
return `joy1State`, port 0x37 returns `joy2State`. Updated `NextIoPortManager` registrations
to pass machine via closures.

**Status:** [x] Fixed

---

### D5 — Reg 0xB2 (extended joystick) returns never-set values

**MAME** (`specnext.cpp` lines 1789–1793, case 0xb2):
```cpp
u16 i_joy_left = m_io_joy_left->read();
u16 i_joy_right = m_io_joy_right->read();
port_253b_dat = (BIT(i_joy_right, 8, 3) << 5) | (BIT(i_joy_right, 11) << 4) |
                (BIT(i_joy_left, 8, 3) << 1) | BIT(i_joy_left, 11);
```
Reads actual joystick input bits [8:11] for MD pad buttons (X, Z, Y, Mode).

**Klive** (`NextKeyboardDevice.ts` `nextRegB2Value` getter):
Returns a composite of 8 boolean properties (`rightPadXPressed`, `leftPadZPressed`, etc.) that are
initialized to `false` in `reset()` and **never set from any input source**.

**Fix:** Changed `nextRegB2Value` getter in `NextKeyboardDevice` to read from
`JoystickDevice.joy1MdPadState` (bits 3-0) and `joy2MdPadState` (bits 7-4).

**Status:** [x] Fixed

---

### D6 — Reg 0x68 bit 4 (cancel extended keys) stored but has no effect

**FPGA** (`nextreg.txt`): "Cancel entries in 8×5 matrix for extended keys" — when set, extended keys
should stop injecting their key combinations into the standard 8×5 keyboard matrix and only report
through regs 0xB0/0xB1.

**MAME** (`specnext.cpp`):
Flag `m_nr_68_cancel_extended_keys` is stored/read (lines 1666, 2303) and reset to 0 on soft reset
(line 3783), but has no functional effect since extended keys (0xB0/0xB1) are not implemented.

**Klive** (`NextKeyboardDevice.ts`, `NextRegDevice.ts`):
Flag `cancelExtendedKeyEntries` is stored/read via reg 0x68 bit 4, but has no functional effect —
no code checks this flag when reading the keyboard matrix.

**Fix:** The `getKeyLineStatus` override checks `cancelExtendedKeyEntries` and skips the
extended key overlay when the flag is set. Extended keys still report via regs 0xB0/0xB1.

**Status:** [x] Fixed

---

### D7 — Extended key properties (regs 0xB0/0xB1) are never populated from input

**FPGA:** Regs 0xB0/0xB1 reflect the state of extended keys (arrows, punctuation, editing keys) from
the PS/2 keyboard controller scanning columns 5–6 of the 8×7 matrix.

**MAME** (`specnext.cpp` lines 1774–1782):
Regs 0xB0 and 0xB1 are hardcoded to return 0 — extended keyboard is not implemented.

**Klive** (`NextKeyboardDevice.ts`):
Properties for all 16 extended keys are defined (e.g., `semicolonPressed`, `upPressed`, `deletePressed`)
and the `nextRegB0Value`/`nextRegB1Value` getters correctly compose the register values. However, these
properties are **never set from keyboard input** — only cleared in `reset()`.

**Fix:** Added `NextExtendedKey` enum and `setExtendedKeyStatus(extKey, isDown)` method to
`NextKeyboardDevice`. Host input handlers call this to set extended key state, which populates
the boolean properties read by `nextRegB0Value`/`nextRegB1Value` getters.

**Status:** [x] Fixed

---

### D8 — Issue 2 keyboard flag has no functional effect

**FPGA:** NextReg 0x08 bit 0 selects Issue 2 vs Issue 3 keyboard. On Issue 2, the EAR input on
port 0xFE is affected by the MIC output bit — there is electrical crosstalk between bits 3 and 6.

**MAME** (`specnext.cpp`):
Flag `m_nr_08_keyboard_issue2` is stored/read at bit 0 of reg 0x08 (line 1973), cleared on hard reset
(line 3547), but **has no functional effect** on keyboard reading.

**Klive** (`NextRegDevice.ts`):
Flag `implementIssue2Keyboard` is stored/read at bit 0 of reg 0x08, but **has no functional effect**.

**Note:** Both implementations match — neither implements Issue 2 keyboard behavior. This is a
shared gap rather than a Klive-specific discrepancy. Low priority since most Next software targets
Issue 3 behavior.

**Status:** [ ] Not fixed (both implementations)

---

### D9 — PS/2 keymap registers are non-functional

**FPGA** (`nextreg.txt`): Regs 0x28–0x2B program the PS/2 keyboard scancode-to-matrix mapping:
- 0x28: Address MSB (active bit selects which half-row)
- 0x29: Address LSB (active bit selects which column within the half-row)
- 0x2A: Data MSB (high byte of 9-bit PS/2 scancode)
- 0x2B: Data LSB (low byte, active bit selects which PS/2 scancode maps to this matrix position)

**MAME** (`specnext.cpp`):
Registers 0x28–0x2B have placeholder/commented-out write handling. No actual keymap reprogramming.

**Klive** (`NextRegDevice.ts`):
Stores values in `ps2KeymapAddressMsb`, `ps2KeymapAddressLsb`, `ps2KeymapDataMsb`,
`ps2KeymapDataLsb` on writes, reads them back — but no actual PS/2 scancode remapping occurs.

**Note:** Both implementations match — neither implements PS/2 keymap programming. Low priority since
this feature is rarely used by software.

**Status:** [ ] Not fixed (both implementations)
