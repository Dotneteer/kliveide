import { useEffect, useState } from "react";
import * as Select from "@radix-ui/react-select";

import styles from "./NextBankDropdown.module.scss";

import classnames from "classnames";
import { Icon } from "../Icon";
import { HStack } from "./Panels";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { toDecimal3, toHexa2 } from "@renderer/appIde/services/ide-commands";

type Props = {
  banks?: number;
  width?: string | number;
  maxHeight?: string | number;
  initialValue?: number;
  decimalView?: boolean;
  onChanged?: (value: number) => void;
};

type KeyBehavior = {
  value: number;
  up?: number;
  down?: number;
  left?: number;
  right?: number;
};

export default function NextBankDropdown({
  banks = 0x100,
  width,
  maxHeight,
  initialValue = 0,
  decimalView,
  onChanged
}: Props) {
  const [rootElement, setRootElement] = useState<HTMLElement | null>(null);
  const theme = useTheme();

  // Create an array of bank values
  const bankValues = Array.from({ length: banks }, (_, i) => i);

  // Organize into 16 rows, each with 16 values
  const bankRows = Array.from({ length: banks >> 4 }, (_, row) =>
    bankValues.slice(row * 16, row * 16 + 16)
  );

  // Create an array of DIV RAM values
  const divRamValues = Array.from({ length: 16 }, (_, i) => `M${i.toString(16).toUpperCase()}`);

  // --- Use a root element that is the theme root
  useEffect(() => {
    if (theme) {
      setRootElement(document.getElementById("themeRoot") as HTMLDivElement);
    }
  }, [theme]);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedValue, setSelectedValue] = useState<string>(
    initialValue < 0 ? initialValue.toString(10) : toHexa2(initialValue)
  );

  const setNewValue = (value: number) => {
    const newValue = value < 0 ? value.toString(10) : toHexa2(value);
    setSelectedValue(newValue);
    console.log("Selected value: ", newValue);
    onChanged?.(value);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    event.preventDefault();
    const prev = selectedIndex;
    const keyBehavior = keyBehaviors.find((kb) => kb.value === prev);
    let next = prev;
    if (event.key === "ArrowRight") {
      next = keyBehavior?.right ?? (prev >= banks ? 0 : prev + 1);
    } else if (event.key === "ArrowLeft") {
      next = keyBehavior?.left ?? (prev < 1 ? banks : prev - 1);
    } else if (event.key === "ArrowDown") {
      next = keyBehavior?.down ?? (prev + 16) % banks;
    } else if (event.key === "ArrowUp") {
      next = keyBehavior?.up ?? (prev - 16 + banks) % banks;
    } else if (event.key === "Enter") {
      setNewValue(next);
    }
    setSelectedIndex(next);
  };

  const romItem = (value: number, text: string) => (
    <Select.Item
      value={value.toString()}
      className={classnames(styles.SelectItem, styles.wide, {
        [styles.selected]: value === selectedIndex
      })}
      onMouseEnter={() => setSelectedIndex(value)}
    >
      <Select.ItemText>{text}</Select.ItemText>
    </Select.Item>
  );

  return (
    <Select.Root
      value={selectedValue}
      onValueChange={(v) => {
        console.log("nv", v);
        setNewValue(v.startsWith("-") ? parseInt(v, 10) : parseInt(v, 16));
      }}
    >
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
            <HStack>
              {romItem(-1, "NROM0")}
              {romItem(-2, "NROM1")}
              {romItem(-3, "NROM2")}
              {romItem(-4, "NROM3")}
            </HStack>
            <HStack>
              {romItem(-5, "ALTR0")}
              {romItem(-6, "ALTR1")}
              {romItem(-7, "DivMR")}
            </HStack>
            <Select.Separator className={styles.SelectSeparator} />
            <HStack>
              {divRamValues.map((v, idx) => {
                const value = -idx - 8;
                return (
                  <Select.Item
                    key={value}
                    value={value.toString()}
                    className={classnames(styles.SelectItem, {
                      [styles.selected]: value === selectedIndex,
                      [styles.decimal]: !!decimalView
                    })}
                    onMouseEnter={() => setSelectedIndex(value)}
                  >
                    <Select.ItemText>{v}</Select.ItemText>
                  </Select.Item>
                );
              })}
            </HStack>
            <Select.Separator className={styles.SelectSeparator} />
            {bankRows.map((row, rowIndex) => (
              <HStack key={rowIndex}>
                {row.map((v) => {
                  return (
                    <Select.Item
                      key={v}
                      value={toHexa2(v)}
                      className={classnames(styles.SelectItem, {
                        [styles.selected]: v === selectedIndex,
                        [styles.decimal]: !!decimalView
                      })}
                      onMouseEnter={() => setSelectedIndex(v)}
                    >
                      <Select.ItemText>{decimalView ? toDecimal3(v) : toHexa2(v)}</Select.ItemText>
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

const keyBehaviors: KeyBehavior[] = [
  // --- From first RAM banks to DivMMC RAM banks
  { value: 0, up: -8, left: -23 },
  { value: 1, up: -9 },
  { value: 2, up: -10 },
  { value: 3, up: -11 },
  { value: 4, up: -12 },
  { value: 5, up: -13 },
  { value: 6, up: -14 },
  { value: 7, up: -15 },
  { value: 8, up: -16 },
  { value: 9, up: -17 },
  { value: 10, up: -18 },
  { value: 11, up: -19 },
  { value: 12, up: -20 },
  { value: 13, up: -21 },
  { value: 14, up: -22 },
  { value: 15, up: -23 },

  // --- From DivMMC RAM banks
  { value: -8, left: -7, up: -5, down: 0, right: -9 },
  { value: -9, left: -8, up: -5, down: 1, right: -10 },
  { value: -10, left: -9, up: -6, down: 2, right: -11 },
  { value: -11, left: -10, up: -6, down: 3, right: -12 },
  { value: -12, left: -11, up: -7, down: 4, right: -13 },
  { value: -13, left: -12, up: -7, down: 5, right: -14 },
  { value: -14, left: -13, up: -4, down: 6, right: -15 },
  { value: -15, left: -14, up: -4, down: 7, right: -16 },
  { value: -16, left: -15, up: 0xd8, down: 8, right: -17 },
  { value: -17, left: -16, up: 0xd9, down: 9, right: -18 },
  { value: -18, left: -17, up: 0xda, down: 10, right: -19 },
  { value: -19, left: -18, up: 0xdb, down: 11, right: -20 },
  { value: -20, left: -19, up: 0xdc, down: 12, right: -21 },
  { value: -21, left: -20, up: 0xdd, down: 13, right: -22 },
  { value: -22, left: -21, up: 0xde, down: 14, right: -23 },
  { value: -23, left: -22, up: 0xdf, down: 15, right: 0 },

  // --- From last row to first row
  { value: 0xd0, down: -1 },
  { value: 0xd1, down: -1 },
  { value: 0xd2, down: -2 },
  { value: 0xd3, down: -2 },
  { value: 0xd4, down: -3 },
  { value: 0xd5, down: -3 },
  { value: 0xd6, down: -4 },
  { value: 0xd7, down: -4 },
  { value: 0xd8, down: -16 },
  { value: 0xd9, down: -17 },
  { value: 0xda, down: -18 },
  { value: 0xdb, down: -19 },
  { value: 0xdc, down: -20 },
  { value: 0xdd, down: -21 },
  { value: 0xde, down: -22 },
  { value: 0xdf, down: -23, right: -1 },

  // --- From first row to last row
  { value: -1, left: 0xdf, up: 0xd0, down: -5, right: -2 },
  { value: -2, left: -1, up: 0xd2, down: -6, right: -3 },
  { value: -3, left: -2, up: 0xd4, down: -7, right: -4 },
  { value: -4, left: -3, up: 0xd6, down: -14, right: -5 },
  { value: -5, left: -4, up: -1, down: -8, right: -6 },
  { value: -6, left: -5, up: -2, down: -10, right: -7 },
  { value: -7, left: -6, up: -3, down: -12, right: -8 }
];
