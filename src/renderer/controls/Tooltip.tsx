import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePopper } from "react-popper";
import styles from "./Tooltip.module.scss";
import { useTheme } from "@renderer/theming/ThemeProvider";

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
  isShown = false
}: Props) => {
  const { root } = useTheme();
  const handle = useRef<any>();
  const [visible, setVisible] = useState(isShown);
  const [referenceElement, setReferenceElement] = useState<HTMLElement | null>(null);
  const [popperElement, setPopperElement] = useState(null);
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

  const onMouseEnter = useCallback(() => {
    handle.current = setTimeout(() => setVisible(true), showDelay);
  }, []);
  const onMouseLeave = useCallback(() => {
    if (handle.current !== undefined) {
      clearTimeout(handle.current);
      handle.current = undefined;
    }
    setVisible(false);
  }, []);

  useEffect(() => {
    setReferenceElement(refElement);

    if (refElement) {
      refElement.addEventListener("mouseenter", onMouseEnter);
      refElement.addEventListener("mouseleave", onMouseLeave);
    }

    return () => {
      if (referenceElement) {
        referenceElement.removeEventListener("mouseenter", onMouseEnter);
        referenceElement.removeEventListener("mouseleave", onMouseLeave);
        setReferenceElement(null);
      }
    };
  }, [refElement, onMouseEnter, onMouseLeave, referenceElement]);

  return (
    <>
      {visible &&
        createPortal(
          <div
            className={styles.tooltip}
            ref={(el: any) => setPopperElement(el)}
            style={popperStyles.popper}
            {...attributes.popper}
          >
            {children}
          </div>,
          root
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
  isShown = false
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
    >
      {contentSegments.map((segment, index) => (
        <div key={index}>{segment}</div>
      ))}
      {children}
    </Tooltip>
  );
}

export function useTooltipRef(...deps: any[]) {
  const ref = useRef<any>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setVersion(version + 1);
  }, [ref?.current, ...deps]);

  return ref;
}
