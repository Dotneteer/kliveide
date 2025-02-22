import React, { useEffect, useState } from "react";
import styles from "./Dropdown.module.scss";
import { Icon } from "./Icon";
import classnames from "classnames";

type OptionProps = {
  label: string;
  value: string;
};

type Props = {
  placeholder: string;
  options: OptionProps[];
  value?: string;
  width?: number;
  iconSize?: number;
  fontSize?: string;
  onSelectionChanged?: (
    value: string
  ) => boolean | void | Promise<boolean | void>;
};

export const Dropdown = ({
  placeholder,
  options,
  value,
  width,
  iconSize = 20,
  fontSize,
  onSelectionChanged
}: Props) => {
  const [showMenu, setShowMenu] = useState(false);
  const [selectedOption, setSelectedOption] = useState<OptionProps>(
    options.find(o => o.value === value)
  );
  const [selectedLabel, setSelectedLabel] = useState<string>(
    options.find(o => o.value === value)?.label
  );

  useEffect(() => {
    const handler = () => setShowMenu(false);
    window.addEventListener("click", handler);

    return () => {
      window.removeEventListener("click", handler);
    };
  });

  useEffect(() => {
    setSelectedOption(options.find(o => o.value === value));
    setSelectedLabel(options.find(o => o.value === value)?.label);
  }, [value, options]);

  const handleInputClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
  };

  const onItemClick = async (option: OptionProps) => {
    const prevOption = selectedOption;
    const prevLabel = selectedLabel;
    setSelectedOption(option);
    setSelectedLabel(option.label);
    const cancel = await onSelectionChanged?.(option.value);
    if (cancel === true) {
      setSelectedOption(prevOption);
      setSelectedLabel(prevLabel);
    }
    setShowMenu(false);
  };

  const isSelected = (option: OptionProps) =>
    !selectedOption ? false : selectedOption.value === option.value;

  return (
    <div
      className={styles.dropdownContainer}
      style={{ width, fontSize }}
      tabIndex={-1}
      onBlur={() => setShowMenu(false)}
    >
      <div className={styles.dropdownInput} onClick={handleInputClick}>
        <div className={styles.dropdownSelectedValue}>
          {selectedLabel ?? placeholder}
        </div>
        <div className={styles.dropdownTools}>
          <div className={styles.dropdownTool}>
            <Icon iconName='chevron-down' fill='--color-command-icon' width={iconSize} height={iconSize} />
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
