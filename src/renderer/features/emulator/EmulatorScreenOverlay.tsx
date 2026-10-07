import { useCallback, useRef, type ReactNode } from "react";

import styles from "./EmulatorScreenOverlay.module.scss";

/*
 * Chrome over the emulator screen (`.plans/BEAM_POSITION_OVERLAY_PLAN.md` D10): shapes in the
 * picture's own buffer pixels, mapped onto the canvas by an SVG `viewBox` of the buffer's size.
 *
 * The overlay covers the canvas exactly, so the `viewBox` is the whole mapping: no zoom, resize or
 * aspect ratio can misplace a shape (T5), and `vector-effect: non-scaling-stroke` keeps every line one
 * screen pixel wide at any zoom. It never changes a pixel of the picture. Text cannot go in that SVG
 * (with `preserveAspectRatio="none"` the Next's half-width pixels would squash it), so labels are HTML
 * placed by percentage at their buffer position.
 *
 * Users: the beam position overlay, and the Next's clip-window outlines and pixel probe.
 */

/** A shape in buffer pixels; `className` comes from the user's stylesheet */
export type ScreenShape =
  | { kind: "rect"; x: number; y: number; width: number; height: number; className?: string; title?: string; fill?: string }
  | { kind: "line"; x1: number; y1: number; x2: number; y2: number; className?: string; title?: string };

/** A text label at a buffer position (its top-left corner, unless `align`/`place` say otherwise) */
export type ScreenLabel = {
  x: number;
  y: number;
  text: string;
  className?: string;
  /** "end": the label's right edge at x */
  align?: "start" | "end";
  /** "above": the label's bottom edge at y */
  place?: "below" | "above";
  testId?: string;
};

/** The pointer over the screen: its buffer pixel, and its position in the overlay for a tooltip */
export type ScreenPointer = { x: number; y: number; left: number; top: number; flip: boolean };

type Props = {
  /** The picture's size in buffer pixels: the SVG's coordinate space */
  screenWidth: number;
  screenHeight: number;
  shapes?: ScreenShape[];
  labels?: ScreenLabel[];
  /** SVG `<defs>` the shapes refer to (patterns) */
  defs?: ReactNode;
  /** Takes the pointer: the overlay then receives mouse events instead of letting them through */
  onPointer?: (pointer: ScreenPointer | undefined) => void;
  onClick?: () => void;
  className?: string;
  testId?: string;
  svgTestId?: string;
  /** Tooltips, positioned by the user from `ScreenPointer.left`/`top` */
  children?: ReactNode;
};

/** The buffer pixel under a client position, or undefined outside the picture */
export function pointerToBuffer(
  rect: { left: number; top: number; width: number; height: number },
  clientX: number,
  clientY: number,
  screenWidth: number,
  screenHeight: number
): ScreenPointer | undefined {
  if (!(rect.width > 0) || !(rect.height > 0)) return undefined;
  const left = clientX - rect.left;
  const top = clientY - rect.top;
  const x = Math.floor((left / rect.width) * screenWidth);
  const y = Math.floor((top / rect.height) * screenHeight);
  if (x < 0 || y < 0 || x >= screenWidth || y >= screenHeight) return undefined;
  return { x, y, left, top, flip: left > rect.width / 2 };
}

export const EmulatorScreenOverlay = ({
  screenWidth,
  screenHeight,
  shapes = [],
  labels = [],
  defs,
  onPointer,
  onClick,
  className,
  testId,
  svgTestId,
  children
}: Props) => {
  const host = useRef<HTMLDivElement>(null);
  const onMove = useCallback(
    (e: React.MouseEvent) => {
      const el = host.current;
      if (!el || !onPointer) return;
      onPointer(pointerToBuffer(el.getBoundingClientRect(), e.clientX, e.clientY, screenWidth, screenHeight));
    },
    [onPointer, screenWidth, screenHeight]
  );
  const interactive = !!onPointer || !!onClick;
  return (
    <div
      ref={host}
      className={[styles.overlay, interactive ? styles.interactive : "", className ?? ""].filter(Boolean).join(" ")}
      onMouseMove={onPointer ? onMove : undefined}
      onMouseLeave={onPointer ? () => onPointer(undefined) : undefined}
      onClick={onClick}
      data-testid={testId}
    >
      {(shapes.length > 0 || defs) && (
        <svg
          className={styles.shapes}
          viewBox={`0 0 ${screenWidth} ${screenHeight}`}
          preserveAspectRatio="none"
          data-testid={svgTestId}
        >
          {defs && <defs>{defs}</defs>}
          {shapes.map((s, i) =>
            s.kind === "rect" ? (
              <rect
                key={i}
                className={s.className}
                x={s.x}
                y={s.y}
                width={Math.max(0, s.width)}
                height={Math.max(0, s.height)}
                fill={s.fill}
                vectorEffect="non-scaling-stroke"
              >
                {s.title && <title>{s.title}</title>}
              </rect>
            ) : (
              <line
                key={i}
                className={s.className}
                x1={s.x1}
                y1={s.y1}
                x2={s.x2}
                y2={s.y2}
                vectorEffect="non-scaling-stroke"
              >
                {s.title && <title>{s.title}</title>}
              </line>
            )
          )}
        </svg>
      )}
      {labels.map((l, i) => (
        <span
          key={i}
          className={[styles.label, l.className ?? ""].filter(Boolean).join(" ")}
          style={{
            left: l.align === "end" ? undefined : `${(l.x / screenWidth) * 100}%`,
            right: l.align === "end" ? `${100 - (l.x / screenWidth) * 100}%` : undefined,
            top: l.place === "above" ? undefined : `${(l.y / screenHeight) * 100}%`,
            bottom: l.place === "above" ? `${100 - (l.y / screenHeight) * 100}%` : undefined
          }}
          data-testid={l.testId}
        >
          {l.text}
        </span>
      ))}
      {children}
    </div>
  );
};
