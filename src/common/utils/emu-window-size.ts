/**
 * The emulator window's size (issue #1377).
 *
 * The window used to be held at 640x480 for every machine. That is far taller than a Cambridge
 * Z88 needs: its LCD is 640x64, so the window could not be made to hug the picture. The renderer
 * now measures what the current machine needs and reports it as "content size hints". The main
 * process uses them for three things:
 *
 * - the window's minimum size (the picture at 1x),
 * - View | Fit Window to Screen (the picture at its current zoom step, with no slack around it),
 * - restoring each machine's own window size when the machine changes.
 */

export type Size = { width: number; height: number };

export type Rectangle = { x: number; y: number; width: number; height: number };

/**
 * What the emulator renderer reports about the window content it needs, in CSS pixels.
 */
export type EmuContentSizeHints = {
  /** The machine these sizes are for; a change means the machine was switched */
  machineId?: string;
  /** The smallest content in which the picture fits at 1x */
  minimum: Size;
  /** The content that holds the picture at its current zoom step, with no slack around it */
  fit: Size;
};

/**
 * The narrowest the emulator window's content may get, in CSS pixels, whatever the machine.
 *
 * The toolbar needs roughly this much, and it was the old fixed minimum width, so no machine's
 * window gets narrower than it could before.
 */
export const EMU_MIN_CONTENT_WIDTH = 640;

/**
 * The window's minimum height until the renderer has measured the machine's needs.
 * It is deliberately low so a small saved window (a compact Z88) is not stretched at startup.
 */
export const EMU_INITIAL_MIN_HEIGHT = 200;

/**
 * The content size, in CSS pixels, that holds a picture of the given size and nothing more.
 *
 * Everything in the window that is not room for the picture (the toolbar, status bar, virtual
 * keyboard, panel padding, the Z88 slot-card strip, the display's bezel) is measured, not assumed.
 * It is the viewport minus the space currently available to the picture. That keeps this right
 * whichever bars are shown, and when any of them changes size.
 *
 * @param viewport The renderer's viewport (`window.innerWidth`/`innerHeight`)
 * @param available The room the picture itself has now, with bezel and surround already taken off
 * @param picture The picture's size to make room for, aspect ratio applied
 * @param minWidth Content no narrower than this
 */
export function emuContentSizeForPicture(
  viewport: Size,
  available: Size,
  picture: Size,
  minWidth = EMU_MIN_CONTENT_WIDTH
): Size {
  return {
    width: Math.max(minWidth, Math.ceil(viewport.width - available.width + picture.width)),
    height: Math.max(1, Math.ceil(viewport.height - available.height + picture.height))
  };
}

/**
 * The window size that gives `content` CSS pixels of content.
 *
 * @param content The content size, in CSS pixels
 * @param zoomFactor The page zoom of the window's web contents; a CSS pixel is this many DIPs
 * @param frame How much larger the window is than its content area (title bar, borders), in DIPs
 */
export function emuWindowSizeForContent(content: Size, zoomFactor: number, frame: Size): Size {
  const zoom = Number.isFinite(zoomFactor) && zoomFactor > 0 ? zoomFactor : 1;
  return {
    width: Math.ceil(content.width * zoom) + Math.max(0, frame.width),
    height: Math.ceil(content.height * zoom) + Math.max(0, frame.height)
  };
}

/**
 * Moves `bounds` so that it lies within `workArea`, shrinking it only if it cannot fit.
 * A window grown or restored to another machine's size must not end up below the screen's edge.
 */
export function placeWithinWorkArea(bounds: Rectangle, workArea: Rectangle): Rectangle {
  const width = Math.min(bounds.width, workArea.width);
  const height = Math.min(bounds.height, workArea.height);
  return {
    x: Math.min(Math.max(bounds.x, workArea.x), workArea.x + workArea.width - width),
    y: Math.min(Math.max(bounds.y, workArea.y), workArea.y + workArea.height - height),
    width,
    height
  };
}

/** Whether `size` is a usable size: finite and positive on both axes */
export function isValidSize(size: Size | undefined | null): size is Size {
  return (
    !!size &&
    Number.isFinite(size.width) &&
    Number.isFinite(size.height) &&
    size.width > 0 &&
    size.height > 0
  );
}

/** Whether two sizes are the same */
export function sameSize(a: Size | undefined | null, b: Size | undefined | null): boolean {
  return !!a && !!b && a.width === b.width && a.height === b.height;
}
