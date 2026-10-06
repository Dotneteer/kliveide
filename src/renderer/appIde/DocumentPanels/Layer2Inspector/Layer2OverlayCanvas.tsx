import { memo, useLayoutEffect, useRef } from "react";
import type { OverlayShape } from "@renderer/features/layer2/layer2ViewModel";
import styles from "./Layer2Inspector.module.scss";

/*
 * Paints the Layer 2 overlay shapes (`layer2ViewModel.layer2Overlay`) over an `IndexedImageCanvas`,
 * scaled by the zoom, in the `--color-layer2-*` tokens read from the element (so the theme decides).
 * One canvas for every overlay.
 */

const ROLE_TOKENS: Record<string, string> = {
  visible: "--color-layer2-visible",
  clip: "--color-layer2-clip",
  window: "--color-layer2-window",
  selected: "--color-layer2-selected",
  bank: "--color-layer2-bank",
  bankSelected: "--color-layer2-selected",
  outside: "--color-layer2-outside",
  label: "--color-layer2-label"
};

export const Layer2OverlayCanvas = memo(
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
      for (const s of shapes) {
        if (s.kind === "hatch") {
          // --- Outside RAM (T5): diagonal hatching, so it never reads as transparent pixels
          const x = s.rect.x1 * zoomX;
          const y = s.rect.y1 * zoomY;
          const w = (s.rect.x2 - s.rect.x1 + 1) * zoomX;
          const h = (s.rect.y2 - s.rect.y1 + 1) * zoomY;
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, w, h);
          ctx.clip();
          ctx.strokeStyle = colour("outside");
          ctx.lineWidth = 1;
          ctx.beginPath();
          for (let d = -h; d < w; d += 8) {
            ctx.moveTo(x + d, y + h);
            ctx.lineTo(x + d + h, y);
          }
          ctx.stroke();
          ctx.restore();
        } else if (s.kind === "rect") {
          ctx.strokeStyle = colour(s.role);
          ctx.lineWidth = s.role === "bank" ? 1 : 2;
          ctx.globalAlpha = s.role === "bank" ? 0.8 : 1;
          ctx.setLineDash(s.dashed ? [4, 3] : []);
          const inset = ctx.lineWidth / 2;
          ctx.strokeRect(
            s.rect.x1 * zoomX + inset,
            s.rect.y1 * zoomY + inset,
            Math.max(1, (s.rect.x2 - s.rect.x1 + 1) * zoomX - ctx.lineWidth),
            Math.max(1, (s.rect.y2 - s.rect.y1 + 1) * zoomY - ctx.lineWidth)
          );
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        } else {
          const size = Math.max(9, Math.floor(5 * zoomY));
          ctx.font = `${size}px ${css.getPropertyValue("--monospace-font").trim() || "monospace"}`;
          ctx.textBaseline = "top";
          const w = ctx.measureText(s.text).width + 4;
          ctx.globalAlpha = 0.75;
          ctx.fillStyle = css.getPropertyValue("--bgcolor-layer2-label").trim() || "black";
          ctx.fillRect(s.x * zoomX, s.y * zoomY, w, size + 2);
          ctx.globalAlpha = 1;
          ctx.fillStyle = colour("label");
          ctx.fillText(s.text, s.x * zoomX + 2, s.y * zoomY + 1);
        }
      }
    }, [cssH, cssW, shapes, zoomX, zoomY]);
    return <canvas ref={ref} className={styles.overlay} style={{ width: cssW, height: cssH }} aria-hidden="true" />;
  }
);
