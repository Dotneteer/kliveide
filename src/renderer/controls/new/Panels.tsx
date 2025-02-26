import styles from "./Panels.module.scss";
import classnames from "classnames";
import { getPanelPropValues, processStyleValue } from "@renderer/theming/theme-utils";
import { PanelProps } from "./PanelProps";
import { useState } from "react";

export const FullPanel = (props: PanelProps) => {
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
      style={{...elementStyle, backgroundColor}}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {props.children}
    </div>
  );
};

const Stack = (props: PanelProps) => {
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
      style={{...elementStyle, backgroundColor}}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {props.children}
    </div>
  );
};

export const VStack = ({ children, classExt, ...rest }: PanelProps) => {
  return (
    <Stack orientation="vertical" classExt={classExt} {...rest}>
      {children}
    </Stack>
  );
};

export const HStack = ({ children, classExt, ...rest }: PanelProps) => {
  return (
    <Stack orientation="horizontal" classExt={classExt} {...rest}>
      {children}
    </Stack>
  );
};
