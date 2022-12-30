import React, { useEffect, useState } from "react";
import styles from "./Dropdown.module.scss";
import { Icon } from "./Icon";
import classnames from "@/utils/classnames";

type OptionProps = {
    label: string;
    value: string;
}

type Props = {
    placeholder: string;
    options: OptionProps[];
    selected?: (value: string) => void;
}

export const Dropdown = ({
    placeholder,
    options,
    selected
}: Props) => {
    const [showMenu, setShowMenu] = useState(false);
    const [selectedValue, setSelectedValue] = useState<OptionProps>(null);

    useEffect(() => {
        const handler = () => setShowMenu(false);
        window.addEventListener("click", handler);

        return () => {
            window.removeEventListener("click", handler);
        }
    })

    const handleInputClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setShowMenu(!showMenu);
    }

    const getDisplay = () => selectedValue?.label ?? placeholder;

    const onItemClick = (option: OptionProps) => {
        setSelectedValue(option);
        selected?.(option.value);
    }

    const isSelected = (option: OptionProps) => 
        !selectedValue ? false : selectedValue.value === option.value;

    return (
        <div className={styles.dropdownContainer}>
            <div 
                className={styles.dropdownInput}
                onClick={handleInputClick}>
                <div className={styles.dropdownSelectedValue}>{getDisplay()}</div>
                <div className={styles.dropdownTools}>
                    <div className={styles.dropdownTool}>
                        <Icon iconName="chevron-down" fill="--color-command-icon" />
                    </div>
                </div>
            </div>
            { showMenu && 
                <div className={styles.dropdownMenu} >
                    {options.map(option => (
                        <div 
                            key={option.value} 
                            className={classnames(styles.dropdownItem, isSelected(option) ? styles.selected : "")} 
                            onClick={() => onItemClick(option)}>
                            {option.label}
                        </div>
                    ))}
                </div>
            }
        </div>
    );
}