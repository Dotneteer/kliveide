import { memo } from "react";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { Text } from "@renderer/controls/layout/Text";
import styles from "./SpriteEditor.module.scss";

type Props = {
  spriteCount: number;
  selectedIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  separated: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMoveLeft: () => void;
  onMoveRight: () => void;
  onAdd: () => void;
  onToggleSeparated: () => void;
};

/**
 * Sheet-level operations.
 *
 * Defined at module level, not inside `SpriteEditor`. Both toolbars used to be declared in the
 * component body and rendered as `<SpriteFileToolbar />`, so their function *identity* changed on
 * every render - which makes React treat each render as a different component type and unmount and
 * remount the whole toolbar, every `SmallIconButton` and every attached tooltip popper with it.
 * `GenericFilePanel` documents exactly this hazard one level up; the editor reintroduced it one
 * level down.
 */
export const SpriteSheetToolbar = memo(
  ({
    spriteCount,
    selectedIndex,
    canUndo,
    canRedo,
    separated,
    onUndo,
    onRedo,
    onDuplicate,
    onDelete,
    onMoveLeft,
    onMoveRight,
    onAdd,
    onToggleSeparated
  }: Props) => (
    <div className={styles.sheetToolbar} role="toolbar" aria-label="Sheet">
      <SmallIconButton iconName="undo" title={"Undo (Ctrl+Z)"} enable={canUndo} clicked={onUndo} />
      <SmallIconButton iconName="redo" title={"Redo (Ctrl+Shift+Z)"} enable={canRedo} clicked={onRedo} />
      <ToolbarSeparator small={true} />
      <SmallIconButton
        iconName="spr-duplicate"
        title={"Duplicate sprite"}
        enable={spriteCount > 0}
        clicked={onDuplicate}
      />
      <SmallIconButton
        iconName="spr-delete"
        // No clipboard yet, so this is a delete. It gets a real Cut - and a separate Delete -
        // in plan Phase 8.
        title={"Delete sprite"}
        enable={spriteCount > 1}
        clicked={onDelete}
      />
      <SmallIconButton
        iconName="spr-move-left"
        title={"Move sprite left\nSelect the previous sprite with ["}
        enable={selectedIndex > 0}
        clicked={onMoveLeft}
      />
      <SmallIconButton
        iconName="spr-move-right"
        title={"Move sprite right\nSelect the next sprite with ]"}
        enable={selectedIndex < spriteCount - 1}
        clicked={onMoveRight}
      />
      <SmallIconButton
        iconName="plus"
        title={"Add new sprite"}
        enable={spriteCount > 0}
        clicked={onAdd}
      />
      <ToolbarSeparator small={true} />
      <SmallIconButton
        iconName="spr-separate"
        title={`${separated ? "Merge" : "Separate"} sprites vertically`}
        selected={separated}
        enable={true}
        clicked={onToggleSeparated}
      />
      {spriteCount > 0 && (
        <>
          <ToolbarSeparator small={true} />
          <LabelSeparator width={8} />
          <Text text={`Sprite #${selectedIndex + 1} of ${spriteCount}`} />
        </>
      )}
    </div>
  )
);
