import classnames from "classnames";
import React, { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePopper } from "react-popper";
import localStyles from "./ContextMenu.module.scss";
import { createPortal } from "react-dom";

/**
 * State for managing context menu visibility and position
 */
export interface ContextMenuState {
  /** Whether the context menu is currently visible */
  contextVisible: boolean;
  /** Reference to the element that triggered the context menu */
  contextRef?: HTMLElement;
  /** X offset from the reference element */
  contextX: number;
  /** Y offset from the reference element */
  contextY: number;
}

/**
 * Props for the ContextMenu component
 */
export interface ContextMenuProps {
  /** Content to render within the menu */
  children: ReactNode;
  /** State object controlling menu visibility and position */
  state: ContextMenuState;
  /** Handler called when clicking outside the menu */
  onClickOutside?: () => void;
  /** Popper.js placement value */
  placement?: string;
}

/**
 * A context menu component that renders a floating menu positioned relative to a trigger element.
 * Uses popper.js for positioning and supports portal rendering.
 */
export const ContextMenu = React.memo(({
  children,
  state,
  placement = "bottom-start",
  onClickOutside
}: ContextMenuProps): JSX.Element => {
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const { styles, attributes } = usePopper(state.contextRef, popperElement, {
    placement: placement as any,
    strategy: "absolute",
    modifiers: [
      {
        name: "offset",
        options: {
          offset: [state.contextX, state.contextY]
        }
      }
    ]
  });
  const rootElement = document.getElementById("themeRoot");
  
  // Track active item for keyboard navigation
  const [activeItemIndex, setActiveItemIndex] = useState(-1);

  // Handle clicking outside the menu
  const handleOutsideClick = useCallback((event: MouseEvent) => {
    if (popperElement && !popperElement.contains(event.target as Node)) {
      onClickOutside?.();
    }
  }, [popperElement, onClickOutside]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!popperElement) return;

    const menuItems = popperElement.querySelectorAll('[role="menuitem"]');
    const itemCount = menuItems.length;
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveItemIndex((prev) => (prev + 1) % itemCount);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveItemIndex((prev) => (prev - 1 + itemCount) % itemCount);
        break;
      case 'Escape':
        event.preventDefault();
        onClickOutside?.();
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (activeItemIndex >= 0 && activeItemIndex < menuItems.length) {
          (menuItems[activeItemIndex] as HTMLElement).click();
        }
        break;
    }
  }, [popperElement, activeItemIndex, onClickOutside]);

  // Focus the menu and set up event listeners when it becomes visible
  useEffect(() => {
    if (state.contextVisible && popperElement) {
      popperElement.focus();
      
      // Reset active item index when opening
      setActiveItemIndex(-1);
      
      // Add event listeners
      document.addEventListener("mousedown", handleOutsideClick as any);
      document.addEventListener("keydown", handleKeyDown as any);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick as any);
      document.removeEventListener("keydown", handleKeyDown as any);
    };
  }, [state.contextVisible, popperElement, handleOutsideClick, handleKeyDown]);

  // Update the active element when activeItemIndex changes
  useEffect(() => {
    if (popperElement && activeItemIndex >= 0) {
      const menuItems = popperElement.querySelectorAll('[role="menuitem"]');
      if (menuItems[activeItemIndex]) {
        (menuItems[activeItemIndex] as HTMLElement).focus();
      }
    }
  }, [activeItemIndex, popperElement]);

  // Set the ref to both popperElement and menuRef
  const setMenuRef = useCallback((element: HTMLDivElement | null) => {
    setPopperElement(element);
    menuRef.current = element;
  }, []);

  return (
    <>
      {state.contextVisible &&
        createPortal(
          <div
            ref={setMenuRef}
            tabIndex={0}
            role="menu"
            aria-orientation="vertical"
            className={localStyles.contextMenu}
            style={{ ...styles.popper, zIndex: 9999 }}
            {...attributes.popper}
          >
            {children}
          </div>,
          rootElement || document.body
        )}
    </>
  );
});

/**
 * Props for the ContextMenuItem component
 */
export interface ContextMenuItemProps {
  /** When true, the item is styled as a dangerous action (typically red) */
  dangerous?: boolean;
  /** Text content of the menu item */
  text?: string;
  /** When true, the item is disabled and cannot be clicked */
  disabled?: boolean;
  /** Handler called when the item is clicked */
  clicked?: () => void;
}

/**
 * A clickable item within a context menu
 */
export const ContextMenuItem = React.memo(({ 
  dangerous, 
  text, 
  disabled, 
  clicked 
}: ContextMenuItemProps): JSX.Element => {
  // Memoize classnames calculation
  const itemClasses = useMemo(() => 
    classnames(localStyles.menuItem, {
      [localStyles.dangerous]: dangerous,
      [localStyles.disabled]: disabled
    }),
    [dangerous, disabled]
  );

  // Memoize click handler
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!disabled && e.button === 0) {
      clicked?.();
    }
  }, [disabled, clicked]);

  return (
    <div
      className={itemClasses}
      onMouseDown={handleClick}
      role="menuitem"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
    >
      {text}
    </div>
  );
});

/**
 * A separator line for visually grouping menu items
 */
export const ContextMenuSeparator = React.memo((): JSX.Element => {
  return <div className={localStyles.separator} role="separator"></div>;
});

/**
 * API for controlling the context menu
 */
export interface IContextMenuApi {
  /**
   * Show the context menu at the specified event position
   * @param e The mouse event that triggered showing the menu
   */
  show(e: React.MouseEvent): void;
  
  /**
   * Hide the context menu
   */
  conceal(): void;
}

/**
 * Custom hook for managing context menu state
 * @returns A tuple containing the context menu state and API
 */
export const useContextMenuState = (): [ContextMenuState, IContextMenuApi] => {
  const [state, setState] = useState<ContextMenuState>({
    contextVisible: false,
    contextRef: null,
    contextX: 0,
    contextY: 0
  });

  const show = useCallback((e: React.MouseEvent) => {
    const t = e.target as HTMLElement;
    const rc = t?.getBoundingClientRect();
    setState({
      contextVisible: true,
      contextRef: t,
      contextX: rc ? e.clientX - rc.left : 0,
      contextY: rc ? e.clientY - rc.bottom : 0
    });
  }, []);

  const conceal = useCallback(() => {
    setState(prevState => ({
      ...prevState,
      contextVisible: false
    }));
  }, []);

  const api = useMemo(() => ({
    show,
    conceal
  }), [show, conceal]);

  return [state, api];
};
