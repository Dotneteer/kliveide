import { useMemo, memo, CSSProperties, useState, useCallback } from "react";
import { Icon } from "./Icon";
import classnames from "classnames";
import styles from "./IconButton.module.scss";
import { BaseButton, BaseButtonProps } from "./BaseButton";
import { useButtonState } from "./hooks/useButtonState";

/**
 * Props for the IconButton component
 */
interface IconButtonProps extends Omit<BaseButtonProps, "onClick"> {
  /** Name of the icon to display */
  iconName: string;
  /** Size of the icon in pixels (default: 24) */
  iconSize?: number;
  /** Width of the button in pixels (default: 36) */
  buttonWidth?: number;
  /** Height of the button in pixels (default: 34) */
  buttonHeight?: number;
  /** Fill color for the icon */
  fill?: string;
  /** Whether the button is enabled (default: true) */
  enable?: boolean;
  /** Whether the button appears in selected state */
  selected?: boolean;
  /** Click handler function - legacy name */
  clicked?: () => void;
  /** Remove default padding when true */
  noPadding?: boolean;
}

/**
 * A button component that displays an icon with optional tooltip
 */
export const IconButton = memo(({
  iconName,
  iconSize: size = 24,
  buttonWidth = 36,
  buttonHeight = 34,
  title,
  fill,
  enable = true,
  selected,
  clicked,
  noPadding,
  "data-testid": dataTestId = "icon-button"
}: IconButtonProps) => {
  // Convert enable prop to disabled for compatibility with BaseButton
  const disabled = !enable;
  
  // Track hover state for styling
  const [hover, setHover] = useState(false);
  
  // Memoize event handlers
  const handleMouseEnter = useCallback(() => setHover(true), []);
  const handleMouseLeave = useCallback(() => {
    setHover(false);
  }, []);
  
  // Use the state from our hook
  const { isPressed } = useButtonState({ disabled, onClick: clicked });
  
  // Memoize styles to prevent recreation on each render
  const buttonStyle = useMemo<CSSProperties>(() => ({
    width: buttonWidth + (noPadding ? 0 : 4),
    height: buttonHeight,
    backgroundColor: hover && !disabled ? "var(--bgcolor-toolbarbutton-hover)" : "transparent"
  }), [buttonWidth, buttonHeight, noPadding, hover, disabled]);
  
  // Memoize classnames
  const wrapperClassName = useMemo(() =>
    classnames(styles.iconWrapper, {
      [styles.keyDown]: isPressed && !disabled,
      [styles.selected]: selected
    }),
    [isPressed, disabled, selected]
  );
  
  const buttonClassName = useMemo(() => 
    classnames(styles.iconButton, {
      [styles.enabled]: !disabled,
      [styles.noPadding]: noPadding
    }),
    [disabled, noPadding]
  );

  return (
    <BaseButton
      title={title}
      disabled={disabled}
      onClick={clicked}
      className={buttonClassName}
      data-testid={dataTestId}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={buttonStyle}
    >
      <div className={wrapperClassName}>
        <Icon
          iconName={iconName}
          fill={!disabled ? fill : "--bgcolor-toolbarbutton-disabled"}
          width={size}
          height={size}
          opacity={!disabled ? 1.0 : 0.5}
          data-testid={`${dataTestId}-icon`}
        />
      </div>
    </BaseButton>
  );
});

/**
 * Props for the SmallIconButton component
 */
interface SmallIconButtonProps extends Omit<IconButtonProps, "iconSize" | "buttonHeight" | "buttonWidth"> {
}

/**
 * A smaller version of IconButton with preset dimensions
 */
export const SmallIconButton = memo(({
  iconName,
  title,
  enable,
  selected,
  fill = "--color-command-icon",
  clicked,
  "data-testid": dataTestId = "small-icon-button",
  ...rest
}: SmallIconButtonProps) => {
  return (
    <IconButton
      iconName={iconName}
      iconSize={18}
      buttonHeight={24}
      buttonWidth={24}
      title={title}
      enable={enable}
      selected={selected}
      clicked={clicked}
      fill={fill}
      data-testid={dataTestId}
      {...rest}
    />
  );
});
