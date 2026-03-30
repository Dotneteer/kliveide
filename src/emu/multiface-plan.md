# Multiface — MAME/FPGA vs Klive Discrepancy Analysis

Source files analyzed:
- **MAME**: `_input/src/mame/sinclair/specnext_multiface.cpp`, `specnext_multiface.h`, `specnext.cpp`
- **FPGA**: `_input/next-fpga/src/device/multiface.vhd`
- **Klive**: `src/emu/machines/zxNext/MultifaceDevice.ts`, `MemoryDevice.ts`, `ZxNextMachine.ts`, `io-ports/MultifacePortHandler.ts`, `io-ports/NextIoPortManager.ts`

---

## D1 — Port writes modify invisible / nmiActive (should be no-ops only on FIRST clock)

**MAME/FPGA behavior**: The `port_io_dly` flip-flop implements edge detection. On the **first** clock edge where a port IO signal is asserted, `port_io_dly` is still 0, so the write *does* take effect. On subsequent edges (same IO cycle), `port_io_dly` = 1 blocks further changes. Specifically:

- **Disable port write** (`port_mf_disable_wr`): In non-+3 modes, sets `invisible = 1`. In all modes, clears `nmi_active = 0`.
- **Enable port write** (`port_mf_enable_wr`): In +3 mode, sets `invisible = 1`. In all modes, clears `nmi_active = 0`.

From `clock_w()`:
```
// invisible
if (button_pulse) invisible = 0;
else if ((port_mf_disable_wr && !mode_p3) || (port_mf_enable_wr && mode_p3)) && !port_io_dly)
    invisible = 1;

// nmi_active
if (button_pulse) nmi_active = 1;
else if (retn_seen || ((port_mf_enable_wr || port_mf_disable_wr || (port_mf_disable_rd && mode_p3)) && !port_io_dly))
    nmi_active = 0;
```

**Klive behavior**: `writeEnablePort()` and `writeDisablePort()` are completely empty no-ops. They never modify `invisible` or `nmi_active`.

**Impact**: After a MF NMI session that did NOT use RETN (e.g. software-driven NMI handling), writing to the disable port should clear `nmi_active` and (in non-+3 mode) set `invisible = 1`. In +3 mode, writing to the enable port should set `invisible = 1` and clear `nmi_active`. Without these, the multiface may remain in a "stuck" NMI-active state.

**Fix**: Implement the MAME/FPGA logic in `writeEnablePort()` and `writeDisablePort()`. Since Klive doesn't have a clock-based `port_io_dly` flip-flop, each handler is called exactly once per IO cycle, so the writes should always take effect (equivalent to `port_io_dly = 0` on first clock).

---

## D2 — Disable port READ in +3 mode should also clear nmiActive

**MAME/FPGA behavior**: From `clock_w()`, `nmi_active` is cleared when:
```
retn_seen || ((port_mf_enable_wr || port_mf_disable_wr || (port_mf_disable_rd && mode_p3)) && !port_io_dly)
```

Note the term `port_mf_disable_rd && mode_p3` — a **read** of the disable port in MF+3 mode clears `nmi_active`.

**Klive behavior**: `readDisablePort()` only clears `mfEnabled = false`. It does NOT check for +3 mode or clear `nmiActive`.

**Impact**: In MF+3 mode, reading the disable port (0xBF) should both clear `mfEnabled` AND clear `nmiActive`. Without this, the MF+3 NMI session cannot be properly terminated by port reads alone.

**Fix**: In `readDisablePort()`, add: `if (this.modeP3) this.nmiActive = false;`

---

## D3 — Enable port address mapping for type 1 is wrong

**MAME/FPGA behavior**: The port address decode uses `nr_0a_mf_type` as a 2-bit field:
```
MAME:
if (m_nr_0a_mf_type & 2)       → types 2,3 → enable=0x9F, disable=0x1F
else if (m_nr_0a_mf_type & 1)  → type 1    → enable=0xBF, disable=0x3F
else (type 0)                               → enable=0x3F, disable=0xBF

FPGA:
port_mf_enable_io_a  <= X"9F" when nr_0a_mf_type(1)='1' else X"BF" when nr_0a_mf_type(0)='1' else X"3F";
port_mf_disable_io_a <= X"1F" when nr_0a_mf_type(1)='1' else X"3F" when nr_0a_mf_type(0)='1' else X"BF";
```

So: type 0 (MF+3) → enable=0x3F, disable=0xBF; type 1 (MF128 v87.2) → enable=0xBF, disable=0x3F; types 2,3 → enable=0x9F, disable=0x1F.

**Klive behavior** (MultifaceDevice.ts):
```ts
get enablePortAddress(): number {
    const t = this.machine.divMmcDevice.multifaceType;
    return t === 2 || t === 3 ? 0x9f : t === 1 ? 0xbf : 0x3f;
}
get disablePortAddress(): number {
    const t = this.machine.divMmcDevice.multifaceType;
    return t === 2 || t === 3 ? 0x1f : t === 1 ? 0x3f : 0xbf;
}
```

**Verdict**: Klive's port address mapping **matches** MAME/FPGA exactly. ✅ No discrepancy.

---

## D4 — `port_multiface_io_en` gate is not checked

**MAME/FPGA behavior**: All multiface state changes are gated by `port_multiface_io_en()` (MAME) / `enable_i` (FPGA). In MAME's `mf_port_r()` and `mf_port_w()`, the port IO signals are ANDed with `port_multiface_io_en()` before being passed to the multiface device. When `port_multiface_io_en()` is false, no port IO reaches the multiface at all. Additionally, `mf_enabled_r()` returns `m_enable && mf_enable_eff()` and `nmi_disable_r()` returns `m_enable && m_nmi_active` — both gated by the enable signal. In the FPGA, `reset <= reset_i or not enable_i`, which holds the entire device in reset when disabled.

**Klive behavior**: The `portMultifaceEnabled` flag (NR $85 bit 1) is stored in `NextRegDevice` but **never read** by `MultifaceDevice`, `MultifacePortHandler`, or `MemoryDevice`. The IO port handlers (`readMultifacePort`/`writeMultifacePort`) always route to the multiface with no gating. The memory paging code checks `mfEnabled` with no enable gate.

**Impact**: Even when `port_multiface_io_en` is disabled (NR $85 bit 1 = 0), the multiface ports still function, and the multiface memory still pages in. This is incorrect — when disabled, the multiface should be completely inert.

**Fix**: 
1. Add an `enabled` getter to `MultifaceDevice` that reads `machine.nextRegDevice.portMultifaceEnabled`.
2. Gate all port handlers: if not enabled, port reads should fall through to underlying hardware (e.g., joystick for 0x1F), and port writes should be no-ops.
3. Gate memory paging outputs: `nmiHold` and `mfEnabled` effective outputs should be ANDed with the enable flag.
4. Optionally: when enable transitions from true→false, reset the device state (like FPGA `reset <= not enable_i`).

---

## D5 — `readEnablePort` does not implement `mf_port_en` data return

**MAME/FPGA behavior**: When the enable port is read, the RETURNED DATA depends on `mf_port_en_r()`:

```cpp
// MAME header:
bool mf_port_en_r() { return m_enable && (m_port_mf_enable_rd && !invisible_eff() && (mode_128() || mode_p3())); }

// MAME mf_port_r():
if (!m_mf->mf_port_en_r())
    data = Lsb == 0x1f ? kempston_md_r<0>(addr) : 0x00;
else if (m_nr_0a_mf_type != 0b00)  // MF 128/48
    data = (BIT(m_port_7ffd_data, 3) << 7) | 0x7f;  // bit 7 = shadow screen
else {  // MF +3
    switch (BIT(addr, 12, 4)) {
        case 0b0001: data = m_port_1ffd_data; break;
        case 0b0111: data = m_port_7ffd_data; break;
        case 0b1101: data = m_port_dffd_data; break;
        case 0b1110: data = m_port_eff7_data & 0xc0; break;
        default: data = m_port_fe_data & 0x07;
    }
}
```

So:
- If `mf_port_en` is false (invisible, mode 48, or enable disabled): return joystick data (port 0x1F) or 0x00.
- MF128/MF48: return `(bit3_of_7ffd << 7) | 0x7F` (shadow screen indicator).
- MF+3: return a paging register depending on high address bits (1ffd, 7ffd, dffd, eff7, or FE border).

**Klive behavior**: `readEnablePort()` always returns `0xFF`. No mode-dependent data is returned.

**Impact**: MF software that reads the enable port to detect the shadow screen bit or to read paging registers (MF+3) will get incorrect data (0xFF instead of the actual paging state). This is critical for MF+3 software that needs to save/restore paging state.

**Fix**: Implement mode-dependent return values in `readEnablePort()`. The full port address (with high byte) is needed for MF+3's address-bit-dependent register selection, so the port address must be passed through to the handler.

---

## D6 — `readDisablePort` always returns 0xFF (should fall through)

**MAME behavior**: When the disable port is read, if `mf_port_en` is false, the data falls through to joystick (if port 0x1F) or 0x00. If `mf_port_en` is true, mode-dependent data is returned (same as enable port).

Actually, looking more carefully at MAME: `mf_port_en_r()` checks `m_port_mf_enable_rd` which is only true for the enable port, not the disable port. So for disable port reads, `mf_port_en_r()` is always false, and the data falls through (joystick for 0x1F, 0x00 otherwise).

**Klive behavior**: `readDisablePort()` always returns `0xFF`.

**Impact**: When port 0x1F is used as the disable port (types 2,3 = MF128/MF1), reads should return joystick data, not 0xFF. For other disable port addresses (0x3F, 0xBF), reads should return 0x00.

**Fix**: The disable port read should clear `mfEnabled` but return pass-through data (joystick for 0x1F, 0x00 otherwise), not 0xFF.

---

## D7 — `mf_enable_eff` combinational signal not modeled

**MAME/FPGA behavior**: `mf_enable_eff = mf_enable or fetch_66`. This means at the 0x0066 fetch, even BEFORE `mf_enable` is clocked high, the combinational `mf_enable_eff` already enables memory paging. This is an **instant** page-in that occurs within the same M1 cycle.

In MAME, the 0x0066 fetch handler:
1. Sets `cpu_m1_n=0`, `cpu_a_0066=1`, `cpu_mreq_n=0` → `fetch_66` becomes true → `mf_enable_eff = true`
2. Calls `clock_w()` → `mf_enable` latches to 1
3. Calls `do_m1()` → `bank_update()` → sees `mf_enabled_r() = true` → pages in MF memory
4. The opcode fetch reads from MF ROM

This is the **same** timing as `fetch_66` in the FPGA: the combinational `mf_enable_eff` gates the memory map BEFORE the clock edge latches `mf_enable`.

**Klive behavior**: `ZxNextMachine.stepNmiStateMachine()` handles the 0x0066 case in the `FETCH` state:
```ts
case 'FETCH':
    if (pc === 0x0066) {
        if (this._nmiSourceMf) {
            this.multifaceDevice.onFetch0066();
        }
        this._nmiState = 'HOLD';
    }
```

And `onFetch0066()` directly sets `mfEnabled = true`. This is called from `beforeOpcodeFetch()` which runs before the opcode is actually fetched, so the memory IS paged in before the read.

**Verdict**: Klive's approach achieves the same result as MAME/FPGA's `mf_enable_eff` combinational signal — the multiface memory is paged in before the opcode at 0x0066 is fetched. ✅ No timing discrepancy, though the mechanism is different.

---

## D8 — Port write effects on invisible and nmiActive (full analysis)

This expands on D1 with the complete MAME/FPGA truth table for which writes affect which state:

| Port operation | invisible | nmi_active | mf_enable |
|---|---|---|---|
| **disable_wr** (!mode_p3) | → 1 | → 0 | (no change) |
| **disable_wr** (mode_p3) | (no change) | → 0 | (no change) |
| **enable_wr** (mode_p3) | → 1 | → 0 | (no change) |
| **enable_wr** (!mode_p3) | (no change) | → 0 | (no change) |
| **disable_rd** (any mode) | (no change) | → 0 if mode_p3 | → 0 |
| **enable_rd** (any mode) | (no change) | (no change) | → !invisible_eff |

**Klive behavior**:
- Write enable/disable: No-op (D1)
- Read disable: Only clears mfEnabled, never clears nmiActive in +3 mode (D2)
- Read enable: Sets mfEnabled = !invisibleEff ✅ correct

**Note**: All write effects and the +3 disable-read nmiActive clear are missing. See D1 and D2 for fixes.

---

## D9 — `nmiHold` output not gated by enable

**MAME/FPGA behavior**: `nmi_disable_r() = m_enable && m_nmi_active` (MAME header). `nmi_disable_o <= nmi_active` in the FPGA, BUT the FPGA holds the device in reset when `enable_i = 0`, so `nmi_active` is forced to 0.

**Klive behavior**: `get nmiHold(): boolean { return this.nmiActive; }` — no enable gate.

**Impact**: When multiface IO is disabled (NR $85 bit 1 = 0), `nmiHold` still reports true if `nmiActive` was set before disabling. This could keep the NMI state machine stuck in HOLD state even after multiface is disabled.

**Fix**: Return `this.machine.nextRegDevice.portMultifaceEnabled && this.nmiActive`. (Part of D4.)

---

## D10 — Debug `console.log` in production code

**Klive behavior**: `onFetch0066()` contains:
```ts
console.log(`[NMI] onFetch0066: mfEnabled=true MF_ROM[0x0066]=0x${b0066.toString(16)} ...`)
```

This should not be in production code.

**Fix**: Remove the `console.log` statement (or gate it behind a debug flag).

---

## Summary Table

| ID | Description | Severity | Files to change |
|----|-------------|----------|-----------------|
| D1 | Port writes are no-ops (should modify invisible, nmiActive) | Medium | MultifaceDevice.ts |
| D2 | Disable port read in +3 mode doesn't clear nmiActive | Medium | MultifaceDevice.ts |
| D3 | Port address mapping | N/A | ✅ Already correct |
| D4 | `port_multiface_io_en` enable gate not checked | High | MultifaceDevice.ts, MultifacePortHandler.ts, MemoryDevice.ts |
| D5 | Enable port read returns 0xFF instead of mode-dependent data | High | MultifaceDevice.ts, MultifacePortHandler.ts |
| D6 | Disable port read returns 0xFF instead of pass-through data | Low | MultifaceDevice.ts, MultifacePortHandler.ts |
| D7 | `mf_enable_eff` combinational timing | N/A | ✅ Already correct |
| D8 | Full port IO truth table (combines D1+D2) | Medium | MultifaceDevice.ts |
| D9 | `nmiHold` not gated by enable | Medium | MultifaceDevice.ts |
| D10 | Debug console.log in production code | Low | MultifaceDevice.ts |
