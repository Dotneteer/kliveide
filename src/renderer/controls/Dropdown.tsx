import styles from "./Dropdown.module.scss";
import * as Select from "@radix-ui/react-select";
import { Icon } from "./Icon";
import { useThemeRoot } from "@renderer/core/useThemeRoot";

export type DropdownOption = {
  value: string;
  label: string;
};

type Props = {
  options: DropdownOption[];
  placeholder?: string;
  initialValue?: string;
  width?: string | number;
  maxHeight?: string | number;
  onChanged?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
};

export default function Dropdown({
  options,
  placeholder,
  initialValue,
  width,
  maxHeight,
  onChanged,
  onOpenChange,
}: Props) {
  const rootElement = useThemeRoot();

  return (
    <Select.Root value={initialValue} onValueChange={(v) => onChanged?.(v)} onOpenChange={onOpenChange}>
      <Select.Trigger className={styles.SelectTrigger} style={{ width }}>
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
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
