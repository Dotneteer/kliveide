import { describe, it, expect, beforeEach, vi } from "vitest";
import { CopperDevice, CopperStartMode } from "@emu/machines/zxNext/CopperDevice";
import { TestZxNextMachine } from "./TestNextMachine";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Write a 16-bit copper instruction word starting at a given list index. */
function writeInstruction(copper: CopperDevice, listIndex: number, word: number): void {
  // Use the 8-bit write path: set instruction address, then write two bytes.
  copper.nextReg61Value = (listIndex * 2) & 0xff;
  // Write high byte then low byte (reg 0x60 auto-increments)
  copper.nextReg60Value = (word >> 8) & 0xff;
  copper.nextReg60Value = word & 0xff;
}

/** Encode a MOVE instruction: bit 15 = 0, bits 14:8 = reg, bits 7:0 = val */
function moveInstr(reg: number, val: number): number {
  return ((reg & 0x7f) << 8) | (val & 0xff);
}

/** Encode a WAIT instruction: bit 15 = 1, bits 14:9 = hc6, bits 8:0 = vc9 */
function waitInstr(hc6: number, vc9: number): number {
  return 0x8000 | ((hc6 & 0x3f) << 9) | (vc9 & 0x1ff);
}

/** Set the copper start mode, resetting addr first then activating mode */
function setMode(copper: CopperDevice, mode: CopperStartMode): void {
  // Write stop first so mode transitions are clean
  copper.nextReg62Value = 0x00;
  // Write new mode (bits 7:6), keep address MSB = 0
  copper.nextReg62Value = (mode << 6) & 0xff;
}

// ---------------------------------------------------------------------------
// Step 1 — Execution state initialization
// ---------------------------------------------------------------------------

describe("CopperDevice – Step 1: Execution state initialization", () => {
  let machine: TestZxNextMachine;
  let copper: CopperDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    copper = machine.copperDevice;
  });

  it("should initialise _copperListAddr to 0 after reset", () => {
    expect(copper._copperListAddr).toBe(0);
  });

  it("should initialise _copperListData to 0 after reset", () => {
    expect(copper._copperListData).toBe(0);
  });

  it("should initialise _copperDout to false after reset", () => {
    expect(copper._copperDout).toBe(false);
  });

  it("should initialise startMode to FullyStopped after reset", () => {
    expect(copper.startMode).toBe(CopperStartMode.FullyStopped);
  });

  it("should reset all execution state fields when reset() is called", () => {
    // Mess up state manually
    copper._copperListAddr = 0x1ff;
    copper._copperListData = 0xabcd;
    copper._copperDout = true;
    copper.reset();
    expect(copper._copperListAddr).toBe(0);
    expect(copper._copperListData).toBe(0);
    expect(copper._copperDout).toBe(false);
  });

  // ---- Mode transition: mode 0b01 (StartFromZeroAndLoop) -------------------

  it("should reset _copperListAddr when mode transitions to 0b01", () => {
    copper._copperListAddr = 0x123;
    // First go to stopped so the transition is valid
    copper.nextReg62Value = 0x00; // stop
    copper._copperListAddr = 0x123; // set after stop
    copper.nextReg62Value = 0b01 << 6; // mode 0b01
    expect(copper._copperListAddr).toBe(0);
  });

  it("should clear _copperDout when mode transitions to 0b01", () => {
    copper._copperDout = true;
    copper.nextReg62Value = 0x00;
    copper._copperDout = true; // set again after stop transition
    copper.nextReg62Value = 0b01 << 6;
    expect(copper._copperDout).toBe(false);
  });

  // ---- Mode transition: mode 0b11 (StartFromZeroRestartOnPositionReached) --

  it("should reset _copperListAddr when mode transitions to 0b11", () => {
    copper.nextReg62Value = 0x00;
    copper._copperListAddr = 0x200;
    copper.nextReg62Value = 0b11 << 6;
    expect(copper._copperListAddr).toBe(0);
  });

  it("should clear _copperDout when mode transitions to 0b11", () => {
    copper.nextReg62Value = 0x00;
    copper._copperDout = true;
    copper.nextReg62Value = 0b11 << 6;
    expect(copper._copperDout).toBe(false);
  });

  // ---- Mode transition: mode 0b10 (StartFromLastPointAndLoop) ---------------

  it("should NOT reset _copperListAddr when mode transitions to 0b10", () => {
    copper.nextReg62Value = 0x00;
    copper._copperListAddr = 0x1ab;
    copper.nextReg62Value = 0b10 << 6;
    expect(copper._copperListAddr).toBe(0x1ab);
  });

  // ---- Same-value write rule (nextreg spec) ---------------------------------

  it("should NOT reset _copperListAddr on a second write of the same mode 0b01", () => {
    copper.nextReg62Value = 0x00; // stop
    copper.nextReg62Value = 0b01 << 6; // first write → resets
    copper._copperListAddr = 0x3ff; // advance manually
    copper.nextReg62Value = 0b01 << 6; // same value again → must NOT reset
    expect(copper._copperListAddr).toBe(0x3ff);
  });

  it("should NOT reset _copperListAddr on a second write of the same mode 0b11", () => {
    copper.nextReg62Value = 0x00;
    copper.nextReg62Value = 0b11 << 6;
    copper._copperListAddr = 0x2aa;
    copper.nextReg62Value = 0b11 << 6; // same value again
    expect(copper._copperListAddr).toBe(0x2aa);
  });
});

// ---------------------------------------------------------------------------
// Step 2 — MOVE instruction
// ---------------------------------------------------------------------------

describe("CopperDevice – Step 2: MOVE instruction", () => {
  let machine: TestZxNextMachine;
  let copper: CopperDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    copper = machine.copperDevice;
  });

  /** Helper: read a NextReg value via the NextRegDevice register table */
  function readNextReg(reg: number): number {
    return machine.nextRegDevice.directGetRegValue(reg);
  }

  it("should write a NextReg on the second tick after a single MOVE instruction", () => {
    // Program: MOVE reg=0x40, val=0xAA at list index 0
    writeInstruction(copper, 0, moveInstr(0x40, 0xaa));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    // Tick 1: fetches instruction, sets dout
    copper.executeTick(0, 0);
    expect(copper._copperDout).toBe(true);
    // The write has not happened yet
    expect(readNextReg(0x40)).not.toBe(0xaa);

    // Tick 2: outputs the MOVE
    copper.executeTick(0, 1);
    expect(copper._copperDout).toBe(false);
    expect(readNextReg(0x40)).toBe(0xaa);
  });

  it("should advance the list pointer after a MOVE", () => {
    writeInstruction(copper, 0, moveInstr(0x20, 0x55));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    copper.executeTick(0, 0); // fetch → dout=true, addr=1
    expect(copper._copperListAddr).toBe(1);
  });

  it("should execute a NOP (MOVE 0,0) without writing any NextReg and advance the pointer", () => {
    // NOP = instruction word 0x0000
    writeInstruction(copper, 0, 0x0000);
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    copper.executeTick(0, 0); // fetch NOP → dout stays false, addr advances
    expect(copper._copperDout).toBe(false);
    expect(copper._copperListAddr).toBe(1);

    // A second tick should also do nothing (dout never became true)
    copper.executeTick(0, 1);
    expect(copper._copperDout).toBe(false);
  });

  it("should execute three consecutive MOVEs in sequence (one output per two ticks)", () => {
    writeInstruction(copper, 0, moveInstr(0x10, 0x11));
    writeInstruction(copper, 1, moveInstr(0x20, 0x22));
    writeInstruction(copper, 2, moveInstr(0x30, 0x33));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    const spy = vi.spyOn(machine.nextRegDevice, "directSetRegValue");

    // MOVE 0: fetch on tick 1, output on tick 2
    copper.executeTick(0, 0);
    expect(copper._copperDout).toBe(true);
    copper.executeTick(0, 1);
    expect(spy).toHaveBeenCalledWith(0x10, 0x11);
    expect(copper._copperDout).toBe(false);

    // MOVE 1: fetch on tick 3, output on tick 4
    copper.executeTick(0, 2);
    expect(copper._copperDout).toBe(true);
    copper.executeTick(0, 3);
    expect(spy).toHaveBeenCalledWith(0x20, 0x22);

    // MOVE 2: fetch on tick 5, output on tick 6
    copper.executeTick(0, 4);
    copper.executeTick(0, 5);
    expect(spy).toHaveBeenCalledWith(0x30, 0x33);

    vi.restoreAllMocks();
  });

  it("should write to the maximum register address (0x7F) correctly", () => {
    // MOVE instruction with register field = 0x7F (maximum): word = 0b0_1111111_01010101 = 0x7F55
    // Bit 15 = 0 (MOVE), bits 14:8 = 0x7F (register), bits 7:0 = 0x55 (value)
    writeInstruction(copper, 0, 0x7f55);
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    const spy = vi.spyOn(machine.nextRegDevice, "directSetRegValue");

    copper.executeTick(0, 0); // fetch
    copper.executeTick(0, 1); // output to reg 0x7F
    expect(spy).toHaveBeenCalledWith(0x7f, 0x55);

    vi.restoreAllMocks();
  });

  it("should not execute anything when mode is FullyStopped", () => {
    writeInstruction(copper, 0, moveInstr(0x40, 0xbb));
    // Leave in FullyStopped mode (default after reset)

    copper.executeTick(0, 0);
    copper.executeTick(0, 1);
    expect(copper._copperDout).toBe(false);
    expect(readNextReg(0x40)).not.toBe(0xbb);
  });

  it("should stop execution when mode is set back to FullyStopped mid-list", () => {
    writeInstruction(copper, 0, moveInstr(0x40, 0xcc));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    copper.executeTick(0, 0); // fetch → dout=true

    // Switch to stopped before the output tick
    copper.nextReg62Value = 0x00; // FullyStopped
    copper.executeTick(0, 1); // should do nothing
    expect(readNextReg(0x40)).not.toBe(0xcc);
  });
});

// ---------------------------------------------------------------------------
// Step 3 — WAIT instruction
// ---------------------------------------------------------------------------

describe("CopperDevice – Step 3: WAIT instruction", () => {
  let machine: TestZxNextMachine;
  let copper: CopperDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    copper = machine.copperDevice;
  });

  it("should advance the pointer when vc and hc both match", () => {
    // WAIT for line 100, hc6=0 → waitHC = 0*8+12 = 12
    writeInstruction(copper, 0, waitInstr(0, 100));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    copper.executeTick(100, 12); // exact match
    expect(copper._copperListAddr).toBe(1);
  });

  it("should advance when hc is greater than the target", () => {
    writeInstruction(copper, 0, waitInstr(0, 100));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    copper.executeTick(100, 200); // hc well past target
    expect(copper._copperListAddr).toBe(1);
  });

  it("should NOT advance when vc is wrong (too early)", () => {
    writeInstruction(copper, 0, waitInstr(0, 100));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    copper.executeTick(99, 200);
    expect(copper._copperListAddr).toBe(0);
  });

  it("should NOT advance when vc is wrong (too late)", () => {
    writeInstruction(copper, 0, waitInstr(0, 100));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    copper.executeTick(101, 200);
    expect(copper._copperListAddr).toBe(0);
  });

  it("should NOT advance when hc is below the target (hc < waitHC)", () => {
    // hc6=1 → waitHC = 1*8+12 = 20
    writeInstruction(copper, 0, waitInstr(1, 100));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    copper.executeTick(100, 19); // one short
    expect(copper._copperListAddr).toBe(0);
  });

  it("should advance exactly at the target hc boundary", () => {
    // hc6=2 → waitHC = 2*8+12 = 28
    writeInstruction(copper, 0, waitInstr(2, 50));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    copper.executeTick(50, 28); // exactly at boundary
    expect(copper._copperListAddr).toBe(1);
  });

  it("should encode hc6 correctly: WAIT for line 0 hc6=0 matches at hc=12", () => {
    writeInstruction(copper, 0, waitInstr(0, 0));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    copper.executeTick(0, 11); // hc=11 < 12 → no advance
    expect(copper._copperListAddr).toBe(0);

    copper.executeTick(0, 12); // hc=12 >= 12 → advance
    expect(copper._copperListAddr).toBe(1);
  });

  it("should stall multiple ticks until condition is met, then advance exactly once", () => {
    writeInstruction(copper, 0, waitInstr(0, 10)); // waitHC = 12
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    // Stall for several ticks on the wrong line
    for (let i = 0; i < 5; i++) {
      copper.executeTick(9, 200);
      expect(copper._copperListAddr).toBe(0);
    }
    // Now provide the matching position
    copper.executeTick(10, 12);
    expect(copper._copperListAddr).toBe(1);
    // One more tick: pointer is now on the next instruction (NOP/0)
    copper.executeTick(10, 13);
    expect(copper._copperListAddr).toBe(2); // NOP at slot 1 advances
  });

  it("should execute a MOVE after a WAIT only once the WAIT passes", () => {
    // Slot 0: WAIT line=20, hc6=0
    // Slot 1: MOVE reg=0x45, val=0x77
    writeInstruction(copper, 0, waitInstr(0, 20));
    writeInstruction(copper, 1, moveInstr(0x45, 0x77));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    const spy = vi.spyOn(machine.nextRegDevice, "directSetRegValue");

    // Before the wait line: MOVE must not fire
    copper.executeTick(19, 200);
    expect(spy).not.toHaveBeenCalledWith(0x45, 0x77);

    // Pass the WAIT
    copper.executeTick(20, 12); // WAIT passes → addr = 1
    expect(copper._copperListAddr).toBe(1);

    // Fetch MOVE
    copper.executeTick(20, 13); // fetch → dout=true
    expect(copper._copperDout).toBe(true);

    // Output MOVE
    copper.executeTick(20, 14);
    expect(spy).toHaveBeenCalledWith(0x45, 0x77);

    vi.restoreAllMocks();
  });

  it("should handle maximum hc6 value (63): waitHC = 63*8+12 = 516", () => {
    writeInstruction(copper, 0, waitInstr(63, 5));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    copper.executeTick(5, 515); // one short
    expect(copper._copperListAddr).toBe(0);

    copper.executeTick(5, 516);
    expect(copper._copperListAddr).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Step 4 — Stop mode (FullyStopped = 0b00)
// ---------------------------------------------------------------------------

describe("CopperDevice – Step 4: Stop mode", () => {
  let machine: TestZxNextMachine;
  let copper: CopperDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    copper = machine.copperDevice;
  });

  it("should do nothing when mode is FullyStopped (default)", () => {
    writeInstruction(copper, 0, moveInstr(0x40, 0xbb));
    // Default mode is FullyStopped — never call setMode

    const spy = vi.spyOn(machine.nextRegDevice, "directSetRegValue");
    for (let i = 0; i < 10; i++) copper.executeTick(0, i);

    expect(spy).not.toHaveBeenCalled();
    expect(copper._copperDout).toBe(false);
    expect(copper._copperListAddr).toBe(0);
    vi.restoreAllMocks();
  });

  it("should not advance the pointer when stopped", () => {
    writeInstruction(copper, 0, moveInstr(0x40, 0x01));
    for (let i = 0; i < 50; i++) copper.executeTick(i, 0);
    expect(copper._copperListAddr).toBe(0);
  });

  it("should halt immediately when mode changes to FullyStopped from StartFromZeroAndLoop", () => {
    writeInstruction(copper, 0, moveInstr(0x40, 0xcc));
    writeInstruction(copper, 1, moveInstr(0x41, 0xdd));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    copper.executeTick(0, 0); // fetch slot 0 → dout=true
    expect(copper._copperDout).toBe(true);

    // Stop before the output tick
    copper.nextReg62Value = CopperStartMode.FullyStopped << 6;

    const spy = vi.spyOn(machine.nextRegDevice, "directSetRegValue");
    copper.executeTick(0, 1); // must do nothing
    copper.executeTick(0, 2);
    expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("should resume execution after being stopped and restarted", () => {
    writeInstruction(copper, 0, moveInstr(0x50, 0x11));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);
    copper.executeTick(0, 0); // fetch → dout=true

    // Stop
    copper.nextReg62Value = CopperStartMode.FullyStopped << 6;
    copper.executeTick(0, 1); // no output

    // Restart (transition 0→1 resets list addr to 0)
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);
    expect(copper._copperListAddr).toBe(0);

    const spy = vi.spyOn(machine.nextRegDevice, "directSetRegValue");
    copper.executeTick(0, 0); // fetch slot 0 again → dout=true
    copper.executeTick(0, 1); // output
    expect(spy).toHaveBeenCalledWith(0x50, 0x11);
    vi.restoreAllMocks();
  });
});
