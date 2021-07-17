import * as React from "react";
import { useEffect, useRef } from "react";
import { useState } from "react";
import { CSSProperties, ReactNode } from "react";
import ReactResizeDetector from "react-resize-detector";
import FloatingScrollbar, { ScrollBarApi } from "./FloatingScrollbar";

type PanelProps = {
  showVerticalScrollbar?: boolean;
  showHorizontalScrollbar?: boolean;
  scrollBarSize?: number;
  background?: string;
  focusable?: boolean;
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
  focusable = true,
  sizing,
  checkin,
}: PanelProps) {
  const mounted = useRef(false);
  const verticalApi = useRef<ScrollBarApi>();

  // const [left, setLeft] = useState(0);
  // const [top, setTop] = useState(0);
  // const [width, setWidth] = useState(0);
  // const [height, setHeight] = useState(0);
  // const [scrollWidth, setScrollWidth] = useState(0);
  // const [scrollHeight, setScrollHeight] = useState(0);
  // const [scrollLeft, setScrollLeft] = useState(0);
  // const [scrollTop, setScrollTop] = useState(0);
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

  // const resize = () => {
  //   if (!divHost.current) {
  //     return;
  //   }
  //   setLeft(divHost.current.offsetLeft);
  //   setTop(divHost.current.offsetTop);
  //   setWidth(divHost.current.offsetWidth);
  //   setHeight(divHost.current.offsetHeight);
  //   setScrollWidth(divHost.current.scrollWidth);
  //   setScrollHeight(divHost.current.scrollHeight);
  //   setScrollLeft(divHost.current.scrollLeft);
  //   setScrollTop(divHost.current.scrollTop);
  // };

  // const api: ScrollablePanelApi = {
  //   refreshWrapper: resize,
  // };

  // checkin?.({
  //   refreshWrapper: () => resize(),
  // });

  useEffect(() => {
    if (mounted.current) {
      // resize();
    } else {
      mounted.current = true;
    }
  });

  let horizontalApi: ScrollBarApi | null = null;

  return (
    <div
      tabIndex={focusable ? 0 : -1}
      ref={divHost}
      style={containerStyle}
      onScroll={() => {
        console.log("scrolling", divHost.current.scrollTop, !!verticalApi.current);
        verticalApi.current?.signHostDimension({
          hostLeft: divHost.current.offsetLeft,
          hostTop: divHost.current.offsetTop,
          hostSize: divHost.current.offsetHeight,
          hostCrossSize: divHost.current.offsetWidth,
          hostScrollPos: divHost.current.scrollTop,
          hostScrollSize: divHost.current.scrollHeight
        })
        // setScrollTop(divHost.current.scrollTop);
      }}
      onMouseEnter={() => {
        setPointed(true);
        mouseLeft = false;
      }}
      onMouseLeave={() => {
        setPointed(isSizing);
        mouseLeft = true;
      }}
      onWheel={(e) => {
        divHost.current.scrollTop += e.deltaY / 4;
      }}
      onKeyDown={(e) => {
        if (e.key === "Home") {
          console.log("Home!");
          divHost.current.scrollTop = 0;
          // setScrollTop(0);
        }
      }}
    >
      {children}
      {showVerticalScrollbar && (
        <FloatingScrollbar
          direction="vertical"
          barSize={scrollBarSize}
          // hostTop={top}
          // hostLeft={left}
          // hostSize={height}
          // hostCrossSize={width}
          // hostScrollSize={scrollHeight}
          // hostScrollPos={scrollTop}
          forceShow={pointed}
          registerApi={(api) => (verticalApi.current = api)}
          moved={(delta) => {
            if (divHost?.current) {
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
          // hostTop={top}
          // hostLeft={left}
          // hostSize={width}
          // hostCrossSize={height}
          // hostScrollSize={scrollWidth}
          // hostScrollPos={scrollLeft}
          forceShow={pointed}
          registerApi={(api) => (horizontalApi = api)}
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
          // resize();
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
