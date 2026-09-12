import styles from "./SpriteEditor.module.scss";
import { memo } from "react";
import { SmallIconButton } from "@renderer/controls/IconButton";
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
const DRAW_HINT = "\nRight-drag paints with the fill colour";

const TOOLS: Array<{ tool: SpriteTools; icon: string; title: string }> = [
  // "Pointer tool" was labelled "Pencil tool" - a copy-paste that also reached `aria-label`, so a
  // screen reader was offered two indistinguishable buttons. It becomes "Select" in Phase 8.
  { tool: "pointer", icon: "spr-pointer", title: "Pointer tool (M)" },
  { tool: "pencil", icon: "spr-pencil", title: "Pencil tool (P)" + DRAW_HINT },
  { tool: "line", icon: "spr-line", title: "Line tool (L)" + DRAW_HINT },
  { tool: "rectangle", icon: "spr-rect", title: "Rectangle tool (R)" + DRAW_HINT },
  { tool: "rectangle-filled", icon: "spr-rect-filled", title: "Filled rectangle tool (Shift+R)" + DRAW_HINT },
  { tool: "circle", icon: "spr-circle", title: "Circle tool (E)" + DRAW_HINT },
  { tool: "circle-filled", icon: "spr-circle-filled", title: "Filled circle tool (Shift+E)" + DRAW_HINT },
  { tool: "paint", icon: "spr-bucket", title: "Paint tool (F)" + DRAW_HINT }
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
  ({ tool, onSelectTool, onRotateCcw, onRotateCw, onFlipHorizontal, onFlipVertical }: Props) => (
    <div className={styles.toolRail} role="toolbar" aria-orientation="vertical" aria-label="Tools">
      {TOOLS.map((entry) => (
        <SmallIconButton
          key={entry.tool}
          iconName={entry.icon}
          title={entry.title}
          selected={tool === entry.tool}
          clicked={() => onSelectTool(entry.tool)}
        />
      ))}
      <i className={styles.railSeparator} />
      <SmallIconButton
        iconName="spr-rotate-ccw"
        title={"Rotate counter-clockwise"}
        clicked={onRotateCcw}
      />
      <SmallIconButton
        iconName="spr-rotate-cw"
        title={"Rotate clockwise"}
        clicked={onRotateCw}
      />
      {/*
       * These two were crossed: "Flip vertically" mirrored columns (a left-to-right flip) and
       * "Flip horizontally" mirrored rows. Each now does what its label and its icon say.
       */}
      <SmallIconButton iconName="spr-flip-v" title={"Flip vertically"} clicked={onFlipVertical} />
      <SmallIconButton
        iconName="spr-flip-h"
        title={"Flip horizontally"}
        clicked={onFlipHorizontal}
      />
    </div>
  )
);
