import * as React from "react";
import { useEffect } from "react";
import { useState } from "react";
import { CSSProperties, ReactNode } from "react";
import ReactResizeDetector from "react-resize-detector";

type PanelProps = {
  showVerticalScrollbar?: boolean;
  showHorizontalScrollbar?: boolean;
  scrollBarSize?: number;
} & { children?: ReactNode };

/**
 * Represents a scrollable panel with optional scrollbars
 */
export default function ScrollablePanel({
  children,
  showHorizontalScrollbar = true,
  showVerticalScrollbar = true,
  scrollBarSize = 4,
}: PanelProps) {
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [scrollHeight, setScrollHeight] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const divHost = React.createRef<HTMLDivElement>();

  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "row",
    flexGrow: 1,
    flexShrink: 1,
    width: "100%",
    height: "100%",
    background: "var(--commandbar-background-color)",
    overflowX: "hidden",
  };

  const resize = () => {
    setWidth(divHost.current.offsetWidth);
    setHeight(divHost.current.offsetHeight);
    setScrollWidth(divHost.current.scrollWidth);
    setScrollHeight(divHost.current.scrollHeight);
    setScrollLeft(divHost.current.scrollLeft);
    setScrollTop(divHost.current.scrollTop);
  };

  useEffect(() => {
    resize();
  });

  return (
    <div ref={divHost} style={containerStyle}>
      {children}
      {showVerticalScrollbar && (
        <FloatingScrollbar
          direction="vertical"
          barSize={scrollBarSize}
          hostSize={height}
          hostCrossSize={width}
          hostScrollSize={scrollHeight}
          hostScrollPos={scrollTop}
        />
      )}
      {showHorizontalScrollbar && (
        <FloatingScrollbar
          direction="horizontal"
          barSize={scrollBarSize}
          hostSize={width}
          hostCrossSize={height}
          hostScrollSize={scrollWidth}
          hostScrollPos={scrollLeft}
          moved={(delta) => {
            divHost.current.scrollLeft = delta;
          }}
        />
      )}
      <ReactResizeDetector
        targetRef={divHost}
        handleWidth
        handleHeight
        onResize={resize}
      />
    </div>
  );
}

type Orientation = "vertical" | "horizontal";

type ScrollBarProps = {
  direction: Orientation;
  barSize?: number;
  hostSize: number;
  hostCrossSize: number;
  hostScrollSize: number;
  hostScrollPos: number;
  moved?: (newPosition: number) => void;
};

function FloatingScrollbar({
  direction,
  barSize = 10,
  hostSize,
  hostCrossSize,
  hostScrollSize,
  hostScrollPos,
  moved,
}: ScrollBarProps) {
  const show = hostScrollSize > hostSize;
  const handleSize =
    show && hostScrollSize > 0 ? (hostSize * hostSize) / hostScrollSize : 0;
  var initialPos =
    show && hostScrollSize > 0
      ? (hostScrollPos * hostSize) / hostScrollSize
      : 0;
  if (initialPos + handleSize > hostSize) {
    initialPos = hostSize - handleSize;
  }

  const [handlePos, setHandlePos] = useState(initialPos);
  const [pointed, setPointed] = useState(false);
  const [dragging, setDragging] = useState(false);

  const barStyle: CSSProperties = {
    position: "absolute",
    top: direction === "horizontal" ? hostCrossSize - barSize : undefined,
    left: direction === "vertical" ? hostCrossSize - barSize : undefined,
    width: direction === "horizontal" ? hostSize : barSize,
    height: direction === "vertical" ? hostSize : barSize,
    background: "transparent",
  };

  const handleStyle: CSSProperties = {
    position: "absolute",
    top: direction === "horizontal" ? undefined : handlePos,
    left: direction === "vertical" ? undefined : handlePos,
    width: direction === "horizontal" ? handleSize : barSize,
    height: direction === "vertical" ? handleSize : barSize,
    background: "var(--scrollbar-background-color)",
    opacity: show && (dragging ? 1.0 : pointed ? 0.8 : 0.0),
    transitionProperty: "opacity",
    transitionDuration: dragging ? "0s" : "0.5s",
    transitionDelay: dragging ? "0s" : "0.25s",
  };

  // --- We need a context that uses "this" function when handles the `move`
  // --- function to respond to document events
  const context: DragContext = {
    gripPosition: 0,
    move: (e: MouseEvent) => move(e, context),
    resized: (newPosition, newHandlePosition) => {
      moved?.(newPosition);
      setHandlePos(newHandlePosition);
    },
    endDragging: () => {
      setDragging(false);
    },
  };

  /**
   * Starts resizing this panel
   */
  function startResize(e: React.MouseEvent): void {
    context.gripPosition = direction === "horizontal" ? e.clientX : e.clientY;
    window.addEventListener("mouseup", endResize);
    window.addEventListener("touchend", endResize);
    window.addEventListener("touchcancel", endResize);
    window.addEventListener("mousemove", context.move);
    window.addEventListener("touchmove", context.move);
  }

  /**
   * Ends resizing this panel
   */
  function endResize(): void {
    window.removeEventListener("mouseup", endResize);
    window.removeEventListener("touchend", endResize);
    window.removeEventListener("touchcancel", endResize);
    window.removeEventListener("mousemove", context.move);
    window.removeEventListener("touchmove", context.move);
    context.endDragging();
  }

  /**
   * Change the size of the element
   */
  function move(e: MouseEvent, context: DragContext): void {
    const delta =
      (direction === "horizontal" ? e.clientX : e.clientY) -
      context.gripPosition;
    const maxPosition = hostSize - handleSize;
    var newPosition = Math.max(0, handlePos + delta);
    newPosition = Math.min(newPosition, maxPosition);
    var newScrollPosition = (newPosition * hostScrollSize) / hostSize;
    context.resized(newScrollPosition, newPosition);
  }

  return (
    <div
      style={barStyle}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
    >
      {show && (
        <div
          style={handleStyle}
          onMouseDown={(ev) => {
            if (ev.button === 0) {
              startResize(ev);
              setDragging(true);
            }
          }}
          onMouseUp={() => {
            endResize();
            setDragging(false);
          }}
        />
      )}
    </div>
  );
}

// --- Context for the drag operation
interface DragContext {
  gripPosition: number;
  move: (e: MouseEvent) => void;
  resized: (newPosition: number, newHandlePos: number) => void;
  endDragging: () => void;
}
