import * as React from "react";
import { useEffect, useRef } from "react";
import { useState } from "react";
import { CSSProperties, ReactNode } from "react";
import FloatingScrollbar, { ScrollBarApi } from "./FloatingScrollbar";

type PanelProps = {
  showVerticalScrollbar?: boolean;
  showHorizontalScrollbar?: boolean;
  scrollBarSize?: number;
  background?: string;
  focusable?: boolean;
  sizing?: (isSizing: boolean) => void;
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
}: PanelProps) {
  const mounted = useRef(false);
  const verticalApi = useRef<ScrollBarApi>();
  const horizontalApi = useRef<ScrollBarApi>();

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

  useEffect(() => {
    if (mounted.current) {
      updateDimensions();
    } else {
      mounted.current = true;
    }
  });

  return (
    <div
      tabIndex={focusable ? 0 : -1}
      ref={divHost}
      style={containerStyle}
      onScroll={() => {
        updateDimensions();
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
        }
      }}
    >
      {children}
      {showVerticalScrollbar && (
        <FloatingScrollbar
          direction="vertical"
          barSize={scrollBarSize}
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
          forceShow={pointed}
          registerApi={(api) => (horizontalApi.current = api)}
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
      {/* <ReactResizeDetector
        targetRef={divHost}
        handleWidth
        handleHeight
        onResize={() => {
          // resize();
        }}
      /> */}
    </div>
  );

  function updateDimensions(): void {
    verticalApi.current?.signHostDimension({
      hostLeft: divHost.current.offsetLeft,
      hostTop: divHost.current.offsetTop,
      hostSize: divHost.current.offsetHeight,
      hostCrossSize: divHost.current.offsetWidth,
      hostScrollPos: divHost.current.scrollTop,
      hostScrollSize: divHost.current.scrollHeight,
    });
    horizontalApi.current?.signHostDimension({
      hostLeft: divHost.current.offsetLeft,
      hostTop: divHost.current.offsetTop,
      hostSize: divHost.current.offsetWidth,
      hostCrossSize: divHost.current.offsetHeight,
      hostScrollPos: divHost.current.scrollLeft,
      hostScrollSize: divHost.current.scrollWidth,
    });
  }
}
