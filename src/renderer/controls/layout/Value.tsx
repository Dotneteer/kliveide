import classnames from "classnames";
import type { ReactNode } from "react";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import { DataValue } from "@renderer/controls/data";
import styles from "./Layout.module.scss";

type Props = {
  /** Value text rendered in the aligned cell. */
  text: string;
  /**
   * Rich content drawn in place of `text` — see `DataValue`. `text` is still what the cell *means*,
   * so pass both: the tooltip and anything reading the row keep working.
   */
  children?: ReactNode;
  /**
   * Explicit value cell width, as a CSS length **with its unit** — `"7ch"` for a column, `"32px"`
   * for chrome. The bare-number form was removed in Phase 15: it meant px here and `ch` in
   * `controls/data`, and all three of these cells documented it as `ch`, which is how
   * `NecUpd765Panel` acquired a 16px column from an author who read the prop.
   */
  width?: string;
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
export const Value = ({ text, children, width, tooltip, className }: Props) => {
  const ref = useTooltipRef();

  return (
    <>
      <DataValue
        ref={ref}
        text={text}
        children={children}
        width={width}
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
