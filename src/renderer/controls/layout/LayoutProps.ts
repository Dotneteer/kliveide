import { CSSProperties, ReactNode } from "react";

export type LayoutProps = {
  children?: ReactNode;
  id?: string;
  orientation?: "vertical" | "horizontal";
  padding?: string;
  paddingHorizontal?: string;
  paddingVertical?: string;
  verticalContentAlignment?: string;
  horizontalContentAlignment?: string;
  gap?: string;
  backgroundColor?: string;
  hoverBackgroundColor?: string;
  color?: string;
  fontFamily?: string;
  fontSize?: string;
  height?: string;
  width?: string;
  style?: CSSProperties;
  classExt?: string;
};

export type PanelProps = LayoutProps;
