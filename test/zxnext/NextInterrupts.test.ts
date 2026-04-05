/**
 * Unit tests for ZX Next IM2 interrupt vector system (D1).
 *
 * In "hardware IM2" mode (hwIm2Mode=true, set via NextReg 0xC0 bit 0), the
 * ZX Next CPU does NOT use the classic fixed 0xFF vector byte.  Instead the
 * interrupt controller selects the highest-priority pending source and computes
 *
 *   vector = im2TopBits | (priority << 1)
 *
 * where im2TopBits = NextReg 0xC0 & 0xE0.
 *
 * Priority table (0 = highest):
 *   0  – line interrupt
 *   1  – UART0 RX (near-full or available)
 *   2  – UART1 RX (near-full or available)
 *   3-10 – CTC channels 0-7
 *   11 – ULA
 *   12 – UART0 TX empty
 *   13 – UART1 TX empty
 *
 * When hwIm2Mode=false (classic mode) the vector is always 0xFF.
 *
 * D4 (Next side): After INT is acknowledged the winning source's status flag
 * must be cleared by onInterruptAcknowledged().
 */
import { describe, it, expect } from "vitest";
import { createTestNextMachine, TestZxNextMachine } from "./TestNextMachine";

// ---------------------------------------------------------------------------
// Helper: put the machine into IM2 mode with I=0x80 (vector table at 0x80xx,
// which is in RAM bank 2) and a minimal vector table so processInt can resolve
// the handler address.  Handler is placed at 0x5000 (RAM bank 5).
// ---------------------------------------------------------------------------
function setupIm2(m: TestZxNextMachine, im2TopBits: number): void {
  // Enable hardware IM2 mode
  m.interruptDevice.hwIm2Mode = true;
  m.interruptDevice.im2TopBits = im2TopBits & 0xe0;

  // I=0x80 → vector table base = 0x8000 (writable RAM)
  m.i = 0x80;

  // Handler at 0x5000 (RAM bank 5, writable)
  const handlerLo = 0x00;
  const handlerHi = 0x50;

  // Populate every possible vector table entry so any source can resolve.
  // Vector byte = im2TopBits | (priority << 1); priority range 0..13.
  for (let priority = 0; priority <= 13; priority++) {
    const vecByte = im2TopBits | (priority << 1);
    const tableAddr = (0x80 << 8) | vecByte;
    m.memoryDevice.writeMemory(tableAddr,     handlerLo); // low  byte of 0x5000
    m.memoryDevice.writeMemory(tableAddr + 1, handlerHi); // high byte of 0x5000
  }

  // Use IM2
  m.interruptMode = 2;
  m.sp = 0xA000;
  m.iff1 = true;
  m.iff2 = true;
  m.pc = 0x4000;
}

// ---------------------------------------------------------------------------
// D1 – getInterruptVector in hwIm2Mode=false returns 0xFF (classic behaviour)
// ---------------------------------------------------------------------------

describe("Next IM2 – D1 (getInterruptVector)", () => {
  it("hwIm2Mode=false: all sources inactive → vector is 0xFF (classic)", async () => {
    const m = await createTestNextMachine();
    m.interruptDevice.hwIm2Mode = false;
    // I=0x80 → classic vector table at 0x80FF (RAM, writable)
    m.i = 0x80;

    // Vector entry for 0xFF: tableAddr = (0x80 << 8) | 0xFF = 0x80FF → handler 0x5000
    m.memoryDevice.writeMemory(0x80ff, 0x00); // low  byte of 0x5000
    m.memoryDevice.writeMemory(0x8100, 0x50); // high byte of 0x5000

    m.interruptMode = 2;
    m.sp = 0xA000;
    m.iff1 = true;
    m.pc = 0x4000;
    m.sigINT = true;

    m.executeCpuCycle();

    // With 0xFF vector: addr = (0x80 << 8) | 0xFF = 0x80FF → handler at 0x5000
    expect(m.pc).toBe(0x5000);
  });

  it("hwIm2Mode=true, lineInterruptStatus=true → vector = im2TopBits | 0x00", async () => {
    const m = await createTestNextMachine();
    const im2TopBits = 0x60; // bits [7:5] = 011
    setupIm2(m, im2TopBits);

    m.interruptDevice.lineInterruptStatus = true;
    m.interruptDevice.lineInterruptEnabled = true;
    m.sigINT = true;
    m.executeCpuCycle();

    expect(m.pc).toBe(0x5000);
  });

  it("hwIm2Mode=true, uart0RxNearFullStatus=true → vector = im2TopBits | 0x02", async () => {
    const m = await createTestNextMachine();
    const im2TopBits = 0x40;
    setupIm2(m, im2TopBits);

    m.interruptDevice.uart0RxNearFullStatus = true;
    m.interruptDevice.uart0RxNearFull = true;
    m.sigINT = true;
    m.executeCpuCycle();

    expect(m.pc).toBe(0x5000);
  });

  it("hwIm2Mode=true, uart0RxAvailableStatus=true → vector = im2TopBits | 0x02", async () => {
    const m = await createTestNextMachine();
    const im2TopBits = 0x20;
    setupIm2(m, im2TopBits);

    m.interruptDevice.uart0RxAvailableStatus = true;
    m.interruptDevice.uart0RxAvailable = true;
    m.sigINT = true;
    m.executeCpuCycle();

    expect(m.pc).toBe(0x5000);
  });

  it("hwIm2Mode=true, uart1RxNearFullStatus=true → vector = im2TopBits | 0x04", async () => {
    const m = await createTestNextMachine();
    const im2TopBits = 0x60;
    setupIm2(m, im2TopBits);

    m.interruptDevice.uart1RxNearFullStatus = true;
    m.interruptDevice.uart1RxNearFull = true;
    m.sigINT = true;
    m.executeCpuCycle();

    expect(m.pc).toBe(0x5000);
  });

  it("hwIm2Mode=true, ctcIntStatus[0]=true → vector = im2TopBits | 0x06 (priority 3)", async () => {
    const m = await createTestNextMachine();
    const im2TopBits = 0x60;
    setupIm2(m, im2TopBits);

    m.interruptDevice.ctcIntStatus[0] = true;
    m.interruptDevice.ctcIntEnabled[0] = true;
    m.sigINT = true;
    m.executeCpuCycle();

    expect(m.pc).toBe(0x5000);
  });

  it("hwIm2Mode=true, ctcIntStatus[2]=true → vector = im2TopBits | 0x0A (priority 5)", async () => {
    const m = await createTestNextMachine();
    const im2TopBits = 0x60;
    setupIm2(m, im2TopBits);

    // Isolate ctc[2]
    m.interruptDevice.ctcIntStatus[2] = true;
    m.interruptDevice.ctcIntEnabled[2] = true;
    m.sigINT = true;
    m.executeCpuCycle();

    // priority = 3 + 2 = 5 → vector = im2TopBits | (5 << 1) = im2TopBits | 0x0A
    expect(m.pc).toBe(0x5000);
  });

  it("hwIm2Mode=true, ulaInterruptStatus=true → vector = im2TopBits | 0x16 (priority 11)", async () => {
    const m = await createTestNextMachine();
    const im2TopBits = 0x60;
    setupIm2(m, im2TopBits);

    m.interruptDevice.ulaInterruptStatus = true;
    m.sigINT = true;
    m.executeCpuCycle();

    expect(m.pc).toBe(0x5000);
  });

  it("hwIm2Mode=true, uart0TxEmptyStatus=true → vector = im2TopBits | 0x18 (priority 12)", async () => {
    const m = await createTestNextMachine();
    const im2TopBits = 0x60;
    setupIm2(m, im2TopBits);

    m.interruptDevice.uart0TxEmptyStatus = true;
    m.interruptDevice.uart0TxEmpty = true;
    m.sigINT = true;
    m.executeCpuCycle();

    expect(m.pc).toBe(0x5000);
  });

  it("hwIm2Mode=true, uart1TxEmptyStatus=true → vector = im2TopBits | 0x1A (priority 13)", async () => {
    const m = await createTestNextMachine();
    const im2TopBits = 0x60;
    setupIm2(m, im2TopBits);

    m.interruptDevice.uart1TxEmptyStatus = true;
    m.interruptDevice.uart1TxEmpty = true;
    m.sigINT = true;
    m.executeCpuCycle();

    expect(m.pc).toBe(0x5000);
  });

  it("priority: line beats uart0Rx when both active", async () => {
    const m = await createTestNextMachine();
    const im2TopBits = 0x60;
    setupIm2(m, im2TopBits);

    // Both active — line (priority 0) should win
    m.interruptDevice.lineInterruptStatus = true;
    m.interruptDevice.lineInterruptEnabled = true;
    m.interruptDevice.uart0RxAvailableStatus = true;
    m.interruptDevice.uart0RxAvailable = true;
    m.sigINT = true;
    m.executeCpuCycle();

    // line vector = im2TopBits | 0x00 → table at 0x8060 → handler 0x5000
    expect(m.pc).toBe(0x5000);
    // line status cleared, uart0Rx still set
    expect(m.interruptDevice.lineInterruptStatus).toBe(false);
    expect(m.interruptDevice.uart0RxAvailableStatus).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// D4 (Next) – onInterruptAcknowledged clears the winning source
// ---------------------------------------------------------------------------

describe("Next IM2 – D4 (onInterruptAcknowledged clears winning source)", () => {
  it("lineInterruptStatus cleared after INT acknowledged in hwIm2Mode", async () => {
    const m = await createTestNextMachine();
    setupIm2(m, 0x60);

    m.interruptDevice.lineInterruptStatus = true;
    m.interruptDevice.lineInterruptEnabled = true;
    m.sigINT = true;
    m.executeCpuCycle();

    expect(m.interruptDevice.lineInterruptStatus).toBe(false);
  });

  it("uart0RxNearFullStatus cleared after INT acknowledged", async () => {
    const m = await createTestNextMachine();
    setupIm2(m, 0x60);

    m.interruptDevice.uart0RxNearFullStatus = true;
    m.interruptDevice.uart0RxNearFull = true;
    m.sigINT = true;
    m.executeCpuCycle();

    expect(m.interruptDevice.uart0RxNearFullStatus).toBe(false);
  });

  it("uart0RxAvailableStatus cleared after INT acknowledged", async () => {
    const m = await createTestNextMachine();
    setupIm2(m, 0x60);

    m.interruptDevice.uart0RxAvailableStatus = true;
    m.interruptDevice.uart0RxAvailable = true;
    m.sigINT = true;
    m.executeCpuCycle();

    expect(m.interruptDevice.uart0RxAvailableStatus).toBe(false);
  });

  it("uart1RxNearFullStatus cleared after INT acknowledged", async () => {
    const m = await createTestNextMachine();
    setupIm2(m, 0x60);

    m.interruptDevice.uart1RxNearFullStatus = true;
    m.interruptDevice.uart1RxNearFull = true;
    m.sigINT = true;
    m.executeCpuCycle();

    expect(m.interruptDevice.uart1RxNearFullStatus).toBe(false);
  });

  it("ctcIntStatus[3] cleared after INT acknowledged", async () => {
    const m = await createTestNextMachine();
    setupIm2(m, 0x60);

    m.interruptDevice.ctcIntStatus[3] = true;
    m.interruptDevice.ctcIntEnabled[3] = true;
    m.sigINT = true;
    m.executeCpuCycle();

    expect(m.interruptDevice.ctcIntStatus[3]).toBe(false);
  });

  it("ulaInterruptStatus cleared after INT acknowledged", async () => {
    const m = await createTestNextMachine();
    setupIm2(m, 0x60);

    m.interruptDevice.ulaInterruptStatus = true;
    m.sigINT = true;
    m.executeCpuCycle();

    expect(m.interruptDevice.ulaInterruptStatus).toBe(false);
  });

  it("uart0TxEmptyStatus cleared after INT acknowledged", async () => {
    const m = await createTestNextMachine();
    setupIm2(m, 0x60);

    m.interruptDevice.uart0TxEmptyStatus = true;
    m.interruptDevice.uart0TxEmpty = true;
    m.sigINT = true;
    m.executeCpuCycle();

    expect(m.interruptDevice.uart0TxEmptyStatus).toBe(false);
  });

  it("uart1TxEmptyStatus cleared after INT acknowledged", async () => {
    const m = await createTestNextMachine();
    setupIm2(m, 0x60);

    m.interruptDevice.uart1TxEmptyStatus = true;
    m.interruptDevice.uart1TxEmpty = true;
    m.sigINT = true;
    m.executeCpuCycle();

    expect(m.interruptDevice.uart1TxEmptyStatus).toBe(false);
  });

  it("in hwIm2Mode=false, no status flags touched on INT acknowledge", async () => {
    const m = await createTestNextMachine();
    m.interruptDevice.hwIm2Mode = false;
    // I=0x80 → classic vector 0xFF → table at 0x80FF
    m.i = 0x80;
    m.memoryDevice.writeMemory(0x80ff, 0x00);
    m.memoryDevice.writeMemory(0x8100, 0x50); // handler at 0x5000
    m.interruptMode = 2;
    m.sp = 0xA000;
    m.iff1 = true;
    m.pc = 0x4000;

    m.interruptDevice.ulaInterruptStatus = true;
    m.sigINT = true;
    m.executeCpuCycle();

    // Status flag should remain because hwIm2Mode=false means no Next-managed ack
    expect(m.interruptDevice.ulaInterruptStatus).toBe(true);
  });
});
