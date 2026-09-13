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
        <svg viewBox="0 0 16 16">
          <circle cx={8} cy={8} r={5} fill={midColor} fillOpacity={0.5} />
        </svg>
      )}
    </div>
  );
});
