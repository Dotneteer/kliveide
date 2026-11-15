import { memo } from "react";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { Text } from "@renderer/controls/layout/Text";
import { useT } from "@common/i18n/useT";
import {
  spriteSegmentClass,
  spriteSegmentedClass
} from "@renderer/controls/Next/sprites/SpritePatternSheet";
import type { MessageKey } from "@common/i18n/keys.generated";
import styles from "./SpriteEditor.module.scss";
import type { SprFormat } from "./sprite-file";

const FORMATS: { value: SprFormat; labelKey: MessageKey; titleKey: MessageKey }[] = [
  { value: "8bit", labelKey: "panels.spriteEditor.format.8bit", titleKey: "panels.spriteEditor.format.8bitTitle" },
  { value: "4bit", labelKey: "panels.spriteEditor.format.4bit", titleKey: "panels.spriteEditor.format.4bitTitle" }
];

type Props = {
  spriteCount: number;
  selectedIndex: number;
  canUndo: boolean;
  canRedo: boolean;
  canPaste: boolean;
  /** True when a pixel region is marked, which is what Cut/Copy/Delete act on instead of the sprite. */
  hasSelection: boolean;
  separated: boolean;
  /** How the file's bytes are read. Switching never changes the file. */
  format: SprFormat;
  onSetFormat: (format: SprFormat) => void;
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
    format,
    onSetFormat,
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
  }: Props) => {
    const t = useT();
    return (
    <div className={styles.sheetToolbar} role="toolbar" aria-label={t("panels.spriteEditor.sheet")}>
      <SmallIconButton iconName="undo" title={t("panels.spriteEditor.undo")} enable={canUndo} clicked={onUndo} />
      <SmallIconButton iconName="redo" title={t("panels.spriteEditor.redo")} enable={canRedo} clicked={onRedo} />
      <ToolbarSeparator small={true} />
      <SmallIconButton
        iconName="spr-duplicate"
        title={t("panels.spriteEditor.duplicate")}
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
            ? t("panels.spriteEditor.cutRegion")
            : t("panels.spriteEditor.cutSprite")
        }
        enable={hasSelection || spriteCount > 1}
        clicked={onCut}
      />
      <SmallIconButton
        iconName="spr-copy"
        title={hasSelection ? t("panels.spriteEditor.copyRegion") : t("panels.spriteEditor.copySprite")}
        enable={true}
        clicked={onCopy}
      />
      <SmallIconButton
        iconName="spr-paste"
        title={t("panels.spriteEditor.paste")}
        enable={canPaste}
        clicked={onPaste}
      />
      <SmallIconButton
        iconName="spr-delete"
        title={hasSelection ? t("panels.spriteEditor.clearRegion") : t("panels.spriteEditor.deleteSprite")}
        enable={hasSelection || spriteCount > 1}
        clicked={onDelete}
      />
      <SmallIconButton
        iconName="spr-move-left"
        title={t("panels.spriteEditor.moveLeft")}
        enable={selectedIndex > 0}
        clicked={onMoveLeft}
      />
      <SmallIconButton
        iconName="spr-move-right"
        title={t("panels.spriteEditor.moveRight")}
        enable={selectedIndex < spriteCount - 1}
        clicked={onMoveRight}
      />
      <SmallIconButton
        iconName="plus"
        title={t("panels.spriteEditor.add")}
        enable={spriteCount > 0}
        clicked={onAdd}
      />
      <ToolbarSeparator small={true} />
      <SmallIconButton
        iconName="spr-separate"
        title={separated ? t("panels.spriteEditor.merge") : t("panels.spriteEditor.separate")}
        selected={separated}
        enable={true}
        clicked={onToggleSeparated}
      />
      <ToolbarSeparator small={true} />
      {/* The same segmented control, and the same words, as the Sprite Inspector's format switch */}
      <span className={spriteSegmentedClass} role="group" aria-label={t("panels.spriteEditor.format.group")}>
        {FORMATS.map((f) => (
          <button
            key={f.value}
            type="button"
            className={spriteSegmentClass}
            aria-pressed={format === f.value}
            title={t(f.titleKey)}
            onClick={() => onSetFormat(f.value)}
          >
            {t(f.labelKey)}
          </button>
        ))}
      </span>
      {spriteCount > 0 && (
        <>
          <ToolbarSeparator small={true} />
          <LabelSeparator width={8} />
          <Text text={t("panels.spriteEditor.position", { index: selectedIndex + 1, count: spriteCount })} />
        </>
      )}
    </div>
    );
  }
);
