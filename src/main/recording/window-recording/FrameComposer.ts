import type { Rect, WindowLayout } from "./layout";
import { placeInSlot } from "./layout";
import type { ClickVisual, MouseButton } from "./ClickTracker";
import type { Canvas, Rgb } from "./pointer";
import { drawPointer, drawRing } from "./pointer";

/**
 * Composes one video frame of the IDE + Emulator recording (plan §4.3, §4.4).
 *
 * Every buffer is BGRA. Each window's picture arrives already fitted to its slot (the frame source
 * scales it); the composer centres it in the slot, fills the rest, and draws the pointer and the
 * click rings on top.
 */

/** One window's picture, BGRA, `width * height * 4` bytes */
export type SourcePicture = { pixels: Uint8Array; width: number; height: number };

export type PointerOverlay = {
  /** Hot spot in video pixels */
  x: number;
  y: number;
  /** Video pixels per DIP (1 at 1x, the display scale factor at full resolution) */
  scale: number;
  /** The slot the pointer is in; it is clipped to it */
  clip: Rect;
  /** The click to draw under the arrow, if any */
  click?: ClickVisual;
};

export type ComposerColors = {
  /** The area not covered by either window */
  fill: Rgb;
  /** Left (and middle) button rings */
  primary: Rgb;
  /** Right button rings */
  secondary: Rgb;
};

/** Held-ring radius in DIP */
export const HELD_RADIUS = 14;
/** The ripple grows from HELD_RADIUS to this, in DIP */
export const RIPPLE_RADIUS = 28;

export class FrameComposer {
  constructor(
    readonly layout: WindowLayout,
    readonly colors: ComposerColors
  ) {}

  /** The number of bytes of one frame */
  get frameBytes(): number {
    return this.layout.width * this.layout.height * 4;
  }

  /** Where a picture of this size is drawn in the given slot */
  placement(picture: { width: number; height: number }, slot: Rect): Rect {
    return placeInSlot(picture, slot);
  }

  compose(
    out: Uint8Array,
    ide: SourcePicture | undefined,
    emu: SourcePicture | undefined,
    pointer?: PointerOverlay
  ): void {
    const { width, height } = this.layout;
    const fill = this.colors.fill;
    // --- BGRA in memory is the little-endian word 0xAARRGGBB
    const word = ((255 << 24) | (fill.r << 16) | (fill.g << 8) | fill.b) >>> 0;
    new Uint32Array(out.buffer, out.byteOffset, width * height).fill(word);

    if (ide) this._blit(out, ide, this.layout.ide);
    if (emu) this._blit(out, emu, this.layout.emu);
    if (pointer) this._drawPointer(out, pointer);
  }

  private _blit(out: Uint8Array, picture: SourcePicture, slot: Rect): void {
    const place = placeInSlot(picture, slot);
    const frameWidth = this.layout.width;
    // --- Clip to the slot (a picture never exceeds it, but stay safe) and to the frame
    const x0 = Math.max(place.x, slot.x, 0);
    const y0 = Math.max(place.y, slot.y, 0);
    const x1 = Math.min(place.x + picture.width, slot.x + slot.width, frameWidth);
    const y1 = Math.min(place.y + picture.height, slot.y + slot.height, this.layout.height);
    if (x1 <= x0 || y1 <= y0) return;
    const rowBytes = (x1 - x0) * 4;
    for (let y = y0; y < y1; y++) {
      const from = ((y - place.y) * picture.width + (x0 - place.x)) * 4;
      out.set(picture.pixels.subarray(from, from + rowBytes), (y * frameWidth + x0) * 4);
    }
  }

  private _ringColor(button: MouseButton): Rgb {
    return button === "right" ? this.colors.secondary : this.colors.primary;
  }

  private _drawPointer(out: Uint8Array, pointer: PointerOverlay): void {
    const canvas: Canvas = { pixels: out, width: this.layout.width, height: this.layout.height };
    const s = pointer.scale;
    const click = pointer.click;
    // --- Rings go under the arrow so the arrow stays sharp
    if (click?.ripple) {
      const p = click.ripple.progress;
      const radius = (HELD_RADIUS + (RIPPLE_RADIUS - HELD_RADIUS) * p) * s;
      drawRing(canvas, pointer.x, pointer.y, radius, 2.5 * s, this._ringColor(click.ripple.button), 0.9 * (1 - p), pointer.clip);
    }
    if (click?.held) {
      const color = this._ringColor(click.held);
      drawRing(canvas, pointer.x, pointer.y, HELD_RADIUS * s, HELD_RADIUS * s, color, 0.35, pointer.clip);
      drawRing(canvas, pointer.x, pointer.y, HELD_RADIUS * s, 2 * s, color, 0.9, pointer.clip);
    }
    drawPointer(canvas, Math.round(pointer.x), Math.round(pointer.y), s, pointer.clip);
  }
}
