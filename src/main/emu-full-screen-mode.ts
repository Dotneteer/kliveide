/*
 * The emulator window's full screen mode (`dev/plans/EMU_FULL_SCREEN_MODE_PLAN.md`): the window fills
 * the screen and shows only the machine's picture and the virtual keyboard; the renderer slides the
 * toolbar and the status bar in at the screen edges.
 *
 * Main owns the mode. It makes the window full screen, publishes `emuFullScreenMode` through the
 * shared store, and puts the window back as it found it on the way out.
 *
 * On macOS the mode uses *simple* full screen (D2), so the window gets no Space and no title bar of its
 * own. A window that is already in native full screen when the mode starts (the green button was the
 * way in) stays native.
 *
 * Neither kind removes the macOS menu bar: it only auto-hides, and slides down when the pointer
 * reaches the top edge - exactly where the toolbar is revealed. So on macOS the mode publishes the
 * menu bar's height (`topInset`) and the renderer reveals the toolbar below it (§7, "The macOS menu
 * bar"). It is measured before the window goes full screen, while macOS still reserves the bar.
 */
import { screen } from "electron";
import { setEmuFullScreenModeAction } from "@state/actions";

/**
 * The menu bar's height when macOS cannot tell it: the user has set the menu bar to hide itself all
 * the time, so no display reserves room for it. 24 points is the menu bar of a Mac without a notch.
 */
export const MAC_MENU_BAR_FALLBACK_PT = 24;

/** The parts of a `BrowserWindow` this module uses: a fake one serves the tests */
export type FullScreenWindow = {
  isDestroyed(): boolean;
  getBounds?(): { x: number; y: number; width: number; height: number };
  isFullScreen(): boolean;
  setFullScreen(flag: boolean): void;
  isSimpleFullScreen?(): boolean;
  setSimpleFullScreen?(flag: boolean): void;
};

/** How the mode made the window full screen, so leaving it can undo exactly that */
type EntryKind = "none" | "native" | "simple";

type ModeState = {
  active: boolean;
  /** "none": the window was already full screen, and leaving the mode keeps it so */
  entry: EntryKind;
};

const state: ModeState = { active: false, entry: "none" };

/** Dispatches into the main store; replaced by the tests */
type Dispatch = (action: any) => void;

/** Whether the window fills the screen either way (native or macOS simple full screen) */
export function isAnyFullScreen(window: FullScreenWindow | null | undefined): boolean {
  if (!window || window.isDestroyed()) return false;
  return window.isFullScreen() || !!window.isSimpleFullScreen?.();
}

/**
 * The macOS menu bar's height on the window's display, in points: the room the display reserves at
 * its top (`workArea` against `bounds`). Call it before the window goes full screen.
 */
export function measureMacMenuBarHeight(window: FullScreenWindow): number {
  try {
    const display = screen.getDisplayMatching(window.getBounds());
    const reserved = display.workArea.y - display.bounds.y;
    return reserved > 0 ? reserved : MAC_MENU_BAR_FALLBACK_PT;
  } catch {
    return MAC_MENU_BAR_FALLBACK_PT;
  }
}

/** Whether the emulator window is in the full screen mode */
export function isEmuFullScreenModeActive(): boolean {
  return state.active;
}

/**
 * Enters the mode
 * @param window The emulator window
 * @param dispatch Dispatches into the main store
 * @param isMac Whether to use macOS simple full screen, and keep the toolbar below the menu bar
 * @param measureMenuBar Measures the macOS menu bar (the tests replace it)
 */
export function enterEmuFullScreenMode(
  window: FullScreenWindow | null | undefined,
  dispatch: Dispatch,
  isMac: boolean,
  measureMenuBar: (window: FullScreenWindow) => number = measureMacMenuBarHeight
): void {
  if (!window || window.isDestroyed() || state.active) return;
  const topInset = isMac ? measureMenuBar(window) : 0;
  if (isAnyFullScreen(window)) {
    state.entry = "none";
  } else if (isMac && window.setSimpleFullScreen) {
    window.setSimpleFullScreen(true);
    state.entry = "simple";
  } else {
    window.setFullScreen(true);
    state.entry = "native";
  }
  state.active = true;
  dispatch(setEmuFullScreenModeAction(true, topInset));
}

/**
 * Leaves the mode, and leaves full screen too unless the window was full screen before the mode
 * @param window The emulator window
 * @param dispatch Dispatches into the main store
 */
export function exitEmuFullScreenMode(
  window: FullScreenWindow | null | undefined,
  dispatch: Dispatch
): void {
  if (!state.active) return;
  const entry = state.entry;
  state.active = false;
  state.entry = "none";
  dispatch(setEmuFullScreenModeAction(false));
  if (!window || window.isDestroyed()) return;
  if (entry === "simple") window.setSimpleFullScreen?.(false);
  else if (entry === "native") window.setFullScreen(false);
}

/** View › Toggle Full Screen on the emulator window (D1) */
export function toggleEmuFullScreenMode(
  window: FullScreenWindow | null | undefined,
  dispatch: Dispatch,
  isMac: boolean,
  measureMenuBar?: (window: FullScreenWindow) => number
): void {
  if (state.active) exitEmuFullScreenMode(window, dispatch);
  else enterEmuFullScreenMode(window, dispatch, isMac, measureMenuBar);
}

/**
 * The window left native full screen by some other route (the green button, Ctrl+Cmd+F, the OS's
 * gesture): the mode ends with it, and the window is left where the user put it.
 */
export function onEmuWindowLeftFullScreen(dispatch: Dispatch): void {
  if (!state.active) return;
  state.active = false;
  state.entry = "none";
  dispatch(setEmuFullScreenModeAction(false));
}

/** Forgets the mode without touching a window: the emulator window is being destroyed */
export function resetEmuFullScreenMode(dispatch?: Dispatch): void {
  const wasActive = state.active;
  state.active = false;
  state.entry = "none";
  if (wasActive) dispatch?.(setEmuFullScreenModeAction(false));
}
