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
  const padding = processStyleValue(props.padding);
  const paddingLeft = processStyleValue(props.paddingHorizontal) || padding || 0;
  const paddingRight = processStyleValue(props.paddingHorizontal) || padding || 0;
  const height = processStyleValue(props.height);
  let width = processStyleValue(props.width) || "100%";
  if (paddingLeft) {
    if (paddingRight) {
      width = `calc(${width} - ${paddingLeft} - ${paddingRight})`;
    } else {
      width = `calc(${width} - ${paddingLeft})`;
    }
  } else if (paddingRight) {
    width = `calc(${width} - ${paddingRight})`;
  }
  console.log("width", width);
  const elementStyle: CSSProperties = {
    padding,
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
