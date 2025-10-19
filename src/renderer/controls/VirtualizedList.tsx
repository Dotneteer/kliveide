import { useEffect, useRef, useState } from "react";
import { Virtualizer, VListHandle } from "virtua";
import ScrollViewer from "./ScrollViewer";

type Props = {
  items: any[];
  overscan?: number;
  startIndex?: number; // Initial scroll position
  renderItem?: (index: number) => React.ReactNode;
  apiLoaded?: (api: VListHandle) => void;
  onScroll?: (offset: number) => void;
};

export const VirtualizedList = ({ items, overscan, startIndex, renderItem, apiLoaded, onScroll }: Props) => {
  const ref = useRef<VListHandle>(null);
  const [itemsCount, setItemsCount] = useState(items?.length ?? 0);
  const hasScrolledToStart = useRef(false);
  const hasNotifiedApi = useRef(false);

  // --- Notify the parent that the API is ready and scroll to start position
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
        console.log("🎬 [VirtualizedList] Scrolling to startIndex:", startIndex);
        ref.current?.scrollToIndex(startIndex, { align: "start" });
      }
    }
  }, [ref.current, startIndex]);

  useEffect(() => {
    setItemsCount(items?.length ?? 0);
  }, [items]);

  return (
    <ScrollViewer>
      <Virtualizer
        ref={ref}
        overscan={overscan}
        onScroll={(offset) => onScroll?.(offset)}
        count={itemsCount}
      >
        {(i) => {
          const rendered = renderItem?.(i) as any
          return rendered || <div key={i} style={{ height: 0 }} />;
        }}
      </Virtualizer>
    </ScrollViewer>
  );
};
