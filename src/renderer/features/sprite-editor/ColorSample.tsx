import styles from "./SpriteEditor.module.scss";
import classnames from "classnames";
import { memo } from "react";
import {
  getCssStringForPaletteCode,
  getLuminanceForPaletteCode
} from "@emu/machines/zxNext/palette";

type Props = {
  color: number;
  isTransparency?: boolean;
  xclass?: string;
};

/** A single colour swatch, with a mark that stays visible on whatever it is drawn over. */
export const ColorSample = memo(({ color, isTransparency, xclass }: Props) => {
  const backgroundColor = getCssStringForPaletteCode(color);
  const midColor = getLuminanceForPaletteCode(color) < 3.5 ? "white" : "black";

  return (
    <div className={classnames(styles.colorSample, xclass)} style={{ backgroundColor }}>
      {isTransparency && (
        /*
         * `width`/`height` are not optional here.
         *
         * An `<svg>` with a `viewBox` and no intrinsic size takes the CSS replaced-element default
         * of **300x150** — inside a 20px swatch. Only the absence of a background on the overflow
         * kept that invisible, and it made the mark's own geometry meaningless. This is the same
         * defect §13.2 fixed in the palette grid, in a file that phase did not reach.
         */
        <svg viewBox="0 0 16 16" width="100%" height="100%" className={styles.transparencyMark}>
          <circle cx={8} cy={8} r={5} fill={midColor} fillOpacity={0.5} />
        </svg>
      )}
    </div>
  );
});
