import styles from "./LabeledValue.module.scss";
import { Label } from "@renderer/controls/layout/Label";
import { Value } from "@renderer/controls/layout/Value";

// M2: `ch`, not px. Capacity preserved from the px width at its old 12.8px size (px / 6.4).
const LAB_WIDTH = "8ch";
const VAL_WIDTH = "8ch";

type Props = {
  label: string;
  /** Label cell width as a CSS length with its unit — `"7ch"` for a column, `"32px"` for chrome (Phase 15). */
  width?: string;
  value: number | string;
  /** Value cell width as a CSS length with its unit — `"7ch"` for a column, `"32px"` for chrome (Phase 15). */
  valueWidth?: string;
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
