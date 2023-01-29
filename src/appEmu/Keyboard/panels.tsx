import { useResizeObserver } from "@/core/useResizeObserver";
import { CSSProperties, DOMAttributes } from "react";

/**
 * Generic panel properties
 */
export type PanelProps<P = {}> = P &
  DOMAttributes<HTMLDivElement> & {
    id?: string;
    useColumns?: boolean;
    flexible?: boolean;
    style?: CSSProperties;
    hostRef?: React.RefObject<HTMLDivElement>;
    onResized?: () => void;
  };

/**
 * Properties of a column panel
 */
export type ColumnProps = PanelProps<{
  width?: string | number;
  flexible?: boolean;
}>;

/**
 * Column panel
 */
export const Column: React.FC<ColumnProps> = ({
  children,
  width,
  flexible,
  style,
  hostRef,
  ...others
}) => {
  if (flexible == undefined && width == undefined) flexible = true;
  return (
    <div
      ref={hostRef}
      style={{
        margin: 0,
        display: "flex",
        height: "100%",
        width: width ?? "100%",
        flexShrink: flexible ? 1 : 0,
        flexGrow: flexible ? 1 : 0,
        overflow: "hidden",
        ...style
      }}
      {...others}
    >
      {children}
    </div>
  );
};

/**
 * Row panel properties
 */
export type RowProps = PanelProps<{
  height?: string | number;
}>;

/**
 * Row panel
 */
export const Row: React.FC<RowProps> = ({
  children,
  height,
  flexible,
  style,
  hostRef,
  onResized,
  ...others
}) => {
  if (flexible == undefined && height == undefined) flexible = true;
  // --- Respond to resizing the main container
  useResizeObserver(hostRef, () => onResized?.());
  return (
    <div
      ref={hostRef}
      style={{
        margin: 0,
        width: "100%",
        display: "flex",
        height: height ?? "100%",
        flexShrink: flexible ? 1 : 0,
        flexGrow: flexible ? 1 : 0,
        overflow: "hidden",
        ...style
      }}
      {...others}
    >
      {children}
    </div>
  );
};
