import { useCallback, useState } from "react";
import classnames from "@renderer/utils/classnames";
import styles from "./Checkbox.module.scss";

type CheckboxProps = {
  label?: string;
  initialValue?: boolean;
  enabled?: boolean;
  right?: boolean;
  onChange?: (newValue: boolean) => void;
};

export const Checkbox = ({
  label,
  initialValue = false,
  enabled = true,
  right = false,
  onChange
}: CheckboxProps) => {
  const [value, setvalue] = useState(initialValue);

  const onInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange?.(event.target.checked);
    },
    [onChange]
  );

  return (
    <div className={styles.checkboxWrapper}>
    {!right && <label className={styles.left}>{label}</label>}
    <input
      type='checkbox'
      checked={value}
      disabled={!enabled}
      onClick={() => setvalue(!value)}
      onChange={onInputChange}
      className={classnames(styles.resetAppearance, styles.checkbox)}
      aria-checked={value}
    />
    {right && <label className={styles.right}>{label}</label>}
    </div>
  );
};
