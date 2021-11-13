import * as React from "react";
import { CSSProperties, useEffect } from "react";
import { useRef } from "react";
import { useState } from "react";
import { ScrollbarApi, FloatingScrollbar } from "./FloatingScrollbar";
import { handleScrollKeys } from "./component-utils";
import { useLayoutEffect } from "react";
import { useResizeObserver } from "./useResizeObserver";

// --- Signs the end of the list
const END_LIST_POSITION = 10_000_000;

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
  style?: CSSProperties;
  renderItem: ItemRenderer;
  registerApi?: (api: VirtualizedListApi) => void;
  obtainInitPos?: () => number | null;
  scrolled?: (topPos: number) => void;
  onFocus?: () => void;
  onBlur?: () => void;
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
  focus: () => void;
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
  style,
  renderItem,
  registerApi,
  obtainInitPos,
  scrolled,
  onFocus: focus,
  onBlur: blur,
  signPointed,
  handleKeys,
}: VirtualizedListProps) {
  // --- Status flags for the initialization cycle
  const mounted = useRef(false);

  // --- Store the API to control the vertical scrollbar
  const verticalApi = useRef<ScrollbarApi>();
  const horizontalApi = useRef<ScrollbarApi>();

  // --- Store last viewport information
  const lastStartIndex = useRef(-1);
  const lastEndIndex = useRef(-1);
  const scrollPosition = useRef(0);

  // --- Component state
  const [items, setItems] = useState<React.ReactNode[]>();
  const [pointed, setPointed] = useState(false);
  const [resizePhase, setResizePhase] = useState<ResizePhase>(ResizePhase.None);
  const [resizedHeight, setResizedHeight] = useState<number>();
  const [requestedPos, setRequestedPos] = useState(-1);
  const [requestedIndex, setRequestedIndex] = useState(-1);
  const [requestFocus, setRequestFocus] = useState(false);

  // --- Component host element
  const divHost = useRef<HTMLDivElement>();

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

    const { startIndex, endIndex } = getViewPort();
    lastStartIndex.current = startIndex;
    lastEndIndex.current = endIndex;
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
        focus: () => setRequestFocus(true),
      });
      updateDimensions();
      const initPosition = obtainInitPos?.();
      if (initPosition !== null && initPosition !== undefined) {
        setRequestedPos(initPosition < 0 ? END_LIST_POSITION : initPosition);
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
          divHost.current.scrollTop = normalizeScrollPosition(requestedPos);
          scrollPosition.current = divHost.current.scrollTop;
          scrolled?.(scrollPosition.current);
          setRequestedPos(-1);
        } else if (requestedIndex >= 0) {
          scrollPosition.current = divHost.current.scrollTop;
          const startIndex = Math.floor(scrollPosition.current / itemHeight);
          const endIndex = Math.min(
            numItems - 1,
            Math.floor((scrollPosition.current + resizedHeight) / itemHeight)
          );
          if (requestedIndex <= startIndex) {
            divHost.current.scrollTop = normalizeScrollPosition(
              requestedIndex * itemHeight
            );
            scrollPosition.current = divHost.current.scrollTop;
            scrolled?.(scrollPosition.current);
            setRequestedIndex(-1);
          } else if (requestedIndex >= endIndex) {
            divHost.current.scrollTop = normalizeScrollPosition(
              (requestedIndex + 2) * itemHeight - resizedHeight + 1
            );
            scrollPosition.current = divHost.current.scrollTop;
            scrolled?.(scrollPosition.current);
            setRequestedIndex(-1);
          }
        }
        updateDimensions();
        renderItems();
        setResizePhase(ResizePhase.Rendered);
        if (requestFocus) {
          divHost.current.focus();
          setRequestFocus(false);
        }
        break;
      case ResizePhase.Rendered:
        if (requestedPos >= 0) {
          divHost.current.scrollTop = normalizeScrollPosition(requestedPos);
          scrollPosition.current = divHost.current.scrollTop;
          scrolled?.(scrollPosition.current);
          setRequestedPos(-1);
        }
        break;
    }
  });

  // --- Handle resizing
  const _onResize = () => {
    if (resizePhase === ResizePhase.None) return;
    forceRefresh();
  };

  useResizeObserver({
    callback: _onResize,
    element: divHost,
  });

  return (
    <>
      <div
        tabIndex={focusable ? 0 : -1}
        ref={divHost}
        className="scroll"
        style={{
          ...style,
          overflow: "hidden",
          position: "relative",
          height: resizedHeight ?? 100_000,
          outline: "none",
        }}
        onScroll={(e) => {
          updateDimensions();
          renderItems();
          scrollPosition.current = divHost.current.scrollTop;
          scrolled?.(divHost.current.scrollTop);
        }}
        onWheel={(e) =>
          setRequestedPos(
            Math.max(0, scrollPosition.current + (e.deltaY / 4) * itemHeight)
          )
        }
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
          setRequestedPos(delta);
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
          setRequestedPos(delta);
        }}
        sizing={(nowSizing) => {
          isSizing = nowSizing;
          if (!nowSizing && mouseLeft) {
            setPointed(false);
            signPointed?.(false);
          }
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
    const reqPos =
      position < 0
        ? END_LIST_POSITION
        : position ?? (divHost.current ? divHost.current.scrollTop : -1);
    setRequestedPos(reqPos);
    setResizedHeight(null);
    setResizePhase(ResizePhase.None);
  }

  /**
   * Scrolls to the item with the specified index
   * @param index
   */
  function scrollToItemByIndex(index: number, withRefresh = false) {
    setRequestedPos(index * itemHeight);
    if (withRefresh) {
      setResizedHeight(null);
      setResizePhase(ResizePhase.None);
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
      setResizedHeight(null);
      setResizePhase(ResizePhase.None);
    }
  }

  /**
   * Scrolls to the end of the list
   * @param index
   */
  function scrollToEnd(withRefresh = false) {
    setRequestedPos(END_LIST_POSITION);
    if (withRefresh) {
      setResizedHeight(null);
      setResizePhase(ResizePhase.None);
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
      return {
        startIndex: lastStartIndex.current,
        endIndex: lastEndIndex.current,
      };
    }
    const result = {
      startIndex: Math.floor(divHost.current.scrollTop / itemHeight),
      endIndex: Math.min(
        numItems - 1, // don't render past the end of the list
        Math.floor((divHost.current.scrollTop + resizedHeight) / itemHeight)
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
    return Math.max(
      0,
      integralPosition
        ? Math.floor(newPosition / itemHeight) * itemHeight
        : newPosition
    );
  }
}
