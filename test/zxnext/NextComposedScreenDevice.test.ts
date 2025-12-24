import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";

describe("Next - ComposedScreenDevice", function () {
  it("constructor set the pixel buffer", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.composedScreenDevice;

    // --- Act
    const buffer = d.getPixelBuffer();
    // --- Assert
    expect(buffer).toBeDefined();
    expect(buffer.length).toBe(d.screenWidth * d.screenLines);
  });

  describe("Timex port)", () => {
    it("Timex port color update #1", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const nrDevice = m.nextRegDevice;
      const pm = m.portManager;
      const d = m.composedScreenDevice;
      nrDevice.directSetRegValue(0x82, 0xff); // Enable Timex mode

      // --- Act
      pm.writePort(0xff, 0x8);

      // --- Assert
      expect(d.ulaHiResColor).toBe(0x01);
    });

    it("Timex port color update #2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const nrDevice = m.nextRegDevice;
      const pm = m.portManager;
      const d = m.composedScreenDevice;
      nrDevice.directSetRegValue(0x82, 0xff); // Enable Timex mode

      // --- Act
      pm.writePort(0xff, 0x20);

      // --- Assert
      expect(d.ulaHiResColor).toBe(0x04);
    });

    it("Timex port color update #3", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const nrDevice = m.nextRegDevice;
      const pm = m.portManager;
      const d = m.composedScreenDevice;
      nrDevice.directSetRegValue(0x82, 0xff); // Enable Timex mode

      // --- Act
      pm.writePort(0xff, 0x38);
      // --- Assert
      expect(d.ulaHiResColor).toBe(0x07);
    });

    it("Timex port mode update #1", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const nrDevice = m.nextRegDevice;
      const pm = m.portManager;
      const d = m.composedScreenDevice;
      nrDevice.directSetRegValue(0x82, 0xff); // Enable Timex mode

      // --- Act
      pm.writePort(0xff, 0x00); // Set mode 0

      // --- Assert
      expect(d.standardScreenAt0x4000).toBe(true);
      expect(d.ulaHiColorMode).toBe(false);
      expect(d.ulaHiResMode).toBe(false);
    });

    it("Timex port mode update #2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const nrDevice = m.nextRegDevice;
      const pm = m.portManager;
      const d = m.composedScreenDevice;
      nrDevice.directSetRegValue(0x82, 0xff); // Enable Timex mode

      // --- Act
      pm.writePort(0xff, 0x01); // Set mode 2

      // --- Assert
      expect(d.standardScreenAt0x4000).toBe(false);
      expect(d.ulaHiColorMode).toBe(false);
      expect(d.ulaHiResMode).toBe(false);
    });

    it("Timex port mode update #3", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const nrDevice = m.nextRegDevice;
      const pm = m.portManager;
      const d = m.composedScreenDevice;
      nrDevice.directSetRegValue(0x82, 0xff); // Enable Timex mode

      // --- Act
      pm.writePort(0xff, 0x02); // Set mode 2

      // --- Assert
      expect(d.ulaHiColorMode).toBe(true);
      expect(d.ulaHiResMode).toBe(false);
    });

    it("Timex port mode update #4", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const nrDevice = m.nextRegDevice;
      const pm = m.portManager;
      const d = m.composedScreenDevice;
      nrDevice.directSetRegValue(0x82, 0xff); // Enable Timex mode

      // --- Act
      pm.writePort(0xff, 0x03); // Set mode 3

      // --- Assert
      expect(d.ulaHiColorMode).toBe(true);
      expect(d.ulaHiResMode).toBe(false);
    });

    it("Timex port mode update #5", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const nrDevice = m.nextRegDevice;
      const pm = m.portManager;
      const d = m.composedScreenDevice;
      nrDevice.directSetRegValue(0x82, 0xff); // Enable Timex mode

      // --- Act
      pm.writePort(0xff, 0x04); // Set mode 4

      // --- Assert
      expect(d.ulaHiColorMode).toBe(false);
      expect(d.ulaHiResMode).toBe(true);
    });

    it("Timex port mode update #6", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const nrDevice = m.nextRegDevice;
      const pm = m.portManager;
      const d = m.composedScreenDevice;
      nrDevice.directSetRegValue(0x82, 0xff); // Enable Timex mode

      // --- Act
      pm.writePort(0xff, 0x05); // Set mode 5

      // --- Assert
      expect(d.ulaHiColorMode).toBe(false);
      expect(d.ulaHiResMode).toBe(true);
    });

    it("Timex port mode update #7", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const nrDevice = m.nextRegDevice;
      const pm = m.portManager;
      const d = m.composedScreenDevice;
      nrDevice.directSetRegValue(0x82, 0xff); // Enable Timex mode

      // --- Act
      pm.writePort(0xff, 0x06); // Set mode 6

      // --- Assert
      expect(d.ulaHiColorMode).toBe(false);
      expect(d.ulaHiResMode).toBe(true);
    });

    it("Timex port mode update #8", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const nrDevice = m.nextRegDevice;
      const pm = m.portManager;
      const d = m.composedScreenDevice;
      nrDevice.directSetRegValue(0x82, 0xff); // Enable Timex mode

      // --- Act
      pm.writePort(0xff, 0x07); // Set mode 7

      // --- Assert
      expect(d.ulaHiColorMode).toBe(false);
      expect(d.ulaHiResMode).toBe(true);
    });
  });

  describe("Reg $05 - Peripheral 1 settings", () => {
    it("60 Hz mode #1", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x05, 0x00);

      // --- Assert
      expect(scrDevice.is60HzMode).toBe(false);
    });

    it("60 Hz mode #2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x05, 0x04);

      // --- Assert
      expect(scrDevice.is60HzMode).toBe(true);
    });

    it("scandoubler #1", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x05, 0x00);

      // --- Assert
      expect(scrDevice.scandoublerEnabled).toBe(false);
    });

    it("scandoubler #2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x05, 0x01);

      // --- Assert
      expect(scrDevice.scandoublerEnabled).toBe(true);
    });
  });

  describe("Reg $09 - Peripheral 4 Setting", () => {
    it("scanlineWeight", async () => {
      // --- Arrange
      const m = await createTestNextMachine();

      // --- Act
      writeNextReg(m, 0x09, 0x02);

      // --- Assert
      expect(readNextReg(m, 0x09)).toBe(0x02);
      expect(m.composedScreenDevice.scanlineWeight).toBe(2);
    });
  });

  describe("Reg $14 - Global Transparency Colour", () => {
    it("write", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x14, 0xc5);

      // --- Assert
      expect(scrDevice.globalTransparencyColor).toBe(0xc5);
    });
  });

  describe("Reg $03 - Machine Type", () => {
    it("Reg $03 keep userLockDisplayTime #1", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      scrDevice.userLockOnDisplayTiming = true;

      // --- Act
      writeNextReg(m, 0x03, 0x00);

      // --- Assert
      expect(scrDevice.userLockOnDisplayTiming).toBe(true);
    });

    it("Reg $03 keep userLockDisplayTime #2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      scrDevice.userLockOnDisplayTiming = false;

      // --- Act
      writeNextReg(m, 0x03, 0x00);

      // --- Assert
      expect(scrDevice.userLockOnDisplayTiming).toBe(false);
    });

    it("Reg $03 toggles userLockDisplayTime #1", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      scrDevice.userLockOnDisplayTiming = true;

      // --- Act
      writeNextReg(m, 0x03, 0x08);

      // --- Assert
      expect(scrDevice.userLockOnDisplayTiming).toBe(false);
    });

    it("Reg $03 toggles userLockDisplayTime #2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      scrDevice.userLockOnDisplayTiming = false;

      // --- Act
      writeNextReg(m, 0x03, 0x08);

      // --- Assert
      expect(scrDevice.userLockOnDisplayTiming).toBe(true);
    });

    it("Reg $03 keeps machine type when not in config mode", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      m.nextRegDevice.configMode = false;

      // --- Act
      for (let i = 0; i < 8; i++) {
        writeNextReg(m, 0x03, i);
      }

      // --- Assert
      expect(scrDevice.machineType).toBe(0x03);
    });

    it("Reg $03 set machine type in config mode #1", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      m.nextRegDevice.configMode = true;

      // --- Act
      writeNextReg(m, 0x03, 0x01);

      // --- Assert
      expect(scrDevice.machineType).toBe(0x01);
    });

    it("Reg $03 set machine type in config mode #2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      m.nextRegDevice.configMode = true;

      // --- Act
      writeNextReg(m, 0x03, 0x02);

      // --- Assert
      expect(scrDevice.machineType).toBe(0x02);
    });

    it("Reg $03 set machine type in config mode #3", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      m.nextRegDevice.configMode = true;

      // --- Act
      writeNextReg(m, 0x03, 0x03);

      // --- Assert
      expect(scrDevice.machineType).toBe(0x03);
    });

    it("Reg $03 set machine typr in config mode #4", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      m.nextRegDevice.configMode = true;

      // --- Act
      writeNextReg(m, 0x03, 0x04);

      // --- Assert
      expect(scrDevice.machineType).toBe(0x04);
    });

    it("Reg $03 ignores invalid machine type in config mode #1", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      m.nextRegDevice.configMode = true;

      // --- Act
      writeNextReg(m, 0x03, 0x05);

      // --- Assert
      expect(scrDevice.machineType).toBe(0x03);
    });

    it("Reg $03 ignores invalid machine type in config mode #2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      m.nextRegDevice.configMode = true;

      // --- Act
      writeNextReg(m, 0x03, 0x06);

      // --- Assert
      expect(scrDevice.machineType).toBe(0x03);
    });

    it("Reg $03 keeps displayTiming with no changes allowed", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      scrDevice.displayTiming = 0x00;
      m.nextRegDevice.configMode = false;

      // --- Act
      for (let i = 0; i < 8; i++) {
        writeNextReg(m, 0x03, i << 4);
        expect(scrDevice.displayTiming).toBe(0x00);
      }
    });

    it("Reg $03 keeps displayTiming with userLockDisplayTiming", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      scrDevice.displayTiming = 0x00;
      scrDevice.userLockOnDisplayTiming = true;
      m.nextRegDevice.configMode = false;

      // --- Act
      for (let i = 0; i < 8; i++) {
        writeNextReg(m, 0x03, 0x80 | (i << 4));
        expect(scrDevice.displayTiming).toBe(0x00);
      }
    });

    it("Reg $03 keeps displayTiming with no userLockDisplayTiming and Bit 3 set to 1", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      scrDevice.displayTiming = 0x00;
      scrDevice.userLockOnDisplayTiming = false;
      m.nextRegDevice.configMode = false;

      // --- Act
      for (let i = 0; i < 8; i++) {
        writeNextReg(m, 0x03, 0x80 | (i << 4) | 0x08);
        expect(scrDevice.displayTiming).toBe(0x00);
      }
    });
  });

  describe("Reg $15 - Sprite and Layers System", () => {
    it("Reg $15 enableLoresMode (false)", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const screenDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x15, 0x00);

      // --- Assert
      expect(screenDevice.loResEnabled).toBe(false);
    });

    it("Reg $15 enableLoresMode (true)", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const screenDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x15, 0x80);

      // --- Assert
      expect(screenDevice.loResEnabled).toBe(true);
    });
  });

  describe("Reg $16 - Layer 2 X Scroll LSB", () => {
    it("Reg $16 write", async () => {
      // --- Arrange
      const m = await createTestNextMachine();

      // --- Act
      writeNextReg(m, 0x16, 0x2c);

      // --- Assert
      expect(m.composedScreenDevice.layer2ScrollX).toBe(0x2c);
    });
  });

  describe("Reg $17 - Layer 2 Y Scroll", () => {
    it("Reg $17 write", async () => {
      // --- Arrange
      const m = await createTestNextMachine();

      // --- Act
      writeNextReg(m, 0x17, 0x2c);

      // --- Assert
      expect(m.composedScreenDevice.layer2ScrollY).toBe(0x2c);
    });
  });

  describe("Reg $18 - Clip Window Layer 2", () => {
    it("Reg $18 first write", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      writeNextReg(m, 0x1c, 0x01);

      // --- Act
      writeNextReg(m, 0x18, 0x23);

      // --- Assert
      expect(scrDevice.layer2ClipIndex).toBe(0x01);
      expect(scrDevice.layer2ClipWindowX1).toBe(0x23);
      expect(scrDevice.layer2ClipWindowX2).toBe(0x9f);
      expect(scrDevice.layer2ClipWindowY1).toBe(0x00);
      expect(scrDevice.layer2ClipWindowY2).toBe(0xff);
    });

    it("Reg $18 second write", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      writeNextReg(m, 0x1c, 0x01);

      // --- Act
      writeNextReg(m, 0x18, 0x23);
      writeNextReg(m, 0x18, 0x34);

      // --- Assert
      expect(scrDevice.layer2ClipIndex).toBe(0x02);
      expect(scrDevice.layer2ClipWindowX1).toBe(0x23);
      expect(scrDevice.layer2ClipWindowX2).toBe(0x34);
      expect(scrDevice.layer2ClipWindowY1).toBe(0x00);
      expect(scrDevice.layer2ClipWindowY2).toBe(0xff);
    });

    it("Reg $18 third write", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      writeNextReg(m, 0x1c, 0x01);

      // --- Act
      writeNextReg(m, 0x18, 0x23);
      writeNextReg(m, 0x18, 0x34);
      writeNextReg(m, 0x18, 0x45);

      // --- Assert
      expect(scrDevice.layer2ClipIndex).toBe(0x03);
      expect(scrDevice.layer2ClipWindowX1).toBe(0x23);
      expect(scrDevice.layer2ClipWindowX2).toBe(0x34);
      expect(scrDevice.layer2ClipWindowY1).toBe(0x45);
      expect(scrDevice.layer2ClipWindowY2).toBe(0xff);
    });

    it("Reg $18 fourth write", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice
      writeNextReg(m, 0x1c, 0x01);

      // --- Act
      writeNextReg(m, 0x18, 0x23);
      writeNextReg(m, 0x18, 0x34);
      writeNextReg(m, 0x18, 0x45);
      writeNextReg(m, 0x18, 0x56);

      // --- Assert
      expect(scrDevice.layer2ClipIndex).toBe(0x00);
      expect(scrDevice.layer2ClipWindowX1).toBe(0x23);
      expect(scrDevice.layer2ClipWindowX2).toBe(0x34);
      expect(scrDevice.layer2ClipWindowY1).toBe(0x45);
      expect(scrDevice.layer2ClipWindowY2).toBe(0x56);
    });
  });

  describe("Reg $1A - Clip Window ULA", () => {
    it("first write", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      writeNextReg(m, 0x1c, 0x04);

      // --- Act
      writeNextReg(m, 0x1a, 0x23);

      // --- Assert
      expect(scrDevice.ulaClipIndex).toBe(0x01);
      expect(scrDevice.ulaClipWindowX1).toBe(0x23);
      expect(scrDevice.ulaClipWindowX2).toBe(0xff);
      expect(scrDevice.ulaClipWindowY1).toBe(0x00);
      expect(scrDevice.ulaClipWindowY2).toBe(0xbf);
    });

    it("second write", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      writeNextReg(m, 0x1c, 0x04);

      // --- Act
      writeNextReg(m, 0x1a, 0x23);
      writeNextReg(m, 0x1a, 0x34);

      // --- Assert
      expect(scrDevice.ulaClipIndex).toBe(0x02);
      expect(scrDevice.ulaClipWindowX1).toBe(0x23);
      expect(scrDevice.ulaClipWindowX2).toBe(0x34);
      expect(scrDevice.ulaClipWindowY1).toBe(0x00);
      expect(scrDevice.ulaClipWindowY2).toBe(0xbf);
    });

    it("third write", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      writeNextReg(m, 0x1c, 0x04);

      // --- Act
      writeNextReg(m, 0x1a, 0x23);
      writeNextReg(m, 0x1a, 0x34);
      writeNextReg(m, 0x1a, 0x45);

      // --- Assert
      expect(scrDevice.ulaClipIndex).toBe(0x03);
      expect(scrDevice.ulaClipWindowX1).toBe(0x23);
      expect(scrDevice.ulaClipWindowX2).toBe(0x34);
      expect(scrDevice.ulaClipWindowY1).toBe(0x45);
      expect(scrDevice.ulaClipWindowY2).toBe(0xbf);
    });

    it("fourth write", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      writeNextReg(m, 0x1c, 0x04);

      // --- Act
      writeNextReg(m, 0x1a, 0x23);
      writeNextReg(m, 0x1a, 0x34);
      writeNextReg(m, 0x1a, 0x45);
      writeNextReg(m, 0x1a, 0x56);

      // --- Assert
      expect(scrDevice.ulaClipIndex).toBe(0x00);
      expect(scrDevice.ulaClipWindowX1).toBe(0x23);
      expect(scrDevice.ulaClipWindowX2).toBe(0x34);
      expect(scrDevice.ulaClipWindowY1).toBe(0x45);
      expect(scrDevice.ulaClipWindowY2).toBe(0x56);
    });
  });

  describe("Reg $26 - ULA X Scroll", () => {
    it("write", async () => {
      // --- Arrange
      const m = await createTestNextMachine();

      // --- Act
      writeNextReg(m, 0x26, 0x5a);

      // --- Assert
      expect(readNextReg(m, 0x26)).toBe(0x5a);
      expect(m.composedScreenDevice.ulaScrollX).toBe(0x5a);
    });
  });

  describe("Reg $27 - ULA Y Scroll", () => {
    it("write", async () => {
      // --- Arrange
      const m = await createTestNextMachine();

      // --- Act
      writeNextReg(m, 0x27, 0x3c);

      // --- Assert
      expect(readNextReg(m, 0x27)).toBe(0x3c);
      expect(m.composedScreenDevice.ulaScrollY).toBe(0x3c);
    });
  });

  describe("Reg $68 - ULA Control", () => {
    it("disableUlaOutput", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x68, 0x80);

      // --- Assert
      expect(readNextReg(m, 0x68)).toBe(0x80);
      expect(scrDevice.disableUlaOutput).toBe(true);
      expect(scrDevice.blendingInSLUModes6And7).toBe(0x00);
      expect(scrDevice.ulaPlusEnabled).toBe(false);
      expect(scrDevice.ulaHalfPixelScroll).toBe(false);
      expect(scrDevice.enableStencilMode).toBe(false);
    });

    it("blendingInSLUModes6And7", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const srcDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x68, 0x40);

      // --- Assert
      expect(readNextReg(m, 0x68)).toBe(0x40);
      expect(srcDevice.disableUlaOutput).toBe(false);
      expect(srcDevice.blendingInSLUModes6And7).toBe(0x02);
      expect(srcDevice.ulaPlusEnabled).toBe(false);
      expect(srcDevice.ulaHalfPixelScroll).toBe(false);
      expect(srcDevice.enableStencilMode).toBe(false);
    });

    it("enableUlaPlus", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const srcDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x68, 0x08);

      // --- Assert
      expect(readNextReg(m, 0x68)).toBe(0x08);
      expect(srcDevice.disableUlaOutput).toBe(false);
      expect(srcDevice.blendingInSLUModes6And7).toBe(0x00);
      expect(srcDevice.ulaPlusEnabled).toBe(true);
      expect(srcDevice.ulaHalfPixelScroll).toBe(false);
      expect(srcDevice.enableStencilMode).toBe(false);
    });

    it("halfPixelScroll", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const srcDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x68, 0x04);

      // --- Assert
      expect(readNextReg(m, 0x68)).toBe(0x04);
      expect(srcDevice.disableUlaOutput).toBe(false);
      expect(srcDevice.blendingInSLUModes6And7).toBe(0x00);
      expect(srcDevice.ulaPlusEnabled).toBe(false);
      expect(srcDevice.ulaHalfPixelScroll).toBe(true);
      expect(srcDevice.enableStencilMode).toBe(false);
    });

    it("enableStencilMode", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const srcDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x68, 0x01);

      // --- Assert
      expect(readNextReg(m, 0x68)).toBe(0x01);
      expect(srcDevice.disableUlaOutput).toBe(false);
      expect(srcDevice.blendingInSLUModes6And7).toBe(0x00);
      expect(srcDevice.ulaPlusEnabled).toBe(false);
      expect(srcDevice.ulaHalfPixelScroll).toBe(false);
      expect(srcDevice.enableStencilMode).toBe(true);
    });
  });

  describe("Reg $6B - Tilemap Control", () => {
    it("enableTilemap", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x6b, 0x80);

      // --- Assert
      expect(readNextReg(m, 0x6b)).toBe(0x80);
      expect(scrDevice.tilemapEnabled).toBe(true);
      expect(scrDevice.tilemap80x32Resolution).toBe(false);
      expect(scrDevice.tilemapEliminateAttributes).toBe(false);
      expect(m.paletteDevice.secondTilemapPalette).toBe(false);
      expect(scrDevice.tilemapTextMode).toBe(false);
      expect(scrDevice.tilemap512TileMode).toBe(false);
      expect(scrDevice.tilemapForceOnTopOfUla).toBe(false);
    });

    it("mode80x32", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x6b, 0x40);

      // --- Assert
      expect(readNextReg(m, 0x6b)).toBe(0x40);
      expect(scrDevice.tilemapEnabled).toBe(false);
      expect(scrDevice.tilemap80x32Resolution).toBe(true);
      expect(scrDevice.tilemapEliminateAttributes).toBe(false);
      expect(m.paletteDevice.secondTilemapPalette).toBe(false);
      expect(scrDevice.tilemapTextMode).toBe(false);
      expect(scrDevice.tilemap512TileMode).toBe(false);
      expect(scrDevice.tilemapForceOnTopOfUla).toBe(false);
    });

    it("eliminateAttribute", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x6b, 0x20);

      // --- Assert
      expect(readNextReg(m, 0x6b)).toBe(0x20);
      expect(scrDevice.tilemapEnabled).toBe(false);
      expect(scrDevice.tilemap80x32Resolution).toBe(false);
      expect(scrDevice.tilemapEliminateAttributes).toBe(true);
      expect(m.paletteDevice.secondTilemapPalette).toBe(false);
      expect(scrDevice.tilemapTextMode).toBe(false);
      expect(scrDevice.tilemap512TileMode).toBe(false);
      expect(scrDevice.tilemapForceOnTopOfUla).toBe(false);
    });

    it("selectTextMode", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x6b, 0x08);

      // --- Assert
      expect(readNextReg(m, 0x6b)).toBe(0x08);
      expect(scrDevice.tilemapEnabled).toBe(false);
      expect(scrDevice.tilemap80x32Resolution).toBe(false);
      expect(scrDevice.tilemapEliminateAttributes).toBe(false);
      expect(m.paletteDevice.secondTilemapPalette).toBe(false);
      expect(scrDevice.tilemapTextMode).toBe(true);
      expect(scrDevice.tilemap512TileMode).toBe(false);
      expect(scrDevice.tilemapForceOnTopOfUla).toBe(false);
    });

    it("activate512TileMode", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x6b, 0x02);

      // --- Assert
      expect(readNextReg(m, 0x6b)).toBe(0x02);
      expect(scrDevice.tilemapEnabled).toBe(false);
      expect(scrDevice.tilemap80x32Resolution).toBe(false);
      expect(scrDevice.tilemapEliminateAttributes).toBe(false);
      expect(m.paletteDevice.secondTilemapPalette).toBe(false);
      expect(scrDevice.tilemapTextMode).toBe(false);
      expect(scrDevice.tilemap512TileMode).toBe(true);
      expect(scrDevice.tilemapForceOnTopOfUla).toBe(false);
    });

    it("forceTilemapOnTop", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x6b, 0x01);

      // --- Assert
      expect(readNextReg(m, 0x6b)).toBe(0x01);
      expect(scrDevice.tilemapEnabled).toBe(false);
      expect(scrDevice.tilemap80x32Resolution).toBe(false);
      expect(scrDevice.tilemapEliminateAttributes).toBe(false);
      expect(m.paletteDevice.secondTilemapPalette).toBe(false);
      expect(scrDevice.tilemapTextMode).toBe(false);
      expect(scrDevice.tilemap512TileMode).toBe(false);
      expect(scrDevice.tilemapForceOnTopOfUla).toBe(true);
    });
  });

  describe("Reg $70 - Layer 2 Control", () => {
    it("resolution #1", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x70, 0x20);

      // --- Assert
      expect(scrDevice.layer2Resolution).toBe(2);
    });

    it("resolution #2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x70, 0xa0);

      // --- Assert
      expect(scrDevice.layer2Resolution).toBe(2);
    });

    it("paletteOffset #1", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x70, 0x2a);

      // --- Assert
      expect(scrDevice.layer2PaletteOffset).toBe(0x0a);
    });

    it("paletteOffset #2", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const srcDevice = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x70, 0xca);

      // --- Assert
      expect(srcDevice.layer2PaletteOffset).toBe(0x0a);
    });
  });

  describe("pulseIntActive", () => {
    it("pulseIntActive 50Hz", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      writeNextReg(m, 0x05, 0x00);
      const config = scrDevice.config;
      const intStart = config.intStartTact;
      const intEnd = config.intEndTact;

      // --- Act/Assert
      expect(scrDevice.is60HzMode).toBe(false);
      scrDevice.renderTact(0);
      expect(scrDevice.pulseIntActive).toBe(false);
      scrDevice.renderTact(intStart);
      expect(scrDevice.pulseIntActive).toBe(true);
      scrDevice.renderTact(intEnd - 1);
      expect(scrDevice.pulseIntActive).toBe(true);
      scrDevice.renderTact(intEnd);
      expect(scrDevice.pulseIntActive).toBe(false);
      scrDevice.renderTact(intEnd + 100);
      expect(scrDevice.pulseIntActive).toBe(false);
    });

    it("pulseIntActive 60Hz", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      writeNextReg(m, 0x05, 0x04);
      const config = scrDevice.config;
      const intStart = config.intStartTact;
      const intEnd = config.intEndTact;

      // --- Act/Assert
      expect(scrDevice.is60HzMode).toBe(true);
      scrDevice.renderTact(0);
      expect(scrDevice.pulseIntActive).toBe(false);
      scrDevice.renderTact(intStart);
      expect(scrDevice.pulseIntActive).toBe(true);
      scrDevice.renderTact(intEnd - 1);
      expect(scrDevice.pulseIntActive).toBe(true);
      scrDevice.renderTact(intEnd);
      expect(scrDevice.pulseIntActive).toBe(false);
      scrDevice.renderTact(intEnd + 100);
      expect(scrDevice.pulseIntActive).toBe(false);
    });
  });

  describe("blanking", () => {
    it("blanking with 50Hz", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      writeNextReg(m, 0x05, 0x00);
      const config = scrDevice.config;

      // --- Act
      let rendered = 0;
      for (let t = 0; t < config.totalHC * config.totalVC; t++) {
        rendered += scrDevice.renderTact(t) ? 1 : 0;
      }

      // --- Assert
      const visibleWidth = config.totalHC - config.firstVisibleHC;
      const visibleHeight = config.lastBitmapVC - config.firstBitmapVC + 1;
      const expectedRendered = visibleWidth * visibleHeight;
      expect(scrDevice.is60HzMode).toBe(false);
      expect(rendered).toBe(expectedRendered);
    });

    it("blanking with 60Hz", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      writeNextReg(m, 0x05, 0x04);
      const config = scrDevice.config;

      // --- Act
      let rendered = 0;
      for (let t = 0; t < config.totalHC * config.totalVC; t++) {
        rendered += scrDevice.renderTact(t) ? 1 : 0;
      }

      // --- Assert
      const visibleWidth = config.totalHC - config.firstVisibleHC;
      const visibleHeight = config.lastBitmapVC - config.firstBitmapVC + 1;
      const expectedRendered = visibleWidth * visibleHeight;
      expect(scrDevice.is60HzMode).toBe(true);
      expect(rendered).toBe(expectedRendered);
    });
  });

  describe("ULA+ Ports", () => {
    it("Port 0xBF3B is write-only (returns 0xFF on read)", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pm = m.portManager;

      // --- Act
      pm.writePort(0xbf3b, 0x05); // Set mode 00, index 5
      const value = pm.readPort(0xbf3b);

      // --- Assert
      expect(value).toBe(0xff);
    });

    it("Port 0xBF3B sets mode and index", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pm = m.portManager;
      const d = m.composedScreenDevice;

      // --- Act
      pm.writePort(0xbf3b, 0x05); // Mode 00, index 5

      // --- Assert
      expect(d.ulaPlusMode).toBe(0x00);
      expect(d.ulaPlusPaletteIndex).toBe(0x05);
    });

    it("Port 0xBF3B only updates index when mode is 00", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pm = m.portManager;
      const d = m.composedScreenDevice;

      // --- Act
      pm.writePort(0xbf3b, 0x08); // Mode 00, index 8
      pm.writePort(0xbf3b, 0x4f); // Mode 01, value 0x0f (index should stay 8)

      // --- Assert
      expect(d.ulaPlusMode).toBe(0x01);
      expect(d.ulaPlusPaletteIndex).toBe(0x08); // Unchanged
    });

    it("Port 0xFF3B mode 00: writes and reads palette data", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pm = m.portManager;
      const pal = m.paletteDevice;
      
      // Set up mode 00, index 5
      pm.writePort(0xbf3b, 0x05);

      // --- Act
      pm.writePort(0xff3b, 0xe3); // Write RRRGGGBB = 11100011
      const readValue = pm.readPort(0xff3b);

      // --- Assert
      // Color 0xE3 (RRRGGGBB) -> RGB333 = 111_000_11_0 = 0x1c6
      const expectedRgb333 = (0x07 << 6) | (0x00 << 3) | (0x03 << 1) | 0x01;
      expect(pal.ulaFirst[5]).toBe(expectedRgb333);
      expect(readValue).toBe(0xe3); // Should read back same value
    });

    it("Port 0xFF3B mode 00: color format conversion (8-bit to 9-bit)", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pm = m.portManager;
      const pal = m.paletteDevice;
      
      pm.writePort(0xbf3b, 0x10); // Mode 00, index 16

      // --- Act
      pm.writePort(0xff3b, 0xa5); // RRRGGGBB = 10100101 (R=5, G=1, B=1)

      // --- Assert
      // Expected: R=5 (101), G=1 (001), B=1 (01)
      // RGB333 = 101_001_01_1 = 0x0a3
      const expectedRgb333 = (0x05 << 6) | (0x01 << 3) | (0x01 << 1) | 0x01;
      expect(pal.ulaFirst[16]).toBe(expectedRgb333);
    });

    it("Port 0xFF3B mode 00: color format conversion (9-bit to 8-bit)", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pm = m.portManager;
      const pal = m.paletteDevice;
      
      pm.writePort(0xbf3b, 0x12); // Mode 00, index 18
      // Manually set palette to known 9-bit value
      pal.ulaFirst[18] = 0x1a5; // RGB333 = 110_100_101

      // --- Act
      const readValue = pm.readPort(0xff3b);

      // --- Assert
      // Expected: R=6 (110), G=4 (100), B=2 (upper 2 bits of 101)
      // RRRGGGBB = 11010010 = 0xd2
      expect(readValue).toBe(0xd2);
    });

    it("Port 0xFF3B mode 00: writes to second ULA palette when selected", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pm = m.portManager;
      const pal = m.paletteDevice;
      writeNextReg(m, 0x43, 0x02); // Enable second ULA palette
      
      pm.writePort(0xbf3b, 0x07); // Mode 00, index 7

      // --- Act
      pm.writePort(0xff3b, 0x9c); // RRRGGGBB = 10011100

      // --- Assert
      const expectedRgb333 = (0x04 << 6) | (0x07 << 3) | (0x00 << 1) | 0x00;
      expect(pal.ulaSecond[7]).toBe(expectedRgb333);
    });

    it("Port 0xFF3B mode 01: writes enable flag", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pm = m.portManager;
      const d = m.composedScreenDevice;
      
      pm.writePort(0xbf3b, 0x40); // Mode 01 (control)

      // --- Act
      pm.writePort(0xff3b, 0x01); // Enable ULA+

      // --- Assert
      expect(d.ulaPlusEnabled).toBe(true);
    });

    it("Port 0xFF3B mode 01: reads enable flag", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pm = m.portManager;
      const d = m.composedScreenDevice;
      
      pm.writePort(0xbf3b, 0x40); // Mode 01 (control)
      pm.writePort(0xff3b, 0x01); // Enable ULA+

      // --- Act
      const readValue = pm.readPort(0xff3b);

      // --- Assert
      expect(readValue).toBe(0x01);
    });

    it("Port 0xFF3B mode 01: clears enable flag", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pm = m.portManager;
      const d = m.composedScreenDevice;
      
      pm.writePort(0xbf3b, 0x40); // Mode 01
      pm.writePort(0xff3b, 0x01); // Enable
      
      // --- Act
      pm.writePort(0xff3b, 0x00); // Disable

      // --- Assert
      expect(d.ulaPlusEnabled).toBe(false);
    });

    it("Port 0xFF3B mode 10: write ignored", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pm = m.portManager;
      const d = m.composedScreenDevice;
      
      pm.writePort(0xbf3b, 0x40); // Mode 01
      pm.writePort(0xff3b, 0x01); // Enable
      pm.writePort(0xbf3b, 0x80); // Mode 10 (reserved)

      // --- Act
      pm.writePort(0xff3b, 0x00); // Attempt to disable (should be ignored)

      // --- Assert
      expect(d.ulaPlusEnabled).toBe(true); // Still enabled
    });

    it("Port 0xFF3B mode 11: write ignored", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pm = m.portManager;
      const d = m.composedScreenDevice;
      
      pm.writePort(0xbf3b, 0x40); // Mode 01
      pm.writePort(0xff3b, 0x00); // Disable
      pm.writePort(0xbf3b, 0xc0); // Mode 11 (reserved)

      // --- Act
      pm.writePort(0xff3b, 0x01); // Attempt to enable (should be ignored)

      // --- Assert
      expect(d.ulaPlusEnabled).toBe(false); // Still disabled
    });

    it("Port 0xFF3B mode 10/11: reads enable flag", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pm = m.portManager;
      const d = m.composedScreenDevice;
      
      pm.writePort(0xbf3b, 0x40); // Mode 01
      pm.writePort(0xff3b, 0x01); // Enable

      // --- Act
      pm.writePort(0xbf3b, 0x80); // Mode 10
      const readMode10 = pm.readPort(0xff3b);
      pm.writePort(0xbf3b, 0xc0); // Mode 11
      const readMode11 = pm.readPort(0xff3b);

      // --- Assert
      expect(readMode10).toBe(0x01);
      expect(readMode11).toBe(0x01);
    });

    it("NextReg 0x68 bit 3 enables ULA+", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const d = m.composedScreenDevice;

      // --- Act
      writeNextReg(m, 0x68, 0x08); // Bit 3 = 1

      // --- Assert
      expect(d.ulaPlusEnabled).toBe(true);
    });

    it("NextReg 0x68 bit 3 disables ULA+", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pm = m.portManager;
      const d = m.composedScreenDevice;
      
      pm.writePort(0xbf3b, 0x40); // Mode 01
      pm.writePort(0xff3b, 0x01); // Enable via port

      // --- Act
      writeNextReg(m, 0x68, 0x00); // Bit 3 = 0

      // --- Assert
      expect(d.ulaPlusEnabled).toBe(false);
    });

    it("NextReg 0x68 syncs with Port 0xFF3B enable flag", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pm = m.portManager;
      
      writeNextReg(m, 0x68, 0x08); // Enable via NextReg
      pm.writePort(0xbf3b, 0x40); // Mode 01 (control)

      // --- Act
      const readValue = pm.readPort(0xff3b);

      // --- Assert
      expect(readValue).toBe(0x01); // Port reflects NextReg setting
    });

    it("Port 0xFF3B syncs with NextReg 0x68", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pm = m.portManager;
      
      pm.writePort(0xbf3b, 0x40); // Mode 01 (control)
      pm.writePort(0xff3b, 0x01); // Enable via port

      // --- Act
      const regValue = readNextReg(m, 0x68);

      // --- Assert
      expect(regValue & 0x08).toBe(0x08); // Bit 3 is set
    });

    it("Palette index preserved across mode switches", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pm = m.portManager;
      const d = m.composedScreenDevice;

      // --- Act
      pm.writePort(0xbf3b, 0x15); // Mode 00, index 21
      pm.writePort(0xbf3b, 0x40); // Switch to mode 01 (index remains 21)

      // --- Assert
      expect(d.ulaPlusMode).toBe(0x01);
      expect(d.ulaPlusPaletteIndex).toBe(0x15); // Index preserved when switching to mode 01
      
      // --- Act (switch back to mode 00 with new index)
      pm.writePort(0xbf3b, 0x0a); // Mode 00, index 10
      
      // --- Assert
      expect(d.ulaPlusMode).toBe(0x00);
      expect(d.ulaPlusPaletteIndex).toBe(0x0a); // New index set
    });

    it("Multiple palette writes in mode 00", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pm = m.portManager;
      const pal = m.paletteDevice;
      
      pm.writePort(0xbf3b, 0x00); // Mode 00, index 0

      // --- Act
      for (let i = 0; i < 8; i++) {
        pm.writePort(0xbf3b, i); // Set index
        pm.writePort(0xff3b, (i << 5) | (i << 2) | (i & 0x03)); // Write color
      }

      // --- Assert
      for (let i = 0; i < 8; i++) {
        const rgb333 = pal.ulaFirst[i];
        const expectedR = i;
        const expectedG = i;
        const expectedB = i & 0x03;
        const expectedRgb333 = (expectedR << 6) | (expectedG << 3) | (expectedB << 1) | (expectedB & 0x01);
        expect(rgb333).toBe(expectedRgb333);
      }
    });

    it("ULA+ palette uses 6-bit index space (0-63)", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const pm = m.portManager;
      const pal = m.paletteDevice;

      // --- Act
      pm.writePort(0xbf3b, 0x3f); // Mode 00, index 63 (max)
      pm.writePort(0xff3b, 0xff); // White
      
      pm.writePort(0xbf3b, 0x7f); // Mode 01, but with bits beyond 6 set
      pm.writePort(0xbf3b, 0x00); // Mode 00, index 0

      // --- Assert
      expect(pal.ulaFirst[63]).toBe(0x1ff); // Max index writable
      expect(m.composedScreenDevice.ulaPlusPaletteIndex).toBe(0x00);
    });
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
