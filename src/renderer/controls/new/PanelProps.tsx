import { CSSProperties } from "react";

export type PanelProps = {
  children: React.ReactNode;
  id?: string;
  orientation?: "vertical" | "horizontal";
  padding?: string;
  paddingHorizontal?: string;
  paddingVertical?: string;
  verticalContentAlignment?: string;
  horizontalContentAlignment?: string;
  gap?: string;
  backgroundColor?: string;
  height?: string;
  width?: string;
  style?: CSSProperties;
  classExt?: string;
};

