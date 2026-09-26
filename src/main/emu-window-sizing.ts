import { screen, type BrowserWindow } from "electron";
import {
  type EmuContentSizeHints,
  type Rectangle,
  type Size,
  emuWindowSizeForContent,
  isValidSize,
  placeWithinWorkArea,
  sameSize
} from "@common/utils/emu-window-size";

/**
 * Sizes the emulator window from what its renderer reports (issue #1377).
 * See `common/utils/emu-window-size.ts` for what the hints are.
 */

/** Where each machine's window size is kept: window (outer) sizes, in DIPs, keyed by machine ID */
export type EmuMachineSizeStore = {
  load(machineId: string): Size | undefined;
  save(machineId: string, size: Size): void;
};

type WindowSizingState = {
  hints?: EmuContentSizeHints;
  machineId?: string;
};

const states = new WeakMap<BrowserWindow, WindowSizingState>();

function stateOf(window: BrowserWindow): WindowSizingState {
  let state = states.get(window);
  if (!state) {
    state = {};
    states.set(window, state);
  }
  return state;
}

/** The window size that gives `content` CSS pixels of content in this window */
function outerSizeFor(window: BrowserWindow, content: Size): Size {
  const [outerWidth, outerHeight] = window.getSize();
  const [contentWidth, contentHeight] = window.getContentSize();
  return emuWindowSizeForContent(content, window.webContents.getZoomFactor(), {
    width: outerWidth - contentWidth,
    height: outerHeight - contentHeight
  });
}

/** Resizes the window, keeping its top-left corner unless that would push it off the screen */
function resizeWithinScreen(window: BrowserWindow, size: Size): void {
  const bounds = window.getBounds();
  if (bounds.width === size.width && bounds.height === size.height) return;
  const target: Rectangle = { x: bounds.x, y: bounds.y, ...size };
  window.setBounds(placeWithinWorkArea(target, screen.getDisplayMatching(target).workArea));
}

/**
 * Applies the size hints the emulator renderer reported.
 *
 * - The minimum size becomes the window's minimum (the picture at 1x).
 * - When the hints name a different machine than the last ones, the machine was switched: the
 *   window's size is saved for the old machine, and the new machine's saved size (if any) is
 *   restored. A maximized or full-screen window is left at its size; its normal size is saved.
 * - A window smaller than the minimum is grown to it: Electron sets a minimum, but does not resize
 *   a window already below it.
 */
export function applyEmuContentSizeHints(
  window: BrowserWindow | null | undefined,
  hints: EmuContentSizeHints,
  store?: EmuMachineSizeStore
): void {
  if (!window || window.isDestroyed()) return;
  if (!hints || !isValidSize(hints.minimum) || !isValidSize(hints.fit)) return;

  const state = stateOf(window);
  const machineId = hints.machineId || undefined;
  const switched = !!state.machineId && !!machineId && machineId !== state.machineId;
  if (switched && store) {
    const normal = window.getNormalBounds();
    store.save(state.machineId, { width: normal.width, height: normal.height });
  }
  state.hints = hints;
  state.machineId = machineId ?? state.machineId;

  const minimum = outerSizeFor(window, hints.minimum);
  window.setMinimumSize(minimum.width, minimum.height);
  if (window.isMaximized() || window.isFullScreen()) return;

  const [width, height] = window.getSize();
  let target: Size = { width, height };
  if (switched && store) {
    const saved = store.load(machineId);
    if (isValidSize(saved)) target = { width: saved.width, height: saved.height };
  }
  target = {
    width: Math.max(target.width, minimum.width),
    height: Math.max(target.height, minimum.height)
  };
  if (!sameSize(target, { width, height })) resizeWithinScreen(window, target);
}

/** Whether View | Fit Window to Screen can act on the window */
export function canFitEmuWindowToScreen(window: BrowserWindow | null | undefined): boolean {
  if (!window || window.isDestroyed() || window.isFullScreen()) return false;
  return !!states.get(window)?.hints;
}

/**
 * View | Fit Window to Screen: sizes the window to hold the picture at its current zoom step,
 * with no slack around it.
 *
 * View | Fit Window to Screen at 1x (`scale: "1x"`) sizes it to the picture at 1x instead, the
 * most compact window for the machine: a Z88 hugs its LCD.
 */
export function fitEmuWindowToScreen(
  window: BrowserWindow | null | undefined,
  scale: "current" | "1x" = "current"
): void {
  if (!canFitEmuWindowToScreen(window)) return;
  const hints = states.get(window).hints;
  if (window.isMaximized()) window.unmaximize();
  resizeWithinScreen(window, outerSizeFor(window, scale === "1x" ? hints.minimum : hints.fit));
}

/** The machine the window's last size hints were for */
export function getEmuWindowMachineId(window: BrowserWindow | null | undefined): string | undefined {
  return window ? states.get(window)?.machineId : undefined;
}
