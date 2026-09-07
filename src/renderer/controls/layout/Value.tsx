import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import { cssWidth } from "./cssWidth";
import { DataValue } from "@renderer/controls/data";
import styles from "./Layout.module.scss";

type Props = {
  /** Value text rendered in the aligned cell. */
  text: string;
  /** Explicit value cell width. A number is `ch` (M2); a string is a CSS length. */
  width?: string | number;
  /** Optional tooltip shown for the value cell. */
  tooltip?: string;
};

/**
 * Provides fixed-width value text for aligned key-value rows.
 *
 * Delegates the cell to `controls/data`'s `DataValue`; see `Label` for why.
 */
export const Value = ({ text, width, tooltip }: Props) => {
  const ref = useTooltipRef();

  return (
    <>
      <DataValue ref={ref} text={text} width={cssWidth(width)} xclass={styles.legacyValueSpacing} />
      {tooltip && (
        <TooltipFactory
          refElement={ref.current}
          placement="right"
          offsetX={-8}
          offsetY={24}
          showDelay={100}
          content={tooltip}
        />
      )}
    </>
  );
};
