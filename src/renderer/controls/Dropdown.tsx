import styles from "./Dropdown.module.scss";
import * as Select from "@radix-ui/react-select";
import { Icon } from "./Icon";
import { useEffect, useState } from "react";
import { useTheme } from "@renderer/theming/ThemeProvider";

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
};

export default function Dropdown({
  options,
  placeholder,
  initialValue,
  width,
  maxHeight,
  onChanged,
}: Props) {
  const [rootElement, setRootElement] = useState<HTMLElement | null>(null);
  const [selectedValue, setSelectedValue] = useState(initialValue);
  const theme = useTheme();
  const handleSelectChange = (value: string) => {
    setSelectedValue(value);
    onChanged?.(value);
  };

  // --- Use a root element that is the theme root
  useEffect(() => {
    if (theme ) {
      setRootElement(document.getElementById("themeRoot") as HTMLDivElement);
    }
  }, [theme]);

  return (
    <Select.Root value={selectedValue} onValueChange={handleSelectChange}>
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
