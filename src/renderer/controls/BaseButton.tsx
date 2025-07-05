import { memo, ReactNode } from "react";
import { useButtonState } from "./hooks/useButtonState";
import { TooltipFactory, useTooltipRef } from "./Tooltip";

/**
 * Base props shared by all button components
 */
export interface BaseButtonProps {
  /** Text content to display on hover */
  title?: string;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Click handler function */
  onClick?: () => void;
  /** Additional CSS class name */
  className?: string;
  /** Additional style properties */
  style?: React.CSSProperties;
  /** Mouse enter event handler */
  onMouseEnter?: () => void;
  /** Mouse leave event handler */
  onMouseLeave?: () => void;
  /** Test ID for component testing */
  "data-testid"?: string;
  /** Additional child elements */
  children?: ReactNode;
}

/**
 * Base button component that provides common functionality for button variants
 * Handles state management, accessibility, and tooltips
 */
export const BaseButton = memo(({
  title,
  disabled = false,
  onClick,
  className,
  style,
  onMouseEnter,
  onMouseLeave,
  "data-testid": dataTestId = "base-button",
  children
}: BaseButtonProps) => {
  const ref = useTooltipRef<HTMLDivElement>();
  
  const {
    handleMouseDown,
    handleMouseLeave,
    handleClick,
    handleKeyDown,
    handleKeyUp
  } = useButtonState({
    disabled,
    onClick
  });

  return (
    <div
      ref={ref}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      className={className}
      style={style}
      onMouseDown={handleMouseDown}
      onMouseLeave={() => {
        handleMouseLeave();
        onMouseLeave?.();
      }}
      onMouseEnter={onMouseEnter}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      data-testid={dataTestId}
    >
      {title && ref.current && (
        <TooltipFactory
          refElement={ref.current}
          placement="right"
          offsetX={8}
          offsetY={32}
          content={title}
        />
      )}
      {children}
    </div>
  );
});
