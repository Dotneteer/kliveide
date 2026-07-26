import { Label } from "./Label";
import { Value } from "./Value";

type Props = {
  labelWidth?: number;
  label: string;
  valueWidth?: number;
  value: string;
  tooltip?: string;
  valueTooltip?: string;
};

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
