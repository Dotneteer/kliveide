import styles from "./Panels.module.scss";
import classnames from "classnames";
import { getPanelPropValues } from "@renderer/theming/theme-utils";
import { PanelProps } from "./PanelProps";

export const FullPanel = (props: PanelProps) => {
  const elementStyle = getPanelPropValues(props);
  return (
    <div
      id={props.id}
      className={classnames(styles.fullPanel, props.classExt)}
      style={elementStyle}
    >
      {props.children}
    </div>
  );
};

const Stack = (props: PanelProps) => {
  const elementStyle = getPanelPropValues(props);
  return (
    <div
      id={props.id}
      className={classnames(props.classExt, {
        [styles.vstack]: props.orientation === "vertical",
        [styles.hstack]: props.orientation === "horizontal"
      })}
      style={elementStyle}
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
