import { Flag } from "./Flag";
import { Label } from "./Label";

type Props = {
  labelWidth?: number;
  label: string;
  value: boolean;
  valueWidth?: number;
  tooltip?: string;
  valueTooltip?: string;
};

export const LabeledFlag = ({
  labelWidth,
  label,
  value,
  valueWidth,
  tooltip,
  valueTooltip
}: Props) => {
  return (
    <>
      <Label text={label} width={labelWidth} tooltip={tooltip} />
      <Flag value={value} tooltip={valueTooltip} width={valueWidth} />
    </>
  );
};
