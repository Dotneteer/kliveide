import React, { useCallback, useEffect, useMemo, useState } from "react";
import classnames from "classnames";
import styles from "./Checkbox.module.scss";

/**
 * Props for the Checkbox component
 */
export interface CheckboxProps {
  /** Label text to display next to the checkbox */
  label?: string;
  /** Initial value (checked state) of the checkbox */
  initialValue?: boolean;
  /** Whether the checkbox is enabled/interactive */
  enabled?: boolean;
  /** When true, label appears on the right side of checkbox */
  right?: boolean;
  /** Handler called when checkbox state changes */
  onChange?: (newValue: boolean) => void;
  /** Optional ID for the checkbox input */
  id?: string;
}

/**
 * A custom checkbox component with support for labels, disabled state, and positioning
 * 
 * Can be used in controlled mode (with onChange handler managing state externally)
 * or uncontrolled mode (managing its own state internally)
 */
export const Checkbox = React.memo(({
  label,
  initialValue = false,
  enabled = true,
  right = false,
  onChange,
  id
}: CheckboxProps): JSX.Element => {
  // Generate unique ID for input-label association if not provided
  const uniqueId = useMemo(() => id || `checkbox-${Math.random().toString(36).substring(2, 9)}`, [id]);
  
  // Internal state for uncontrolled usage
  const [value, setValue] = useState(initialValue);

  // Sync internal state when initialValue prop changes
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  // Memoize label class names
  const labelClassNames = useMemo(() => 
    classnames({
      [styles.left]: !right,
      [styles.right]: right,
      [styles.disabled]: !enabled
    }),
    [right, enabled]
  );

  // Memoize input class names
  const inputClassNames = useMemo(() => 
    classnames(styles.resetAppearance, styles.checkbox),
    []
  );

  // Consolidated handler for state changes
  const handleChange = useCallback((newValue: boolean) => {
    if (!enabled) return;
    
    setValue(newValue);
    onChange?.(newValue);
  }, [enabled, onChange]);

  // Input change handler
  const onInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      handleChange(event.target.checked);
    },
    [handleChange]
  );

  // Label click handler
  const onLabelClick = useCallback(() => {
    if (enabled) {
      handleChange(!value);
    }
  }, [enabled, value, handleChange]);

  const labelCtrl = (
    <label
      htmlFor={uniqueId}
      className={labelClassNames}
      onClick={onLabelClick}
    >
      {label}
    </label>
  );

  return (
    <div className={styles.checkboxWrapper}>
      {!right && labelCtrl}
      <input
        id={uniqueId}
        type='checkbox'
        checked={value}
        disabled={!enabled}
        onChange={onInputChange}
        className={inputClassNames}
        aria-checked={value}
        role="checkbox"
        aria-disabled={!enabled}
      />
      {right && labelCtrl}
    </div>
  );
});
