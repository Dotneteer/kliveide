import React, { useEffect, useState } from "react";
import styles from "./Dropdown.module.scss";
import { Icon } from "./Icon";
import classnames from "@renderer/utils/classnames";

type OptionProps = {
  label: string;
  value: string;
};

type Props = {
  placeholder: string;
  options: OptionProps[];
  value?: string;
  onSelectionChanged?: (value: string) => void;
};

export const Dropdown = ({
  placeholder,
  options,
  value,
  onSelectionChanged
}: Props) => {
  const [showMenu, setShowMenu] = useState(false);
  const [selectedOption, setSelectedOption] = useState<OptionProps>(
    options.find(o => o.value === value)
  );
  const [selectedLabel, setSelectedLabel] = useState<string>(
    options.find(o => o.value === value)?.label
  );

  // TODO: Align selected label

  useEffect(() => {
    const handler = () => setShowMenu(false);
    window.addEventListener("click", handler);

    return () => {
      window.removeEventListener("click", handler);
    };
  });

  useEffect(() => {
    setSelectedOption(options.find(o => o.value === value));
    setSelectedLabel(options.find(o => o.value === value)?.label)
  }, [value, options]);

  const handleInputClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const onItemClick = (option: OptionProps) => {
    setSelectedOption(option);
    setSelectedLabel(option.label);
    onSelectionChanged?.(option.value);
    setShowMenu(false);
  };

  const isSelected = (option: OptionProps) =>
    !selectedOption ? false : selectedOption.value === option.value;

  console.log("render", selectedLabel, options);
  return (
    <div className={styles.dropdownContainer}>
      <div className={styles.dropdownInput} onClick={handleInputClick}>
        <div className={styles.dropdownSelectedValue}>{selectedLabel ?? placeholder}</div>
        <div className={styles.dropdownTools}>
          <div className={styles.dropdownTool}>
            <Icon iconName='chevron-down' fill='--color-command-icon' />
          </div>
        </div>
      </div>
      {showMenu && (
        <div className={styles.dropdownMenu}>
          {options.map(option => (
            <div
              key={`${option.value}|${option.label}`}
              className={classnames(styles.dropdownItem, {
                [styles.selected]: isSelected(option)
              })}
              onClick={() => onItemClick(option)}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
