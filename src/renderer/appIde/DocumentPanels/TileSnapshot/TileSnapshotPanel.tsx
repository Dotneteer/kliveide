import classnames from "classnames";
import { useCallback, useMemo, useState } from "react";

import { getCssStringForPaletteCode, paletteCodeFromDeviceValue } from "@emu/machines/zxNext/palette";
import { EmptyState } from "@renderer/controls/data";
import { NextPaletteViewer } from "@renderer/controls/NextPaletteViewer";
import { IndexedImageCanvas } from "@renderer/controls/Next/IndexedImageCanvas";
import { toAbgrTable } from "@renderer/controls/Next/sprites/spriteAbgr";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { useDispatch } from "@renderer/core/RendererProvider";
import { setIdeStatusMessageAction } from "@state/actions";
import { useDocumentHubService } from "@renderer/appIde/services/DocumentServiceProvider";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { SpriteRulers } from "@renderer/features/sprite-editor/SpriteRulers";
import {
  isTransparent,
  snapshotPixels,
  tileSnapshotAsDb,
  tileSnapshotTitle,
  type TileSnapshotViewState
} from "@renderer/features/tilemap/tileSnapshot";
import styles from "./TileSnapshotPanel.module.scss";

/*
 * A tilemap tile popped out of the Tilemap Inspector (`tileSnapshot.ts`): an 8 x 8 pixel grid with
 * rulers, the frozen tilemap palette and a preview, laid out like the sprite editor and read-only in
 * the same way (`.ai/ui-theming-intent-and-lessons.md`, "A Read-Only View Of An Editor"). Nothing is
 * saved; the tab is not restored with the workspace.
 */

export const TILE_CELL_SIZES = [16, 24, 32, 40, 48, 64];
const DEFAULT_CELL_SIZE = 40;

const hex2 = (v: number) => `$${(v & 0xff).toString(16).toUpperCase().padStart(2, "0")}`;

const TileSnapshotPanel = ({ document, contents, viewState }: DocumentProps<TileSnapshotViewState>) => {
  const documentHubService = useDocumentHubService();
  const dispatch = useDispatch();
  const info = viewState?.snapshot;
  const bytes: Uint8Array | undefined = contents instanceof Uint8Array ? contents : undefined;

  const [look, setLook] = useState({
    asShown: viewState?.asShown ?? !!info?.cell,
    cellSize: viewState?.cellSize ?? DEFAULT_CELL_SIZE,
    showGrid: viewState?.showGrid ?? true,
    checker: viewState?.checker ?? true
  });
  const update = useCallback(
    (patch: Partial<typeof look>) =>
      setLook((current) => {
        const next = { ...current, ...patch };
        documentHubService?.setDocumentViewState(document.id, { ...viewState, ...next });
        return next;
      }),
    [document.id, documentHubService, viewState]
  );
  const [hover, setHover] = useState<number>();

  const codes = useMemo(() => info?.palette.map(paletteCodeFromDeviceValue) ?? [], [info]);
  const abgr = useMemo(() => toAbgrTable(codes), [codes]);
  const pixels = useMemo(
    () => (bytes && info ? snapshotPixels(bytes, info, look.asShown) : []),
    [bytes, info, look.asShown]
  );
  const preview = useMemo(() => Int16Array.from(pixels, (p) => p.index), [pixels]);

  if (!info || !bytes || pixels.length !== 64) {
    return <EmptyState message="This tile snapshot has no contents." />;
  }

  const { title, detail } = tileSnapshotTitle(info);
  const size = look.cellSize;
  const zoomIndex = TILE_CELL_SIZES.indexOf(size);
  const hovered = hover !== undefined ? pixels[hover] : undefined;

  return (
    <div className={styles.snapshot} aria-label="Tile snapshot">
      <div className={styles.bar} role="toolbar" aria-label="Read-only snapshot">
        <span className={styles.readOnlyBadge}>Read-only</span>
        <span className={styles.title}>{title}</span>
        <span className={styles.detail} title={detail}>
          {detail}
        </span>
        <span className={styles.spacer} />
        {info.cell && (
          <span className={styles.segmented} role="group" aria-label="Orientation">
            <button
              type="button"
              className={styles.segment}
              aria-pressed={!look.asShown}
              onClick={() => update({ asShown: false })}
            >
              As stored
            </button>
            <button
              type="button"
              className={styles.segment}
              aria-pressed={look.asShown}
              title="Rotated, then mirrored, as the cell shows it"
              onClick={() => update({ asShown: true })}
            >
              As shown
            </button>
          </span>
        )}
        <SmallIconButton
          iconName="spr-copy"
          title="Copy the tile's bytes as .db"
          enable={true}
          clicked={() => {
            void navigator.clipboard?.writeText(tileSnapshotAsDb(bytes, info));
            dispatch(setIdeStatusMessageAction(`Tile ${info.tile} copied as .db`, true));
          }}
        />
      </div>

      <div className={styles.stageHeader}>
        <SmallIconButton
          iconName="spr-zoom-out"
          title="Zoom out"
          enable={zoomIndex > 0}
          clicked={() => update({ cellSize: TILE_CELL_SIZES[Math.max(0, zoomIndex - 1)] })}
        />
        <span className={styles.zoomLabel}>{size}×</span>
        <SmallIconButton
          iconName="spr-zoom-in"
          title="Zoom in"
          enable={zoomIndex < TILE_CELL_SIZES.length - 1}
          clicked={() => update({ cellSize: TILE_CELL_SIZES[Math.min(TILE_CELL_SIZES.length - 1, zoomIndex + 1)] })}
        />
        <span className={styles.separator} />
        <SmallIconButton
          iconName="spr-grid"
          title="Show grid"
          enable={true}
          selected={look.showGrid}
          clicked={() => update({ showGrid: !look.showGrid })}
        />
        <SmallIconButton
          iconName="spr-checker"
          title="Checkerboard behind transparent pixels"
          enable={true}
          selected={look.checker}
          clicked={() => update({ checker: !look.checker })}
        />
      </div>

      <div className={styles.canvasArea}>
        <div className={styles.canvasFrame}>
          <SpriteRulers cellSize={size} orientation="top" count={8} />
          <SpriteRulers cellSize={size} orientation="left" count={8} />
          <svg
            className={classnames(styles.grid, { [styles.checker]: look.checker })}
            width={size * 8}
            height={size * 8}
            role="img"
            aria-label={`Tile ${info.tile}, ${look.asShown ? "as shown" : "as stored"}`}
            onMouseLeave={() => setHover(undefined)}
          >
            <g data-role="pixels">
              {pixels.map((p, i) => (
                <rect
                  key={i}
                  x={(i % 8) * size}
                  y={Math.floor(i / 8) * size}
                  width={size}
                  height={size}
                  fill={isTransparent(p) ? (look.checker ? "transparent" : "var(--surface-active)") : getCssStringForPaletteCode(codes[p.index])}
                  onMouseEnter={() => setHover(i)}
                />
              ))}
            </g>
            {look.showGrid && (
              <g className={styles.gridLines}>
                {Array.from({ length: 7 }, (_, k) => (
                  <g key={k}>
                    <line x1={(k + 1) * size} y1={0} x2={(k + 1) * size} y2={size * 8} />
                    <line x1={0} y1={(k + 1) * size} x2={size * 8} y2={(k + 1) * size} />
                  </g>
                ))}
              </g>
            )}
          </svg>
        </div>
      </div>

      <div className={styles.status} aria-live="off">
        {hovered && hover !== undefined ? (
          <>
            <span>
              x {hover % 8}, y {Math.floor(hover / 8)}
            </span>
            <span>
              {info.textMode ? "bit" : "nibble"} {info.textMode ? hovered.value : hovered.value.toString(16).toUpperCase()}
            </span>
            <span>
              {isTransparent(hovered)
                ? info.textMode
                  ? "transparent (colour = $14)"
                  : `transparent (= $4C ${info.transparencyIndex.toString(16).toUpperCase()})`
                : `index ${hex2(hovered.index)}`}
            </span>
          </>
        ) : (
          <span className={styles.muted}>x –, y –</span>
        )}
        <span className={styles.spacer} />
        <span>Tile {info.tile} · 8×8 · {info.textMode ? "1bpp" : "4bpp"}</span>
      </div>

      <div className={styles.inspector}>
        <div className={styles.sectionHeader}>Tilemap palette {info.paletteBank + 1} (as taken)</div>
        <div className={styles.paletteBody}>
          <NextPaletteViewer
            palette={codes}
            cellSize={17}
            transparencyIndex={info.textMode ? undefined : (info.paletteOffset << 4) | info.transparencyIndex}
            selectedIndex={hovered && !isTransparent(hovered) ? hovered.index : undefined}
          />
        </div>
        <div className={styles.sectionHeader}>Preview</div>
        <div className={styles.previews}>
          {[1, 2, 4].map((z) => (
            <figure key={z} className={styles.preview}>
              <IndexedImageCanvas
                pixels={preview}
                width={8}
                height={8}
                abgr={abgr}
                transparentAbgr={0}
                checker={true}
                zoomX={z * 4}
              />
              <figcaption>{z}×</figcaption>
            </figure>
          ))}
        </div>
      </div>
    </div>
  );
};

export const createTileSnapshotPanel = ({ document, contents, viewState }: DocumentProps) => (
  <TileSnapshotPanel document={document} contents={contents} viewState={viewState} />
);
