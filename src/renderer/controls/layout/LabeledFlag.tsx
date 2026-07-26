import { Flag } from "./Flag";
import { Label } from "./Label";

type Props = {
  /** Width reserved for the label cell. */
  labelWidth?: number;
  /** Label text rendered before the flag. */
  label: string;
  /** Boolean state rendered by the flag cell. */
  value: boolean | number;
  /** Width reserved for the flag cell. */
  valueWidth?: number;
  /** Centers the flag within its cell when true. */
  center?: boolean;
  /** Optional tooltip shown for the label cell. */
  tooltip?: string;
  /** Optional tooltip shown for the flag cell. */
  valueTooltip?: string;
};

/**
 * Provides a label-flag pair for aligned boolean state rows.
 */
export const LabeledFlag = ({
  labelWidth,
  label,
  value,
  valueWidth,
  center,
  tooltip,
  valueTooltip
}: Props) => (
  <>
    <Label text={label} width={labelWidth} tooltip={tooltip} />
    <Flag value={value} tooltip={valueTooltip} width={valueWidth} center={center} />
  </>
);
