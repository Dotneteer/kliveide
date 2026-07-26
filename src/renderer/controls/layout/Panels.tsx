import classnames from "classnames";
import { useState } from "react";
import { getPanelPropValues, processStyleValue } from "@renderer/theming/theme-utils";
import type { LayoutProps } from "./LayoutProps";
import styles from "./Layout.module.scss";

export type { LayoutProps, PanelProps } from "./LayoutProps";

const useHoverableLayoutStyle = (props: LayoutProps) => {
  const [hovered, setHovered] = useState(false);
  const elementStyle = getPanelPropValues(props);
  const backgroundColor =
    hovered && props.hoverBackgroundColor
      ? processStyleValue(props.hoverBackgroundColor)
      : elementStyle.backgroundColor;

  return {
    style: { ...elementStyle, backgroundColor },
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false)
  };
};

/**
 * Provides a full-size panel for top-level renderer regions.
 */
export const FullPanel = (props: LayoutProps) => {
  const hoverableStyle = useHoverableLayoutStyle(props);

  return (
    <div
      id={props.id}
      className={classnames(
        styles.fullPanel,
        { [styles.horizontal]: props.orientation === "horizontal" },
        props.classExt
      )}
      {...hoverableStyle}
    >
      {props.children}
    </div>
  );
};

/**
 * Provides the shared flex stack used by vertical and horizontal layout wrappers.
 */
const Stack = (props: LayoutProps) => {
  const hoverableStyle = useHoverableLayoutStyle(props);

  return (
    <div
      id={props.id}
      className={classnames(props.classExt, {
        [styles.vstack]: props.orientation === "vertical",
        [styles.hstack]: props.orientation === "horizontal"
      })}
      {...hoverableStyle}
    >
      {props.children}
    </div>
  );
};

/**
 * Provides a vertical flex stack for grouped controls and panels.
 */
export const VStack = ({ children, classExt, ...rest }: LayoutProps) => (
  <Stack orientation="vertical" classExt={classExt} {...rest}>
    {children}
  </Stack>
);

/**
 * Provides a horizontal flex stack for grouped controls and panels.
 */
export const HStack = ({ children, classExt, ...rest }: LayoutProps) => (
  <Stack orientation="horizontal" classExt={classExt} {...rest}>
    {children}
  </Stack>
);
