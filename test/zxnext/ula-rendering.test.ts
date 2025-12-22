import { describe, it, expect, beforeEach } from "vitest";
import { createTestNextMachine, TestZxNextMachine } from "./TestNextMachine";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import { TimingConfig } from "@emu/machines/zxNext/screen/TimingConfig";
import { NextComposedScreenDevice } from "@emu/machines/zxNext/screen/NextComposedScreenDevice";

let m: TestZxNextMachine;
let d: NextComposedScreenDevice;

describe("Next - ULA rendering", function () {
  beforeEach(async () => {
    m = await createTestNextMachine();
    d = m.composedScreenDevice;
    initScreenBytes(m, 0x00);
    initAttrBytes(m, 0x38);
  });

  for (let shiftX = 0; shiftX < 257; shiftX++) {
    it(`Two bytes with X scroll ${shiftX} are rendered properly`, async () => {
      // --- Arrange
      m.memoryDevice.writeScreenMemory(getDisplayByteAddress(0, 0), 0xff);
      m.memoryDevice.writeScreenMemory(getDisplayByteAddress(1, 0), 0xaa);
      m.memoryDevice.writeScreenMemory(getDisplayAttributeAddress(1, 0), 0x72);
      m.writePort(0xfe, 0x03); // magenta border
      m.nextRegDevice.directSetRegValue(0x26, shiftX); // set horizontal shift

      // --- Act
      const buffer = d.renderFullScreen();

      // --- Assert
      expect(buffer).toBeDefined();

      // --- Check magenta border
      expect(getFirstBorderPixel(buffer)).toBe(0xffb600b6); // black border
      const matchingBorderPixels = getMatchingBorderPixels(d.config, buffer, 0xffb600b6);
      const borderPixelCount = getBorderPixelCount(d.config);
      expect(matchingBorderPixels).toBe(borderPixelCount);

      // --- Check paper white/ink black display
      const shPix = (sh: number) => (2 * ((256 - shiftX) & 0xff) + sh) & 0x1ff;
      expect(getDisplayPixel(d.config, buffer, shPix(0), 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(1), 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(2), 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(3), 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(4), 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(5), 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(6), 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(7), 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(8), 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(9), 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(10), 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(11), 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(12), 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(13), 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(14), 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(15), 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(16), 0)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(17), 0)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(18), 0)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, shPix(19), 0)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, shPix(20), 0)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(21), 0)).toBe(0xff0000ff); // paper
      expect(getDisplayPixel(d.config, buffer, shPix(22), 0)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, shPix(23), 0)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, shPix(24), 0)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(25), 0)).toBe(0xff0000ff); // paper
      expect(getDisplayPixel(d.config, buffer, shPix(26), 0)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, shPix(27), 0)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, shPix(28), 0)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(29), 0)).toBe(0xff0000ff); // paper
      expect(getDisplayPixel(d.config, buffer, shPix(30), 0)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, shPix(31), 0)).toBe(0xff00ffff); // paper
      const nextColor = 0xffb6b6b6;
      expect(getDisplayPixel(d.config, buffer, shPix(32), 0)).toBe(nextColor); // ink
      expect(getDisplayPixel(d.config, buffer, shPix(33), 0)).toBe(nextColor); // paper
      expect(getMatchingDisplayPixels(d.config, buffer, 0xff000000)).toBe(16);
      expect(getMatchingDisplayPixels(d.config, buffer, 0xff0000ff)).toBe(8);
      expect(getMatchingDisplayPixels(d.config, buffer, 0xff00ffff)).toBe(120);
    });
  }

  it("empty screen is rendered properly", () => {
    // --- Arrange
    m.writePort(0xfe, 0x03); // magenta border

    // --- Act
    const buffer = d.renderFullScreen();

    // --- Assert
    expect(buffer).toBeDefined();

    // --- Check magenta border
    expect(getFirstBorderPixel(buffer)).toBe(0xffb600b6); // black border
    const firstPixel = getDisplayPixel(d.config, buffer, 0, 0);
    const matchingBorderPixels = getMatchingBorderPixels(d.config, buffer, 0xffb600b6);
    const borderPixelCount = getBorderPixelCount(d.config);
    expect(matchingBorderPixels).toBe(borderPixelCount);

    // --- Check paper white/ink black display
    expect(firstPixel).toBe(0xffb6b6b6); // paper color
    const matchingDisplayPixels = getMatchingDisplayPixels(d.config, buffer, 0xffb6b6b6);
    const displayPixelCount = getDisplayPixelCount(d.config);
    expect(matchingDisplayPixels).toBe(displayPixelCount);
  });

  for (let col = 0; col < 31; col++) {
    it(`Two bytes from column ${col} are rendered properly`, async () => {
      // --- Arrange
      m.memoryDevice.writeScreenMemory(getDisplayByteAddress(col, 0), 0xff);
      m.memoryDevice.writeScreenMemory(getDisplayByteAddress(col + 1, 0), 0xaa);
      m.memoryDevice.writeScreenMemory(getDisplayAttributeAddress(col + 1, 0), 0x72);
      m.writePort(0xfe, 0x03); // magenta border

      // --- Act
      const buffer = d.renderFullScreen();

      // --- Assert
      expect(buffer).toBeDefined();

      // --- Check magenta border
      expect(getFirstBorderPixel(buffer)).toBe(0xffb600b6); // black border
      const matchingBorderPixels = getMatchingBorderPixels(d.config, buffer, 0xffb600b6);
      const borderPixelCount = getBorderPixelCount(d.config);
      expect(matchingBorderPixels).toBe(borderPixelCount);

      // --- Check paper white/ink black display
      const startPx = col * 8 * 2;
      expect(getDisplayPixel(d.config, buffer, startPx + 0, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 1, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 2, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 3, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 4, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 5, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 6, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 7, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 8, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 9, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 10, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 11, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 12, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 13, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 14, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 15, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 16, 0)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 17, 0)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 18, 0)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 19, 0)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 20, 0)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 21, 0)).toBe(0xff0000ff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 22, 0)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 23, 0)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 24, 0)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 25, 0)).toBe(0xff0000ff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 26, 0)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 27, 0)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 28, 0)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 29, 0)).toBe(0xff0000ff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 30, 0)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 31, 0)).toBe(0xff00ffff); // paper
      const nextColor = col < 30 ? 0xffb6b6b6 : 0xffb600b6;
      expect(getDisplayPixel(d.config, buffer, startPx + 32, 0)).toBe(nextColor); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 33, 0)).toBe(nextColor); // paper
      expect(getMatchingDisplayPixels(d.config, buffer, 0xff000000)).toBe(16);
      expect(getMatchingDisplayPixels(d.config, buffer, 0xff0000ff)).toBe(8);
      expect(getMatchingDisplayPixels(d.config, buffer, 0xff00ffff)).toBe(120);
    });
  }

  for (let line = 0; line < 192; line++) {
    it(`Two bytes in line ${line} are rendered properly`, () => {
      // --- Arrange
      m.memoryDevice.writeScreenMemory(getDisplayByteAddress(0, line), 0xff);
      m.memoryDevice.writeScreenMemory(getDisplayByteAddress(1, line), 0xaa);
      m.memoryDevice.writeScreenMemory(getDisplayAttributeAddress(1, line), 0x72);
      m.writePort(0xfe, 0x03); // magenta border

      // --- Act
      const buffer = d.renderFullScreen();

      // --- Assert
      expect(buffer).toBeDefined();

      // --- Check magenta border
      expect(getFirstBorderPixel(buffer)).toBe(0xffb600b6); // black border
      const matchingBorderPixels = getMatchingBorderPixels(d.config, buffer, 0xffb600b6);
      const borderPixelCount = getBorderPixelCount(d.config);
      expect(matchingBorderPixels).toBe(borderPixelCount);

      // --- Check paper white/ink black display
      const startPx = 0;
      expect(getDisplayPixel(d.config, buffer, startPx + 0, line)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 1, line)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 2, line)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 3, line)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 4, line)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 5, line)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 6, line)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 7, line)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 8, line)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 9, line)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 10, line)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 11, line)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 12, line)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 13, line)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 14, line)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 15, line)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 16, line)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 17, line)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 18, line)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 19, line)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 20, line)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 21, line)).toBe(0xff0000ff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 22, line)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 23, line)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 24, line)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 25, line)).toBe(0xff0000ff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 26, line)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 27, line)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 28, line)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 29, line)).toBe(0xff0000ff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 30, line)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 31, line)).toBe(0xff00ffff); // paper
      const nextColor = 0xffb6b6b6;
      expect(getDisplayPixel(d.config, buffer, startPx + 32, line)).toBe(nextColor); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 33, line)).toBe(nextColor); // paper
      expect(getMatchingDisplayPixels(d.config, buffer, 0xff000000)).toBe(16);
      expect(getMatchingDisplayPixels(d.config, buffer, 0xff0000ff)).toBe(8);
      expect(getMatchingDisplayPixels(d.config, buffer, 0xff00ffff)).toBe(120);
    });
  }

  for (let shiftX = 0; shiftX < 1; shiftX++) {
    it(`Two bytes with X scroll ${shiftX} are rendered properly`, async () => {
      // --- Arrange
      m.memoryDevice.writeScreenMemory(getDisplayByteAddress(0, 0), 0xff);
      m.memoryDevice.writeScreenMemory(getDisplayByteAddress(1, 0), 0xaa);
      m.memoryDevice.writeScreenMemory(getDisplayAttributeAddress(1, 0), 0x72);
      m.writePort(0xfe, 0x03); // magenta border
      m.nextRegDevice.directSetRegValue(0x26, shiftX); // set horizontal shift

      // --- Act
      const buffer = d.renderFullScreen();

      // --- Assert
      expect(buffer).toBeDefined();

      // --- Check magenta border
      expect(getFirstBorderPixel(buffer)).toBe(0xffb600b6); // black border
      const matchingBorderPixels = getMatchingBorderPixels(d.config, buffer, 0xffb600b6);
      const borderPixelCount = getBorderPixelCount(d.config);
      expect(matchingBorderPixels).toBe(borderPixelCount);

      // --- Check paper white/ink black display
      const startPx = shiftX;
      expect(getDisplayPixel(d.config, buffer, startPx + 0, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 1, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 2, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 3, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 4, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 5, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 6, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 7, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 8, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 9, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 10, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 11, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 12, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 13, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 14, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 15, 0)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 16, 0)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 17, 0)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 18, 0)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 19, 0)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 20, 0)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 21, 0)).toBe(0xff0000ff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 22, 0)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 23, 0)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 24, 0)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 25, 0)).toBe(0xff0000ff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 26, 0)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 27, 0)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 28, 0)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 29, 0)).toBe(0xff0000ff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 30, 0)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, startPx + 31, 0)).toBe(0xff00ffff); // paper
      const nextColor = 0xffb6b6b6;
      expect(getDisplayPixel(d.config, buffer, startPx + 32, 0)).toBe(nextColor); // ink
      expect(getDisplayPixel(d.config, buffer, startPx + 33, 0)).toBe(nextColor); // paper
      expect(getMatchingDisplayPixels(d.config, buffer, 0xff000000)).toBe(16);
      expect(getMatchingDisplayPixels(d.config, buffer, 0xff0000ff)).toBe(8);
      expect(getMatchingDisplayPixels(d.config, buffer, 0xff00ffff)).toBe(120);
    });
  }

  for (let shiftY = 0; shiftY < 193; shiftY++) {
    it(`Two bytes with Y scroll ${shiftY} are rendered properly`, async () => {
      // --- Arrange
      m.memoryDevice.writeScreenMemory(getDisplayByteAddress(0, 0), 0xff);
      m.memoryDevice.writeScreenMemory(getDisplayByteAddress(1, 0), 0xaa);
      m.memoryDevice.writeScreenMemory(getDisplayAttributeAddress(1, 0), 0x72);
      m.writePort(0xfe, 0x03); // magenta border
      m.nextRegDevice.directSetRegValue(0x27, shiftY); // set vertical shift

      // --- Act
      const buffer = d.renderFullScreen();

      // --- Assert
      expect(buffer).toBeDefined();

      // --- Check magenta border
      expect(getFirstBorderPixel(buffer)).toBe(0xffb600b6); // black border
      const matchingBorderPixels = getMatchingBorderPixels(d.config, buffer, 0xffb600b6);
      const borderPixelCount = getBorderPixelCount(d.config);
      expect(matchingBorderPixels).toBe(borderPixelCount);

      // --- Check paper white/ink black display
      let yLine = 192 - shiftY;
      if (yLine >= 192) yLine -= 192;
      expect(getDisplayPixel(d.config, buffer, 0, yLine)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, 1, yLine)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, 2, yLine)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, 3, yLine)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, 4, yLine)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, 5, yLine)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, 6, yLine)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, 7, yLine)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, 8, yLine)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, 9, yLine)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, 10, yLine)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, 11, yLine)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, 12, yLine)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, 13, yLine)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, 14, yLine)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, 15, yLine)).toBe(0xff000000); // ink
      expect(getDisplayPixel(d.config, buffer, 16, yLine)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, 17, yLine)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, 18, yLine)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, 19, yLine)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, 20, yLine)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, 21, yLine)).toBe(0xff0000ff); // paper
      expect(getDisplayPixel(d.config, buffer, 22, yLine)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, 23, yLine)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, 24, yLine)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, 25, yLine)).toBe(0xff0000ff); // paper
      expect(getDisplayPixel(d.config, buffer, 26, yLine)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, 27, yLine)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, 28, yLine)).toBe(0xff0000ff); // ink
      expect(getDisplayPixel(d.config, buffer, 29, yLine)).toBe(0xff0000ff); // paper
      expect(getDisplayPixel(d.config, buffer, 30, yLine)).toBe(0xff00ffff); // paper
      expect(getDisplayPixel(d.config, buffer, 31, yLine)).toBe(0xff00ffff); // paper
      const nextColor = 0xffb6b6b6;
      expect(getDisplayPixel(d.config, buffer, 32, yLine)).toBe(nextColor); // ink
      expect(getDisplayPixel(d.config, buffer, 33, yLine)).toBe(nextColor); // paper
      expect(getMatchingDisplayPixels(d.config, buffer, 0xff000000)).toBe(16);
      expect(getMatchingDisplayPixels(d.config, buffer, 0xff0000ff)).toBe(8);
      expect(getMatchingDisplayPixels(d.config, buffer, 0xff00ffff)).toBe(120);
    });
  }
});

function initScreenBytes(machine: IZxNextMachine, byte: number) {
  for (let addr = 0; addr < 0x1800; addr++) {
    machine.memoryDevice.writeScreenMemory(addr, byte);
  }
}

function initAttrBytes(machine: IZxNextMachine, byte: number) {
  for (let addr = 0x1800; addr < 0x1b00; addr++) {
    machine.memoryDevice.writeScreenMemory(addr, byte);
  }
}

const SCREEN_WIDTH = 720;
const SCREEN_HEIGHT = 288;

function getDisplayPixel(config: TimingConfig, buffer: Uint32Array, x: number, y: number): number {
  // Map display area coordinates (x, y) to buffer coordinates
  // The display area starts at HC=144, which maps to buffer X offset
  // HC range: firstVisibleHC (96) to maxHC (455) -> buffer X: 0 to 719
  // Each pixel in standard mode is doubled horizontally (2 buffer pixels per source pixel)
  const displayXOffset = (config.displayXStart - config.firstVisibleHC) * 2;
  const displayYOffset = config.displayYStart - config.firstBitmapVC;

  const bufferX = displayXOffset + x;
  const bufferY = displayYOffset + y;
  const index = bufferY * SCREEN_WIDTH + bufferX;

  return buffer[index];
}

function getFirstBorderPixel(buffer: Uint32Array): number {
  return buffer[0];
}

function getBorderPixelCount(config: TimingConfig): number {
  const displayXOffset = (config.displayXStart - config.firstVisibleHC) * 2;
  const displayYOffset = config.displayYStart - config.firstBitmapVC;
  const displayXEndOffset = (config.displayXEnd - config.firstVisibleHC + 1) * 2;
  const displayYEndOffset = config.displayYEnd - config.firstBitmapVC + 1;

  const totalPixels = SCREEN_WIDTH * SCREEN_HEIGHT;
  const displayPixels = (displayXEndOffset - displayXOffset) * (displayYEndOffset - displayYOffset);
  return totalPixels - displayPixels;
}

function getDisplayPixelCount(config: TimingConfig): number {
  const displayXOffset = (config.displayXStart - config.firstVisibleHC) * 2;
  const displayYOffset = config.displayYStart - config.firstBitmapVC;
  const displayXEndOffset = (config.displayXEnd - config.firstVisibleHC + 1) * 2;
  const displayYEndOffset = config.displayYEnd - config.firstBitmapVC + 1;

  return (displayXEndOffset - displayXOffset) * (displayYEndOffset - displayYOffset);
}

function getMatchingBorderPixels(
  config: TimingConfig,
  buffer: Uint32Array,
  pixelArgb: number
): number {
  // --- Traverse through all border pixels and count matches
  let count = 0;
  const displayXOffset = (config.displayXStart - config.firstVisibleHC) * 2;
  const displayYOffset = config.displayYStart - config.firstBitmapVC;
  const displayXEndOffset = (config.displayXEnd - config.firstVisibleHC + 1) * 2;
  const displayYEndOffset = config.displayYEnd - config.firstBitmapVC + 1;

  for (let y = 0; y < SCREEN_HEIGHT; y++) {
    for (let x = 0; x < SCREEN_WIDTH; x++) {
      // Check if pixel is in border area
      if (
        x < displayXOffset ||
        x >= displayXEndOffset ||
        y < displayYOffset ||
        y >= displayYEndOffset
      ) {
        const index = y * SCREEN_WIDTH + x;
        if (buffer[index] === pixelArgb) {
          count++;
        }
      }
    }
  }
  return count;
}

function getMatchingDisplayPixels(
  config: TimingConfig,
  buffer: Uint32Array,
  pixelArgb: number
): number {
  // --- Traverse through all display pixels and count matches
  let count = 0;
  const displayXOffset = (config.displayXStart - config.firstVisibleHC) * 2;
  const displayYOffset = config.displayYStart - config.firstBitmapVC;
  const displayXEndOffset = (config.displayXEnd - config.firstVisibleHC + 1) * 2;
  const displayYEndOffset = config.displayYEnd - config.firstBitmapVC + 1;

  for (let y = displayYOffset; y < displayYEndOffset; y++) {
    for (let x = displayXOffset; x < displayXEndOffset; x++) {
      const index = y * SCREEN_WIDTH + x;
      if (buffer[index] === pixelArgb) {
        //console.log(x - displayXOffset, y - displayYOffset);
        count++;
      }
    }
  }
  return count;
}

function getDisplayByteAddress(col: number, y: number): number {
  // --- Calculate ZX Spectrum screen memory address for pixel (col, y)
  // --- col: 0-31, y: 0-191
  const row = y & 0b00000111; // y % 8
  const block = (y >> 3) & 0b00000111; // (y / 8) % 8
  const section = (y >> 6) & 0b00000011; // y / 64
  const address = (section << 11) | (row << 8) | (block << 5) | col;
  return address;
}

function getDisplayAttributeAddress(col: number, y: number): number {
  // --- Calculate ZX Spectrum attribute memory address for pixel (col, y)
  // --- col: 0-255, y: 0-191
  const attrRow = Math.floor(y / 8);
  const address = 0x1800 + attrRow * 32 + col;
  return address;
}
