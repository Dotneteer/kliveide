import styles from "./LabeledValue.module.scss";
import { Label } from "@renderer/controls/layout/Label";
import { Value } from "@renderer/controls/layout/Value";

// M2: `ch`, not px. Capacity preserved from the px width at its old 12.8px size (px / 6.4).
const LAB_WIDTH = "8ch";
const VAL_WIDTH = "8ch";

type Props = {
  label: string;
  width?: string | number;
  value: number | string;
  valueWidth?: string | number;
  toolTip?: string;
};
export const LabeledValue = ({
  label,
  width = LAB_WIDTH,
  value,
  valueWidth = VAL_WIDTH,
  toolTip
}: Props) => {
  return (
    <div className={styles.cols}>
      <Label text={label} width={width} />
      <Value text={value?.toString()} tooltip={toolTip} width={valueWidth} />
    </div>
  );
};
