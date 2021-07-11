import { CSSProperties } from "react";

/**
 * Use this style within a scrollable panel
 */
export const scrollableContentType: CSSProperties = {
  width: "fit-content",
  height: "fit-content",
};

/**
 * The style of the root <div> of a panel
 */
export const panelRootStyle: CSSProperties = {
  display: "flex",
  flexDirection: "row",
  width: "auto",
  height: "auto",
  paddingLeft: 8,
  alignItems: "center",
};


