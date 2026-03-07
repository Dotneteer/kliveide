import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine, TestZxNextMachine } from "./TestNextMachine";

/**
 * Tests for stackless NMI CPU behavior (Task 8).
 *
 * When interruptDevice.enableStacklessNmi = true:
 * - processNmi() decrements SP by 2 but does NOT write to memory
 * - The return address is saved to interruptDevice.nmiReturnAddress
 * - After RETN, beforeOpcodeFetch() restores pc from nmiReturnAddress
 */
describe("StacklessNmi", async () => {
  let m: TestZxNextMachine;

  beforeEach(async () => {
    m = await createTestNextMachine();
    m.divMmcDevice.enableMultifaceNmiByM1Button = true;
  });

  // ─────────────────────────────
  //  enableStacklessNmi flag
  // ─────────────────────────────

  it("enableStacklessNmi defaults to false", () => {
    expect(m.interruptDevice.enableStacklessNmi).toBe(false);
  });

  it("after NMI: normal mode pushes to stack (enableStacklessNmi=false)", () => {
    // Set up: SP = 0x8000, PC = 0x1234
    m.sp = 0x8000;
    m.pc = 0x1234;
    m.interruptDevice.enableStacklessNmi = false;

    // Trigger NMI via sigNMI
    m.sigNMI = true;
    m.executeCpuCycle();

    // SP decremented by 2
    expect(m.sp).toBe(0x7ffe);
    // PC set to NMI handler
    expect(m.pc).toBe(0x0066);
    // Return address pushed to memory
    expect(m.memoryDevice.readMemory(0x7fff)).toBe(0x12); // high byte
    expect(m.memoryDevice.readMemory(0x7ffe)).toBe(0x34); // low byte
    // nmiReturnAddress is NOT set in normal mode
    expect(m.interruptDevice.nmiReturnAddress).toBe(0x0000);
  });

  // ─────────────────────────────
  //  Stackless NMI push suppression
  // ─────────────────────────────

  it("stackless NMI: SP decremented by 2", () => {
    m.sp = 0x8000;
    m.pc = 0xabcd;
    m.interruptDevice.enableStacklessNmi = true;
    m.sigNMI = true;

    m.executeCpuCycle();

    expect(m.sp).toBe(0x7ffe);
  });

  it("stackless NMI: pc set to 0x0066", () => {
    m.sp = 0x8000;
    m.pc = 0xabcd;
    m.interruptDevice.enableStacklessNmi = true;
    m.sigNMI = true;

    m.executeCpuCycle();

    expect(m.pc).toBe(0x0066);
  });

  it("stackless NMI: return address saved to nmiReturnAddress", () => {
    m.sp = 0x8000;
    m.pc = 0xabcd;
    m.interruptDevice.enableStacklessNmi = true;
    m.sigNMI = true;

    m.executeCpuCycle();

    expect(m.interruptDevice.nmiReturnAddress).toBe(0xabcd);
  });

  it("stackless NMI: stack memory NOT written to", () => {
    m.sp = 0x8000;
    m.pc = 0xabcd;
    m.interruptDevice.enableStacklessNmi = true;
    m.sigNMI = true;

    // Write known sentinels to the pre-push stack locations
    m.memoryDevice.writeMemory(0x7ffe, 0xee);
    m.memoryDevice.writeMemory(0x7fff, 0xff);

    m.executeCpuCycle();

    // Stack locations should be unchanged
    expect(m.memoryDevice.readMemory(0x7ffe)).toBe(0xee);
    expect(m.memoryDevice.readMemory(0x7fff)).toBe(0xff);
  });

  it("stackless NMI: iff1 cleared and iff2 saved", () => {
    m.iff1 = true;
    m.iff2 = false;
    m.sp = 0x8000;
    m.interruptDevice.enableStacklessNmi = true;
    m.sigNMI = true;

    m.executeCpuCycle();

    expect(m.iff1).toBe(false);
    expect(m.iff2).toBe(true);
  });

  it("stackless NMI: _stacklessNmiProcessed flag is set", () => {
    m.sp = 0x8000;
    m.pc = 0x1234;
    m.interruptDevice.enableStacklessNmi = true;
    m.sigNMI = true;

    m.executeCpuCycle();

    expect((m as any)._stacklessNmiProcessed).toBe(true);
  });

  // ─────────────────────────────
  //  RETN PC fix
  // ─────────────────────────────

  it("after stackless NMI + RETN: PC is restored from nmiReturnAddress", () => {
    m.sp = 0x8000;
    m.pc = 0x1234;
    m.interruptDevice.enableStacklessNmi = true;
    m.sigNMI = true;

    // Process NMI
    m.executeCpuCycle();
    expect(m.interruptDevice.nmiReturnAddress).toBe(0x1234);

    // Simulate RETN having executed: set retnExecuted = true
    // (RETN would have read garbage from stack and set pc to garbage)
    m.pc = 0xbeef; // simulate wrong pc after RETN read garbage
    (m as any).retnExecuted = true;

    // beforeOpcodeFetch should fix PC
    m.beforeOpcodeFetch();

    expect(m.pc).toBe(0x1234);
  });

  it("after stackless NMI + RETN: _stacklessNmiProcessed is cleared", () => {
    m.sp = 0x8000;
    m.pc = 0x1234;
    m.interruptDevice.enableStacklessNmi = true;
    m.sigNMI = true;
    m.executeCpuCycle();

    m.pc = 0xbeef;
    (m as any).retnExecuted = true;
    m.beforeOpcodeFetch();

    expect((m as any)._stacklessNmiProcessed).toBe(false);
  });

  it("after stackless RETN: SP is back to original (incremented by ret)", () => {
    // RETN's ret() increments SP by 2 regardless of whether writes went to memory
    // So SP after RETN should be back at original_SP
    m.sp = 0x8000;
    m.pc = 0x5678;
    m.interruptDevice.enableStacklessNmi = true;
    m.sigNMI = true;

    m.executeCpuCycle();
    const spAfterNmi = m.sp; // should be 0x7ffe

    // Simulate RETN incrementing SP by 2
    m.sp = (spAfterNmi + 2) & 0xffff;
    expect(m.sp).toBe(0x8000);
  });

  it("retnExecuted=true without _stacklessNmiProcessed does NOT change PC", () => {
    m.sp = 0x8000;
    m.pc = 0x9999;
    m.interruptDevice.enableStacklessNmi = false;
    // Normal RETN: stackless not active, PC should not be altered
    (m as any).retnExecuted = true;
    (m as any)._stacklessNmiProcessed = false;

    m.beforeOpcodeFetch();

    expect(m.pc).toBe(0x9999);
  });

  it("hardReset clears _stacklessNmiProcessed", async () => {
    (m as any)._stacklessNmiProcessed = true;
    m.hardReset();
    expect((m as any)._stacklessNmiProcessed).toBe(false);
  });
});
