import classnames from "classnames";
import { useMemo } from "react";
import { abgrToCss } from "@renderer/controls/Next/sprites/spriteAbgr";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { IndexedImageCanvas } from "@renderer/controls/Next/IndexedImageCanvas";
import {
  cellFields,
  cellIndex,
  cellShownIndices,
  cellSummary,
  coloursUsed,
  invisibilityReasons,
  tileAddress,
  tileSheetOffset,
  tileStoredIndices,
  tileUsers,
  type TilemapModel,
  type TilemapSelection
} from "@renderer/features/tilemap/tilemapViewModel";
import type { DecodedCell } from "@common/zxnext/tilemap/tilemapDecode";
import styles from "./TilemapInspector.module.scss";

/*
 * The inspector (`.plans/TILEMAP_INSPECTOR_PLAN.md` §4.5.3): for a cell, the tile as stored and as
 * shown, the field-by-field decode with the raw bytes (D5), the entry's three addresses (T1), the
 * colours used and why it might be invisible; for a tile, its bytes and the cells that use it.
 */

/** Cells listed for a tile before "and n more" */
const MAX_USERS = 48;

type Props = {
  layout: "band" | "rail";
  model: TilemapModel;
  selection?: TilemapSelection;
  paletteOffset: "fromMap" | number;
  abgr: Uint32Array;
  transparentAbgr: number;
  checker: boolean;
  textTransparent?: (index: number) => boolean;
  onSelectCell: (col: number, row: number) => void;
  onSelectTile: (tile: number) => void;
  /** Pops a tile out into a read-only tile snapshot: from a cell (its transform), or from the sheet */
  onOpenSnapshot: (tile: number, cell?: DecodedCell) => void;
};

const Preview = ({
  pixels,
  label,
  abgr,
  transparentAbgr,
  checker
}: {
  pixels: Int16Array;
  label: string;
  abgr: Uint32Array;
  transparentAbgr: number;
  checker: boolean;
}) => (
  <figure className={styles.preview}>
    <IndexedImageCanvas
      pixels={pixels}
      width={8}
      height={8}
      abgr={abgr}
      transparentAbgr={transparentAbgr}
      checker={checker}
      zoomX={10}
      ariaLabel={label}
    />
    <figcaption>{label}</figcaption>
  </figure>
);

export const TilemapInspectorPane = ({
  layout,
  model,
  selection,
  paletteOffset,
  abgr,
  transparentAbgr,
  checker,
  textTransparent,
  onSelectCell,
  onSelectTile,
  onOpenSnapshot
}: Props) => {
  const cell =
    selection?.kind === "cell"
      ? model.cells[cellIndex(model, selection.col, selection.row)]
      : undefined;
  const tile = selection?.kind === "tile" ? selection.tile : undefined;

  const cellView = useMemo(() => {
    if (!cell) return undefined;
    const shown = cellShownIndices(model, cell, textTransparent);
    const stored = tileStoredIndices(model, cell.tile, cell.paletteOffset, textTransparent);
    return {
      shown,
      stored,
      fields: cellFields(model, cell),
      colours: coloursUsed(shown),
      reasons: invisibilityReasons(model, cell, shown)
    };
  }, [model, cell, textTransparent]);

  const tileView = useMemo(() => {
    if (tile === undefined) return undefined;
    const offset = tileSheetOffset(model, paletteOffset)(tile);
    const a = tileAddress(model, tile);
    return {
      pixels: tileStoredIndices(model, tile, offset, textTransparent),
      offset,
      address: a,
      users: tileUsers(model, tile)
    };
  }, [model, tile, paletteOffset, textTransparent]);

  const swatch = (index: number) => (
    <span
      key={index}
      className={styles.swatch}
      style={{ background: abgrToCss(abgr[index & 0xff]) }}
      title={`Palette index ${index} ($${index.toString(16).toUpperCase().padStart(2, "0")})`}
    />
  );

  return (
    <div
      className={classnames(styles.inspector, { [styles.inspectorBand]: layout === "band" })}
      aria-label="Inspector"
    >
      {!cell && tile === undefined && (
        <div className={styles.inspectorEmpty}>
          Select a cell on the map or a tile in the sheet.
        </div>
      )}

      {cell && cellView && (
        <>
          <div className={styles.inspectorHeader}>{cellSummary(model, cell)}</div>
          <div className={styles.inspectorScroll}>
            <ScrollViewer allowHorizontal={false} thinScrollBar={true}>
              <div className={styles.inspectorBody}>
                <div className={styles.previews}>
                  <Preview
                    pixels={cellView.stored}
                    label="as stored"
                    abgr={abgr}
                    transparentAbgr={transparentAbgr}
                    checker={checker}
                  />
                  <Preview
                    pixels={cellView.shown}
                    label="as shown"
                    abgr={abgr}
                    transparentAbgr={transparentAbgr}
                    checker={checker}
                  />
                </div>
                <dl className={styles.fields}>
                  {cellView.fields.map((f) => (
                    <div key={f.name} className={styles.field} title={f.title}>
                      <dt>{f.name}</dt>
                      <dd className={classnames({ [styles.muted]: f.muted })}>{f.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className={styles.inspectorSection}>
                  <span className={styles.sectionLabel}>Colours</span>
                  <span className={styles.swatches}>
                    {cellView.colours.length ? (
                      cellView.colours.map(swatch)
                    ) : (
                      <span className={styles.muted}>none</span>
                    )}
                  </span>
                </div>
                {cellView.reasons.map((r) => (
                  <p key={r} className={styles.reason}>
                    {r}
                  </p>
                ))}
                {model.state.copperRunning && (
                  <p className={styles.note}>
                    The Copper is running: it may change the registers per line, so the screen can
                    differ from this decode.
                  </p>
                )}
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => onSelectTile(cell.tile)}
                >
                  Show tile {cell.tile} and its users
                </button>
                <button
                  type="button"
                  className={styles.linkButton}
                  title="Open this tile, as this cell shows it, in a read-only tile viewer"
                  onClick={() => onOpenSnapshot(cell.tile, cell)}
                >
                  Open tile snapshot
                </button>
              </div>
            </ScrollViewer>
          </div>
        </>
      )}

      {tileView && tile !== undefined && (
        <>
          <div className={styles.inspectorHeader}>
            Tile {tile} · {tileView.users.length} cell{tileView.users.length === 1 ? "" : "s"} use
            it
          </div>
          <div className={styles.inspectorScroll}>
            <ScrollViewer allowHorizontal={false} thinScrollBar={true}>
              <div className={styles.inspectorBody}>
                <div className={styles.previews}>
                  <Preview
                    pixels={tileView.pixels}
                    label={`offset ${tileView.offset}`}
                    abgr={abgr}
                    transparentAbgr={transparentAbgr}
                    checker={checker}
                  />
                </div>
                <dl className={styles.fields}>
                  <div className={styles.field}>
                    <dt>Bytes</dt>
                    <dd>
                      {tileView.address.bankText} +{model.mode.tileBytes}
                    </dd>
                  </div>
                  <div className={styles.field}>
                    <dt>Physical</dt>
                    <dd>{tileView.address.physicalText}</dd>
                  </div>
                  <div className={styles.field}>
                    <dt>Z80</dt>
                    <dd
                      className={classnames({ [styles.muted]: tileView.address.z80 === undefined })}
                    >
                      {tileView.address.z80Text ?? "not mapped"}
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className={styles.linkButton}
                  title="Open this tile, with the sheet's palette offset, in a read-only tile viewer"
                  onClick={() => onOpenSnapshot(tile)}
                >
                  Open tile snapshot
                </button>
                <div className={styles.inspectorSection}>
                  <span className={styles.sectionLabel}>Used by</span>
                  {tileView.users.length === 0 ? (
                    <span className={styles.muted}>no cell</span>
                  ) : (
                    <span className={styles.users}>
                      {tileView.users.slice(0, MAX_USERS).map((u) => (
                        <button
                          key={u.index}
                          type="button"
                          className={styles.userButton}
                          onClick={() => onSelectCell(u.col, u.row)}
                        >
                          {u.col},{u.row}
                        </button>
                      ))}
                      {tileView.users.length > MAX_USERS && (
                        <span className={styles.muted}>
                          and {tileView.users.length - MAX_USERS} more
                        </span>
                      )}
                    </span>
                  )}
                </div>
              </div>
            </ScrollViewer>
          </div>
        </>
      )}
    </div>
  );
};
