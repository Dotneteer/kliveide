import * as React from "react";
import { CSSProperties, useRef, useState } from "react";

export type VerticalSplitterProps = {
  id: string;
  direction?: "vertical" | "horizontal";
  size?: number;
  position: number;
  length: number | string;
  shift?: number;
  onStartMove?: () => void;
  onMove?: (delta: number) => void;
  onEndMove?: () => void;
};

/**
 * This component implements the vertical splitter of the IDE
 */
export default function Splitter({
  id,
  direction = "vertical",
  size = 8,
  position,
  length,
  shift = 0,
  onStartMove,
  onMove,
  onEndMove,
}: VerticalSplitterProps) {
  // --- Store the grip position when mouse movement starts
  const gripPosition = useRef(0);

  // --- Bind functions
  const _move = (e: MouseEvent) => move(e);
  const _endMove = () => endMove();

  const [pointed, setPointed] = useState(false);
  const [dragging, setDragging] = useState(false);

  const isVertical = direction === "vertical";
  let splitterStyle: CSSProperties = {
    position: "absolute",
    top: isVertical ? shift : position,
    left: isVertical ? position : shift,
    height: isVertical ? length : size,
    width: isVertical ? size : length,
    backgroundColor: pointed || dragging ? "var(--splitter-hover-color)" : "transparent",
    opacity: pointed || dragging ? 1 : 0,
    cursor: isVertical ? "ew-resize" : "ns-resize",
    transitionProperty: "background-color",
    transitionDelay: "0.25s",
    transitionDuration: "0.25s",
    zIndex: 100,
  };

  return (
    <div
      id={id}
      style={splitterStyle}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
      onMouseDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        if (e.button === 0) {
          startMove(e);
        }
      }}
      onMouseUp={() => endMove()}
    />
  );

  function startMove(e: React.MouseEvent): void {
    gripPosition.current = isVertical ? e.clientX : e.clientY;
    window.addEventListener("mouseup", _endMove);
    window.addEventListener("touchend", _endMove);
    window.addEventListener("touchcancel", _endMove);
    window.addEventListener("mousemove", _move);
    window.addEventListener("touchmove", _move);
    document.body.style.cursor = isVertical ? "ew-resize" : "ns-resize";
    setDragging(true);
    onStartMove?.();
  }

  function move(e: MouseEvent): void {
    const delta = (isVertical ? e.clientX : e.clientY) - gripPosition.current;
    onMove?.(delta);
  }

  function endMove(): void {
    window.removeEventListener("mouseup", _endMove);
    window.removeEventListener("touchend", _endMove);
    window.removeEventListener("touchcancel", _endMove);
    window.removeEventListener("mousemove", _move);
    window.removeEventListener("touchmove", _move);
    document.body.style.cursor = "default";
    setDragging(false);
    onEndMove?.();
  }
}
