import { DataSecondary } from "@renderer/controls/data";
import { cssWidth } from "./cssWidth";

type Props = {
  /** Low-emphasis text rendered in the aligned cell. */
  text: string;
  /** Explicit secondary text cell width. A number is `ch` (M2); a string is a CSS length. */
  width?: string | number;
};

/**
 * Provides secondary text for low-emphasis values in compact rows.
 *
 * Delegates to `controls/data`'s `DataSecondary`; see `Label` for why.
 */
export const Secondary = ({ text, width }: Props) => (
  <DataSecondary text={text} width={cssWidth(width)} />
);
