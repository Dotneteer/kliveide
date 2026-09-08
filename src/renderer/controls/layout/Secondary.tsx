import { DataSecondary } from "@renderer/controls/data";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import { cssWidth } from "./cssWidth";

type Props = {
  /** Low-emphasis text rendered in the aligned cell. */
  text: string;
  /** Explicit secondary text cell width. A number is `ch` (M2); a string is a CSS length. */
  width?: string | number;
  /**
   * Optional tooltip shown for the cell.
   *
   * `Label` and `Value` have always had this; `Secondary` did not, which meant a panel could not
   * explain its low-emphasis column without wrapping the cell in an element of its own and
   * disturbing the row's flex layout. Same `TooltipFactory` wiring as `Value`.
   */
  tooltip?: string;
  /**
   * Extra class merged onto the cell, for a caller that wants its own restyled secondary text
   * (e.g. the disassembly view's accent-tinted opcode column) without touching every other
   * consumer of this shared component.
   */
  className?: string;
};

/**
 * Provides secondary text for low-emphasis values in compact rows.
 *
 * Delegates to `controls/data`'s `DataSecondary`; see `Label` for why.
 */
export const Secondary = ({ text, width, tooltip, className }: Props) => {
  const ref = useTooltipRef();

  return (
    <>
      <DataSecondary ref={ref} text={text} width={cssWidth(width)} xclass={className} />
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
