import { PanelProps } from "@renderer/controls/new/PanelProps";
import { CSSProperties } from "react";

export function processStyleValue(name: string, defaultValue?: any): string {
  if (!name) {
    return undefined;
  }
  if (name.startsWith("--")) {
    return defaultValue ? `var(${name}, ${defaultValue})` : `var(${name})`;
  }
  return name;
}

export function getPanelPropValues(props: Omit<PanelProps, "children">): CSSProperties {
  const paddingLeft = processStyleValue(props.paddingHorizontal) || 0;
  const paddingRight = processStyleValue(props.paddingHorizontal) || 0;
  const height = processStyleValue(props.height);
  let width = processStyleValue(props.width) || "100%";
  width = `calc(${width} - ${paddingLeft} - ${paddingRight})`;
  const elementStyle: CSSProperties = {
    padding: processStyleValue(props.padding) || 0,
    paddingLeft,
    paddingRight,
    paddingTop: processStyleValue(props.paddingVertical) || 0,
    paddingBottom: processStyleValue(props.paddingVertical) || 0,
    backgroundColor: processStyleValue(props.backgroundColor),
    gap: processStyleValue(props.gap) || 0,
    height: height,
    width,
    flex: height == undefined ? undefined : "0 0 auto",
    justifyContent:
      props.orientation === "vertical"
        ? processStyleValue(props.verticalContentAlignment)
        : processStyleValue(props.horizontalContentAlignment),
    alignItems:
      props.orientation === "vertical"
        ? processStyleValue(props.horizontalContentAlignment)
        : processStyleValue(props.verticalContentAlignment)
  };
  return { ...elementStyle, ...props.style };
}
