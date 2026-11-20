import styles from "./NextPaletteViewer.module.scss";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import {
  getCssStringForPaletteCode,
  getLuminanceForPaletteCode,
  getRgbPartsForPaletteCode
} from "@emu/machines/zxNext/palette";
import { Tooltip } from "./Tooltip";
import { useCallback, useEffect, useMemo, useRef, useState, memo } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import { KeyHandler } from "./generic/KeyHandler";
import classnames from "classnames";
import { useT } from "@common/i18n/useT";

/** A Next palette is always 16x16. */
const COLUMNS = 16;
const ROWS = 16;

const INDEXES = Array.from({ length: COLUMNS }, (_, i) => i);

/**
 * How long the pointer must rest on a swatch before the readout appears.
 *
 * Much shorter than the app's 800ms default, and deliberately: a palette is *scanned*, not read.
 * The whole reason to hover here is to answer "which index is that one", and at 800ms the answer
 * arrives after the eye has already moved on. Short enough to feel like a readout, long enough that
 * dragging across the grid does not strobe.
 */
const HOVER_DELAY = 220;

/**
 * The swatch size a caller gets without asking.
 *
 * 14px is the sidebar's size, chosen against 12 and 16 in a prototype: 12 is too small to pick a
 * colour by eye, and 16 needs ~295px of sidebar before the grid has to start shrinking. 14 makes a
 * 237px grid, which fits any sidebar from ~255px up — and it is also what the fluid grid happened
 * to render at the default sidebar width, so nothing moved for anyone who had not dragged it.
 */
const DEFAULT_CELL_SIZE = 14;

type Props = {
  /**
   * The 256 palette entries, in the **register** layout — `RRRGGGBB` with the low blue bit in bit 8,
   * and optionally the priority flag in bit 15. See the layout note at the top of
   * `@emu/machines/zxNext/palette`; a caller holding device-stored values converts with
   * `paletteCodeFromDeviceValue` first.
   */
  palette: number[];
  /**
   * The size of one swatch, in **whole** pixels.
   *
   * The grid is sized from this rather than from its container. Fluid `1fr` columns were the first
   * attempt and they were wrong twice: dragging the sidebar swung the cells from 13.9px to 30.2px —
   * a 2.2x change from resizing chrome, which a reference image should not do — and every one of
   * those widths was fractional, so cell edges and the quadrant rules landed off the pixel grid and
   * the mosaic was faintly soft at *every* size. Pinning the cell fixes both: the grid is the same
   * size whatever the panel does, and it is crisp.
   *
   * Below its own width the grid still shrinks rather than clipping or scrolling — see the
   * `width`/`max-width` pair in the stylesheet. That reintroduces fractional cells, but only on a
   * container narrower than the grid, and degrading beats the clipping the original viewer did.
   */
  cellSize?: number;
  /**
   * Show only rows `firstRow` .. `firstRow + rowCount - 1` (both default to the whole palette).
   *
   * The sprite editor's 4-bit sheets can use one row - the 16 entries of their palette offset - so
   * it shows only that row. Indexes stay absolute: the swatches keep their real labels, and
   * `selectedIndex`, `transparencyIndex` and the callbacks speak in palette indexes as before.
   * The arrow keys stay inside the visible rows.
   */
  firstRow?: number;
  rowCount?: number;
  usePriority?: boolean;
  transparencyIndex?: number;
  /**
   * More entries drawn transparent, beside `transparencyIndex`: the ULA and Layer 2 compare a colour
   * with Next Reg $14, so any number of entries can match.
   */
  transparentIndexes?: ReadonlySet<number>;
  /**
   * The Palette document's marks (`dev/plans/NEXT_PALETTE_DEBUGGING_PLAN.md` §4): entries written
   * since the last stop get a ring, with their colour at that stop (register layout) in a corner
   * when it is known; entries a `pal:` breakpoint watches get a dot (`true` when one is enabled).
   */
  writtenIndexes?: ReadonlySet<number>;
  previousCodes?: ReadonlyMap<number, number>;
  watchedIndexes?: ReadonlyMap<number, boolean>;
  allowSelection?: boolean;
  onSelection?: (index: number) => void;
  /** A right click on a swatch; the event places a context menu */
  onRightClick?: (index: number, e: ReactMouseEvent) => void;
  selectedIndex?: number;
  onPriority?: (index: number) => void;
  onOtherKey?: (code: string) => void;
};

export const NextPaletteViewer = ({
  palette,
  cellSize = DEFAULT_CELL_SIZE,
  firstRow = 0,
  rowCount = ROWS,
  usePriority = false,
  transparencyIndex,
  transparentIndexes,
  writtenIndexes,
  previousCodes,
  watchedIndexes,
  allowSelection,
  onSelection,
  onRightClick,
  onPriority,
  onOtherKey,
  selectedIndex
}: Props) => {
  const t = useT();
  const [selected, setSelected] = useState<number>();
  // --- The visible rows, kept inside the palette
  const rowStart = Math.min(ROWS - 1, Math.max(0, Math.floor(firstRow)));
  const rows = Math.min(ROWS - rowStart, Math.max(1, Math.floor(rowCount)));
  const visibleRows = useMemo(() => Array.from({ length: rows }, (_, i) => rowStart + i), [rowStart, rows]);
  const firstVisible = rowStart * COLUMNS;
  const visibleSize = rows * COLUMNS;

  /*
   * One tooltip for the whole grid, not one per swatch.
   *
   * The previous shape mounted a `TooltipFactory` inside every cell: 256 popper instances per
   * palette, each with its own listeners and its own portal — and the sidebar panel drew eight
   * palettes, so 2048 of them, rebuilt whenever the emulator state poll returned. The readout is
   * single-tenant by nature (one pointer, one cell), so a single instance positioned against the
   * hovered element does the same job for 1/256th of the machinery.
   *
   * It is driven through `isShown` rather than `Tooltip`'s own mouse listeners, because those
   * attach on the effect *after* the element becomes the anchor — i.e. after the `mouseenter` that
   * would have started them has already fired.
   */
  const [hovered, setHovered] = useState<{ el: HTMLElement; index: number } | null>(null);
  const [tipShown, setTipShown] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>();

  const clearHoverTimer = () => {
    if (hoverTimer.current !== undefined) {
      clearTimeout(hoverTimer.current);
      hoverTimer.current = undefined;
    }
  };

  useEffect(() => clearHoverTimer, []);

  const handleEnter = useCallback((el: HTMLElement, index: number) => {
    clearHoverTimer();
    setHovered({ el, index });
    setTipShown(false);
    hoverTimer.current = setTimeout(() => setTipShown(true), HOVER_DELAY);
  }, []);

  const handleLeave = useCallback(() => {
    clearHoverTimer();
    setHovered(null);
    setTipShown(false);
  }, []);

  useEffect(() => {
    setSelected(selectedIndex);
  }, [selectedIndex]);

  const handleSelection = useCallback(
    (idx: number) => {
      if (!allowSelection) return;
      setSelected(idx);
      onSelection?.(idx);
    },
    [allowSelection, onSelection]
  );

  const handleRightClick = useCallback(
    (idx: number, e: ReactMouseEvent) => {
      if (allowSelection) onRightClick?.(idx, e);
    },
    [allowSelection, onRightClick]
  );

  const handlePriority = useCallback(
    (idx: number) => {
      if (!allowSelection) return;
      setSelected(idx);
      onPriority?.(idx);
    },
    [allowSelection, onPriority]
  );

  const handleKey = useCallback(
    (code: string) => {
      if (selected === undefined) return;
      let newSelected = selected;
      switch (code) {
        case "ArrowUp":
          newSelected = selected - COLUMNS;
          if (newSelected < firstVisible) newSelected += visibleSize;
          break;
        case "ArrowDown":
          newSelected = selected + COLUMNS;
          /*
           * `>=`, not `>`. At `selected = 0xf0` this produced 256 — one past the end — so the last
           * row wrapped to a swatch that does not exist, and every consumer of the selection then
           * read `palette[256]`, i.e. `undefined`.
           */
          if (newSelected >= firstVisible + visibleSize) newSelected -= visibleSize;
          break;
        case "ArrowLeft":
          newSelected = (selected & 0xf0) + ((selected - 1) & 0x0f);
          break;
        case "ArrowRight":
          newSelected = (selected & 0xf0) + ((selected + 1) & 0x0f);
          break;
        case "Enter":
        case "Space":
          onPriority?.(selected);
          return;
        default:
          onOtherKey?.(code);
          return;
      }
      setSelected(newSelected);
      onSelection?.(newSelected);
    },
    [selected, firstVisible, visibleSize, onPriority, onOtherKey, onSelection]
  );

  const tooltipText = useMemo(() => {
    if (!hovered) return "";
    const value = palette?.[hovered.index] ?? 0;
    const [r, g, b] = getRgbPartsForPaletteCode(value);
    const flags = [
      usePriority && !!(value & 0x8000) ? t("panels.controls.nextPalette.flag.priority") : null,
      hovered.index === transparencyIndex || transparentIndexes?.has(hovered.index)
        ? t("panels.controls.nextPalette.flag.transparency")
        : null,
      writtenIndexes?.has(hovered.index) ? t("panels.controls.nextPalette.flag.written") : null,
      watchedIndexes?.has(hovered.index) ? t("panels.controls.nextPalette.flag.watched") : null
    ].filter(Boolean);
    const args = { index: `$${toHexa2(hovered.index)}`, r, g, b };
    return flags.length
      ? t("panels.controls.nextPalette.tooltipWithFlags", {
          ...args,
          flags: flags.join(t("panels.controls.nextPalette.flagSeparator"))
        })
      : t("panels.controls.nextPalette.tooltip", args);
  }, [hovered, palette, usePriority, transparencyIndex, transparentIndexes, writtenIndexes, watchedIndexes, t]);

  return (
    <KeyHandler tabIndex={0} xclass={styles.paletteWrapper} onKey={handleKey}>
      <div
        className={classnames(styles.paletteGrid, { [styles.selectable]: allowSelection })}
        style={{ ["--palette-cell" as any]: `${cellSize}px` }}
        role="grid"
        aria-label={t("panels.controls.nextPalette.label")}
      >
        <div className={styles.gridCorner} />
        {INDEXES.map((idx) => (
          <div key={idx} className={styles.columnLabel}>
            {idx.toString(16).toUpperCase()}
          </div>
        ))}
        {visibleRows.map((row) => (
          <PaletteRow
            key={row}
            row={row}
            topRow={rowStart}
            palette={palette}
            usePriority={usePriority}
            transparencyIndex={transparencyIndex}
            transparentIndexes={transparentIndexes}
            writtenIndexes={writtenIndexes}
            previousCodes={previousCodes}
            watchedIndexes={watchedIndexes}
            allowSelection={allowSelection}
            onSelection={handleSelection}
            onRightClick={handleRightClick}
            onPriority={handlePriority}
            onEnter={handleEnter}
            onLeave={handleLeave}
            selectedIndex={selected}
          />
        ))}
      </div>
      <Tooltip refElement={hovered?.el ?? null} isShown={tipShown} placement="top" offsetY={6}>
        <div className={styles.paletteTooltip}>{tooltipText}</div>
      </Tooltip>
    </KeyHandler>
  );
};

type PaletteRowProps = {
  row: number;
  /** The first row shown: it draws no quadrant rule above itself. */
  topRow: number;
  palette: number[];
  usePriority?: boolean;
  transparencyIndex?: number;
  transparentIndexes?: ReadonlySet<number>;
  writtenIndexes?: ReadonlySet<number>;
  previousCodes?: ReadonlyMap<number, number>;
  watchedIndexes?: ReadonlyMap<number, boolean>;
  allowSelection?: boolean;
  onSelection: (index: number) => void;
  onRightClick: (index: number, e: ReactMouseEvent) => void;
  onPriority: (index: number) => void;
  onEnter: (el: HTMLElement, index: number) => void;
  onLeave: () => void;
  selectedIndex?: number;
};

/**
 * One row of the grid, rendered as a label cell plus 16 swatches directly into the parent grid.
 *
 * There is no row wrapper element: the swatches are grid items of the *outer* grid, which is what
 * keeps every column on one `1fr` track. A per-row flex container would let each row size its own
 * columns, and rows whose labels differ in width would drift out of alignment.
 */
const PaletteRow = ({
  row,
  topRow,
  palette,
  usePriority,
  transparencyIndex,
  transparentIndexes,
  writtenIndexes,
  previousCodes,
  watchedIndexes,
  allowSelection,
  onSelection,
  onRightClick,
  onPriority,
  onEnter,
  onLeave,
  selectedIndex
}: PaletteRowProps) => {
  const firstIndex = row * COLUMNS;
  return (
    <>
      <div className={styles.rowLabel}>{row.toString(16).toUpperCase()}</div>
      {INDEXES.map((col) => {
        const index = firstIndex + col;
        return (
          <PaletteItem
            key={col}
            index={index}
            value={palette?.[index] ?? 0}
            topRule={row > topRow && row % 4 === 0}
            column={col}
            usePriority={usePriority}
            isTransparency={index === transparencyIndex || !!transparentIndexes?.has(index)}
            isWritten={!!writtenIndexes?.has(index)}
            previousCode={previousCodes?.get(index)}
            watch={watchedIndexes?.has(index) ? (watchedIndexes.get(index) ? "enabled" : "disabled") : undefined}
            isSelected={allowSelection && index === selectedIndex}
            allowSelection={allowSelection}
            onSelection={onSelection}
            onRightClick={onRightClick}
            onPriority={onPriority}
            onEnter={onEnter}
            onLeave={onLeave}
          />
        );
      })}
    </>
  );
};

type PaletteItemProps = {
  index: number;
  value: number;
  /** A quadrant rule above this swatch (every fourth row, never above the first one shown). */
  topRule: boolean;
  column: number;
  usePriority?: boolean;
  isTransparency: boolean;
  /** Written since the last stop: a ring */
  isWritten?: boolean;
  /** The colour at the last stop (register layout), drawn in the bottom-left corner of a written entry */
  previousCode?: number;
  /** A `pal:` breakpoint watches it */
  watch?: "enabled" | "disabled";
  isSelected: boolean;
  allowSelection?: boolean;
  onSelection: (index: number) => void;
  onRightClick: (index: number, e: ReactMouseEvent) => void;
  onPriority: (index: number) => void;
  onEnter: (el: HTMLElement, index: number) => void;
  onLeave: () => void;
};

/**
 * A single swatch.
 *
 * **Every prop is a primitive or a stable callback**, which is what makes the `memo` worth having.
 * The sidebar panel re-polls the emulator on a timer and gets a fresh `number[]` every time, so a
 * memo keyed on the array (as the old `PaletteRow` was) never hit — the identity changed on every
 * tick even when not one entry had. Comparing the entry's own value instead means a running machine
 * re-renders only the swatches whose colour actually moved.
 *
 * The swatch is a `div` with a background colour, not an `<svg>`. The previous `<svg>` carried no
 * `width`/`height`/`viewBox`, so each one took the SVG default replaced size of **300x150** inside
 * an 18px cell and spilled over its 200-odd neighbours; only the absence of a background on the
 * overflow kept that invisible.
 */
const PaletteItem = memo(
  ({
    index,
    value,
    topRule,
    column,
    usePriority,
    isTransparency,
    isWritten,
    previousCode,
    watch,
    isSelected,
    allowSelection,
    onSelection,
    onRightClick,
    onPriority,
    onEnter,
    onLeave
  }: PaletteItemProps) => {
    const color = getCssStringForPaletteCode(value);
    const isDark = getLuminanceForPaletteCode(value) < 3.5;
    const markColor = isDark ? "#ffffff" : "#000000";
    /*
     * The quadrant rule takes its contrast from the swatch it is drawn on, exactly as the three
     * marks do, rather than from a theme token. A rule over *arbitrary user colour* has no surface
     * to be legible against: one fixed alpha vanishes over half of any palette, and a theme neutral
     * vanishes over more. This is the same principle as the settled "device surfaces are
     * theme-invariant" rule — what is on the swatch belongs to the machine, not to the tone.
     */
    const ruleColor = isDark ? "rgb(255 255 255 / 26%)" : "rgb(0 0 0 / 26%)";
    const hasPriority = usePriority && !!(value & 0x8000);

    return (
      <div
        className={classnames(styles.paletteItem, {
          [styles.quadLeft]: column > 0 && column % 4 === 0,
          [styles.quadTop]: topRule,
          [styles.selected]: isSelected
        })}
        style={{ backgroundColor: color, ["--palette-rule" as any]: ruleColor }}
        role="gridcell"
        aria-label={`$${toHexa2(index)}`}
        aria-selected={isSelected}
        onMouseEnter={(e) => onEnter(e.currentTarget, index)}
        onMouseLeave={onLeave}
        onClick={() => allowSelection && onSelection(index)}
        onContextMenu={(e) => allowSelection && onRightClick(index, e)}
        onDoubleClick={() => allowSelection && onPriority(index)}
      >
        {isTransparency && (
          <span className={styles.transparencyMark} style={{ backgroundColor: markColor }} />
        )}
        {hasPriority && (
          <span className={styles.priorityMark} style={{ borderTopColor: markColor }} />
        )}
        {isWritten && previousCode !== undefined && previousCode !== value && (
          <span
            className={styles.previousMark}
            style={{ borderBottomColor: getCssStringForPaletteCode(previousCode) }}
          />
        )}
        {isWritten && <span className={styles.writtenMark} />}
        {watch && (
          <span
            className={classnames(styles.watchMark, { [styles.watchDisabled]: watch === "disabled" })}
            style={{ borderColor: markColor }}
          />
        )}
        {isSelected && <span className={styles.selectionMark} style={{ borderColor: markColor }} />}
      </div>
    );
  }
);
