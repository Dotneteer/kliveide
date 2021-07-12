import * as React from "react";
import { CSSProperties } from "react";

/**
 * Use this style within a scrollable panel
 */
export const scrollableContentType: CSSProperties = {
  width: "fit-content",
  height: "fit-content",
  paddingBottom: 4,
};

/**
 * The style of the root <div> of a panel
 */
export const valueItemStyle: CSSProperties = {
  display: "flex",
  flexDirection: "row",
  width: "auto",
  height: "auto",
  paddingLeft: 8,
  alignItems: "center",
};

/**
 * The style of a label tag
 * @param width Lable width
 */
export function labelStyle(width = 30): CSSProperties {
  return {
    flexShrink: 0,
    flexGrow: 0,
    width,
    fontWeight: 600,
  };
}

/**
 * The style of a value tag
 * @param width Value width
 */
export function valueStyle(width: number): CSSProperties {
  return {
    width,
    color: "var(--hilited-color)",
  };
}

/**
 * Inserts a separator line
 * @param height Separator line height
 */
export function separatorLine(height = 4): React.ReactNode {
  return <div style={{ height }}></div>;
}
