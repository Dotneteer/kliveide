import classnames from "classnames";
import { memo, type MouseEvent, type ReactNode, useLayoutEffect, useRef } from "react";
import styles from "./IndexedImageCanvas.module.scss";

/*
 * An indexed-colour image (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.6, T9): palette indices drawn into
 * **one** `ImageData`, scaled by CSS with `image-rendering: pixelated`, with a checkerboard behind
 * transparent pixels and a slot for overlays sized to the scaled image. The Tilemap Inspector's map,
 * tile sheet and tile previews use it; a Layer 2 or layer-composition view can.
 *
 * Transparent pixels are left transparent in the canvas when the checker is on, so the checkerboard
 * is the element's CSS background and stays crisp at any zoom. With it off they are painted
 * `transparentAbgr`.
 */

/** The value of a pixel nothing is drawn at */
export const INDEXED_TRANSPARENT = -1;

export type IndexedImageCanvasProps = {
  /** Palette indices, row by row; `INDEXED_TRANSPARENT` (-1) where transparent */
  pixels: Int16Array;
  width: number;
  height: number;
  /** 256 ABGR words (`toAbgrTable`) */
  abgr: Uint32Array;
  transparentAbgr: number;
  checker: boolean;
  /** CSS pixels per image pixel, per axis */
  zoomX: number;
  zoomY?: number;
  /** Pixels drawn at reduced alpha (1 = dimmed), the same length as `pixels` */
  dim?: Uint8Array;
  className?: string;
  ariaLabel?: string;
  /** Overlays, absolutely positioned over the image */
  children?: ReactNode;
  /** Pointer handlers receive the image pixel under the pointer */
  onPixelMove?: (x: number, y: number, event: MouseEvent<HTMLElement>) => void;
  onPixelClick?: (x: number, y: number, event: MouseEvent<HTMLElement>) => void;
  onPixelContextMenu?: (x: number, y: number, event: MouseEvent<HTMLElement>) => void;
  onLeave?: () => void;
};

/** The image pixel under a mouse event on an element showing an image scaled by `zoomX`/`zoomY`. */
export function pixelAt(event: MouseEvent<HTMLElement>, zoomX: number, zoomY: number): { x: number; y: number } {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: Math.floor((event.clientX - rect.left) / zoomX), y: Math.floor((event.clientY - rect.top) / zoomY) };
}

/** Fills an ABGR buffer from palette indices (pure; exported for tests). */
export function fillAbgr(
  out: Uint32Array,
  pixels: Int16Array,
  abgr: Uint32Array,
  transparentAbgr: number,
  checker: boolean,
  dim?: Uint8Array
): void {
  for (let p = 0; p < pixels.length; p++) {
    const value = pixels[p];
    let word = value < 0 ? (checker ? 0 : transparentAbgr) : abgr[value & 0xff];
    // --- Dimmed: a third of the alpha, so the checker or the surface shows through
    if (dim?.[p] && word !== 0) word = ((word & 0x00ffffff) | 0x50000000) >>> 0;
    out[p] = word;
  }
}

export const IndexedImageCanvas = memo(
  ({
    pixels,
    width,
    height,
    abgr,
    transparentAbgr,
    checker,
    zoomX,
    zoomY = zoomX,
    dim,
    className,
    ariaLabel,
    children,
    onPixelMove,
    onPixelClick,
    onPixelContextMenu,
    onLeave
  }: IndexedImageCanvasProps) => {
    const ref = useRef<HTMLCanvasElement | null>(null);
    useLayoutEffect(() => {
      const context = ref.current?.getContext?.("2d");
      if (!context || width <= 0 || height <= 0) return;
      const image = context.createImageData(width, height);
      fillAbgr(new Uint32Array(image.data.buffer), pixels, abgr, transparentAbgr, checker, dim);
      context.putImageData(image, 0, 0);
    }, [abgr, checker, dim, height, pixels, transparentAbgr, width]);

    const handler =
      (fn?: (x: number, y: number, event: MouseEvent<HTMLElement>) => void) => (event: MouseEvent<HTMLElement>) => {
        if (!fn) return;
        const { x, y } = pixelAt(event, zoomX, zoomY);
        if (x >= 0 && y >= 0 && x < width && y < height) fn(x, y, event);
      };

    return (
      <div
        className={classnames(styles.frame, className)}
        style={{ width: width * zoomX, height: height * zoomY }}
        onMouseMove={handler(onPixelMove)}
        onClick={handler(onPixelClick)}
        onContextMenu={handler(onPixelContextMenu)}
        onMouseLeave={onLeave}
      >
        <canvas
          ref={ref}
          width={width}
          height={height}
          aria-label={ariaLabel}
          role={ariaLabel ? "img" : undefined}
          className={classnames(styles.canvas, { [styles.checker]: checker })}
        />
        {children}
      </div>
    );
  }
);
