# Multiface Device: MAME vs Klive Discrepancies

Comparison of the MAME implementation (`_input/src/mame/sinclair/specnext_multiface.cpp/.h`) and
the FPGA reference (`_input/next-fpga/src/device/multiface.vhd`) against the Klive implementation
(`src/emu/machines/zxNext/MultifaceDevice.ts`, `ZxNextMachine.ts`, `DivMmcDevice.ts`).

---

## D1: Port writes are no-ops (Klive matches MAME, both differ from FPGA)

**FPGA** (`multiface.vhd` lines 142–147, 157–161):
Port writes (`port_mf_enable_wr`, `port_mf_disable_wr`) clear `nmi_active` and set `invisible`,
gated by `port_io_dly = '0'` (one-cycle edge detection prevents re-triggering).

**MAME** (`specnext_multiface.cpp` `clock_w()`):
`port_io_dly` is computed as a local variable from the **current** port signals. Since the port
signals are still active when `clock_w()` runs, `port_io_dly` is always true → the port-write
conditions for `nmi_active` and `invisible` are permanently blocked. Effectively **port writes
never change `nmi_active` or `invisible`**.

**Klive** (`MultifaceDevice.ts` `writeEnablePort` / `writeDisablePort`):
Both methods are explicit no-ops.

**Assessment**: Klive matches MAME. No action needed.

---

## D2: Disable port **read** does not clear `nmi_active` in MF+3 mode

**FPGA** (`multiface.vhd` line 145):
`port_mf_disable_rd_i = '1' and mode_p3 = '1'` clears `nmi_active` (gated by `port_io_dly = '0'`).

**MAME**: Same `port_io_dly` blocking as D1 — condition never fires.

**Klive** (`readDisablePort`): Only clears `mfEnabled`, does not touch `nmiActive`.

**Assessment**: Klive matches MAME. No action needed.

---

## D3: Missing `enable_i` gating / reset-on-disable

**FPGA** (`multiface.vhd` line 103):
```vhdl
reset <= reset_i or not enable_i;
```
When `enable_i = '0'`, the device is held in reset: `nmi_active = 0`, `mf_enable = 0`,
`invisible = 1`, `port_io_dly = 0`.

**MAME** (`specnext_multiface.h` lines 30–32):
Output signals are gated by `m_enable`:
```cpp
bool nmi_disable_r() { return m_enable && m_nmi_active; }
bool mf_enabled_r() { return m_enable && mf_enable_eff(); }
bool mf_port_en_r() { return m_enable && (...); }
```
Internal state is **not** reset when `m_enable` goes low — only the outputs are suppressed.

**Klive**:
`MultifaceDevice` has **no** `enabled` property. The enable concept appears only indirectly
through `divMmcDevice.enableMultifaceNmiByM1Button` in `ZxNextMachine.updateNmiSources()`.

Consequences:
- The `nmiHold` getter (`= nmiActive`) is not gated by enable — it returns raw state.
- The `isActive` getter (`= mfEnabled || nmiActive`) is not gated by enable.
- If the multiface is disabled via nextreg 0x0A while internal state is set, stale `nmiActive`
  or `mfEnabled` could leak into NMI state machine decisions or memory mapping.

**Assessment**: Klive should add an `enabled` property to `MultifaceDevice` and:
1. Gate output-like getters (`nmiHold`, `mfEnabledEff`, `isActive`) by `enabled`.
2. Or reset internal state when `enabled` transitions to false (matching FPGA).

---

## D4: `onRetnExecuted()` — `mf_enable` clearing is gated by `nmiActive`

**FPGA** (`multiface.vhd` line 178):
```vhdl
elsif port_mf_disable_rd_i = '1' or cpu_retn_seen_i = '1' then
    mf_enable <= '0';
```
`cpu_retn_seen` clears `mf_enable` **unconditionally** (regardless of `nmi_active`).

**MAME** (`specnext_multiface.cpp` `clock_w()` line 74):
```cpp
if (m_port_mf_disable_rd || m_cpu_retn_seen)
    m_mf_enable = 0;
```
Also unconditional.

**Klive** (`ZxNextMachine.ts` `onRetnExecuted()` line 1033):
```typescript
if (this.multifaceDevice.nmiHold) {
    this.multifaceDevice.handleRetn();
}
```
`handleRetn()` is only called when `nmiHold` (= `nmiActive`) is true.

If `nmiActive` has somehow been cleared before RETN while `mfEnabled` is still true,
Klive would skip clearing `mfEnabled`, leaving MF memory mapped.

**Assessment**: The guard should check `mfEnabled` (or `mfEnabledEff`) instead of / in
addition to `nmiHold`, to match the unconditional FPGA/MAME clearing of `mf_enable`.

---

## D5: DivMMC never receives RETN signal (critical)

**FPGA** (`zxnext.vhd` line 4091):
```vhdl
divmmc_retn_seen <= z80_retn_seen_28 AND NOT mf_is_active;
```
DivMMC receives RETN when multiface is **not** active (`mf_is_active = mf_mem_en OR mf_nmi_hold`).

**MAME** (`specnext.cpp` `leave_nmi()` lines 2727–2731):
```cpp
m_mf->cpu_retn_seen_w(1);
m_mf->clock_w();
m_divmmc->retn_seen_w(1);   // unconditional — no mf_is_active gate
m_divmmc->clock_w();
```
DivMMC receives RETN unconditionally (MAME does not implement the `mf_is_active` gate).

**Klive** (`ZxNextMachine.ts` `onRetnExecuted()`):
- No call to `divMmcDevice.handleRetnExecution()`.
- `DivMmcDevice.checkAndHandleRetn()` in `afterOpcodeFetch()` is **dead code** because
  `retnExecuted` is always false at that point:
  - `retnExecuted` is cleared at the start of `executeCpuCycle()`.
  - `afterOpcodeFetch()` runs during the M1 cycle (after opcode read, before execution).
  - RETN (ED 45) sets `retnExecuted` during instruction execution, which happens **after**
    `afterOpcodeFetch()`.
  - For the ED prefix cycle: `m1Active = (prefix === None)` → false when prefix is ED,
    so `afterOpcodeFetch()` is not called during the RETN execution cycle.
  - On the next cycle, `retnExecuted` has already been reset to false.

**Consequence**: DivMMC state (`button_nmi`, `automap_hold`, `automap_held`) is **never** cleared
by RETN execution. In FPGA/MAME, RETN clears `button_nmi`, `automap_hold`, and `automap_held`.

**Assessment**: `onRetnExecuted()` must route the RETN signal to DivMMC, ideally gating by
`NOT mf_is_active` (matching FPGA) or unconditionally (matching MAME). The dead
`checkAndHandleRetn()` code in `afterOpcodeFetch()` should be removed or documented.

---

## D6: `handleRetnExecution()` clears too much state

**FPGA** (`divmmc.vhd` `clock_w` lines 69–91):
`retn_seen` clears only:
- `button_nmi`
- `automap_hold`
- `automap_held`

**MAME** (`specnext_divmmc.cpp` `clock_w()`):
Same three fields cleared.

**Klive** (`DivMmcDevice.ts` `handleRetnExecution()`):
```typescript
this._nmiButtonPressed = false;   // ✓ matches button_nmi
this._autoMapActive = false;      // ~ maps to automap_held (but named differently)
this._conmemActivated = false;    // ✗ NOT cleared by RETN in FPGA/MAME
this._conmem = false;             // ✗ NOT cleared by RETN in FPGA/MAME
this._portLastE3Value &= 0x7f;   // ✗ NOT cleared by RETN in FPGA/MAME
```

`conmem` (port 0xE3 bit 7) is a user-controlled register. Clearing it on RETN would lose the
user's DivMMC configuration. FPGA/MAME never touch `conmem` on RETN.

Also note: Klive clears `_autoMapActive` but MAME's equivalent fields are `automap_hold` and
`automap_held` (two-stage pipeline). Klive uses a single `_autoMapActive` flag, which is a
simplification. The FPGA has:
```
button_nmi:  cleared by retn_seen
automap_hold: cleared by retn_seen (registered hold request)
automap_held: cleared by retn_seen (actual held state, delayed by one cycle)
```

**Assessment**: Remove the conmem clearing (`_conmemActivated`, `_conmem`, `_portLastE3Value`
bit 7) from `handleRetnExecution()`. These should only change via explicit port 0xE3 writes.

---

## D7: Missing `mf_enable_eff` combinatorial output

**FPGA** (`multiface.vhd` lines 183, 188):
```vhdl
mf_enable_eff <= mf_enable or fetch_66;
mf_enabled_o  <= mf_enable_eff;
```
The memory-enable output includes a combinatorial term so that MF memory is visible
**during** the fetch at 0x0066 (before the registered `mf_enable` is set on the clock edge).

**MAME** (`specnext_multiface.h` line 31):
```cpp
bool mf_enabled_r() { return m_enable && mf_enable_eff(); }
```

**Klive**:
No `mfEnabledEff` getter. `onFetch0066()` imperatively sets `mfEnabled = true` before the
memory read, which achieves the same effect for opcode fetch. However, any code checking
"is MF memory currently visible?" would need to account for the fetch_66 case.

**Assessment**: Minor — functionally equivalent for the opcode fetch path. Consider adding a
`mfEnabledEff` getter if other code needs to query the effective memory-enable state.

---

## D8: `mf_port_en_o` not modeled

**FPGA** (`multiface.vhd` line 195):
```vhdl
mf_port_en_o <= '1' when port_mf_enable_rd_i = '1' and invisible_eff = '0'
                        and (mode_128 = '1' or mode_p3 = '1') else '0';
```
This signal enables forwarding certain port reads through the MF memory map
(e.g., port 0x1F3F → port 0x1FFD, port 0x7F3F → port 0x7FFD in MF128/+3 modes).

**MAME** (`specnext_multiface.h` line 32):
```cpp
bool mf_port_en_r() { return m_enable && (m_port_mf_enable_rd && !invisible_eff()
                                           && (mode_128() || mode_p3())); }
```

**Klive**: Not modeled.

**Assessment**: Low priority — only affects MF128/+3 port-read forwarding which is a niche
MF ROM feature.

---

## D9: Debug logging in production code

**Klive** (`MultifaceDevice.ts` `onFetch0066()` line 155):
```typescript
console.log(`[NMI] onFetch0066: mfEnabled=true MF_ROM[0x0066]=0x${b0066.toString(16)} ...`)
```

**Assessment**: Remove or guard behind a debug flag.

---

## D10: DivMMC `automap()` vs MAME `automap()`

**MAME** (`specnext_divmmc.cpp`):
```cpp
bool automap() const noexcept {
    return !m_automap_reset && (m_automap_held
        || (m_automap_active && (m_automap_instant_on || automap_nmi_instant_on()))
        || (m_automap_rom3_active && m_automap_rom3_instant_on));
}
```
This is a combinatorial function with `automap_held` (registered) and instant-on conditions.

**Klive** uses `_autoMapActive` as a single flag, without the two-stage `automap_hold` →
`automap_held` pipeline or the combinatorial `automap()` function.

**Assessment**: The simplified single-flag approach may produce different timing for automap
activation/deactivation. The FPGA's pipeline ensures automap changes take effect on the correct
clock boundary. This is a structural difference but may not cause issues in typical usage.

---

## D11: DivMMC `o_disable_nmi` mapping

**FPGA** (`divmmc.vhd` line 188):
```vhdl
o_disable_nmi <= automap or button_nmi;
```
Where `automap` is the full combinatorial expression (D10 above).

**MAME** (`specnext_divmmc.h`):
```cpp
// No explicit o_disable_nmi — it's implicitly automap() || button_nmi
```

**Klive** (`DivMmcDevice.ts` `divMmcNmiHold` getter):
```typescript
get divMmcNmiHold(): boolean {
    return this._autoMapActive || this._nmiButtonPressed;
}
```
Uses `_autoMapActive` instead of the full `automap()` combinatorial expression.

**Assessment**: `_autoMapActive` is a registered approximation of the combinatorial `automap` in
FPGA. During DivMMC NMI sequences the difference likely doesn't matter, but for edge cases
where instant-on conditions change while the NMI state machine is in HOLD, the behavior could
diverge.

---

## Summary of priorities

| # | Discrepancy | Severity | Action |
|---|-------------|----------|--------|
| D5 | DivMMC never receives RETN | **Critical** | Route RETN to DivMMC in `onRetnExecuted()` |
| D6 | `handleRetnExecution` clears conmem | **High** | Remove conmem clearing from RETN handler |
| D4 | MF `mf_enable` clearing gated by nmiActive | **High** | Check `mfEnabled` not just `nmiHold` |
| D3 | Missing `enable_i` gating | **Medium** | Add `enabled` property to MultifaceDevice |
| D9 | Debug console.log | **Medium** | Remove |
| D10/D11 | DivMMC automap simplification | **Low** | Structural — may need attention if automap timing issues arise |
| D7 | No `mfEnabledEff` getter | **Low** | Add if needed |
| D8 | `mf_port_en_o` not modeled | **Low** | Niche MF feature |
| D1/D2 | Port write no-ops | **None** | Already matches MAME |
