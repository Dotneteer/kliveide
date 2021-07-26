import * as React from "react";
import { CSSProperties, useState } from "react";

export type VerticalSplitterProps = {
  size?: number;
  position: number;
  height: number | string;
};

/**
 * This component implements the vertical splitter of the IDE
 */
export default function VerticalSplitter({
  size = 8,
  position,
  height,
}: VerticalSplitterProps) {
  const [pointed, setPointed] = useState(false);
  const vertSpliterStyle: CSSProperties = {
    position: "absolute",
    top: 0,
    left: position,
    height: height,
    width: size,
    backgroundColor: pointed ? "lightblue" : "blue",
    opacity: pointed ? 1 : 0.5,
    cursor: "ew-resize",
  };

  return (
    <div
      style={vertSpliterStyle}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
    />
  );
}
