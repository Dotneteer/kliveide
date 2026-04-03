# DivMMC Comparison Plan — FPGA (Truth) vs MAME vs Klive

## Reference Files

| Source | File |
|--------|------|
| FPGA (truth) | `_input/next-fpga/src/device/divmmc.vhd` |
| MAME | `_input/src/mame/sinclair/specnext_divmmc.cpp/.h` |
| MAME wiring | `_input/src/mame/sinclair/specnext.cpp` (lines 680–2900) |
| Klive device | `src/emu/machines/zxNext/DivMmcDevice.ts` |
| Klive memory | `src/emu/machines/zxNext/MemoryDevice.ts` (lines 745–900) |
| Klive machine | `src/emu/machines/zxNext/ZxNextMachine.ts` (NMI state machine, beforeOpcodeFetch) |

## Architecture Overview

### FPGA/MAME
The DivMMC device is a clock-driven state machine with:
- **Inputs**: CPU address bits, mreq_n, m1_n, enable, automap_reset, automap_active, automap_rom3_active, retn_seen, divmmc_button, divmmc_reg[7:0], plus 7 entry-point signals (instant_on, delayed_on, delayed_off, rom3_instant_on, rom3_delayed_on, nmi_instant_on, nmi_delayed_on).
- **Internal state**: `button_nmi`, `automap_hold`, `automap_held` — updated on clock edges.
- **Combinational outputs**: `automap`, `rom_en`, `ram_en`, `rdonly`, `ram_bank`, `disable_nmi`, `automap_held`.

The wiring layer (`specnext.cpp`) computes `automap_active` and `automap_rom3_active` as complex conditions involving ROM selection, Layer 2 state, ROMCS, and alt ROM. Entry-point signals are set by address-specific fetch interceptors before `do_m1()` is called.

MAME's `do_m1()` simulates 3 clock edges:
1. Pre-M1 (`mreq_n=1`): `automap_held ← automap_hold`
2. M1 (`mreq_n=0, m1_n=0`): `automap_hold` updated from entry-point signals
3. Post-M1 (`m1_n=1`): `automap_held ← automap_hold` (new value)

Between edges, `automap()` is read combinationally (includes instant-on terms) to determine paging.

### Klive
The DivMMC device uses `beforeOpcodeFetch()`/`afterOpcodeFetch()` hooks:
- `beforeOpcodeFetch`: checks PC against all entry points, sets `_autoMapActive` (instant) or `_requestAutomapOn` (delayed).
- `afterOpcodeFetch`: applies delayed requests, checks RETN.

Key differences: no separate `automap_hold`/`automap_held` pipeline; no distinction between `automap_active` and `automap_rom3_active` input conditions; conmem is mixed with automap state via `_conmemActivated`.

---

## Discrepancies

### D1 (Critical): 0x1FF8–0x1FFF unmap when NR BB bit 6 = 0

**FPGA**: `i_automap_delayed_off` is fed into the persistence term of `automap_hold`:
```vhdl
automap_held AND NOT (i_automap_active AND i_automap_delayed_off)
```
When `delayed_off = 0`, the persistence term is `automap_held AND 1` = `automap_held`. **Automap persists — no unmapping occurs.**

**MAME**: `automap_delayed_off_w(BIT(m_nr_bb_divmmc_ep_1, 6))`. When bit 6 = 0, `delayed_off = 0`, same result.

**Klive** (`checkRangeEntryPoints`):
```ts
if (this.automapOff1ff8) {
    this._requestAutomapOff = true;  // delayed unmap — correct
} else {
    this._autoMapActive = false;     // immediate unmap — WRONG
    this.machine.memoryDevice.updateFastPathFlags();
}
```
When `automapOff1ff8 = false` (NR BB bit 6 = 0), Klive **immediately unmaps**, but FPGA/MAME do nothing (automap persists). The `else` branch should be removed entirely — when the flag is false, the 1FF8–1FFF range should not trigger any automap change.

**Fix**: Remove the `else` branch so that when `automapOff1ff8` is false, no action is taken at 1FF8-1FFF.

---

### D2 (Critical): conmem + mapram page 0 reads DivMMC ROM instead of RAM bank 3

**FPGA**:
```vhdl
rom_en <= '1' when (page0 = '1' and (conmem = '1' or automap = '1') and mapram = '0') else '0';
ram_en <= '1' when (page0 = '1' and (conmem = '1' or automap = '1') and mapram = '1') or ... else '0';
ram_bank <= X"3" when page0 = '1' else i_divmmc_reg(3 downto 0);
```
When `conmem=1, mapram=1, page0`: `rom_en=0`, `ram_en=1`, `ram_bank=3`. **Reads DivMMC RAM bank 3.**

**MAME**: Same combinational logic in `rom_en()`, `ram_en()`, `ram_bank()`.

**Klive** (`MemoryDevice._readSlot0Complex`):
```ts
if (divMmcDevice.conmem) {
    readOffset = page ? OFFS_DIVMMC_RAM + (divMmcDevice.bank << 13) : OFFS_DIVMMC_ROM;
    //                                                                 ^^^^^^^^^^^^^^^^
    // page 0 always reads DIVMMC_ROM regardless of mapram
```
When `conmem=1, mapram=1, page0`: Klive reads `OFFS_DIVMMC_ROM`. Should read `OFFS_DIVMMC_RAM_BANK_3`.

**Fix**: In the conmem read path, page 0 should check `mapram`:
- `mapram=0`: read DivMMC ROM
- `mapram=1`: read DivMMC RAM bank 3

---

### D3 (Medium): conmem page 1 write missing mapram+bank3 protection

**FPGA**:
```vhdl
o_divmmc_rdonly <= '1' when page0 = '1' or (mapram = '1' and ram_bank = X"3") else '0';
```
When `conmem=1, page1, mapram=1, bank=3`: `rdonly=1`. **Write is blocked.**

**Klive** (`MemoryDevice._writeSlot0Complex`):
```ts
if (divMmcDevice.conmem) {
    if (!page) return; // Page 0 is read-only
    writeOffset = OFFS_DIVMMC_RAM + (divMmcDevice.bank << 13);
    this.memory[writeOffset + offset] = data;
    return;
}
```
Only page 0 is protected. Page 1 with `mapram=1, bank=3` is writable, but FPGA says read-only.

**Fix**: Add `mapram && bank === 3` write protection to the conmem write path.

---

### D4 (Critical): RETN incorrectly clears conmem register

**FPGA**: `i_retn_seen` clears `button_nmi`, `automap_hold`, `automap_held`. It does **NOT** modify `i_divmmc_reg` (the port 0xE3 register). conmem remains unchanged.

**MAME**: Same — `retn_seen` only affects the clocked state machine.

**Klive** (`handleRetnExecution`):
```ts
handleRetnExecution(): void {
    this._nmiButtonPressed = false;
    this._autoMapActive = false;
    this._conmemActivated = false;
    this._conmem = false;                                // ← NOT in FPGA!
    this._portLastE3Value = this._portLastE3Value & 0x7f; // ← NOT in FPGA!
    this.machine.memoryDevice.updateFastPathFlags();
}
```
Klive clears `_conmem` and bit 7 of `_portLastE3Value`. This is wrong — RETN should only clear automap state and button_nmi.

**Fix**: Remove the two lines that clear `_conmem` and modify `_portLastE3Value`.

---

### D5 (Medium): button_nmi not cleared when automap_held becomes true

**FPGA** (`button_nmi` process):
```vhdl
if i_reset = '1' or i_automap_reset = '1' or i_retn_seen = '1' then
    button_nmi <= '0';
elsif i_divmmc_button = '1' then
    button_nmi <= '1';
elsif automap_held = '1' then
    button_nmi <= '0';     -- ← cleared when automap is established
end if;
```

**Klive**: `_nmiButtonPressed` is only cleared in `handleRetnExecution()` and `reset()`. No clearing when automap becomes active.

**Impact**: After automap is established and then drops (e.g., via 1FF8 unmap), FPGA has `button_nmi=0` so `o_disable_nmi = automap(0) OR button_nmi(0) = 0` — NMI can be accepted again. Klive has `_nmiButtonPressed=1` so `divMmcNmiHold = _autoMapActive(0) || _nmiButtonPressed(1) = true` — NMI stays held, blocking new NMIs.

**Fix**: Clear `_nmiButtonPressed` when `_autoMapActive` transitions from false to true (or when the automap is first established after being armed).

---

### D6 (Medium): conmem sets _autoMapActive, incorrectly disabling NMI

**FPGA**: `o_disable_nmi = automap OR button_nmi`. conmem is **not** included in the `automap` signal. Setting conmem does not disable NMIs.

**Klive** (`checkManualConmem`):
```ts
if (this._conmem && !this._conmemActivated) {
    this._autoMapActive = true;      // ← makes divMmcNmiHold return true
    this._conmemActivated = true;
}
```
Since `divMmcNmiHold = _autoMapActive || _nmiButtonPressed`, setting conmem causes `divMmcNmiHold = true`, which prevents the NMI state machine from accepting new NMI sources.

**Fix**: Either:
(a) Stop setting `_autoMapActive` from conmem. The MemoryDevice already checks `divMmc.conmem` directly for paging, so the conmem→_autoMapActive path is unnecessary for memory mapping, OR
(b) Compute `divMmcNmiHold` from a separate automap-only signal that excludes conmem.

---

### D7 (Low): automap_reset doesn't clear button_nmi in Klive

**FPGA**: `button_nmi` cleared on `i_automap_reset = 1`.

**Klive**: `enableAutomap` setter clears `_autoMapActive` and `_conmemActivated` but **NOT** `_nmiButtonPressed`.

**Fix**: When `enableAutomap` is set to false, also clear `_nmiButtonPressed`.

---

### D8 (Medium): isRom3PagedIn check is incomplete for automap_rom3_active

**FPGA/MAME** (`specnext.cpp`):
```cpp
sram_divmmc_automap_rom3_en =
    ((sram_pre_override & 0x05) == 0x05)
    && !sram_layer2_map_en
    && !sram_romcs
    && ((sram_altrom_en && sram_pre_alt_128_n) || (sram_pre_rom3 && !sram_altrom_en));
```
This checks:
1. Correct override zone (DivMMC + ROMCS bits)
2. Layer 2 not mapped over ROM area
3. No expansion bus ROMCS
4. ROM 3 is selected (via alt ROM or standard ROM selection)

**Klive** (`isRom3PagedIn`):
```ts
return (this.machine.memoryDevice.selectedRomMsb | this.machine.memoryDevice.selectedRomLsb) === 0x03;
```
Only checks condition 4. Misses Layer 2, ROMCS, and alt ROM conditions.

**Impact**: Klive may activate ROM3 automap entry points when Layer 2 is mapped over the ROM area, or when ROMCS is active from the expansion bus. These are edge cases but could cause incorrect behavior.

**Fix**: Extend `isRom3PagedIn()` (or rename to `isRom3AutomapActive()`) to also check:
- Layer 2 is not mapped in the read path for the ROM area
- No expansion bus ROMCS override
- Alt ROM conditions

Note: This is more of a wiring/integration concern than a DivMMC device concern. The FPGA DivMMC device receives `rom3_active` as a pre-computed input. Klive chose to compute it inline, so the computation needs to match.

---

### D9 (Low, architectural): No separation of automap_active vs automap_rom3_active gate for RST traps

**FPGA**: RST traps produce 4 separate signals routed to different gates:
- `automap_instant_on` / `automap_delayed_on` → gated by `i_automap_active`
- `automap_rom3_instant_on` / `automap_rom3_delayed_on` → gated by `i_automap_rom3_active`

In `automap_hold`:
```vhdl
(i_automap_active AND (i_automap_instant_on OR i_automap_delayed_on OR nmi_instant OR nmi_delayed))
OR (i_automap_rom3_active AND (i_automap_rom3_instant_on OR i_automap_rom3_delayed_on))
```

**Klive**: `checkRstTraps` uses a single path:
```ts
if (trapInfo.onlyWithRom3 && !rom3Present) return;
this.setAutomapRequest(trapInfo.instantMapping);
```
- When `onlyWithRom3 = false`: no gate at all (equivalent to always `automap_active = true`)
- When `onlyWithRom3 = true`: gates on `isRom3PagedIn()` (incomplete, see D8)

For non-ROM3 traps, FPGA gates on `automap_active` (which depends on the current memory page configuration). Klive does not gate on any equivalent condition — the trap always fires if enabled. Since RST vectors are at 0x0000-0x0038 (page 0, ROM area), `automap_active` would typically be true, so this is unlikely to cause practical issues. But it's an architectural difference.

---

## Priority Summary

| ID | Severity | Description |
|----|----------|-------------|
| D1 | Critical | 1FF8 unmaps when flag is false (should do nothing) |
| D2 | Critical | conmem+mapram page0 reads ROM instead of RAM bank 3 |
| D3 | Medium | conmem page1 write missing mapram+bank3 protection |
| D4 | Critical | RETN clears conmem register (should only clear automap state) |
| D5 | Medium | button_nmi not cleared when automap_held established |
| D6 | Medium | conmem incorrectly sets _autoMapActive, disabling NMI |
| D7 | Low | automap_reset doesn't clear button_nmi |
| D8 | Medium | isRom3PagedIn missing Layer 2/ROMCS/altROM checks |
| D9 | Low | No automap_active vs rom3_active gate separation for RST traps |

## Implementation Order

Suggested order (critical bugs first, then medium, then low):
1. D1 — Simple fix, high impact
2. D4 — Simple fix, high impact
3. D2 — Fix in MemoryDevice read path
4. D3 — Fix in MemoryDevice write path
5. D6 — Decouple conmem from _autoMapActive
6. D5 — Add button_nmi clearing on automap establishment
7. D7 — Clear _nmiButtonPressed on automap_reset
8. D8 — Extend ROM3 check
9. D9 — Architectural — may not need fixing if D8 is done
