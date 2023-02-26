import { ReactNode, useEffect, useRef, useState } from "react";
import styles from "./VirtualizedList.module.scss";
import { useVirtualizer } from "@tanstack/react-virtual";
import classnames from "@/utils/classnames";

type ScrollAlignment = "start" | "center" | "end" | "auto";
type ScrollBehavior = "auto" | "smooth";
type ScrollToOptions = {
  align?: ScrollAlignment;
  behavior?: ScrollBehavior;
};

export type VirtualizedListApi = {
  scrollToIndex: (index: number, options?: ScrollToOptions) => void;
  scrollToOffset: (offset: number, options?: ScrollToOptions) => void;
  scrollToTop: () => void;
  scrollToEnd: () => void;
  refresh: () => void;

  // --- APIs for virtualizes scroll viewer
  getScrollHeight: () => number;
  getScrollWidth: () => number;
  getScrollTop: () => number;
  getScrollLeft: () => number;
  scrollVertical: (pos: number) => void;
  scrollHorizontal: (pos: number) => void;
  getRange: () => { startIndex: number; endIndex: number };
};

type Props = {
  items: any[];
  approxSize?: number;
  fixItemHeight?: boolean;
  hideScrollBars?: boolean;
  getItemKey?: (index: number) => string | number;
  itemRenderer: (index: number) => ReactNode;
  apiLoaded?: (api: VirtualizedListApi) => void;
  vScrolled?: (offset: number) => void;
};

export const VirtualizedList = ({
  items,
  approxSize,
  fixItemHeight = true,
  hideScrollBars = false,
  getItemKey,
  itemRenderer,
  apiLoaded,
  vScrolled
}: Props) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => approxSize ?? 20,
    getItemKey,
    overscan: 20,
  });

  const columnVirtualizer = useVirtualizer({
    horizontal: true,
    count: 1,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    getItemKey,
    overscan: 0
  });

  const [count, setCount] = useState(0);

  useEffect(() => {
    // --- Provide an API for the virtualizer
    const scrollHandler = () => vScrolled?.(virtualizer?.scrollOffset);

    if (virtualizer && columnVirtualizer) {
      const api: VirtualizedListApi = {
        scrollToIndex: (index: number, options: ScrollToOptions) =>
          virtualizer.scrollToIndex(index, options),
        scrollToOffset: (offset: number, options: ScrollOptions) =>
          virtualizer.scrollToOffset(offset, options),
        scrollToTop: () => virtualizer.scrollToIndex(0),
        scrollToEnd: () => {
          if (items?.length > 0) {
            virtualizer.scrollToIndex(
              (items?.length > 0 ? items.length - 1 : 0) ?? 0,
              {
                align: "end",
                behavior: "auto"
              }
            );
          }
        },
        refresh: () => setCount(count + 1),
        getScrollHeight: () => scrollerRef.current?.scrollHeight ?? 1,
        getScrollWidth: () => columnVirtualizer.scrollElement.scrollWidth ?? 1,
        getScrollTop: () => {
          return virtualizer.scrollOffset;
        },
        getScrollLeft: () => columnVirtualizer.scrollOffset,
        scrollVertical: (pos: number) => {
          virtualizer.scrollToOffset(pos);
        },
        scrollHorizontal: (pos: number) => {
          columnVirtualizer.scrollToOffset(pos);
        },
        getRange: () => virtualizer.range
      };
      apiLoaded?.(api);
      virtualizer.scrollElement.addEventListener("scroll", scrollHandler);
    }

    return () =>
      virtualizer?.scrollElement?.removeEventListener("scroll", scrollHandler);
  }, [virtualizer, columnVirtualizer]);

  return (
    <div
      ref={parentRef}
      className={classnames(styles.virtualizedList, {
        [styles.hideScrollBar]: hideScrollBars
      })}
      style={{ overflowY: "auto" }}
    >
      <div
        ref={scrollerRef}
        style={{
          height: virtualizer.getTotalSize(),
          width: "100%",
          position: "relative"
        }}
      >
        {virtualizer.getVirtualItems().map(virtualRow =>
          fixItemHeight ? (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              className={virtualRow.index % 2 ? "ListItemOdd" : "ListItemEven"}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              {itemRenderer(virtualRow.index)}
            </div>
          ) : (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              className={virtualRow.index % 2 ? "ListItemOdd" : "ListItemEven"}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${virtualRow.start}px)`
              }}
            >
              {itemRenderer(virtualRow.index)}
            </div>
          )
        )}
      </div>
    </div>
  );
};
