import styles from "./SpriteEditor.module.scss";
import classnames from "classnames";
import { DragEvent, memo, useCallback, useState } from "react";
import { SpriteImage } from "./SpriteImage";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { SpriteSheetResizer } from "./SpriteSheetResizer";

type Props = {
  sprites: Uint8Array[];
  selectedIndex: number;
  palette: number[];
  transparencyIndex: number;
  separated: boolean;
  showTransparencyColor: boolean;
  onSelect: (index: number) => void;
  /** Reorder: move `from` to the insertion point `to` (see `moveSprite`). */
  onReorder: (from: number, to: number) => void;
  height: number;
  onResize: (height: number) => void;
  onResizeEnd: (height: number) => void;
  onResetHeight: () => void;
};

/**
 * The sheet, as a wrapping browser rather than a one-line strip.
 *
 * The strip it replaces was a fixed 70px band of horizontally scrolling thumbnails wedged between
 * the two toolbars, which meant a sheet of any size was read a few sprites at a time through a
 * letterbox. Wrapping trades horizontal scrolling - which nobody can aim at - for vertical, and
 * lets the pane show twenty sprites at once when there is room for them.
 */
export const SpriteSheetBrowser = memo(
  ({
    sprites,
    selectedIndex,
    palette,
    transparencyIndex,
    separated,
    showTransparencyColor,
    onSelect,
    onReorder,
    height,
    onResize,
    onResizeEnd,
    onResetHeight
  }: Props) => {
    /*
     * Reordering by dragging, following the document tabs' idiom: the dragged item is `draggable`,
     * the item under the pointer shows a 2px bar on the side the drop would land, and the drop is
     * one `moveSprite` edit.
     */
    const [dragFrom, setDragFrom] = useState<number | undefined>(undefined);
    const [dropAt, setDropAt] = useState<{ index: number; after: boolean } | undefined>(undefined);

    const endDrag = useCallback(() => {
      setDragFrom(undefined);
      setDropAt(undefined);
    }, []);

    const handleDrop = useCallback(() => {
      if (dragFrom !== undefined && dropAt) {
        onReorder(dragFrom, dropAt.index + (dropAt.after ? 1 : 0));
      }
      endDrag();
    }, [dragFrom, dropAt, endDrag, onReorder]);

    return (
    <div className={styles.sheetPane}>
      <SpriteSheetResizer
        height={height}
        onResize={onResize}
        onResizeEnd={onResizeEnd}
        onReset={onResetHeight}
      />
      <div className={styles.sectionHeader}>
        <span>Sheet</span>
        <span className={styles.statusSpacer} />
        <span className={styles.sheetCount}>
          {sprites.length} {sprites.length === 1 ? "sprite" : "sprites"}
        </span>
      </div>
      <div className={styles.sheetScroll}>
        <ScrollViewer allowHorizontal={false} thinScrollBar={true}>
          <div className={styles.sheetCells} role="listbox" aria-label="Sprite sheet">
            {sprites.map((sprite, index) => (
          <SheetCell
            key={index}
            sprite={sprite}
            index={index}
            selected={index === selectedIndex}
            palette={palette}
            transparencyIndex={transparencyIndex}
            separated={separated}
            showTransparencyColor={showTransparencyColor}
            onSelect={onSelect}
            dragging={dragFrom === index}
            dropSide={dropAt?.index === index ? (dropAt.after ? "after" : "before") : undefined}
            onDragStarted={setDragFrom}
            onDragOverCell={setDropAt}
            onDropped={handleDrop}
            onDragFinished={endDrag}
          />
            ))}
          </div>
        </ScrollViewer>
      </div>
    </div>
    );
  }
);

/**
 * The drag's own media type.
 *
 * Checked on `dragover` so the sheet only reacts to its own drags - a document tab, a file from the
 * OS or a text selection dragged over the sheet must not draw an insertion marker or reorder
 * anything. The *payload* cannot be read during `dragover` (only the type list is exposed), which is
 * why the source index is held in component state rather than read back from the event.
 */
const SPRITE_DRAG_MIME = "application/x-klive-sprite-index";

const isSpriteDrag = (e: DragEvent<HTMLElement>) =>
  e.dataTransfer.types.includes(SPRITE_DRAG_MIME);

type CellProps = {
  sprite: Uint8Array;
  index: number;
  selected: boolean;
  palette: number[];
  transparencyIndex: number;
  separated: boolean;
  showTransparencyColor: boolean;
  onSelect: (index: number) => void;
  dragging: boolean;
  dropSide?: "before" | "after";
  onDragStarted: (index: number) => void;
  onDragOverCell: (at: { index: number; after: boolean }) => void;
  onDropped: () => void;
  onDragFinished: () => void;
};

const SheetCell = memo(
  ({
    sprite,
    index,
    selected,
    palette,
    transparencyIndex,
    separated,
    showTransparencyColor,
    onSelect,
    dragging,
    dropSide,
    onDragStarted,
    onDragOverCell,
    onDropped,
    onDragFinished
  }: CellProps) => {
    const isEmpty = sprite.every((value) => value === transparencyIndex);
    return (
      <div
        role="option"
        aria-selected={selected}
        aria-label={`Sprite ${index + 1}${isEmpty ? " (empty)" : ""}`}
        tabIndex={selected ? 0 : -1}
        className={classnames(styles.sheetCell, {
          [styles.sheetCellSelected]: selected,
          [styles.separated]: separated,
          [styles.sheetCellDragging]: dragging,
          [styles.dragBefore]: dropSide === "before",
          [styles.dragAfter]: dropSide === "after"
        })}
        onClick={() => onSelect(index)}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(SPRITE_DRAG_MIME, String(index));
          e.dataTransfer.effectAllowed = "move";
          onDragStarted(index);
        }}
        onDragOver={(e) => {
          if (!isSpriteDrag(e)) return;
          // Without `preventDefault` the browser refuses the drop outright.
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          const r = e.currentTarget.getBoundingClientRect();
          onDragOverCell({ index, after: e.clientX > r.left + r.width / 2 });
        }}
        onDrop={(e) => {
          if (!isSpriteDrag(e)) return;
          e.preventDefault();
          onDropped();
        }}
        onDragEnd={onDragFinished}
      >
        <SpriteImage
          spriteMap={sprite}
          palette={palette}
          transparencyIndex={transparencyIndex}
          showTransparencyColor={showTransparencyColor}
          xclass={isEmpty ? styles.sheetEmpty : undefined}
        />
        <span className={styles.sheetIndex}>{index + 1}</span>
      </div>
    );
  }
);
