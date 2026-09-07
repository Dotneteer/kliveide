import { DataSecondary } from "@renderer/controls/data";
import { cssWidth } from "./cssWidth";

type Props = {
  /** Low-emphasis text rendered in the aligned cell. */
  text: string;
  /** Explicit secondary text cell width. A number is `ch` (M2); a string is a CSS length. */
  width?: string | number;
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
export const Secondary = ({ text, width, className }: Props) => (
  <DataSecondary text={text} width={cssWidth(width)} xclass={className} />
);
