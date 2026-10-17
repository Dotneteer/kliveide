import styles from "./SpriteEditor.module.scss";
import { memo } from "react";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { useT } from "@common/i18n/useT";
import type { MessageKey } from "@common/i18n/keys.generated";
import { SpriteTools } from "./sprite-common";

type Props = {
  tool: SpriteTools;
  onSelectTool: (tool: SpriteTools) => void;
  onRotateCcw: () => void;
  onRotateCw: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
};

/*
 * The shortcut belongs in the tooltip.
 *
 * A keyboard map nobody can see is a keyboard map nobody uses, and this editor has no other place
 * to publish one. The right-drag note is the same problem: painting with the fill colour by holding
 * the right button has always worked and has never once been mentioned in the UI.
 */
const TOOLS: Array<{ tool: SpriteTools; icon: string; titleKey: MessageKey; draws: boolean }> = [
  // Labelled "Pencil tool" until Phase 1 - a copy-paste that also reached `aria-label`, so a screen
  // reader was offered two indistinguishable buttons - and named for doing nothing until Phase 8.
  { tool: "select", icon: "spr-pointer", titleKey: "panels.spriteEditor.tool.select", draws: false },
  { tool: "pencil", icon: "spr-pencil", titleKey: "panels.spriteEditor.tool.pencil", draws: true },
  { tool: "line", icon: "spr-line", titleKey: "panels.spriteEditor.tool.line", draws: true },
  { tool: "rectangle", icon: "spr-rect", titleKey: "panels.spriteEditor.tool.rectangle", draws: true },
  { tool: "rectangle-filled", icon: "spr-rect-filled", titleKey: "panels.spriteEditor.tool.rectangleFilled", draws: true },
  { tool: "circle", icon: "spr-circle", titleKey: "panels.spriteEditor.tool.circle", draws: true },
  { tool: "circle-filled", icon: "spr-circle-filled", titleKey: "panels.spriteEditor.tool.circleFilled", draws: true },
  { tool: "paint", icon: "spr-bucket", titleKey: "panels.spriteEditor.tool.paint", draws: true }
];

/**
 * Tools, in a rail against the canvas.
 *
 * They used to sit in a horizontal toolbar *below the sprite strip*, which put the pencil three
 * strips away from the pixel it draws on and spent a full row of the pane's height saying so. A
 * rail costs one narrow column, puts every tool within a few pixels of the artwork, and leaves the
 * height for the thing being edited.
 */
export const SpriteToolRail = memo(
  ({ tool, onSelectTool, onRotateCcw, onRotateCw, onFlipHorizontal, onFlipVertical }: Props) => {
    const t = useT();
    return (
    <div className={styles.toolRail} role="toolbar" aria-orientation="vertical" aria-label={t("panels.spriteEditor.tools")}>
      {TOOLS.map((entry) => (
        <SmallIconButton
          key={entry.tool}
          iconName={entry.icon}
          title={entry.draws ? `${t(entry.titleKey)}\n${t("panels.spriteEditor.drawHint")}` : t(entry.titleKey)}
          selected={tool === entry.tool}
          clicked={() => onSelectTool(entry.tool)}
        />
      ))}
      <i className={styles.railSeparator} />
      <SmallIconButton
        iconName="spr-rotate-ccw"
        title={t("panels.spriteEditor.rotateCcw")}
        clicked={onRotateCcw}
      />
      <SmallIconButton
        iconName="spr-rotate-cw"
        title={t("panels.spriteEditor.rotateCw")}
        clicked={onRotateCw}
      />
      {/*
       * These two were crossed: "Flip vertically" mirrored columns (a left-to-right flip) and
       * "Flip horizontally" mirrored rows. Each now does what its label and its icon say.
       */}
      <SmallIconButton iconName="spr-flip-v" title={t("panels.spriteEditor.flipVertical")} clicked={onFlipVertical} />
      <SmallIconButton
        iconName="spr-flip-h"
        title={t("panels.spriteEditor.flipHorizontal")}
        clicked={onFlipHorizontal}
      />
    </div>
    );
  }
);
