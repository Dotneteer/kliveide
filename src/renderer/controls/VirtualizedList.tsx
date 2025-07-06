import { useCallback, useEffect, useRef, useState } from "react";
import { Virtualizer, VListHandle } from "virtua";
import ScrollViewer from "./ScrollViewer";
import React from "react";

// Generic type for the list items
type Props<T> = {
  items: T[];
  overscan?: number;
  renderItem?: (index: number) => React.ReactNode;
  apiLoaded?: (api: VListHandle) => void;
  onScroll?: (offset: number) => void;
};

export const VirtualizedList = <T,>({ 
  items, 
  overscan, 
  renderItem, 
  apiLoaded, 
  onScroll 
}: Props<T>) => {
  const ref = useRef<VListHandle>(null);
  const [itemsCount, setItemsCount] = useState(items?.length ?? 0);

  // --- Notify the parent that the API is ready
  useEffect(() => {
    if (ref.current) {
      apiLoaded?.(ref.current);
    }
  }, [apiLoaded, ref]);

  useEffect(() => {
    setItemsCount(items?.length ?? 0);
  }, [items]);

  // Memoize the onScroll handler
  const handleScroll = useCallback((offset: number) => {
    onScroll?.(offset);
  }, [onScroll]);

  // Return to the original pattern but with memoization
  const renderVirtualItem = useCallback((i: number) => {
    return (
      <>
        {renderItem ? renderItem(i) : <div key={`empty-${i}`} style={{ height: 0 }} />}
      </>
    );
  }, [renderItem]);

  return (
    <ScrollViewer>
      <Virtualizer
        ref={ref}
        overscan={overscan}
        onScroll={handleScroll}
        count={itemsCount}
      >
        {(i) => {
          // Use the memoized function but inline
          return renderVirtualItem(i);
        }}
      </Virtualizer>
    </ScrollViewer>
  );
};
