import { DataSecondary } from "@renderer/controls/data";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";

type Props = {
  /** Low-emphasis text rendered in the aligned cell. */
  text: string;
  /**
   * Explicit secondary text cell width, as a CSS length **with its unit** — `"7ch"` for a column, `"32px"`
   * for chrome. The bare-number form was removed in Phase 15: it meant px here and `ch` in
   * `controls/data`, and all three of these cells documented it as `ch`, which is how
   * `NecUpd765Panel` acquired a 16px column from an author who read the prop.
   */
  width?: string;
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
      <DataSecondary ref={ref} text={text} width={width} xclass={className} />
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
