import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import classnames from "classnames";

import { patternPixels } from "@common/zxnext/sprites/spritePatterns";
import { useT } from "@common/i18n/useT";
import {
  ContextMenu,
  ContextMenuItem,
  ContextMenuSeparator,
  useContextMenuState
} from "@renderer/controls/ContextMenu";
import { SpriteCanvas } from "@renderer/controls/Next/sprites/SpritePatternSheet";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { Icon } from "@renderer/controls/Icon";
import type { SpriteBreakpointState } from "@renderer/features/sprites/useSpriteBreakpoints";
import { useRowSizes } from "@renderer/theming/useRowSizes";
import {
  attributesAsDb,
  attributesAsNextreg,
  type SpriteModel,
  type SpriteRow
} from "@renderer/features/sprites/spriteViewModel";
import styles from "./SpriteInspector.module.scss";

/*
 * The Sprites view (`.plans/SPRITE_INSPECTOR_PLAN.md` §4.5.1, G3.2): one row per attribute slot,
 * decoded, with the pattern each one shows.
 *
 * One scroller holds the header and the rows: the header is sticky to the top, so it moves sideways
 * with its columns, and the first three columns (#, vis, pattern) are sticky to the left, so a row
 * keeps its identity while the user scrolls to `type` or `note`. The rows are not virtualized: there
 * are at most 128 of them.
 */

type Props = {
  rows: SpriteRow[];
  model: SpriteModel;
  patternsVersion: number;
  abgr: Uint32Array;
  checker: boolean;
  showRaw: boolean;
  selectedRows: number[];
  selectedSprite?: number;
  onSelect: (index: number) => void;
  onShowPattern: (row: SpriteRow) => void;
  /** Pops the row's pattern out into a read-only sprite editor, as the sprite shows it */
  onOpenSnapshot: (row: SpriteRow) => void;
  /** Copies a sprite's attributes as text; `sprite` names it in the status message */
  onCopy: (text: string, sprite: number) => void;
  /** The `sp:` breakpoints, by sprite (G3.8, sprite half) */
  breakpoints: Map<number, SpriteBreakpointState>;
  /** Adds or removes the sprite's attribute-write breakpoint */
  onToggleBreakpoint: (sprite: number) => void;
  onEditBreakpoint: (sprite: number) => void;
  /** Runs until an attribute byte of the sprite is written (a one-shot `run-to sp:`) */
  onRunUntilWrite: (sprite: number) => void;
};

/** A thumbnail cache, keyed by format, pattern and palette offset; rebuilt when the RAM changes. */
function useThumbnails(model: SpriteModel, patternsVersion: number) {
  const transparency = model.state.transparencyIndex;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cache = useMemo(() => new Map<string, Int16Array>(), [patternsVersion, transparency]);
  return (row: SpriteRow) => {
    const r = row.resolved;
    const key = `${r.fourBit ? 4 : 8}:${r.pattern7}:${r.paletteOffset}`;
    let pixels = cache.get(key);
    if (!pixels) {
      pixels = patternPixels(model.state.patterns, r.fourBit ? r.pattern7 : row.patternSlot, {
        format: r.fourBit ? "4bit" : "8bit",
        offset: 0,
        paletteOffset: r.paletteOffset,
        transparencyIndex: transparency
      });
      cache.set(key, pixels);
    }
    return pixels;
  };
}

export const SpritesTable = ({
  rows,
  model,
  patternsVersion,
  abgr,
  checker,
  showRaw,
  selectedRows,
  selectedSprite,
  onSelect,
  onShowPattern,
  onOpenSnapshot,
  onCopy,
  breakpoints,
  onToggleBreakpoint,
  onEditBreakpoint,
  onRunUntilWrite
}: Props) => {
  const t = useT();
  const { list: rowHeight } = useRowSizes();
  const thumbnail = useThumbnails(model, patternsVersion);
  const [menuState, menuApi] = useContextMenuState();
  const [menuRow, setMenuRow] = useState<SpriteRow>();
  const transparentAbgr = abgr[model.state.transparencyIndex & 0xff];
  const selected = new Set(selectedRows);
  const tableRef = useRef<HTMLTableElement>(null);

  // --- Keep the primary selection in view (a click in the sheet or on the map selects a sprite)
  useLayoutEffect(() => {
    if (selectedSprite === undefined) return;
    tableRef.current
      ?.querySelector<HTMLElement>(`[data-sprite="${selectedSprite}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [selectedSprite]);

  const showMenu = (row: SpriteRow, e: ReactMouseEvent) => {
    e.preventDefault();
    setMenuRow(row);
    onSelect(row.index);
    menuApi.show(e);
  };
  const fromMenu = (action: () => void) => () => {
    menuApi.conceal();
    action();
  };

  return (
    <div className={styles.pane} aria-label={t("panels.sprites.tab.sprites")}>
      <div className={styles.paneHeader}>
        <span>{t("panels.sprites.tab.sprites")}</span>
        <span className={styles.paneMeta}>
          {model.state.lastVisible < 0
            ? t("panels.sprites.table.metaNone", { count: rows.length })
            : t("panels.sprites.table.meta", { count: rows.length, last: model.state.lastVisible })}
        </span>
      </div>
      <div className={styles.tableBody}>
        {rows.length === 0 ? (
          <div className={styles.emptyRows}>{t("panels.sprites.table.empty")}</div>
        ) : (
          <ScrollViewer>
            <table ref={tableRef} className={styles.spriteTable} aria-label={t("panels.sprites.table.label")}>
              <thead>
                <tr style={{ height: rowHeight }}>
                  <th className={styles.pinIndex}>#</th>
                  <th className={styles.pinVis}>vis</th>
                  <th className={styles.pinPattern}>{t("panels.sprites.table.colPattern")}</th>
                  <th>x</th>
                  <th>y</th>
                  <th>fmt</th>
                  <th>pal</th>
                  <th>xform</th>
                  <th>{t("panels.sprites.table.colScale")}</th>
                  <th>{t("panels.sprites.table.colType")}</th>
                  {showRaw && <th>{t("panels.sprites.table.colRaw")}</th>}
                  <th>{t("panels.sprites.table.colNote")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const slot = row.slot;
                  const diagnostic = row.diagnostics[0];
                  const relative = slot.kind === "relative";
                  return (
                    <tr
                      key={row.index}
                      style={{ height: rowHeight }}
                      className={classnames({
                        [styles.rowSelected]: selected.has(row.index),
                        [styles.rowPrimary]: selectedSprite === row.index,
                        [styles.rowClear]: row.visibility === "clear"
                      })}
                      aria-selected={selected.has(row.index)}
                      data-sprite={row.index}
                      onClick={() => onSelect(row.index)}
                      onContextMenu={(e) => showMenu(row, e)}
                    >
                      <td className={classnames(styles.pinIndex, { [styles.changed]: row.changed })}>
                        {breakpoints.has(row.index) && (
                          <span
                            className={styles.bpMark}
                            title={
                              breakpoints.get(row.index)!.disabled
                                ? t("panels.sprites.table.breakpointDisabled", { index: row.index })
                                : t("panels.sprites.table.breakpoint", { index: row.index })
                            }
                          >
                            <Icon
                              iconName="circle-filled"
                              width={8}
                              height={8}
                              fill={
                                breakpoints.get(row.index)!.disabled
                                  ? "--color-breakpoint-disabled"
                                  : "--color-breakpoint-binary"
                              }
                            />
                          </span>
                        )}
                        {row.index}
                        {row.anchor !== undefined && (
                          <span className={styles.anchorBadge} title={t("panels.sprites.table.relativeTo", { anchor: row.anchor })}>
                            ↳{row.anchor}
                          </span>
                        )}
                      </td>
                      <td className={styles.pinVis}>
                        <span
                          className={classnames(styles.visDot, {
                            [styles.visOn]: row.visibility === "effective",
                            [styles.visHalf]: row.visibility === "hiddenByAnchor"
                          })}
                          title={
                            row.visibility === "effective"
                              ? t("panels.sprites.table.visible")
                              : row.visibility === "hiddenByAnchor"
                                ? t("panels.sprites.table.hiddenByAnchor")
                                : t("panels.sprites.table.visibleClear")
                          }
                        />
                      </td>
                      <td
                        className={styles.pinPattern}
                        title={t("panels.sprites.table.patternTitle", { pattern: row.pattern })}
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          onShowPattern(row);
                        }}
                      >
                        <SpriteCanvas
                          pixels={thumbnail(row)}
                          abgr={abgr}
                          transparentAbgr={transparentAbgr}
                          showTransparent={checker}
                          className={styles.thumb}
                        />
                        {row.patternNumber}
                      </td>
                      <td>
                        {row.x}
                        {relative && <span className={styles.secondary}> {row.delta}</span>}
                      </td>
                      <td>{row.y}</td>
                      <td>{row.format}</td>
                      <td title={relative && slot.paletteRelative ? t("panels.sprites.table.paletteRelative") : undefined}>
                        {row.palette}
                      </td>
                      <td>
                        <span className={row.resolved.rotate ? styles.glyphOn : styles.glyphOff} title={t("panels.sprites.table.rotate")}>
                          R
                        </span>
                        <span className={row.resolved.xmirror ? styles.glyphOn : styles.glyphOff} title={t("panels.sprites.table.xMirror")}>
                          X
                        </span>
                        <span className={row.resolved.ymirror ? styles.glyphOn : styles.glyphOff} title={t("panels.sprites.table.yMirror")}>
                          Y
                        </span>
                      </td>
                      <td>{row.scale}</td>
                      <td className={styles.colType}>{row.type}</td>
                      {showRaw && (
                        <td className={styles.colRaw}>
                          {row.raw.map((b, k) =>
                            k === 4 && slot.attr4Ignored ? (
                              <s key={k} title={t("panels.sprites.attr4Ignored")}>
                                {b}
                              </s>
                            ) : (
                              <span key={k}>{b} </span>
                            )
                          )}
                        </td>
                      )}
                      <td>
                        {diagnostic && (
                          <span
                            className={classnames(styles.chip, {
                              [styles.chipInfo]: diagnostic.level === "info"
                            })}
                            title={row.diagnostics.map((d) => d.sentence).join("\n")}
                          >
                            {diagnostic.chip}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollViewer>
        )}
      </div>
      <ContextMenu state={menuState} onClickOutside={() => menuApi.conceal()}>
        <ContextMenuItem
          text={t("panels.sprites.menu.copyNextreg")}
          clicked={fromMenu(() => menuRow && onCopy(attributesAsNextreg(menuRow.slot), menuRow.index))}
        />
        <ContextMenuItem
          text={t("panels.sprites.menu.copyDb")}
          clicked={fromMenu(() => menuRow && onCopy(attributesAsDb(menuRow.slot), menuRow.index))}
        />
        <ContextMenuItem text={t("panels.sprites.menu.showPattern")} clicked={fromMenu(() => menuRow && onShowPattern(menuRow))} />
        <ContextMenuItem
          text={t("panels.sprites.menu.openPattern")}
          clicked={fromMenu(() => menuRow && onOpenSnapshot(menuRow))}
        />
        <ContextMenuSeparator />
        {/* --- The sprite half of G3.8: `sp:` breakpoints */}
        <ContextMenuItem
          text={
            menuRow && breakpoints.has(menuRow.index)
              ? t("panels.sprites.menu.removeBreakpoint")
              : t("panels.sprites.menu.addBreakpoint")
          }
          clicked={fromMenu(() => menuRow && onToggleBreakpoint(menuRow.index))}
        />
        {menuRow && breakpoints.has(menuRow.index) && (
          <ContextMenuItem
            text={t("panels.sprites.menu.editBreakpoint")}
            iconName="pencil"
            clicked={fromMenu(() => onEditBreakpoint(menuRow.index))}
          />
        )}
        <ContextMenuItem
          text={t("panels.sprites.menu.runUntilWrite")}
          clicked={fromMenu(() => menuRow && onRunUntilWrite(menuRow.index))}
        />
      </ContextMenu>
    </div>
  );
};
