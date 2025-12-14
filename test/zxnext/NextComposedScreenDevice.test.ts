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

  describe("Reg $15 - Sprite and Layers System", () => {
    it("Reg $15 enableLoresMode (false)", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const screenDevice = m.screenDevice;

      // --- Act
      writeNextReg(m, 0x15, 0x00);

      // --- Assert
      expect(screenDevice.enableLoresMode).toBe(false);
    });

    it("Reg $15 enableLoresMode (true)", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const screenDevice = m.screenDevice;

      // --- Act
      writeNextReg(m, 0x15, 0x80);

      // --- Assert
      expect(screenDevice.enableLoresMode).toBe(true);
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

  describe("pulseIntActive", () => {
    it("pulseIntActive 50Hz", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      writeNextReg(m, 0x05, 0x00);
      const config = scrDevice.config;
      const intStart = config.intVC * config.totalHC + config.intHC;

      // --- Act/Assert
      expect(scrDevice.is60HzMode).toBe(false);
      scrDevice.renderTact(0);
      expect(scrDevice.pulseIntActive).toBe(false);
      for (let t = 1; t < intStart; t++) {
        scrDevice.renderTact(t);
      }
      expect(scrDevice.pulseIntActive).toBe(false);
      scrDevice.renderTact(intStart);
      expect(scrDevice.pulseIntActive).toBe(true);
      for (let t = intStart + 1; t < intStart + config.intPulseLength - 1; t++) {
        scrDevice.renderTact(t);
      }
      expect(scrDevice.pulseIntActive).toBe(true);
      for (
        let t = intStart + config.intPulseLength - 1;
        t < intStart + config.intPulseLength + 100;
        t++
      ) {
        scrDevice.renderTact(t);
      }
      expect(scrDevice.pulseIntActive).toBe(false);
    });

    it("pulseIntActive 60Hz", async () => {
      // --- Arrange
      const m = await createTestNextMachine();
      const scrDevice = m.composedScreenDevice;
      writeNextReg(m, 0x05, 0x04);
      const config = scrDevice.config;
      const intStart = config.intVC * config.totalHC + config.intHC;

      // --- Act/Assert
      expect(scrDevice.is60HzMode).toBe(true);
      scrDevice.renderTact(0);
      expect(scrDevice.pulseIntActive).toBe(false);
      for (let t = 1; t < intStart; t++) {
        scrDevice.renderTact(t);
      }
      expect(scrDevice.pulseIntActive).toBe(false);
      scrDevice.renderTact(intStart);
      expect(scrDevice.pulseIntActive).toBe(true);
      for (let t = intStart + 1; t < intStart + config.intPulseLength - 1; t++) {
        scrDevice.renderTact(t);
      }
      expect(scrDevice.pulseIntActive).toBe(true);
      for (
        let t = intStart + config.intPulseLength - 1;
        t < intStart + config.intPulseLength + 100;
        t++
      ) {
        scrDevice.renderTact(t);
      }
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
