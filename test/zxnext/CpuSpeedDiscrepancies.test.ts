import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

// ===== Tests for CPU speed control discrepancy fixes (D1-D3) =====

// --- D1: Soft reset resets CPU speed to 3.5 MHz ---

describe("Next - CPU Speed - D1: Soft reset resets speed to 3.5 MHz", function () {
  it("Soft reset resets programmed speed from 28 MHz to 3.5 MHz", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    m.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz

    // --- Act
    m.cpuSpeedDevice.reset();

    // --- Assert
    expect(m.cpuSpeedDevice.programmedSpeed).toBe(0);
    expect(m.cpuSpeedDevice.effectiveSpeed).toBe(0);
    expect(m.cpuSpeedDevice.effectiveClockMultiplier).toBe(1);
  });

  it("Soft reset resets programmed speed from 14 MHz to 3.5 MHz", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    m.cpuSpeedDevice.nextReg07Value = 0x02; // 14 MHz

    // --- Act
    m.cpuSpeedDevice.reset();

    // --- Assert
    expect(m.cpuSpeedDevice.programmedSpeed).toBe(0);
    expect(m.cpuSpeedDevice.effectiveSpeed).toBe(0);
    expect(m.cpuSpeedDevice.effectiveClockMultiplier).toBe(1);
  });

  it("Soft reset resets programmed speed from 7 MHz to 3.5 MHz", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    m.cpuSpeedDevice.nextReg07Value = 0x01; // 7 MHz

    // --- Act
    m.cpuSpeedDevice.reset();

    // --- Assert
    expect(m.cpuSpeedDevice.programmedSpeed).toBe(0);
    expect(m.cpuSpeedDevice.effectiveSpeed).toBe(0);
    expect(m.cpuSpeedDevice.effectiveClockMultiplier).toBe(1);
  });

  it("Reg 0x07 read reflects reset speed after soft reset", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    m.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz
    expect(m.cpuSpeedDevice.nextReg07Value & 0x03).toBe(0x03);

    // --- Act
    m.cpuSpeedDevice.reset();

    // --- Assert: both programmed (bits 1:0) and effective (bits 5:4) should be 0
    expect(m.cpuSpeedDevice.nextReg07Value).toBe(0x00);
  });

  it("Full machine soft reset resets CPU speed to 3.5 MHz", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    m.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz
    expect(m.cpuSpeedDevice.effectiveSpeed).toBe(3);

    // --- Act
    m.reset();

    // --- Assert
    expect(m.cpuSpeedDevice.programmedSpeed).toBe(0);
    expect(m.cpuSpeedDevice.effectiveSpeed).toBe(0);
    expect(m.cpuSpeedDevice.effectiveClockMultiplier).toBe(1);
  });

  it("Speed can be set again after soft reset", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    m.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz

    // --- Act
    m.cpuSpeedDevice.reset();
    m.cpuSpeedDevice.nextReg07Value = 0x02; // 14 MHz

    // --- Assert
    expect(m.cpuSpeedDevice.programmedSpeed).toBe(2);
    expect(m.cpuSpeedDevice.effectiveSpeed).toBe(2);
    expect(m.cpuSpeedDevice.effectiveClockMultiplier).toBe(4);
  });
});

// --- D2: Register 0x06 bit 7 hard reset value ---

describe("Next - CPU Speed - D2: Reg 0x06 bit 7 enabled on hard reset", function () {
  it("Hard reset sets hotkeyCpuSpeedEnabled to true", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Disable the hotkey first
    writeNextReg(m, 0x06, 0x00);
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(false);

    // --- Act
    nrDevice.hardReset();

    // --- Assert
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(true);
  });

  it("Hard reset reg 0x06 reads back 0x80", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    nrDevice.hardReset();

    // --- Assert: bit 7 = 1, all others = 0
    expect(nrDevice.directGetRegValue(0x06)).toBe(0x80);
  });

  it("Hard reset then soft reset keeps hotkey enabled", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    nrDevice.hardReset();
    nrDevice.reset();

    // --- Assert: soft reset explicitly sets hotkeyCpuSpeedEnabled = true
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(true);
  });

  it("Soft reset enables hotkey even if hard reset disabled it manually", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;
    nrDevice.hardReset();
    writeNextReg(m, 0x06, 0x00); // Disable hotkey

    // --- Act
    nrDevice.reset();

    // --- Assert: soft reset enables hotkey
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(true);
  });

  it("Reg 0x06 read after hard reset includes bit 7 and hotkey50_60Hz is off", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    nrDevice.hardReset();
    const val = readNextReg(m, 0x06);

    // --- Assert: Only bit 7 should be set
    expect(val & 0x80).toBe(0x80); // hotkeyCpuSpeedEnabled
    expect(val & 0x20).toBe(0x00); // hotkey50_60HzEnabled is not set on hard reset
  });
});

// --- D3: delayMemoryWrite should not count base T-states as contention ---

describe("Next - CPU Speed - D3: delayMemoryWrite no contention counters", function () {
  it("delayMemoryWrite does not increment contention counters", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    m.cpuSpeedDevice.nextReg07Value = 0x00; // 3.5 MHz
    const startContention = m.totalContentionDelaySinceStart;
    const startContentionPause = m.contentionDelaySincePause;

    // --- Act
    m.delayMemoryWrite(0x4000);

    // --- Assert: contention counters should NOT increase
    expect(m.totalContentionDelaySinceStart).toBe(startContention);
    expect(m.contentionDelaySincePause).toBe(startContentionPause);
  });

  it("delayMemoryWrite at 28 MHz does not increment contention counters", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    m.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz
    const startContention = m.totalContentionDelaySinceStart;

    // --- Act
    m.delayMemoryWrite(0x4000);

    // --- Assert
    expect(m.totalContentionDelaySinceStart).toBe(startContention);
    expect(m.contentionDelaySincePause).toBe(0);
  });

  it("Multiple delayMemoryWrite calls don't accumulate contention", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    m.cpuSpeedDevice.nextReg07Value = 0x00; // 3.5 MHz

    // --- Act
    m.delayMemoryWrite(0x4000);
    m.delayMemoryWrite(0x5000);
    m.delayMemoryWrite(0x6000);

    // --- Assert: T-states increase but contention does not
    expect(m.tacts).toBeGreaterThan(0);
    expect(m.totalContentionDelaySinceStart).toBe(0);
    expect(m.contentionDelaySincePause).toBe(0);
  });

  it("delayMemoryRead still increments contention at 28 MHz", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    m.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz

    // --- Act: read from non-Bank-7 address
    m.delayMemoryRead(0x4000);

    // --- Assert: read DOES add contention (the +1 wait state)
    expect(m.totalContentionDelaySinceStart).toBe(1);
    expect(m.contentionDelaySincePause).toBe(1);
  });

  it("delayMemoryWrite still adds 3 T-states to tact counter", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    m.cpuSpeedDevice.nextReg07Value = 0x00; // 3.5 MHz
    const startTacts = m.tacts;

    // --- Act
    m.delayMemoryWrite(0x4000);

    // --- Assert: timing is correct, just contention counters are zero
    expect(m.tacts - startTacts).toBe(3);
  });

  it("Mixed read/write: only read contention counted at 28 MHz", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    m.cpuSpeedDevice.nextReg07Value = 0x03; // 28 MHz

    // --- Act
    m.delayMemoryRead(0x4000);  // +1 contention (non-Bank-7 at 28MHz)
    m.delayMemoryWrite(0x4000); // 0 contention
    m.delayMemoryRead(0x5000);  // +1 contention

    // --- Assert: only the two reads contribute to contention
    expect(m.totalContentionDelaySinceStart).toBe(2);
    expect(m.contentionDelaySincePause).toBe(2);
  });
});


function writeNextReg(m: IZxNextMachine, reg: number, value: number) {
  m.nextRegDevice.setNextRegisterIndex(reg);
  m.nextRegDevice.setNextRegisterValue(value);
}

function readNextReg(m: IZxNextMachine, reg: number): number {
  m.nextRegDevice.setNextRegisterIndex(reg);
  return m.nextRegDevice.getNextRegisterValue();
}
