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
  /**
   * Let a row wider than the viewport scroll horizontally instead of being clipped.
   *
   * **Why this is not the default.** `virtua` wraps every row in an *absolutely positioned* div and
   * gives it an explicit width equal to the viewport, so a row whose content is wider simply
   * overflows a box that never grows — measured in the running IDE as a 441px row inside a 392px
   * wrapper, with the scroll container still reporting `scrollWidth === clientWidth`, so
   * OverlayScrollbars marked its horizontal bar `os-scrollbar-unusable` and there was nothing to
   * scroll. Only the wrapper's own *border box* propagates out to the scroll container, which is why
   * widening the row alone is not enough.
   *
   * Opt-in per list rather than applied to all fifteen: `max-content` changes how a row that
   * contains a `width: 100%` or flex-grow child measures, and the lists that fit their viewport
   * today should keep measuring exactly as they do.
   */
  scrollRowsHorizontally?: boolean;
  renderItem?: (index: number, item: T) => ReactNode;
  apiLoaded?: (api: VListHandle) => void;
  onScroll?: (offset: number) => void;
  onScrollEnd?: () => void;
};

/** The row wrapper `virtua` renders. `style` is virtua's own positioning and must be spread first. */
const makeVirtualItem = (reveal: boolean, sizeToContent: boolean) => {
  const VirtualItem = forwardRef<HTMLDivElement, VirtualItemProps>(({ children, style }, ref) => (
    <div
      ref={ref}
      style={{
        ...style,
        ...(reveal ? { visibility: "visible" as const } : null),
        ...(sizeToContent ? { minWidth: "max-content" as const } : null)
      }}
    >
      {children}
    </div>
  ));
  VirtualItem.displayName = "VirtualItem";
  return VirtualItem;
};

const RevealedVirtualItem = makeVirtualItem(true, false);
const HorizontalVirtualItem = makeVirtualItem(false, true);
const RevealedHorizontalVirtualItem = makeVirtualItem(true, true);

/**
 * How many rows to keep mounted beyond the viewport.
 *
 * Four of the fifteen call sites passed `overscan={25}` and eleven passed nothing, which meant two
 * lists sitting side by side in the same panel buffered differently for no stated reason. The value
 * the explicit sites chose becomes the default, so the eleven silent ones get the same behaviour
 * and the four stop repeating it. A list with a genuine reason to differ still can.
 */
const DEFAULT_OVERSCAN = 25;

export const VirtualizedList = <T,>({
  items,
  itemSize,
  overscan = DEFAULT_OVERSCAN,
  revealUnmeasuredItems,
  startIndex,
  scrollRowsHorizontally,
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
        item={
          revealUnmeasuredItems
            ? scrollRowsHorizontally
              ? RevealedHorizontalVirtualItem
              : RevealedVirtualItem
            : scrollRowsHorizontally
              ? HorizontalVirtualItem
              : undefined
        }
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
