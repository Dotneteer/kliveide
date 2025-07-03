import { CSSProperties } from "react";

/**
 * Style-related props for panel components
 */
export type PanelStyleProps = {
  /** Shorthand for setting padding on all sides */
  padding?: string;
  /** Padding for left and right sides */
  paddingHorizontal?: string;
  /** Padding for top and bottom sides */
  paddingVertical?: string;
  /** Controls alignment of children along the vertical axis */
  verticalContentAlignment?: string;
  /** Controls alignment of children along the horizontal axis */
  horizontalContentAlignment?: string;
  /** Space between child elements */
  gap?: string;
  /** Background color of the panel */
  backgroundColor?: string;
  /** Background color when the panel is hovered */
  hoverBackgroundColor?: string;
  /** Text color within the panel */
  color?: string;
  /** Font family for text within the panel */
  fontFamily?: string;
  /** Font size for text within the panel */
  fontSize?: string;
  /** Height of the panel */
  height?: string;
  /** Width of the panel */
  width?: string;
  /** Additional inline styles to apply */
  style?: CSSProperties;
};

/**
 * Common DOM-related props for panel components
 */
export type PanelDOMProps = {
  /** Optional ID for the panel element */
  id?: string;
  /** Additional CSS classes to apply */
  classExt?: string;
};

/**
 * Base props shared by all panel components
 */
export type PanelProps = PanelStyleProps & PanelDOMProps & {
  /** Child elements to render within the panel */
  children?: React.ReactNode;
  /** Direction of layout - vertical (default) or horizontal */
  orientation?: "vertical" | "horizontal";
};

/**
 * Props specific to the FullPanel component
 */
export interface FullPanelProps extends PanelProps {
  /** 
   * When true, the panel will occupy the full available height and width
   * @default true
   */
  fullSize?: boolean;
}

/**
 * Props specific to the Stack component
 */
export interface StackProps extends PanelProps {
  /** 
   * Whether items should wrap to the next line when they don't fit
   * @default false
   */
  wrap?: boolean;
}

/**
 * Props specific to the VStack component
 */
export type VStackProps = StackProps;

/**
 * Props specific to the HStack component
 */
export type HStackProps = StackProps;

