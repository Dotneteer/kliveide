import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";

describe("Next - ExpansionBusDevice", function () {
  it("Hard reset", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.hardReset();

    // --- Assert
    expect(d.nextReg80Value).toBe(0x00);
    expect(d.nextReg81Value).toBe(0x00);
  });

  it("Soft reset #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.hardReset();
    d.nextReg80Value = 0x07;

    // --- Act
    d.reset();

    // --- Assert
    expect(d.nextReg80Value).toBe(0x77);
  });

  it("Soft reset #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.hardReset();
    d.nextReg80Value = 0xf7;

    // --- Act
    d.reset();

    // --- Assert
    expect(d.nextReg80Value).toBe(0x77);
  });

  it("Soft reset #3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;
    d.hardReset();
    d.nextReg80Value = 0x96;

    // --- Act
    d.reset();

    // --- Assert
    expect(d.nextReg80Value).toBe(0x66);
  });

  it("Disable expansion bus", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.nextReg80Value = 0x00;

    // --- Assert
    expect(d.enabled).toBe(false);
  });

  it("Enable expansion bus", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.nextReg80Value = 0x80;

    // --- Assert
    expect(d.enabled).toBe(true);
  });

  it("Set ROMCS replacement", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.nextReg80Value = 0x40;

    // --- Assert
    expect(d.romcsReplacement).toBe(true);
  });

  it("Clear ROMCS replacement", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.nextReg80Value = 0x00;

    // --- Assert
    expect(d.romcsReplacement).toBe(false);
  });

  it("Set disable I/O cycles", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.nextReg80Value = 0x20;

    // --- Assert
    expect(d.disableIoCycles).toBe(true);
  });

  it("Clear disable I/O cycles", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.nextReg80Value = 0x00;

    // --- Assert
    expect(d.disableIoCycles).toBe(false);
  });

  it("Set soft reset persistence", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.nextReg80Value = 0x0a;

    // --- Assert
    expect(d.softResetPersistence).toBe(0x0a);
  });

  it("Set nextReg81Value bits", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.nextReg81Value = 0xff;

    // --- Assert
    expect(d.romcsStatus).toBe(true);
    expect(d.ulaOverrideEnabled).toBe(true);
    expect(d.nmiDebounceDisabled).toBe(true);
    expect(d.clockAlwaysOn).toBe(true);
    expect(d.p3FDCEnabled).toBe(true);
    expect(d.reservedBits).toBe(0x07);
  });

  it("Clear nextReg81Value bits", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.nextReg81Value = 0x00;

    // --- Assert
    expect(d.romcsStatus).toBe(false);
    expect(d.ulaOverrideEnabled).toBe(false);
    expect(d.nmiDebounceDisabled).toBe(false);
    expect(d.clockAlwaysOn).toBe(false);
    expect(d.p3FDCEnabled).toBe(false);
    expect(d.reservedBits).toBe(0x00);
  });

  it("Set romscsStatus", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.nextReg81Value = 0x80;

    // --- Assert
    expect(d.romcsStatus).toBe(true);
  });

  it("Clear romscsStatus", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.nextReg81Value = 0x00;

    // --- Assert
    expect(d.romcsStatus).toBe(false);
  });

  it("Set ulaOverrideEnabled", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.nextReg81Value = 0x40;

    // --- Assert
    expect(d.ulaOverrideEnabled).toBe(true);
  });

  it("Clear ulaOverrideEnabled", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.nextReg81Value = 0x00;

    // --- Assert
    expect(d.ulaOverrideEnabled).toBe(false);
  });

  it("Set nmiDebounceDisabled", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.nextReg81Value = 0x20;

    // --- Assert
    expect(d.nmiDebounceDisabled).toBe(true);
  });

  it("Clear nmiDebounceDisabled", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.nextReg81Value = 0x00;

    // --- Assert
    expect(d.nmiDebounceDisabled).toBe(false);
  });

  it("Set clockAlwaysOn", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.nextReg81Value = 0x10;

    // --- Assert
    expect(d.clockAlwaysOn).toBe(true);
  });

  it("Clear clockAlwaysOn", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.nextReg81Value = 0x00;  

    // --- Assert
    expect(d.clockAlwaysOn).toBe(false);
  });   

  it("Set p3FDCEnabled", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.nextReg81Value = 0x08;

    // --- Assert
    expect(d.p3FDCEnabled).toBe(true);
  });

  it("Clear p3FDCEnabled", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.nextReg81Value = 0x00;  

    // --- Assert
    expect(d.p3FDCEnabled).toBe(false);
  });

  it("Set reservedBits", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.nextReg81Value = 0x07;

    // --- Assert
    expect(d.reservedBits).toBe(0x07);
  });

  it("Clear reservedBits", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.expansionBusDevice;

    // --- Act
    d.nextReg81Value = 0x00;  

    // --- Assert
    expect(d.reservedBits).toBe(0x00);
  });
});