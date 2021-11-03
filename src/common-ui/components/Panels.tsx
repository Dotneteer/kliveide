import * as React from "react";
import { CSSProperties, PropsWithChildren } from "react";

/**
 * Generic panel properties
 */
export type PanelProps<P = {}> = P & {
  useColumns?: boolean;
  flexible?: boolean;
  style?: CSSProperties;
  hostRef?: React.RefObject<HTMLDivElement>;
};

/**
 * Fill panel properties
 */
export type FillProps = PanelProps<{
  useColumns?: boolean;
  reverse?: boolean;
}>;

/**
 * Fill panel component.
 * Fills its parent's entire client area
 */
export const Fill: React.FC<FillProps> = ({
  children,
  useColumns,
  flexible,
  style,
  hostRef,
  reverse,
}: PropsWithChildren<FillProps>) => {
  return (
    <div
      ref={hostRef}
      style={{
        margin: 0,
        width: "100%",
        display: "flex",
        flexDirection: useColumns
          ? reverse
            ? "row-reverse"
            : "row"
          : reverse
          ? "column-reverse"
          : "column",
        flexShrink: flexible ? 1 : 0,
        flexGrow: flexible ? 1 : 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
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
}: PropsWithChildren<ColumnProps>) => {
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
        ...style,
      }}
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
}: PropsWithChildren<RowProps>) => {
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
        ...style,
      }}
    >
      {children}
    </div>
  );
};
