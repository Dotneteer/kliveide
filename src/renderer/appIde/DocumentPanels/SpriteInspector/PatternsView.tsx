import { useLayoutEffect, useMemo, useRef } from "react";

import { isBlankPattern, patternPixels } from "@common/zxnext/sprites/spritePatterns";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import {
  SpritePatternSheet,
  type SpriteCellMarker,
  type SpriteSheetCell
} from "@renderer/controls/Next/sprites/SpritePatternSheet";
import {
  cellPaletteOffset,
  cellRange,
  uploadCell,
  type PatternCell,
  type SpriteModel
} from "@renderer/features/sprites/spriteViewModel";
import type { SpriteInspectorViewState } from "./SpriteInspectorPanel";
import styles from "./SpriteInspector.module.scss";

/*
 * The Patterns view (`.plans/SPRITE_INSPECTOR_PLAN.md` §4.5.2, G3.3): all 16K of pattern RAM through
 * the NEX view's sheet (D5). Its controls (format, palette offset, export) live in the document's
 * toolbar and its ⋯ menu, so the sheet starts right under its header. *As used* draws each slot the way the sprites read it (D17); a usage
 * badge counts its users, a warning corner flags a slot read both ways, and a bar under a cell is
 * the upload cursor (T12).
 */

type Props = {
  model: SpriteModel;
  cells: PatternCell[];
  patternsVersion: number;
  look: SpriteInspectorViewState;
  abgr: Uint32Array;
  transparentAbgr: number;
  selectedCell?: PatternCell;
  selectedSprite?: number;
  onSelect: (cell: PatternCell) => void;
  onOpenUser: (sprite: number) => void;
};

const hex4 = (v: number) => `$${v.toString(16).toUpperCase().padStart(4, "0")}`;

export const PatternsView = ({
  model,
  cells,
  patternsVersion,
  look,
  abgr,
  transparentAbgr,
  selectedCell,
  selectedSprite,
  onSelect,
  onOpenUser
}: Props) => {
  const transparency = model.state.transparencyIndex;
  const upload = uploadCell(model, cells);

  // --- Re-decode only when the RAM, the cells or the drawing options change (T9)
  const pixels = useMemo(
    () =>
      cells.map((cell) =>
        patternPixels(model.state.patterns, cell.pattern, {
          format: cell.format,
          offset: 0,
          paletteOffset: cellPaletteOffset(model, cell, look.paletteOffset),
          transparencyIndex: transparency
        })
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [patternsVersion, cells, look.paletteOffset, transparency]
  );

  const sheetCells = useMemo<SpriteSheetCell[]>(
    () =>
      cells.map((cell, i) => {
        const range = cellRange(cell);
        const users = cell.users;
        const markers: SpriteCellMarker[] = [];
        if (upload === cell) markers.push("upload");
        if (selectedSprite !== undefined && users.includes(selectedSprite)) markers.push("selectedSprite");
        return {
          index: i,
          id: `sprite-pattern-${i}`,
          pixels: pixels[i],
          number: cell.number,
          secondary: cell.secondary,
          dimmed: users.length === 0 || isBlankPattern(pixels[i]),
          warning: cell.mixed,
          markers,
          badge: users.length
            ? {
                text: String(users.length),
                strong: cell.visibleUsers.length > 0,
                title: `Used by ${users.map((u) => `#${u}`).join(", ")}`
              }
            : undefined,
          title:
            `Pattern ${cell.number} (${cell.format === "8bit" ? "8-bit" : "4-bit"}) · RAM ${hex4(range.start)}–${hex4(range.end)}` +
            (users.length ? `\nUsed by ${users.map((u) => `#${u}`).join(", ")}` : "\nNot used by any sprite") +
            (cell.mixed ? "\nThis slot is read both as 8-bit and as 4-bit: almost always a bug" : "") +
            (upload === cell ? "\nThe next port $5B byte goes here" : "")
        };
      }),
    [cells, pixels, upload, selectedSprite]
  );

  // --- Keep the selected cell in view
  const sheetRef = useRef<HTMLDivElement>(null);
  const selectedIndex = selectedCell?.index;
  useLayoutEffect(() => {
    if (selectedIndex === undefined) return;
    sheetRef.current
      ?.querySelector<HTMLElement>(`[data-pattern="${selectedIndex}"]`)
      ?.scrollIntoView?.({ block: "nearest" });
  }, [selectedIndex]);

  const mixedCount = model.usage.filter((u) => u.mixed).length;

  return (
    <div className={styles.pane} aria-label="Patterns">
      <div className={styles.paneHeader}>
        <span>Patterns</span>
        <span className={styles.paneMeta}>
          {model.usage.filter((u) => u.users8.length + u.users4.length > 0).length} of 64 slots used
          {mixedCount > 0 && <span className={styles.warningText}> · {mixedCount} mixed</span>}
        </span>
      </div>
      <div className={styles.sheetScroll}>
        <ScrollViewer allowHorizontal={false}>
          <div
            ref={sheetRef}
            className={styles.sheet}
            role="listbox"
            tabIndex={0}
            aria-label="Sprite pattern RAM"
            aria-activedescendant={selectedIndex !== undefined ? `sprite-pattern-${selectedIndex}` : undefined}
          >
            <SpritePatternSheet
              cells={sheetCells}
              zoom={look.zoom}
              abgr={abgr}
              transparentAbgr={transparentAbgr}
              showTransparent={look.checker}
              isSelected={(index) => index === selectedIndex}
              activeIndex={selectedIndex}
              onSelect={(index) => onSelect(cells[index])}
              onOpen={(index) => {
                const first = cells[index]?.visibleUsers[0] ?? cells[index]?.users[0];
                if (first !== undefined) onOpenUser(first);
              }}
            />
          </div>
        </ScrollViewer>
      </div>
    </div>
  );
};
