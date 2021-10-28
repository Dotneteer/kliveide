import * as React from "react";
import { CSSProperties } from "react";

type StyledContainer<T> = T &
  React.HTMLAttributes<HTMLDivElement> & {
    style?: CSSProperties;
    children?: React.ReactNode;
  };

/**
 * Properties of a grid
 */
export type GridProps = {
  rows?: number;
  columns?: number;
  rowGap?: number | string;
  columnGap?: number | string;
};

/**
 * Simple grid container
 */
export function Grid({
  rows = 2,
  columns = 2,
  rowGap = 0,
  columnGap = 0,
  style,
  children,
}: StyledContainer<GridProps>) {
  const divStyle: CSSProperties = {
    ...style,
    display: "grid",
    gridTemplateRows: `repeat(${rows}, 1fr)`,
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    rowGap,
    columnGap,
  };
  return <div style={divStyle}>{children}</div>;
}

export type CellProps = {
  pos: string;
};

export function Cell(props: StyledContainer<CellProps>) {
  const divStyle: CSSProperties = { ...props.style, gridArea: props.pos };
  const propsToPass = { ...props, style: divStyle };
  return <div {...propsToPass}>{props.children}</div>;
}

export function CenteredRow(props: StyledContainer<{}>) {
  const divStyle: CSSProperties = {
    ...props.style,
    display: "flex",
    flexDirection: "row",
    alignItems: "center",
  };
  const propsToPass = { ...props, style: divStyle };
  return <div {...propsToPass}>{props.children}</div>;
}
