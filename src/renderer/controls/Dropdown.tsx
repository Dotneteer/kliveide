import styles from "./Dropdown.module.scss";
import * as Select from "@radix-ui/react-select";
import { Icon } from "./Icon";
import { useOverlayRoot } from "@renderer/controls/overlay/useOverlayRoot";
import { useEffect, useState } from "react";

export type DropdownOption = {
  value: string;
  label: string;
  /**
   * A longer gloss shown beside the label while the list is open.
   *
   * The trigger shows only the label, so what you pick is what you keep seeing — the option's
   * identity — while the open list has room to explain it ("R0" / "ROM 0").
   */
  description?: string;
};

type Props = {
  options: DropdownOption[];
  /**
   * Accessible name for the trigger.
   *
   * A dropdown whose meaning comes from the column it sits in — a toolbar, a dialog's tool row —
   * has no visible label to be named by, and the trigger is a bare button, so without this it
   * reaches a screen reader as only its current value.
   */
  ariaLabel?: string;
  placeholder?: string;
  initialValue?: string;
  width?: string | number;
  maxHeight?: string | number;
  /**
   * Whether the control can be opened. `true` by default.
   *
   * Added because two call sites were working around its absence, and one of them was working
   * around it *wrongly*: `StartModeSelector` wrapped the dropdown in
   * `style={{ pointerEvents: "none", opacity: .4 }}`, which greys the trigger and blocks the mouse
   * but does nothing about the keyboard — the trigger stayed in the tab order and still opened.
   * Radix's own `disabled` takes it out of the tab order and marks it for assistive technology.
   *
   * Named `enabled` rather than `disabled` to match `Checkbox`, `RadioGroup` and `Button`, which is
   * the convention this codebase already reads in.
   */
  enabled?: boolean;
  /** Test hook, forwarded to the trigger. */
  testId?: string;
  onChanged?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
};

export default function Dropdown({
  options,
  ariaLabel,
  placeholder,
  initialValue,
  width,
  maxHeight,
  enabled = true,
  testId,
  onChanged,
  onOpenChange,
}: Props) {
  const rootElement = useOverlayRoot();
  const [selectedValue, setSelectedValue] = useState(initialValue);

  useEffect(() => {
    setSelectedValue(initialValue);
  }, [initialValue]);

  return (
    <Select.Root
      disabled={!enabled}
      value={selectedValue}
      onValueChange={(v) => {
        setSelectedValue(v);
        onChanged?.(v);
      }}
      onOpenChange={onOpenChange}
    >
      <Select.Trigger
        className={styles.SelectTrigger}
        style={{ width }}
        aria-label={ariaLabel}
        data-testid={testId}
      >
        <Select.Value placeholder={placeholder ?? "Select..."} />
        <div style={{ width: "100%" }} />
        <Icon iconName="chevron-down" fill="--color-command-icon" width={16} height={16} />
      </Select.Trigger>

      <Select.Portal container={rootElement}>
        <Select.Content className={styles.SelectContent} position="popper" sideOffset={4}
          style={{ maxHeight }}>
          <Select.Viewport>
            {options.map((option) => (
              <Select.Item key={option.value} value={option.value} className={styles.SelectItem}>
                <Select.ItemText>{option.label}</Select.ItemText>
                {option.description && (
                  <span className={styles.SelectItemDescription}>{option.description}</span>
                )}
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
