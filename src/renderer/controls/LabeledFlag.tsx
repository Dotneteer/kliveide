import styles from "./LabeledFlag.module.scss";
import { Flag, Label } from "./Labels";

const LAB_WIDTH = 48;
const FLAG_WIDTH = 16;

type Props = {
  label: string;
  width?: number;
  value: boolean;
  flagWidth?: number;
  toolTip?: string;
  center?: boolean;
};
export const LabeledFlag = ({
  label,
  width = LAB_WIDTH,
  value,
  flagWidth = FLAG_WIDTH,
  toolTip,
  center
}: Props) => {
  return (
    <div className={styles.cols}>
      <Label text={label} width={width} />
      <Flag value={value} tooltip={toolTip} width={flagWidth} center={center} />
    </div>
  );
};
