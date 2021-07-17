import * as React from "react";
import { useEffect, useRef } from "react";
import { useState } from "react";
import { CSSProperties, ReactNode } from "react";
import ReactResizeDetector from "react-resize-detector";
import FloatingScrollbar from "./FloatingScrollbar";

type PanelProps = {
  showVerticalScrollbar?: boolean;
  showHorizontalScrollbar?: boolean;
  scrollBarSize?: number;
  background?: string;
  sizing?: (isSizing: boolean) => void;
  checkin?: (api: ScrollablePanelApi) => void;
} & { children?: ReactNode };

/**
 * Represents a scrollable panel with optional scrollbars
 */
export default function ScrollablePanel({
  children,
  showHorizontalScrollbar = true,
  showVerticalScrollbar = true,
  scrollBarSize = 4,
  background = "var(--shell-canvas-background-color)",
  sizing,
  checkin,
}: PanelProps) {
  const mounted = useRef(false);

  const [left, setLeft] = useState(0);
  const [top, setTop] = useState(0);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [scrollHeight, setScrollHeight] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [pointed, setPointed] = useState(false);

  const divHost = React.createRef<HTMLDivElement>();
  let isSizing = false;
  let mouseLeft = false;
  
  const containerStyle: CSSProperties = {
    display: "flex",
    flexDirection: "row",
    flexGrow: 1,
    flexShrink: 1,
    width: "100%",
    height: "100%",
    background,
    overflow: "hidden",
  };

  const resize = () => {
    if (!divHost.current) {
      return;
    }
    setLeft(divHost.current.offsetLeft);
    setTop(divHost.current.offsetTop);
    setWidth(divHost.current.offsetWidth);
    setHeight(divHost.current.offsetHeight);
    setScrollWidth(divHost.current.scrollWidth);
    setScrollHeight(divHost.current.scrollHeight);
    setScrollLeft(divHost.current.scrollLeft);
    setScrollTop(divHost.current.scrollTop);
  };

  const api: ScrollablePanelApi = {
    refreshWrapper: resize,
  }

  checkin?.({
    refreshWrapper: () => resize(),
  });

  useEffect(() => {
    if (mounted.current) {
      resize();
    } else {
      mounted.current = true;
    }
  });

  let verticalMoveApi: ((delta: number) => void) | null = null;

  return (
    <div
      ref={divHost}
      style={containerStyle}
      onMouseEnter={() => {
        setPointed(true);
        mouseLeft = false;
      }}
      onMouseLeave={() => {
        setPointed(isSizing);
        mouseLeft = true;
      }}
      onWheel={(e) => verticalMoveApi?.(e.deltaY / 4)}
    >
      {children}
      {showVerticalScrollbar && (
        <FloatingScrollbar
          direction="vertical"
          barSize={scrollBarSize}
          hostTop={top}
          hostLeft={left}
          hostSize={height}
          hostCrossSize={width}
          hostScrollSize={scrollHeight}
          hostScrollPos={scrollTop}
          forceShow={pointed}
          registerApi={(action) => (verticalMoveApi = action)}
          moved={(delta) => {
            if (divHost?.current) {
              console.log(delta);
              divHost.current.scrollTop = delta;
            }
          }}
          sizing={(nowSizing) => {
            isSizing = nowSizing;
            sizing?.(nowSizing);
            if (!nowSizing && mouseLeft) {
              setPointed(false);
            }
          }}
        />
      )}
      {showHorizontalScrollbar && (
        <FloatingScrollbar
          direction="horizontal"
          barSize={scrollBarSize}
          hostTop={top}
          hostLeft={left}
          hostSize={width}
          hostCrossSize={height}
          hostScrollSize={scrollWidth}
          hostScrollPos={scrollLeft}
          forceShow={pointed}
          moved={(delta) => {
            if (divHost?.current) {
              divHost.current.scrollLeft = delta;
            }
          }}
          sizing={(nowSizing) => {
            isSizing = nowSizing;
            sizing?.(nowSizing);
            if (!nowSizing && mouseLeft) {
              setPointed(false);
            }
          }}
        />
      )}
      <ReactResizeDetector
        targetRef={divHost}
        handleWidth
        handleHeight
        onResize={() => {
          resize();
        }}
      />
    </div>
  );
}

/**
 * Represents the API of the scrollable panel
 */
export type ScrollablePanelApi = {
  refreshWrapper: () => void;
};
