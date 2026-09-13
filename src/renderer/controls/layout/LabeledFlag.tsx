import { Flag } from "./Flag";
import { Label } from "./Label";

type Props = {
  /** Width reserved for the label cell. */
  /** Label cell width as a CSS length with its unit — `"7ch"` for a column, `"32px"` for chrome (Phase 15). */
  labelWidth?: string;
  /** Label text rendered before the flag. */
  label: string;
  /** Boolean state rendered by the flag cell. */
  value: boolean | number;
  /** Width reserved for the flag cell. */
  /** Value cell width as a CSS length with its unit — `"7ch"` for a column, `"32px"` for chrome (Phase 15). */
  valueWidth?: string;
  /** Centers the flag within its cell when true. */
  center?: boolean;
  /** Optional tooltip shown for the label cell. */
  tooltip?: string;
  /** Optional tooltip shown for the flag cell. */
  valueTooltip?: string;
  /**
   * The theme property the indicator is filled with — see `Flag`. Defaults there to the neutral
   * `--color-value`; a panel that wants its flags in its own colour passes `--color-state-value`.
   */
  iconFill?: string;
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
  valueTooltip,
  iconFill
}: Props) => (
  <>
    <Label text={label} width={labelWidth} tooltip={tooltip} />
    <Flag
      value={value}
      tooltip={valueTooltip}
      width={valueWidth}
      center={center}
      iconFill={iconFill}
    />
  </>
);
