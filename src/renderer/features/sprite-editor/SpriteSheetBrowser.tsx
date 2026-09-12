import styles from "./SpriteEditor.module.scss";
import classnames from "classnames";
import { memo } from "react";
import { SpriteImage } from "./SpriteImage";
import ScrollViewer from "@renderer/controls/ScrollViewer";

type Props = {
  sprites: Uint8Array[];
  selectedIndex: number;
  palette: number[];
  transparencyIndex: number;
  separated: boolean;
  showTransparencyColor: boolean;
  onSelect: (index: number) => void;
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
    onSelect
  }: Props) => (
    <div className={styles.sheetPane}>
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
          />
            ))}
          </div>
        </ScrollViewer>
      </div>
    </div>
  )
);

type CellProps = {
  sprite: Uint8Array;
  index: number;
  selected: boolean;
  palette: number[];
  transparencyIndex: number;
  separated: boolean;
  showTransparencyColor: boolean;
  onSelect: (index: number) => void;
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
    onSelect
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
          [styles.separated]: separated
        })}
        onClick={() => onSelect(index)}
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
