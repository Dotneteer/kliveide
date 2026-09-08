import classnames from "classnames";
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
  /**
   * Extra class merged onto the cell, for a caller that wants its own restyled value text (e.g.
   * the disassembly view's instruction column) without touching every other consumer of this
   * shared component.
   */
  className?: string;
};

/**
 * Provides fixed-width value text for aligned key-value rows.
 *
 * Delegates the cell to `controls/data`'s `DataValue`; see `Label` for why.
 */
export const Value = ({ text, width, tooltip, className }: Props) => {
  const ref = useTooltipRef();

  return (
    <>
      <DataValue
        ref={ref}
        text={text}
        width={cssWidth(width)}
        xclass={classnames(styles.legacyValueSpacing, className)}
      />
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
