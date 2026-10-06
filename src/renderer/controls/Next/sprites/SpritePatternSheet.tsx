import classnames from "classnames";
import { CSSProperties, memo, MouseEvent, useLayoutEffect, useRef } from "react";
import { NEX_SPRITE_TRANSPARENT } from "@common/zxnext/sprites/spritePatterns";
import styles from "./SpritePatternSheet.module.scss";

/*
 * A sheet of 16×16 sprite patterns: the grid, its cells and their canvases, and the zoom buttons.
 * Shared by the NEX bank Sprites view and the Sprite Inspector's Patterns view
 * (`.plans/SPRITE_INSPECTOR_PLAN.md` D5, §4.6).
 *
 * The sheet draws what it is given; it does not decode bytes. Each caller turns its bytes into pixels
 * (`patternPixels`) in the format and palette offset it wants per cell, so a per-slot format
 * (*As used*) or a per-pattern palette offset is the caller's business, and the sheet only adds the
 * presentation those need: a badge, markers and a warning corner per cell.
 */

export type SpriteSheetZoom = 1 | 2 | 3 | 4;

export const SPRITE_SHEET_ZOOMS: SpriteSheetZoom[] = [1, 2, 3, 4];

/** A marker drawn on a cell's image. */
export type SpriteCellMarker = "upload" | "selectedSprite";

export type SpriteSheetCell = {
  /** The cell's index in the sheet (what `onSelect` reports) */
  index: number;
  /** The DOM id, for `aria-activedescendant` */
  id: string;
  pixels: Int16Array;
  /** The tooltip */
  title: string;
  /** The label under the image: the number, then the secondary text */
  number: string;
  secondary?: string;
  /** Drawn dimmed: blank, or unreferenced */
  dimmed?: boolean;
  /** A corner fold in the secondary accent (the NEX view's "already a bytes region") */
  fold?: boolean;
  /** A warning corner (the inspector's "read both as 4-bit and 8-bit") */
  warning?: boolean;
  /** A count in the cell's corner: `strong` in the accent, muted otherwise */
  badge?: { text: string; strong: boolean; title?: string };
  markers?: SpriteCellMarker[];
};

type SheetProps = {
  cells: SpriteSheetCell[];
  zoom: SpriteSheetZoom;
  abgr: Uint32Array;
  transparentAbgr: number;
  showTransparent: boolean;
  isSelected: (index: number) => boolean;
  activeIndex?: number;
  onSelect: (index: number, extend: boolean) => void;
  onContextMenu?: (index: number, event: MouseEvent<HTMLElement>) => void;
  onOpen?: (index: number) => void;
};

/** The grid. Wrap it in a scroller and a listbox; the sheet owns no keyboard handling. */
export const SpritePatternSheet = ({
  cells,
  zoom,
  abgr,
  transparentAbgr,
  showTransparent,
  isSelected,
  activeIndex,
  onSelect,
  onContextMenu,
  onOpen
}: SheetProps) => (
  <div className={styles.grid} style={{ ["--sprite-px" as string]: `${16 * zoom}px` }}>
    {cells.map((cell) => (
      <SpriteCell
        key={cell.index}
        cell={cell}
        abgr={abgr}
        transparentAbgr={transparentAbgr}
        showTransparent={showTransparent}
        selected={isSelected(cell.index)}
        active={cell.index === activeIndex}
        onSelect={onSelect}
        onContextMenu={onContextMenu}
        onOpen={onOpen}
      />
    ))}
  </div>
);

type CellProps = {
  cell: SpriteSheetCell;
  abgr: Uint32Array;
  transparentAbgr: number;
  showTransparent: boolean;
  selected: boolean;
  active: boolean;
  onSelect: (index: number, extend: boolean) => void;
  onContextMenu?: (index: number, event: MouseEvent<HTMLElement>) => void;
  onOpen?: (index: number) => void;
};

const SpriteCell = memo(
  ({
    cell,
    abgr,
    transparentAbgr,
    showTransparent,
    selected,
    active,
    onSelect,
    onContextMenu,
    onOpen
  }: CellProps) => (
    <div
      id={cell.id}
      role="option"
      aria-selected={selected}
      data-pattern={cell.index}
      className={classnames(styles.cell, {
        [styles.cellSelected]: selected,
        [styles.cellActive]: active,
        [styles.cellBlank]: cell.dimmed
      })}
      title={cell.title}
      onClick={(event) => onSelect(cell.index, event.shiftKey)}
      onDoubleClick={() => onOpen?.(cell.index)}
      onContextMenu={(event) => onContextMenu?.(cell.index, event)}
    >
      <span className={styles.cellImage}>
        <SpriteCanvas
          pixels={cell.pixels}
          abgr={abgr}
          transparentAbgr={transparentAbgr}
          showTransparent={showTransparent}
          className={styles.cellCanvas}
        />
        {cell.fold && <span className={styles.bytesMark} aria-label="Marked as bytes" />}
        {cell.warning && <span className={styles.warningMark} aria-label="Mixed formats" />}
        {cell.markers?.includes("upload") && (
          <span className={styles.uploadMark} aria-label="Upload cursor" />
        )}
        {cell.markers?.includes("selectedSprite") && (
          <span className={styles.spriteMark} aria-label="The selected sprite's pattern" />
        )}
        {cell.badge && (
          <span
            className={classnames(styles.badge, { [styles.badgeStrong]: cell.badge.strong })}
            title={cell.badge.title}
          >
            {cell.badge.text}
          </span>
        )}
      </span>
      <span className={styles.cellLabel}>
        <span className={styles.cellNumber}>{cell.number}</span>
        {cell.secondary !== undefined && ` ${cell.secondary}`}
      </span>
    </div>
  )
);

/**
 * A pattern at its native 16×16, scaled up by CSS with `image-rendering: pixelated`.
 *
 * Transparent pixels are left transparent in the canvas when the checker is on, so the checkerboard
 * is the element's CSS background and stays crisp at any zoom instead of being baked in at sprite
 * resolution. `width`/`height` default to the canvas's 16×16; the caller's class sizes the element.
 */
export const SpriteCanvas = memo(
  ({
    pixels,
    abgr,
    transparentAbgr,
    showTransparent,
    className,
    style
  }: {
    pixels: Int16Array;
    abgr: Uint32Array;
    transparentAbgr: number;
    showTransparent: boolean;
    className?: string;
    style?: CSSProperties;
  }) => {
    const ref = useRef<HTMLCanvasElement | null>(null);
    useLayoutEffect(() => {
      const context = ref.current?.getContext?.("2d");
      if (!context) return;
      const image = context.createImageData(16, 16);
      const out = new Uint32Array(image.data.buffer);
      for (let p = 0; p < 256; p++) {
        const value = pixels[p];
        out[p] =
          value === NEX_SPRITE_TRANSPARENT ? (showTransparent ? 0 : transparentAbgr) : abgr[value];
      }
      context.putImageData(image, 0, 0);
    }, [abgr, pixels, showTransparent, transparentAbgr]);

    return (
      <canvas
        ref={ref}
        width={16}
        height={16}
        style={style}
        className={classnames(className, { [styles.checker]: showTransparent })}
      />
    );
  }
);

/** The checkerboard class, for a caller's own element behind transparent pixels. */
export const spriteCheckerClass = styles.checker;

/*
 * The segmented buttons both sprite toolbars use (palette, format, zoom). `segmentLive` rings the
 * palette the machine is drawing with.
 */
export const spriteSegmentedClass = styles.segmented;
export const spriteSegmentClass = styles.segment;
export const spriteSegmentLiveClass = styles.segmentLive;

/** The segmented zoom buttons, `1×`-`4×`. */
export const SpriteZoomButtons = ({
  zoom,
  onChange
}: {
  zoom: SpriteSheetZoom;
  onChange: (zoom: SpriteSheetZoom) => void;
}) => (
  <span className={styles.segmented} role="group" aria-label="Zoom">
    {SPRITE_SHEET_ZOOMS.map((z) => (
      <button
        key={z}
        type="button"
        className={styles.segment}
        aria-pressed={zoom === z}
        onClick={() => onChange(z)}
      >
        {`${z}×`}
      </button>
    ))}
  </span>
);
