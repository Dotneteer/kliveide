import { useEffect, useRef, useState } from "react";
import { Virtualizer, VListHandle } from "virtua";
import ScrollViewer from "./ScrollViewer";

type Props = {
  items: any[];
  overscan?: number;
  renderItem?: (index: number) => React.ReactNode;
  apiLoaded?: (api: VListHandle) => void;
  onScroll?: (offset: number) => void;
};

export const VirtualizedList = ({ items, overscan, renderItem, apiLoaded, onScroll }: Props) => {
  const ref = useRef<VListHandle>(null);
  const [itemsCount, setItemsCount] = useState(items?.length ?? 0);

  // --- Notify the parent that the API is ready
  useEffect(() => {
    if (ref.current) {
      apiLoaded?.(ref.current);
    }
  }, [ref.current]);

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
