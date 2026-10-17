import classnames from "classnames";
import { useMemo } from "react";
import { abgrToCss } from "@renderer/controls/Next/sprites/spriteAbgr";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { useT } from "@common/i18n/useT";
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
  const t = useT();
  const cell =
    selection?.kind === "cell"
      ? model.cells[cellIndex(model, selection.col, selection.row)]
      : undefined;
  const tile = selection?.kind === "tile" ? selection.tile : undefined;

  const cellView = useMemo(() => {
    if (!cell) return undefined;
    const shown = cellShownIndices(model, cell, textTransparent);
    const stored = tileStoredIndices(model, cell.tile, cell.paletteOffset, textTransparent);
    return { shown, stored, colours: coloursUsed(shown) };
  }, [model, cell, textTransparent]);
  // --- Not memoized: the text is cheap and must follow a language switch
  const cellText =
    cell && cellView
      ? { fields: cellFields(model, cell), reasons: invisibilityReasons(model, cell, cellView.shown) }
      : undefined;

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
      title={t("panels.tilemap.pane.swatch", {
        index,
        hex: `$${index.toString(16).toUpperCase().padStart(2, "0")}`
      })}
    />
  );

  return (
    <div
      className={classnames(styles.inspector, { [styles.inspectorBand]: layout === "band" })}
      aria-label={t("panels.graphics.inspector.label")}
    >
      {!cell && tile === undefined && (
        <div className={styles.inspectorEmpty}>{t("panels.tilemap.pane.empty")}</div>
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
                    label={t("panels.tilemap.pane.asStored")}
                    abgr={abgr}
                    transparentAbgr={transparentAbgr}
                    checker={checker}
                  />
                  <Preview
                    pixels={cellView.shown}
                    label={t("panels.tilemap.pane.asShown")}
                    abgr={abgr}
                    transparentAbgr={transparentAbgr}
                    checker={checker}
                  />
                </div>
                <dl className={styles.fields}>
                  {cellText!.fields.map((f) => (
                    <div key={f.id} className={styles.field} title={f.title}>
                      <dt>{f.name}</dt>
                      <dd className={classnames({ [styles.muted]: f.muted })}>{f.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className={styles.inspectorSection}>
                  <span className={styles.sectionLabel}>{t("panels.tilemap.pane.colours")}</span>
                  <span className={styles.swatches}>
                    {cellView.colours.length ? (
                      cellView.colours.map(swatch)
                    ) : (
                      <span className={styles.muted}>{t("panels.graphics.inspector.none")}</span>
                    )}
                  </span>
                </div>
                {cellText!.reasons.map((r) => (
                  <p key={r} className={styles.reason}>
                    {r}
                  </p>
                ))}
                {model.state.copperRunning && (
                  <p className={styles.note}>{t("panels.graphics.inspector.copperNote")}</p>
                )}
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => onSelectTile(cell.tile)}
                >
                  {t("panels.tilemap.pane.showTile", { tile: cell.tile })}
                </button>
                <button
                  type="button"
                  className={styles.linkButton}
                  title={t("panels.tilemap.pane.snapshotCellTitle")}
                  onClick={() => onOpenSnapshot(cell.tile, cell)}
                >
                  {t("panels.tilemap.menu.openSnapshot")}
                </button>
              </div>
            </ScrollViewer>
          </div>
        </>
      )}

      {tileView && tile !== undefined && (
        <>
          <div className={styles.inspectorHeader}>
            {t("panels.tilemap.pane.tileHeader", { tile, count: tileView.users.length })}
          </div>
          <div className={styles.inspectorScroll}>
            <ScrollViewer allowHorizontal={false} thinScrollBar={true}>
              <div className={styles.inspectorBody}>
                <div className={styles.previews}>
                  <Preview
                    pixels={tileView.pixels}
                    label={t("panels.tilemap.pane.offset", { offset: tileView.offset })}
                    abgr={abgr}
                    transparentAbgr={transparentAbgr}
                    checker={checker}
                  />
                </div>
                <dl className={styles.fields}>
                  <div className={styles.field}>
                    <dt>{t("panels.graphics.inspector.bytes")}</dt>
                    <dd>
                      {tileView.address.bankText} +{model.mode.tileBytes}
                    </dd>
                  </div>
                  <div className={styles.field}>
                    <dt>{t("panels.graphics.inspector.physical")}</dt>
                    <dd>{tileView.address.physicalText}</dd>
                  </div>
                  <div className={styles.field}>
                    <dt>Z80</dt>
                    <dd
                      className={classnames({ [styles.muted]: tileView.address.z80 === undefined })}
                    >
                      {tileView.address.z80Text ?? t("panels.graphics.inspector.notMapped")}
                    </dd>
                  </div>
                </dl>
                <button
                  type="button"
                  className={styles.linkButton}
                  title={t("panels.tilemap.pane.snapshotTileTitle")}
                  onClick={() => onOpenSnapshot(tile)}
                >
                  {t("panels.tilemap.menu.openSnapshot")}
                </button>
                <div className={styles.inspectorSection}>
                  <span className={styles.sectionLabel}>{t("panels.graphics.inspector.usedBy")}</span>
                  {tileView.users.length === 0 ? (
                    <span className={styles.muted}>{t("panels.tilemap.pane.noCell")}</span>
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
                          {t("panels.tilemap.pane.andMore", { count: tileView.users.length - MAX_USERS })}
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
