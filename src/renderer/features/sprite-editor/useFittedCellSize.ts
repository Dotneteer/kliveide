import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { useResizeObserver } from "@renderer/core/useResizeObserver";
import { SPRITE_DIM } from "./sprite-raster";

/**
 * How big one sprite pixel is drawn, in screen pixels.
 *
 * The editor used to compute this as `(zoomFactor - 1) * 8 + 16` with `zoomFactor` clamped to 1..3,
 * so the canvas was 257, 385 or 513 px **whatever the pane was**. That is the single thing that
 * made the editor feel unfinished: it got *emptier* as the window got bigger rather than more
 * useful, and at 513px it still left several hundred pixels of empty panel beside it.
 *
 * Two rules here are worth keeping:
 *
 * - **Integer cell sizes only.** A sprite editor is a picture of a pixel grid; a fractional cell
 *   puts every cell edge and every hairline off the device pixel grid and the whole thing goes
 *   faintly soft. This is the same lesson `NextPaletteViewer` learned when its `1fr` columns
 *   produced 13.9px swatches.
 * - **Fit is a mode, not a one-off calculation.** Once the user picks a zoom the pane must stop
 *   moving the canvas under them, so an explicit zoom pins it until they ask to fit again.
 */

/** Below 3px a sprite pixel is not something you can aim at; above 64 a 16x16 sprite is absurd. */
export const MIN_CELL = 3;
export const MAX_CELL = 64;

/** Discrete steps for the zoom buttons. Fit may land on any integer between them. */
const ZOOM_STEPS = [3, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64];

export const clampCell = (value: number): number =>
  Number.isFinite(value) ? Math.min(MAX_CELL, Math.max(MIN_CELL, Math.round(value))) : 16;

export const nextZoomStep = (cell: number): number =>
  ZOOM_STEPS.find((s) => s > cell) ?? MAX_CELL;

export const prevZoomStep = (cell: number): number =>
  [...ZOOM_STEPS].reverse().find((s) => s < cell) ?? MIN_CELL;

/**
 * Translate a persisted `zoomFactor` into a cell size.
 *
 * The old view state stored 1, 2 or 3. Those values are indistinguishable from a (silly but legal)
 * new-style cell size, so they are migrated by range: anything at or below the old maximum is a
 * legacy factor and maps through the old formula.
 */
export const cellSizeFromLegacyZoom = (zoomFactor: number | undefined): number | undefined => {
  if (zoomFactor === undefined || !Number.isFinite(zoomFactor)) return undefined;
  return zoomFactor <= 3 ? (Math.max(1, Math.round(zoomFactor)) - 1) * 8 + 16 : clampCell(zoomFactor);
};

type Options = {
  /**
   * Extra space the rulers take, in px.
   *
   * Two numbers rather than a tuple: an options object is rebuilt on every render, so a tuple makes
   * the measure callback's dependencies a pair of index expressions the lint rule cannot check -
   * and which are only *accidentally* stable.
   */
  gutterX?: number;
  gutterY?: number;
};

export type FittedCellSize = {
  /** Attach to the element the canvas has to fit inside. */
  containerRef: React.MutableRefObject<HTMLDivElement | null>;
  /** The cell size to draw with. */
  cellSize: number;
  fitToPane: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
};

export function useFittedCellSize(
  initialCell: number,
  initialFit: boolean,
  onChange: (cell: number, fitToPane: boolean) => void,
  { gutterX = 0, gutterY = 0 }: Options = {}
): FittedCellSize {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [manualCell, setManualCell] = useState(clampCell(initialCell));
  const [fitToPane, setFitToPane] = useState(initialFit);
  const [fittedCell, setFittedCell] = useState(clampCell(initialCell));

  const measure = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const padX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
    const padY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    const available = Math.min(
      el.clientWidth - padX - gutterX,
      el.clientHeight - padY - gutterY
    );
    const next = clampCell(Math.floor(available / SPRITE_DIM));
    setFittedCell((current) => (current === next ? current : next));
  }, [gutterX, gutterY]);

  useLayoutEffect(measure, [measure]);
  useResizeObserver(containerRef, measure);

  const cellSize = fitToPane ? fittedCell : manualCell;

  const apply = useCallback(
    (cell: number, fit: boolean) => {
      setManualCell(cell);
      setFitToPane(fit);
      onChange(cell, fit);
    },
    [onChange]
  );

  return {
    containerRef,
    cellSize,
    fitToPane,
    // Zooming from "fit" starts at whatever fit currently shows, so the first click is a step from
    // what the user can see rather than a jump back to some remembered value.
    zoomIn: () => apply(nextZoomStep(cellSize), false),
    zoomOut: () => apply(prevZoomStep(cellSize), false),
    fit: () => {
      setFitToPane(true);
      onChange(fittedCell, true);
    },
    canZoomIn: cellSize < MAX_CELL,
    canZoomOut: cellSize > MIN_CELL
  };
}
