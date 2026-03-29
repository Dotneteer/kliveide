# INT / NMI Implementation Discrepancy Plan (MAME vs Klive)

Comparison of the maskable interrupt (INT) and non-maskable interrupt (NMI) handling
between MAME (`_input/src/devices/cpu/z80/z80.lst` `take_interrupt` / `take_nmi`)
and Klive (`src/emu/z80/Z80Cpu.ts` `processInt()` / `processNmi()`).

## Reference timing (MAME `take_interrupt`, IM2)

| Step | T-states | Notes |
|---|---|---|
| `leave_halt()` | 0 | Logic only |
| `m_iff1 = m_iff2 = 0` | 0 | Logic only |
| `m_irqack_cb(1)` | 0 | Callback notification |
| `m_r++` | 0 | Refresh increment |
| `@irqfetch` | 0 | Read vector byte from data bus (via daisy chain or default 0xFF) |
| `+ 2` | **2** | Interrupt-acknowledge latency |
| `+ 5` (IM2) | **5** | CALL setup overhead |
| `@wm16_sp PC` | **6** | Push PC: 2 × 3T memory writes |
| `@rm16 vector_addr` | **6** | Read ISR pointer: 2 × 3T reads |
| LD A,I/R quirk check | 0 | Reset PV if `SA_AFTER_LDAIR` |
| `WZ = PC` | 0 | Set WZ to new PC |
| **Total** | **19** | |

## D1 — Hardcoded IM2 vector byte (HIGH)

**MAME:** The `irqfetch` macro reads the vector byte from the data bus:
- With daisy chain → `z80daisy_irq_ack()` returns the device-specific vector
- Without daisy chain → `standard_irq_callback()` returns `execute_default_irq_vector()` = 0xFF

For classic Spectrum (no daisy chain), the vector is always 0xFF.
For ZX Next, MAME uses a full daisy chain with programmable per-source vectors (via NextReg 0xC0):

```
vector_byte = (im2TopBits << 5) | (source_priority << 1)
```

Priority ordering: line (0), uart0_rx (1), uart1_rx (2), ctc0–7 (3–10), ula (11), uart0_tx (12), uart1_tx (13).

**Klive:** `processInt()` hardcodes the vector byte to 0xFF:
```ts
var addr = (this.i << 8) + 0xff;
```

**Impact:** Correct for classic Spectrum. **Wrong for ZX Next** — the Next's programmable IM2 vector system
(NextReg 0xC0 `im2TopBits` + per-source priority index) is completely non-functional. All IM2 ISRs on the Next
will read from the wrong vector table entry.

**Fix:** Make `processInt()` `protected` (currently `private`) and introduce a virtual method
`getInterruptVector(): number` that returns 0xFF by default. Override in `Z80NCpu` or `ZxNextMachine`
to compute the correct vector based on `InterruptDevice.im2TopBits` and the highest-priority active
interrupt source.

---

## D2 — LD A,I / LD A,R parity flag quirk not implemented (MEDIUM)

**MAME:** Tracks the `SA_AFTER_LDAIR` flag. When `LD A,I` or `LD A,R` executes, the flag is set.
If a maskable interrupt (INT) or NMI is accepted on the **same instruction boundary**, the PV flag
is reset to 0 — overriding the `PV = IFF2` value that was just loaded.

This is a documented Z80 silicon bug affecting all NMOS Z80 variants.

**Klive:** No tracking of the LD A,I / LD A,R state. `ldAI()` and `ldAR()` set `PV = IFF2`,
and if an interrupt fires immediately after, the PV value remains unchanged.

**Impact:** Programs that rely on `LD A,I` / `LD A,R` to test IFF2 state (e.g., some copy
protection / timing routines) may behave incorrectly when an interrupt fires between the
LD A,I/R and the conditional branch that tests PV.

**Fix:** Add a boolean flag (e.g., `afterLdAIR`) set by `ldAI()` and `ldAR()`, cleared at the start
of each `executeCpuCycle()`. In `processInt()` and `processNmi()`, if the flag is set,
force `F &= ~FlagsSetMask.PV` (clear PV).

---

## D3 — processInt is private, not overridable (HIGH for Next)

**MAME:** The `take_interrupt` macro runs in a context where per-machine customizations
(daisy chain, callbacks) are naturally available.

**Klive:** `processInt()` is declared `private`, preventing `Z80NCpu` or `ZxNextMachine` from
overriding the interrupt handling to support:
- The Next's programmable IM2 vector system
- Per-source interrupt acknowledgment (clearing status bits on the correct source)
- Pulse vs. IM2 mode distinction (NextReg 0xC0 bit 0)

**Impact:** The ZX Next cannot customise maskable interrupt processing at all.

**Fix:** Change `processInt()` from `private` to `protected`. Alternatively, extract the
vector-fetch step into a separate `protected getInterruptVector(): number` method.

---

## D4 — No interrupt-acknowledge callback (LOW)

**MAME:** Calls `m_irqack_cb(1)` during interrupt acknowledgment, allowing external
hardware to react (e.g., clear interrupt sources, update status registers).

**Klive:** No equivalent callback mechanism.

**Impact:** Low for classic Spectrum (the ULA uses a timer to deassert INT). For the Next,
the interrupt source clearing (e.g., `specnext_im2_device::z80daisy_irq_ack()`) is missing
but could alternatively be handled by the override proposed in D1/D3.

**Fix:** Consider adding an `onInterruptAcknowledged()` hook or handling this in the
`getInterruptVector()` override.

---

## D5 — NMI does not set WZ register (LOW)

**MAME:** Sets `WZ = PC` (= 0x0066) at the end of `take_nmi`.

**Klive:** `processNmi()` sets `this.pc = 0x0066` but does not update `this.wz`.

**Impact:** Very low. WZ (MEMPTR) is an internal register that only affects the undocumented
flags from `BIT n,(HL)` and `IN r,(C)`. The missing WZ update after NMI would only be
observable if one of these instructions executes as the very first instruction of the NMI
handler, which is extremely unlikely.

**Fix:** Add `this.wz = 0x0066;` (or equivalently `this.wz = this.pc;`) at the end of
`processNmi()`.

---

## D6 — IM0 treats all vectors as RST $38 (LOW)

**MAME:** IM0 decodes the data-bus byte and handles NOP, CALL, JP, RST, and EI opcodes
with different timing for each case.

**Klive:** IM0 unconditionally jumps to 0x0038:
```ts
this.wz = 0x0038;
```

**Impact:** Correct for ZX Spectrum (the data bus always holds 0xFF = RST $38 due to
pull-up resistors). Would be incorrect for Z80 systems with peripheral devices that place
other opcodes on the bus, but no such hardware exists in the emulated machines.

**Fix:** None required for Spectrum/Next emulation. Document as intentional simplification.

---

## Summary

| ID | Severity | Description | Action |
|---|---|---|---|
| D1 | High | IM2 vector byte hardcoded to 0xFF — Next IM2 non-functional | Add virtual `getInterruptVector()` |
| D2 | Medium | LD A,I/R parity quirk not implemented | Add `afterLdAIR` flag + PV reset in INT/NMI |
| D3 | High (Next) | `processInt()` is `private`, not overridable | Change to `protected` |
| D4 | Low | No interrupt-acknowledge callback | Optional hook |
| D5 | Low | NMI doesn't set WZ to 0x0066 | One-line fix |
| D6 | Low | IM0 always acts as RST $38 | No fix needed |
