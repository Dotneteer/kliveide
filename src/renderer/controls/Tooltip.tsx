import React, { useCallback, useEffect, useRef, useState, memo, useMemo } from "react";
import { createPortal } from "react-dom";
import { usePopper } from "react-popper";
import styles from "./Tooltip.module.scss";
import { useTheme } from "@renderer/theming/ThemeProvider";

// =====================================================================================================================
// Type definitions

type Placement = "left" | "right" | "top" | "bottom";

/**
 * Map of placements to their fallback placements
 */
const FALLBACK_PLACEMENTS: Record<Placement, Placement> = {
  top: "bottom",
  bottom: "top",
  left: "right",
  right: "left"
};

/**
 * Base Tooltip properties
 */
interface TooltipBaseProps {
  /** Child elements to render inside the tooltip */
  children?: React.ReactNode;
  /** The element that the tooltip is attached to */
  refElement: HTMLElement | null;
  /** Delay in milliseconds before showing the tooltip on hover */
  showDelay?: number;
  /** Position of the tooltip relative to the reference element */
  placement?: Placement;
  /** Horizontal offset from the reference element in pixels */
  offsetX?: number;
  /** Vertical offset from the reference element in pixels */
  offsetY?: number;
  /** Whether the tooltip is initially visible */
  isShown?: boolean;
}

/**
 * TooltipFactory properties
 */
interface TooltipFactoryProps extends TooltipBaseProps {
  /** Text content to display in the tooltip (supports line breaks with \n) */
  content?: string;
}

/**
 * Tooltip renderer - displays a tooltip attached to a reference element
 */
export const Tooltip = memo(({
  children,
  refElement,
  showDelay = 1000,
  placement = "top",
  offsetX = 8,
  offsetY = 8,
  isShown = false
}: TooltipBaseProps) => {
  const { root } = useTheme();
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);
  const [visible, setVisible] = useState(isShown);
  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
  
  // Get the fallback placement for the current placement
  const fallbackPlacement = useMemo(() => FALLBACK_PLACEMENTS[placement], [placement]);

  // Configure the popper instance
  const { styles: popperStyles, attributes } = usePopper(referenceElement, popperElement, {
    placement,
    modifiers: [
      {
        name: "flip",
        options: {
          fallbackPlacements: [fallbackPlacement]
        }
      },
      {
        name: "offset",
        options: {
          offset: [offsetY, offsetX]
        }
      }
    ],
    strategy: "fixed"
  });

  // Event handlers
  const onMouseEnter = useCallback(() => {
    timeoutRef.current = setTimeout(() => setVisible(true), showDelay);
  }, [showDelay]);
  
  const onMouseLeave = useCallback(() => {
    if (timeoutRef.current !== undefined) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    setVisible(false);
  }, []);

  // Set up and clean up event listeners
  useEffect(() => {
    setReferenceElement(refElement);

    // Add event listeners only if we have a reference element
    if (refElement) {
      refElement.addEventListener("mouseenter", onMouseEnter);
      refElement.addEventListener("mouseleave", onMouseLeave);
    }

    // Cleanup function
    return () => {
      if (refElement) {
        refElement.removeEventListener("mouseenter", onMouseEnter);
        refElement.removeEventListener("mouseleave", onMouseLeave);
      }
      
      // Clear any pending timeouts
      if (timeoutRef.current !== undefined) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
      
      setReferenceElement(null);
    };
  }, [refElement, onMouseEnter, onMouseLeave]);

  // Only render if visible and we have a root element
  return (
    <>
      {visible && root && 
        createPortal(
          <div
            className={styles.tooltip}
            ref={setPopperElement}
            style={popperStyles.popper}
            data-testid="tooltip"
            {...attributes.popper}
          >
            {children}
          </div>,
          root
        )}
    </>
  );
});

// =====================================================================================================================
// TooltipFactory component

/**
 * Creates a Tooltip that formats content with support for newlines
 */
export const TooltipFactory = memo(({
  content,
  refElement,
  children,
  showDelay = 800,
  placement = "top",
  offsetX = 8,
  offsetY = 8,
  isShown = false
}: TooltipFactoryProps) => {
  // Memoize content splitting to avoid unnecessary re-renders
  const contentSegments = useMemo(() => 
    content ? content.split("\n") : [], 
    [content]
  );

  return (
    <Tooltip
      refElement={refElement}
      showDelay={showDelay}
      placement={placement}
      offsetX={offsetX}
      offsetY={offsetY}
      isShown={isShown}
    >
      {contentSegments.map((segment, index) => (
        <div key={index}>{segment}</div>
      ))}
      {children}
    </Tooltip>
  );
});

/**
 * Hook that returns a ref and triggers a re-render when the ref or dependencies change
 * @param deps Dependencies that will trigger a re-render when changed
 * @returns A ref object that can be attached to a DOM element
 */
export function useTooltipRef<T = HTMLElement>(...deps: any[]) {
  const ref = useRef<T | null>(null);
  // We still need to track version changes even though we don't use the value directly
  const [, setVersion] = useState(0);

  useEffect(() => {
    // Use functional update to avoid dependency on version
    setVersion(prev => prev + 1);
  }, [ref.current, ...deps]);

  return ref;
}
