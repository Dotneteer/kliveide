import classnames from "classnames";
import { useState } from "react";
import { getPanelPropValues, processStyleValue } from "@renderer/theming/theme-utils";
import type { LayoutProps } from "./LayoutProps";
import styles from "./Layout.module.scss";

export type { LayoutProps, PanelProps } from "./LayoutProps";

export const FullPanel = (props: LayoutProps) => {
  const [hovered, setHovered] = useState(false);
  const elementStyle = getPanelPropValues(props);
  let backgroundColor = elementStyle.backgroundColor;
  if (hovered && props.hoverBackgroundColor) {
    backgroundColor = processStyleValue(props.hoverBackgroundColor);
  }

  return (
    <div
      id={props.id}
      className={classnames(
        styles.fullPanel,
        { [styles.horizontal]: props.orientation === "horizontal" },
        props.classExt
      )}
      style={{ ...elementStyle, backgroundColor }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {props.children}
    </div>
  );
};

const Stack = (props: LayoutProps) => {
  const [hovered, setHovered] = useState(false);
  const elementStyle = getPanelPropValues(props);
  let backgroundColor = elementStyle.backgroundColor;
  if (hovered && props.hoverBackgroundColor) {
    backgroundColor = processStyleValue(props.hoverBackgroundColor);
  }
  return (
    <div
      id={props.id}
      className={classnames(props.classExt, {
        [styles.vstack]: props.orientation === "vertical",
        [styles.hstack]: props.orientation === "horizontal"
      })}
      style={{ ...elementStyle, backgroundColor }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {props.children}
    </div>
  );
};

export const VStack = ({ children, classExt, ...rest }: LayoutProps) => (
  <Stack orientation="vertical" classExt={classExt} {...rest}>
    {children}
  </Stack>
);

export const HStack = ({ children, classExt, ...rest }: LayoutProps) => (
  <Stack orientation="horizontal" classExt={classExt} {...rest}>
    {children}
  </Stack>
);
