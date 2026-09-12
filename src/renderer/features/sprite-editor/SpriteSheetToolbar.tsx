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
  canPaste: boolean;
  /** True when a pixel region is marked, which is what Cut/Copy/Delete act on instead of the sprite. */
  hasSelection: boolean;
  separated: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onDuplicate: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: () => void;
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
    canPaste,
    hasSelection,
    separated,
    onUndo,
    onRedo,
    onDuplicate,
    onCut,
    onCopy,
    onPaste,
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
      {/*
        * Cut, Copy, Paste and Delete are four commands, not one.
        *
        * There used to be a single "Cut sprite" button that deleted, with a scissors icon and no
        * paste anywhere - a name that was simply untrue. Each of these acts on the marked pixel
        * region when there is one and on the whole sprite otherwise, which is why the labels say so.
        */}
      <SmallIconButton
        iconName="spr-cut"
        title={
          hasSelection
            ? "Cut region (Ctrl+X)"
            : "Cut sprite (Ctrl+X)\nMark a region with the select tool to cut pixels instead"
        }
        enable={hasSelection || spriteCount > 1}
        clicked={onCut}
      />
      <SmallIconButton
        iconName="spr-copy"
        title={hasSelection ? "Copy region (Ctrl+C)" : "Copy sprite (Ctrl+C)"}
        enable={true}
        clicked={onCopy}
      />
      <SmallIconButton
        iconName="spr-paste"
        title={"Paste (Ctrl+V)\nA pasted region floats until you place it"}
        enable={canPaste}
        clicked={onPaste}
      />
      <SmallIconButton
        iconName="spr-delete"
        title={hasSelection ? "Clear region (Delete)" : "Delete sprite"}
        enable={hasSelection || spriteCount > 1}
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
