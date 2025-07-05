import { useState, useCallback } from "react";
import { KeyboardEvent, MouseEvent } from "react";

/**
 * Options for the useButtonState hook
 */
interface UseButtonStateOptions {
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Click handler function */
  onClick?: () => void;
}

/**
 * State and handlers returned by useButtonState
 */
interface ButtonState {
  /** Whether the button is currently pressed down */
  isPressed: boolean;
  /** Mouse down handler */
  handleMouseDown: () => void;
  /** Mouse leave handler */
  handleMouseLeave: () => void;
  /** Click handler */
  handleClick: (e: MouseEvent) => void;
  /** Keyboard down handler for accessibility */
  handleKeyDown: (e: KeyboardEvent) => void;
  /** Keyboard up handler for accessibility */
  handleKeyUp: (e: KeyboardEvent) => void;
}

/**
 * Custom hook to manage button state and event handlers
 * 
 * Provides consistent handling of press state, keyboard navigation,
 * and disabled state across different button components
 */
export function useButtonState({ 
  disabled = false, 
  onClick 
}: UseButtonStateOptions = {}): ButtonState {
  const [isPressed, setIsPressed] = useState(false);

  const handleMouseDown = useCallback(() => {
    if (!disabled) {
      setIsPressed(true);
    }
  }, [disabled]);

  const handleMouseLeave = useCallback(() => {
    if (isPressed) {
      setIsPressed(false);
    }
  }, [isPressed]);

  const handleClick = useCallback((e: MouseEvent) => {
    if (!disabled && onClick) {
      e.stopPropagation();
      onClick();
      setIsPressed(false);
    }
  }, [disabled, onClick]);

  // Keyboard event handlers for accessibility
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
      setIsPressed(true);
      e.preventDefault();
    }
  }, [disabled]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
      setIsPressed(false);
      onClick?.();
      e.preventDefault();
    }
  }, [disabled, onClick]);

  return {
    isPressed,
    handleMouseDown,
    handleMouseLeave,
    handleClick,
    handleKeyDown,
    handleKeyUp
  };
}
