import { Label } from "./Label";
import { Value } from "./Value";

type Props = {
  /** Width reserved for the label cell. */
  labelWidth?: number;
  /** Label text rendered before the value. */
  label: string;
  /** Width reserved for the value cell. */
  valueWidth?: number;
  /** Value text rendered after the label. */
  value: string;
  /** Optional tooltip shown for the label cell. */
  tooltip?: string;
  /** Optional tooltip shown for the value cell. */
  valueTooltip?: string;
  /**
   * Extra class merged onto the *value* cell, for a panel that wants its values in a colour of its
   * own. Same opt-in shape as `Flag`'s `iconFill` and `controls/data/registers`' `valueXclass`: the
   * shared `--data-*` hierarchy stays neutral, and a panel that wants real colour layers a token on
   * top of the value alone.
   */
  valueClassName?: string;
};

/**
 * Provides a label-value pair for aligned text rows.
 */
export const LabeledText = ({
  labelWidth,
  label,
  valueWidth,
  value,
  tooltip,
  valueTooltip,
  valueClassName
}: Props) => (
  <>
    <Label text={label} width={labelWidth} tooltip={tooltip} />
    <Value text={value} width={valueWidth} tooltip={valueTooltip} className={valueClassName} />
  </>
);
