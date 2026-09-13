import styles from "./LabeledFlag.module.scss";
import { Flag } from "@renderer/controls/layout/Flag";
import { Label } from "@renderer/controls/layout/Label";

// M2: `ch`, not px. Capacity preserved from the px width at its old 12.8px size (px / 6.4).
const LAB_WIDTH = "8ch";
const FLAG_WIDTH = "3ch"; // 16px / 6.4 = 2.5

type Props = {
  label: string;
  /** Label cell width as a CSS length with its unit — `"7ch"` for a column, `"32px"` for chrome (Phase 15). */
  width?: string;
  value: boolean;
  flagWidth?: string | number;
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
