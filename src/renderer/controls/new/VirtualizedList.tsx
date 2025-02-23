import { useEffect, useRef } from "react";
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

  // --- Notify the parent that the API is ready
  useEffect(() => {
    if (ref.current) {
      apiLoaded?.(ref.current);
    }
  }, [ref.current]);

  return (
    <ScrollViewer>
      <Virtualizer ref={ref} overscan={overscan} onScroll={(offset) => onScroll?.(offset)}>
        {Array.from({ length: items.length }, (_, index) => renderItem?.(index))}
      </Virtualizer>
    </ScrollViewer>
  );
};
