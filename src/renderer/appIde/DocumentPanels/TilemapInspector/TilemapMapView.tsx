import { type MouseEvent, useMemo, useState } from "react";
import { renderTilemapImage } from "@common/zxnext/tilemap/tilemapDecode";
import { cellAtLayerPixel } from "@common/zxnext/tilemap/tilemapGeometry";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { IndexedImageCanvas } from "@renderer/controls/Next/IndexedImageCanvas";
import { mapOverlay } from "@renderer/features/tilemap/tilemapOverlay";
import {
  addressOf,
  cellIndex,
  type TilemapModel
} from "@renderer/features/tilemap/tilemapViewModel";
import { OverlayCanvas } from "./OverlayCanvas";
import styles from "./TilemapInspector.module.scss";

/*
 * The Map view (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.5.1): the tilemap as one image (T9), *Whole
 * map* (unscrolled, the visible window outlined, D4) or *As displayed* (scrolled and clipped, the clip
 * window outlined), with the overlays and a hover line.
 */

export type MapLook = {
  asDisplayed: boolean;
  grid: boolean;
  indices: boolean;
  checker: boolean;
  zoom: number;
};

/** Tile numbers fit in a cell from zoom 3 (§4.5.1); below that they are on hover only. */
export const INDICES_FROM_ZOOM = 3;

type Props = {
  model: TilemapModel;
  look: MapLook;
  abgr: Uint32Array;
  transparentAbgr: number;
  textTransparent?: (index: number) => boolean;
  selected: number[];
  selectedIsCell: boolean;
  changed: Set<number>;
  onSelectCell: (col: number, row: number) => void;
  onCellMenu: (col: number, row: number, event: MouseEvent<HTMLElement>) => void;
};

export const TilemapMapView = ({
  model,
  look,
  abgr,
  transparentAbgr,
  textTransparent,
  selected,
  selectedIsCell,
  changed,
  onSelectCell,
  onCellMenu
}: Props) => {
  const { mode, state } = model;
  const image = useMemo(
    () =>
      renderTilemapImage(mode, state.regs, state, {
        asDisplayed: look.asDisplayed,
        textTransparent
      }),
    [mode, state, look.asDisplayed, textTransparent]
  );
  const shapes = useMemo(
    () =>
      mapOverlay(model, {
        asDisplayed: look.asDisplayed,
        grid: look.grid && look.zoom >= 2,
        indices: look.indices && look.zoom >= INDICES_FROM_ZOOM,
        selected,
        selectedIsCell,
        changed
      }),
    [model, look.asDisplayed, look.grid, look.indices, look.zoom, selected, selectedIsCell, changed]
  );
  const [hover, setHover] = useState<{ x: number; y: number }>();
  const cellAt = (x: number, y: number) =>
    cellAtLayerPixel(state.regs, mode, x, y, look.asDisplayed);
  const hovered = hover ? cellAt(hover.x, hover.y) : undefined;
  const hoveredCell = hovered ? model.cells[cellIndex(model, hovered.col, hovered.row)] : undefined;

  return (
    <div className={styles.pane}>
      <div className={styles.paneHeader}>
        <span>Map</span>
        <span className={styles.paneMeta}>
          {look.asDisplayed
            ? "as displayed: scrolled and clipped"
            : "whole map: the screen's view outlined"}
          {state.copperRunning &&
            look.asDisplayed &&
            " · the Copper is running: per-line changes are not shown"}
        </span>
      </div>
      <div className={styles.scroller}>
        <ScrollViewer>
          <div className={styles.scrollContent}>
            <IndexedImageCanvas
              pixels={image.pixels}
              width={image.width}
              height={image.height}
              abgr={abgr}
              transparentAbgr={transparentAbgr}
              checker={look.checker}
              zoomX={look.zoom}
              ariaLabel="Tilemap"
              className={styles.image}
              onPixelMove={(x, y) => setHover({ x, y })}
              onLeave={() => setHover(undefined)}
              onPixelClick={(x, y) => {
                const c = cellAt(x, y);
                if (c) onSelectCell(c.col, c.row);
              }}
              onPixelContextMenu={(x, y, event) => {
                const c = cellAt(x, y);
                if (!c) return;
                event.preventDefault();
                onSelectCell(c.col, c.row);
                onCellMenu(c.col, c.row, event);
              }}
            >
              <OverlayCanvas
                shapes={shapes}
                width={image.width}
                height={image.height}
                zoomX={look.zoom}
              />
            </IndexedImageCanvas>
          </div>
        </ScrollViewer>
      </div>
      <div className={styles.hoverLine} aria-live="off">
        {hoveredCell && hover ? (
          <>
            <span>
              cell ({hoveredCell.col}, {hoveredCell.row})
            </span>
            <span>tile {hoveredCell.tile}</span>
            <span>
              entry {addressOf(state, state.regs.mapBank7, hoveredCell.entryOffset).bankText}
            </span>
            <span>
              layer ({hover.x}, {hover.y})
            </span>
          </>
        ) : (
          <span className={styles.muted}>Point at a cell; click to inspect it</span>
        )}
      </div>
    </div>
  );
};
