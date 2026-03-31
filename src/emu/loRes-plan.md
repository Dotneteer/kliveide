# LoRes Rendering Discrepancy Plan

Comparison of **MAME** (`specnext_lores.cpp` / `specnext.cpp`), **FPGA** (`lores.vhd` / `zxnext.vhd`), and
**Klive** (`NextComposedScreenDevice.ts`) implementations of the ZX Spectrum Next LoRes video mode.

The FPGA is the authoritative reference. MAME discrepancies from the FPGA are noted but not
treated as Klive bugs.

---

## D1 — Radastan ULA+ Palette Index: Bit Shift Error

**Severity:** High — produces wrong colors for all Radastan pixels when ULA+ is active.

### FPGA (`lores.vhd` lines 107–112)

```vhdl
pixel_rad_nib_H <= lores_palette_offset_i when ulap_en_i = '0'
                   else ("11" & lores_palette_offset_i(1 downto 0));
lores_pixel_o   <= (pixel_rad_nib_H & pixel_rad_nib_L) when mode_i = '1' ...
```

Concatenation (`&` in VHDL) places `pixel_rad_nib_H` in bits [7:4]:

```
paletteIndex = ((0b1100 | (offset & 3)) << 4) | nibble
```

For `offset = 3, nibble = 5`: index = **0xF5**.

### MAME (`specnext_lores.cpp` line 50)

```cpp
if (m_mode) pen_base |= (((m_ulap_en ? 0b1100 : 0) | m_lores_palette_offset) << 4);
```

Same result: `(0xF << 4) | 5` = **0xF5**. ✓

### Klive (`NextComposedScreenDevice.ts` line ~2069)

```typescript
paletteIndex = 0xc0 | ((this.loResPaletteOffset & 0x03) << 2) | nibble;
```

`<< 2` shifts the offset bits to positions [3:2] instead of [5:4]:

`0xC0 | (3 << 2) | 5` = `0xC0 | 0x0C | 0x05` = **0xCD** ← wrong.

### Fix

Change `<< 2` to `<< 4`:

```typescript
paletteIndex = 0xC0 | ((this.loResPaletteOffset & 0x03) << 4) | nibble;
```

---

## D2 — Radastan Timex Display File: Missing XOR with Port FF Bit 0

**Severity:** Medium — selects the wrong 6 KiB RAM region whenever the Timex screen mode
register (port 0xFF, bit 0) is non-zero.

### FPGA (`zxnext.vhd` line 6742)

```vhdl
lores_dfile_0 <= port_ff_screen_mode(0) xor nr_6a_lores_radastan_xor;
```

The actual display-file selector is the **XOR** of Timex port FF bit 0 and NR 0x6A bit 4.

### MAME (`specnext.cpp` line 269)

```cpp
void nr_6a_lores_radastan_xor_w(bool data) {
    m_nr_6a_lores_radastan_xor = data;
    m_lores->dfile_w(BIT(m_port_ff_data, 0) != m_nr_6a_lores_radastan_xor);
}
```

`!=` on booleans is XOR. Same result. ✓

### Klive (`NextComposedScreenDevice.ts` line ~2022)

```typescript
blockAddr = (this.loResRadastanTimexXor ? 0x2000 : 0) | ((y >> 1) << 6) | (x >> 2);
```

`loResRadastanTimexXor` is the raw NR 0x6A bit 4 value — port FF bit 0 is **not** factored in.

### Fix

Introduce a derived property that XORs the two bits and use it for the address:

```typescript
const dfile = (this.timexScreenModeBit0 !== this.loResRadastanTimexXor);
blockAddr = (dfile ? 0x2000 : 0) | ((y >> 1) << 6) | (x >> 2);
```

The Timex port FF bit 0 value must be tracked (it may already exist on the composed-screen
device or the machine's I/O layer).

---

## D3 — LoRes Always Reads Bank 5, Not Shadow Screen

**Severity:** Medium — when the 128K shadow-screen bit (port 7FFD bit 3) is set, Klive reads
LoRes data from bank 7 instead of bank 5.

### FPGA (`zxnext.vhd` lines 6577, 4246–4247)

```vhdl
vram_bank5_a0 <= ... lores_addr;          -- dedicated bank 5 arbitrator
lores_data_i  <= lores_vram_di;           -- always from bank 5
```

LoRes has its own port on the bank-5 SRAM arbitrator. It **never** accesses bank 7.

### MAME (`specnext_lores.cpp` line 53)

```cpp
const u8 *screen_location = m_host_ram_ptr + (5 << 14);   // always bank 5
```

Hard-coded to bank 5. ✓

### Klive (`NextComposedScreenDevice.ts` line ~2026)

```typescript
this.loResBlockByte = this.machine.memoryDevice.readScreenMemory(blockAddr);
```

Where `readScreenMemory` is:

```typescript
readScreenMemory(offset: number): number {
    return this.memory[(this.useShadowScreen ? OFFS_BANK_07 : OFFS_BANK_05) + (offset & 0x3fff)];
}
```

If `useShadowScreen === true`, LoRes reads the wrong bank.

### Fix

Read directly from bank 5 instead of going through `readScreenMemory`:

```typescript
this.loResBlockByte = this.machine.memoryDevice.memory[OFFS_BANK_05 + (blockAddr & 0x3fff)];
```

Or add a dedicated `readBank5(offset)` helper.

---

## D4 — Radastan ULA+ Guard: Missing ULANext Disable Check

**Severity:** Low–Medium — when ULANext mode (NR 0x43 bit 0) is active, Radastan ULA+ palette
translation should be disabled but Klive still applies it.

### FPGA (`zxnext.vhd` line 4227)

```vhdl
ulap_en_i => ulap_en_0 and not ulanext_en_0,
```

ULA+ is passed to the LoRes module only when ULA+ is enabled **AND** ULANext is **not** enabled.

### MAME (`specnext.cpp` line 257)

```cpp
m_lores->ulap_en_w(m_port_ff3b_ulap_en && !m_nr_43_ulanext_en);
```

Same logic. ✓

### Klive (`NextComposedScreenDevice.ts` line ~2068)

```typescript
if (this.ulaPlusEnabled) {
    paletteIndex = 0xc0 | ...;   // ULA+ path
```

`ulaPlusEnabled` (NR 0x68 bit 3) is checked alone; there is no `!ulaNextEnabled` guard.

### Fix

Add the ULANext guard:

```typescript
if (this.ulaPlusEnabled && !this.ulaNextEnabled) {
```

---

## D5 — Radastan Pre-Fetch: Stale Data for Certain Scroll Offsets

**Severity:** Low — first 1–2 pixels of every scanline show stale data from the previous
scanline when `scrollX & 3` is 2 or 3 (Radastan mode only).

### FPGA / MAME

Both compute the display address inline for every block boundary, so the first visible pixel
always receives correct data regardless of scroll offset.

### Klive (`NextComposedScreenDevice.ts` line ~1993)

The block fetch is gated by `shouldFetch`:

```typescript
if ((cell & SCR_BYTE1_READ) !== 0) {
    const x = (this.loResDisplayHC + this.loResScrollXSampled) & 0xff;
    const shouldFetch = !this.loResRadastanModeSampled
        ? (x & 0x01) === 0
        : (x & 0x03) === 0;
    if (shouldFetch) { /* fetch block */ }
}
```

At the **pre-display** position (`displayHC = −1`), `x = (scrollX − 1) & 0xFF`. For
Radastan with `scrollX & 3 ∈ {2, 3}`: pre-display `x & 3 ≠ 0` → no fetch. First display
position `x & 3 ≠ 0` → also no fetch. `loResBlockByte` retains stale data until
`displayHC` advances to the next 4-pixel block boundary.

| `scrollX & 3` | Pre-display x & 3 | 1st display x & 3 | Stale pixels |
|:-:|:-:|:-:|:-:|
| 0 | 3 (no fetch) | 0 (fetch) ✓ | 0 |
| 1 | 0 (fetch) ✓ | 1 (skip) | 0 |
| 2 | 1 (no fetch) | 2 (no fetch) | 2 |
| 3 | 2 (no fetch) | 3 (no fetch) | 1 |

### Fix

At the pre-display position, always perform the fetch unconditionally (skip the
`shouldFetch` check). The pre-display `x` and the first display `x` are always in the same
4-pixel block (differ by 1), so the loaded byte is valid for both:

```typescript
if ((cell & SCR_BYTE1_READ) !== 0) {
    const x = (this.loResDisplayHC + this.loResScrollXSampled) & 0xff;
    const isPreDisplay = (cell & SCR_DISPLAY_AREA) === 0;
    const shouldFetch = isPreDisplay
        || (!this.loResRadastanModeSampled ? (x & 0x01) === 0 : (x & 0x03) === 0);
    if (shouldFetch) { /* fetch block */ }
}
```

---

## MAME-Only Discrepancies (not Klive bugs)

These are MAME deviations from the FPGA that Klive already handles correctly.

### M1 — Y Wrapping Uses Modulo 192 Instead of FPGA Bit-Add

**MAME:** `y = ((vpos - offset + scrollY) % 192) >> 1`
**FPGA:** `y(7:6) = (y_pre(7:6) + 1) when y_pre >= 192` (bit-add, not modulo)
**Klive:** Uses `loResYWrapTable` which implements the FPGA bit-add formula. ✓

### M2 — Standard LoRes Palette Offset Not Applied

**MAME:** In standard (non-Radastan) mode, `lores_palette_offset` is **not** added to the
upper nibble. The raw byte is used directly as the palette index.
**FPGA:** Always applies offset: `pixel_lores_nib_H = data(7:4) + palette_offset`.
**Klive:** Applies offset to upper nibble. ✓

---

## Reference Files

| Source | Path |
|--------|------|
| FPGA LoRes module | `_input/next-fpga/src/video/lores.vhd` |
| FPGA integration | `_input/next-fpga/src/zxnext.vhd` |
| MAME LoRes header | `_input/src/mame/sinclair/specnext_lores.h` |
| MAME LoRes source | `_input/src/mame/sinclair/specnext_lores.cpp` |
| MAME integration | `_input/src/mame/sinclair/specnext.cpp` |
| Klive LoRes code | `src/emu/machines/zxNext/screen/NextComposedScreenDevice.ts` (lines ~1925–2095) |
| Klive memory | `src/emu/machines/zxNext/MemoryDevice.ts` (`readScreenMemory`) |
| Klive NR 0x6A | `src/emu/machines/zxNext/NextRegDevice.ts` (line ~1457) |
