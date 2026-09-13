import styles from "./SpriteEditor.module.scss";
import { memo, useSyncExternalStore } from "react";
import {
  getCssStringForPaletteCode,
  getRgbPartsForPaletteCode
} from "@emu/machines/zxNext/palette";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import { ColorSample } from "./ColorSample";
import { HoverStore } from "./sprite-hover";

type Props = {
  hover: HoverStore;
  palette: number[];
  transparencyIndex: number;
  spriteLabel: string;
};

/**
 * The readout at the foot of the canvas.
 *
 * Two things changed besides where it lives. It reported `(4:5)` - **row:column**, the reverse of
 * the x,y every other pixel tool in the world uses, and unlabelled, so there was nothing to say
 * which number was which. And the RGB triple was on the Next's 0-7 component scale with no hint
 * that it was, which reads as a broken 0-255 value.
 *
 * This is also the *only* thing that re-renders when the pointer moves: it subscribes to the hover
 * store directly, rather than having the position pushed up into `SpriteEditor`'s state, which used
 * to re-render the palette, both toolbars and every thumbnail once per pixel.
 */
export const SpriteStatusBar = memo(
  ({ hover, palette, transparencyIndex, spriteLabel }: Props) => {
    const position = useSyncExternalStore(hover.subscribe, hover.get, hover.get);
    const colorIndex = position?.colorIndex ?? -1;
    const code = colorIndex >= 0 ? palette[colorIndex] : undefined;
    const rgb = code !== undefined ? getRgbPartsForPaletteCode(code) : undefined;

    return (
      <div className={styles.statusBar}>
        {position ? (
          <span className={styles.statusValue}>
            <span className={styles.statusAxis}>x</span> {position.col}
            <span className={styles.statusAxis}>,</span>{" "}
            <span className={styles.statusAxis}>y</span> {position.row}
          </span>
        ) : (
          <span className={styles.statusMuted}>x &ndash;, y &ndash;</span>
        )}

        {colorIndex >= 0 && (
          <>
            <i className={styles.statusSeparator} />
            <ColorSample
              color={code}
              isTransparency={colorIndex === transparencyIndex}
              xclass={styles.colorSampleSmall}
            />
            <span className={styles.statusValue}>${toHexa2(colorIndex)}</span>
            <span className={styles.statusMuted}>{getCssStringForPaletteCode(code)}</span>
            {/* Named as 0-7, because that is the scale the Next's components are on. */}
            <span className={styles.statusMuted}>
              R{rgb[0]} G{rgb[1]} B{rgb[2]}
              <span className={styles.statusAxis}> /7</span>
            </span>
          </>
        )}

        <span className={styles.statusSpacer} />
        <span className={styles.statusMuted}>{spriteLabel}</span>
      </div>
    );
  }
);
