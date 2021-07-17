import * as React from "react";
import { CSSProperties, useEffect } from "react";
import { useState } from "react";
import ReactResizeDetector from "react-resize-detector";
import FloatingScrollbarOld, { ScrollBarApi } from "./FloatingScrollbar";
import { animationTick } from "./utils";

type ItemRenderer = (index: number, style: CSSProperties) => JSX.Element;

export type VirtualizedListProps = {
  numItems: number;
  itemHeight: number;
  renderItem: ItemRenderer;
};

export default function VirtualizedList({
  numItems,
  itemHeight,
  renderItem,
}: VirtualizedListProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [windowHeight] = useState(800);
  const [left, setLeft] = useState(0);
  const [top, setTop] = useState(0);
  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [scrollHeight, setScrollHeight] = useState(0);
  const [items, setItems] = useState<React.ReactNode[]>([]);
  const [pointed, setPointed] = useState(false);

  const divHost = React.createRef<HTMLDivElement>();
  let mouseLeft = false;
  let isSizing = false;
  const innerHeight = numItems * itemHeight;

  const resize = () => {
    if (!divHost.current) {
      return;
    }
    setLeft(divHost.current.offsetLeft);
    setTop(divHost.current.offsetTop);
    setWidth(divHost.current.offsetWidth);
    setHeight(divHost.current.offsetHeight);
    setScrollHeight(divHost.current.scrollHeight);
    renderItems(divHost.current.scrollTop);
  };

  const renderItems = (delta: number) => {
    const startIndex = Math.floor(delta / itemHeight);
    const endIndex = Math.min(
      numItems - 1, // don't render past the end of the list
      Math.floor((delta + windowHeight) / itemHeight)
    );
    const tmpItems: React.ReactNode[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      const item = renderItem(i, {
        position: "absolute",
        top: `${i * itemHeight}px`,
        width: "100%",
      });
      tmpItems.push(item);
    }
    setItems(tmpItems);
    if (divHost?.current) {
      divHost.current.scrollTop = delta;
    }
  };

  useEffect(() => {
    if (divHost?.current) {
      divHost.current.scrollTop = scrollTop;
    }
  });

  let verticalApi: ScrollBarApi | null = null;

  return (
    <>
      <div
        ref={divHost}
        className="scroll"
        style={{ overflowY: "hidden" }}
        onMouseEnter={() => {
          setPointed(true);
          mouseLeft = false;
        }}
        onMouseLeave={() => {
          setPointed(isSizing);
          mouseLeft = true;
        }}
        // onWheel={(e) => verticalMoveApi?.(e.deltaY / 4)}
      >
        <div
          className="inner"
          style={{
            position: "relative",
            height: `${innerHeight}px`,
            display: "flex",
          }}
        >
          {items}
        </div>
        <ReactResizeDetector
          targetRef={divHost}
          handleWidth
          handleHeight
          onResize={() => {
            resize();
          }}
        />
      </div>
      <FloatingScrollbarOld
        direction="vertical"
        barSize={8}
        // hostTop={top}
        // hostLeft={left}
        // hostSize={height}
        // hostCrossSize={width}
        // hostScrollSize={scrollHeight}
        // hostScrollPos={0}
        forceShow={pointed}
        registerApi={(api) => (verticalApi = api)}
        moved={(delta) => {
          setScrollTop(delta);
          renderItems(delta);
        }}
        sizing={(nowSizing) => {
          isSizing = nowSizing;
          if (!nowSizing && mouseLeft) {
            setPointed(false);
          }
        }}
      />
    </>
  );
}
