import { useId } from "react";
import classnames from "classnames";
import styles from "./RadioGroup.module.scss";

export type RadioGroupOption = {
  value: string;
  label: string;
  /** Disable this one option while the rest stay selectable. */
  disabled?: boolean;
};

type RadioGroupProps = {
  options: RadioGroupOption[];
  value: string;
  onChange: (value: string) => void;
  /** Names the group for assistive technology. Supply it whenever no visible label sits nearby. */
  ariaLabel?: string;
  /** Lay the options out in this many columns. One column when omitted. */
  columns?: number;
  enabled?: boolean;
};

/**
 * A group of mutually exclusive options.
 *
 * Built on native `<input type="radio">` rather than styled buttons, so the whole keyboard
 * contract — one tab stop for the group, arrow keys to move *and* select, Home/End, label clicks —
 * comes from the platform instead of being reimplemented. Only the visuals are ours.
 */
export const RadioGroup = ({
  options,
  value,
  onChange,
  ariaLabel,
  columns = 1,
  enabled = true
}: RadioGroupProps) => {
  // --- One name per instance, or two groups on the same dialog would fight over one selection.
  const name = useId();

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={styles.group}
      style={columns > 1 ? { gridTemplateColumns: `repeat(${columns}, auto)` } : undefined}
    >
      {options.map((option) => {
        const id = `${name}-${option.value}`;
        const optionEnabled = enabled && !option.disabled;
        return (
          <div key={option.value} className={styles.option}>
            <input
              type="radio"
              id={id}
              name={name}
              value={option.value}
              checked={value === option.value}
              disabled={!optionEnabled}
              className={styles.radio}
              onChange={() => onChange(option.value)}
            />
            <label
              htmlFor={id}
              className={classnames(styles.label, { [styles.disabled]: !optionEnabled })}
            >
              {option.label}
            </label>
          </div>
        );
      })}
    </div>
  );
};
