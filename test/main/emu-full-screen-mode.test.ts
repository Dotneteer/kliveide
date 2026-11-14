import { beforeEach, describe, expect, it, vi } from "vitest";

const display = vi.hoisted(() => ({
  bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  workArea: { x: 0, y: 37, width: 1920, height: 1043 }
}));
vi.mock("electron", () => ({ screen: { getDisplayMatching: () => display } }));

import {
  enterEmuFullScreenMode,
  exitEmuFullScreenMode,
  isAnyFullScreen,
  isEmuFullScreenModeActive,
  MAC_MENU_BAR_FALLBACK_PT,
  measureMacMenuBarHeight,
  onEmuWindowLeftFullScreen,
  resetEmuFullScreenMode,
  toggleEmuFullScreenMode,
  type FullScreenWindow
} from "@main/emu-full-screen-mode";
import { appStateFlagsReducer } from "@state/app-state-flags-reducer";

/*
 * The emulator window's full screen mode, main's side (`dev/plans/EMU_FULL_SCREEN_MODE_PLAN.md` §2.1,
 * D1, D2): how the window is made full screen and put back, and what the store is told.
 */

function fakeWindow(opts: { fullScreen?: boolean; simple?: boolean; noSimple?: boolean } = {}) {
  const calls: string[] = [];
  let full = !!opts.fullScreen;
  let simple = !!opts.simple;
  const win: FullScreenWindow & { calls: string[] } = {
    calls,
    isDestroyed: () => false,
    getBounds: () => ({ x: 100, y: 100, width: 800, height: 600 }),
    isFullScreen: () => full,
    setFullScreen: (flag) => {
      calls.push(`native:${flag}`);
      full = flag;
    },
    ...(opts.noSimple
      ? {}
      : {
          isSimpleFullScreen: () => simple,
          setSimpleFullScreen: (flag: boolean) => {
            calls.push(`simple:${flag}`);
            simple = flag;
          }
        })
  };
  return win;
}

let dispatched: boolean[];
let insets: (number | undefined)[];
const dispatch = (action: any) => {
  expect(action.type).toBe("SET_EMU_FULL_SCREEN_MODE");
  dispatched.push(action.payload.flag);
  insets.push(action.payload.topInset);
};

beforeEach(() => {
  resetEmuFullScreenMode();
  dispatched = [];
  insets = [];
  display.workArea = { x: 0, y: 37, width: 1920, height: 1043 };
});

describe("emulator full screen mode (main)", () => {
  it("uses simple full screen on macOS and puts the window back", () => {
    const win = fakeWindow();
    toggleEmuFullScreenMode(win, dispatch, true);
    expect(win.calls).toEqual(["simple:true"]);
    expect(isEmuFullScreenModeActive()).toBe(true);
    expect(isAnyFullScreen(win)).toBe(true);

    toggleEmuFullScreenMode(win, dispatch, true);
    expect(win.calls).toEqual(["simple:true", "simple:false"]);
    expect(isEmuFullScreenModeActive()).toBe(false);
    expect(dispatched).toEqual([true, false]);
  });

  it("uses native full screen elsewhere", () => {
    const win = fakeWindow();
    toggleEmuFullScreenMode(win, dispatch, false);
    toggleEmuFullScreenMode(win, dispatch, false);
    expect(win.calls).toEqual(["native:true", "native:false"]);
  });

  it("falls back to native full screen when simple full screen is missing", () => {
    const win = fakeWindow({ noSimple: true });
    enterEmuFullScreenMode(win, dispatch, true);
    expect(win.calls).toEqual(["native:true"]);
  });

  it("keeps a window that was already full screen full screen on the way out", () => {
    const win = fakeWindow({ fullScreen: true });
    toggleEmuFullScreenMode(win, dispatch, true);
    toggleEmuFullScreenMode(win, dispatch, true);
    expect(win.calls).toEqual([]);
    expect(win.isFullScreen()).toBe(true);
    expect(dispatched).toEqual([true, false]);
  });

  it("ends the mode when the window leaves native full screen another way", () => {
    const win = fakeWindow();
    enterEmuFullScreenMode(win, dispatch, false);
    onEmuWindowLeftFullScreen(dispatch);
    expect(isEmuFullScreenModeActive()).toBe(false);
    expect(dispatched).toEqual([true, false]);

    // --- The next toggle enters again; it does not try to leave a full screen that is gone
    toggleEmuFullScreenMode(win, dispatch, false);
    expect(isEmuFullScreenModeActive()).toBe(true);
  });

  it("ignores a full screen exit while the mode is off", () => {
    onEmuWindowLeftFullScreen(dispatch);
    exitEmuFullScreenMode(fakeWindow(), dispatch);
    expect(dispatched).toEqual([]);
  });

  it("does nothing without a live window", () => {
    enterEmuFullScreenMode(undefined, dispatch, true);
    enterEmuFullScreenMode({ ...fakeWindow(), isDestroyed: () => true }, dispatch, true);
    expect(isEmuFullScreenModeActive()).toBe(false);
    expect(dispatched).toEqual([]);
  });

  it("publishes the macOS menu bar's height, so the toolbar is revealed under it", () => {
    toggleEmuFullScreenMode(fakeWindow(), dispatch, true);
    expect(insets).toEqual([37]);
  });

  it("publishes no inset off macOS", () => {
    toggleEmuFullScreenMode(fakeWindow(), dispatch, false);
    expect(insets).toEqual([0]);
  });

  it("falls back to a plain menu bar's height when the display reserves none", () => {
    // --- The user set the menu bar to hide itself all the time
    display.workArea = { x: 0, y: 0, width: 1920, height: 1080 };
    expect(measureMacMenuBarHeight(fakeWindow())).toBe(MAC_MENU_BAR_FALLBACK_PT);
  });

  it("publishes the mode through the shared store", () => {
    const on = appStateFlagsReducer(
      {},
      { type: "SET_EMU_FULL_SCREEN_MODE", payload: { flag: true, topInset: 37 } }
    );
    expect(on.emuFullScreenMode).toBe(true);
    expect(on.emuFullScreenTopInset).toBe(37);
    const off = appStateFlagsReducer(on, { type: "SET_EMU_FULL_SCREEN_MODE", payload: { flag: false } });
    expect(off.emuFullScreenMode).toBe(false);
    expect(off.emuFullScreenTopInset).toBe(0);
  });
});
