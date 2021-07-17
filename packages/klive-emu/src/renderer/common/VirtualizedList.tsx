import * as React from "react";
import { CSSProperties, useEffect } from "react";
import { useRef } from "react";
import { useState } from "react";
import FloatingScrollbarOld, { ScrollbarApi } from "./FloatingScrollbar";
import { handleScrollKeys } from "./utils";

type ItemRenderer = (index: number, style: CSSProperties) => JSX.Element;

export type VirtualizedListProps = {
  numItems: number;
  itemHeight: number;
  focusable?: boolean;
  renderItem: ItemRenderer;
};

export default function VirtualizedList({
  numItems,
  itemHeight = 20,
  focusable = true,
  renderItem,
}: VirtualizedListProps) {
  const mounted = useRef(false);
  const initialized = useRef(false);
  const verticalApi = useRef<ScrollbarApi>();

  const [items, setItems] = useState<React.ReactNode[]>();
  const [pointed, setPointed] = useState(false);

  const divHost = React.createRef<HTMLDivElement>();
  let mouseLeft = false;
  let isSizing = false;
  const innerHeight = numItems * itemHeight;

  const renderItems = () => {
    const scrollPos = divHost.current.scrollTop;
    const startIndex = Math.floor(scrollPos / itemHeight);
    const endIndex = Math.min(
      numItems - 1, // don't render past the end of the list
      Math.floor((scrollPos + divHost.current.offsetHeight) / itemHeight)
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
      divHost.current.scrollTop = scrollPos;
    }
  };

  useEffect(() => {
    if (mounted.current) {
      if (divHost.current.offsetHeight !== 0 && !initialized.current) {
        renderItems();
        initialized.current = true;
      }
    } else {
      updateDimensions();
      mounted.current = true;
    }
  });

  return (
    <>
      <div
        tabIndex={focusable ? 0 : -1}
        ref={divHost}
        className="scroll"
        style={{ overflowY: "hidden" }}
        onScroll={() => {
          updateDimensions();
          renderItems();
        }}
        onWheel={(e) => {
          divHost.current.scrollTop += e.deltaY / 4;
        }}
        onKeyDown={(e) => {
          handleScrollKeys(divHost.current, e.key, e.ctrlKey, itemHeight);
        }}
      >
        <div
          className="inner"
          style={{
            position: "relative",
            height: `${innerHeight}px`,
          }}
          onMouseEnter={() => {
            setPointed(true);
            mouseLeft = false;
          }}
          onMouseLeave={() => {
            setPointed(isSizing);
            mouseLeft = true;
          }}
        >
          {items}
        </div>
      </div>
      <FloatingScrollbarOld
        direction="vertical"
        barSize={10}
        forceShow={pointed}
        registerApi={(api) => (verticalApi.current = api)}
        moved={(delta) => {
          if (divHost?.current) {
            divHost.current.scrollTop = delta;
          }
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

  /**
   * Updates scrollbars according to the panel's dimension changes
   */
  function updateDimensions(): void {
    verticalApi.current?.signHostDimension({
      hostLeft: divHost.current.offsetLeft,
      hostTop: divHost.current.offsetTop,
      hostSize: divHost.current.offsetHeight,
      hostCrossSize: divHost.current.offsetWidth,
      hostScrollPos: divHost.current.scrollTop,
      hostScrollSize: divHost.current.scrollHeight,
    });
  }
}
