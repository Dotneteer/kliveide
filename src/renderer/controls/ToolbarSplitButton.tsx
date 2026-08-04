import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import classnames from "classnames";
import { Icon } from "./Icon";
import { useOverlayRoot } from "./overlay/useOverlayRoot";
import styles from "./ToolbarSplitButton.module.scss";

export type ToolbarSplitButtonOption<TValue extends string> = {
  value: TValue;
  label: string;
  iconName: string;
  fill: string;
};

type Props<TValue extends string> = {
  options: ToolbarSplitButtonOption<TValue>[];
  selectedValue: TValue;
  enable: boolean;
  dropdownTitle: string;
  onAction: (value: TValue) => void | Promise<void>;
};

export function ToolbarSplitButton<TValue extends string>({
  options,
  selectedValue,
  enable,
  dropdownTitle,
  onAction
}: Props<TValue>) {
  const overlayRoot = useOverlayRoot();
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 });
  const selectedOption = options.find((option) => option.value === selectedValue) ?? options[0];

  const closeMenu = useCallback(() => setOpen(false), []);

  const openMenu = useCallback(() => {
    if (!enable) return;
    const bounds = rootRef.current?.getBoundingClientRect();
    if (bounds) {
      setMenuPosition({ top: bounds.bottom + 4, left: bounds.left });
    }
    setOpen(true);
  }, [enable]);

  const handlePrimaryAction = useCallback(async () => {
    if (!enable) return;
    await onAction(selectedOption.value);
  }, [enable, onAction, selectedOption.value]);

  const handleMenuAction = useCallback(async (value: TValue) => {
    closeMenu();
    await onAction(value);
  }, [closeMenu, onAction]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        closeMenu();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeMenu, open]);

  const menu = open && (
    <div
      ref={menuRef}
      className={styles.menu}
      style={{ top: menuPosition.top, left: menuPosition.left }}
      role="menu"
    >
      {options.map((option) => (
        <button
          key={option.value}
          className={classnames(styles.menuItem, {
            [styles.selectedMenuItem]: option.value === selectedValue
          })}
          type="button"
          role="menuitem"
          onClick={() => void handleMenuAction(option.value)}
        >
          <Icon iconName={option.iconName} fill={option.fill} width={18} height={18} />
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={classnames(styles.splitButton, { [styles.disabled]: !enable })}
    >
      <button
        className={styles.primaryButton}
        type="button"
        title={selectedOption.label}
        disabled={!enable}
        onClick={() => void handlePrimaryAction()}
      >
        <Icon
          iconName={selectedOption.iconName}
          fill={enable ? selectedOption.fill : "--bgcolor-toolbarbutton-disabled"}
          width={24}
          height={24}
          opacity={enable ? 1.0 : 0.5}
        />
      </button>
      <button
        className={styles.dropdownButton}
        type="button"
        title={dropdownTitle}
        disabled={!enable}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={open ? closeMenu : openMenu}
      >
        <Icon
          iconName="chevron-down"
          fill={enable ? "--color-toolbarbutton" : "--bgcolor-toolbarbutton-disabled"}
          width={12}
          height={12}
          opacity={enable ? 1.0 : 0.5}
        />
      </button>
      {overlayRoot && menu ? createPortal(menu, overlayRoot) : menu}
    </div>
  );
}
