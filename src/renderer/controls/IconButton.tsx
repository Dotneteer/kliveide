import { useEffect, useState, useCallback, useMemo, memo, KeyboardEvent } from "react";
import { Icon } from "./Icon";
import { TooltipFactory, useTooltipRef } from "./Tooltip";
import classnames from "classnames";
import styles from "./IconButton.module.scss";

/**
 * Props for the IconButton component
 */
interface IconButtonProps {
  /** Name of the icon to display */
  iconName: string;
  /** Size of the icon in pixels (default: 24) */
  iconSize?: number;
  /** Width of the button in pixels (default: 36) */
  buttonWidth?: number;
  /** Height of the button in pixels (default: 34) */
  buttonHeight?: number;
  /** Tooltip text to display on hover */
  title?: string;
  /** Fill color for the icon */
  fill?: string;
  /** Whether the button is enabled (default: true) */
  enable?: boolean;
  /** Whether the button appears in selected state */
  selected?: boolean;
  /** Click handler function */
  clicked?: () => void;
  /** Remove default padding when true */
  noPadding?: boolean;
  /** For testing purposes */
  "data-testid"?: string;
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
  const ref = useTooltipRef<HTMLDivElement>();
  const [keyDown, setKeyDown] = useState(false);
  const [hover, setHover] = useState(false);

  // Reset keyDown state when the component mounts
  useEffect(() => {
    setKeyDown(false);
    // No dependencies needed - only run once on mount
  }, []);

  // Memoize event handlers to prevent recreation on each render
  const handleMouseEnter = useCallback(() => setHover(true), []);
  
  const handleMouseDown = useCallback(() => setKeyDown(true), []);
  
  const handleMouseLeave = useCallback(() => {
    setKeyDown(false);
    setHover(false);
  }, []);
  
  const handleClick = useCallback(() => {
    if (enable && clicked) {
      clicked();
    }
    setKeyDown(false);
  }, [enable, clicked]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    // Handle Space and Enter keys for accessibility
    if (enable && (event.key === 'Enter' || event.key === ' ')) {
      setKeyDown(true);
      event.preventDefault();
    }
  }, [enable]);

  const handleKeyUp = useCallback((event: KeyboardEvent<HTMLDivElement>) => {
    if (enable && (event.key === 'Enter' || event.key === ' ')) {
      setKeyDown(false);
      clicked?.();
      event.preventDefault();
    }
  }, [enable, clicked]);

  // Memoize styles to prevent recreation on each render
  const buttonStyle = useMemo(() => ({
    width: buttonWidth + (noPadding ? 0 : 4),
    height: buttonHeight,
    backgroundColor: hover && enable ? "var(--bgcolor-toolbarbutton-hover)" : "transparent"
  }), [buttonWidth, buttonHeight, noPadding, hover, enable]);

  // Memoize class names
  const buttonClassName = useMemo(() => 
    classnames(styles.iconButton, {
      [styles.enabled]: enable,
      [styles.noPadding]: noPadding
    }),
    [enable, noPadding]
  );

  const iconWrapperClassName = useMemo(() =>
    classnames(styles.iconWrapper, {
      [styles.keyDown]: keyDown && enable,
      [styles.selected]: selected
    }),
    [keyDown, enable, selected]
  );

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={enable ? 0 : -1}
      aria-disabled={!enable}
      aria-pressed={selected}
      className={buttonClassName}
      style={buttonStyle}
      data-testid={dataTestId}
      onMouseEnter={handleMouseEnter}
      onMouseDown={handleMouseDown}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
    >
      <div className={iconWrapperClassName}>
        {title && ref.current && (
          <TooltipFactory
            refElement={ref.current}
            placement="right"
            offsetX={-12}
            offsetY={28}
            content={title}
          />
        )}
        <Icon
          iconName={iconName}
          fill={enable ? fill : "--bgcolor-toolbarbutton-disabled"}
          width={size}
          height={size}
          opacity={enable ? 1.0 : 0.5}
          data-testid={`${dataTestId}-icon`}
        />
      </div>
    </div>
  );
});

/**
 * Props for the SmallIconButton component
 */
interface SmallIconButtonProps {
  /** Name of the icon to display */
  iconName: string;
  /** Tooltip text to display on hover */
  title?: string;
  /** Whether the button is enabled */
  enable?: boolean;
  /** Whether the button appears in selected state */
  selected?: boolean;
  /** Fill color for the icon */
  fill?: string;
  /** Click handler function */
  clicked?: () => void;
  /** For testing purposes */
  "data-testid"?: string;
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
  "data-testid": dataTestId = "small-icon-button"
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
    />
  );
});
