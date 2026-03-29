import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CopperDevice, CopperStartMode, CopperDeviceState } from "@emu/machines/zxNext/CopperDevice";
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
    // NOP at slot 0; a not-yet-matching WAIT at slot 1 acts as a stopper so the
    // NOP-batching loop halts after processing exactly one NOP.
    writeInstruction(copper, 0, 0x0000);
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    copper.executeTick(0, 0); // fetch NOP → dout stays false, addr advances by 1
    expect(copper._copperDout).toBe(false);
    expect(copper._copperListAddr).toBe(1);

    // A second tick also produces no write (there is no pending MOVE)
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

// ---------------------------------------------------------------------------
// Step 5 — Wrap-around at end of 1024-entry list
// ---------------------------------------------------------------------------

describe("CopperDevice – Step 5: Wrap-around", () => {
  let machine: TestZxNextMachine;
  let copper: CopperDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    copper = machine.copperDevice;
  });

  it("should wrap pointer from 0x3FF to 0 after 1024 NOP ticks", () => {
    // Memory is all zeros after reset → all 1024 slots are NOPs (0x0000)
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    for (let i = 0; i < 1024; i++) copper.executeTick(0, i);

    expect(copper._copperListAddr).toBe(0);
  });

  it("should continue running after wrap (pointer reaches 1 on tick 1025)", () => {
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    for (let i = 0; i < 1025; i++) copper.executeTick(0, i);

    expect(copper._copperListAddr).toBe(1);
  });

  it("should execute a MOVE at slot 0 twice after one full pass through the list", () => {
    // Slot 0: MOVE reg=0x44, val=0x99 — all other slots remain NOP (0)
    writeInstruction(copper, 0, moveInstr(0x44, 0x99));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    const spy = vi.spyOn(machine.nextRegDevice, "directSetRegValue");

    // Expected timeline:
    //  Tick 1   : fetch slot 0 MOVE → dout=true, addr=1
    //  Tick 2   : output MOVE (call #1), dout=false
    //  Ticks 3–1024: fetch NOP slots 1–1022 → addr=1023  (1022 ticks)
    //  Tick 1025: fetch NOP slot 1023 → addr wraps to 0
    //  Tick 1026: fetch slot 0 MOVE again → dout=true, addr=1
    //  Tick 1027: output MOVE (call #2)
    for (let i = 0; i < 1027; i++) copper.executeTick(0, i);

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenNthCalledWith(1, 0x44, 0x99);
    expect(spy).toHaveBeenNthCalledWith(2, 0x44, 0x99);
    vi.restoreAllMocks();
  });

  it("should wrap correctly in mode StartFromLastPointAndLoop (0b10)", () => {
    setMode(copper, CopperStartMode.StartFromLastPointAndLoop);
    // Manually place the pointer at the last slot
    copper._copperListAddr = 0x3ff;
    // Memory at slot 0x3FF is NOP by default → advances to 0x400 % 0x400 = 0
    copper.executeTick(0, 0);
    expect(copper._copperListAddr).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Step 6 — Frame-restart mode (StartFromZeroRestartOnPositionReached = 0b11)
// ---------------------------------------------------------------------------

describe("CopperDevice – Step 6: Frame-restart mode", () => {
  let machine: TestZxNextMachine;
  let copper: CopperDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    copper = machine.copperDevice;
  });

  it("should reset pointer to 0 when executeTick(0, 0) is called in mode 0b11", () => {
    setMode(copper, CopperStartMode.StartFromZeroRestartOnPositionReached);
    copper._copperListAddr = 0x2aa;
    copper.executeTick(0, 0);
    expect(copper._copperListAddr).toBe(0);
  });

  it("should clear _copperDout when restarting at (0, 0)", () => {
    setMode(copper, CopperStartMode.StartFromZeroRestartOnPositionReached);
    copper._copperDout = true;
    copper.executeTick(0, 0);
    expect(copper._copperDout).toBe(false);
  });

  it("should NOT restart at (0, 0) in mode 0b01 (StartFromZeroAndLoop)", () => {
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);
    // Advance pointer a few steps
    copper.executeTick(0, 1); // NOP → addr=1
    copper.executeTick(0, 2); // NOP → addr=2
    copper._copperListAddr = 0x1ff;
    // (0, 0) should NOT reset in mode 0b01
    copper.executeTick(0, 0); // NOP fetch at slot 0x1ff → addr=0x200
    expect(copper._copperListAddr).toBe(0x200);
  });

  it("should NOT restart at positions other than (0, 0) in mode 0b11", () => {
    setMode(copper, CopperStartMode.StartFromZeroRestartOnPositionReached);
    copper._copperListAddr = 0x100;
    copper.executeTick(0, 1);   // hc != 0 → no restart
    expect(copper._copperListAddr).not.toBe(0);
    copper._copperListAddr = 0x100;
    copper.executeTick(1, 0);   // vc != 0 → no restart
    expect(copper._copperListAddr).not.toBe(0);
  });

  it("should resume executing the list from slot 0 on the tick after (0, 0)", () => {
    // Slot 0: MOVE reg=0x42, val=0xff
    writeInstruction(copper, 0, moveInstr(0x42, 0xff));
    setMode(copper, CopperStartMode.StartFromZeroRestartOnPositionReached);
    // Advance pointer away from slot 0
    copper._copperListAddr = 0x1aa;

    const spy = vi.spyOn(machine.nextRegDevice, "directSetRegValue");

    copper.executeTick(0, 0);   // frame-restart tick: reset addr=0, return (no execute)
    expect(copper._copperListAddr).toBe(0);
    expect(spy).not.toHaveBeenCalled();

    copper.executeTick(0, 1);   // fetch slot 0 MOVE → dout=true
    expect(copper._copperDout).toBe(true);

    copper.executeTick(0, 2);   // output MOVE
    expect(spy).toHaveBeenCalledWith(0x42, 0xff);
    vi.restoreAllMocks();
  });

  it("should restart the list on every frame (two consecutive frames)", () => {
    writeInstruction(copper, 0, moveInstr(0x43, 0xab));
    setMode(copper, CopperStartMode.StartFromZeroRestartOnPositionReached);

    const spy = vi.spyOn(machine.nextRegDevice, "directSetRegValue");

    // --- Frame 1 ---
    copper.executeTick(0, 0);  // frame restart
    copper.executeTick(0, 1);  // fetch slot 0 MOVE
    copper.executeTick(0, 2);  // output (call #1)
    expect(spy).toHaveBeenCalledTimes(1);

    // Advance well into the list
    for (let i = 0; i < 500; i++) copper.executeTick(1, i);

    // --- Frame 2 ---
    copper.executeTick(0, 0);  // frame restart again
    expect(copper._copperListAddr).toBe(0);

    copper.executeTick(0, 1);  // fetch slot 0 MOVE
    copper.executeTick(0, 2);  // output (call #2)
    expect(spy).toHaveBeenCalledTimes(2);
    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// Step 7 — Vertical line offset (NextReg 0x64)
// ---------------------------------------------------------------------------

describe("CopperDevice – Step 7: Vertical line offset", () => {
  let machine: TestZxNextMachine;
  let copper: CopperDevice;
  let totalVC: number;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    copper = machine.copperDevice;
    totalVC = machine.composedScreenDevice.config.totalVC; // 311 for 50Hz
  });

  it("should use raw vc when offset is 0 (default)", () => {
    // WAIT for line 10
    writeInstruction(copper, 0, waitInstr(0, 10));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    copper.executeTick(10, 12); // raw vc=10 = adjusted vc=10 → advance
    expect(copper._copperListAddr).toBe(1);
  });

  it("should apply offset so that WAIT matches at adjusted line", () => {
    // With offset=10: adjusted = (rawVC + 10) % totalVC
    // WAIT for adjusted line 5 → raw vc where match = totalVC - 10 + 5 = totalVC - 5
    copper.verticalLineOffset = 10;
    writeInstruction(copper, 0, waitInstr(0, 5));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    const matchingRawVC = (5 + totalVC - 10) % totalVC; // totalVC - 5

    // One short: should not match
    copper.executeTick(matchingRawVC - 1, 12);
    expect(copper._copperListAddr).toBe(0);

    // Exact match
    copper.executeTick(matchingRawVC, 12);
    expect(copper._copperListAddr).toBe(1);
  });

  it("should NOT match when offset makes adjusted vc different from wait line", () => {
    copper.verticalLineOffset = 5;
    // WAIT for adjusted line 20
    writeInstruction(copper, 0, waitInstr(0, 20));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    // raw vc=20 → adjusted = 25 → no match
    copper.executeTick(20, 12);
    expect(copper._copperListAddr).toBe(0);

    // raw vc=15 → adjusted = 20 → match
    copper.executeTick(15, 12);
    expect(copper._copperListAddr).toBe(1);
  });

  it("should apply offset correctly near totalVC boundary (wrap)", () => {
    // offset = totalVC - 1 → adjusted = (vc + totalVC - 1) % totalVC = vc - 1 (mod totalVC)
    copper.verticalLineOffset = totalVC - 1;
    // WAIT for adjusted line 0 → raw vc = 1 (since 1 + totalVC - 1 = totalVC ≡ 0)
    writeInstruction(copper, 0, waitInstr(0, 0));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    copper.executeTick(0, 12); // adjusted = totalVC - 1 → no match
    expect(copper._copperListAddr).toBe(0);

    copper.executeTick(1, 12); // adjusted = 0 → match
    expect(copper._copperListAddr).toBe(1);
  });

  it("should apply offset to frame-restart check in mode 0b11", () => {
    // With offset=10, frame-restart fires when adjustedVC=0, i.e. rawVC = totalVC-10 = 301
    copper.verticalLineOffset = 10;
    setMode(copper, CopperStartMode.StartFromZeroRestartOnPositionReached);
    copper._copperListAddr = 0x3aa;

    // rawVC=0, hc=0 → adjustedVC = 10 → NOT the restart position; addr unchanged by restart
    // (normal execution runs, but we only need to confirm rawVC=restartVC resets to 0 below)

    const restartRawVC = (totalVC - 10) % totalVC; // 301 for 50Hz totalVC=311

    // At the restart position: adjustedVC = (301+10)%311 = 0, hc=0 → addr resets to 0
    copper._copperListAddr = 0x3aa;
    copper.executeTick(restartRawVC, 0);
    expect(copper._copperListAddr).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Step 8 — Machine integration
// ---------------------------------------------------------------------------

describe("CopperDevice – Step 8: Machine integration", () => {
  let machine: TestZxNextMachine;
  let copper: CopperDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    copper = machine.copperDevice;
    // Set frame state directly to avoid calling onInitNewFrame (which would
    // call composedScreenDevice.onNewFrame() and other setup-requiring methods).
    machine.lastRenderedFrameTact = 0;
    machine.currentFrameTact = 0;
    machine.frameCompleted = false;
    // Stub renderTact so it doesn't access uninitialised module-level arrays.
    vi.spyOn(machine.composedScreenDevice, "renderTact").mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Drive the machine's onTactIncremented up to (but not including) tact `to`.
   */
  function driveToTact(to: number): void {
    machine.currentFrameTact = to;
    machine.onTactIncremented();
  }

  it("should call executeTick with correct vc/hc derived from tact", () => {
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    const spy = vi.spyOn(copper, "executeTick");
    driveToTact(3);

    // tact 0 → vc=0, hc=0; tact 1 → vc=0, hc=1; tact 2 → vc=0, hc=2
    expect(spy).toHaveBeenCalledWith(0, 0);
    expect(spy).toHaveBeenCalledWith(0, 1);
    expect(spy).toHaveBeenCalledWith(0, 2);
  });

  it("should pass correct vc for tacts on the second scan-line", () => {
    const totalHC = machine.composedScreenDevice.config.totalHC; // 456
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    const spy = vi.spyOn(copper, "executeTick");
    driveToTact(totalHC + 1);

    expect(spy).toHaveBeenCalledWith(1, 0); // first tact of line 1
  });

  it("should deliver a MOVE to the NextReg through the machine loop", () => {
    // Slot 0: WAIT for vc=0, hc6=0 (waitHC = 0*8+12 = 12)
    // Slot 1: MOVE reg=0x55 val=0xAB
    writeInstruction(copper, 0, waitInstr(0, 0));
    writeInstruction(copper, 1, moveInstr(0x55, 0xab));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    const spy = vi.spyOn(machine.nextRegDevice, "directSetRegValue");

    // tact 12: WAIT passes (hc=12 >= waitHC=12) → addr advances to 1
    // tact 13: fetch MOVE → _copperDout=true, addr=2
    // tact 14: output MOVE → directSetRegValue(0x55, 0xAB)
    driveToTact(15);

    expect(spy).toHaveBeenCalledWith(0x55, 0xab);
  });

  it("should not execute copper when mode is FullyStopped", () => {
    writeInstruction(copper, 0, moveInstr(0x33, 0x77));
    // copper stays in FullyStopped (default)

    const spy = vi.spyOn(machine.nextRegDevice, "directSetRegValue");
    driveToTact(100);
    expect(spy).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Step 9 — Register restrictions
// ---------------------------------------------------------------------------

describe("CopperDevice – Step 9: Register restrictions", () => {
  let machine: TestZxNextMachine;
  let copper: CopperDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    copper = machine.copperDevice;
  });

  it("should write a valid register (0x45)", () => {
    writeInstruction(copper, 0, moveInstr(0x45, 0xab));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    const spy = vi.spyOn(machine.nextRegDevice, "directSetRegValue");
    copper.executeTick(0, 0); // fetch
    copper.executeTick(0, 1); // emit
    expect(spy).toHaveBeenCalledWith(0x45, 0xab);
    vi.restoreAllMocks();
  });

  it("should not write any register for a NOP (reg == 0)", () => {
    writeInstruction(copper, 0, moveInstr(0x00, 0xff));
    writeInstruction(copper, 1, waitInstr(0, 200)); // stopper
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    const spy = vi.spyOn(machine.nextRegDevice, "directSetRegValue");
    copper.executeTick(0, 0);
    copper.executeTick(0, 1);
    expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("should write to register 0x7F (maximum addressable register)", () => {
    // Instruction with reg field = 0x7F (7 bits all set): word = 0b0_1111111_11001101 = 0x7FCD
    writeInstruction(copper, 0, moveInstr(0x7f, 0xcd));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    const spy = vi.spyOn(machine.nextRegDevice, "directSetRegValue");
    copper.executeTick(0, 0); // fetch
    copper.executeTick(0, 1); // emit
    expect(spy).toHaveBeenCalledWith(0x7f, 0xcd);
    vi.restoreAllMocks();
  });

  it("should mask the register field to 7 bits when the instruction is constructed manually", () => {
    // Manually craft a MOVE word where bits 14:8 are all 1s (0b1111111 = 0x7F).
    // Result after & 0x7F mask: 0x7F — same as moveInstr(0x7F, val).
    const rawWord = 0x7f99; // bit15=0 (MOVE), bits14:8 = 0x7F, bits7:0 = 0x99
    writeInstruction(copper, 0, rawWord);
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    const spy = vi.spyOn(machine.nextRegDevice, "directSetRegValue");
    copper.executeTick(0, 0);
    copper.executeTick(0, 1);
    expect(spy).toHaveBeenCalledWith(0x7f, 0x99);
    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// Step 10 — One-instruction-per-tick execution model
// ---------------------------------------------------------------------------

describe("CopperDevice – Step 10: One-instruction-per-tick execution model", () => {
  let machine: TestZxNextMachine;
  let copper: CopperDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    copper = machine.copperDevice;
  });

  it("should process exactly one NOP per tick (each tick advances the pointer by 1)", () => {
    // 3 NOPs at slots 0-2; a not-yet-matching WAIT at slot 3 caps the check.
    writeInstruction(copper, 3, waitInstr(0, 200));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    copper.executeTick(0, 0); // tick 1: NOP at 0 → addr=1
    expect(copper._copperListAddr).toBe(1);

    copper.executeTick(0, 1); // tick 2: NOP at 1 → addr=2
    expect(copper._copperListAddr).toBe(2);

    copper.executeTick(0, 2); // tick 3: NOP at 2 → addr=3
    expect(copper._copperListAddr).toBe(3);
  });

  it("should require exactly two ticks per MOVE (fetch on tick N, emit on tick N+1)", () => {
    writeInstruction(copper, 0, moveInstr(0x10, 0x11));
    writeInstruction(copper, 1, moveInstr(0x20, 0x22));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    const spy = vi.spyOn(machine.nextRegDevice, "directSetRegValue");

    copper.executeTick(0, 0); // fetch MOVE-0 → dout=true, no write yet
    expect(spy).not.toHaveBeenCalled();

    copper.executeTick(0, 1); // emit MOVE-0 → write(0x10, 0x11)
    expect(spy).toHaveBeenCalledWith(0x10, 0x11);
    expect(spy).toHaveBeenCalledTimes(1);

    copper.executeTick(0, 2); // fetch MOVE-1 → dout=true, no second write yet
    expect(spy).toHaveBeenCalledTimes(1);

    copper.executeTick(0, 3); // emit MOVE-1 → write(0x20, 0x22)
    expect(spy).toHaveBeenCalledWith(0x20, 0x22);
    expect(spy).toHaveBeenCalledTimes(2);

    vi.restoreAllMocks();
  });

  it("should process 1024 NOPs in exactly 1024 ticks (one per tick)", () => {
    // Memory is all zeros (NOPs); add a WAIT at slot 0 after full pass to confirm wrap
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    // After 1024 ticks the pointer should have wrapped back to 0
    for (let i = 0; i < 1024; i++) {
      copper.executeTick(0, i);
    }
    expect(copper._copperListAddr).toBe(0); // wrapped around
  });

  it("should not output any NextReg writes during 1024 NOP ticks", () => {
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    const spy = vi.spyOn(machine.nextRegDevice, "directSetRegValue");
    for (let i = 0; i < 1024; i++) {
      copper.executeTick(0, i);
    }
    expect(spy).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

// ---------------------------------------------------------------------------
// Step 11 — State snapshot (CopperDeviceState / getState)
// ---------------------------------------------------------------------------

describe("CopperDevice – Step 11: State snapshot", () => {
  let machine: TestZxNextMachine;
  let copper: CopperDevice;

  beforeEach(() => {
    machine = new TestZxNextMachine();
    copper = machine.copperDevice;
  });

  it("should return initial state after reset", () => {
    const state = copper.getState();
    expect(state.startMode).toBe(CopperStartMode.FullyStopped);
    expect(state.instructionAddress).toBe(0);
    expect(state.listData).toBe(0);
    expect(state.dout).toBe(false);
    expect(state.verticalLineOffset).toBe(0);
    expect(state.memory.length).toBe(0x800);
  });

  it("should reflect execution state after programming and stepping", () => {
    writeInstruction(copper, 0, moveInstr(0x55, 0xbb));
    writeInstruction(copper, 1, waitInstr(0, 99)); // stopper
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);
    copper.verticalLineOffset = 7;

    copper.executeTick(0, 0); // fetch MOVE-0 → dout=true, addr=1

    const state = copper.getState();
    expect(state.startMode).toBe(CopperStartMode.StartFromZeroAndLoop);
    expect(state.instructionAddress).toBe(1);
    expect(state.dout).toBe(true);
    expect(state.listData).toBe(moveInstr(0x55, 0xbb));
    expect(state.verticalLineOffset).toBe(7);
  });

  it("should return a copy of memory (not a live reference)", () => {
    writeInstruction(copper, 0, moveInstr(0x11, 0x22));
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);

    const state = copper.getState();
    const originalByte = state.memory[0];

    // Mutate the snapshot copy
    state.memory[0] = 0xff;

    // Device memory must be unchanged
    expect(copper.readMemory(0)).toBe(originalByte);
  });

  it("should reflect updated state after a mode change", () => {
    setMode(copper, CopperStartMode.StartFromZeroAndLoop);
    copper._copperListAddr = 0x1aa;

    // Switch to StartFromLastPointAndLoop (addr kept)
    copper.nextReg62Value = 0x80; // mode 0b10 = StartFromLastPointAndLoop (addr kept)

    const state = copper.getState();
    expect(state.startMode).toBe(CopperStartMode.StartFromLastPointAndLoop);
    expect(state.instructionAddress).toBe(0x1aa); // not reset for mode 0b10
  });
});
