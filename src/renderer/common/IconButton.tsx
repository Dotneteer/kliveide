import React, { CSSProperties } from "react";
import classNames from "classnames";
import Icon from "./Icon";
import styles from "./IconButton.module.scss";

/**
 * Properties for the IconButton component
 */
type IconButtonProps = {
  /** Name of the icon to display */
  iconName: string;
  
  /** Size of the icon (default: 16) */
  iconSize?: number;
  
  /** Width of the button */
  buttonWidth?: number;
  
  /** Height of the button */
  buttonHeight?: number;
  
  /** Tooltip text */
  title?: string;
  
  /** Fill color for the icon */
  fill?: string;
  
  /** Whether the button is enabled (default: true) */
  enable?: boolean;
  
  /** Whether the button is selected (default: false) */
  selected?: boolean;
  
  /** Click event handler */
  click?: () => void;
  
  /** Remove padding around the icon (default: false) */
  noPadding?: boolean;
  
  /** Additional CSS class name */
  className?: string;
  
  /** Additional inline styles */
  style?: CSSProperties;
  
  /** Additional props to pass to the button */
  [key: string]: any;
};

/**
 * IconButton - A button component that displays an icon
 * 
 * The button can be enabled/disabled and selected/unselected.
 * When selected, it shows a highlighted border.
 * When disabled, it shows a reduced opacity and doesn't allow clicks.
 */
const IconButton: React.FC<IconButtonProps> = ({
  iconName,
  iconSize = 16,
  buttonWidth,
  buttonHeight,
  title,
  fill,
  enable = true,
  selected = false,
  click,
  noPadding = false,
  className = "",
  style = {},
  ...rest
}) => {
  // --- Calculate dimensions
  const buttonStyle: CSSProperties = {
    ...style,
    ...(buttonWidth && { width: buttonWidth }),
    ...(buttonHeight && { height: buttonHeight }),
  };

  // --- Handle click event
  const handleClick = (e: React.MouseEvent) => {
    if (enable && click) {
      click();
    }
    e.preventDefault();
  };

  return (
    <button
      className={classNames(
        styles.iconButton,
        {
          [styles.selected]: selected,
          [styles.disabled]: !enable,
          [styles.noPadding]: noPadding,
        },
        className
      )}
      style={buttonStyle}
      onClick={handleClick}
      title={title}
      disabled={!enable}
      type="button"
      {...rest}
    >
      <Icon
        name={iconName}
        width={iconSize}
        height={iconSize}
        fill={fill}
        opacity={enable ? undefined : 0.5}
      />
    </button>
  );
};

export default IconButton;

