import classnames from "classnames";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import styles from "./Button.module.scss";

/**
 * Props for the Button component
 */
export interface ButtonProps {
  /** Text to display in the button */
  text: string;
  /** Controls button visibility */
  visible?: boolean;
  /** Controls button disabled state */
  disabled?: boolean;
  /** When true, the button will receive focus when initialized */
  focusOnInit?: boolean;
  /** When true, applies danger styling (red background) */
  isDanger?: boolean;
  /** Space to add to the left of the button (in px) */
  spaceLeft?: number;
  /** Space to add to the right of the button (in px) */
  spaceRight?: number;
  /** Click event handler */
  clicked?: () => void;
}

/**
 * A standard button component with support for danger styling, custom spacing,
 * visibility control, and automatic focus
 */
export const Button = React.memo(({
  text,
  visible = true,
  disabled = false,
  focusOnInit,
  isDanger,
  spaceLeft,
  spaceRight,
  clicked
}: ButtonProps): JSX.Element | null => {
  // --- Ensure the button gets the focus if requested
  const ref = useRef<HTMLButtonElement>(null);
  const focusSet = useRef(false);
  
  // Fixed dependency array to not use ref.current
  useEffect(() => {
    if (focusOnInit && !focusSet.current && ref.current) {
      setTimeout(() => {
        focusSet.current = true;
        ref.current?.focus();
      });
    }
  }, [focusOnInit]);
  
  // Memoize class names calculation
  const buttonClasses = useMemo(() => 
    classnames(
      styles.button, 
      {
        [styles.isDanger]: isDanger
      }
    ), 
    [isDanger]
  );
  
  // Use callback for the click handler
  const handleClick = useCallback(() => {
    clicked?.();
  }, [clicked]);
  
  // Apply custom styles for dynamic spacing
  const buttonStyle = useMemo(() => {
    const style: React.CSSProperties = {};
    if (spaceLeft !== undefined) style.marginLeft = spaceLeft;
    if (spaceRight !== undefined) style.marginRight = spaceRight;
    return style;
  }, [spaceLeft, spaceRight]);

  if (!visible) return null;
  
  return (
    <button
      ref={ref}
      style={buttonStyle}
      className={buttonClasses}
      disabled={disabled}
      onClick={handleClick}
      aria-disabled={disabled}
      role="button"
    >
      {text}
    </button>
  );
});
