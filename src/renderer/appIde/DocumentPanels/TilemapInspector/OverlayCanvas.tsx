import { memo, useLayoutEffect, useRef } from "react";
import type { OverlayShape } from "@renderer/features/tilemap/tilemapOverlay";
import styles from "./TilemapInspector.module.scss";

/*
 * Paints the overlay shapes (`tilemapOverlay.ts`) over an `IndexedImageCanvas`, scaled by the zoom,
 * in the `--color-tilemap-*` tokens read from the element (so the theme decides). One canvas for all
 * overlays, never an element per cell (T9).
 */

const ROLE_TOKENS: Record<string, string> = {
  grid: "--color-tilemap-grid",
  clip: "--color-tilemap-clip",
  visible: "--color-tilemap-visible",
  selected: "--color-tilemap-selected",
  user: "--color-tilemap-selected",
  changed: "--color-state-changed",
  index: "--color-tilemap-index"
};

export const OverlayCanvas = memo(
  ({
    shapes,
    width,
    height,
    zoomX,
    zoomY = zoomX
  }: {
    shapes: OverlayShape[];
    /** Image size in image pixels */
    width: number;
    height: number;
    zoomX: number;
    zoomY?: number;
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
      const colour = (role: string) => css.getPropertyValue(ROLE_TOKENS[role]).trim() || "magenta";
      const bg = css.getPropertyValue("--bgcolor-tilemap-index").trim() || "black";
      for (const s of shapes) {
        if (s.kind === "grid") {
          ctx.strokeStyle = colour("grid");
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.6;
          ctx.beginPath();
          for (let x = s.cellW; x < s.width; x += s.cellW) {
            ctx.moveTo(x * zoomX + 0.5, 0);
            ctx.lineTo(x * zoomX + 0.5, s.height * zoomY);
          }
          for (let y = s.cellH; y < s.height; y += s.cellH) {
            ctx.moveTo(0, y * zoomY + 0.5);
            ctx.lineTo(s.width * zoomX, y * zoomY + 0.5);
          }
          ctx.stroke();
          ctx.globalAlpha = 1;
        } else if (s.kind === "rect") {
          ctx.strokeStyle = colour(s.role);
          ctx.lineWidth = s.role === "user" ? 1 : 2;
          ctx.setLineDash(s.dashed ? [4, 3] : []);
          const inset = ctx.lineWidth / 2;
          ctx.strokeRect(
            s.rect.x1 * zoomX + inset,
            s.rect.y1 * zoomY + inset,
            (s.rect.x2 - s.rect.x1 + 1) * zoomX - ctx.lineWidth,
            (s.rect.y2 - s.rect.y1 + 1) * zoomY - ctx.lineWidth
          );
          ctx.setLineDash([]);
        } else if (s.kind === "dot") {
          ctx.fillStyle = colour("changed");
          ctx.beginPath();
          ctx.arc((s.x + 0.5) * zoomX, (s.y + 0.5) * zoomY, Math.max(2, zoomX), 0, Math.PI * 2);
          ctx.fill();
        } else {
          // --- A usage count is a small corner badge, so the tile stays visible under it
          const size = s.corner
            ? Math.max(7, Math.floor(2 * zoomY + 1))
            : Math.max(7, Math.floor(3 * zoomY));
          ctx.font = `${size}px ${css.getPropertyValue("--monospace-font").trim() || "monospace"}`;
          ctx.textBaseline = "top";
          const w = ctx.measureText(s.text).width + 2;
          const h = size + 1;
          const left = s.corner ? s.x * zoomX - w : s.x * zoomX;
          const top = s.corner ? s.y * zoomY - h : s.y * zoomY;
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = bg;
          ctx.fillRect(left, top, w, h);
          ctx.globalAlpha = 1;
          ctx.fillStyle = colour("index");
          ctx.fillText(s.text, left + 1, top + 1);
        }
      }
    }, [cssH, cssW, shapes, zoomX, zoomY]);
    return (
      <canvas
        ref={ref}
        className={styles.overlay}
        style={{ width: cssW, height: cssH }}
        aria-hidden="true"
      />
    );
  }
);
