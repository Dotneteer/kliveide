import styles from "./AttachedShadow.module.scss";
import classnames from "classnames";
import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Props for the AttachedShadow component
 */
export interface AttachedShadowProps {
  /** The HTML element to attach the shadow to */
  parentElement: HTMLElement;
  /** Controls whether the shadow is visible */
  visible: boolean;
}

/**
 * Position state interface for tracking element position and dimensions
 */
interface PositionState {
  top: number;
  left: number;
  width: number;
}

/**
 * A component that adds a shadow effect to a parent element,
 * automatically adjusting its position and size when the parent changes
 */
export const AttachedShadow = React.memo(({ parentElement, visible }: AttachedShadowProps): JSX.Element => {
  // Consolidate position state into a single object
  const [position, setPosition] = useState<PositionState>({
    top: 0,
    left: 0,
    width: 0
  });

  // --- Check for parent element size changes
  const observer = useRef<ResizeObserver>();

  // Memoize class names calculation
  const shadowClasses = useMemo(
    () => classnames(styles.attachedShadow, { [styles.show]: visible }),
    [visible]
  );

  // Memoize style object
  const shadowStyle = useMemo(
    () => ({
      top: position.top,
      left: position.left,
      width: position.width
    }),
    [position.top, position.left, position.width]
  );

  useEffect(() => {
    const resizer = () => {
      if (parentElement) {
        setPosition({
          top: parentElement.offsetTop ?? 0,
          left: parentElement.offsetLeft ?? 0,
          width: parentElement.offsetWidth ?? 0
        });
      }
    };

    // Run initial sizing
    resizer();

    // --- We are already observing old element
    if (observer?.current && parentElement) {
      observer.current.unobserve(parentElement);
    }
    observer.current = new ResizeObserver(resizer);
    if (parentElement && observer.current) {
      observer.current.observe(parentElement);
    }

    // Cleanup function for useEffect
    return () => {
      if (observer?.current && parentElement) {
        observer.current.unobserve(parentElement);
        observer.current.disconnect();
      }
    };
  }, [parentElement]);

  return (
    <div
      className={shadowClasses}
      style={shadowStyle}
      role="presentation"
    />
  );
});
