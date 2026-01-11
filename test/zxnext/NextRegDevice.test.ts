import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import { JoystickMode } from "@emu/machines/zxNext/JoystickDevice";

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
    expect(d.directGetRegValue(0x02)).toBe(0x02);
    expect(d.directGetRegValue(0x03)).toBe(0x03);
    expect(d.directGetRegValue(0x04)).toBe(0x03);
    expect(d.directGetRegValue(0x05)).toBe(0x41);
    expect(d.directGetRegValue(0x06)).toBe(0x00);
    expect(d.directGetRegValue(0x07)).toBe(0x00);
    expect(d.directGetRegValue(0x08)).toBe(0x1a);
    expect(d.directGetRegValue(0x09)).toBe(0x00);
    expect(d.directGetRegValue(0x0a)).toBe(0x01);
    expect(d.directGetRegValue(0x0b)).toBe(0x01);
    expect(d.directGetRegValue(0x0e)).toBe(0x00);
    expect(d.directGetRegValue(0x0f)).toBe(0x02);
    expect(d.directGetRegValue(0x10)).toBe(0xff);
    expect(d.directGetRegValue(0x11)).toBe(0x00);
    expect(d.directGetRegValue(0x12)).toBe(0x08);
    expect(d.directGetRegValue(0x13)).toBe(0x0b);
    expect(d.directGetRegValue(0x14)).toBe(0xe3);
    expect(d.directGetRegValue(0x15)).toBe(0x00);
    expect(d.directGetRegValue(0x16)).toBe(0x00);
    expect(d.directGetRegValue(0x17)).toBe(0x00);
    expect(d.directGetRegValue(0x18)).toBe(0x00);
    expect(d.directGetRegValue(0x19)).toBe(0x00);
    expect(d.directGetRegValue(0x1a)).toBe(0x00);
    expect(d.directGetRegValue(0x1b)).toBe(0x00);
    expect(d.directGetRegValue(0x1c)).toBe(0x00);
    expect(d.directGetRegValue(0x1e)).toBe(0x00);
    expect(d.directGetRegValue(0x1f)).toBe(0x00);
    expect(d.directGetRegValue(0x20)).toBe(0x00);
    expect(d.directGetRegValue(0x22)).toBe(0x00);
    expect(d.directGetRegValue(0x23)).toBe(0x00);
    expect(d.directGetRegValue(0x24)).toBe(0x00);
    expect(d.directGetRegValue(0x26)).toBe(0x00);
    expect(d.directGetRegValue(0x27)).toBe(0x00);
    expect(d.directGetRegValue(0x28)).toBe(0x00);
    expect(d.directGetRegValue(0x29)).toBe(0xff);
    expect(d.directGetRegValue(0x2a)).toBe(0x00);
    expect(d.directGetRegValue(0x2b)).toBe(0x00);
    expect(d.directGetRegValue(0x2c)).toBe(0x00);
    expect(d.directGetRegValue(0x2d)).toBe(0x00);
    expect(d.directGetRegValue(0x2e)).toBe(0x00);
    expect(d.directGetRegValue(0x2f)).toBe(0x00);
    expect(d.directGetRegValue(0x30)).toBe(0x00);
    expect(d.directGetRegValue(0x31)).toBe(0x00);
    expect(d.directGetRegValue(0x32)).toBe(0x00);
    expect(d.directGetRegValue(0x33)).toBe(0x00);
    expect(d.directGetRegValue(0x34)).toBe(0x00);
    expect(d.directGetRegValue(0x35)).toBe(0x00);
    expect(d.directGetRegValue(0x36)).toBe(0x00);
    expect(d.directGetRegValue(0x37)).toBe(0x00);
    expect(d.directGetRegValue(0x38)).toBe(0x00);
    expect(d.directGetRegValue(0x39)).toBe(0x00);
    expect(d.directGetRegValue(0x40)).toBe(0x00);
    expect(d.directGetRegValue(0x41)).toBe(0x00);
    expect(d.directGetRegValue(0x42)).toBe(0x0f);
    expect(d.directGetRegValue(0x43)).toBe(0x00);
    expect(d.directGetRegValue(0x44)).toBe(0x00);
    expect(d.directGetRegValue(0x4a)).toBe(0x00);
    expect(d.directGetRegValue(0x4b)).toBe(0xe3);
    expect(d.directGetRegValue(0x4c)).toBe(0x0f);
    expect(d.directGetRegValue(0x50)).toBe(0xff);
    expect(d.directGetRegValue(0x51)).toBe(0xff);
    expect(d.directGetRegValue(0x52)).toBe(0x0a);
    expect(d.directGetRegValue(0x53)).toBe(0x0b);
    expect(d.directGetRegValue(0x54)).toBe(0x04);
    expect(d.directGetRegValue(0x55)).toBe(0x05);
    expect(d.directGetRegValue(0x56)).toBe(0x00);
    expect(d.directGetRegValue(0x57)).toBe(0x01);
    expect(d.directGetRegValue(0x60)).toBe(0x01);
    expect(d.directGetRegValue(0x61)).toBe(0x00);
    expect(d.directGetRegValue(0x62)).toBe(0x00);
    expect(d.directGetRegValue(0x63)).toBe(0x00);
    expect(d.directGetRegValue(0x64)).toBe(0xff);
    expect(d.directGetRegValue(0x68)).toBe(0x00);
    expect(d.directGetRegValue(0x69)).toBe(0x00);
    expect(d.directGetRegValue(0x6a)).toBe(0x00);
    expect(d.directGetRegValue(0x6b)).toBe(0x00);
    expect(d.directGetRegValue(0x6c)).toBe(0x00);
    expect(d.directGetRegValue(0x6e)).toBe(0x00);
    expect(d.directGetRegValue(0x6f)).toBe(0x00);
    expect(d.directGetRegValue(0x70)).toBe(0x00);
    expect(d.directGetRegValue(0x71)).toBe(0x00);
    expect(d.directGetRegValue(0x75)).toBe(0x00);
    expect(d.directGetRegValue(0x76)).toBe(0x00);
    expect(d.directGetRegValue(0x77)).toBe(0x00);
    expect(d.directGetRegValue(0x78)).toBe(0x00);
    expect(d.directGetRegValue(0x79)).toBe(0x00);
    expect(d.directGetRegValue(0x7f)).toBe(0xff);
    expect(d.directGetRegValue(0x80)).toBe(0x00);
    expect(d.directGetRegValue(0x81)).toBe(0x00);
    expect(d.directGetRegValue(0x82)).toBe(0xff);
    expect(d.directGetRegValue(0x83)).toBe(0xff);
    expect(d.directGetRegValue(0x84)).toBe(0xff);
    expect(d.directGetRegValue(0x85)).toBe(0xff);
    expect(d.directGetRegValue(0x86)).toBe(0xff);
    expect(d.directGetRegValue(0x87)).toBe(0xff);
    expect(d.directGetRegValue(0x88)).toBe(0xff);
    expect(d.directGetRegValue(0x89)).toBe(0x00);
    expect(d.directGetRegValue(0x8a)).toBe(0xff);
    expect(d.directGetRegValue(0x8c)).toBe(0x00);
    expect(d.directGetRegValue(0x8e)).toBe(0x08);
    expect(d.directGetRegValue(0x8f)).toBe(0x00);
    expect(d.directGetRegValue(0x90)).toBe(0xff);
    expect(d.directGetRegValue(0x91)).toBe(0xff);
    expect(d.directGetRegValue(0x92)).toBe(0xff);
    expect(d.directGetRegValue(0x98)).toBe(0xff);
    expect(d.directGetRegValue(0x99)).toBe(0xff);
    expect(d.directGetRegValue(0x9a)).toBe(0xff);
    expect(d.directGetRegValue(0x9b)).toBe(0x00);
    expect(d.directGetRegValue(0xa0)).toBe(0xff);
    expect(d.directGetRegValue(0xa2)).toBe(0x02);
    expect(d.directGetRegValue(0xa8)).toBe(0x00);
    expect(d.directGetRegValue(0xa9)).toBe(0x05);
    expect(d.directGetRegValue(0xb8)).toBe(0x83);
    expect(d.directGetRegValue(0xb9)).toBe(0x01);
    expect(d.directGetRegValue(0xba)).toBe(0x00);
    expect(d.directGetRegValue(0xbb)).toBe(0xcd);
    expect(d.directGetRegValue(0xc0)).toBe(0x00);
    expect(d.directGetRegValue(0xc2)).toBe(0x00);
    expect(d.directGetRegValue(0xc3)).toBe(0x00);
    expect(d.directGetRegValue(0xc4)).toBe(0x00);
    expect(d.directGetRegValue(0xc5)).toBe(0x00);
    expect(d.directGetRegValue(0xc6)).toBe(0x00);
    expect(d.directGetRegValue(0xc7)).toBe(0x00);
    expect(d.directGetRegValue(0xc8)).toBe(0x00);
    expect(d.directGetRegValue(0xc9)).toBe(0x00);
    expect(d.directGetRegValue(0xca)).toBe(0x00);
    expect(d.directGetRegValue(0xcb)).toBe(0x00);
    expect(d.directGetRegValue(0xcc)).toBe(0x00);
    expect(d.directGetRegValue(0xcd)).toBe(0x00);
    expect(d.directGetRegValue(0xce)).toBe(0x00);
    expect(d.directGetRegValue(0xcf)).toBe(0x00);
    expect(d.directGetRegValue(0xd8)).toBe(0x00);
    expect(d.directGetRegValue(0xd9)).toBe(0xff);
    expect(d.directGetRegValue(0xda)).toBe(0x00);
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
    expect(d.directGetRegValue(0x04)).toBe(0x03);
    expect(d.directGetRegValue(0x05)).toBe(0x41);
    expect(d.directGetRegValue(0x06)).toBe(0xa0);
    expect(d.directGetRegValue(0x07)).toBe(0x00);
    expect(d.directGetRegValue(0x08)).toBe(0x1a);
    expect(d.directGetRegValue(0x09)).toBe(0x00);
    expect(d.directGetRegValue(0x0a)).toBe(0x01);
    expect(d.directGetRegValue(0x0b)).toBe(0x01);
    expect(d.directGetRegValue(0x0e)).toBe(0x00);
    expect(d.directGetRegValue(0x0f)).toBe(0x02);
    expect(d.directGetRegValue(0x10)).toBe(0xff);
    expect(d.directGetRegValue(0x11)).toBe(0x00);
    expect(d.directGetRegValue(0x12)).toBe(0x08);
    expect(d.directGetRegValue(0x13)).toBe(0x0b);
    expect(d.directGetRegValue(0x14)).toBe(0xe3);
    expect(d.directGetRegValue(0x15)).toBe(0x00);
    expect(d.directGetRegValue(0x16)).toBe(0x00);
    expect(d.directGetRegValue(0x17)).toBe(0x00);
    expect(d.directGetRegValue(0x18)).toBe(0x00);
    expect(d.directGetRegValue(0x19)).toBe(0x00);
    expect(d.directGetRegValue(0x1a)).toBe(0x00);
    expect(d.directGetRegValue(0x1b)).toBe(0x00);
    expect(d.directGetRegValue(0x1c)).toBe(0x00);
    expect(d.directGetRegValue(0x1e)).toBe(0x00);
    expect(d.directGetRegValue(0x1f)).toBe(0x00);
    expect(d.directGetRegValue(0x20)).toBe(0x00);
    expect(d.directGetRegValue(0x22)).toBe(0x00);
    expect(d.directGetRegValue(0x23)).toBe(0x00);
    expect(d.directGetRegValue(0x24)).toBe(0x00);
    expect(d.directGetRegValue(0x26)).toBe(0x00);
    expect(d.directGetRegValue(0x27)).toBe(0x00);
    expect(d.directGetRegValue(0x28)).toBe(0x00);
    expect(d.directGetRegValue(0x29)).toBe(0xff);
    expect(d.directGetRegValue(0x2a)).toBe(0x00);
    expect(d.directGetRegValue(0x2b)).toBe(0x00);
    expect(d.directGetRegValue(0x2c)).toBe(0x00);
    expect(d.directGetRegValue(0x2d)).toBe(0x00);
    expect(d.directGetRegValue(0x2e)).toBe(0x00);
    expect(d.directGetRegValue(0x2f)).toBe(0x00);
    expect(d.directGetRegValue(0x30)).toBe(0x00);
    expect(d.directGetRegValue(0x31)).toBe(0x00);
    expect(d.directGetRegValue(0x32)).toBe(0x00);
    expect(d.directGetRegValue(0x33)).toBe(0x00);
    expect(d.directGetRegValue(0x34)).toBe(0x00);
    expect(d.directGetRegValue(0x35)).toBe(0x00);
    expect(d.directGetRegValue(0x36)).toBe(0x00);
    expect(d.directGetRegValue(0x37)).toBe(0x00);
    expect(d.directGetRegValue(0x38)).toBe(0x00);
    expect(d.directGetRegValue(0x39)).toBe(0x00);
    expect(d.directGetRegValue(0x40)).toBe(0x00);
    expect(d.directGetRegValue(0x41)).toBe(0x00);
    expect(d.directGetRegValue(0x42)).toBe(0x0f);
    expect(d.directGetRegValue(0x43)).toBe(0x00);
    expect(d.directGetRegValue(0x44)).toBe(0x00);
    expect(d.directGetRegValue(0x4a)).toBe(0x00);
    expect(d.directGetRegValue(0x4b)).toBe(0xe3);
    expect(d.directGetRegValue(0x4c)).toBe(0x0f);
    expect(d.directGetRegValue(0x50)).toBe(0xff);
    expect(d.directGetRegValue(0x51)).toBe(0xff);
    expect(d.directGetRegValue(0x52)).toBe(0x0a);
    expect(d.directGetRegValue(0x53)).toBe(0x0b);
    expect(d.directGetRegValue(0x54)).toBe(0x04);
    expect(d.directGetRegValue(0x55)).toBe(0x05);
    expect(d.directGetRegValue(0x56)).toBe(0x00);
    expect(d.directGetRegValue(0x57)).toBe(0x01);
    expect(d.directGetRegValue(0x60)).toBe(0x01);
    expect(d.directGetRegValue(0x61)).toBe(0x00);
    expect(d.directGetRegValue(0x62)).toBe(0x00);
    expect(d.directGetRegValue(0x63)).toBe(0x00);
    expect(d.directGetRegValue(0x64)).toBe(0xff);
    expect(d.directGetRegValue(0x68)).toBe(0x00);
    expect(d.directGetRegValue(0x69)).toBe(0x00);
    expect(d.directGetRegValue(0x6a)).toBe(0x00);
    expect(d.directGetRegValue(0x6b)).toBe(0x00);
    expect(d.directGetRegValue(0x6c)).toBe(0x00);
    expect(d.directGetRegValue(0x6e)).toBe(0x00);
    expect(d.directGetRegValue(0x6f)).toBe(0x00);
    expect(d.directGetRegValue(0x70)).toBe(0x00);
    expect(d.directGetRegValue(0x71)).toBe(0x00);
    expect(d.directGetRegValue(0x75)).toBe(0x00);
    expect(d.directGetRegValue(0x76)).toBe(0x00);
    expect(d.directGetRegValue(0x77)).toBe(0x00);
    expect(d.directGetRegValue(0x78)).toBe(0x00);
    expect(d.directGetRegValue(0x79)).toBe(0x00);
    expect(d.directGetRegValue(0x7f)).toBe(0xff);
    expect(d.directGetRegValue(0x80)).toBe(0x00);
    expect(d.directGetRegValue(0x81)).toBe(0x00);
    expect(d.directGetRegValue(0x82)).toBe(0xff);
    expect(d.directGetRegValue(0x83)).toBe(0xff);
    expect(d.directGetRegValue(0x84)).toBe(0xff);
    expect(d.directGetRegValue(0x85)).toBe(0xff);
    expect(d.directGetRegValue(0x86)).toBe(0xff);
    expect(d.directGetRegValue(0x87)).toBe(0xff);
    expect(d.directGetRegValue(0x88)).toBe(0xff);
    expect(d.directGetRegValue(0x89)).toBe(0x00);
    expect(d.directGetRegValue(0x8a)).toBe(0xff);
    expect(d.directGetRegValue(0x8c)).toBe(0x00);
    expect(d.directGetRegValue(0x8e)).toBe(0x08);
    expect(d.directGetRegValue(0x8f)).toBe(0x00);
    expect(d.directGetRegValue(0x90)).toBe(0xff);
    expect(d.directGetRegValue(0x91)).toBe(0xff);
    expect(d.directGetRegValue(0x92)).toBe(0xff);
    expect(d.directGetRegValue(0x98)).toBe(0xff);
    expect(d.directGetRegValue(0x99)).toBe(0xff);
    expect(d.directGetRegValue(0x9a)).toBe(0xff);
    expect(d.directGetRegValue(0x9b)).toBe(0x00);
    expect(d.directGetRegValue(0xa0)).toBe(0xff);
    expect(d.directGetRegValue(0xa2)).toBe(0x02);
    expect(d.directGetRegValue(0xa8)).toBe(0x00);
    expect(d.directGetRegValue(0xa9)).toBe(0x05);
    expect(d.directGetRegValue(0xb8)).toBe(0x83);
    expect(d.directGetRegValue(0xb9)).toBe(0x01);
    expect(d.directGetRegValue(0xba)).toBe(0x00);
    expect(d.directGetRegValue(0xbb)).toBe(0xcd);
    expect(d.directGetRegValue(0xc0)).toBe(0x00);
    expect(d.directGetRegValue(0xc2)).toBe(0x00);
    expect(d.directGetRegValue(0xc3)).toBe(0x00);
    expect(d.directGetRegValue(0xc4)).toBe(0x00);
    expect(d.directGetRegValue(0xc5)).toBe(0x00);
    expect(d.directGetRegValue(0xc6)).toBe(0x00);
    expect(d.directGetRegValue(0xc7)).toBe(0x00);
    expect(d.directGetRegValue(0xc8)).toBe(0x00);
    expect(d.directGetRegValue(0xc9)).toBe(0x00);
    expect(d.directGetRegValue(0xca)).toBe(0x00);
    expect(d.directGetRegValue(0xcb)).toBe(0x00);
    expect(d.directGetRegValue(0xcc)).toBe(0x00);
    expect(d.directGetRegValue(0xcd)).toBe(0x00);
    expect(d.directGetRegValue(0xce)).toBe(0x00);
    expect(d.directGetRegValue(0xcf)).toBe(0x00);
    expect(d.directGetRegValue(0xd8)).toBe(0x00);
    expect(d.directGetRegValue(0xd9)).toBe(0xff);
    expect(d.directGetRegValue(0xda)).toBe(0x00);
    expect(d.directGetRegValue(0xf0)).toBe(0xff);
    expect(d.directGetRegValue(0xf8)).toBe(0xff);
    expect(d.directGetRegValue(0xf9)).toBe(0xff);
    expect(d.directGetRegValue(0xfa)).toBe(0xff);
  });

  it("Soft reset sets reg $80", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.nextRegDevice;
    d.hardReset();
    d.directSetRegValue(0x80, 0x03);

    // --- Act
    d.reset();
    const value = readNextReg(m, 0x80);

    // --- Assert
    expect(value).toBe(0x33);
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
    writeNextReg(m, 0x00, 0x55);

    // --- Assert
    const value = readNextReg(m, 0x00);
    expect(value).toBe(0x08);
  });

  it("Reg $01 read", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    const value = readNextReg(m, 0x01);

    // --- Assert
    expect(value).toBe(0x32);
  });

  it("Reg $01 cannot be written", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x01, 0x55);

    // --- Assert
    const value = readNextReg(m, 0x01);
    expect(value).toBe(0x32);
  });

  it("Reg $03 palette SecondWrite read #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    const value = readNextReg(m, 0x03);

    // --- Assert
    expect(value & 0x80).toBe(0x00);
  });

  it("Reg $03 set config mode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nextDev = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x03, 0x07);

    // --- Assert
    expect(nextDev.configMode).toBe(true);
  });

  it("Reg $03 clear config mode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nextDev = m.nextRegDevice;
    writeNextReg(m, 0x03, 0x07);

    // --- Act
    for (let i = 1; i <= 6; i++) {
      writeNextReg(m, 0x03, i);
      expect(nextDev.configMode).toBe(false);
    }
  });

  it("Reg $03 keep config mode #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nextDev = m.nextRegDevice;
    writeNextReg(m, 0x03, 0x00);

    // --- Act
    writeNextReg(m, 0x03, 0x00);

    // --- Assert
    expect(nextDev.configMode).toBe(false);
  });

  it("Reg $03 keep config mode #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nextDev = m.nextRegDevice;
    writeNextReg(m, 0x03, 0x07);

    // --- Act
    writeNextReg(m, 0x03, 0x00);

    // --- Assert
    expect(nextDev.configMode).toBe(true);
  });

  const displayTimingCases = [
    [0x80, 0x01],
    [0x90, 0x01],
    [0xa0, 0x02],
    [0xb0, 0x03],
    [0xc0, 0x04],
    [0xd0, 0x03],
    [0xe0, 0x03],
    [0xf0, 0x03]
  ];

  displayTimingCases.forEach((tc, idx) => {
    it(`Reg $03 changes displayTiming #${idx + 1}`, async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      scrDevice.displayTiming = 0x00;
      scrDevice.userLockOnDisplayTiming = false;
      m.nextRegDevice.configMode = false;

      // --- Act
      writeNextReg(m, 0x03, tc[0]);
      expect(scrDevice.displayTiming).toBe(tc[1]);
    });
  });

  it("Reg $04 write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x04, 0x2d);

    // --- Assert
    expect(m.memoryDevice.configRomRamBank).toBe(0x2d);
  });

  it("Reg $04 write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x04, 0xad);

    // --- Assert
    expect(m.memoryDevice.configRomRamBank).toBe(0x2d);
  });

  it("Reg $04 read #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    const value = readNextReg(m, 0x04);

    // --- Assert
    expect(value).toBe(0xff);
  });

  it("Reg $04 read #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    readNextReg(m, 0x55);

    // --- Act
    const value = readNextReg(m, 0x04);

    // --- Assert
    expect(value).toBe(0x05);
  });

  const joystick1Modes = [
    { value: 0x00, mode: JoystickMode.Sinclair2 },
    { value: 0x40, mode: JoystickMode.Kempston1 },
    { value: 0x80, mode: JoystickMode.Cursor },
    { value: 0xc0, mode: JoystickMode.Sinclair1 },
    { value: 0x08, mode: JoystickMode.Kempston2 },
    { value: 0x48, mode: JoystickMode.MD1 },
    { value: 0x88, mode: JoystickMode.MD2 },
    { value: 0xc8, mode: JoystickMode.UserDefined }
  ];
  joystick1Modes.forEach((jm) => {
    it(`Reg $05 Joystick 1 mode ${jm.value}`, async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const jsDevice = m.joystickDevice;

      // --- Act
      writeNextReg(m, 0x05, jm.value);

      // --- Assert
      expect(jsDevice.joystick1Mode).toBe(jm.mode);
    });
  });

  const joystick2Modes = [
    { value: 0x00, mode: JoystickMode.Sinclair2 },
    { value: 0x10, mode: JoystickMode.Kempston1 },
    { value: 0x20, mode: JoystickMode.Cursor },
    { value: 0x30, mode: JoystickMode.Sinclair1 },
    { value: 0x02, mode: JoystickMode.Kempston2 },
    { value: 0x12, mode: JoystickMode.MD1 },
    { value: 0x22, mode: JoystickMode.MD2 },
    { value: 0x32, mode: JoystickMode.UserDefined }
  ];
  joystick2Modes.forEach((jm) => {
    it(`Reg $05 Joystick2 mode ${jm.value}`, async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const jsDevice = m.joystickDevice;

      // --- Act
      writeNextReg(m, 0x05, jm.value);

      // --- Assert
      expect(jsDevice.joystick2Mode).toBe(jm.mode);
    });
  });

  it("Reg $05 60 Hz mode #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.composedScreenDevice;

    // --- Act
    writeNextReg(m, 0x05, 0x00);

    // --- Assert
    expect(scrDevice.is60HzMode).toBe(false);
  });

  it("Reg $05 60 Hz mode #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.composedScreenDevice;

    // --- Act
    writeNextReg(m, 0x05, 0x04);

    // --- Assert
    expect(scrDevice.is60HzMode).toBe(true);
  });

  it("Reg $05 scandoubler #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.composedScreenDevice;

    // --- Act
    writeNextReg(m, 0x05, 0x00);

    // --- Assert
    expect(scrDevice.scandoublerEnabled).toBe(false);
  });

  it("Reg $05 scandoubler #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.composedScreenDevice;

    // --- Act
    writeNextReg(m, 0x05, 0x01);

    // --- Assert
    expect(scrDevice.scandoublerEnabled).toBe(true);
  });

  it("Reg $06 hotkeyCpuSpeedEnabled", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const divMmcDevice = m.divMmcDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x06, 0x80);

    // --- Assert
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(true);
    expect(soundDevice.beepOnlyToInternalSpeaker).toBe(false);
    expect(nrDevice.hotkey50_60HzEnabled).toBe(false);
    expect(divMmcDevice.enableDivMmcNmiByDriveButton).toBe(false);
    expect(divMmcDevice.enableMultifaceNmiByM1Button).toBe(false);
    expect(nrDevice.ps2Mode).toBe(false);
    expect(soundDevice.psgMode).toBe(0);
  });

  it("Reg $06 beepOnlyToInternalSpeaker", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const divMmcDevice = m.divMmcDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x06, 0x40);

    // --- Assert
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(false);
    expect(soundDevice.beepOnlyToInternalSpeaker).toBe(true);
    expect(nrDevice.hotkey50_60HzEnabled).toBe(false);
    expect(divMmcDevice.enableDivMmcNmiByDriveButton).toBe(false);
    expect(divMmcDevice.enableMultifaceNmiByM1Button).toBe(false);
    expect(nrDevice.ps2Mode).toBe(false);
    expect(soundDevice.psgMode).toBe(0);
  });

  it("Reg $06 hotkey50_60HzEnabled", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const divMmcDevice = m.divMmcDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x06, 0x20);

    // --- Assert
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(false);
    expect(soundDevice.beepOnlyToInternalSpeaker).toBe(false);
    expect(nrDevice.hotkey50_60HzEnabled).toBe(true);
    expect(divMmcDevice.enableDivMmcNmiByDriveButton).toBe(false);
    expect(divMmcDevice.enableMultifaceNmiByM1Button).toBe(false);
    expect(nrDevice.ps2Mode).toBe(false);
    expect(soundDevice.psgMode).toBe(0);
  });

  it("Reg $06 enableDivMmcNmiByDriveButton", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const divMmcDevice = m.divMmcDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x06, 0x10);

    // --- Assert
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(false);
    expect(soundDevice.beepOnlyToInternalSpeaker).toBe(false);
    expect(nrDevice.hotkey50_60HzEnabled).toBe(false);
    expect(divMmcDevice.enableDivMmcNmiByDriveButton).toBe(true);
    expect(divMmcDevice.enableMultifaceNmiByM1Button).toBe(false);
    expect(nrDevice.ps2Mode).toBe(false);
    expect(soundDevice.psgMode).toBe(0);
  });

  it("Reg $06 enableMultifaceNmiByM1Button", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const divMmcDevice = m.divMmcDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x06, 0x08);

    // --- Assert
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(false);
    expect(soundDevice.beepOnlyToInternalSpeaker).toBe(false);
    expect(nrDevice.hotkey50_60HzEnabled).toBe(false);
    expect(divMmcDevice.enableDivMmcNmiByDriveButton).toBe(false);
    expect(divMmcDevice.enableMultifaceNmiByM1Button).toBe(true);
    expect(nrDevice.ps2Mode).toBe(false);
    expect(soundDevice.psgMode).toBe(0);
  });

  it("Reg $06 ps2Mode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const divMmcDevice = m.divMmcDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x06, 0x04);

    // --- Assert
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(false);
    expect(soundDevice.beepOnlyToInternalSpeaker).toBe(false);
    expect(nrDevice.hotkey50_60HzEnabled).toBe(false);
    expect(divMmcDevice.enableDivMmcNmiByDriveButton).toBe(false);
    expect(divMmcDevice.enableMultifaceNmiByM1Button).toBe(false);
    expect(nrDevice.ps2Mode).toBe(true);
    expect(soundDevice.psgMode).toBe(0);
  });

  it("Reg $06 psgMode #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const divMmcDevice = m.divMmcDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x06, 0x01);

    // --- Assert
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(false);
    expect(soundDevice.beepOnlyToInternalSpeaker).toBe(false);
    expect(nrDevice.hotkey50_60HzEnabled).toBe(false);
    expect(divMmcDevice.enableDivMmcNmiByDriveButton).toBe(false);
    expect(divMmcDevice.enableMultifaceNmiByM1Button).toBe(false);
    expect(nrDevice.ps2Mode).toBe(false);
    expect(soundDevice.psgMode).toBe(1);
  });

  it("Reg $06 psgMode #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const divMmcDevice = m.divMmcDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x06, 0x02);

    // --- Assert
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(false);
    expect(soundDevice.beepOnlyToInternalSpeaker).toBe(false);
    expect(nrDevice.hotkey50_60HzEnabled).toBe(false);
    expect(divMmcDevice.enableDivMmcNmiByDriveButton).toBe(false);
    expect(divMmcDevice.enableMultifaceNmiByM1Button).toBe(false);
    expect(nrDevice.ps2Mode).toBe(false);
    expect(soundDevice.psgMode).toBe(2);
  });

  it("Reg $06 all bits", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const divMmcDevice = m.divMmcDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x06, 0xff);

    // --- Assert
    expect(nrDevice.hotkeyCpuSpeedEnabled).toBe(true);
    expect(soundDevice.beepOnlyToInternalSpeaker).toBe(true);
    expect(nrDevice.hotkey50_60HzEnabled).toBe(true);
    expect(divMmcDevice.enableDivMmcNmiByDriveButton).toBe(true);
    expect(divMmcDevice.enableMultifaceNmiByM1Button).toBe(true);
    expect(nrDevice.ps2Mode).toBe(true);
    expect(soundDevice.psgMode).toBe(3);
  });

  it("Reg $07 cpu speed #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x07, 0x00);

    // --- Assert
    expect(readNextReg(m, 0x07)).toBe(0x00);
    expect(m.cpuSpeedDevice.programmedSpeed).toBe(0x00);
    expect(m.cpuSpeedDevice.effectiveSpeed).toBe(0x00);
  });

  it("Reg $07 cpu speed #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x07, 0x01);

    // --- Assert
    expect(readNextReg(m, 0x07)).toBe(0x11);
    expect(m.cpuSpeedDevice.programmedSpeed).toBe(0x01);
    expect(m.cpuSpeedDevice.effectiveSpeed).toBe(0x01);
  });

  it("Reg $07 cpu speed #3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x07, 0x02);

    // --- Assert
    expect(readNextReg(m, 0x07)).toBe(0x22);
    expect(m.cpuSpeedDevice.programmedSpeed).toBe(0x02);
    expect(m.cpuSpeedDevice.effectiveSpeed).toBe(0x02);
  });

  it("Reg $07 cpu speed #4", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x07, 0x03);

    // --- Assert
    expect(readNextReg(m, 0x07)).toBe(0x33);
    expect(m.cpuSpeedDevice.programmedSpeed).toBe(0x03);
    expect(m.cpuSpeedDevice.effectiveSpeed).toBe(0x03);
  });

  it("Reg $08 unlockPort7ffd", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x08, 0x80);

    // --- Assert
    expect(nrDevice.unlockPort7ffd).toBe(true);
    expect(nrDevice.disableRamPortContention).toBe(false);
    expect(soundDevice.ayStereoMode).toBe(false);
    expect(soundDevice.enableInternalSpeaker).toBe(false);
    expect(soundDevice.enable8BitDacs).toBe(false);
    expect(nrDevice.enablePort0xffTimexVideoModeRead).toBe(false);
    expect(soundDevice.enableTurbosound).toBe(false);
    expect(nrDevice.implementIssue2Keyboard).toBe(false);
  });

  it("Reg $08 disableRamPortContention", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x08, 0x40);

    // --- Assert
    expect(nrDevice.unlockPort7ffd).toBe(false);
    expect(nrDevice.disableRamPortContention).toBe(true);
    expect(soundDevice.ayStereoMode).toBe(false);
    expect(soundDevice.enableInternalSpeaker).toBe(false);
    expect(soundDevice.enable8BitDacs).toBe(false);
    expect(nrDevice.enablePort0xffTimexVideoModeRead).toBe(false);
    expect(soundDevice.enableTurbosound).toBe(false);
    expect(nrDevice.implementIssue2Keyboard).toBe(false);
  });

  it("Reg $08 ayStereoMode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x08, 0x20);

    // --- Assert
    expect(nrDevice.unlockPort7ffd).toBe(false);
    expect(nrDevice.disableRamPortContention).toBe(false);
    expect(soundDevice.ayStereoMode).toBe(true);
    expect(soundDevice.enableInternalSpeaker).toBe(false);
    expect(soundDevice.enable8BitDacs).toBe(false);
    expect(nrDevice.enablePort0xffTimexVideoModeRead).toBe(false);
    expect(soundDevice.enableTurbosound).toBe(false);
    expect(nrDevice.implementIssue2Keyboard).toBe(false);
  });

  it("Reg $08 enableInternalSpeaker", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x08, 0x10);

    // --- Assert
    expect(nrDevice.unlockPort7ffd).toBe(false);
    expect(nrDevice.disableRamPortContention).toBe(false);
    expect(soundDevice.ayStereoMode).toBe(false);
    expect(soundDevice.enableInternalSpeaker).toBe(true);
    expect(soundDevice.enable8BitDacs).toBe(false);
    expect(nrDevice.enablePort0xffTimexVideoModeRead).toBe(false);
    expect(soundDevice.enableTurbosound).toBe(false);
    expect(nrDevice.implementIssue2Keyboard).toBe(false);
  });

  it("Reg $08 enable8BitDacs", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x08, 0x08);

    // --- Assert
    expect(nrDevice.unlockPort7ffd).toBe(false);
    expect(nrDevice.disableRamPortContention).toBe(false);
    expect(soundDevice.ayStereoMode).toBe(false);
    expect(soundDevice.enableInternalSpeaker).toBe(false);
    expect(soundDevice.enable8BitDacs).toBe(true);
    expect(nrDevice.enablePort0xffTimexVideoModeRead).toBe(false);
    expect(soundDevice.enableTurbosound).toBe(false);
    expect(nrDevice.implementIssue2Keyboard).toBe(false);
  });

  it("Reg $08 enablePort0xffTimexVideoModeRead", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x08, 0x04);

    // --- Assert
    expect(nrDevice.unlockPort7ffd).toBe(false);
    expect(nrDevice.disableRamPortContention).toBe(false);
    expect(soundDevice.ayStereoMode).toBe(false);
    expect(soundDevice.enableInternalSpeaker).toBe(false);
    expect(soundDevice.enable8BitDacs).toBe(false);
    expect(nrDevice.enablePort0xffTimexVideoModeRead).toBe(true);
    expect(soundDevice.enableTurbosound).toBe(false);
    expect(nrDevice.implementIssue2Keyboard).toBe(false);
  });

  it("Reg $08 enableTurbosound", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x08, 0x02);

    // --- Assert
    expect(nrDevice.unlockPort7ffd).toBe(false);
    expect(nrDevice.disableRamPortContention).toBe(false);
    expect(soundDevice.ayStereoMode).toBe(false);
    expect(soundDevice.enableInternalSpeaker).toBe(false);
    expect(soundDevice.enable8BitDacs).toBe(false);
    expect(nrDevice.enablePort0xffTimexVideoModeRead).toBe(false);
    expect(soundDevice.enableTurbosound).toBe(true);
    expect(nrDevice.implementIssue2Keyboard).toBe(false);
  });

  it("Reg $08 implementIssue2Keyboard", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x08, 0x01);

    // --- Assert
    expect(nrDevice.unlockPort7ffd).toBe(false);
    expect(nrDevice.disableRamPortContention).toBe(false);
    expect(soundDevice.ayStereoMode).toBe(false);
    expect(soundDevice.enableInternalSpeaker).toBe(false);
    expect(soundDevice.enable8BitDacs).toBe(false);
    expect(nrDevice.enablePort0xffTimexVideoModeRead).toBe(false);
    expect(soundDevice.enableTurbosound).toBe(false);
    expect(nrDevice.implementIssue2Keyboard).toBe(true);
  });

  it("Reg $09 ay2Mono", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;

    // --- Act
    writeNextReg(m, 0x09, 0x80);

    // --- Assert
    expect(readNextReg(m, 0x09)).toBe(0x80);
    expect(soundDevice.ay2Mono).toBe(true);
    expect(soundDevice.ay1Mono).toBe(false);
    expect(soundDevice.ay0Mono).toBe(false);
    expect(m.spriteDevice.spriteIdLockstep).toBe(false);
    expect(m.divMmcDevice.resetDivMmcMapramFlag).toBe(false);
    expect(soundDevice.silenceHdmiAudio).toBe(false);
    expect(m.composedScreenDevice.scanlineWeight).toBe(0);
  });

  it("Reg $09 ay1Mono", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;

    // --- Act
    writeNextReg(m, 0x09, 0x40);

    // --- Assert
    expect(readNextReg(m, 0x09)).toBe(0x40);
    expect(soundDevice.ay2Mono).toBe(false);
    expect(soundDevice.ay1Mono).toBe(true);
    expect(soundDevice.ay0Mono).toBe(false);
    expect(m.spriteDevice.spriteIdLockstep).toBe(false);
    expect(m.divMmcDevice.resetDivMmcMapramFlag).toBe(false);
    expect(soundDevice.silenceHdmiAudio).toBe(false);
    expect(m.composedScreenDevice.scanlineWeight).toBe(0);
  });

  it("Reg $09 ay0Mono", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const soundDevice = m.soundDevice;

    // --- Act
    writeNextReg(m, 0x09, 0x20);

    // --- Assert
    expect(readNextReg(m, 0x09)).toBe(0x20);
    expect(soundDevice.ay2Mono).toBe(false);
    expect(soundDevice.ay1Mono).toBe(false);
    expect(soundDevice.ay0Mono).toBe(true);
    expect(m.spriteDevice.spriteIdLockstep).toBe(false);
    expect(m.divMmcDevice.resetDivMmcMapramFlag).toBe(false);
    expect(soundDevice.silenceHdmiAudio).toBe(false);
    expect(m.composedScreenDevice.scanlineWeight).toBe(0);
  });

  it("Reg $09 spriteIdLockstep", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x09, 0x10);

    // --- Assert
    expect(readNextReg(m, 0x09)).toBe(0x10);
    expect(m.soundDevice.ay2Mono).toBe(false);
    expect(m.soundDevice.ay1Mono).toBe(false);
    expect(m.soundDevice.ay0Mono).toBe(false);
    expect(m.spriteDevice.spriteIdLockstep).toBe(true);
    expect(m.divMmcDevice.resetDivMmcMapramFlag).toBe(false);
    expect(m.soundDevice.silenceHdmiAudio).toBe(false);
    expect(m.composedScreenDevice.scanlineWeight).toBe(0);
  });

  it("Reg $09 resetDivMmcMapramFlag", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x09, 0x08);

    // --- Assert
    expect(readNextReg(m, 0x09)).toBe(0x00);
    expect(m.soundDevice.ay2Mono).toBe(false);
    expect(m.soundDevice.ay1Mono).toBe(false);
    expect(m.soundDevice.ay0Mono).toBe(false);
    expect(m.spriteDevice.spriteIdLockstep).toBe(false);
    expect(m.divMmcDevice.resetDivMmcMapramFlag).toBe(true);
    expect(m.soundDevice.silenceHdmiAudio).toBe(false);
    expect(m.composedScreenDevice.scanlineWeight).toBe(0);
  });

  it("Reg $09 silenceHdmiAudio", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x09, 0x04);

    // --- Assert
    expect(readNextReg(m, 0x09)).toBe(0x04);
    expect(m.soundDevice.ay2Mono).toBe(false);
    expect(m.soundDevice.ay1Mono).toBe(false);
    expect(m.soundDevice.ay0Mono).toBe(false);
    expect(m.spriteDevice.spriteIdLockstep).toBe(false);
    expect(m.divMmcDevice.resetDivMmcMapramFlag).toBe(false);
    expect(m.soundDevice.silenceHdmiAudio).toBe(true);
    expect(m.composedScreenDevice.scanlineWeight).toBe(0);
  });

  it("Reg $0a multifaceType", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const divMmcDevice = m.divMmcDevice;
    const mouseDevice = m.mouseDevice;

    // --- Act
    writeNextReg(m, 0x0a, 0x40);

    // --- Assert
    expect(readNextReg(m, 0x0a)).toBe(0x40);
    expect(divMmcDevice.multifaceType).toBe(0x01);
    expect(divMmcDevice.enableAutomap).toBe(false);
    expect(mouseDevice.swapButtons).toBe(false);
    expect(mouseDevice.dpi).toBe(0x00);
  });

  it("Reg $0a enableAutomap", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const divMmcDevice = m.divMmcDevice;
    const mouseDevice = m.mouseDevice;

    // --- Act
    writeNextReg(m, 0x0a, 0x10);

    // --- Assert
    expect(readNextReg(m, 0x0a)).toBe(0x10);
    expect(divMmcDevice.multifaceType).toBe(0x00);
    expect(divMmcDevice.enableAutomap).toBe(true);
    expect(mouseDevice.swapButtons).toBe(false);
    expect(mouseDevice.dpi).toBe(0x00);
  });

  it("Reg $0a swapButtons", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const divMmcDevice = m.divMmcDevice;
    const mouseDevice = m.mouseDevice;

    // --- Act
    writeNextReg(m, 0x0a, 0x08);

    // --- Assert
    expect(readNextReg(m, 0x0a)).toBe(0x08);
    expect(divMmcDevice.multifaceType).toBe(0x00);
    expect(divMmcDevice.enableAutomap).toBe(false);
    expect(mouseDevice.swapButtons).toBe(true);
    expect(mouseDevice.dpi).toBe(0x00);
  });

  it("Reg $0a dpi", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const divMmcDevice = m.divMmcDevice;
    const mouseDevice = m.mouseDevice;

    // --- Act
    writeNextReg(m, 0x0a, 0x02);

    // --- Assert
    expect(readNextReg(m, 0x0a)).toBe(0x02);
    expect(divMmcDevice.multifaceType).toBe(0x00);
    expect(divMmcDevice.enableAutomap).toBe(false);
    expect(mouseDevice.swapButtons).toBe(false);
    expect(mouseDevice.dpi).toBe(0x02);
  });

  it("Reg $0b ioModeEnabled", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const joystickDevice = m.joystickDevice;

    // --- Act
    writeNextReg(m, 0x0b, 0x80);

    // --- Assert
    expect(readNextReg(m, 0x0b)).toBe(0x80);
    expect(joystickDevice.ioModeEnabled).toBe(true);
    expect(joystickDevice.ioMode).toBe(0x00);
    expect(joystickDevice.ioModeParam).toBe(false);
  });

  it("Reg $0b ioMode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const joystickDevice = m.joystickDevice;

    // --- Act
    writeNextReg(m, 0x0b, 0x20);

    // --- Assert
    expect(readNextReg(m, 0x0b)).toBe(0x20);
    expect(joystickDevice.ioModeEnabled).toBe(false);
    expect(joystickDevice.ioMode).toBe(0x02);
    expect(joystickDevice.ioModeParam).toBe(false);
  });

  it("Reg $0b ioModeParam", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const joystickDevice = m.joystickDevice;

    // --- Act
    writeNextReg(m, 0x0b, 0x11);

    // --- Assert
    expect(readNextReg(m, 0x0b)).toBe(0x11);
    expect(joystickDevice.ioModeEnabled).toBe(false);
    expect(joystickDevice.ioMode).toBe(0x01);
    expect(joystickDevice.ioModeParam).toBe(true);
  });

  it("Reg $0e read", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    const value = readNextReg(m, 0x0e);

    // --- Assert
    expect(value).toBe(0x00);
  });

  it("Reg $0e cannot be written", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x0e, 0x55);

    // --- Assert
    const value = readNextReg(m, 0x0e);
    expect(value).toBe(0x00);
  });

  it("Reg $0f read", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    const value = readNextReg(m, 0x0f);

    // --- Assert
    expect(value).toBe(0x02);
  });

  it("Reg $0f cannot be written", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x0f, 0x55);

    // --- Assert
    const value = readNextReg(m, 0x0f);
    expect(value).toBe(0x02);
  });

  it("Reg $11 videoTimingMode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x11, 0x26);

    // --- Assert
    expect(readNextReg(m, 0x11)).toBe(0x06);
    expect(m.composedScreenDevice.videoTimingMode).toBe(0x06);
  });

  it("Reg $12 write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.composedScreenDevice;

    // --- Act
    writeNextReg(m, 0x12, 0x03);

    // --- Assert
    expect(scrDevice.layer2ActiveRamBank).toBe(0x03);
  });

  it("Reg $12 write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x12, 0x97);

    // --- Assert
    expect(m.composedScreenDevice.layer2ActiveRamBank).toBe(0x17);
  });

  it("Reg $13 write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.composedScreenDevice;

    // --- Act
    writeNextReg(m, 0x13, 0x03);

    // --- Assert
    expect(scrDevice.layer2ShadowRamBank).toBe(0x03);
  });

  it("Reg $13 write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.composedScreenDevice;

    // --- Act
    writeNextReg(m, 0x13, 0x03);

    // --- Assert
    expect(scrDevice.layer2ShadowRamBank).toBe(0x03);
  });

  it("Reg $15 enableLoresMode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const screenDevice = m.composedScreenDevice;
    const spriteDevice = m.spriteDevice;

    // --- Act
    writeNextReg(m, 0x15, 0x80);

    // --- Assert
    expect(screenDevice.loResEnabled).toBe(true);
    expect(spriteDevice.sprite0OnTop).toBe(false);
    expect(spriteDevice.spriteClippingEnabled).toBe(false);
    expect(screenDevice.layerPriority).toBe(0x00);
    expect(spriteDevice.spritesOverBorderEnabled).toBe(false);
    expect(spriteDevice.spritesEnabled).toBe(false);
  });

  it("Reg $15 sprite0OnTop", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const screenDevice = m.composedScreenDevice;
    const spriteDevice = m.spriteDevice;

    // --- Act
    writeNextReg(m, 0x15, 0x40);

    // --- Assert
    expect(screenDevice.loResEnabled).toBe(false);
    expect(spriteDevice.sprite0OnTop).toBe(true);
    expect(spriteDevice.spriteClippingEnabled).toBe(false);
    expect(screenDevice.layerPriority).toBe(0x00);
    expect(spriteDevice.spritesOverBorderEnabled).toBe(false);
    expect(spriteDevice.spritesEnabled).toBe(false);
  });

  it("Reg $15 enableSpriteClipping", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const screenDevice = m.composedScreenDevice;
    const spriteDevice = m.spriteDevice;

    // --- Act
    writeNextReg(m, 0x15, 0x20);

    // --- Assert
    expect(screenDevice.loResEnabled).toBe(false);
    expect(spriteDevice.sprite0OnTop).toBe(false);
    expect(spriteDevice.spriteClippingEnabled).toBe(true);
    expect(screenDevice.layerPriority).toBe(0x00);
    expect(spriteDevice.spritesOverBorderEnabled).toBe(false);
    expect(spriteDevice.spritesEnabled).toBe(false);
  });

  it("Reg $15 layerPriority", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const screenDevice = m.composedScreenDevice;
    const spriteDevice = m.spriteDevice;

    // --- Act
    writeNextReg(m, 0x15, 0x18);

    // --- Assert
    expect(screenDevice.loResEnabled).toBe(false);
    expect(spriteDevice.sprite0OnTop).toBe(false);
    expect(spriteDevice.spriteClippingEnabled).toBe(false);
    expect(screenDevice.layerPriority).toBe(0x06);
    expect(spriteDevice.spritesOverBorderEnabled).toBe(false);
    expect(spriteDevice.spritesEnabled).toBe(false);
  });

  it("Reg $15 enableSpritesOverBorder", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const screenDevice = m.composedScreenDevice;
    const spriteDevice = m.spriteDevice;

    // --- Act
    writeNextReg(m, 0x15, 0x02);

    // --- Assert
    expect(screenDevice.loResEnabled).toBe(false);
    expect(spriteDevice.sprite0OnTop).toBe(false);
    expect(spriteDevice.spriteClippingEnabled).toBe(false);
    expect(screenDevice.layerPriority).toBe(0x00);
    expect(spriteDevice.spritesOverBorderEnabled).toBe(true);
    expect(spriteDevice.spritesEnabled).toBe(false);
  });

  it("Reg $15 enableSprites", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const screenDevice = m.composedScreenDevice;
    const spriteDevice = m.spriteDevice;

    // --- Act
    writeNextReg(m, 0x15, 0x01);

    // --- Assert
    expect(screenDevice.loResEnabled).toBe(false);
    expect(spriteDevice.sprite0OnTop).toBe(false);
    expect(spriteDevice.spriteClippingEnabled).toBe(false);
    expect(screenDevice.layerPriority).toBe(0x00);
    expect(spriteDevice.spritesOverBorderEnabled).toBe(false);
    expect(spriteDevice.spritesEnabled).toBe(true);
  });

  it("Reg $1c layer2 clip index reset works", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x1c, 0x01);
    writeNextReg(m, 0x1b, 0x23);
    writeNextReg(m, 0x1b, 0x34);
    writeNextReg(m, 0x1b, 0x45);

    // --- Act
    writeNextReg(m, 0x1c, 0x01);

    // --- Assert
    expect(m.composedScreenDevice.layer2ClipIndex).toBe(0x00);
  });

  it("Reg $1c sprite clip index reset works", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x1c, 0x02);
    writeNextReg(m, 0x19, 0x23);
    writeNextReg(m, 0x19, 0x34);
    writeNextReg(m, 0x19, 0x45);

    // --- Act
    writeNextReg(m, 0x1c, 0x02);

    // --- Assert
    expect(m.spriteDevice.clipIndex).toBe(0x00);
  });

  it("Reg $1c ula clip index reset works", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x1c, 0x04);
    writeNextReg(m, 0x1a, 0x23);
    writeNextReg(m, 0x1a, 0x34);
    writeNextReg(m, 0x1a, 0x45);

    // --- Act
    writeNextReg(m, 0x1c, 0x04);

    // --- Assert
    expect(m.composedScreenDevice.ulaClipIndex).toBe(0x00);
  });

  it("Reg $1c tilemap clip index reset works", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x1c, 0x08);
    writeNextReg(m, 0x1b, 0x23);
    writeNextReg(m, 0x1b, 0x34);
    writeNextReg(m, 0x1b, 0x45);

    // --- Act
    writeNextReg(m, 0x1c, 0x08);

    // --- Assert
    expect(m.tilemapDevice.clipIndex).toBe(0x00);
  });

  it("Reg $1c layer2 clip index read", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x1c, 0x01);
    writeNextReg(m, 0x18, 0x23);
    writeNextReg(m, 0x18, 0x34);
    writeNextReg(m, 0x18, 0x45);

    // --- Assert
    expect(readNextReg(m, 0x1c) & 0x03).toBe(0x03);
  });

  it("Reg $1c sprite clip index read", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x1c, 0x02);
    writeNextReg(m, 0x19, 0x23);
    writeNextReg(m, 0x19, 0x34);
    writeNextReg(m, 0x19, 0x45);

    // --- Assert
    expect(readNextReg(m, 0x1c) & 0x0c).toBe(0x0c);
  });

  it("Reg $1e read #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.composedScreenDevice;
    scrDevice.activeVideoLine = 0x23;

    // --- Assert
    expect(readNextReg(m, 0x1e)).toBe(0x00);
  });

  it("Reg $1e read #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.composedScreenDevice;
    scrDevice.activeVideoLine = 0x123;

    // --- Assert
    expect(readNextReg(m, 0x1e)).toBe(0x01);
  });

  it("Reg $1f read #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.composedScreenDevice;
    scrDevice.activeVideoLine = 0x23;

    // --- Assert
    expect(readNextReg(m, 0x1f)).toBe(0x23);
  });

  it("Reg $1f read #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.composedScreenDevice;
    scrDevice.activeVideoLine = 0x123;

    // --- Assert
    expect(readNextReg(m, 0x1f)).toBe(0x23);
  });

  it("Reg $28 read returns last stored palette value", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x40, 0x20);
    writeNextReg(m, 0x41, 0x5a);

    // --- Assert
    expect(readNextReg(m, 0x28)).toBe(0x5a);
  });

  it("Reg $28 selectKeyJoystick", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x28, 0x80);

    // --- Assert
    expect(m.nextRegDevice.selectKeyJoystick).toBe(true);
  });

  it("Reg $28 ps2KeymapAddressMsb", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x28, 0x01);

    // --- Assert
    expect(m.nextRegDevice.ps2KeymapAddressMsb).toBe(true);
  });

  it("Reg $29 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x29, 0x5a);

    // --- Assert
    expect(readNextReg(m, 0x29)).toBe(0x5a);
    expect(m.nextRegDevice.ps2KeymapAddressLsb).toBe(0x5a);
  });

  it("Reg $2a ps2KeymapDataMsb", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x2a, 0x01);

    // --- Assert
    expect(m.nextRegDevice.ps2KeymapDataMsb).toBe(true);
  });

  it("Reg $2b write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x2b, 0xaa);

    // --- Assert
    expect(readNextReg(m, 0x2b)).toBe(0xaa);
    expect(m.nextRegDevice.ps2KeymapDataLsb).toBe(0xaa);
  });

  it("Reg $2f write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x2b, 0xaa);

    // --- Assert
    expect(readNextReg(m, 0x2b)).toBe(0xaa);
    expect(m.nextRegDevice.ps2KeymapDataLsb).toBe(0xaa);
  });

  it("Reg $32 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x32, 0xa7);

    // --- Assert
    expect(readNextReg(m, 0x32)).toBe(0xa7);
    expect(m.composedScreenDevice.loResScrollX).toBe(0xa7);
  });

  it("Reg $33 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x33, 0xa7);

    // --- Assert
    expect(readNextReg(m, 0x33)).toBe(0xa7);
    expect(m.composedScreenDevice.loResScrollY).toBe(0xa7);
  });

  it("Reg $42 write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.composedScreenDevice;

    // --- Act
    writeNextReg(m, 0x42, 0x3f);

    // --- Assert
    expect(d.ulaNextFormat).toBe(0x3f);
  });

  it("Reg $42 write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.composedScreenDevice;

    // --- Act
    writeNextReg(m, 0x42, 0x1f);

    // --- Assert
    expect(d.ulaNextFormat).toBe(0x1f);
  });

  it("Reg $4a write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x4a, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x4a)).toBe(0xa5);
    expect(m.composedScreenDevice.fallbackColor).toBe(0xa5);
  });

  it("Reg $4b write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x4b, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x4b)).toBe(0xa5);
    expect(m.spriteDevice.transparencyIndex).toBe(0xa5);
  });

  it("Reg $60 first write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;
    copperDevice.setInstructionAddress(0x000);

    // --- Act
    writeNextReg(m, 0x60, 0xaa);

    // --- Assert
    expect(m.copperDevice.readMemory(0x000)).toBe(0xaa);
    expect(m.copperDevice.readMemory(0x001)).toBe(0x00);
    expect(m.copperDevice.instructionAddress).toBe(0x001);
  });

  it("Reg $60 second write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;
    copperDevice.setInstructionAddress(0x000);
    writeNextReg(m, 0x60, 0xaa);

    // --- Act
    writeNextReg(m, 0x60, 0x55);

    // --- Assert
    expect(m.copperDevice.readMemory(0x000)).toBe(0xaa);
    expect(m.copperDevice.readMemory(0x001)).toBe(0x55);
    expect(m.copperDevice.instructionAddress).toBe(0x002);
  });

  it("Reg $60 address after first write gets to zero", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;
    copperDevice.setInstructionAddress(0x7ff);

    // --- Act
    writeNextReg(m, 0x60, 0xaa);

    // --- Assert
    expect(m.copperDevice.readMemory(0x7ff)).toBe(0xaa);
    expect(m.copperDevice.readMemory(0x000)).toBe(0x00);
    expect(m.copperDevice.instructionAddress).toBe(0x000);
  });

  it("Reg $60 address after second write gets to zero", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;
    copperDevice.setInstructionAddress(0x7fe);
    writeNextReg(m, 0x60, 0xaa);

    // --- Act
    writeNextReg(m, 0x60, 0x55);

    // --- Assert
    expect(m.copperDevice.readMemory(0x7fe)).toBe(0xaa);
    expect(m.copperDevice.readMemory(0x7ff)).toBe(0x55);
    expect(m.copperDevice.instructionAddress).toBe(0x000);
  });

  it("Reg $61 write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x62, 0x00);

    // --- Act
    writeNextReg(m, 0x61, 0xbe);

    // --- Assert
    expect(readNextReg(m, 0x61)).toBe(0xbe);
    expect(m.copperDevice.instructionAddress).toBe(0xbe);
  });

  it("Reg $61 write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    writeNextReg(m, 0x62, 0x04);

    // --- Act
    writeNextReg(m, 0x61, 0xbe);

    // --- Assert
    expect(readNextReg(m, 0x61)).toBe(0xbe);
    expect(m.copperDevice.instructionAddress).toBe(0x4be);
  });

  it("Reg $62 startMode #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;

    // --- Act
    writeNextReg(m, 0x62, 0x00);

    // --- Assert
    expect(readNextReg(m, 0x62)).toBe(0x00);
    expect(m.copperDevice.startMode).toBe(0x00);
    expect(m.copperDevice.instructionAddress).toBe(0x0000);
  });

  it("Reg $62 startMode #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;

    // --- Act
    writeNextReg(m, 0x62, 0x40);

    // --- Assert
    expect(readNextReg(m, 0x62)).toBe(0x40);
    expect(m.copperDevice.startMode).toBe(0x01);
    expect(m.copperDevice.instructionAddress).toBe(0x0000);
  });

  it("Reg $62 startMode #3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;

    // --- Act
    writeNextReg(m, 0x62, 0x80);

    // --- Assert
    expect(readNextReg(m, 0x62)).toBe(0x80);
    expect(m.copperDevice.startMode).toBe(0x02);
    expect(m.copperDevice.instructionAddress).toBe(0x0000);
  });

  it("Reg $62 startMode #4", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;

    // --- Act
    writeNextReg(m, 0x62, 0xc0);

    // --- Assert
    expect(readNextReg(m, 0x62)).toBe(0xc0);
    expect(m.copperDevice.startMode).toBe(0x03);
    expect(m.copperDevice.instructionAddress).toBe(0x0000);
  });

  it("Reg $62 address MSB #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;

    // --- Act
    writeNextReg(m, 0x62, 0x00);

    // --- Assert
    expect(readNextReg(m, 0x62)).toBe(0x00);
    expect(m.copperDevice.startMode).toBe(0x00);
    expect(m.copperDevice.instructionAddress).toBe(0x0000);
  });

  it("Reg $62 address MSB #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;

    // --- Act
    writeNextReg(m, 0x62, 0x01);

    // --- Assert
    expect(readNextReg(m, 0x62)).toBe(0x01);
    expect(m.copperDevice.startMode).toBe(0x00);
    expect(m.copperDevice.instructionAddress).toBe(0x0100);
  });

  it("Reg $62 address MSB #3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;

    // --- Act
    writeNextReg(m, 0x62, 0x06);

    // --- Assert
    expect(readNextReg(m, 0x62)).toBe(0x06);
    expect(m.copperDevice.startMode).toBe(0x00);
    expect(m.copperDevice.instructionAddress).toBe(0x0600);
  });

  it("Reg $62 address MSB #4", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;

    // --- Act
    writeNextReg(m, 0x62, 0x07);

    // --- Assert
    expect(readNextReg(m, 0x62)).toBe(0x07);
    expect(m.copperDevice.startMode).toBe(0x00);
    expect(m.copperDevice.instructionAddress).toBe(0x0700);
  });

  it("Reg $63 first even write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;
    copperDevice.setInstructionAddress(0x000);

    // --- Act
    writeNextReg(m, 0x63, 0xaa);

    // --- Assert
    expect(m.copperDevice.readMemory(0x000)).toBe(0x00);
    expect(m.copperDevice.readMemory(0x001)).toBe(0x00);
    expect(m.copperDevice.instructionAddress).toBe(0x001);
  });

  it("Reg $63 first even write, second odd write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;
    copperDevice.setInstructionAddress(0x000);

    // --- Act
    writeNextReg(m, 0x63, 0xaa);
    writeNextReg(m, 0x63, 0x55);

    // --- Assert
    expect(m.copperDevice.readMemory(0x000)).toBe(0xaa);
    expect(m.copperDevice.readMemory(0x001)).toBe(0x55);
    expect(m.copperDevice.instructionAddress).toBe(0x002);
  });

  it("Reg $63 first odd write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;
    copperDevice.setInstructionAddress(0x001);

    // --- Act
    writeNextReg(m, 0x63, 0xaa);

    // --- Assert
    expect(m.copperDevice.readMemory(0x000)).toBe(0x00);
    expect(m.copperDevice.readMemory(0x001)).toBe(0xaa);
    expect(m.copperDevice.instructionAddress).toBe(0x002);
  });

  it("Reg $63 first odd write, second even", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;
    copperDevice.setInstructionAddress(0x001);
    writeNextReg(m, 0x63, 0xaa);

    // --- Act
    writeNextReg(m, 0x63, 0x55);

    // --- Assert
    expect(m.copperDevice.readMemory(0x000)).toBe(0x00);
    expect(m.copperDevice.readMemory(0x001)).toBe(0xaa);
    expect(m.copperDevice.readMemory(0x002)).toBe(0x00);
    expect(m.copperDevice.instructionAddress).toBe(0x003);
  });

  it("Reg $63 first odd write, second even, third odd", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;
    copperDevice.setInstructionAddress(0x001);
    writeNextReg(m, 0x63, 0xaa);
    writeNextReg(m, 0x63, 0x55);

    // --- Act
    writeNextReg(m, 0x63, 0x23);

    // --- Assert
    expect(m.copperDevice.readMemory(0x000)).toBe(0x00);
    expect(m.copperDevice.readMemory(0x001)).toBe(0xaa);
    expect(m.copperDevice.readMemory(0x002)).toBe(0x55);
    expect(m.copperDevice.readMemory(0x003)).toBe(0x23);
    expect(m.copperDevice.instructionAddress).toBe(0x004);
  });

  it("Reg $63 address gets zero after two writes", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const copperDevice = m.copperDevice;
    copperDevice.setInstructionAddress(0x7fe);

    // --- Act
    writeNextReg(m, 0x63, 0xaa);
    writeNextReg(m, 0x63, 0x55);

    // --- Assert
    expect(m.copperDevice.readMemory(0x7fe)).toBe(0xaa);
    expect(m.copperDevice.readMemory(0x7ff)).toBe(0x55);
    expect(m.copperDevice.instructionAddress).toBe(0x000);
  });

  it("Reg $64 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x64, 0xbe);

    // --- Assert
    expect(readNextReg(m, 0x64)).toBe(0xbe);
    expect(m.copperDevice.verticalLineOffset).toBe(0xbe);
  });

  it("Reg $68 cancelExtendedKeyEntries", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const ulaDevice = m.ulaDevice;

    // --- Act
    writeNextReg(m, 0x68, 0x10);

    // --- Assert
    expect(readNextReg(m, 0x68)).toBe(0x10);
    expect(m.keyboardDevice.cancelExtendedKeyEntries).toBe(true);
  });

  it("Reg $6a isRadastanMode", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.composedScreenDevice;

    // --- Act
    writeNextReg(m, 0x6a, 0x20);

    // --- Assert
    expect(readNextReg(m, 0x6a)).toBe(0x20);
    expect(scrDevice.loResRadastanMode).toBe(true);
    expect(scrDevice.loResRadastanTimexXor).toBe(false);
    expect(scrDevice.loResPaletteOffset).toBe(0);
  });

  it("Reg $6a radastanTimexXor", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.composedScreenDevice;

    // --- Act
    writeNextReg(m, 0x6a, 0x10);

    // --- Assert
    expect(readNextReg(m, 0x6a)).toBe(0x10);
    expect(scrDevice.loResRadastanMode).toBe(false);
    expect(scrDevice.loResRadastanTimexXor).toBe(true);
    expect(scrDevice.loResPaletteOffset).toBe(0);
  });

  it("Reg $6a paletteOffset", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.composedScreenDevice;

    // --- Act
    writeNextReg(m, 0x6a, 0x0a);

    // --- Assert
    expect(readNextReg(m, 0x6a)).toBe(0x0a);
    expect(scrDevice.loResRadastanMode).toBe(false);
    expect(scrDevice.loResRadastanTimexXor).toBe(false);
    expect(scrDevice.loResPaletteOffset).toBe(0x0a);
  });

  it("Reg $71 write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.composedScreenDevice;

    // --- Act
    writeNextReg(m, 0x71, 0x01);

    // --- Assert
    expect(scrDevice.layer2ScrollX).toBe(0x100);
  });

  it("Reg $71 write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.composedScreenDevice;

    // --- Act
    writeNextReg(m, 0x71, 0xb3);

    // --- Assert
    expect(scrDevice.layer2ScrollX).toBe(0x100);
  });

  it("Reg $71 write #3", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const scrDevice = m.composedScreenDevice;

    // --- Act
    writeNextReg(m, 0x71, 0xbe);

    // --- Assert
    expect(scrDevice.layer2ScrollX).toBe(0x00);
  });

  it("Reg $7f write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x7f, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x7f)).toBe(0xa5);
    expect(m.nextRegDevice.userRegister0).toBe(0xa5);
  });

  it("Reg $80 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x80, 0xa7);

    // --- Assert
    expect(readNextReg(m, 0x80)).toBe(0xa7);
  });

  it("Reg $81 write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x81, 0xa3);

    // --- Assert
    expect(readNextReg(m, 0x81)).toBe(0xa3);
  });

  it("Reg $81 write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x81, 0xff);

    // --- Assert
    expect(readNextReg(m, 0x81)).toBe(0xff);
  });

  it("Reg $82 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x82, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x82)).toBe(0xa5);
  });

  it("Reg $82 Bit 0 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x82, 0x01);

    // --- Assert
    expect(readNextReg(m, 0x82)).toBe(0x01);
    expect(nrDevice.port0xffEnabled).toBe(true);
    expect(nrDevice.port0x7ffdEnabled).toBe(false);
    expect(nrDevice.port0xdffdEnabled).toBe(false);
    expect(nrDevice.port0x1ffdEnabled).toBe(false);
    expect(nrDevice.plus3FloatingBusEnabled).toBe(false);
    expect(nrDevice.port0x6bEnabled).toBe(false);
    expect(nrDevice.port0x1fEnabled).toBe(false);
    expect(nrDevice.port0x37Enabled).toBe(false);
  });

  it("Reg $82 Bit 1 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x82, 0x02);

    // --- Assert
    expect(readNextReg(m, 0x82)).toBe(0x02);
    expect(nrDevice.port0xffEnabled).toBe(false);
    expect(nrDevice.port0x7ffdEnabled).toBe(true);
    expect(nrDevice.port0xdffdEnabled).toBe(false);
    expect(nrDevice.port0x1ffdEnabled).toBe(false);
    expect(nrDevice.plus3FloatingBusEnabled).toBe(false);
    expect(nrDevice.port0x6bEnabled).toBe(false);
    expect(nrDevice.port0x1fEnabled).toBe(false);
    expect(nrDevice.port0x37Enabled).toBe(false);
  });

  it("Reg $82 Bit 2 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x82, 0x04);

    // --- Assert
    expect(readNextReg(m, 0x82)).toBe(0x04);
    expect(nrDevice.port0xffEnabled).toBe(false);
    expect(nrDevice.port0x7ffdEnabled).toBe(false);
    expect(nrDevice.port0xdffdEnabled).toBe(true);
    expect(nrDevice.port0x1ffdEnabled).toBe(false);
    expect(nrDevice.plus3FloatingBusEnabled).toBe(false);
    expect(nrDevice.port0x6bEnabled).toBe(false);
    expect(nrDevice.port0x1fEnabled).toBe(false);
    expect(nrDevice.port0x37Enabled).toBe(false);
  });

  it("Reg $82 Bit 3 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x82, 0x08);

    // --- Assert
    expect(readNextReg(m, 0x82)).toBe(0x08);
    expect(nrDevice.port0xffEnabled).toBe(false);
    expect(nrDevice.port0x7ffdEnabled).toBe(false);
    expect(nrDevice.port0xdffdEnabled).toBe(false);
    expect(nrDevice.port0x1ffdEnabled).toBe(true);
    expect(nrDevice.plus3FloatingBusEnabled).toBe(false);
    expect(nrDevice.port0x6bEnabled).toBe(false);
    expect(nrDevice.port0x1fEnabled).toBe(false);
    expect(nrDevice.port0x37Enabled).toBe(false);
  });

  it("Reg $82 Bit 4 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x82, 0x10);

    // --- Assert
    expect(readNextReg(m, 0x82)).toBe(0x10);
    expect(nrDevice.port0xffEnabled).toBe(false);
    expect(nrDevice.port0x7ffdEnabled).toBe(false);
    expect(nrDevice.port0xdffdEnabled).toBe(false);
    expect(nrDevice.port0x1ffdEnabled).toBe(false);
    expect(nrDevice.plus3FloatingBusEnabled).toBe(true);
    expect(nrDevice.port0x6bEnabled).toBe(false);
    expect(nrDevice.port0x1fEnabled).toBe(false);
    expect(nrDevice.port0x37Enabled).toBe(false);
  });

  it("Reg $82 Bit 5 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x82, 0x20);

    // --- Assert
    expect(readNextReg(m, 0x82)).toBe(0x20);
    expect(nrDevice.port0xffEnabled).toBe(false);
    expect(nrDevice.port0x7ffdEnabled).toBe(false);
    expect(nrDevice.port0xdffdEnabled).toBe(false);
    expect(nrDevice.port0x1ffdEnabled).toBe(false);
    expect(nrDevice.plus3FloatingBusEnabled).toBe(false);
    expect(nrDevice.port0x6bEnabled).toBe(true);
    expect(nrDevice.port0x1fEnabled).toBe(false);
    expect(nrDevice.port0x37Enabled).toBe(false);
  });

  it("Reg $82 Bit 6 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x82, 0x40);

    // --- Assert
    expect(readNextReg(m, 0x82)).toBe(0x40);
    expect(nrDevice.port0xffEnabled).toBe(false);
    expect(nrDevice.port0x7ffdEnabled).toBe(false);
    expect(nrDevice.port0xdffdEnabled).toBe(false);
    expect(nrDevice.port0x1ffdEnabled).toBe(false);
    expect(nrDevice.plus3FloatingBusEnabled).toBe(false);
    expect(nrDevice.port0x6bEnabled).toBe(false);
    expect(nrDevice.port0x1fEnabled).toBe(true);
    expect(nrDevice.port0x37Enabled).toBe(false);
  });

  it("Reg $82 Bit 7 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x82, 0x80);

    // --- Assert
    expect(readNextReg(m, 0x82)).toBe(0x80);
    expect(nrDevice.port0xffEnabled).toBe(false);
    expect(nrDevice.port0x7ffdEnabled).toBe(false);
    expect(nrDevice.port0xdffdEnabled).toBe(false);
    expect(nrDevice.port0x1ffdEnabled).toBe(false);
    expect(nrDevice.plus3FloatingBusEnabled).toBe(false);
    expect(nrDevice.port0x6bEnabled).toBe(false);
    expect(nrDevice.port0x1fEnabled).toBe(false);
    expect(nrDevice.port0x37Enabled).toBe(true);
  });

  it("Reg $83 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x83, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x83)).toBe(0xa5);
  });

  it("Reg $83 Bit 0 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x83, 0x01);

    // --- Assert
    expect(readNextReg(m, 0x83)).toBe(0x01);
    expect(nrDevice.portDivMmcEnabled).toBe(true);
    expect(nrDevice.portMultifaceEnabled).toBe(false);
    expect(nrDevice.portI2CEnabled).toBe(false);
    expect(nrDevice.portSpiEnabled).toBe(false);
    expect(nrDevice.portUartEnabled).toBe(false);
    expect(nrDevice.portMouseEnabled).toBe(false);
    expect(nrDevice.portSpritesEnabled).toBe(false);
    expect(nrDevice.portLayer2Enabled).toBe(false);
  });

  it("Reg $83 Bit 1 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x83, 0x02);

    // --- Assert
    expect(readNextReg(m, 0x83)).toBe(0x02);
    expect(nrDevice.portDivMmcEnabled).toBe(false);
    expect(nrDevice.portMultifaceEnabled).toBe(true);
    expect(nrDevice.portI2CEnabled).toBe(false);
    expect(nrDevice.portSpiEnabled).toBe(false);
    expect(nrDevice.portUartEnabled).toBe(false);
    expect(nrDevice.portMouseEnabled).toBe(false);
    expect(nrDevice.portSpritesEnabled).toBe(false);
    expect(nrDevice.portLayer2Enabled).toBe(false);
  });

  it("Reg $83 Bit 2 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x83, 0x04);

    // --- Assert
    expect(readNextReg(m, 0x83)).toBe(0x04);
    expect(nrDevice.portDivMmcEnabled).toBe(false);
    expect(nrDevice.portMultifaceEnabled).toBe(false);
    expect(nrDevice.portI2CEnabled).toBe(true);
    expect(nrDevice.portSpiEnabled).toBe(false);
    expect(nrDevice.portUartEnabled).toBe(false);
    expect(nrDevice.portMouseEnabled).toBe(false);
    expect(nrDevice.portSpritesEnabled).toBe(false);
    expect(nrDevice.portLayer2Enabled).toBe(false);
  });

  it("Reg $83 Bit 3 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x83, 0x08);

    // --- Assert
    expect(readNextReg(m, 0x83)).toBe(0x08);
    expect(nrDevice.portDivMmcEnabled).toBe(false);
    expect(nrDevice.portMultifaceEnabled).toBe(false);
    expect(nrDevice.portI2CEnabled).toBe(false);
    expect(nrDevice.portSpiEnabled).toBe(true);
    expect(nrDevice.portUartEnabled).toBe(false);
    expect(nrDevice.portMouseEnabled).toBe(false);
    expect(nrDevice.portSpritesEnabled).toBe(false);
    expect(nrDevice.portLayer2Enabled).toBe(false);
  });

  it("Reg $83 Bit 4 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x83, 0x10);

    // --- Assert
    expect(readNextReg(m, 0x83)).toBe(0x10);
    expect(nrDevice.portDivMmcEnabled).toBe(false);
    expect(nrDevice.portMultifaceEnabled).toBe(false);
    expect(nrDevice.portI2CEnabled).toBe(false);
    expect(nrDevice.portSpiEnabled).toBe(false);
    expect(nrDevice.portUartEnabled).toBe(true);
    expect(nrDevice.portMouseEnabled).toBe(false);
    expect(nrDevice.portSpritesEnabled).toBe(false);
    expect(nrDevice.portLayer2Enabled).toBe(false);
  });

  it("Reg $83 Bit 5 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x83, 0x20);

    // --- Assert
    expect(readNextReg(m, 0x83)).toBe(0x20);
    expect(nrDevice.portDivMmcEnabled).toBe(false);
    expect(nrDevice.portMultifaceEnabled).toBe(false);
    expect(nrDevice.portI2CEnabled).toBe(false);
    expect(nrDevice.portSpiEnabled).toBe(false);
    expect(nrDevice.portUartEnabled).toBe(false);
    expect(nrDevice.portMouseEnabled).toBe(true);
    expect(nrDevice.portSpritesEnabled).toBe(false);
    expect(nrDevice.portLayer2Enabled).toBe(false);
  });

  it("Reg $83 Bit 6 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x83, 0x40);

    // --- Assert
    expect(readNextReg(m, 0x83)).toBe(0x40);
    expect(nrDevice.portDivMmcEnabled).toBe(false);
    expect(nrDevice.portMultifaceEnabled).toBe(false);
    expect(nrDevice.portI2CEnabled).toBe(false);
    expect(nrDevice.portSpiEnabled).toBe(false);
    expect(nrDevice.portUartEnabled).toBe(false);
    expect(nrDevice.portMouseEnabled).toBe(false);
    expect(nrDevice.portSpritesEnabled).toBe(true);
    expect(nrDevice.portLayer2Enabled).toBe(false);
  });

  it("Reg $83 Bit 7 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x83, 0x80);

    // --- Assert
    expect(readNextReg(m, 0x83)).toBe(0x80);
    expect(nrDevice.portDivMmcEnabled).toBe(false);
    expect(nrDevice.portMultifaceEnabled).toBe(false);
    expect(nrDevice.portI2CEnabled).toBe(false);
    expect(nrDevice.portSpiEnabled).toBe(false);
    expect(nrDevice.portUartEnabled).toBe(false);
    expect(nrDevice.portMouseEnabled).toBe(false);
    expect(nrDevice.portSpritesEnabled).toBe(false);
    expect(nrDevice.portLayer2Enabled).toBe(true);
  });

  it("Reg $84 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x84, 0xa3);

    // --- Assert
    expect(readNextReg(m, 0x84)).toBe(0xa3);
  });

  it("Reg $84 Bit 0 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x84, 0x01);

    // --- Assert
    expect(readNextReg(m, 0x84)).toBe(0x01);
    expect(nrDevice.portAyEnabled).toBe(true);
    expect(nrDevice.portDacMode1Enabled).toBe(false);
    expect(nrDevice.portDacMode2Enabled).toBe(false);
    expect(nrDevice.portDacStereoProfiCovoxEnabled).toBe(false);
    expect(nrDevice.portDacStereoCovoxEnabled).toBe(false);
    expect(nrDevice.portDacMonoPentagonEnabled).toBe(false);
    expect(nrDevice.portDacMonoGsCovoxEnabled).toBe(false);
    expect(nrDevice.portDacMonoSpecdrumEnabled).toBe(false);
  });

  it("Reg $84 Bit 1 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x84, 0x02);

    // --- Assert
    expect(readNextReg(m, 0x84)).toBe(0x02);
    expect(nrDevice.portAyEnabled).toBe(false);
    expect(nrDevice.portDacMode1Enabled).toBe(true);
    expect(nrDevice.portDacMode2Enabled).toBe(false);
    expect(nrDevice.portDacStereoProfiCovoxEnabled).toBe(false);
    expect(nrDevice.portDacStereoCovoxEnabled).toBe(false);
    expect(nrDevice.portDacMonoPentagonEnabled).toBe(false);
    expect(nrDevice.portDacMonoGsCovoxEnabled).toBe(false);
    expect(nrDevice.portDacMonoSpecdrumEnabled).toBe(false);
  });

  it("Reg $84 Bit 2 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x84, 0x04);

    // --- Assert
    expect(readNextReg(m, 0x84)).toBe(0x04);
    expect(nrDevice.portAyEnabled).toBe(false);
    expect(nrDevice.portDacMode1Enabled).toBe(false);
    expect(nrDevice.portDacMode2Enabled).toBe(true);
    expect(nrDevice.portDacStereoProfiCovoxEnabled).toBe(false);
    expect(nrDevice.portDacStereoCovoxEnabled).toBe(false);
    expect(nrDevice.portDacMonoPentagonEnabled).toBe(false);
    expect(nrDevice.portDacMonoGsCovoxEnabled).toBe(false);
    expect(nrDevice.portDacMonoSpecdrumEnabled).toBe(false);
  });

  it("Reg $84 Bit 3 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x84, 0x08);

    // --- Assert
    expect(readNextReg(m, 0x84)).toBe(0x08);
    expect(nrDevice.portAyEnabled).toBe(false);
    expect(nrDevice.portDacMode1Enabled).toBe(false);
    expect(nrDevice.portDacMode2Enabled).toBe(false);
    expect(nrDevice.portDacStereoProfiCovoxEnabled).toBe(true);
    expect(nrDevice.portDacStereoCovoxEnabled).toBe(false);
    expect(nrDevice.portDacMonoPentagonEnabled).toBe(false);
    expect(nrDevice.portDacMonoGsCovoxEnabled).toBe(false);
    expect(nrDevice.portDacMonoSpecdrumEnabled).toBe(false);
  });

  it("Reg $84 Bit 4 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x84, 0x10);

    // --- Assert
    expect(readNextReg(m, 0x84)).toBe(0x10);
    expect(nrDevice.portAyEnabled).toBe(false);
    expect(nrDevice.portDacMode1Enabled).toBe(false);
    expect(nrDevice.portDacMode2Enabled).toBe(false);
    expect(nrDevice.portDacStereoProfiCovoxEnabled).toBe(false);
    expect(nrDevice.portDacStereoCovoxEnabled).toBe(true);
    expect(nrDevice.portDacMonoPentagonEnabled).toBe(false);
    expect(nrDevice.portDacMonoGsCovoxEnabled).toBe(false);
    expect(nrDevice.portDacMonoSpecdrumEnabled).toBe(false);
  });

  it("Reg $84 Bit 5 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x84, 0x20);

    // --- Assert
    expect(readNextReg(m, 0x84)).toBe(0x20);
    expect(nrDevice.portAyEnabled).toBe(false);
    expect(nrDevice.portDacMode1Enabled).toBe(false);
    expect(nrDevice.portDacMode2Enabled).toBe(false);
    expect(nrDevice.portDacStereoProfiCovoxEnabled).toBe(false);
    expect(nrDevice.portDacStereoCovoxEnabled).toBe(false);
    expect(nrDevice.portDacMonoPentagonEnabled).toBe(true);
    expect(nrDevice.portDacMonoGsCovoxEnabled).toBe(false);
    expect(nrDevice.portDacMonoSpecdrumEnabled).toBe(false);
  });

  it("Reg $84 Bit 6 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x84, 0x40);

    // --- Assert
    expect(readNextReg(m, 0x84)).toBe(0x40);
    expect(nrDevice.portAyEnabled).toBe(false);
    expect(nrDevice.portDacMode1Enabled).toBe(false);
    expect(nrDevice.portDacMode2Enabled).toBe(false);
    expect(nrDevice.portDacStereoProfiCovoxEnabled).toBe(false);
    expect(nrDevice.portDacStereoCovoxEnabled).toBe(false);
    expect(nrDevice.portDacMonoPentagonEnabled).toBe(false);
    expect(nrDevice.portDacMonoGsCovoxEnabled).toBe(true);
    expect(nrDevice.portDacMonoSpecdrumEnabled).toBe(false);
  });

  it("Reg $84 Bit 7 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x84, 0x80);

    // --- Assert
    expect(readNextReg(m, 0x84)).toBe(0x80);
    expect(nrDevice.portAyEnabled).toBe(false);
    expect(nrDevice.portDacMode1Enabled).toBe(false);
    expect(nrDevice.portDacMode2Enabled).toBe(false);
    expect(nrDevice.portDacStereoProfiCovoxEnabled).toBe(false);
    expect(nrDevice.portDacStereoCovoxEnabled).toBe(false);
    expect(nrDevice.portDacMonoPentagonEnabled).toBe(false);
    expect(nrDevice.portDacMonoGsCovoxEnabled).toBe(false);
    expect(nrDevice.portDacMonoSpecdrumEnabled).toBe(true);
  });

  it("Reg $85 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x85, 0xff);

    // --- Assert
    expect(readNextReg(m, 0x85)).toBe(0x8f);
  });

  it("Reg $85 Bit 0 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x85, 0x01);

    // --- Assert
    expect(readNextReg(m, 0x85)).toBe(0x01);
    expect(nrDevice.portUlaPlusEnabled).toBe(true);
    expect(nrDevice.portZ80DmaEnabled).toBe(false);
    expect(nrDevice.portPentagon1024MemoryEnabled).toBe(false);
    expect(nrDevice.portZ80CtcEnabled).toBe(false);
    expect(nrDevice.registerSoftResetMode).toBe(false);
  });

  it("Reg $85 Bit 1 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x85, 0x02);

    // --- Assert
    expect(readNextReg(m, 0x85)).toBe(0x02);
    expect(nrDevice.portUlaPlusEnabled).toBe(false);
    expect(nrDevice.portZ80DmaEnabled).toBe(true);
    expect(nrDevice.portPentagon1024MemoryEnabled).toBe(false);
    expect(nrDevice.portZ80CtcEnabled).toBe(false);
    expect(nrDevice.registerSoftResetMode).toBe(false);
  });

  it("Reg $85 Bit 2 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x85, 0x04);

    // --- Assert
    expect(readNextReg(m, 0x85)).toBe(0x04);
    expect(nrDevice.portUlaPlusEnabled).toBe(false);
    expect(nrDevice.portZ80DmaEnabled).toBe(false);
    expect(nrDevice.portPentagon1024MemoryEnabled).toBe(true);
    expect(nrDevice.portZ80CtcEnabled).toBe(false);
    expect(nrDevice.registerSoftResetMode).toBe(false);
  });

  it("Reg $85 Bit 3 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x85, 0x08);

    // --- Assert
    expect(readNextReg(m, 0x85)).toBe(0x08);
    expect(nrDevice.portUlaPlusEnabled).toBe(false);
    expect(nrDevice.portZ80DmaEnabled).toBe(false);
    expect(nrDevice.portPentagon1024MemoryEnabled).toBe(false);
    expect(nrDevice.portZ80CtcEnabled).toBe(true);
    expect(nrDevice.registerSoftResetMode).toBe(false);
  });

  it("Reg $85 Bit 4 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x85, 0x10);

    // --- Assert
    expect(readNextReg(m, 0x85)).toBe(0x00);
    expect(nrDevice.portUlaPlusEnabled).toBe(false);
    expect(nrDevice.portZ80DmaEnabled).toBe(false);
    expect(nrDevice.portPentagon1024MemoryEnabled).toBe(false);
    expect(nrDevice.portZ80CtcEnabled).toBe(false);
    expect(nrDevice.registerSoftResetMode).toBe(false);
  });

  it("Reg $85 Bit 5 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x85, 0x20);

    // --- Assert
    expect(readNextReg(m, 0x85)).toBe(0x00);
    expect(nrDevice.portUlaPlusEnabled).toBe(false);
    expect(nrDevice.portZ80DmaEnabled).toBe(false);
    expect(nrDevice.portPentagon1024MemoryEnabled).toBe(false);
    expect(nrDevice.portZ80CtcEnabled).toBe(false);
    expect(nrDevice.registerSoftResetMode).toBe(false);
  });

  it("Reg $85 Bit 6 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x85, 0x40);

    // --- Assert
    expect(readNextReg(m, 0x85)).toBe(0x00);
    expect(nrDevice.portUlaPlusEnabled).toBe(false);
    expect(nrDevice.portZ80DmaEnabled).toBe(false);
    expect(nrDevice.portPentagon1024MemoryEnabled).toBe(false);
    expect(nrDevice.portZ80CtcEnabled).toBe(false);
    expect(nrDevice.registerSoftResetMode).toBe(false);
  });

  it("Reg $85 Bit 7 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const nrDevice = m.nextRegDevice;

    // --- Act
    writeNextReg(m, 0x85, 0x80);

    // --- Assert
    expect(readNextReg(m, 0x85)).toBe(0x80);
    expect(nrDevice.portUlaPlusEnabled).toBe(false);
    expect(nrDevice.portZ80DmaEnabled).toBe(false);
    expect(nrDevice.portPentagon1024MemoryEnabled).toBe(false);
    expect(nrDevice.portZ80CtcEnabled).toBe(false);
    expect(nrDevice.registerSoftResetMode).toBe(true);
  });

  it("Reg $86 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x86, 0xa3);

    // --- Assert
    expect(readNextReg(m, 0x86)).toBe(0xa3);
  });

  it("Reg $87 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x87, 0xa3);

    // --- Assert
    expect(readNextReg(m, 0x87)).toBe(0xa3);
  });

  it("Reg $88 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x88, 0xa3);

    // --- Assert
    expect(readNextReg(m, 0x88)).toBe(0xa3);
  });

  it("Reg $89 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x89, 0xff);

    // --- Assert
    expect(readNextReg(m, 0x89)).toBe(0x8f);
  });

  it("Reg $8a write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x8a, 0xa3);

    // --- Assert
    expect(readNextReg(m, 0x8a)).toBe(0xa3);
  });

  it("Reg $8f write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x8f, 0xff);

    // --- Assert
    expect(readNextReg(m, 0x8f)).toBe(0x03);
    expect(m.memoryDevice.mappingMode).toBe(0x03);
  });

  it("Reg $90 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x90, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x90)).toBe(0xa5);
  });

  it("Reg $91 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x91, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x91)).toBe(0xa5);
  });

  it("Reg $92 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x92, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x92)).toBe(0xa5);
  });

  it("Reg $93 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x93, 0xff);

    // --- Assert
    expect(readNextReg(m, 0x93)).toBe(0x0f);
  });

  it("Reg $98 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x98, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x98)).toBe(0xa5);
  });

  it("Reg $99 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x99, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x99)).toBe(0xa5);
  });

  it("Reg $9a write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x9a, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0x9a)).toBe(0xa5);
  });

  it("Reg $9b write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0x9b, 0xff);

    // --- Assert
    expect(readNextReg(m, 0x9b)).toBe(0x0f);
  });

  it("Reg $a0 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xa0, 0xa5);

    // --- Assert
    expect(readNextReg(m, 0xa0)).toBe(0xa5);
  });

  it("Reg $a2 write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xa2, 0xff);

    // --- Assert
    expect(readNextReg(m, 0xa2)).toBe(0xdf);
  });

  it("Reg $a2 write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xa2, 0x00);

    // --- Assert
    expect(readNextReg(m, 0xa2)).toBe(0x02);
  });

  it("Reg $a8 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xa8, 0xff);

    // --- Assert
    expect(readNextReg(m, 0xa8)).toBe(0x01);
  });

  it("Reg $a9 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xa9, 0xff);

    // --- Assert
    expect(readNextReg(m, 0xa9)).toBe(0x05);
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
    expect(div.rstTraps[7].onlyWithRom3).toBe(false);
    expect(div.rstTraps[6].onlyWithRom3).toBe(true);
    expect(div.rstTraps[5].onlyWithRom3).toBe(false);
    expect(div.rstTraps[4].onlyWithRom3).toBe(true);
    expect(div.rstTraps[3].onlyWithRom3).toBe(false);
    expect(div.rstTraps[2].onlyWithRom3).toBe(true);
    expect(div.rstTraps[1].onlyWithRom3).toBe(false);
    expect(div.rstTraps[0].onlyWithRom3).toBe(true);
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
    expect(div.automapOff1ff8).toBe(true);
    expect(div.automapOn056a).toBe(false);
    expect(div.automapOn04d7).toBe(true);
    expect(div.automapOn0562).toBe(true);
    expect(div.automapOn04c6).toBe(false);
    expect(div.automapOn0066).toBe(true);
    expect(div.automapOn0066Delayed).toBe(false);
  });

  it("Reg $d8 write #1", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xd8, 0x00);

    // --- Assert
    expect(readNextReg(m, 0xd8)).toBe(0x00);
    expect(m.nextRegDevice.fdcIoTrap).toBe(false);
  });

  it("Reg $d8 write #2", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xd8, 0xff);

    // --- Assert
    expect(readNextReg(m, 0xd8)).toBe(0x01);
    expect(m.nextRegDevice.fdcIoTrap).toBe(true);
  });

  it("Reg $d9 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xd9, 0xff);

    // --- Assert
    expect(readNextReg(m, 0xd9)).toBe(0xff);
  });

  it("Reg $f0 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xf0, 0x5a);

    // --- Assert
    expect(readNextReg(m, 0xf0)).toBe(0x5a);
  });

  it("Reg $f8 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xf8, 0x5a);

    // --- Assert
    expect(readNextReg(m, 0xf8)).toBe(0x5a);
  });

  it("Reg $f9 write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xf9, 0x5a);

    // --- Assert
    expect(readNextReg(m, 0xf9)).toBe(0x5a);
  });

  it("Reg $fa write", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    writeNextReg(m, 0xfa, 0x5a);

    // --- Assert
    expect(readNextReg(m, 0xfa)).toBe(0x5a);
  });

  it("getDeviceState works", async () => {
    // --- Arrange
    const m = await createTestNextMachine();

    // --- Act
    m.nextRegDevice.getNextRegDeviceState();
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
