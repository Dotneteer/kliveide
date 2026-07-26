import { ReactNode, useEffect, useRef } from "react";
import { Virtualizer, VListHandle } from "virtua";
import ScrollViewer from "./ScrollViewer";

type Props<T> = {
  items?: readonly T[] | null;
  overscan?: number;
  startIndex?: number; // Initial scroll position
  renderItem?: (index: number, item: T) => ReactNode;
  apiLoaded?: (api: VListHandle) => void;
  onScroll?: (offset: number) => void;
};

export const VirtualizedList = <T,>({
  items,
  overscan,
  startIndex,
  renderItem,
  apiLoaded,
  onScroll
}: Props<T>) => {
  const ref = useRef<VListHandle>(null);
  const hasScrolledToStart = useRef(false);
  const hasNotifiedApi = useRef(false);
  const safeItems = items ?? [];

  useEffect(() => {
    if (ref.current) {
      // Only call apiLoaded once per component instance
      if (!hasNotifiedApi.current) {
        hasNotifiedApi.current = true;
        apiLoaded?.(ref.current);
      }

      // Scroll to initial position on first mount only
      if (!hasScrolledToStart.current && startIndex !== undefined && startIndex > 0) {
        hasScrolledToStart.current = true;
        ref.current?.scrollToIndex(startIndex, { align: "start" });
      }
    }
  }, [apiLoaded, startIndex]);

  return (
    <ScrollViewer>
      <Virtualizer
        ref={ref}
        overscan={overscan}
        onScroll={(offset) => onScroll?.(offset)}
        count={safeItems.length}
      >
        {(i) => {
          const rendered = renderItem?.(i, safeItems[i]);
          return rendered !== undefined && rendered !== null && rendered !== false ? (
            <>{rendered}</>
          ) : (
            <div key={i} aria-hidden="true" style={{ height: 0 }} />
          );
        }}
      </Virtualizer>
    </ScrollViewer>
  );
};
