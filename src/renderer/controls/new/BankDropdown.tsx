import { useEffect, useState } from "react";
import * as Select from "@radix-ui/react-select";

import styles from "./BankDropdown.module.scss";

import classnames from "classnames";
import { Icon } from "../Icon";
import { HStack } from "./Panels";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";

type Props = {
  banks?: number;
  width?: string | number;
  maxHeight?: string | number;
  initialValue?: number;
  onChanged?: (value: number) => void;
};

export default function BankDropdown({
  banks = 0x100,
  width,
  maxHeight,
  initialValue = 0,
  onChanged
}: Props) {
  const [rootElement, setRootElement] = useState<HTMLElement | null>(null);
  const theme = useTheme();

  const hexValues = Array.from({ length: banks }, (_, i) => i);

  // Organize into 16 rows, each with 16 values
  const hexRows = Array.from({ length: banks >> 4 }, (_, row) =>
    hexValues.slice(row * 16, row * 16 + 16)
  );

  // --- Use a root element that is the theme root
  useEffect(() => {
    if (theme) {
      setRootElement(document.getElementById("themeRoot") as HTMLDivElement);
    }
  }, [theme]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedValue, setSelectedValue] = useState<string>(toHexa2(initialValue));

  const setNewValue = (value: number) => {
    setSelectedValue(toHexa2(value));
    onChanged?.(value);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    event.preventDefault(); // Prevent default dropdown behavior
    const prev = selectedIndex;
    let next = prev;
    if (event.key === "ArrowRight") {
      next = prev >= banks ? 0 : prev + 1;
    } else if (event.key === "ArrowLeft") {
      next = prev < 1 ? banks : prev - 1;
    } else if (event.key === "ArrowDown") {
      next = (prev + 16) % banks;
    } else if (event.key === "ArrowUp") {
      next = (prev - 16 + banks) % banks;
    } else if (event.key === "Enter") {
      setNewValue(next);
    }
    setSelectedIndex(next);
  };

  return (
    <Select.Root value={selectedValue} onValueChange={(v) => setNewValue(parseInt(v, 16))}>
      <Select.Trigger className={styles.SelectTrigger} style={{ width }}>
        <Select.Value placeholder="..." />
        <div style={{ width: "100%" }} />
        <Select.Icon>
          <Icon iconName="chevron-down" fill="--color-command-icon" width={16} height={16} />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal container={rootElement}>
        <Select.Content
          className={styles.SelectContent}
          position="popper"
          sideOffset={4}
          style={{ maxHeight }}
        >
          <Select.Viewport onKeyDown={handleKeyDown}>
            {hexRows.map((row, rowIndex) => (
              <HStack key={rowIndex}>
                {row.map((v) => {
                  const index = hexValues.indexOf(v);
                  return (
                    <Select.Item
                      key={v}
                      value={toHexa2(v)}
                      className={classnames(styles.SelectItem, {
                        [styles.selected]: index === selectedIndex
                      })}
                      onMouseEnter={() => setSelectedIndex(index)}
                    >
                      <Select.ItemText>{toHexa2(v)}</Select.ItemText>
                    </Select.Item>
                  );
                })}
              </HStack>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
