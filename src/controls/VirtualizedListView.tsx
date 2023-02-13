import { ReactNode, useRef, useState } from "react";
import { ScrollViewer, ScrollViewerApi } from "./ScrollViewer";
import { VirtualizedList, VirtualizedListApi } from "./VirtualizedList";

type Props = {
  scrollBarWidth?: number;
  allowHorizontal?: boolean;
  allowVertical?: boolean;
  items: any[];
  approxSize?: number;
  fixItemHeight?: boolean;
  itemRenderer: (index: number) => ReactNode;
  apiLoaded?: (api: VirtualizedListApi) => void;
  scrolled?: () => void;
};

export const VirtualizedListView = ({
  scrollBarWidth = 10,
  allowHorizontal,
  allowVertical,
  items,
  approxSize,
  fixItemHeight,
  itemRenderer,
  apiLoaded,
  scrolled
}: Props) => {
  const svApi = useRef<ScrollViewerApi>();
  const vlApi = useRef<VirtualizedListApi>();

  return (
    <ScrollViewer
      scrollBarWidth={scrollBarWidth}
      allowHorizontal={allowHorizontal}
      allowVertical={allowVertical}
      apiLoaded={api => svApi.current = api}
      getScrollHeightFn={() => vlApi.current?.getScrollHeight() ?? 1}
      getScrollWidthFn={() => vlApi.current?.getScrollWidth() ?? 1}
      getScrollTopFn={() => vlApi.current?.getScrollTop() ?? 1}
      getScrollLeftFn={() => vlApi.current?.getScrollLeft() ?? 1}
      scrollVerticalFn={pos => vlApi.current?.scrollVertical(pos)}
      scrollHorizontalFn={pos => vlApi.current?.scrollHorizontal(pos)}
      shadowVisibleFn={() => vlApi.current?.getScrollTop() > 0}
    >
      <VirtualizedList
        hideScrollBars={true}
        items={items}
        approxSize={approxSize}
        fixItemHeight={fixItemHeight}
        itemRenderer={itemRenderer}
        apiLoaded={api => {
          vlApi.current = api;
          apiLoaded?.(api);
        }}
        vScrolled={() => {
          svApi.current?.updateDims();
          scrolled?.();
        }}
      />
    </ScrollViewer>
  );
};
