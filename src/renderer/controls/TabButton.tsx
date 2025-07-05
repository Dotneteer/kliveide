import { memo, useMemo } from "react";
import { Icon } from "./Icon";
import classnames from "classnames";
import styles from "./TabButton.module.scss";
import { BaseButton, BaseButtonProps } from "./BaseButton";
import { useButtonState } from "./hooks/useButtonState";

/**
 * Props for the TabButton component
 */
interface TabButtonProps extends Omit<BaseButtonProps, "onClick" | "className"> {
  /** Whether to hide the button content and show a placeholder */
  hide?: boolean;
  /** Color fill for the icon */
  fill?: string;
  /** Whether the tab button is in active state */
  isActive?: boolean;
  /** Rotation angle in degrees for the icon */
  rotate?: number;
  /** Name of the icon to display */
  iconName: string;
  /** Whether to add spacing after the button */
  useSpace?: boolean;
  /** Click handler function (legacy name) */
  clicked?: () => void;
}

/**
 * A button component displayed in tab panels with an icon and optional tooltip.
 * Supports disabled state, hover/click interactions, and custom icon styling.
 */
export const TabButton = memo(({
  hide,
  fill = "--color-command-icon",
  isActive,
  rotate = 0,
  iconName,
  useSpace = false,
  title,
  disabled,
  clicked,
  "data-testid": dataTestId = "tab-button",
  ...rest
}: TabButtonProps): JSX.Element => {
  // Get button state for styling
  const { isPressed } = useButtonState({ disabled });
  
  // Memoize classnames to prevent recalculation on each render
  const buttonClassName = useMemo(() => 
    classnames(styles.tabButton, {
      [styles.keyDown]: isPressed,
      [styles.disabled]: disabled,
      [styles.active]: isActive
    }),
    [isPressed, disabled, isActive]
  );

  return (
    <>
      <BaseButton
        title={title}
        disabled={disabled}
        onClick={clicked}
        className={buttonClassName}
        data-testid={dataTestId}
        {...rest}
      >
        {hide && <div className={styles.placeholder}></div>}
        {!hide && (
          <Icon
            iconName={iconName}
            fill={disabled 
              ? "--color-command-icon-disabled" 
              : isActive 
                ? "--color-active-tab-icon" 
                : fill}
            width={20}
            height={20}
            rotate={rotate}
            data-testid={`${dataTestId}-icon`}
          />
        )}
      </BaseButton>
      {useSpace && <TabButtonSpace />}
    </>
  );
});

/**
 * Adds horizontal spacing after a tab button
 */
export const TabButtonSpace = memo((): JSX.Element => (
  <div className={styles.tabButtonSpace} />
));

/**
 * Renders a separator between tab buttons
 */
export const TabButtonSeparator = memo((): JSX.Element => (
  <div className={styles.separator} />
));
