import styles from "./LabeledValue.module.scss";
import { Label, Value } from "./Labels";

const LAB_WIDTH = 48;
const VAL_WIDTH = 48;

type Props = {
  label: string;
  width?: number;
  value: number | string;
  valueWidth?: number;
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
