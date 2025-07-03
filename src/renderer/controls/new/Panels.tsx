import styles from "./Panels.module.scss";
import classnames from "classnames";
import { getPanelPropValues, processStyleValue } from "@renderer/theming/theme-utils";
import {
  FullPanelProps,
  StackProps,
  VStackProps,
  HStackProps,
  PanelStyleProps
} from "./PanelProps";
import { useState, useCallback, memo, useMemo } from "react";

/**
 * Custom hook to handle hover state and styling for panel components
 * @param styleProps Style-related props for the panel
 * @returns Object containing computed style and hover event handlers
 */
const usePanelHover = (styleProps: PanelStyleProps) => {
  const [hovered, setHovered] = useState(false);

  // Extract style values from the props
  const elementStyle = getPanelPropValues(styleProps);

  // Memoize the background color calculation
  const backgroundColor = useMemo(() => {
    return hovered && styleProps.hoverBackgroundColor
      ? processStyleValue(styleProps.hoverBackgroundColor)
      : elementStyle.backgroundColor;
  }, [hovered, styleProps.hoverBackgroundColor, elementStyle.backgroundColor]);

  // Memoize event handlers
  const handleMouseEnter = useCallback(() => setHovered(true), []);
  const handleMouseLeave = useCallback(() => setHovered(false), []);

  // Memoize the combined style object to prevent unnecessary re-renders
  const combinedStyle = useMemo(() => {
    return { ...elementStyle, backgroundColor };
  }, [elementStyle, backgroundColor]);

  // Memoize the hover handlers object
  const hoverHandlers = useMemo(() => {
    return {
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave
    };
  }, [handleMouseEnter, handleMouseLeave]);

  return { style: combinedStyle, hoverHandlers };
};

export const FullPanel = memo(
  ({ children, id, classExt, orientation, fullSize, ...styleProps }: FullPanelProps) => {
    // Get computed styles and hover handlers
    const { style, hoverHandlers } = usePanelHover(styleProps);

    // Memoize the className computation
    const className = useMemo(() => {
      return classnames(
        styles.fullPanel,
        { [styles.horizontal]: orientation === "horizontal" },
        classExt
      );
    }, [orientation, classExt]);

    return (
      <div id={id} className={className} style={style} data-testid="full-panel" {...hoverHandlers}>
        {children}
      </div>
    );
  }
);

const Stack = memo(({ children, id, classExt, orientation, wrap, ...styleProps }: StackProps) => {
  // Get computed styles and hover handlers
  const { style, hoverHandlers } = usePanelHover(styleProps);

  // Memoize the className computation
  const className = useMemo(() => {
    return classnames(classExt, {
      [styles.vstack]: orientation === "vertical",
      [styles.hstack]: orientation === "horizontal",
      [styles.wrap]: wrap
    });
  }, [classExt, orientation, wrap]);

  return (
    <div id={id} className={className} style={style} data-testid="stack" {...hoverHandlers}>
      {children}
    </div>
  );
});

export const VStack = memo(({ children, classExt, id, wrap, ...styleProps }: VStackProps) => {
  return (
    <Stack orientation="vertical" id={id} classExt={classExt} wrap={wrap} {...styleProps}>
      {children}
    </Stack>
  );
});

export const HStack = memo(({ children, classExt, id, wrap, ...styleProps }: HStackProps) => {
  return (
    <Stack orientation="horizontal" id={id} classExt={classExt} wrap={wrap} {...styleProps}>
      {children}
    </Stack>
  );
});
