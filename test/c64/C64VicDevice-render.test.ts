import { C64Machine } from "@emu/machines/c64/C64Machine";
import { describe, expect, it, beforeEach } from "vitest";

describe("C64 - VIC-II Device - render", () => {
  let c64: C64Machine;

  beforeEach(() => {
    c64 = new C64Machine();
  });

  it("Visible item count is correct", () => {
    // --- Arrange
    const vic = c64.vicDevice;
    vic.reset();
    let pixelCount = 0;
    let visiblePixels = 0;
    let visibleRasters = 0;
    const interceptor = () => {
      pixelCount++;
      if (vic.currentIsVisible) {
        visiblePixels++;
      }
      if (vic.currentRasterIsVisible) {
        visibleRasters++;
      }
    };
    vic.setPixelRendererInterceptor(interceptor);

    // --- Act
    vic.renderFullScreen();

    // --- Assert
    expect(pixelCount).toBe(vic.totalTactsInFrame * 8);
    expect(visiblePixels).toBe(vic.screenLines * vic.screenWidth);
  });
});
