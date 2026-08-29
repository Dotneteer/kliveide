import { CSSProperties, ReactNode } from "react";

export type LayoutProps = {
  /** Nested content rendered inside the layout container. */
  children?: ReactNode;
  /** DOM id forwarded to the outer container. */
  id?: string;
  /** Optional application readiness state exposed for end-to-end automation. */
  dataAppReady?: "true" | "false";
  /** Stack direction used by full panels and stack wrappers. */
  orientation?: "vertical" | "horizontal";
  /** Padding applied on all sides. */
  padding?: string;
  /** Horizontal padding override. */
  paddingHorizontal?: string;
  /** Vertical padding override. */
  paddingVertical?: string;
  /** Cross-axis alignment for vertical content. */
  verticalContentAlignment?: string;
  /** Main-axis alignment for horizontal content. */
  horizontalContentAlignment?: string;
  /** Spacing between direct child elements. */
  gap?: string;
  /** Container background color, resolved through theme helpers. */
  backgroundColor?: string;
  /** Background color used while the container is hovered. */
  hoverBackgroundColor?: string;
  /** Foreground text color. */
  color?: string;
  /** Font family applied to the container. */
  fontFamily?: string;
  /** Font size applied to the container. */
  fontSize?: string;
  /** Explicit container height. */
  height?: string;
  /** Explicit container width. */
  width?: string;
  /** Additional inline styles merged onto the container. */
  style?: CSSProperties;
  /** Extra CSS class appended to the layout class. */
  classExt?: string;
};

/** Alias for panel-like components that share the base layout contract. */
export type PanelProps = LayoutProps;
