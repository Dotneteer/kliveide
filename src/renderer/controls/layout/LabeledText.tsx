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
  valueTooltip
}: Props) => (
  <>
    <Label text={label} width={labelWidth} tooltip={tooltip} />
    <Value text={value} width={valueWidth} tooltip={valueTooltip} />
  </>
);
