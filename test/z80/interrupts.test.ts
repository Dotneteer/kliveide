/**
 * Unit tests for INT/NMI implementation fixes (D2–D5).
 *
 * D2 – LD A,I / LD A,R parity-flag quirk: PV is cleared to 0 when an interrupt
 *      fires on the instruction boundary immediately after LD A,I or LD A,R.
 * D3 – processInt() is protected so that subclasses can override it.
 * D4 – onInterruptAcknowledged() hook is called when a maskable INT fires.
 * D5 – NMI handler sets WZ = 0x0066 (matching MAME take_nmi).
 */
import { describe, it, expect } from "vitest";
import { FlagsSetMask } from "@emu/abstractions/FlagSetMask";
import { Z80Cpu } from "@emu/z80/Z80Cpu";
import { RunMode, Z80TestMachine } from "./test-z80";

// ---------------------------------------------------------------------------
// A minimal Z80 CPU subclass with flat 64 KB memory, used for interrupt tests
// that need fine-grained control over the CPU state.
// ---------------------------------------------------------------------------
class FlatMemoryCpu extends Z80Cpu {
  readonly mem = new Uint8Array(0x10000);

  override doReadMemory(addr: number): number {
    return this.mem[addr & 0xffff];
  }

  override doWriteMemory(addr: number, val: number): void {
    this.mem[addr & 0xffff] = val & 0xff;
  }
}

class SpyCpu extends FlatMemoryCpu {
  ackCallCount = 0;

  override onInterruptAcknowledged(): void {
    this.ackCallCount++;
  }
}

// ---------------------------------------------------------------------------
// D2 – LD A,I / LD A,R parity quirk  (uses Z80TestMachine to execute real ops)
// ---------------------------------------------------------------------------

describe("INT/NMI fixes – D2 (LD A,I/R PV quirk)", () => {
  it("D2-INT: after LD A,I (IFF2=1), INT on the next boundary clears PV", () => {
    // --- Arrange: run LD A,I so afterLdAIR is set
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([0xed, 0x57], 0, 0); // LD A,I at 0x0000
    m.cpu.sp = 0x8000;
    m.cpu.i = 0x20;
    m.cpu.iff1 = true;
    m.cpu.iff2 = true; // IFF2=1 → LD A,I sets PV=1
    m.cpu.interruptMode = 1; // IM1 → RST $38

    // --- Act: execute LD A,I
    m.run();
    expect(m.cpu.f & FlagsSetMask.PV).toBeTruthy();

    // --- Trigger INT on the very next CPU cycle
    m.cpu.sigINT = true;
    m.cpu.executeCpuCycle();

    // --- Assert: PV cleared by the quirk
    expect(m.cpu.f & FlagsSetMask.PV).toBe(0);
  });

  it("D2-NMI: after LD A,R (IFF2=1), NMI on the next boundary clears PV", () => {
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([0xed, 0x5f], 0, 0); // LD A,R at 0x0000
    m.cpu.sp = 0x8000;
    m.cpu.iff2 = true; // IFF2=1 → LD A,R sets PV=1

    m.run();
    expect(m.cpu.f & FlagsSetMask.PV).toBeTruthy();

    m.cpu.sigNMI = true;
    m.cpu.executeCpuCycle();

    expect(m.cpu.f & FlagsSetMask.PV).toBe(0);
  });

  it("D2-INT: after LD A,I (IFF2=0), INT does not change PV", () => {
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([0xed, 0x57], 0, 0);
    m.cpu.sp = 0x8000;
    m.cpu.i = 0x20;
    m.cpu.iff1 = true;
    m.cpu.iff2 = false; // IFF2=0 → LD A,I sets PV=0
    m.cpu.interruptMode = 1;

    m.run();
    // PV should be 0 after LD A,I with IFF2=0
    expect(m.cpu.f & FlagsSetMask.PV).toBe(0);

    m.cpu.sigINT = true;
    m.cpu.executeCpuCycle();

    // Still 0; the quirk clears PV but it was already 0 – verify no crash
    expect(m.cpu.f & FlagsSetMask.PV).toBe(0);
  });

  it("D2-no-quirk: INT after NOP does NOT clear PV", () => {
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([0x00], 0, 0); // NOP at 0x0000
    m.cpu.sp = 0x8000;
    m.cpu.f |= FlagsSetMask.PV; // manually set PV
    m.cpu.iff1 = true;
    m.cpu.interruptMode = 1;

    m.run(); // execute NOP

    m.cpu.sigINT = true;
    m.cpu.executeCpuCycle(); // take INT without the quirk

    expect(m.cpu.f & FlagsSetMask.PV).toBeTruthy();
  });

  it("D2-no-quirk NMI: NMI after NOP does NOT clear PV", () => {
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([0x00], 0, 0);
    m.cpu.sp = 0x8000;
    m.cpu.f |= FlagsSetMask.PV;

    m.run();

    m.cpu.sigNMI = true;
    m.cpu.executeCpuCycle();

    expect(m.cpu.f & FlagsSetMask.PV).toBeTruthy();
  });

  it("D2-consumed: second INT after LD A,I does NOT repeat the quirk", () => {
    const m = new Z80TestMachine(RunMode.OneInstruction);
    m.initCode([0xed, 0x57], 0, 0);
    m.cpu.sp = 0x8000;
    m.cpu.i = 0x20;
    m.cpu.iff1 = true;
    m.cpu.iff2 = true;
    m.cpu.interruptMode = 1;

    m.run(); // LD A,I → afterLdAIR = true, PV = 1

    // First INT: quirk fires, PV → 0, afterLdAIR consumed
    m.cpu.sigINT = true;
    m.cpu.executeCpuCycle();
    expect(m.cpu.f & FlagsSetMask.PV).toBe(0);

    // Set PV and re-enable interrupts for a second INT
    m.cpu.f |= FlagsSetMask.PV;
    m.cpu.iff1 = true;
    m.cpu.sigINT = true;
    m.cpu.executeCpuCycle(); // second INT — afterLdAIR already consumed

    // PV must NOT be cleared this time (quirk was consumed by the first INT)
    expect(m.cpu.f & FlagsSetMask.PV).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// D4 – onInterruptAcknowledged callback
// ---------------------------------------------------------------------------

describe("INT/NMI fixes – D4 (onInterruptAcknowledged hook)", () => {
  it("D4: hook is called exactly once when maskable INT fires", () => {
    const cpu = new SpyCpu();
    cpu.reset();
    cpu.sp = 0x8000;
    cpu.iff1 = true;
    cpu.interruptMode = 1;
    cpu.sigINT = true;

    expect(cpu.ackCallCount).toBe(0);
    cpu.executeCpuCycle();
    expect(cpu.ackCallCount).toBe(1);
  });

  it("D4: hook is NOT called when NMI fires (NMI is non-maskable, no ack cycle)", () => {
    const cpu = new SpyCpu();
    cpu.reset();
    cpu.sp = 0x8000;
    cpu.sigNMI = true;

    cpu.executeCpuCycle();
    expect(cpu.ackCallCount).toBe(0);
  });

  it("D4: hook is NOT called when no interrupt fires", () => {
    const cpu = new SpyCpu();
    cpu.reset();
    cpu.mem[0] = 0x00; // NOP
    cpu.executeCpuCycle();
    expect(cpu.ackCallCount).toBe(0);
  });

  it("D4: hook is NOT called when INT is disabled (IFF1=false)", () => {
    const cpu = new SpyCpu();
    cpu.reset();
    cpu.mem[0] = 0x00; // NOP
    cpu.sp = 0x8000;
    cpu.iff1 = false;
    cpu.sigINT = true;

    cpu.executeCpuCycle(); // INT signal present but disabled — nop executes
    expect(cpu.ackCallCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// D5 – NMI sets WZ = 0x0066
// ---------------------------------------------------------------------------

describe("INT/NMI fixes – D5 (NMI sets WZ=0x0066)", () => {
  it("D5: WZ is 0x0066 after NMI fires", () => {
    const cpu = new FlatMemoryCpu();
    cpu.reset();
    cpu.pc = 0x1234;
    cpu.sp = 0x8000;
    cpu.sigNMI = true;

    cpu.executeCpuCycle();

    expect(cpu.wz).toBe(0x0066);
    expect(cpu.pc).toBe(0x0066);
  });

  it("D5: WZ is not 0x0066 when no interrupt fires", () => {
    const cpu = new FlatMemoryCpu();
    cpu.reset();
    // After reset WZ = 0
    expect(cpu.wz).toBe(0x0000);
  });

  it("D5: WZ for IM1 INT is 0x0038 (sanity check)", () => {
    const cpu = new FlatMemoryCpu();
    cpu.reset();
    cpu.sp = 0x8000;
    cpu.iff1 = true;
    cpu.interruptMode = 1;
    cpu.sigINT = true;

    cpu.executeCpuCycle();

    expect(cpu.wz).toBe(0x0038);
    expect(cpu.pc).toBe(0x0038);
  });
});
