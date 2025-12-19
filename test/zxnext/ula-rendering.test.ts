import { describe, it, expect } from "vitest";
import { createTestNextMachine } from "./TestNextMachine";
import { IZxNextMachine } from "@renderer/abstractions/IZxNextMachine";
import { TimingConfig } from "@emu/machines/zxNext/screen/TimingConfig";

describe("Next - ULA rendering", function () {
  it("empty screen is rendered properly", async () => {
    // --- Arrange
    const m = await createTestNextMachine();
    const d = m.composedScreenDevice;
    initScreenBytes(m, 0x00);
    initAttrBytes(m, 0x38);
    m.writePort(0xfe, 0x03); // magenta border
 
    // --- Act

    const buffer = d.renderFullScreen();

    // --- Assert
    expect(buffer).toBeDefined();
    expect(getFirstBorderPixel(buffer)).toBe(0xFFB600B6); // black border
    const firstPixel = getDisplayPixel(d.config, buffer, 0, 0);
    expect(firstPixel).toBe(0xff000000); // paper color
  });
});

function initScreenBytes(machine: IZxNextMachine, byte: number) {
  for (let addr = 0; addr < 0x5800; addr++) {
    machine.memoryDevice.writeScreenMemory(addr, byte);
  }
}

function initAttrBytes(machine: IZxNextMachine, byte: number) {
  for (let addr = 0x5800; addr < 0x5b00; addr++) {
    machine.memoryDevice.writeScreenMemory(addr, byte);
  }
}

const SCREEN_WIDTH = 720;

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
