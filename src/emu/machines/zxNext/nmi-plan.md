# ZX Spectrum Next NMI Handling — Implementation Plan

Derived from the VHDL source at `_input/next-fpga/src/zxnext.vhd`,
`_input/next-fpga/src/device/multiface.vhd`, and
`_input/next-fpga/src/device/divmmc.vhd`.

---

## 1. Background — What the VHDL Does

### 1.1 NMI Sources (three, mutually exclusive)

| Signal            | Condition (VHDL)                                                               |
|-------------------|--------------------------------------------------------------------------------|
| `nmi_assert_mf`   | `(hotkey_m1 OR nmi_sw_gen_mf) AND nr_06_button_m1_nmi_en`                     |
| `nmi_assert_divmmc` | `(hotkey_drive OR nmi_sw_gen_divmmc) AND nr_06_button_drive_nmi_en`          |
| `nmi_assert_expbus` | `expbus_en AND NOT expbus_disable_mem AND i_BUS_NMI_n = '0'`                 |

- `hotkey_m1` / `hotkey_drive` — physical button presses (M1 / Drive).  
  In the emulator these correspond to the `multifaceNmi` / `divmmcNmi` custom commands.
- `nmi_sw_gen_mf` / `nmi_sw_gen_divmmc` — software trigger via nextreg 0x02 bits 3/2.
- NR06 bit 3 (`enableMultifaceNmiByM1Button`) and bit 4 (`enableDivMmcNmiByDriveButton`)
  gate both the physical button and the software path.

### 1.2 Arbitration — First Come, First Served

Only **one** of `nmi_mf`, `nmi_divmmc`, `nmi_expbus` can be active at a time.
Priority when none is active yet:

1. **MF** — accepted when `nmi_assert_mf AND NOT port_e3_reg(7) AND NOT divmmc_nmi_hold`
2. **DivMMC** — accepted when `nmi_assert_divmmc AND NOT mf_is_active`
3. **ExpBus** — accepted otherwise

All three are cleared on: hard reset, config-mode entry, or reaching `S_NMI_END`.

### 1.3 NMI State Machine (4 states)

```
S_NMI_IDLE
  │
  │ nmi_activated = 1
  ▼
S_NMI_FETCH          ← /NMI held low (sigNMI = true)
  │
  │ CPU M1 fetch at 0x0066 (cpu_m1_n=0 AND cpu_mreq_n=0 AND addr=0x0066)
  ▼
S_NMI_HOLD           ← /NMI released (sigNMI = false)
  │
  │ nmi_hold = 0   (device has finished its NMI handling)
  ▼
S_NMI_END            ← Wait for any pending I/O write to complete (cpu_wr_n=1)
  │
  └──► S_NMI_IDLE   (nmi_mf / nmi_divmmc / nmi_expbus cleared)
```

`nmi_generate_n` (drives CPU `/NMI`) is LOW when:
- `(S_NMI_IDLE AND nmi_activated)` — transition beat
- `S_NMI_FETCH` — held during fetch phase
- `(nr_81_expbus_nmi_debounce_disable AND nmi_assert_expbus)` — expansion bus bypass

`nmi_accept_cause` (new causes accepted only in IDLE or FETCH state) is also used by
the software NMI generation path (nextreg 0x02).

### 1.4 NMI Hold Signals

| Signal            | Source                              | Meaning                                             |
|-------------------|-------------------------------------|-----------------------------------------------------|
| `mf_nmi_hold`     | `multiface.nmi_disable_o`           | TRUE while `nmi_active` is set in Multiface device  |
| `divmmc_nmi_hold` | `divmmc.o_disable_nmi`              | TRUE while DivMMC automap is active OR `button_nmi` |

`nmi_hold` fed back into the state machine:
```
nmi_hold = mf_nmi_hold  (when nmi_mf)
         | divmmc_nmi_hold  (when nmi_divmmc)
         | nmi_assert_expbus  (when nmi_expbus)
```

### 1.5 Multiface Device Logic (`multiface.vhd`)

Port mapping by `nr_0a_mf_type[1:0]` (nextreg 0x0A bits 7:6):

| Code | Mode            | Enable port | Disable port |
|------|-----------------|-------------|--------------|
| `00` | MF+3            | 0x3F        | 0xBF         |
| `01` | MF128 v87.2     | 0xBF        | 0x3F         |
| `10` | MF128 v87.12    | 0x9F        | 0x1F         |
| `11` | MF48 / MF1      | 0x9F        | 0x1F         |

Internal flags:
- **`nmi_active`** (= `mf_nmi_hold`): set by button press when `nmi_active=0`; cleared by
  RETN, write to either MF port, or (MF+3 only) read of disable port.
- **`mf_enable`** (= `mf_mem_en`): set by M1 fetch at 0x0066 while `nmi_active=1`, or by
  read of enable port (unless `invisible_eff`); cleared by read of disable port or RETN.
- **`invisible`** (MF128/+3 only): set by certain port writes; cleared by button press.
  `invisible_eff = invisible AND NOT mode_48`.
- `mf_is_active = mf_mem_en OR mf_nmi_hold`.
- Port data is returned by the MF device only when `mf_port_en_o = 1` (MF128/MF+3 modes,
  reading enable port while not invisible).

### 1.6 DivMMC NMI Logic (`divmmc.vhd`)

- `button_nmi` latched HIGH when `i_divmmc_button` asserted (= `nmi_divmmc_button`).
- `button_nmi` cleared on: reset, automap_reset, retn_seen, or `automap_held`.
- Automap activation at 0x0066 is additionally conditioned on `button_nmi`:
  `automap_nmi_instant_on = button_nmi AND i_automap_nmi_instant_on`
  `automap_nmi_delayed_on = button_nmi AND i_automap_nmi_delayed_on`
- `o_disable_nmi = automap OR button_nmi` — keeps NMI paused while DivMMC holds the bus.
- The signals `i_automap_nmi_instant_on` and `i_automap_nmi_delayed_on` come from address
  0x0066 being fetched with nextreg 0xBB bits 1/0 set (already stored as
  `divMmcDevice.automapOn0066` / `automapOn0066Delayed`), but in the VHDL they are
  registered one CLK *before* being passed to the DivMMC device.

### 1.7 Software NMI (nextreg 0x02 write)

Writing nextreg 0x02:
- Bit 3 = 1 → `nmi_gen_nr_mf` → contributes to `nmi_sw_gen_mf` (accepted if `nmi_accept_cause=1`)
- Bit 2 = 1 → `nmi_gen_nr_divmmc` → contributes to `nmi_sw_gen_divmmc` (accepted if `nmi_accept_cause=1`)
- Writing 0 to bit 3 clears `nr_02_generate_mf_nmi`
- Writing 0 to bit 2 clears `nr_02_generate_divmmc_nmi`
- Read reflects the latched status flags (`mfNmiByNextReg`, `divMccNmiBtNextReg`).

### 1.8 Stackless NMI (nextreg 0xC0 bit 3)

When `enableStacklessNmi = true`:
- During NMI acknowledge cycles the stack **write** is suppressed (SP is decremented but
  the write goes to nextreg 0xC2/C3 instead of memory).
- The RETN instruction reads the return address from nextreg 0xC2/C3 instead of the stack
  (SP is still incremented).

Per nextreg 0xC0 documentation the return address is always stored in 0xC2/C3 regardless;
the stackless mode simply diverts the read/write away from memory.

---

## 2. What Is Already Implemented

| Feature | Status |
|---------|--------|
| `divMmcDevice.enableDivMmcNmiByDriveButton` / `enableMultifaceNmiByM1Button` | ✅ stored via NR06 |
| `interruptDevice.enableStacklessNmi` (NRC0 bit 3) | ✅ stored |
| `interruptDevice.nmiReturnAddress` (NRC2/C3) | ✅ stored |
| `interruptDevice.mfNmiByNextReg` / `divMccNmiBtNextReg` / `mfNmiByIoTrap` | ✅ declared, zeroed |
| DivMMC NMI entry-point check at 0x0066 in `checkNmiEntry()` | ✅ code path exists, but `_nmiButtonPressed` never set externally |
| `MultifacePortHandler.ts` stubs (read/write enable/disable ports) | ✅ file exists, all TODO |
| NMI state machine | ❌ not implemented |
| `sigNMI` driven by NMI sources | ❌ always false |
| Multiface device class | ❌ not implemented |
| `multifaceNmi` / `divmmcNmi` commands | ❌ console.log stub |
| NR02 write handling of bits 3/2 (generate NMI) | ❌ only bit 7 handled |
| Stackless NMI CPU behavior | ❌ CPU always pushes to stack |

---

## 3. Development Workflow

> Apply this workflow to **every implementation task** (Tasks 1–10 below).

### 3.0 Before Starting Any Task

Run the full test suite and confirm it is green:

```bash
npm test
```

If any pre-existing tests are failing, investigate and fix them before writing new code.

### 3.x Per-Task Checklist

For each numbered task below, work through these steps in order:

1. **Implement** the task as described.
2. **Lint check** — open the VS Code Problems panel and resolve all errors and warnings in the files you touched.
3. **Write unit tests** — add a new test file (or extend an existing file) in `test/zxnext/` that covers the new behaviour. Name it after the class or feature, e.g. `MultifaceDevice.test.ts`, `NmiStateMachine.test.ts`.
4. **Run new tests** — execute `npm test` scoped to the new file and fix any failures:

   ```bash
   npx vitest run test/zxnext/<NewTest>.test.ts
   ```

5. **Run full suite** — execute `npm test` and fix any regressions.
6. **Mark the task complete** in this checklist (update the `[ ]` to `[x]`).
7. **Summarise and pause** — write a concise (3–5 line) summary of what was done and ask for approval before moving to the next task.

---

## 4. Implementation Tasks

### Task 1 — MultifaceDevice class  
**New file:** `src/emu/machines/zxNext/MultifaceDevice.ts`

Create a class implementing `IGenericDevice<IZxNextMachine>`:

#### 3.1.1 State fields
```ts
nmiActive: boolean;      // nmi_active in VHDL — also exposed as mfNmiHold
mfEnabled: boolean;      // mf_enable in VHDL — multiface memory paged in
invisible: boolean;      // invisible flag (MF128/+3 only)
```

#### 3.1.2 Mode helpers
Derive mode from `machine.divMmcDevice.multifaceType` (`nr_0a_mf_type`):
```ts
get mode48() { return this.machine.divMmcDevice.multifaceType === 3; }
get mode128() { return !this.mode48 && !this.modeP3; }
get modeP3()  { return this.machine.divMmcDevice.multifaceType === 0; }
```

#### 3.1.3 Port addresses (dynamic, based on mode)
```ts
get enablePortAddress(): number {
  const t = this.machine.divMmcDevice.multifaceType;
  return (t === 2 || t === 3) ? 0x9F : (t === 1) ? 0xBF : 0x3F;
}
get disablePortAddress(): number {
  const t = this.machine.divMmcDevice.multifaceType;
  return (t === 2 || t === 3) ? 0x1F : (t === 1) ? 0x3F : 0xBF;
}
```

#### 3.1.4 NMI button press handler
Called from `ZxNextMachine.executeCustomCommand("multifaceNmi")` when the M1 button is
simulated:
```ts
pressNmiButton(): void {
  if (!this.nmiActive) {
    this.nmiActive = true;         // sets mf_nmi_hold
    this.invisible = false;        // button press clears invisible (MF128/+3)
  }
}
```

#### 3.1.5 Port read handlers
- **Read enable port** (`readEnablePort()`):
  - If `invisible_eff` (= `invisible && !mode48`): `mfEnabled = false`, return 0xFF.
  - Otherwise: if `nmiActive`, `mfEnabled = true`; update memory; return port data.
  - `mf_port_en_o` data returned only for MF128/MF+3, data is the 1FXXD / 7FXXD
    register mirror (see `multiface.vhd` MF+3 section) — return 0xFF for the emulator.

- **Read disable port** (`readDisablePort()`):
  - `mfEnabled = false`; update memory mapping.
  - For MF+3 mode: also clear `nmiActive`.
  - Return 0xFF.

#### 3.1.6 Port write handlers
- **Write enable port** (`writeEnablePort()`):
  - Clear `nmiActive` (for all modes).
  - For MF+3 mode: also set `invisible = true`.

- **Write disable port** (`writeDisablePort()`):
  - Clear `nmiActive`.
  - For non-MF+3: set `invisible = true`.

#### 3.1.7 Fetch-at-0x0066 detection
Called from `ZxNextMachine.beforeOpcodeFetch()` (after NMI state machine updates):
```ts
onFetch0066(): void {
  if (this.nmiActive) {
    this.mfEnabled = true;         // pages in MF memory
    // tell memory device to update
    this.machine.memoryDevice.updateFastPathFlags();
  }
}
```

#### 3.1.8 RETN handler
Called when `retnExecuted` is true AND multiface is active:
```ts
handleRetn(): void {
  this.nmiActive = false;
  this.mfEnabled = false;
  this.machine.memoryDevice.updateFastPathFlags();
}
```

#### 3.1.9 `reset()`
```ts
reset(): void {
  this.nmiActive = false;
  this.mfEnabled = false;
  this.invisible = true;   // starts invisible (prevents accidental paging)
}
```

#### 3.1.10 Memory integration
Expose `mfEnabled` so that `MemoryDevice` can page in the MF ROM/RAM bank at
0x0000–0x3FFF when true. The actual memory content depends on the MF mode (see hardware
documentation). For the emulator a 16 KB region within the MF address space should
be sufficient. The memory device needs a new `mfMemEnabled` flag checked in its
mapping logic.

---

### Task 2 — NMI State Machine in ZxNextMachine

Add a state machine to `ZxNextMachine` to orchestrate the `/NMI` signal.

#### 3.2.1 State type
```ts
type NmiState = 'IDLE' | 'FETCH' | 'HOLD' | 'END';
```

#### 3.2.2 New private fields on ZxNextMachine
```ts
private _nmiState: NmiState = 'IDLE';
private _nmiSourceMf: boolean = false;
private _nmiSourceDivMmc: boolean = false;
private _nmiSourceExpBus: boolean = false;
```

#### 3.2.3 Computed properties

```ts
// Mirrors VHDL nmi_activated
get nmiActivated(): boolean {
  return this._nmiSourceMf || this._nmiSourceDivMmc || this._nmiSourceExpBus;
}

// Mirrors VHDL nmi_hold
get nmiHold(): boolean {
  if (this._nmiSourceMf)     return this.multifaceDevice.nmiActive;    // mf_nmi_hold
  if (this._nmiSourceDivMmc) return this.divMmcDevice.divMmcNmiHold;   // divmmc_nmi_hold
  return false; // expbus: held as long as BUS_NMI_n is low (not yet modelled)
}

// Mirrors VHDL nmi_accept_cause
get nmiAcceptCause(): boolean {
  return this._nmiState === 'IDLE' || this._nmiState === 'FETCH';
}
```

#### 3.2.4 Arbitration method — call from `beforeOpcodeFetch()`

```ts
private updateNmiSources(): void {
  // Only update when no NMI is currently active (first come first serve)
  if (this.nmiActivated) return;

  const mfEnabled  = this.divMmcDevice.enableMultifaceNmiByM1Button;
  const divEnabled = this.divMmcDevice.enableDivMmcNmiByDriveButton;

  const assertMf     = this._pendingMfNmi     && mfEnabled;
  const assertDivMmc = this._pendingDivMmcNmi && divEnabled;
  const assertExpBus = false; // expansion bus NMI not yet modelled

  const conmemActive = (this.divMmcDevice.port0xe3Value & 0x80) !== 0; // port_e3_reg(7)
  const mfIsActive   = this.multifaceDevice.mfEnabled || this.multifaceDevice.nmiActive;
  const divNmiHold   = this.divMmcDevice.divMmcNmiHold;

  if (assertMf && !conmemActive && !divNmiHold) {
    this._nmiSourceMf = true;
    this._pendingMfNmi = false;
  } else if (assertDivMmc && !mfIsActive) {
    this._nmiSourceDivMmc = true;
    this._pendingDivMmcNmi = false;
  } else if (assertExpBus) {
    this._nmiSourceExpBus = true;
  }
}
```

#### 3.2.5 State machine step — call from `beforeOpcodeFetch()`

```ts
private stepNmiStateMachine(): void {
  const pc = this.pc;
  switch (this._nmiState) {
    case 'IDLE':
      if (this.nmiActivated) {
        this._nmiState = 'FETCH';
        this.sigNMI = true;
        if (this._nmiSourceMf) {
          this.multifaceDevice.pressNmiButton(); // arms nmi_active in MF device
        }
        if (this._nmiSourceDivMmc) {
          this.divMmcDevice.armNmiButton();      // arms button_nmi in DivMMC device
        }
      }
      break;

    case 'FETCH':
      // Wait for CPU to fetch the NMI handler opcode at 0x0066
      if (pc === 0x0066) {
        // MF pages in its memory here; DivMMC automap also triggered here
        if (this._nmiSourceMf) {
          this.multifaceDevice.onFetch0066();
        }
        this._nmiState = 'HOLD';
        this.sigNMI = false;
      }
      break;

    case 'HOLD':
      if (!this.nmiHold) {
        this._nmiState = 'END';
      }
      break;

    case 'END':
      // Clear source latches and return to idle
      this._nmiSourceMf     = false;
      this._nmiSourceDivMmc = false;
      this._nmiSourceExpBus = false;
      this._nmiState = 'IDLE';
      break;
  }
}
```

> **Note on timing**: In the VHDL the state machine clocks on the CPU clock, and the
> HOLD→END transition also waits for a pending I/O write to finish (`cpu_wr_n = 1`).
> In the emulator this detail can be approximated by stepping the state machine in
> `beforeOpcodeFetch()` (each instruction boundary), which is safe enough because the
> port handler will have already committed the write before the next opcode fetch.

#### 3.2.6 Integration point — override `beforeOpcodeFetch()`

```ts
beforeOpcodeFetch(): void {
  this.divMmcDevice.beforeOpcodeFetch();  // existing DivMMC call

  // 1. Accept new NMI causes (if in IDLE or FETCH)
  if (this.nmiAcceptCause) {
    this.updateNmiSources();
  }

  // 2. Step the state machine
  this.stepNmiStateMachine();
}
```

---

### Task 3 — Trigger NMI from Custom Commands

Update `executeCustomCommand()` in `ZxNextMachine.ts`:

```ts
case "multifaceNmi":
  this._pendingMfNmi = true;
  break;

case "divmmcNmi":
  this._pendingDivMmcNmi = true;
  break;
```

Add `private _pendingMfNmi = false` and `private _pendingDivMmcNmi = false` fields.
These are consumed by `updateNmiSources()` in the `beforeOpcodeFetch()` path.

---

### Task 4 — Software NMI via Nextreg 0x02

Update the **write** handler for nextreg 0x02 in `NextRegDevice.ts`:

```ts
writeFn: (v) => {
  machine.interruptDevice.busResetRequested = (v & 0x80) !== 0;

  // Bit 3: generate multiface NMI
  if (v & 0x08) {
    machine.interruptDevice.mfNmiByNextReg = true;
    // Accepted now only if nmi_accept_cause is true; machine checks in beforeOpcodeFetch
    (machine as ZxNextMachine).requestMfNmiFromSoftware();
  } else {
    machine.interruptDevice.mfNmiByNextReg = false;
  }

  // Bit 2: generate divmmc NMI
  if (v & 0x04) {
    machine.interruptDevice.divMccNmiBtNextReg = true;
    (machine as ZxNextMachine).requestDivMmcNmiFromSoftware();
  } else {
    machine.interruptDevice.divMccNmiBtNextReg = false;
  }

  // Bit 4: clear I/O trap (write 0 to clear)
  if (!(v & 0x10)) {
    machine.interruptDevice.mfNmiByIoTrap = false;
  }
}
```

Add `requestMfNmiFromSoftware()` and `requestDivMmcNmiFromSoftware()` methods on
`ZxNextMachine` that gate on `nmiAcceptCause`:

```ts
requestMfNmiFromSoftware(): void {
  if (this.nmiAcceptCause) {
    this._pendingMfNmi = true;
  }
}
requestDivMmcNmiFromSoftware(): void {
  if (this.nmiAcceptCause) {
    this._pendingDivMmcNmi = true;
  }
}
```

---

### Task 5 — DivMMC `armNmiButton()` and `divMmcNmiHold`

In `DivMmcDevice.ts` add:

```ts
// Called by the NMI state machine when DivMMC NMI is accepted
armNmiButton(): void {
  this._nmiButtonPressed = true;
}

// Mirrors VHDL o_disable_nmi
get divMmcNmiHold(): boolean {
  return this._autoMapActive || this._nmiButtonPressed;
}
```

The existing `checkNmiEntry()` in `DivMmcDevice.ts` already gates automapping at 0x0066
on `_nmiButtonPressed` — this path is now properly connected.

---

### Task 6 — Multiface Port Handlers

Replace the stubs in `MultifacePortHandler.ts` with calls into a `MultifaceDevice`
instance that is added to `ZxNextMachine`:

```ts
// Declare in ZxNextMachine
multifaceDevice: MultifaceDevice;
```

Wire the port handlers in `NextIoPortManager` to delegate to `multifaceDevice`.  
The port addresses used by each handler depend on the current multiface type (dynamic —
read from `multifaceDevice.enablePortAddress` / `disablePortAddress`). The port manager
must re-evaluate these on each I/O cycle.

The existing I/O port handler stubs can be replaced with:

```ts
export function readMultifaceEnablePort(machine: IZxNextMachine): number {
  return machine.multifaceDevice.readEnablePort();
}
export function writeMultifaceEnablePort(machine: IZxNextMachine, value: number): void {
  machine.multifaceDevice.writeEnablePort(value);
}
// ... similarly for disable port and MF128 / MF+3 variants
```

Because all four "variants" ultimately call the same `readEnablePort()` /
`readDisablePort()` logic on the device (which internally resolves the mode), the
port manager simply needs to route the right address to the right handler.

---

### Task 7 — Multiface Memory Mapping

Update `MemoryDevice` to honour the multiface's paged-in state.

When `machine.multifaceDevice.mfEnabled = true`, the lower 8 KB pages (slots 0 and 1,
`0x0000–0x3FFF`) should map to the multiface ROM/RAM. The hardware uses a dedicated
8 KB ROM block and 8 KB SRAM block for each MF type. For the emulator:

- Reserve a dedicated 16 KB buffer (`MF_MEMORY`) within `MemoryDevice` (or load from a
  file similar to the DivMMC ROM).
- Add a `mfMemEnabled` flag to the fast-path lookup in `MemoryDevice.updateFastPathFlags()`.
- When true, override pages 0 and 1 with the MF memory buffer.

---

### Task 8 — Stackless NMI: CPU Behavior Override

When `interruptDevice.enableStacklessNmi` is true, modify `processNmi()` in `Z80Cpu.ts`
(or override in `ZxNextMachine`) so that during NMI acknowledgment:

1. SP is still decremented by 2 (the hardware does decrement SP per nextreg 0xC0 docs).
2. The two stack writes are **suppressed** (no actual write to memory).
3. Instead, `this.pc` (the return address) is stored in `interruptDevice.nmiReturnAddress`.

For the RETN instruction — when `enableStacklessNmi` is true and the NMI has been
acknowledged — RETN reads `interruptDevice.nmiReturnAddress` instead of popping from
memory (but SP is still incremented by 2).

Implementation options:
- Override `pushPC()` and pair with a flag on the interrupt device marking that the
  next `pushPC` is an NMI ack.
- Override `processNmi()` in `ZxNextMachine` by overriding the method in `Z80Cpu`.
- Add a virtual hook `beforeNmiAck()` / `afterNmiAck()` to `Z80Cpu` and call it from
  `processNmi()`.

The simplest approach: add a `stacklessNmiActive` flag on `InterruptDevice`; set it from
`ZxNextMachine.beforeOpcodeFetch()` when the NMI state machine transitions from FETCH to
HOLD (i.e., the CPU is about to execute the NMI handler). Then override the two memory
writes in `processNmi()` by checking `interruptDevice.stacklessNmiActive` before calling
`writeMemory`.

---

### Task 9 — Expansion Bus NMI (deferred)

The expansion bus NMI (`nmi_assert_expbus`) is triggered by an external hardware device
pulling `/NMI` low on the expansion bus, gated by `expbus_en AND NOT expbus_disable_mem`.

This is relevant only when the expansion bus is enabled. For a first implementation it
can be left as a placeholder — add an `expansionBusNmiPending` flag to
`ExpansionBusDevice` and wire it to `nmi_assert_expbus` in `updateNmiSources()`.
The NMI debounce-disable flag (`nr_81_expbus_nmi_debounce_disable`) bypasses the state
machine and drives `/NMI` directly from `nmi_assert_expbus`.

---

### Task 10 — Reset and State Cleanup

On **hard reset** (`hardReset()`): clear all NMI state.
On **config-mode entry** (`nr_03_config_mode = 1`): clear `_nmiSourceMf`,
`_nmiSourceDivMmc`, `_nmiSourceExpBus`, reset `_nmiState` to `IDLE`, clear `sigNMI`.

Add reset calls for `MultifaceDevice` in `ZxNextMachine.reset()`.

---

## 5. Summary Checklist

Run `npm test` before starting. All tasks begin from a green baseline.

| # | Done | Task | Files touched | Test file |
|---|------|------|---------------|-----------|
| 1 | [x] | Create `MultifaceDevice` class | `MultifaceDevice.ts` (new), `IZxNextMachine.ts`, `ZxNextMachine.ts` | `MultifaceDevice.test.ts` |
| 2 | [x] | NMI state machine in `ZxNextMachine` | `ZxNextMachine.ts` | `NmiStateMachine.test.ts` |
| 3 | [x] | Wire `multifaceNmi` / `divmmcNmi` commands | `ZxNextMachine.ts` | `NmiStateMachine.test.ts` |
| 4 | [x] | Software NMI via nextreg 0x02 write | `NextRegDevice.ts`, `ZxNextMachine.ts` | `NmiSoftware.test.ts` |
| 5 | [x] | `armNmiButton()` and `divMmcNmiHold` on `DivMmcDevice` | `DivMmcDevice.ts` | `DivMmmc.test.ts` (extend) |
| 6 | [ ] | Multiface port handlers | `MultifacePortHandler.ts`, `NextIoPortManager.ts` | `MultifaceDevice.test.ts` (extend) |
| 7 | [ ] | Multiface memory mapping in `MemoryDevice` | `MemoryDevice.ts`, `ZxNextMachine.ts` | `MultifaceMemory.test.ts` |
| 8 | [ ] | Stackless NMI CPU behavior | `Z80Cpu.ts` / `ZxNextMachine.ts`, `InterruptDevice.ts` | `StacklessNmi.test.ts` |
| 9 | [ ] | Expansion bus NMI (deferred) | `ExpansionBusDevice.ts`, `ZxNextMachine.ts` | `ExpansionBusNmi.test.ts` |
| 10 | [ ] | Reset/cleanup | `ZxNextMachine.ts`, `MultifaceDevice.ts` | (all suites re-run) |

---

## 6. Key VHDL Reference Lines

| Concern | File | Line(s) |
|---------|------|---------|
| NMI state machine (combinatorial) | `zxnext.vhd` | 2076–2120 |
| NMI state machine (sequential) | `zxnext.vhd` | 2106–2118 |
| NMI source arbitration | `zxnext.vhd` | 2049–2069 |
| `nmi_generate_n` formula | `zxnext.vhd` | 2122–2125 |
| `nmi_hold` mux | `zxnext.vhd` | 2074 |
| Software NMI generation | `zxnext.vhd` | 3809–3818 |
| `nr_02_generate_mf_nmi` latch | `zxnext.vhd` | 3823–3829 |
| `nr_02_generate_divmmc_nmi` latch | `zxnext.vhd` | 3836–3842 |
| MF port address selection | `zxnext.vhd` | 2566–2572 |
| MF instantiation / ports | `zxnext.vhd` | ~4265–4285 |
| DivMMC NMI hold / button | `divmmc.vhd` | 155–181 |
| MF `nmi_active` logic | `multiface.vhd` | 141–154 |
| MF `mf_enable` logic | `multiface.vhd` | 165–190 |
| Stackless NMI suppression | `zxnext.vhd` | 2006–2043 |
| NR06 NMI enable bits write | `zxnext.vhd` | 5143–5144 |
| NRC0 stackless NMI write | `zxnext.vhd` | 5573–5574 |
