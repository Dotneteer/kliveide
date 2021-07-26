import * as React from "react";
import { CSSProperties, useState } from "react";

export type VerticalSplitterProps = {
  direction?: "vertical" | "horizontal";
  size?: number;
  position: number;
  length: number | string;
  shift?: number;
};

/**
 * This component implements the vertical splitter of the IDE
 */
export default function Splitter({
  direction = "vertical",
  size = 8,
  position,
  length,
  shift = 0,
}: VerticalSplitterProps) {
  const [pointed, setPointed] = useState(false);
  const isVertical = direction === "vertical";
  const vertSpliterStyle: CSSProperties = {
    position: "absolute",
    top: isVertical ? shift : position,
    left: isVertical ? position : shift,
    height: isVertical ? length : size,
    width: isVertical ? size : length,
    backgroundColor: pointed ? "lightblue" : "blue",
    opacity: pointed ? 1 : 0.5,
    cursor: isVertical ? "ew-resize" : "ns-resize",
  };

  return (
    <div
      style={vertSpliterStyle}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
    />
  );
}
