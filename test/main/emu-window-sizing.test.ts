import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  screen: {
    getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } })
  }
}));

import {
  applyEmuContentSizeHints,
  fitEmuWindowToScreen,
  getEmuWindowMachineId,
  type EmuMachineSizeStore
} from "@main/emu-window-sizing";

/*
 * Issue #1377: the emulator window's minimum size, View | Fit Window to Screen, and each machine's
 * own window size. The renderer reports CSS pixels; the page zoom and window frame are added here.
 */

const FRAME = 28; // --- title bar height in these fakes

function fakeWindow(opts: {
  size: [number, number];
  pos?: [number, number];
  zoom?: number;
  maximized?: boolean;
  fullScreen?: boolean;
  destroyed?: boolean;
}) {
  let [width, height] = opts.size;
  let [x, y] = opts.pos ?? [100, 100];
  let maximized = !!opts.maximized;
  const win = {
    isDestroyed: () => !!opts.destroyed,
    getSize: () => [width, height],
    getContentSize: () => [width, height - FRAME],
    getBounds: () => ({ x, y, width, height }),
    getNormalBounds: () => ({ x, y, width, height }),
    isMaximized: () => maximized,
    isFullScreen: () => !!opts.fullScreen,
    unmaximize: vi.fn(() => (maximized = false)),
    webContents: { getZoomFactor: () => opts.zoom ?? 1 },
    setMinimumSize: vi.fn(),
    setBounds: vi.fn((b: { x: number; y: number; width: number; height: number }) => {
      ({ x, y, width, height } = b);
    })
  };
  return win;
}

function memoryStore(initial: Record<string, { width: number; height: number }> = {}) {
  const sizes = { ...initial };
  const store: EmuMachineSizeStore & { sizes: typeof sizes } = {
    sizes,
    load: (id) => sizes[id],
    save: vi.fn((id, size) => {
      sizes[id] = size;
    })
  };
  return store;
}

const hints = (machineId: string, min: [number, number], fit: [number, number] = min) => ({
  machineId,
  minimum: { width: min[0], height: min[1] },
  fit: { width: fit[0], height: fit[1] }
});

describe("applyEmuContentSizeHints", () => {
  let store: ReturnType<typeof memoryStore>;
  beforeEach(() => {
    store = memoryStore();
  });

  it("makes the picture at 1x the window's minimum, adding frame and page zoom", () => {
    const win = fakeWindow({ size: [1000, 800], zoom: 1.25 });
    applyEmuContentSizeHints(win as any, hints("sp48", [700, 200]), store);
    expect(win.setMinimumSize).toHaveBeenCalledWith(875, 278);
    expect(win.setBounds).not.toHaveBeenCalled();
    expect(getEmuWindowMachineId(win as any)).toBe("sp48");
  });

  it("lets a Z88 window shrink well below the old 480-pixel minimum", () => {
    const win = fakeWindow({ size: [720, 540] });
    applyEmuContentSizeHints(win as any, hints("z88", [670, 210]), store);
    expect(win.setMinimumSize).toHaveBeenCalledWith(670, 238);
  });

  it("grows a window that is smaller than the new minimum", () => {
    const win = fakeWindow({ size: [720, 220] });
    applyEmuContentSizeHints(win as any, hints("sp48", [640, 400]), store);
    expect(win.setBounds).toHaveBeenCalledWith({ x: 100, y: 100, width: 720, height: 428 });
  });

  it("saves the old machine's size and restores the new one's on a machine switch", () => {
    store = memoryStore({ z88: { width: 700, height: 250 } });
    const win = fakeWindow({ size: [900, 700] });
    applyEmuContentSizeHints(win as any, hints("sp48", [640, 400]), store);
    applyEmuContentSizeHints(win as any, hints("z88", [670, 210]), store);

    expect(store.sizes.sp48).toEqual({ width: 900, height: 700 });
    expect(win.setBounds).toHaveBeenLastCalledWith({ x: 100, y: 100, width: 700, height: 250 });

    // --- ...and back again
    applyEmuContentSizeHints(win as any, hints("sp48", [640, 400]), store);
    expect(store.sizes.z88).toEqual({ width: 700, height: 250 });
    expect(win.setBounds).toHaveBeenLastCalledWith({ x: 100, y: 100, width: 900, height: 700 });
  });

  it("does not save or restore on the first hints, nor on hints for the same machine", () => {
    store = memoryStore({ sp48: { width: 1200, height: 900 } });
    const win = fakeWindow({ size: [900, 700] });
    applyEmuContentSizeHints(win as any, hints("sp48", [640, 400]), store);
    applyEmuContentSizeHints(win as any, hints("sp48", [640, 420]), store);
    expect(store.save).not.toHaveBeenCalled();
    expect(win.setBounds).not.toHaveBeenCalled();
  });

  it("keeps the size for a machine that has none saved", () => {
    const win = fakeWindow({ size: [900, 700] });
    applyEmuContentSizeHints(win as any, hints("sp48", [640, 400]), store);
    applyEmuContentSizeHints(win as any, hints("sp128", [640, 400]), store);
    expect(store.sizes.sp48).toEqual({ width: 900, height: 700 });
    expect(win.setBounds).not.toHaveBeenCalled();
  });

  it("never restores a saved size below the new machine's minimum", () => {
    store = memoryStore({ sp48: { width: 700, height: 250 } });
    const win = fakeWindow({ size: [700, 250] });
    applyEmuContentSizeHints(win as any, hints("z88", [670, 210]), store);
    applyEmuContentSizeHints(win as any, hints("sp48", [640, 400]), store);
    expect(win.setBounds).toHaveBeenLastCalledWith({ x: 100, y: 100, width: 700, height: 428 });
  });

  it("keeps a restored window on the screen", () => {
    store = memoryStore({ sp48: { width: 1000, height: 900 } });
    const win = fakeWindow({ size: [700, 250], pos: [1500, 800] });
    applyEmuContentSizeHints(win as any, hints("z88", [670, 210]), store);
    applyEmuContentSizeHints(win as any, hints("sp48", [640, 400]), store);
    expect(win.setBounds).toHaveBeenLastCalledWith({ x: 920, y: 180, width: 1000, height: 900 });
  });

  it("leaves a maximized or full-screen window's size alone, but still saves its normal size", () => {
    store = memoryStore({ z88: { width: 700, height: 250 } });
    const win = fakeWindow({ size: [300, 200], maximized: true });
    applyEmuContentSizeHints(win as any, hints("sp48", [640, 400]), store);
    applyEmuContentSizeHints(win as any, hints("z88", [670, 210]), store);
    expect(win.setMinimumSize).toHaveBeenCalled();
    expect(win.setBounds).not.toHaveBeenCalled();
    expect(store.sizes.sp48).toEqual({ width: 300, height: 200 });

    const full = fakeWindow({ size: [300, 200], fullScreen: true });
    applyEmuContentSizeHints(full as any, hints("sp48", [640, 400]), store);
    expect(full.setBounds).not.toHaveBeenCalled();
  });

  it("ignores a destroyed window and meaningless sizes", () => {
    const gone = fakeWindow({ size: [720, 540], destroyed: true });
    applyEmuContentSizeHints(gone as any, hints("sp48", [640, 400]), store);
    expect(gone.setMinimumSize).not.toHaveBeenCalled();

    const win = fakeWindow({ size: [720, 540] });
    applyEmuContentSizeHints(win as any, hints("sp48", [NaN, 400]), store);
    applyEmuContentSizeHints(win as any, hints("sp48", [640, 400], [640, 0]), store);
    applyEmuContentSizeHints(null, hints("sp48", [640, 400]), store);
    expect(win.setMinimumSize).not.toHaveBeenCalled();
  });
});

describe("fitEmuWindowToScreen", () => {
  it("sizes the window to the reported fit", () => {
    const win = fakeWindow({ size: [1200, 900] });
    applyEmuContentSizeHints(win as any, hints("z88", [670, 210], [670, 210]));
    fitEmuWindowToScreen(win as any);
    expect(win.setBounds).toHaveBeenLastCalledWith({ x: 100, y: 100, width: 670, height: 238 });
  });

  it("keeps the current zoom step, which may be larger than 1x", () => {
    const win = fakeWindow({ size: [1200, 900], zoom: 1.5 });
    applyEmuContentSizeHints(win as any, hints("sp48", [640, 400], [720, 690]));
    fitEmuWindowToScreen(win as any);
    // --- 1063 tall at y=100 would reach past the 1080-high work area, so it moves up
    expect(win.setBounds).toHaveBeenLastCalledWith({ x: 100, y: 17, width: 1080, height: 1063 });
  });

  it("sizes the window to the picture at 1x when asked", () => {
    const win = fakeWindow({ size: [1200, 900] });
    applyEmuContentSizeHints(win as any, hints("z88", [670, 210], [990, 246]));
    fitEmuWindowToScreen(win as any);
    expect(win.setBounds).toHaveBeenLastCalledWith({ x: 100, y: 100, width: 990, height: 274 });
    fitEmuWindowToScreen(win as any, "1x");
    expect(win.setBounds).toHaveBeenLastCalledWith({ x: 100, y: 100, width: 670, height: 238 });
  });

  it("brings a maximized window back to its fitted size", () => {
    const win = fakeWindow({ size: [1920, 1080], pos: [0, 0], maximized: true });
    applyEmuContentSizeHints(win as any, hints("z88", [670, 210]));
    fitEmuWindowToScreen(win as any);
    expect(win.unmaximize).toHaveBeenCalled();
    expect(win.setBounds).toHaveBeenLastCalledWith({ x: 0, y: 0, width: 670, height: 238 });
  });

  it("does nothing before any hints arrived, or in full screen", () => {
    const win = fakeWindow({ size: [1200, 900] });
    fitEmuWindowToScreen(win as any);
    expect(win.setBounds).not.toHaveBeenCalled();

    const full = fakeWindow({ size: [1200, 900], fullScreen: true });
    applyEmuContentSizeHints(full as any, hints("z88", [670, 210]));
    fitEmuWindowToScreen(full as any);
    expect(full.setBounds).not.toHaveBeenCalled();
  });
});
