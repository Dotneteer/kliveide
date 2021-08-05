import * as React from "react";
import { CSSProperties, useEffect } from "react";
import { useRef } from "react";
import { useState } from "react";
import FloatingScrollbar, { ScrollbarApi } from "./FloatingScrollbar";
import { handleScrollKeys } from "./utils";
import ReactResizeDetector from "react-resize-detector";
import { useLayoutEffect } from "react";

/**
 * The function that renders a virtual list item
 */
type ItemRenderer = (
  index: number,
  style: CSSProperties,
  startIndex: number,
  endIndex: number
) => JSX.Element;

/**
 * The properties of the virtual list
 */
export type VirtualizedListProps = {
  numItems: number;
  itemHeight: number;
  focusable?: boolean;
  integralPosition?: boolean;
  renderItem: ItemRenderer;
  registerApi?: (api: VirtualizedListApi) => void;
  obtainInitPos?: () => number | null;
  scrolled?: (topPos: number) => void;
  focus?: () => void;
  blur?: () => void;
  signPointed?: (use: boolean) => void;
  handleKeys?: (e: React.KeyboardEvent) => void;
};

/**
 * Represents the API the hosts of a virtual list can invoke
 */
export type VirtualizedListApi = {
  forceRefresh: (position?: number) => void;
  scrollToItemByIndex: (index: number, withRefresh?: boolean) => void;
  scrollToTop: (withRefresh?: boolean) => void;
  scrollToEnd: (withRefresh?: boolean) => void;
  getViewPort: () => { startIndex: number; endIndex: number };
  ensureVisible: (index: number) => void;
};

// --- Resizing phases
enum ResizePhase {
  None,
  Resized,
  Rendered,
}

/**
 * This function represents a virtual list
 */
export default function VirtualizedList({
  numItems,
  itemHeight = 20,
  focusable = true,
  integralPosition = true,
  renderItem,
  registerApi,
  obtainInitPos,
  scrolled,
  focus,
  blur,
  signPointed,
  handleKeys,
}: VirtualizedListProps) {
  // --- Status flags for the initialization cycle
  const mounted = useRef(false);

  // --- Store the API to control the vertical scrollbar
  const verticalApi = useRef<ScrollbarApi>();
  const horizontalApi = useRef<ScrollbarApi>();

  // --- Component state
  const [items, setItems] = useState<React.ReactNode[]>();
  const [pointed, setPointed] = useState(false);
  const [resizePhase, setResizePhase] = useState<ResizePhase>(ResizePhase.None);
  const [resizedHeight, setResizedHeight] = useState<number>();
  const [requestedPos, setRequestedPos] = useState(-1);
  const [requestedIndex, setRequestedIndex] = useState(-1);

  // --- Component host element
  const divHost = React.createRef<HTMLDivElement>();

  // --- Handle integer height
  if (integralPosition) {
    itemHeight = Math.round(itemHeight);
  }

  // --- Init internal variables
  let mouseLeft = false;
  let isSizing = false;
  const innerHeight = numItems * itemHeight;

  // --- Render the items according to the top position
  const renderItems = () => {
    if (resizePhase === ResizePhase.None) {
      return;
    }

    const scrollPos = divHost.current.scrollTop;
    const { startIndex, endIndex } = getViewPort();
    const tmpItems: React.ReactNode[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      const item = renderItem(
        i,
        {
          position: "absolute",
          top: `${i * itemHeight}px`,
          width: "fit-content",
          overflowX: "hidden",
          whiteSpace: "nowrap",
        },
        startIndex,
        endIndex
      );
      tmpItems.push(item);
    }
    setItems(tmpItems);
    if (divHost?.current) {
      divHost.current.scrollTop = scrollPos;
    }
  };

  // --- Initialize/update the virtualized list
  useEffect(() => {
    if (mounted.current) {
      updateDimensions();
    } else {
      // --- Initialize the component
      registerApi?.({
        forceRefresh: (position?: number) => forceRefresh(position),
        scrollToItemByIndex: (index, withRefresh) =>
          scrollToItemByIndex(index, withRefresh),
        scrollToTop: (withRefresh) => scrollToTop(withRefresh),
        scrollToEnd: (withRefresh) => scrollToEnd(withRefresh),
        getViewPort: () => getViewPort(),
        ensureVisible: (index: number) => ensureVisible(index),
      });
      updateDimensions();
      const initPosition = obtainInitPos?.();
      if (initPosition !== null && initPosition !== undefined) {
        setRequestedPos(initPosition < 0 ? 10_000_000 : initPosition);
      }
      mounted.current = true;
    }
  });

  // --- Whenever it's time to resize, save the offset height of
  // --- the scroll panel to eliminate a flex bug.
  useLayoutEffect(() => {
    if (!mounted.current) return;
    switch (resizePhase) {
      case ResizePhase.None:
        setResizedHeight(divHost.current.offsetHeight - 1);
        setResizePhase(ResizePhase.Resized);
        break;
      case ResizePhase.Resized:
        if (requestedPos >= 0) {
          divHost.current.scrollTop = requestedPos;
          scrolled?.(divHost.current.scrollTop);
          setRequestedPos(-1);
        } else if (requestedIndex >= 0) {
          const scrollPos = divHost.current.scrollTop;
          const startIndex = Math.floor(scrollPos / itemHeight);
          const endIndex = Math.min(
            numItems - 1,
            Math.floor((scrollPos + resizedHeight) / itemHeight)
          );
          if (requestedIndex <= startIndex) {
            divHost.current.scrollTop = requestedIndex * itemHeight;
            scrolled?.(divHost.current.scrollTop);
            setRequestedIndex(-1);
          } else if (requestedIndex >= endIndex) {
            divHost.current.scrollTop = (requestedIndex + 1) * itemHeight - resizedHeight + 1
            scrolled?.(divHost.current.scrollTop);
            setRequestedIndex(-1);
          }
        }
        updateDimensions();
        renderItems();
        setResizePhase(ResizePhase.Rendered);
        break;
    }
  });

  return (
    <>
      <div
        tabIndex={focusable ? 0 : -1}
        ref={divHost}
        className="scroll"
        style={{
          overflow: "hidden",
          position: "relative",
          height: resizedHeight ?? "100%",
          outline: "none",
        }}
        onScroll={(e) => {
          updateDimensions();
          renderItems();
          scrolled?.(divHost.current.scrollTop);
        }}
        onWheel={(e) => {
          divHost.current.scrollTop = normalizeScrollPosition(
            divHost.current.scrollTop + e.deltaY / 4
          );
        }}
        onKeyDown={(e) => {
          if (handleKeys) {
            handleKeys(e);
          } else {
            handleScrollKeys(
              divHost.current,
              e.key,
              e.ctrlKey,
              itemHeight,
              integralPosition
            );
          }
        }}
        onFocus={() => focus?.()}
        onBlur={() => blur?.()}
      >
        <div
          className="inner"
          style={{
            height: `${innerHeight}px`,
          }}
          onMouseEnter={() => {
            setPointed(true);
            signPointed?.(true);
            mouseLeft = false;
          }}
          onMouseLeave={() => {
            setPointed(isSizing);
            signPointed?.(isSizing);
            mouseLeft = true;
          }}
        >
          {items}
        </div>
      </div>
      <FloatingScrollbar
        direction="vertical"
        barSize={10}
        forceShow={pointed}
        registerApi={(api) => (verticalApi.current = api)}
        moved={(delta) => {
          if (divHost?.current) {
            divHost.current.scrollTop = normalizeScrollPosition(delta);
          }
        }}
        sizing={(nowSizing) => {
          isSizing = nowSizing;
          if (!nowSizing && mouseLeft) {
            setPointed(false);
            signPointed?.(false);
          }
        }}
      />
      <FloatingScrollbar
        direction="horizontal"
        barSize={10}
        forceShow={pointed}
        registerApi={(api) => (horizontalApi.current = api)}
        moved={(delta) => {
          if (divHost?.current) {
            divHost.current.scrollLeft = delta;
          }
        }}
        sizing={(nowSizing) => {
          isSizing = nowSizing;
          if (!nowSizing && mouseLeft) {
            setPointed(false);
            signPointed?.(false);
          }
        }}
      />
      <ReactResizeDetector
        handleWidth
        handleHeight
        onResize={() => {
          if (resizePhase === ResizePhase.None) return;
          forceRefresh();
        }}
      />
    </>
  );

  // --------------------------------------------------------------------------
  // Virtualized list API

  /**
   * Asks the component to update its viewport
   */
  function forceRefresh(position?: number) {
    setResizePhase(ResizePhase.None);
    const reqPos =
      position < 0
        ? 10_000_000
        : position ?? (divHost.current ? divHost.current.scrollTop : -1);
    setRequestedPos(reqPos);
    setResizedHeight(null);
  }

  /**
   * Scrolls to the item with the specified index
   * @param index
   */
  function scrollToItemByIndex(index: number, withRefresh = false) {
    const topPos = normalizeScrollPosition(index * itemHeight);
    setRequestedPos(normalizeScrollPosition(topPos));
    if (withRefresh) {
      setResizePhase(ResizePhase.None);
      setResizedHeight(null);
    }
  }

  /**
   * Scrolls to the top of the list
   * @param index
   */
  function scrollToTop(withRefresh = false) {
    setRequestedPos(0);
    setResizePhase(ResizePhase.Resized);
    if (withRefresh) {
      setResizePhase(ResizePhase.None);
      setResizedHeight(null);
    }
  }

  /**
   * Scrolls to the end of the list
   * @param index
   */
  function scrollToEnd(withRefresh = false) {
    setRequestedPos(10_000_000);
    if (withRefresh) {
      setResizePhase(ResizePhase.None);
      setResizedHeight(null);
    } else {
      setResizePhase(ResizePhase.Resized);
    }
  }

  /**
   * Gets the top and bottom item index of the virtual list's viewport
   * @returns
   */
  function getViewPort(): { startIndex: number; endIndex: number } {
    if (!divHost.current) {
      return { startIndex: -1, endIndex: -1 };
    }
    const scrollPos = divHost.current.scrollTop;
    const result = {
      startIndex: Math.floor(scrollPos / itemHeight),
      endIndex: Math.min(
        numItems - 1, // don't render past the end of the list
        Math.floor((scrollPos + resizedHeight) / itemHeight)
      ),
    };
    return result;
  }

  /**
   * Ensures that the item with the specified index is visible
   * @param index Index to show
   */
  function ensureVisible(index: number): void {
    setRequestedIndex(index);
    setResizePhase(ResizePhase.Resized);
  }

  // --------------------------------------------------------------------------
  // Helper functions
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
    horizontalApi.current?.signHostDimension({
      hostLeft: divHost.current.offsetLeft,
      hostTop: divHost.current.offsetTop,
      hostSize: divHost.current.offsetWidth,
      hostCrossSize: divHost.current.offsetHeight,
      hostScrollPos: divHost.current.scrollLeft,
      hostScrollSize: divHost.current.scrollWidth,
    });
  }

  /**
   * Calculates normalized scrollposition
   * @param newPosition
   */
  function normalizeScrollPosition(newPosition: number): number {
    return integralPosition
      ? Math.floor(newPosition / itemHeight) * itemHeight
      : newPosition;
  }
}
