import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

describe("Next - NextRegDevice", function () {
  it("Hard reset", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.nextRegDevice;

    // --- Act
    d.hardReset();

    // --- Assert
    expect(d.directGetRegValue(0x00)).toBe(0x08);
    expect(d.directGetRegValue(0x01)).toBe(0x32);
    expect(d.directGetRegValue(0x02)).toBe(0x06);
    expect(d.directGetRegValue(0x03)).toBe(0x03);
    expect(d.directGetRegValue(0x04)).toBe(0x00);
    expect(d.directGetRegValue(0x05)).toBe(0x01);
    expect(d.directGetRegValue(0x06)).toBe(0x00);
    expect(d.directGetRegValue(0x07)).toBe(0x00);
    expect(d.directGetRegValue(0x08)).toBe(0x1a);
    expect(d.directGetRegValue(0x09)).toBe(0x00);
    expect(d.directGetRegValue(0x0a)).toBe(0x01);
    expect(d.directGetRegValue(0x0b)).toBe(0xff);
    expect(d.directGetRegValue(0x0e)).toBe(0x00);
    expect(d.directGetRegValue(0x0f)).toBe(0xff);
    expect(d.directGetRegValue(0x10)).toBe(0xff);
    expect(d.directGetRegValue(0x11)).toBe(0xff);
    expect(d.directGetRegValue(0x12)).toBe(0x08);
    expect(d.directGetRegValue(0x13)).toBe(0x0b);
    expect(d.directGetRegValue(0x14)).toBe(0xe3);
    expect(d.directGetRegValue(0x15)).toBe(0x00);
    expect(d.directGetRegValue(0x16)).toBe(0x00);
    expect(d.directGetRegValue(0x17)).toBe(0x00);
    expect(d.directGetRegValue(0x18)).toBe(0xff);
    expect(d.directGetRegValue(0x19)).toBe(0xff);
    expect(d.directGetRegValue(0x1a)).toBe(0xff);
    expect(d.directGetRegValue(0x1b)).toBe(0xff);
    expect(d.directGetRegValue(0x1c)).toBe(0x00);
    expect(d.directGetRegValue(0x1e)).toBe(0x00);
    expect(d.directGetRegValue(0x1f)).toBe(0x00);
    expect(d.directGetRegValue(0x20)).toBe(0xff);
    expect(d.directGetRegValue(0x22)).toBe(0x00);
    expect(d.directGetRegValue(0x23)).toBe(0x00);
    expect(d.directGetRegValue(0x24)).toBe(0xff);
    expect(d.directGetRegValue(0x26)).toBe(0xff);
    expect(d.directGetRegValue(0x27)).toBe(0xff);
    expect(d.directGetRegValue(0x28)).toBe(0xff);
    expect(d.directGetRegValue(0x29)).toBe(0xff);
    expect(d.directGetRegValue(0x2a)).toBe(0xff);
    expect(d.directGetRegValue(0x2b)).toBe(0xff);
    expect(d.directGetRegValue(0x2c)).toBe(0xff);
    expect(d.directGetRegValue(0x2d)).toBe(0xff);
    expect(d.directGetRegValue(0x2e)).toBe(0xff);
    expect(d.directGetRegValue(0x2f)).toBe(0xff);
    expect(d.directGetRegValue(0x30)).toBe(0xff);
    expect(d.directGetRegValue(0x31)).toBe(0xff);
    expect(d.directGetRegValue(0x32)).toBe(0x00);
    expect(d.directGetRegValue(0x33)).toBe(0x00);
    expect(d.directGetRegValue(0x34)).toBe(0xff);
    expect(d.directGetRegValue(0x35)).toBe(0xff);
    expect(d.directGetRegValue(0x36)).toBe(0xff);
    expect(d.directGetRegValue(0x37)).toBe(0xff);
    expect(d.directGetRegValue(0x38)).toBe(0xff);
    expect(d.directGetRegValue(0x39)).toBe(0xff);
    expect(d.directGetRegValue(0x40)).toBe(0xff);
    expect(d.directGetRegValue(0x41)).toBe(0xff);
    expect(d.directGetRegValue(0x42)).toBe(0x0f);
    expect(d.directGetRegValue(0x43)).toBe(0x00);
    expect(d.directGetRegValue(0x44)).toBe(0xff);
    expect(d.directGetRegValue(0x4a)).toBe(0x00);
    expect(d.directGetRegValue(0x4b)).toBe(0xe3);
    expect(d.directGetRegValue(0x4c)).toBe(0x0f);
    expect(d.directGetRegValue(0x50)).toBe(0xff);
    expect(d.directGetRegValue(0x51)).toBe(0xff);
    expect(d.directGetRegValue(0x52)).toBe(0xff);
    expect(d.directGetRegValue(0x53)).toBe(0xff);
    expect(d.directGetRegValue(0x54)).toBe(0xff);
    expect(d.directGetRegValue(0x55)).toBe(0xff);
    expect(d.directGetRegValue(0x56)).toBe(0xff);
    expect(d.directGetRegValue(0x57)).toBe(0xff);
    expect(d.directGetRegValue(0x60)).toBe(0xff);
    expect(d.directGetRegValue(0x61)).toBe(0x00);
    expect(d.directGetRegValue(0x62)).toBe(0x00);
    expect(d.directGetRegValue(0x63)).toBe(0xff);
    expect(d.directGetRegValue(0x64)).toBe(0xff);
    expect(d.directGetRegValue(0x68)).toBe(0xff);
    expect(d.directGetRegValue(0x69)).toBe(0x00);
    expect(d.directGetRegValue(0x6a)).toBe(0xff);
    expect(d.directGetRegValue(0x6b)).toBe(0x00);
    expect(d.directGetRegValue(0x6c)).toBe(0xff);
    expect(d.directGetRegValue(0x6e)).toBe(0xff);
    expect(d.directGetRegValue(0x6f)).toBe(0xff);
    expect(d.directGetRegValue(0x70)).toBe(0x00);
    expect(d.directGetRegValue(0x71)).toBe(0xff);
    expect(d.directGetRegValue(0x75)).toBe(0xff);
    expect(d.directGetRegValue(0x76)).toBe(0xff);
    expect(d.directGetRegValue(0x77)).toBe(0xff);
    expect(d.directGetRegValue(0x78)).toBe(0xff);
    expect(d.directGetRegValue(0x79)).toBe(0xff);
    expect(d.directGetRegValue(0x7f)).toBe(0xff);
    expect(d.directGetRegValue(0x80)).toBe(0xff);
    expect(d.directGetRegValue(0x81)).toBe(0xff);
    expect(d.directGetRegValue(0x82)).toBe(0xff);
    expect(d.directGetRegValue(0x83)).toBe(0xff);
    expect(d.directGetRegValue(0x84)).toBe(0xff);
    expect(d.directGetRegValue(0x85)).toBe(0xff);
    expect(d.directGetRegValue(0x86)).toBe(0xff);
    expect(d.directGetRegValue(0x87)).toBe(0xff);
    expect(d.directGetRegValue(0x88)).toBe(0xff);
    expect(d.directGetRegValue(0x89)).toBe(0xff);
    expect(d.directGetRegValue(0x8a)).toBe(0xff);
    expect(d.directGetRegValue(0x8c)).toBe(0x00);
    expect(d.directGetRegValue(0x8e)).toBe(0x08);
    expect(d.directGetRegValue(0x8f)).toBe(0xff);
    expect(d.directGetRegValue(0x90)).toBe(0xff);
    expect(d.directGetRegValue(0x91)).toBe(0xff);
    expect(d.directGetRegValue(0x92)).toBe(0xff);
    expect(d.directGetRegValue(0x98)).toBe(0xff);
    expect(d.directGetRegValue(0x99)).toBe(0xff);
    expect(d.directGetRegValue(0x9a)).toBe(0xff);
    expect(d.directGetRegValue(0x9b)).toBe(0xff);
    expect(d.directGetRegValue(0xa0)).toBe(0xff);
    expect(d.directGetRegValue(0xa2)).toBe(0xff);
    expect(d.directGetRegValue(0xa8)).toBe(0xff);
    expect(d.directGetRegValue(0xa9)).toBe(0xff);
    expect(d.directGetRegValue(0xb8)).toBe(0x83);
    expect(d.directGetRegValue(0xb9)).toBe(0x01);
    expect(d.directGetRegValue(0xba)).toBe(0x00);
    expect(d.directGetRegValue(0xbb)).toBe(0xcd);
    expect(d.directGetRegValue(0xc0)).toBe(0x00);
    expect(d.directGetRegValue(0xc2)).toBe(0x00);
    expect(d.directGetRegValue(0xc3)).toBe(0x00);
    expect(d.directGetRegValue(0xc4)).toBe(0xff);
    expect(d.directGetRegValue(0xc5)).toBe(0x00);
    expect(d.directGetRegValue(0xc6)).toBe(0x00);
    expect(d.directGetRegValue(0xc7)).toBe(0xff);
    expect(d.directGetRegValue(0xc8)).toBe(0xff);
    expect(d.directGetRegValue(0xc9)).toBe(0xff);
    expect(d.directGetRegValue(0xca)).toBe(0xff);
    expect(d.directGetRegValue(0xcb)).toBe(0xff);
    expect(d.directGetRegValue(0xcc)).toBe(0xff);
    expect(d.directGetRegValue(0xcd)).toBe(0xff);
    expect(d.directGetRegValue(0xce)).toBe(0xff);
    expect(d.directGetRegValue(0xcf)).toBe(0xff);
    expect(d.directGetRegValue(0xd8)).toBe(0xff);
    expect(d.directGetRegValue(0xd9)).toBe(0xff);
    expect(d.directGetRegValue(0xda)).toBe(0xff);
    expect(d.directGetRegValue(0xf0)).toBe(0xff);
    expect(d.directGetRegValue(0xf8)).toBe(0xff);
    expect(d.directGetRegValue(0xf9)).toBe(0xff);
    expect(d.directGetRegValue(0xfa)).toBe(0xff);
  });

  it("Hard reset & soft reset", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.nextRegDevice;

    // --- Act
    d.hardReset();
    d.reset();

    // --- Assert
    expect(d.directGetRegValue(0x00)).toBe(0x08);
    expect(d.directGetRegValue(0x01)).toBe(0x32);
    expect(d.directGetRegValue(0x02)).toBe(0x01);
    expect(d.directGetRegValue(0x03)).toBe(0x03);
    expect(d.directGetRegValue(0x04)).toBe(0x00);
    expect(d.directGetRegValue(0x05)).toBe(0x01);
    expect(d.directGetRegValue(0x06)).toBe(0x00);
    expect(d.directGetRegValue(0x07)).toBe(0x00);
    expect(d.directGetRegValue(0x08)).toBe(0x1a);
    expect(d.directGetRegValue(0x09)).toBe(0x00);
    expect(d.directGetRegValue(0x0a)).toBe(0x01);
    expect(d.directGetRegValue(0x0b)).toBe(0xff);
    expect(d.directGetRegValue(0x0e)).toBe(0x00);
    expect(d.directGetRegValue(0x0f)).toBe(0xff);
    expect(d.directGetRegValue(0x10)).toBe(0xff);
    expect(d.directGetRegValue(0x11)).toBe(0xff);
    expect(d.directGetRegValue(0x12)).toBe(0x08);
    expect(d.directGetRegValue(0x13)).toBe(0x0b);
    expect(d.directGetRegValue(0x14)).toBe(0xe3);
    expect(d.directGetRegValue(0x15)).toBe(0x00);
    expect(d.directGetRegValue(0x16)).toBe(0x00);
    expect(d.directGetRegValue(0x17)).toBe(0x00);
    expect(d.directGetRegValue(0x18)).toBe(0xff);
    expect(d.directGetRegValue(0x19)).toBe(0xff);
    expect(d.directGetRegValue(0x1a)).toBe(0xff);
    expect(d.directGetRegValue(0x1b)).toBe(0xff);
    expect(d.directGetRegValue(0x1c)).toBe(0x00);
    expect(d.directGetRegValue(0x1e)).toBe(0x00);
    expect(d.directGetRegValue(0x1f)).toBe(0x00);
    expect(d.directGetRegValue(0x20)).toBe(0xff);
    expect(d.directGetRegValue(0x22)).toBe(0x00);
    expect(d.directGetRegValue(0x23)).toBe(0x00);
    expect(d.directGetRegValue(0x24)).toBe(0xff);
    expect(d.directGetRegValue(0x26)).toBe(0xff);
    expect(d.directGetRegValue(0x27)).toBe(0xff);
    expect(d.directGetRegValue(0x28)).toBe(0xff);
    expect(d.directGetRegValue(0x29)).toBe(0xff);
    expect(d.directGetRegValue(0x2a)).toBe(0xff);
    expect(d.directGetRegValue(0x2b)).toBe(0xff);
    expect(d.directGetRegValue(0x2c)).toBe(0xff);
    expect(d.directGetRegValue(0x2d)).toBe(0xff);
    expect(d.directGetRegValue(0x2e)).toBe(0xff);
    expect(d.directGetRegValue(0x2f)).toBe(0xff);
    expect(d.directGetRegValue(0x30)).toBe(0xff);
    expect(d.directGetRegValue(0x31)).toBe(0xff);
    expect(d.directGetRegValue(0x32)).toBe(0x00);
    expect(d.directGetRegValue(0x33)).toBe(0x00);
    expect(d.directGetRegValue(0x34)).toBe(0xff);
    expect(d.directGetRegValue(0x35)).toBe(0xff);
    expect(d.directGetRegValue(0x36)).toBe(0xff);
    expect(d.directGetRegValue(0x37)).toBe(0xff);
    expect(d.directGetRegValue(0x38)).toBe(0xff);
    expect(d.directGetRegValue(0x39)).toBe(0xff);
    expect(d.directGetRegValue(0x40)).toBe(0xff);
    expect(d.directGetRegValue(0x41)).toBe(0xff);
    expect(d.directGetRegValue(0x42)).toBe(0x0f);
    expect(d.directGetRegValue(0x43)).toBe(0x00);
    expect(d.directGetRegValue(0x44)).toBe(0xff);
    expect(d.directGetRegValue(0x4a)).toBe(0x00);
    expect(d.directGetRegValue(0x4b)).toBe(0xe3);
    expect(d.directGetRegValue(0x4c)).toBe(0x0f);
    expect(d.directGetRegValue(0x50)).toBe(0xff);
    expect(d.directGetRegValue(0x51)).toBe(0xff);
    expect(d.directGetRegValue(0x52)).toBe(0xff);
    expect(d.directGetRegValue(0x53)).toBe(0xff);
    expect(d.directGetRegValue(0x54)).toBe(0xff);
    expect(d.directGetRegValue(0x55)).toBe(0xff);
    expect(d.directGetRegValue(0x56)).toBe(0xff);
    expect(d.directGetRegValue(0x57)).toBe(0xff);
    expect(d.directGetRegValue(0x60)).toBe(0xff);
    expect(d.directGetRegValue(0x61)).toBe(0x00);
    expect(d.directGetRegValue(0x62)).toBe(0x00);
    expect(d.directGetRegValue(0x63)).toBe(0xff);
    expect(d.directGetRegValue(0x64)).toBe(0xff);
    expect(d.directGetRegValue(0x68)).toBe(0xff);
    expect(d.directGetRegValue(0x69)).toBe(0x00);
    expect(d.directGetRegValue(0x6a)).toBe(0xff);
    expect(d.directGetRegValue(0x6b)).toBe(0x00);
    expect(d.directGetRegValue(0x6c)).toBe(0xff);
    expect(d.directGetRegValue(0x6e)).toBe(0xff);
    expect(d.directGetRegValue(0x6f)).toBe(0xff);
    expect(d.directGetRegValue(0x70)).toBe(0x00);
    expect(d.directGetRegValue(0x71)).toBe(0xff);
    expect(d.directGetRegValue(0x75)).toBe(0xff);
    expect(d.directGetRegValue(0x76)).toBe(0xff);
    expect(d.directGetRegValue(0x77)).toBe(0xff);
    expect(d.directGetRegValue(0x78)).toBe(0xff);
    expect(d.directGetRegValue(0x79)).toBe(0xff);
    expect(d.directGetRegValue(0x7f)).toBe(0xff);
    expect(d.directGetRegValue(0x80)).toBe(0xff);
    expect(d.directGetRegValue(0x81)).toBe(0xff);
    expect(d.directGetRegValue(0x82)).toBe(0xff);
    expect(d.directGetRegValue(0x83)).toBe(0xff);
    expect(d.directGetRegValue(0x84)).toBe(0xff);
    expect(d.directGetRegValue(0x85)).toBe(0xff);
    expect(d.directGetRegValue(0x86)).toBe(0xff);
    expect(d.directGetRegValue(0x87)).toBe(0xff);
    expect(d.directGetRegValue(0x88)).toBe(0xff);
    expect(d.directGetRegValue(0x89)).toBe(0xff);
    expect(d.directGetRegValue(0x8a)).toBe(0xff);
    expect(d.directGetRegValue(0x8c)).toBe(0x00);
    expect(d.directGetRegValue(0x8e)).toBe(0x08);
    expect(d.directGetRegValue(0x8f)).toBe(0xff);
    expect(d.directGetRegValue(0x90)).toBe(0xff);
    expect(d.directGetRegValue(0x91)).toBe(0xff);
    expect(d.directGetRegValue(0x92)).toBe(0xff);
    expect(d.directGetRegValue(0x98)).toBe(0xff);
    expect(d.directGetRegValue(0x99)).toBe(0xff);
    expect(d.directGetRegValue(0x9a)).toBe(0xff);
    expect(d.directGetRegValue(0x9b)).toBe(0xff);
    expect(d.directGetRegValue(0xa0)).toBe(0xff);
    expect(d.directGetRegValue(0xa2)).toBe(0xff);
    expect(d.directGetRegValue(0xa8)).toBe(0xff);
    expect(d.directGetRegValue(0xa9)).toBe(0xff);
    expect(d.directGetRegValue(0xb8)).toBe(0x83);
    expect(d.directGetRegValue(0xb9)).toBe(0x01);
    expect(d.directGetRegValue(0xba)).toBe(0x00);
    expect(d.directGetRegValue(0xbb)).toBe(0xcd);
    expect(d.directGetRegValue(0xc0)).toBe(0x00);
    expect(d.directGetRegValue(0xc2)).toBe(0x00);
    expect(d.directGetRegValue(0xc3)).toBe(0x00);
    expect(d.directGetRegValue(0xc4)).toBe(0xff);
    expect(d.directGetRegValue(0xc5)).toBe(0x00);
    expect(d.directGetRegValue(0xc6)).toBe(0x00);
    expect(d.directGetRegValue(0xc7)).toBe(0xff);
    expect(d.directGetRegValue(0xc8)).toBe(0xff);
    expect(d.directGetRegValue(0xc9)).toBe(0xff);
    expect(d.directGetRegValue(0xca)).toBe(0xff);
    expect(d.directGetRegValue(0xcb)).toBe(0xff);
    expect(d.directGetRegValue(0xcc)).toBe(0xff);
    expect(d.directGetRegValue(0xcd)).toBe(0xff);
    expect(d.directGetRegValue(0xce)).toBe(0xff);
    expect(d.directGetRegValue(0xcf)).toBe(0xff);
    expect(d.directGetRegValue(0xd8)).toBe(0xff);
    expect(d.directGetRegValue(0xd9)).toBe(0xff);
    expect(d.directGetRegValue(0xda)).toBe(0xff);
    expect(d.directGetRegValue(0xf0)).toBe(0xff);
    expect(d.directGetRegValue(0xf8)).toBe(0xff);
    expect(d.directGetRegValue(0xf9)).toBe(0xff);
    expect(d.directGetRegValue(0xfa)).toBe(0xff);
  });

  it("Soft reset sets reg $8c", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.nextRegDevice;
    d.hardReset();
    d.directSetRegValue(0x8c, 0x05);

    // --- Act
    d.reset();
    const value = readNextReg(m, 0x8c);

    // --- Assert
    expect(value).toBe(0x55);
  });

  it("Reg $00 read", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    const value = readNextReg(m, 0x00);

    // --- Assert
    expect(value).toBe(0x08);
  });

  it("Reg $00 cannot be written", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x00, 0x55)

    // --- Assert
    const value = readNextReg(m, 0x00);
    expect(value).toBe(0x08);
  });

  it("Reg $01 read", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x01, 0x55);

    // --- Assert
    const value = readNextReg(m, 0x01);
    expect(value).toBe(0x32);
  });

  it("Reg $01 cannot be written", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    const value = readNextReg(m, 0x01);

    // --- Assert
    expect(value).toBe(0x32);
  });

  it("Reg $22 intSignalActive", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0x22, 0x80);

    // --- Assert
    expect(readNextReg(m, 0x22)).toBe(0x80);
    expect(intDevice.intSignalActive).toBe(true);
    expect(intDevice.ulaInterruptDisabled).toBe(false);
    expect(intDevice.lineInterruptEnabled).toBe(false);
    expect(intDevice.lineInterruptMsb).toBe(0x00);
  });

  it("Reg $22 ulaInterruptDisabled", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0x22, 0x04);

    // --- Assert
    expect(readNextReg(m, 0x22)).toBe(0x04);
    expect(intDevice.intSignalActive).toBe(false);
    expect(intDevice.ulaInterruptDisabled).toBe(true);
    expect(intDevice.lineInterruptEnabled).toBe(false);
    expect(intDevice.lineInterruptMsb).toBe(0x00);
  });

  it("Reg $22 lineInteeruptEnabled", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0x22, 0x02);

    // --- Assert
    expect(readNextReg(m, 0x22)).toBe(0x02);
    expect(intDevice.intSignalActive).toBe(false);
    expect(intDevice.ulaInterruptDisabled).toBe(false);
    expect(intDevice.lineInterruptEnabled).toBe(true);
    expect(intDevice.lineInterruptMsb).toBe(0x00);
  });

  it("Reg $22 lineInterruptMsb", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0x22, 0x01);

    // --- Assert
    expect(readNextReg(m, 0x22)).toBe(0x01);
    expect(intDevice.intSignalActive).toBe(false);
    expect(intDevice.ulaInterruptDisabled).toBe(false);
    expect(intDevice.lineInterruptEnabled).toBe(false);
    expect(intDevice.lineInterruptMsb).toBe(0x100);
  });

  it("Reg $22 all bit 1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0x22, 0xff);

    // --- Assert
    expect(readNextReg(m, 0x22)).toBe(0x87);
    expect(intDevice.intSignalActive).toBe(true);
    expect(intDevice.ulaInterruptDisabled).toBe(true);
    expect(intDevice.lineInterruptEnabled).toBe(true);
    expect(intDevice.lineInterruptMsb).toBe(0x100);
  });

  it("Reg $23 read", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    const value = readNextReg(m, 0x23);

    // --- Assert
    expect(value).toBe(0x00);
  });

  it("Reg $23 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0x23, 0x5A);

    // --- Assert
    expect(readNextReg(m, 0x23)).toBe(0x5A);
  });

  it("Reg $b8 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const div = m.divMmcDevice;

    // --- Act
    writeNextReg(m, 0xb8, 0x55);

    // --- Assert
    expect(readNextReg(m, 0xb8)).toBe(0x55);
    expect(div.rstTraps[7].enabled).toBe(false);
    expect(div.rstTraps[6].enabled).toBe(true);
    expect(div.rstTraps[5].enabled).toBe(false);
    expect(div.rstTraps[4].enabled).toBe(true);
    expect(div.rstTraps[3].enabled).toBe(false);
    expect(div.rstTraps[2].enabled).toBe(true);
    expect(div.rstTraps[1].enabled).toBe(false);
    expect(div.rstTraps[0].enabled).toBe(true);
  });

  it("Reg $b9 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const div = m.divMmcDevice;

    // --- Act
    writeNextReg(m, 0xb9, 0xaa);

    // --- Assert
    expect(readNextReg(m, 0xb9)).toBe(0xaa);
    expect(div.rstTraps[7].onlyWithRom3).toBe(true);
    expect(div.rstTraps[6].onlyWithRom3).toBe(false);
    expect(div.rstTraps[5].onlyWithRom3).toBe(true);
    expect(div.rstTraps[4].onlyWithRom3).toBe(false);
    expect(div.rstTraps[3].onlyWithRom3).toBe(true);
    expect(div.rstTraps[2].onlyWithRom3).toBe(false);
    expect(div.rstTraps[1].onlyWithRom3).toBe(true);
    expect(div.rstTraps[0].onlyWithRom3).toBe(false);
  });

  it("Reg $ba write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const div = m.divMmcDevice;

    // --- Act
    writeNextReg(m, 0xba, 0x5a);

    // --- Assert
    expect(readNextReg(m, 0xba)).toBe(0x5a);
    expect(div.rstTraps[7].instantMapping).toBe(false);
    expect(div.rstTraps[6].instantMapping).toBe(true);
    expect(div.rstTraps[5].instantMapping).toBe(false);
    expect(div.rstTraps[4].instantMapping).toBe(true);
    expect(div.rstTraps[3].instantMapping).toBe(true);
    expect(div.rstTraps[2].instantMapping).toBe(false);
    expect(div.rstTraps[1].instantMapping).toBe(true);
    expect(div.rstTraps[0].instantMapping).toBe(false);
  });

  it("Reg $bb write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const div = m.divMmcDevice;

    // --- Act
    writeNextReg(m, 0xbb, 0x5a);

    // --- Assert
    expect(readNextReg(m, 0xbb)).toBe(0x5a);
    expect(div.automapOn3dxx).toBe(false);
    expect(div.disableAutomapOn1ff8).toBe(true);
    expect(div.automapOn056a).toBe(false);
    expect(div.automapOn04d7).toBe(true);
    expect(div.automapOn0562).toBe(true);
    expect(div.automapOn04c6).toBe(false);
    expect(div.automapOn0066).toBe(true);
    expect(div.automapOn0066Delayed).toBe(false);
  });

  it("Reg $c0 im2TopBits", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc0, 0xe0);

    // --- Assert
    expect(readNextReg(m, 0xc0)).toBe(0xe0);
    expect(intDevice.im2TopBits).toBe(0xe0);
    expect(intDevice.enableStacklessNmi).toBe(false);
    expect(intDevice.hwIm2Mode).toBe(false);
  });

  it("Reg $c0 enableStacklessNmi", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc0, 0x08);

    // --- Assert
    expect(readNextReg(m, 0xc0)).toBe(0x08);
    expect(intDevice.im2TopBits).toBe(0x00);
    expect(intDevice.enableStacklessNmi).toBe(true);
    expect(intDevice.hwIm2Mode).toBe(false);
  });

  it("Reg $c0 hwIm22Mode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc0, 0x01);

    // --- Assert
    expect(readNextReg(m, 0xc0)).toBe(0x01);
    expect(intDevice.im2TopBits).toBe(0x00);
    expect(intDevice.enableStacklessNmi).toBe(false);
    expect(intDevice.hwIm2Mode).toBe(true);
  });

  it("Reg $c0 currentInterruptMode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;
    m.interruptMode = 0x01;

    // --- Act
    m.interruptMode = 0x01;

    // --- Assert
    expect(readNextReg(m, 0xc0)).toBe(0x02);
    expect(intDevice.currentInterruptMode).toBe(0x01);
  });

  it("Reg $c2 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc2, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0xc2)).toBe(0xa5);
  });

  it("Reg $c3 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc3, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0xc3)).toBe(0xa5);
  });

  it("Reg $c5 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc5, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0xc5)).toBe(0xa5);
    expect(intDevice.ctcChannelEnabled[7]).toBe(true);
    expect(intDevice.ctcChannelEnabled[6]).toBe(false);
    expect(intDevice.ctcChannelEnabled[5]).toBe(true);
    expect(intDevice.ctcChannelEnabled[4]).toBe(false);
    expect(intDevice.ctcChannelEnabled[3]).toBe(false);
    expect(intDevice.ctcChannelEnabled[2]).toBe(true);
    expect(intDevice.ctcChannelEnabled[1]).toBe(false);
    expect(intDevice.ctcChannelEnabled[0]).toBe(true);
  });

  it("Reg $c6 uart1TxEmpty", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc6, 0x40);

    // --- Assert
    expect(readNextReg(m, 0xc6)).toBe(0x40);
    expect(intDevice.uart1TxEmpty).toBe(true);
    expect(intDevice.uart1RxNearFull).toBe(false);
    expect(intDevice.uart1RxAvailable).toBe(false);
    expect(intDevice.uart0TxEmpty).toBe(false);
    expect(intDevice.uart0RxNearFull).toBe(false);
    expect(intDevice.uart0RxAvailable).toBe(false);
  });

  it("Reg $c6 uart1TxNearFull", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc6, 0x20);

    // --- Assert
    expect(readNextReg(m, 0xc6)).toBe(0x20);
    expect(intDevice.uart1TxEmpty).toBe(false);
    expect(intDevice.uart1RxNearFull).toBe(true);
    expect(intDevice.uart1RxAvailable).toBe(false);
    expect(intDevice.uart0TxEmpty).toBe(false);
    expect(intDevice.uart0RxNearFull).toBe(false);
    expect(intDevice.uart0RxAvailable).toBe(false);
  });

  it("Reg $c6 uart1TxAvailable", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc6, 0x10);

    // --- Assert
    expect(readNextReg(m, 0xc6)).toBe(0x10);
    expect(intDevice.uart1TxEmpty).toBe(false);
    expect(intDevice.uart1RxNearFull).toBe(false);
    expect(intDevice.uart1RxAvailable).toBe(true);
    expect(intDevice.uart0TxEmpty).toBe(false);
    expect(intDevice.uart0RxNearFull).toBe(false);
    expect(intDevice.uart0RxAvailable).toBe(false);
  });

  it("Reg $c6 uart0RxEmpty", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc6, 0x04);

    // --- Assert
    expect(readNextReg(m, 0xc6)).toBe(0x04);
    expect(intDevice.uart1TxEmpty).toBe(false);
    expect(intDevice.uart1RxNearFull).toBe(false);
    expect(intDevice.uart1RxAvailable).toBe(false);
    expect(intDevice.uart0TxEmpty).toBe(true);
    expect(intDevice.uart0RxNearFull).toBe(false);
    expect(intDevice.uart0RxAvailable).toBe(false);
  });

  it("Reg $c6 uart0RxNearFull", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc6, 0x02);

    // --- Assert
    expect(readNextReg(m, 0xc6)).toBe(0x02);
    expect(intDevice.uart1TxEmpty).toBe(false);
    expect(intDevice.uart1RxNearFull).toBe(false);
    expect(intDevice.uart1RxAvailable).toBe(false);
    expect(intDevice.uart0TxEmpty).toBe(false);
    expect(intDevice.uart0RxNearFull).toBe(true);
    expect(intDevice.uart0RxAvailable).toBe(false);
  });

  it("Reg $c6 uart0RxAvailable", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const intDevice = m.interruptDevice;

    // --- Act
    writeNextReg(m, 0xc6, 0x01);

    // --- Assert
    expect(readNextReg(m, 0xc6)).toBe(0x01);
    expect(intDevice.uart1TxEmpty).toBe(false);
    expect(intDevice.uart1RxNearFull).toBe(false);
    expect(intDevice.uart1RxAvailable).toBe(false);
    expect(intDevice.uart0TxEmpty).toBe(false);
    expect(intDevice.uart0RxNearFull).toBe(false);
    expect(intDevice.uart0RxAvailable).toBe(true);
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
