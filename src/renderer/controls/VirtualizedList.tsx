import { CSSProperties, forwardRef, ReactNode, useEffect, useRef } from "react";
import { Virtualizer, VListHandle } from "virtua";
import ScrollViewer from "./ScrollViewer";

type VirtualItemProps = {
  children: ReactNode;
  index: number;
  style: CSSProperties;
};

type Props<T> = {
  items?: readonly T[] | null;
  itemSize?: number;
  overscan?: number;
  revealUnmeasuredItems?: boolean;
  startIndex?: number; // Initial scroll position
  renderItem?: (index: number, item: T) => ReactNode;
  apiLoaded?: (api: VListHandle) => void;
  onScroll?: (offset: number) => void;
  onScrollEnd?: () => void;
};

const RevealedVirtualItem = forwardRef<HTMLDivElement, VirtualItemProps>(
  ({ children, style }, ref) => (
    <div ref={ref} style={{ ...style, visibility: "visible" }}>
      {children}
    </div>
  )
);

RevealedVirtualItem.displayName = "RevealedVirtualItem";

export const VirtualizedList = <T,>({
  items,
  itemSize,
  overscan,
  revealUnmeasuredItems,
  startIndex,
  renderItem,
  apiLoaded,
  onScroll,
  onScrollEnd
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
        data={safeItems}
        itemSize={itemSize}
        item={revealUnmeasuredItems ? RevealedVirtualItem : undefined}
        bufferSize={overscan}
        onScroll={(offset) => onScroll?.(offset)}
        onScrollEnd={onScrollEnd}
      >
        {(item, i) => {
          const rendered = renderItem?.(i, item);
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
