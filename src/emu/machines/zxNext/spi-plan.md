# ZX Spectrum Next — SPI SD Card Implementation Discrepancies

This document compares the MAME `spi_sdcard_device` + `specnext_state` SPI integration with the
Klive `SdCardDevice` + `SpiCsPortHandler` / `SpiDataPortHandler` implementation and lists every
discrepancy that must be resolved to reach parity.

**MAME source files**:
- `_input/src/devices/machine/spi_sdcard.h` / `spi_sdcard.cpp`
- `_input/src/mame/sinclair/specnext.cpp` (SPI integration layer)
- `_input/next-fpga/src/serial/spi_master.vhd` (hardware reference)

**Klive source files**:
- `src/emu/machines/zxNext/SdCardDevice.ts`
- `src/emu/machines/zxNext/io-ports/SpiCsPortHandler.ts` (stub — unused; inline in NextIoPortManager)
- `src/emu/machines/zxNext/io-ports/SpiDataPortHandler.ts` (stub — unused; inline in NextIoPortManager)
- `src/emu/machines/zxNext/io-ports/NextIoPortManager.ts` (actual port wiring)

---

## Discrepancy 1 — Port 0xE7 Chip-Select Logic

### MAME (`port_e7_reg_w`)
The write to port 0xE7 goes through a decode table before driving the two SS (slave-select) lines:

```cpp
// data bits: 7=FPGA flash, 3=RPi1, 2=RPi0, 1=SD1, 0=SD0  (active-low)
if      ((data & 3) == 0b10)   m_port_e7_reg = 0b11111100 | (!swap<<1) | swap;   // select SD0 (default) or SD1 (swapped)
else if ((data & 3) == 0x01)   m_port_e7_reg = 0b11111100 | (swap<<1)  | !swap;  // select SD1 (default) or SD0 (swapped)
else if ((data == 0xfb) || (data == 0xf7))  m_port_e7_reg = data;                // RPi CS lines
else if ((data == 0x7f) && config_mode)      m_port_e7_reg = 0x7f;               // FPGA flash
else                                          m_port_e7_reg = 0xff;               // deselect all

m_sdcards[0]->spi_ss_w(BIT(~m_port_e7_reg, 0));   // active-low: 0 in bit → selected
m_sdcards[1]->spi_ss_w(BIT(~m_port_e7_reg, 1));
```

`swap` is `m_nr_0a_sd_swap` (NextReg 0x0A bit 5) — swaps which physical slot is treated as "card 0".

### Klive (`NextIoPortManager.ts`, line ~362)
```ts
writerFns: (_, v) => { machine.sdCardDevice.selectedCard = v }
// SdCardDevice.selectedCard setter:
set selectedCard(value: number) {
    this._selectedCard = value === 0xfe ? 0 : 1;
}
```

### Gaps
| # | Missing in Klive |
|---|-----------------|
| 1a | `m_port_e7_reg` shadow register not maintained |
| 1b | SD swap (`nr_0a_sd_swap`, NextReg 0x0A bit 5) not consulted |
| 1c | Standard select values (`data & 3 == 0b10` / `0b01`) not decoded; only `0xfe` is recognised |
| 1d | RPi chip-select side-channels (0xfb / 0xf7) ignored |
| 1e | FPGA-flash CS (0x7f + config mode) ignored |
| 1f | `port_spi_io_en()` gate (NextReg internal_port_enable bit 11) not checked; port always active |

---

## Discrepancy 2 — SPI Layer Architecture (Bit-Serial vs. Byte-Level)

### MAME
Port 0xEB write dispatches an 8-cycle hardware SPI transfer via a timer:

```
spi_data_w(byte):
    m_spi_mosi_dat = byte
    for each of 8 half-cycles:
        drive MOSI bit on both sdcards[0/1]
        toggle CLK on both sdcards[0/1]

spi_data_r():
    return m_spi_miso_dat   // accumulated from spi_miso_w() callback
    trigger another 0xff send (clock-out more bits)

spi_miso_w(bit):            // called by the sdcard device on each falling CLK
    m_spi_miso_dat <<= 1
    m_spi_miso_dat |= bit
```

`spi_sdcard_device` clocks data one bit at a time through `latch_in()` / `shift_out()` and
updates `m_in_latch` / `m_out_latch` at every rising/falling CLK edge.

### Klive
Port 0xEB write/read call `writeMmcData(v)` / `readMmcData()` directly with whole bytes.
The SPI clock, MOSI, MISO bit-shift register, and CLK-edge simulation are all absent.

### Gaps
| # | Missing in Klive |
|---|-----------------|
| 2a | SPI bit-serial clock + MOSI/MISO shift-register layer not present |
| 2b | `m_spi_miso_dat` accumulator (MISO callback → byte) not present |
| 2c | Port 0xEB read does **not** automatically clock out a 0xFF byte (as MAME does) |
| 2d | CPOL=0 / CPHA=0 (Mode 0) — or Mode 3 — SPI signalling not modelled |
| 2e | `o_spi_wait_n` (DMA wait signal from FPGA `spi_master.vhd`) not driven |

> **Note**: A byte-level approximation (current Klive approach) is acceptable for functional
> emulation provided the byte-level protocol is correct; however gaps 2c–2e affect software
> that polls the data port or uses the DMA wait signal.

---

## Discrepancy 3 — Two Independent SD Card Instances

### MAME
```cpp
required_device_array<spi_sdcard_device, 2> m_sdcards;
// sdcards[0] and sdcards[1] are fully independent devices.
// MOSI and CLK are sent to BOTH cards simultaneously;
// only the selected one has SS asserted.
```

### Klive
One `SdCardDevice` instance with `_selectedCard` flag. If `_selectedCard != 0` all reads return
`0xff` and writes are silently dropped:

```ts
if (this._selectedCard) {
    // --- We can use only card 0
    return;
}
```

### Gaps
| # | Missing in Klive |
|---|-----------------|
| 3a | Card 1 has no independent state machine, CID, CSD, or storage path |
| 3b | All MOSI traffic is suppressed for card 1 (no error/deselect response cycle) |
| 3c | Simultaneous MOSI broadcast to inactive card not modelled |

---

## Discrepancy 4 — SD State Machine

### MAME
Full REF Table 4-1 state set:
`IDLE → READY → IDENT → STBY → TRAN → DATA → DATA_MULTI → RCV → PRG → DIS → INA`
plus internal `WRITE_WAITFE` / `WRITE_DATA`.

Transitions are driven by commands and responses; only valid state transitions are allowed.

### Klive
No explicit state machine. State is implicit in `_waitForBlock` flag + `_commandIndex` counter.
`_commandIndex` is reset to 0 on every new command byte; there is no notion of card state.

### Gaps
| # | Missing in Klive |
|---|-----------------|
| 4a | No card state variable (IDLE / READY / TRAN / DATA / etc.) |
| 4b | Card doesn't reject commands that are illegal in the current state |
| 4c | After a command returns R1=`0x01` (idle), the card is in IDLE state; ACMD41 / CMD1 are needed to advance to READY; Klive skips this |

---

## Discrepancy 5 — Missing and Incorrectly Implemented Commands

### CMD0 (GO_IDLE_STATE, 0x40)
- MAME: Returns `0x01` only if card exists; returns `0x00` + INA state if no card.
- Klive: Always returns `[0x01, 0xff, 0xff, 0xff, 0xff]` (5 bytes). MAME sends 1 byte.

### CMD1 (SEND_OP_COND, 0x41 in Klive encoding)
- MAME: Returns `0x00`, transitions to READY.
- Klive: **Not handled** (`default` case silently resets `_commandIndex`).

### CMD8 (SEND_IF_COND, 0x48)
- MAME: Returns `[0x01, 0x00, 0x00, 0x01, 0xaa]` → 5 bytes. ✅ matches Klive.

### CMD9 (SEND_CSD, 0x49)
- MAME: Returns `[0x00, 0xff, 0xfe, <16-byte CSD>, 0xCRC, 0xCRC]` → 3 + 16 + 2 = 21 bytes. CSD is dynamically computed from image geometry (SDv2 or SDHC).
- Klive: Returns a **hard-coded 20-byte** response `[0x00, 0xfe, 0x40, 0x00, 0x00, 0x5b, 0x50, 0x09, ...]`. Missing one byte, no CRC16, fixed values that don't match card size.

### CMD10 (SEND_CID, 0x4a)
- MAME: Returns `[0x00, 0xff, 0xfe, <16-byte CID>, <CRC16, 2 bytes>]` → 21 bytes.
- Klive: **Not handled**. CID is defined in `reset()` but CMD10 is absent from the command switch.

### CMD12 (STOP_TRANSMISSION, 0x4c)
- MAME: Returns `[0x00]` (1 byte R1), transitions to PRG or TRAN.
- Klive: Returns `[0x04, 0xff, 0xff, 0xff, 0xff]` (5 bytes, wrong R1 value 0x04 vs 0x00).

### CMD13 (SEND_STATUS, 0x4d)
- MAME: Returns `[0x00, 0x00]` (2-byte R2 = no errors).
- Klive: Returns `[0xff, 0x00, 0x00, 0xff]` — 4 bytes; extra leading/trailing `0xff` bytes are incorrect.

### CMD16 (SET_BLOCKLEN, 0x50)
- MAME: Adjusts `m_xferblk`; returns `0x00` (success) or `0x40` (parameter error).
- Klive: **Not handled**.

### CMD17 (READ_SINGLE_BLOCK, 0x51)
- MAME: Handles SDv2 (byte-addressed) and SDHC (block-addressed). Returns `[0x00, 0xff, 0xfe, <sector data>, <CRC16 2 bytes>]` — 3 + 512 + 2 = 517 bytes.
- Klive: SDHC-style only (argument treated as sector index). Returns `[0x00, 0xff, 0xfe, <sector data>]` — **no 2-byte CRC16 appended**. Async IPC response (correct for Klive architecture).

### CMD18 (READ_MULTIPLE_BLOCK, 0x52)
- MAME: Implemented via `SD_STATE_DATA_MULTI`; sends block tokens continuously; stopped by CMD12.
- Klive: **Not handled**.

### CMD24 (WRITE_BLOCK, 0x58)
- MAME: Returns `[0x00]` (1 byte), enters `WRITE_WAITFE` state. Waits for software to send `0xFE` token, then receives `m_xferblk` data bytes + 2 CRC bytes. Responds with `DATA_RESPONSE_OK` (0x05) or `DATA_RESPONSE_IO_ERROR` (0x0d).
- Klive: Returns intermediate `[0xff, 0x00]` (2 bytes). Allocates `_blockToWrite = new Uint8Array(3 + BYTES_PER_SECTOR)` — the extra 3 bytes suggest the `0xFE` token and 2 CRC bytes are partially expected, but `_dataIndex` starts at 0 and `_blockToWrite.length = 3 + 512`; the write data is sliced as `slice(1, 1 + 512)` discarding byte 0 and the last 2 bytes (no CRC check). The `0xFE` token byte is consumed as a data byte rather than a state transition trigger. Discrepancies:
  - No `WRITE_WAITFE` state — `0xFE` token not explicitly detected
  - `_blockToWrite` length is 3 + 512 but should be 1 (token) + 512 (data) + 2 (CRC) = 515 or just 512 data bytes after detecting the token separately
  - No CRC16 verification

### ACMD41 vs CMD41 (SD_SEND_OP_COND, 0x69)
- MAME: CMD41 without preceding CMD55 → illegal (returns `0xff`, INA state). ACMD41 (CMD55 then CMD41) → returns `0x00`, READY state.
- Klive: CMD41 (0x69) always resets `_commandIndex` with no response, regardless of CMD55 prefix.

### CMD55 (APP_CMD, 0x77)
- MAME: Returns `[0x01]` (R1 = idle), sets `m_bACMD = true` so next command is treated as ACMD.
- Klive: Sets `_responseIndex = -1` when `_commandIndex == 5` (no bytes sent). `m_bACMD` equivalent (`_bACMD`) is absent.

### CMD58 (READ_OCR, 0x7a)
- MAME: Returns `[0x00, OCR3, OCR2, OCR1, OCR0]`; OCR bit 30 (CCS) set for SDHC, cleared for SDv2; bit 31 (busy) = 1.
- Klive: Returns `this._ocr = [0x00, 0xc0, 0xff, 0x80, 0x00]`. Bit 30 is set (0xc0 = 0b11000000) which always reports SDHC regardless of actual card type.

### CMD59 (CRC_ON_OFF, 0x7b)
- MAME: Enables/disables CRC checking via `m_crc_off`.
- Klive: **Not handled**.

---

## Discrepancy 6 — CRC Handling

### MAME
- Command CRC7 is checked on every command byte (`(m_cmd[5] & 1) || m_crc_off`).
- CRC16 is appended after every data block in read responses (`util::crc16_creator::simple`).
- CMD59 enables/disables CRC checking at runtime.
- CSD has a CRC7 field (computed but noted as TODO in current code).
- CID has a CRC16 appended after the 16-byte payload.

### Klive
- `calculateCRC7` exists and is used only to populate `_cid[15]` at init time.
- No CRC16 is appended to `setReadResponse` sector data.
- No command CRC7 validation.
- No CMD59 support.

### Gaps
| # | Missing in Klive |
|---|-----------------|
| 6a | No CRC16 (2 bytes) appended after sector data in read responses |
| 6b | No CRC16 appended after CID payload (CMD10) |
| 6c | Command CRC7 not validated |
| 6d | CMD59 (CRC_ON_OFF) not handled |

---

## Discrepancy 7 — CSD Register (CMD9 Response)

### MAME
CSD is dynamically built in `image_loaded()` from the actual CHD image geometry:
- Detects SDv2 (CSD v1.0) or SDHC (CSD v2.0) based on image size and preferred type.
- Correctly encodes `C_SIZE`, `C_SIZE_MULT`, `READ_BL_LEN`, etc.
- `CSD[3]` = `TRAN_SPEED` = 0x32 (25 MHz) or 0x5a (50 MHz).

### Klive
Hard-coded 20-byte response for CMD9:
```ts
new Uint8Array([0x00, 0xfe, 0x40, 0x00, 0x00, 0x5b, 0x50, 0x09, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff])
```
- Only 20 bytes instead of the correct 21 (3 header + 16 CSD + 2 CRC16).
- CSD bytes are fixed and do not reflect actual SD card size.
- CRC16 bytes are `0xffff` (invalid).

---

## Discrepancy 8 — SDv2 vs. SDHC Command Argument Interpretation

### MAME
- **SDHC** (`SD_TYPE_HC`): CMD17/18/24 arguments are **block numbers** (no conversion).
- **SDv2** (`SD_TYPE_V2`): CMD17/18/24 arguments are **byte offsets** → divided by block size to get LBA.

### Klive
Always treats CMD17/CMD24 arguments as block numbers (SDHC-style).
No SDv2 byte-offset → LBA conversion present.

---

## Discrepancy 9 — Read Response Delay Model

### MAME
Each response in the `m_data[]` buffer is prefixed with `m_out_delay` idle bytes (default `SPI_DELAY_RESPONSE = 1`).
The delay is expressed in **SPI bytes** (one dummy `0xff` byte before the first R1 byte).

### Klive
`READ_DELAY = 56` T-states delay (checked via `this.machine.tacts - this._lastByteReceived`).
This is a timing approximation in Z80 T-states, not standard SPI byte-count delay.
The `_responseReady` flag further short-circuits the delay for IPC-backed reads.

---

## Discrepancy 10 — Port Enable Gating

### MAME
`port_spi_io_en()` returns `BIT(internal_port_enable(), 11)`.  
Ports 0xE7 and 0xEB are **silently ignored** when the SPI enable bit is off.

### Klive
No `port_spi_io_en` check.  
The SPI ports are always active regardless of the enable register.

---

## Discrepancy 11 — SPI MOSI Broadcast to Both Cards

### MAME
When `spi_data_w` is called, MOSI bits are driven to **both** `m_sdcards[0]` and `m_sdcards[1]`
simultaneously. Each card independently processes the bits; only the card with SS asserted
actually acts on them.

### Klive
Only the selected card (always card 0) receives data. Card 1 is completely inert.

---

## Summary Table

| # | Area | MAME Behaviour | Klive Behaviour | Priority |
|---|------|---------------|-----------------|----------|
| 1 | CS port 0xE7 decode | Full decode with SD-swap and config-mode guards | Only checks `value === 0xfe` | 🔴 High |
| 2 | SPI layer | Bit-serial CLK/MOSI/MISO | Byte-level direct call | 🟡 Medium |
| 3 | Dual SD cards | 2 independent `spi_sdcard_device` instances | 1 device with inactive card 1 | 🟡 Medium |
| 4 | State machine | 13 states, strict transitions | None (implicit flags only) | 🔴 High |
| 5a | CMD0 response length | 1 byte | 5 bytes | 🔴 High |
| 5b | CMD1 | Returns `0x00`, → READY | Not handled | 🔴 High |
| 5c | CMD9 CSD layout | 3+16+2 bytes, dynamic | 20 bytes, static | 🔴 High |
| 5d | CMD10 (SEND_CID) | 3+16+2 bytes | Not handled | 🟡 Medium |
| 5e | CMD12 R1 value | `0x00` | `0x04` | 🔴 High |
| 5f | CMD13 format | `[0x00, 0x00]` (R2) | `[0xff, 0x00, 0x00, 0xff]` | 🟡 Medium |
| 5g | CMD16 | Adjusts xferblk | Not handled | 🟡 Medium |
| 5h | CMD17 response | + 2 CRC16 bytes appended | No CRC16 | 🔴 High |
| 5i | CMD18 | Multi-block read via DATA_MULTI | Not handled | 🟡 Medium |
| 5j | CMD24 write flow | WRITE_WAITFE→token detect→data+CRC | No token state, no CRC check | 🔴 High |
| 5k | ACMD41 vs CMD41 | ACMD41 advances to READY; CMD41 alone is illegal | Only resets index, no response | 🔴 High |
| 5l | CMD55 response | Returns `[0x01]`, sets ACMD flag | No response byte sent | 🔴 High |
| 5m | CMD58 OCR CCS bit | Dynamic (SDHC or SDv2) | Always SDHC (bit 30 always set) | 🟡 Medium |
| 5n | CMD59 | CRC on/off | Not handled | 🟢 Low |
| 6  | CRC16 on data blocks | Appended on reads | Missing | 🔴 High |
| 7  | CSD dynamic | Computed from image | Hard-coded | 🟡 Medium |
| 8  | SDv2 byte offset | Argument ÷ blksize for SDv2 | Always block-addressed | 🟡 Medium |
| 9  | Read delay model | SPI byte count (1 dummy byte) | T-state countdown | 🟢 Low |
| 10 | Port SPI enable | Gated by NextReg bit | Always enabled | 🟡 Medium |
| 11 | MOSI broadcast | Both cards | Selected card only | 🟢 Low |

---

## Recommended Fix Order

### Step 1 — Fix SD state machine and essential commands (🔴 High)
1. Add explicit `SdState` enum (`IDLE`, `READY`, `TRAN`, `DATA`, `WRITE_WAITFE`, `WRITE_DATA`).
2. Correct CMD0: return 1 byte, transition to IDLE; return `0x00` + INA if no card.
3. Add CMD1: return `[0x00]`, transition to READY.
4. Add CMD55: return `[0x01]`, set `_bACMD = true`.
5. Fix ACMD41 / CMD41 distinction using `_bACMD`.
6. Fix CMD12: return `[0x00]`, 1 byte.
7. Fix CMD24 write flow: detect `0xFE` token (state transition); receive exactly 512 + 2 bytes; slice only 512 data bytes for IPC write.
8. Add CRC16 (2 bytes) to CMD17 read response.

### Step 2 — Fix CS port 0xE7 (🔴 High)
1. Implement full `port_e7_reg_w` decode table in `SpiCsPortHandler.ts` (or inline in `NextIoPortManager.ts`).
2. Consult NextReg 0x0A bit 5 (`sd_swap`) when `data & 3` is `0b10` or `0b01`.
3. Maintain shadow register `_portE7Reg`.
4. Add `port_spi_io_en()` gate.

### Step 3 — Fix CMD9 CSD and CMD10 CID (🟡 Medium after Step 1)
1. CMD9: Return 21-byte response (3 header + 16 CSD + 2 CRC16). Build CSD dynamically from reported card size.
2. CMD10: Implement; reuse existing `_cid` array + compute CRC16.

### Step 4 — Fix CMD13, CMD16, CMD18 (🟡 Medium)
1. CMD13: Return 2-byte R2 response.
2. CMD16: Update `_xferblk`.
3. CMD18: Implement multi-block streaming if needed.

### Step 5 — Dual card support (🟡 Medium)
1. Replace single `SdCardDevice` with two instances or a 2-slot device.
2. Wire card 1 IPC path to a second storage slot.

### Step 6 — Remaining gaps to reach full implementation (🟡 Medium)

The following items are still open after Steps 1–5:

1. **CMD18 (READ_MULTIPLE_BLOCK, 0x52)** — Implement `DATA_MULTI` state in card 0.
   CMD18 should store `m_blknext`, send R1 `[0x00]`, then continuously issue IPC
   `sd-read` for successive sectors, prepending each with a `0xFE` data token and
   appending CRC16. CMD12 stops the transfer. Some NextZXOS operations depend on
   multi-block reads for performance.
   - Add `SdState.DATA_MULTI` to the enum.
   - In `readMmcData`, when the current response is fully consumed and
     `_state === DATA_MULTI`, automatically trigger the next block read IPC.
   - CMD12 transitions from `DATA_MULTI` to `TRAN`.

2. **CMD59 (CRC_ON_OFF, 0x7B)** — Toggle `_crcOff` flag (🟢 Low).
   MAME uses this to allow invalid CRC7 on incoming commands when CRC is disabled.
   Klive currently ignores CRC7 on all commands unconditionally, so the only
   observable difference is the R1 response byte. Add the case and return `[0x00]`.

3. **Wire `setCardInfo` to the main process** — The `SdCardDevice.setCardInfo(totalSectors)`
   method exists but is never called. The `CimHandler` on the main process knows the
   card geometry (`CimInfo.maxSize` in MB, `CimInfo.clusterCount`, etc.). During machine
   start-up (or when the SD card image is mounted), the main process should send the
   total sector count via IPC so that `buildCsd()` produces an accurate CSD register
   instead of falling back to the 4 GB default.
   - Add a `getSdCardInfo` method to `MainApi` that returns `{ totalSectors: number }`.
   - Call it from `ZxNextMachine` during `setup()` or the first `processFrameCommand`
     round, and forward the result to `sdCardDevice.setCardInfo(totalSectors)`.
   - Compute `totalSectors` from `CimInfo`:
     `totalSectors = maxSize * 1024 * 1024 / (sectorSize * 512)`.

4. **Card 1 IPC storage path** — Card 1's state machine responds to init commands but
   returns `0x40` (parameter error) for all data commands because there is no IPC
   storage path. To fully support dual cards, add a second `CimHandler` instance on the
   main-process side keyed to a separate SD card image file, and add `sd-read-card1` /
   `sd-write-card1` frame command variants. Low priority unless software explicitly
   accesses card 1 for data.
