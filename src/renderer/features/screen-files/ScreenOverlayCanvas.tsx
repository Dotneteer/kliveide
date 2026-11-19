import { memo, useLayoutEffect, useRef } from "react";

import styles from "./ScreenFileViewer.module.scss";

/*
 * The chrome over a screen file's picture (`dev/plans/SCREEN_FILE_VIEWERS_PLAN.md`, D3): the attribute
 * grid, bank outlines with their labels, the hover box and the pinned pixel, on **one** canvas, in the
 * `--color-screenfile-*` tokens read from the element, so the theme decides. The picture under it is
 * the machine's colours and never changes with the theme.
 */

/** A rectangle of picture pixels, inclusive */
export type ScreenRect = { x1: number; y1: number; x2: number; y2: number };

export type ScreenShape =
  /** Lines every `cellWidth` / `cellHeight` picture pixels */
  | { kind: "grid"; cellWidth: number; cellHeight: number }
  | { kind: "rect"; role: "bank" | "hover" | "pin"; rect: ScreenRect }
  | { kind: "label"; x: number; y: number; text: string };

const ROLE_TOKENS = {
  grid: "--color-screenfile-grid",
  bank: "--color-screenfile-bank",
  hover: "--color-screenfile-hover",
  pin: "--color-screenfile-pin",
  label: "--color-screenfile-label"
} as const;

export const ScreenOverlayCanvas = memo(
  ({
    shapes,
    width,
    height,
    zoomX,
    zoomY
  }: {
    shapes: ScreenShape[];
    /** The picture's size in picture pixels */
    width: number;
    height: number;
    zoomX: number;
    zoomY: number;
  }) => {
    const ref = useRef<HTMLCanvasElement | null>(null);
    const cssW = width * zoomX;
    const cssH = height * zoomY;
    useLayoutEffect(() => {
      const canvas = ref.current;
      const ctx = canvas?.getContext?.("2d");
      if (!canvas || !ctx) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssW * ratio);
      canvas.height = Math.round(cssH * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.clearRect(0, 0, cssW, cssH);
      const css = getComputedStyle(canvas);
      const colour = (role: keyof typeof ROLE_TOKENS) => css.getPropertyValue(ROLE_TOKENS[role]).trim() || "magenta";
      for (const s of shapes) {
        if (s.kind === "grid") {
          ctx.strokeStyle = colour("grid");
          ctx.globalAlpha = 0.6;
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let x = s.cellWidth; x < width; x += s.cellWidth) {
            ctx.moveTo(x * zoomX + 0.5, 0);
            ctx.lineTo(x * zoomX + 0.5, cssH);
          }
          for (let y = s.cellHeight; y < height; y += s.cellHeight) {
            ctx.moveTo(0, y * zoomY + 0.5);
            ctx.lineTo(cssW, y * zoomY + 0.5);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (s.kind === "rect") {
          // --- The pinned pixel is framed one pixel wider each way: a 2px stroke over a 1-pixel box
          // --- at a small zoom would hide the pixel it marks
          const pin = s.role === "pin";
          ctx.strokeStyle = colour(s.role);
          ctx.lineWidth = pin ? 2 : 1;
          ctx.globalAlpha = s.role === "bank" ? 0.8 : 1;
          const grow = pin ? 2 : 0;
          const inset = ctx.lineWidth / 2;
          ctx.strokeRect(
            s.rect.x1 * zoomX - grow + inset,
            s.rect.y1 * zoomY - grow + inset,
            Math.max(1, (s.rect.x2 - s.rect.x1 + 1) * zoomX + 2 * grow - ctx.lineWidth),
            Math.max(1, (s.rect.y2 - s.rect.y1 + 1) * zoomY + 2 * grow - ctx.lineWidth)
          );
          ctx.globalAlpha = 1;
        } else {
          const size = 11;
          ctx.font = `600 ${size}px ${css.getPropertyValue("--monospace-font").trim() || "monospace"}`;
          ctx.textBaseline = "top";
          const w = ctx.measureText(s.text).width + 6;
          ctx.globalAlpha = 0.8;
          ctx.fillStyle = css.getPropertyValue("--bgcolor-screenfile-label").trim() || "black";
          ctx.fillRect(s.x * zoomX + 3, s.y * zoomY + 3, w, size + 4);
          ctx.globalAlpha = 1;
          ctx.fillStyle = colour("label");
          ctx.fillText(s.text, s.x * zoomX + 6, s.y * zoomY + 5);
        }
      }
    }, [cssH, cssW, shapes, width, height, zoomX, zoomY]);
    return <canvas ref={ref} className={styles.overlay} style={{ width: cssW, height: cssH }} aria-hidden="true" />;
  }
);
