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
      value={selectedValue}
      onValueChange={(v) => {
        setSelectedValue(v);
        onChanged?.(v);
      }}
      onOpenChange={onOpenChange}
    >
      <Select.Trigger className={styles.SelectTrigger} style={{ width }} aria-label={ariaLabel}>
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
