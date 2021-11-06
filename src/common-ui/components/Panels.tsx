import * as React from "react";
import { DOMAttributes } from "react";
import { CSSProperties, PropsWithChildren } from "react";

/**
 * Generic panel properties
 */
export type PanelProps<P = {}> = P & DOMAttributes<HTMLDivElement> & {
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
  flexible = true,
  style,
  hostRef,
  reverse,
  ...others
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
      {...others}      
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
  ...others
}: PropsWithChildren<ColumnProps>) => {
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
        ...style,
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
  ...others
}: PropsWithChildren<RowProps>) => {
  if (flexible == undefined && height == undefined) flexible = true;
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
      {...others}
    >
      {children}
    </div>
  );
};
