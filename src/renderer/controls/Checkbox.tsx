import { useCallback, useEffect, useId, useState } from "react";
import classnames from "classnames";
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
  /*
   * The label has to be *associated* with the input, not merely next to it.
   *
   * These were siblings with no `htmlFor`/`id` between them, so the checkbox had no accessible name
   * at all: a screen reader announced "checkbox, unchecked" with nothing to say which one, and
   * `getByRole("checkbox", { name })` could not find it in a test. The visible click behaviour
   * worked, which is why it went unnoticed — the label carries its own `onClick`.
   */
  const inputId = useId();

  useEffect(() => {
    setvalue(initialValue);
  }, [initialValue]);

  const onInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setvalue(event.target.checked);
      onChange?.(event.target.checked);
    },
    [onChange]
  );

  const labelCtrl = (
    <label
      htmlFor={inputId}
      className={classnames({
        [styles.left]: !right,
        [styles.right]: right,
        [styles.disabled]: !enabled
      })}
    >
      {label}
    </label>
  );

  return (
    <div className={styles.checkboxWrapper}>
      {!right && labelCtrl}
      {/*
        * One handler, on the input.
        *
        * The label used to carry its own `onClick` that toggled the state and called `onChange`,
        * because without `htmlFor` a click on it reached nothing. Now that the two are associated,
        * the browser forwards a label click to the input — so keeping that handler would toggle
        * twice for one click. `onChange` alone is also enough on the input itself: the extra
        * `onClick={() => setvalue(!value)}` here duplicated what `onInputChange` already does, and
        * the two disagreed about the source of truth (local state vs the DOM's `checked`).
        */}
      <input
        id={inputId}
        type='checkbox'
        checked={value}
        disabled={!enabled}
        onChange={onInputChange}
        className={classnames(styles.resetAppearance, styles.checkbox)}
        aria-checked={value}
      />
      {right && labelCtrl}
    </div>
  );
};
