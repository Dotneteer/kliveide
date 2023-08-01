import { useCallback, useState } from "react";
import classnames from "@renderer/utils/classnames";
import styles from "./Checkbox.module.scss";

type CheckboxProps = {
  initialValue?: boolean;
  enabled?: boolean;
  onChange?: (newValue: boolean) => void;
};

export const Checkbox = ({
  initialValue = false,
  enabled = true,
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
    <input
      type='checkbox'
      checked={value}
      disabled={!enabled}
      onClick={() => setvalue(!value)}
      onChange={onInputChange}
      className={classnames(styles.resetAppearance, styles.checkbox)}
      aria-checked={value}
    />
  );
};
