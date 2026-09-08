import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopper } from "react-popper";
import classnames from "classnames";
import styles from "./Tooltip.module.scss";
import { useOverlayRoot } from "./overlay/useOverlayRoot";

// =====================================================================================================================
// Tooltip React component definition

type Placement = "left" | "right" | "top" | "bottom";

/**
 * Tooltip properties
 */
type Props = {
  children?: React.ReactNode;
  refElement: HTMLElement | null;
  showDelay?: number;
  placement?: Placement;
  offsetX?: number;
  offsetY?: number;
  isShown?: boolean;
  /**
   * Extra class merged onto the tooltip box, for a caller that wants its own tooltip to look
   * different from the app's shared one (see the memory dump's `.memoryTooltip`). Give any such
   * class double specificity (e.g. `.memoryTooltip.memoryTooltip`) so it reliably beats `.tooltip`
   * regardless of which stylesheet happens to load second - two single-class rules from different
   * modules tie on specificity, and the cascade then falls back to sheet order.
   */
  className?: string;
};

/**
 * Tooltip renderer
 * @param children Nested children
 * @param refElement Reference to the element this tooltip belongs to
 * @param isShown Is the tooltip displayed?
 */
export const Tooltip = ({
  children,
  refElement,
  showDelay = 1000,
  placement = "top",
  offsetX = 8,
  offsetY = 8,
  isShown = false,
  className
}: Props) => {
  const root = useOverlayRoot();
  const handle = useRef<ReturnType<typeof setTimeout>>();
  const [visible, setVisible] = useState(isShown);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
  let fallbackPlacement: Placement = "bottom";
  switch (placement) {
    case "top":
      fallbackPlacement = "bottom";
      break;
    case "bottom":
      fallbackPlacement = "top";
      break;
    case "left":
      fallbackPlacement = "right";
      break;
    case "right":
      fallbackPlacement = "left";
  }

  const { styles: popperStyles, attributes } = usePopper(refElement, popperElement, {
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

  const clearShowTimer = useCallback(() => {
    if (handle.current !== undefined) {
      clearTimeout(handle.current);
      handle.current = undefined;
    }
  }, []);

  const onMouseEnter = useCallback(() => {
    handle.current = setTimeout(() => setVisible(true), showDelay);
  }, [showDelay]);
  const onMouseLeave = useCallback(() => {
    clearShowTimer();
    setVisible(false);
  }, [clearShowTimer]);

  useEffect(() => {
    setVisible(isShown);
  }, [isShown]);

  useEffect(() => {
    const element = refElement;
    if (!element) return;

    element.addEventListener("mouseenter", onMouseEnter);
    element.addEventListener("mouseleave", onMouseLeave);

    return () => {
      element.removeEventListener("mouseenter", onMouseEnter);
      element.removeEventListener("mouseleave", onMouseLeave);
      clearShowTimer();
    };
  }, [clearShowTimer, refElement, onMouseEnter, onMouseLeave]);

  return (
    <>
      {visible &&
        createPortal(
          <div
            className={classnames(styles.tooltip, className)}
            ref={setPopperElement}
            style={popperStyles.popper}
            {...attributes.popper}
          >
            {children}
          </div>,
          root ?? document.body
        )}
    </>
  );
};

// =====================================================================================================================
// Tooltip React component definition

/**
 * Creates a Tooltip for elements that have longer text than can be displayed in the component's viewport
 * @param children Nested children
 * @param refElement Reference to the element this tooltip belongs to
 * @param isShown Is the tooltip displayed?
 * @param forTruncatedText Is it only for truncated text?
 * @constructor
 */
export function TooltipFactory({
  content,
  refElement,
  children,
  showDelay = 800,
  placement = "top",
  offsetX = 8,
  offsetY = 8,
  isShown = false,
  className
}: Props & { content?: string }) {
  const contentSegments = content ? content.split("\n") : [];

  return (
    <Tooltip
      refElement={refElement}
      showDelay={showDelay}
      placement={placement}
      offsetX={offsetX}
      offsetY={offsetY}
      isShown={isShown}
      className={className}
    >
      {contentSegments.map((segment, index) => (
        <div key={index}>{segment}</div>
      ))}
      {children}
    </Tooltip>
  );
}

export function useTooltipRef<T extends HTMLElement = HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [, setVersion] = useState(0);

  useEffect(() => {
    setVersion((version) => version + 1);
  }, []);

  return ref;
}
