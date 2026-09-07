import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import { cssWidth } from "./cssWidth";
import { DataLabel } from "@renderer/controls/data";
import classnames from "classnames";
import styles from "./Layout.module.scss";

type Props = {
  /** Label text rendered in the aligned cell. */
  text: string;
  /** Explicit label cell width. A number is `ch` (M2); a string is a CSS length. */
  width?: string | number;
  /** Centers label text within the cell when true. */
  center?: boolean;
  /** Optional tooltip shown for the label cell. */
  tooltip?: string;
};

/**
 * Provides fixed-width label text for aligned key-value rows.
 *
 * The cell itself is `controls/data`'s `DataLabel`; this wrapper adds only the `TooltipFactory`
 * behaviour and the legacy inline spacing. Klive had three separate `.label`/`.value`
 * implementations — here, in `controls/valuedisplay`, and in `controls/data` — and this is the one
 * with 21 importers, so it delegates rather than being rewritten at every call site.
 */
export const Label = ({ text, width, center, tooltip }: Props) => {
  const ref = useTooltipRef();

  return (
    <>
      <DataLabel
        ref={ref}
        text={text}
        width={cssWidth(width)}
        xclass={classnames(styles.legacySpacing, { [styles.centered]: center })}
      />
      {tooltip && (
        <TooltipFactory
          refElement={ref.current}
          placement="right"
          offsetX={0}
          offsetY={0}
          showDelay={100}
          content={tooltip}
        />
      )}
    </>
  );
};
