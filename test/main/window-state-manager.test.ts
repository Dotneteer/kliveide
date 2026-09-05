import { beforeEach, describe, expect, it, vi } from "vitest";

// --- A single 2560x1440 display scaled to 150%, which is what Windows reports as
// --- 1707x960 device-independent pixels. The fractional scaling is what makes an
// --- edge-snapped window measure a few pixels wider than the display it sits on.
const PRIMARY_DISPLAY = { x: 0, y: 0, width: 1707, height: 960 };

const getAllDisplays = vi.fn(() => [{ bounds: PRIMARY_DISPLAY }]);
const getPrimaryDisplay = vi.fn(() => ({ bounds: PRIMARY_DISPLAY }));
const getDisplayMatching = vi.fn(() => ({ bounds: PRIMARY_DISPLAY }));

vi.mock("electron", () => ({
  BrowserWindow: vi.fn(),
  screen: {
    getAllDisplays: () => getAllDisplays(),
    getPrimaryDisplay: () => getPrimaryDisplay(),
    getDisplayMatching: () => getDisplayMatching()
  }
}));

import { createWindowStateManager } from "@main/WindowStateManager";

const DEFAULTS = { defaultWidth: 720, defaultHeight: 540 };

function stateOf(stored: any) {
  const manager = createWindowStateManager(stored, DEFAULTS);
  return { x: manager.x, y: manager.y, width: manager.width, height: manager.height };
}

describe("WindowStateManager: restoring stored bounds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps a window that overhangs the right screen edge", () => {
    // --- The emulator window as Windows actually persists it: its right edge lands at
    // --- 1716, nine pixels past the 1707-wide display, because the window bounds include
    // --- the invisible resize border. The window is fully visible to the user, so its
    // --- position and size must survive a restart.
    const stored = {
      x: 991,
      y: 0,
      width: 725,
      height: 918,
      displayBounds: PRIMARY_DISPLAY,
      isMaximized: false,
      isFullScreen: false
    };

    expect(stateOf(stored)).toEqual({ x: 991, y: 0, width: 725, height: 918 });
  });

  it("keeps a window that is fully on screen", () => {
    const stored = {
      x: 0,
      y: 0,
      width: 1004,
      height: 912,
      displayBounds: PRIMARY_DISPLAY,
      isMaximized: false,
      isFullScreen: false
    };

    expect(stateOf(stored)).toEqual({ x: 0, y: 0, width: 1004, height: 912 });
  });

  it("resets a window stranded on a disconnected monitor", () => {
    const stored = {
      x: 3000,
      y: 0,
      width: 800,
      height: 600,
      displayBounds: { x: 1707, y: 0, width: 1920, height: 1080 },
      isMaximized: false,
      isFullScreen: false
    };

    expect(stateOf(stored)).toEqual({ x: 0, y: 0, width: 720, height: 540 });
  });

  it("resets a window dragged off the left edge", () => {
    const stored = {
      x: -900,
      y: 0,
      width: 800,
      height: 600,
      displayBounds: PRIMARY_DISPLAY,
      isMaximized: false,
      isFullScreen: false
    };

    expect(stateOf(stored)).toEqual({ x: 0, y: 0, width: 720, height: 540 });
  });

  it("resets a window with too little left on screen to grab", () => {
    // --- Only 50px of the window overlaps the display: not enough to grab its title bar.
    const stored = {
      x: 1657,
      y: 100,
      width: 800,
      height: 600,
      displayBounds: PRIMARY_DISPLAY,
      isMaximized: false,
      isFullScreen: false
    };

    expect(stateOf(stored)).toEqual({ x: 0, y: 0, width: 720, height: 540 });
  });

  it("keeps a window with enough left on screen to grab", () => {
    // --- 150px overlap: partly off-screen, but the user can still drag it back.
    const stored = {
      x: 1557,
      y: 100,
      width: 800,
      height: 600,
      displayBounds: PRIMARY_DISPLAY,
      isMaximized: false,
      isFullScreen: false
    };

    expect(stateOf(stored)).toEqual({ x: 1557, y: 100, width: 800, height: 600 });
  });

  it("falls back to the supplied defaults when there is no stored state", () => {
    const manager = createWindowStateManager(undefined as any, DEFAULTS);

    expect(manager.width).toBe(720);
    expect(manager.height).toBe(540);
  });
});
