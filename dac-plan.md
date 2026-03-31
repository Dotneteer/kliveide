# DAC 8-bit Implementation — MAME vs Klive Comparison (Re-comparison)

This document lists discrepancies found in the Klive ZX Spectrum Next DAC 8-bit implementation
compared against MAME (`specnext.cpp`) and the FPGA reference (`ports.txt`, `nextreg.txt`).

## Reference: FPGA DAC Port-Channel Table (`ports.txt`)

```
NAME             1    2    3    4    5    6    7

DAC Channel A        0xFB 0xDF 0x1F 0xF1      0x3F
DAC Channel B   0xB3           0x0F 0xF3 0x0F
DAC Channel C   0xB3           0x4F 0xF9 0x4F
DAC Channel D        0xFB 0xDF 0x5F 0xFB      0x5F

1 = gs covox         (enable bit 22)
2 = pentagon, atm    (enable bit 21)
3 = specdrum         (enable bit 23)
4 = soundrive 1      (enable bit 17)
5 = soundrive 2      (enable bit 18)
6 = covox            (enable bit 20)
7 = profi covox      (enable bit 19)
```

All ports are write-only. DACs must be enabled by NextReg 0x08 bit 3.

## Reference: FPGA Per-Port Enable Bits (`nextreg.txt`, NextRegs 0x82–0x85)

Bits 17–23 of the internal port enable register (NextReg 0x84):

| Bit | Mask | Ports | Mode |
|-----|------|-------|------|
| 17 (bit 1 of 0x84) | 0x02 | 0x0F, 0x1F, 0x4F, 0x5F | SoundDrive mode 1 |
| 18 (bit 2 of 0x84) | 0x04 | 0xF1, 0xF3, 0xF9, 0xFB | SoundDrive mode 2 |
| 19 (bit 3 of 0x84) | 0x08 | 0x3F, 0x5F | Profi covox |
| 20 (bit 4 of 0x84) | 0x10 | 0x0F, 0x4F | Covox |
| 21 (bit 5 of 0x84) | 0x20 | 0xFB | Pentagon/ATM (when SD2 off) |
| 22 (bit 6 of 0x84) | 0x40 | 0xB3 | GS covox |
| 23 (bit 7 of 0x84) | 0x80 | 0xDF (+ 0x1F kempston alias) | Specdrum |

## Reference: Correct Per-Port Channel Assignments (derived from FPGA table)

| Port | Enable Bit(s) | Channel(s) | Notes |
|------|---------------|------------|-------|
| 0x1F | bit 17 | A | SoundDrive 1 only |
| 0x0F | bit 17 OR bit 20 | B | SD1 or covox |
| 0x4F | bit 17 OR bit 20 | C | SD1 or covox |
| 0x5F | bit 17 OR bit 19 | D | SD1 or profi covox |
| 0xF1 | bit 18 | A | SoundDrive 2 |
| 0xF3 | bit 18 | B | SoundDrive 2 |
| 0xF9 | bit 18 | C | SoundDrive 2 |
| 0xFB | bit 21 → A+D; bit 18 → D | A+D or D | Pentagon (A+D) or SD2 (D only) |
| 0x3F | bit 19 | A | Profi covox |
| 0xDF | bit 23 | A+D | Specdrum |
| 0xB3 | bit 22 | B+C | GS covox |

---

## Discrepancies

### D1 — Port 0x1F writes all 4 channels instead of DAC A only (CRITICAL)

**FPGA:** Column 4 (SoundDrive 1) shows `0x1F → DAC A` only. The four SD1 ports are separate: 0x1F=A, 0x0F=B, 0x4F=C, 0x5F=D.

**MAME** (`specnext.cpp` lines 1311–1317, `mf_port_w`):
```cpp
if (Lsb == 0x1f && m_nr_08_dac_en && port_dac_sd1_ABCD_1f0f4f5f_io_en())
{
    m_dac[0]->data_w(data);  // A
    m_dac[1]->data_w(data);  // B
    m_dac[2]->data_w(data);  // C
    m_dac[3]->data_w(data);  // D
}
```
MAME writes ALL 4 channels — this contradicts the FPGA spec.

**Klive** (`DacPortHandler.ts` `writeDacAllPort`, `NextIoPortManager.ts` line 289):
```ts
writerFns: (_, v) => writeDacAllPort(machine, v)  // writes A,B,C,D
```
Follows MAME's behavior (all 4 channels). **Wrong per FPGA.**

**Fix:** Change port 0x1F to use `writeDacAPort` (DAC A only).

**Status:** [ ] Not fixed

---

### D2 — Port 0x3F writes A+D instead of DAC A only (CRITICAL)

**FPGA:** Column 7 (profi covox) shows `0x3F → DAC A` only. Port 0x5F is the separate DAC D port in profi covox mode.

**MAME** (`specnext.cpp` lines 1318–1322, `mf_port_w`):
```cpp
else if (Lsb == 0x3f && m_nr_08_dac_en && port_dac_stereo_AD_3f5f_io_en())
{
    m_dac[0]->data_w(data);  // A
    m_dac[3]->data_w(data);  // D
}
```
MAME writes A+D — this contradicts the FPGA spec.

**Klive** (`NextIoPortManager.ts` line 303):
```ts
writerFns: (_, v) => writeDacAandDPort(machine, v)  // writes A+D
```
Follows MAME's behavior (A+D). **Wrong per FPGA.**

**Fix:** Change port 0x3F to use `writeDacAPort` (DAC A only).

**Status:** [ ] Not fixed

---

### D3 — Missing per-port enable gating from NextReg 0x84 bits 17–23 (MEDIUM)

**FPGA:** Each DAC port mode has its own enable bit in NextReg 0x84. A port should only respond to writes when its corresponding enable bit is set (in addition to `enable8BitDacs` from NextReg 0x08 bit 3). Ports appearing in multiple columns should OR their enable bits.

**MAME** checks per-port enables for 5 of 11 ports:
| Port | MAME Enable Check | FPGA Required |
|------|-------------------|---------------|
| 0x1F | bit 17 ✓ | bit 17 ✓ |
| 0x3F | bit 19 ✓ | bit 19 ✓ |
| 0xDF | bit 23 ✓ | bit 23 ✓ |
| 0xFB | bit 21 ✓ | bit 21 OR bit 18 |
| 0xB3 | bit 22 ✓ | bit 22 ✓ |
| 0xF1 | none ✗ | bit 18 |
| 0x0F | none ✗ | bit 17 OR bit 20 |
| 0xF3 | none ✗ | bit 18 |
| 0x4F | none ✗ | bit 17 OR bit 20 |
| 0xF9 | none ✗ | bit 18 |
| 0x5F | none ✗ | bit 17 OR bit 19 |

**Klive:** ALL 11 ports only check `enable8BitDacs`. None of the per-port enable bits from NextReg 0x84 (`portDacMode1Enabled`, `portDacMode2Enabled`, etc.) are checked in any DAC port handler, even though these flags are properly parsed and stored in `NextRegDevice.ts` (line 1880).

**Fix:** Each port handler should check `enable8BitDacs` AND the OR of its applicable enable bit(s) from `NextRegDevice`. The flags already exist: `portDacMode1Enabled` (bit 17), `portDacMode2Enabled` (bit 18), `portDacStereoProfiCovoxEnabled` (bit 19), `portDacStereoCovoxEnabled` (bit 20), `portDacMonoPentagonEnabled` (bit 21), `portDacMonoGsCovoxEnabled` (bit 22), `portDacMonoSpecdrumEnabled` (bit 23).

**Status:** [ ] Not fixed

---

### D4 — Port 0xFB missing SoundDrive mode 2 behavior (D only) (MEDIUM)

**FPGA:** Port 0xFB appears in:
- Column 2 (pentagon, bit 21): writes A+D
- Column 5 (SoundDrive 2, bit 18): writes D only

The description in NextReg 0x84 bit 5 says: "Port 0xfb dac mono pentagon/atm **(sd mode 2 off)**" — implying bit 21 controls 0xFB when SD2 is off. When SD2 is on (bit 18), 0xFB takes behavior from SD2 (D only).

**MAME** (`specnext.cpp` line 3097): Only checks `port_dac_mono_AD_fb_io_en()` (bit 21) → writes A+D. Does not check bit 18 at all. If only SD2 is enabled, 0xFB produces no output (MAME bug).

**Klive** (`NextIoPortManager.ts` line 339): Uses `writeDacAandDPort` with only `enable8BitDacs` check → always writes A+D.

**Fix:** Correct behavior for port 0xFB:
- If bit 18 (SD2) set: write D only
- Else if bit 21 (pentagon) set: write A+D
- Else: no write (beyond the enable8BitDacs gate)

**Status:** [ ] Not fixed

---

### D5 — NextReg 0x2C/0x2D/0x2E reads return DAC values instead of I2S data (MEDIUM)

**FPGA** (`nextreg.txt` lines 407–425):
- 0x2C Read: MSB of current I2S (Pi) left side sample; latches LSB in internal register for 0x2D
- 0x2D Read: LSB of last I2S sample read from 0x2C or 0x2E
- 0x2E Read: MSB of current I2S (Pi) right side sample; latches LSB for 0x2D

These are I2S audio input registers, NOT DAC readback registers. Write goes to DAC, read comes from I2S.

**MAME** (`specnext.cpp` lines 1599–1610): Returns 0 for all three (I2S not implemented). Correctly does NOT return DAC values.

**Klive** (`NextRegDevice.ts` lines 1063–1082):
```ts
{ id: 0x2c, readFn: () => getDacB(), writeFn: (v) => setDacB(v) }
{ id: 0x2d, readFn: () => getDacA(), writeFn: (v) => { setDacA(v); setDacD(v); } }
{ id: 0x2e, readFn: () => getDacC(), writeFn: (v) => setDacC(v) }
```
Reads return DAC channel values. **Wrong per FPGA — should return I2S data (or 0 since I2S is not implemented).**

**Fix:** Change readFn for 0x2C, 0x2D, 0x2E to return 0 (I2S not implemented), matching both FPGA intent and MAME.

**Status:** [ ] Not fixed

---

### D6 — Multiface interaction on ports 0x1F and 0x3F (MEDIUM)

**MAME** (`specnext.cpp` lines 1289–1330, `mf_port_w`): Ports 0x1F and 0x3F share I/O decode space with multiface enable/disable ports. `mf_port_w` handles multiface state transitions first (enable/disable the multiface ROM/RAM), then processes DAC writes. The multiface port assignments depend on `m_nr_0a_mf_type`:
- Default: enable=0x3F, disable=0xBF
- Type 1: enable=0xBF, disable=0x3F
- Type 2: enable=0x9F, disable=0x1F

**Klive** (`NextIoPortManager.ts`): Port 0x1F and 0x3F are registered as DAC-only write handlers. No multiface interaction is handled on these ports.

**Fix:** Writes to 0x1F and 0x3F should trigger multiface enable/disable logic (based on multiface type from NextReg 0x0A) before processing the DAC write.

**Status:** [ ] Not fixed

---

### D7 — DAC reset value difference (LOW — Klive is correct)

**FPGA:** Unsigned 8-bit DAC; mid-point is 0x80 (silence).

**MAME:** DAC channels reset to 0 (DAC device default).

**Klive:** DAC channels reset to 0x80 (`DacDevice.ts`).

**Assessment:** Klive matches the expected FPGA behavior. MAME has a minor discrepancy. **No change needed.**

**Status:** [x] Klive correct

---

### D8 — Per-channel gain of 0.75 not applied (LOW)

**MAME** (`specnext.cpp`): Configures each DAC channel with gain 0.75 (`dac0_vol` etc.), providing headroom to prevent audio clipping when multiple channels are active.

**Klive:** No per-channel gain applied in `DacDevice.ts`.

**Assessment:** Affects audio volume balance. Low priority vs functional correctness. May cause clipping when all 4 channels are driven simultaneously.

**Status:** [ ] Not fixed

---

### D9 — Dead code: DacPortDevice.ts (LOW)

`DacPortDevice.ts` contains an unused class with hardcoded port-to-channel mappings that are stale (e.g., port 0x1F mapped to all 4 channels). This class is not referenced from `NextIoPortManager.ts` — all DAC port handling goes through `DacPortHandler.ts`.

**Assessment:** Maintenance issue. The dead code could confuse future developers.

**Status:** [ ] Not cleaned up

---

## Summary

| # | Issue | Severity | MAME Bug? | Klive Status |
|---|-------|----------|-----------|--------------|
| D1 | Port 0x1F → all 4 channels (should be A only) | Critical | Yes | Bug (copied from MAME) |
| D2 | Port 0x3F → A+D (should be A only) | Critical | Yes | Bug (copied from MAME) |
| D3 | Missing per-port enable gating (bits 17–23) | Medium | Partial | Missing feature |
| D4 | Port 0xFB missing SD2 D-only behavior | Medium | Yes | Missing feature |
| D5 | NextReg 0x2C/0x2D/0x2E reads return DAC values | Medium | No | Bug |
| D6 | Multiface interaction on 0x1F/0x3F | Medium | No | Missing feature |
| D7 | DAC reset value (0x80 vs 0) | Low | Yes (MAME=0) | Klive correct ✓ |
| D8 | Per-channel gain 0.75 | Low | No | Design difference |
| D9 | Dead code DacPortDevice.ts | Low | N/A | Maintenance |
