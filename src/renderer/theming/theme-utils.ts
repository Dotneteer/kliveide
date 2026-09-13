import type { PanelProps } from "@renderer/controls/layout/LayoutProps";
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
  const paddingTop = processStyleValue(props.paddingVertical) || padding || 0;
  const paddingBottom = processStyleValue(props.paddingVertical) || padding || 0;
  const height = processStyleValue(props.height);
  // Horizontal padding used to be subtracted from the width here, because content-box added it back
  // on top. Under the universal border-box rule (assets/styles/index.css) padding is already inside
  // the declared width, so subtracting it a second time would shrink every padded panel by 2x its
  // padding.
  const width = processStyleValue(props.width) || "100%";
  const elementStyle: CSSProperties = {
    padding,
    paddingLeft,
    paddingRight,
    paddingTop,
    paddingBottom,
    backgroundColor: processStyleValue(props.backgroundColor),
    color: processStyleValue(props.color),
    fontFamily: processStyleValue(props.fontFamily),
    fontSize: processStyleValue(props.fontSize),
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
