import { useMemo, useState } from "react";
import { renderTileSheet } from "@common/zxnext/tilemap/tilemapDecode";
import { usageCount } from "@common/zxnext/tilemap/tilemapUsage";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { IndexedImageCanvas } from "@renderer/controls/Next/IndexedImageCanvas";
import {
  tileAtPixel,
  tilesOverlay,
  unusedTileMask
} from "@renderer/features/tilemap/tilemapOverlay";
import {
  tileAddress,
  tileSheetOffset,
  type TilemapModel
} from "@renderer/features/tilemap/tilemapViewModel";
import { OverlayCanvas } from "./OverlayCanvas";
import styles from "./TilemapInspector.module.scss";

/*
 * The Tiles view (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.5.2): the definitions as one sheet of 8 x 8
 * tiles (T9), 256 or 512 (T3), 4-bit or text mode (T4); unreferenced tiles dimmed, usage counts from
 * zoom 3, the selection outlined.
 */

export const TILES_PER_ROW = 16;

type Props = {
  model: TilemapModel;
  zoom: number;
  checker: boolean;
  grid: boolean;
  paletteOffset: "fromMap" | number;
  abgr: Uint32Array;
  transparentAbgr: number;
  textTransparent?: (index: number) => boolean;
  selectedTile?: number;
  onSelectTile: (tile: number) => void;
};

export const TilemapTilesView = ({
  model,
  zoom,
  checker,
  grid,
  paletteOffset,
  abgr,
  transparentAbgr,
  textTransparent,
  selectedTile,
  onSelectTile
}: Props) => {
  const { mode, state } = model;
  const sheet = useMemo(
    () =>
      renderTileSheet(
        mode,
        state.regs,
        state,
        TILES_PER_ROW,
        tileSheetOffset(model, paletteOffset),
        textTransparent
      ),
    [model, mode, state, paletteOffset, textTransparent]
  );
  const dim = useMemo(() => unusedTileMask(model, TILES_PER_ROW), [model]);
  const shapes = useMemo(
    () =>
      tilesOverlay(model, TILES_PER_ROW, {
        grid: grid && zoom >= 2,
        selectedTile,
        counts: zoom >= 3
      }),
    [model, grid, zoom, selectedTile]
  );
  const [hover, setHover] = useState<number>();
  const used = model.usage.cellsByTile.size;

  return (
    <div className={styles.pane}>
      <div className={styles.paneHeader}>
        <span>Tiles</span>
        <span className={styles.paneMeta}>
          {model.tileCount} × {mode.textMode ? "8 bytes, text" : "32 bytes, 4-bit"} · {used} used
        </span>
      </div>
      <div className={styles.scroller}>
        <ScrollViewer>
          <div className={styles.scrollContent}>
            <IndexedImageCanvas
              pixels={sheet.pixels}
              width={sheet.width}
              height={sheet.height}
              abgr={abgr}
              transparentAbgr={transparentAbgr}
              checker={checker}
              zoomX={zoom}
              dim={dim}
              ariaLabel="Tile definitions"
              className={styles.image}
              onPixelMove={(x, y) => setHover(tileAtPixel(x, y, TILES_PER_ROW, model.tileCount))}
              onLeave={() => setHover(undefined)}
              onPixelClick={(x, y) => {
                const t = tileAtPixel(x, y, TILES_PER_ROW, model.tileCount);
                if (t !== undefined) onSelectTile(t);
              }}
            >
              <OverlayCanvas
                shapes={shapes}
                width={sheet.width}
                height={sheet.height}
                zoomX={zoom}
              />
            </IndexedImageCanvas>
          </div>
        </ScrollViewer>
      </div>
      <div className={styles.hoverLine} aria-live="off">
        {hover !== undefined ? (
          <>
            <span>tile {hover}</span>
            <span>{tileAddress(model, hover).bankText}</span>
            <span>
              {usageCount(model.usage, hover)} cell{usageCount(model.usage, hover) === 1 ? "" : "s"}
            </span>
          </>
        ) : (
          <span className={styles.muted}>Point at a tile; click to see where it is used</span>
        )}
      </div>
    </div>
  );
};
