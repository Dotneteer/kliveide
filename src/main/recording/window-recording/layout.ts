/**
 * Layout of the IDE + Emulator recording: where each window's picture goes in the video.
 *
 * The two windows are composed side by side in the chosen arrangement, whatever their real positions
 * on the screen. The video is the bounding rectangle of that arrangement; the shorter (or narrower)
 * window is centred along the shared side. See `.plans/IDE_EMU_RECORDING_PLAN.md` §4.3.
 */

import type { RecordingIdePosition } from "@common/state/AppState";

/** Where the IDE window goes relative to the emulator window */
export type IdePosition = RecordingIdePosition;

export const IDE_POSITIONS: readonly IdePosition[] = ["left", "right", "top", "bottom"];

export type Size = { width: number; height: number };

export type Rect = { x: number; y: number; width: number; height: number };

export type WindowLayout = {
  /** Video width in pixels (even) */
  width: number;
  /** Video height in pixels (even) */
  height: number;
  /** The slot reserved for the IDE picture */
  ide: Rect;
  /** The slot reserved for the emulator picture */
  emu: Rect;
};

/** Rounds up to the next even integer (the encoders need even dimensions) */
export function evenUp(value: number): number {
  const n = Math.max(2, Math.ceil(value));
  return n % 2 === 0 ? n : n + 1;
}

function whole(size: Size): Size {
  return { width: Math.max(1, Math.round(size.width)), height: Math.max(1, Math.round(size.height)) };
}

/**
 * Computes the video size and the slot of each window.
 * @param ideSize The IDE picture size in video pixels
 * @param emuSize The emulator picture size in video pixels
 * @param position Where the IDE goes relative to the emulator
 */
export function computeLayout(ideSize: Size, emuSize: Size, position: IdePosition): WindowLayout {
  const ide = whole(ideSize);
  const emu = whole(emuSize);
  const horizontal = position === "left" || position === "right";

  if (horizontal) {
    const width = evenUp(ide.width + emu.width);
    const height = evenUp(Math.max(ide.height, emu.height));
    const ideX = position === "left" ? 0 : emu.width;
    const emuX = position === "left" ? ide.width : 0;
    return {
      width,
      height,
      ide: { x: ideX, y: Math.floor((height - ide.height) / 2), ...ide },
      emu: { x: emuX, y: Math.floor((height - emu.height) / 2), ...emu }
    };
  }

  const width = evenUp(Math.max(ide.width, emu.width));
  const height = evenUp(ide.height + emu.height);
  const ideY = position === "top" ? 0 : emu.height;
  const emuY = position === "top" ? ide.height : 0;
  return {
    width,
    height,
    ide: { x: Math.floor((width - ide.width) / 2), y: ideY, ...ide },
    emu: { x: Math.floor((width - emu.width) / 2), y: emuY, ...emu }
  };
}

/**
 * The largest size with the source's aspect ratio that fits the slot. A window resized while
 * recording is scaled into the slot reserved for it at start (D10).
 */
export function fitSize(source: Size, slot: Size): Size {
  if (source.width <= 0 || source.height <= 0) return { width: 0, height: 0 };
  if (source.width === slot.width && source.height === slot.height) return { ...source };
  const scale = Math.min(slot.width / source.width, slot.height / source.height);
  return {
    width: Math.max(1, Math.min(slot.width, Math.round(source.width * scale))),
    height: Math.max(1, Math.min(slot.height, Math.round(source.height * scale)))
  };
}

/** Where a picture of the given size is drawn inside its slot: centred */
export function placeInSlot(picture: Size, slot: Rect): Rect {
  return {
    x: slot.x + Math.floor((slot.width - picture.width) / 2),
    y: slot.y + Math.floor((slot.height - picture.height) / 2),
    width: picture.width,
    height: picture.height
  };
}
