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
      expect(scrDevice.enableUlaPlus).toBe(false);
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
      expect(srcDevice.enableUlaPlus).toBe(false);
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
      expect(srcDevice.enableUlaPlus).toBe(true);
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
      expect(srcDevice.enableUlaPlus).toBe(false);
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
      expect(srcDevice.enableUlaPlus).toBe(false);
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
});

function writeNextReg(m: IZxNextMachine, reg: number, value: number) {
  m.nextRegDevice.setNextRegisterIndex(reg);
  m.nextRegDevice.setNextRegisterValue(value);
}

function readNextReg(m: IZxNextMachine, reg: number): number {
  m.nextRegDevice.setNextRegisterIndex(reg);
  return m.nextRegDevice.getNextRegisterValue();
}
