/* eslint-disable react-hooks/exhaustive-deps */
import * as React from "react";
import {
  CSSProperties,
  PropsWithChildren,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { FloatingScrollbar, ScrollbarApi } from "./FloatingScrollbar";
import { useResizeObserver } from "./useResizeObserver";

const MAX_LIST_PIXELS = 10_000_000;
const CALC_BATCH_SIZE = 1000;

/**
 * The function that renders a virtual list item
 */
export type ItemRenderer = (index: number, style: CSSProperties) => JSX.Element;

/**
 * Desired position when displaying an item
 */
export type ItemTargetLocation = "top" | "bottom" | "center";

/**
 * Represents the API the hosts of a virtual list can invoke
 */
export type VirtualizedListApi = {
  /**
   * Forces refreshing the list
   */
  forceRefresh: (position?: number) => void;

  /**
   * Scrolls to the item with the specified index
   */
  scrollToItemByIndex: (index: number, withRefresh?: boolean) => void;

  /**
   * Scrolls to the top
   */
  scrollToTop: (withRefresh?: boolean) => void;

  /**
   * Scrolls to the bottom
   */
  scrollToBottom: (withRefresh?: boolean) => void;

  /**
   * Retrieves the current viewport of the virtual list
   */
  getViewPort: () => Viewport;

  /**
   * Ensures that the item with the specified index gets visible
   * in the current viewport
   */
  ensureVisible: (index: number, location: ItemTargetLocation) => void;

  /**
   * Ensures that the virtualized list gets the focus
   */
  focus: () => void;

  /**
   * Initiates remeasuring the specified range of items
   */
  remeasure: (start: number, end: number) => void;
};

/**
 * The item height mode of the virtualized list
 * "fix": Use the itemHeight property to set the initial size of items
 * "first": All items should have the height of the first item
 * "variable": Calculate the heights of all items
 */
export type ItemHeightMode = "fix" | "first" | "variable";

/**
 * The properties of the virtualized list
 */
export type VirtualizedListProps = {
  /**
   * The number of items in the list
   */
  itemsCount: number;

  /**
   * Item height mode ("fixed" | "dynamic")
   */
  heightMode?: ItemHeightMode;

  /**
   * Item heights (used only in "fixed" mode)
   */
  itemHeight?: number;

  /**
   * Is the virtualized list focusable?
   */
  focusable?: boolean;

  /**
   * Extra style information to tadd to the list
   */
  style?: CSSProperties;

  /**
   * The number of calculation queue items processed within
   * an animation frame
   */
  calcBatchSize?: number;

  /**
   * Indicatea that scrollbars should be displayed
   */
  showScrollbars?: boolean;

  /**
   * Defers position refreshing while all items are re-measured
   */
  deferPositionRefresh?: boolean;

  /**
   * Indicates that item size should be remeasured when the horizontal
   * size of the list container changes
   */
  horizontalRemeasure?: boolean;

  /**
   * Number of milliseconds to wait while horizontal sizing settles
   */
  horizontalSettleTime?: number;

  /**
   * Keep the index position and set it back after re-measure
   */
  reposition?: boolean;

  /**
   * Scrolling speed when using the mouse wheel
   */
  wheelSpeed?: number;

  /**
   * The function that renders a particular item
   */
  renderItem: ItemRenderer;

  /**
   * Function to register the API of the virtualized list
   */
  registerApi?: (api: VirtualizedListApi) => void;

  /**
   * Function to defin the initial scroll position
   */
  obtainInitPos?: () => number | null;

  /**
   * Function called when the list's scroll position has been changed
   */
  onScrolled?: (topPos: number) => void;

  /**
   * Function called when the list receives the focus
   */
  onFocus?: () => void;

  /**
   * Function called when the list losts the focus
   */
  onBlur?: () => void;

  /**
   * Function called when the list's viewport changes
   */
  onViewPortChanged?: (startIndex: number, endIndex: number) => void;

  /**
   * Function called when the container's size changes
   */
  onResized?: (width: number, height: number) => void;

  /**
   * The host can take control of handling the keys
   */
  handleKeys?: (e: React.KeyboardEvent) => void;
};

/**
 * Implements a vertically scrollable virtualized list
 */
export const VirtualizedList: React.FC<VirtualizedListProps> = ({
  itemsCount,
  heightMode,
  itemHeight = 20,
  focusable,
  style,
  calcBatchSize = CALC_BATCH_SIZE,
  showScrollbars = false,
  deferPositionRefresh = true,
  horizontalRemeasure = false,
  horizontalSettleTime = 100,
  reposition = false,
  wheelSpeed = 1.0,
  renderItem,
  registerApi,
  obtainInitPos,
  onScrolled,
  onFocus,
  onBlur,
  onViewPortChanged,
  onResized,
  handleKeys,
}: PropsWithChildren<VirtualizedListProps>) => {
  // --- Explicit state
  const [totalHeight, setTotalHeight] = useState(0);
  const [requestedPos, setRequestedPos] = useState(-1);
  const [requestedHorPos, setRequestedHorPos] = useState(-1);
  const [elementsToMeasure, setElementsToSize] =
    useState<Map<number, JSX.Element>>();
  const [visibleElements, setVisibleElements] = useState<VisibleItem[]>();
  const [remeasureTrigger, setRemeasureTrigger] = useState(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // --- Intrinsic state
  const mounted = useRef(false);
  const heights = useRef<HeightInfo[]>([]);
  const firstElementIndex = useRef(-1);
  const calculationQueue = useRef<number[]>([]);
  const cancelCalculation = useRef(false);
  const batchQueue = useRef<Viewport[]>();
  const scrollPosition = useRef(0);
  const lastViewport = useRef<Viewport>({
    startIndex: -1,
    endIndex: -1,
  });
  const measuring = useRef(false);
  const lastContainerWidth = useRef(-1);
  const settleCounter = useRef(0);
  const positionToIndex = useRef(-1);
  const forceRenderingVisible = useRef(false);

  // --- Other references
  const componentHost = useRef<HTMLDivElement>();
  const verticalApi = useRef<ScrollbarApi>();
  const horizontalApi = useRef<ScrollbarApi>();
  const sizerHost = useRef<HTMLDivElement>();

  // --------------------------------------------------------------------------
  // Mount and unmount the component

  useEffect(() => {
    if (!mounted.current) {
      // --- Mount the component
      mounted.current = true;
      cancelCalculation.current = false;

      // --- Register the API with the host component
      registerApi?.({
        forceRefresh: (position?: number) => forceRefresh(position),
        scrollToItemByIndex: (index) => scrollToItemByIndex(index),
        scrollToTop: () => scrollToTop(),
        scrollToBottom: () => scrollToBottom(),
        getViewPort: () => getViewPort(),
        ensureVisible: (index, location) => ensureVisible(index, location),
        focus: () => () => focus(),
        remeasure: (start, end) => remeasure(start, end),
      });
    }

    return () => {
      // --- Cancel any item length calculation in progress
      cancelCalculation.current = true;

      // --- Unmount completed
      mounted.current = false;
    };
  });

  // --------------------------------------------------------------------------
  // Whenever the number of items changes, initialize item heights

  useLayoutEffect(() => {
    // --- Sets up the initial heights
    setInitialHeights();
    measuring.current = heightMode === "variable" || heightMode === "first";

    if (!measuring.current) {
      // --- Notify the host about the viewport change
      const vp = getViewPort();
      onViewPortChanged?.(vp.startIndex, vp.endIndex);
    }

    // --- Navigate to the specified initial position
    const initPosition = obtainInitPos?.();
    if (initPosition !== null && initPosition !== undefined) {
      setRequestedPos(initPosition < 0 ? MAX_LIST_PIXELS : initPosition);
    }

    // --- Process the first batch of elements to measure their size
    processHeightMeasureBatchAfterTick();
    setVisibleElements([]);
  }, [itemsCount]);

  // --------------------------------------------------------------------------
  // Whenever elements are rendered for measure, process them
  useLayoutEffect(() => {
    applyMeasuredItemDimensions();

    // --- Is there a next batch?
    if (calculationQueue.current.length > 0) {
      // --- Process the nex batch of elements
      processHeightMeasureBatch();
    } else {
      // --- No more elements to measure
      setElementsToSize(undefined);

      // --- We're not measuring anymore
      measuring.current = false;

      // --- Let's reposition, if asked so
      if (positionToIndex.current >= 0) {
        scrollToItemByIndex(positionToIndex.current);
      }
    }
  }, [elementsToMeasure]);

  // --------------------------------------------------------------------------
  // Whenever the set of visible elements changes, render them
  useLayoutEffect(() => {
    renderVisibleElements();
  }, [visibleElements]);

  // --------------------------------------------------------------------------
  // Whenever there is a new batch to remeasure, initiate
  useLayoutEffect(() => {
    if (remeasureTrigger) {
      processHeightMeasureBatch();
    }
  }, [remeasureTrigger]);

  // --------------------------------------------------------------------------
  // Change the requested position
  useLayoutEffect(() => {
    updateRequestedPosition();
  }, [requestedPos, requestedHorPos]);

  // --------------------------------------------------------------------------
  // Update the UI
  useLayoutEffect(() => {
    updateScrollbarDimensions();
    renderVisibleElements(forceRenderingVisible.current);
    forceRenderingVisible.current = false;
  });

  // --------------------------------------------------------------------------
  // Respond to the resizing of the host component
  useResizeObserver(componentHost, async () => {
    if (!componentHost.current) {
      // --- We may removed the component host element
      return;
    }

    const width = componentHost.current.offsetWidth;

    // --- Check if we need to remeasure items
    if (
      lastContainerWidth.current >= 0 &&
      lastContainerWidth.current !== width &&
      horizontalRemeasure
    ) {
      // --- Let's wait while horizontal position settles down
      settleCounter.current++;
      await new Promise((r) => setTimeout(r, horizontalSettleTime));
      if (settleCounter.current === 1) {
        // --- Let's keep the top item's position, if required so
        if (reposition) {
          positionToIndex.current = getViewPort().startIndex;
        }

        // --- Let's remeasure the items because of changed horizontal size
        setInitialHeights();
        requestAnimationFrame(() => {
          // --- Process the first batch of elements to measure their size
          processHeightMeasureBatch();
        });
      }
      settleCounter.current--;
    }
    lastContainerWidth.current = width;

    // --- Update the UI according to changes
    updateScrollbarDimensions();
    updateRequestedPosition();
    renderVisibleElements();
    onResized?.(width, componentHost.current.offsetHeight);
  });

  return (
    <>
      {
        // --- The container for the viewport of the virtualized list
      }
      <div
        tabIndex={focusable ? 0 : -1}
        ref={componentHost}
        style={{
          ...style,
          overflow: "hidden",
          position: "relative",
          height: "100%",
          outline: "none",
        }}
        onMouseEnter={() => displayScrollbars(true)}
        onMouseLeave={() => displayScrollbars(false)}
        onWheel={(e) =>
          setRequestedPos(
            Math.max(
              0,
              scrollPosition.current +
                ((wheelSpeed * e.deltaY) / 20) * itemHeight
            )
          )
        }
        onKeyDown={(e) => {
          if (handleKeys) {
            handleKeys(e);
          } else {
            const newPos = calculateScrollPositionByKey(
              componentHost.current,
              e.key,
              e.shiftKey,
              itemHeight,
              true
            );
            setRequestedPos(newPos);
          }
        }}
        onFocus={() => onFocus?.()}
        onBlur={() => onBlur?.()}
      >
        {
          // --- The inner panel fully sized to the entire virtual list
        }
        <div
          className="inner"
          style={{ height: `${totalHeight}px` }}
        >
          {
            // --- Whenever we have any, render the visible elements
          }
          {visibleElements &&
            visibleElements.map((ve) => (
              <React.Fragment key={ve.index}>{ve.item}</React.Fragment>
            ))}

          {
            // --- This element is a container we push far to the bottom of the
            // --- virtual list. We render the items within this container
            // --- temporarily so that we can measure their heights.
          }
          <div
            ref={sizerHost}
            style={{
              display: "block",
              position: "absolute",
              width: "100%",
              top: MAX_LIST_PIXELS,
            }}
          >
            {
              // --- The container for the viewport of the virtualized list
            }
            {elementsToMeasure &&
              Array.from(elementsToMeasure.entries()).map((item) => (
                <React.Fragment key={item[0]}>{item[1]}</React.Fragment>
              ))}
          </div>
        </div>
      </div>
      {
        // --- Vertical scrollbar
      }
      <FloatingScrollbar
        direction="vertical"
        barSize={16}
        registerApi={(api) => (verticalApi.current = api)}
        moved={(delta) => setRequestedPos(delta)}
        forceShow={showScrollbars}
      />
      {
        // --- Horizontal scrollbar
      }
      <FloatingScrollbar
        direction="horizontal"
        barSize={10}
        registerApi={(api) => (horizontalApi.current = api)}
        moved={(delta) => setRequestedHorPos(delta)}
        forceShow={showScrollbars}
      />
    </>
  );

  // --------------------------------------------------------------------------
  // Helper functions

  /**
   * Sets the initial heights of items after mounting the component
   */
  function setInitialHeights(): void {
    const initial: HeightInfo[] = [];
    initial.length = itemsCount;

    // --- We put dynamic items into a calculation queue so that later we can
    // --- measure their dimensions
    const calcQueue: number[] = [];

    // --- Start from the top, and iterate through the items
    let top = 0;
    if (heightMode === "first") {
      calcQueue[0] = 0;
    }
    for (let i = 0; i < itemsCount; i++) {
      initial[i] = {
        top,
        height: itemHeight,
      };
      top += itemHeight;

      // --- Put the dynamic item into the calculation queue
      if (heightMode === "variable") {
        calcQueue[i] = i;
      }

      // --- Do not allow arbitrarily long lists
      if (top > MAX_LIST_PIXELS) {
        throw new Error(
          `The total height of the virtualized list cannot be greater than ${MAX_LIST_PIXELS}. ` +
            `Now, the list has ${itemsCount} items and item #${i} violates the maximum total height.`
        );
      }
    }

    // --- Prepare calculations
    calculationQueue.current = calcQueue;
    batchQueue.current = [];

    // --- Done.
    heights.current = initial;
    setTotalHeight(top);
  }

  /**
   * Processes the calculation queue
   */
  function processHeightMeasureBatch(): void {
    const queue = calculationQueue.current;
    if (queue.length === 0) {
      // --- Nothing to calculate. Are the prepared remeasure batches?
      if (batchQueue.current.length > 0) {
        // --- Yes, push the next batch to the queue
        const nextBatch = batchQueue.current.shift();
        for (let i = nextBatch.startIndex; i <= nextBatch.endIndex; i++) {
          queue.push(i);
        }
      } else {
        // --- No more items to measure
        return;
      }
    }
    const batchItems = Math.min(queue.length, calcBatchSize);

    const newElementsToSize = new Map<number, JSX.Element>();
    let firstIndex = -1;
    for (let i = 0; i < batchItems; i++) {
      if (cancelCalculation.current) {
        // --- Abort calculation when requested so
        cancelCalculation.current = false;
        return;
      }
      const itemIndex = queue.shift();
      if (firstIndex < 0) {
        firstIndex = itemIndex;
      }
      var item = renderItem(itemIndex, explicitItemType);
      newElementsToSize.set(itemIndex, item);
    }
    firstElementIndex.current = firstIndex;
    setElementsToSize(newElementsToSize);
  }

  /**
   * Process the calculation queue after the next tick
   */
  function processHeightMeasureBatchAfterTick(): void {
    requestAnimationFrame(() => processHeightMeasureBatch());
  }

  /**
   * Processes the dimensions of the measured items
   */
  function applyMeasuredItemDimensions(): void {
    if (elementsToMeasure && elementsToMeasure.size > 0) {
      // --- Iterate through the sizes of elements and store them
      const heightInfo = heights.current;

      if (heightMode === "first") {
        // --- All items will have the same as as the first
        const measuredHeight = (
          sizerHost.current.childNodes[0] as HTMLDivElement
        ).offsetHeight;
        let top = 0;
        for (let i = 0; i < itemsCount; i++) {
          // --- Get the next element
          heightInfo[i] = {
            top: top,
            height: measuredHeight,
          };
          top += measuredHeight;
        }
        // --- Set the new height
        setTotalHeight(top);
      } else {
        // --- All items have their individual size
        let lastHeightInfo: HeightInfo | null = null;
        let lastIndex = sizerHost.current.childNodes.length;
        const firstIndex = firstElementIndex.current;
        let top = firstIndex
          ? heightInfo[firstIndex - 1].top + heightInfo[firstIndex - 1].height
          : 0;
        for (let i = 0; i < lastIndex; i++) {
          // --- Get the next element
          const element = sizerHost.current.childNodes[i] as HTMLDivElement;
          const itemIndex = i + firstElementIndex.current;
          const measuredHeight = element.offsetHeight;

          // --- Read the element size and calculate position
          lastHeightInfo = heightInfo[itemIndex] = {
            top: top,
            height: measuredHeight,
          };
          top += measuredHeight;
        }

        // --- Now, shift the remaining items
        if (lastHeightInfo) {
          let nextTop = lastHeightInfo.top + lastHeightInfo.height;
          for (
            let i = lastIndex + firstElementIndex.current;
            i < heightInfo.length;
            i++
          ) {
            heightInfo[i].top = nextTop;
            nextTop += heightInfo[i].height;
          }

          // --- Set the new height
          setTotalHeight(nextTop);
        }
      }
    }
  }

  /**
   * Let the scrollbars know the new host component dimensions
   */
  function updateScrollbarDimensions(): void {
    if (deferPositionRefresh && measuring.current) {
      return;
    }

    const host = componentHost.current;
    verticalApi.current?.signHostDimension({
      hostLeft: host.offsetLeft,
      hostTop: host.offsetTop,
      hostSize: host.offsetHeight,
      hostCrossSize: host.offsetWidth,
      hostScrollPos: host.scrollTop,
      hostScrollSize: host.scrollHeight,
    });
    horizontalApi.current?.signHostDimension({
      hostLeft: host.offsetLeft,
      hostTop: host.offsetTop,
      hostSize: host.offsetWidth,
      hostCrossSize: host.offsetHeight,
      hostScrollPos: host.scrollLeft,
      hostScrollSize: host.scrollWidth,
    });
  }

  /**
   * Update the scrollbar's position to the requested one
   */
  function updateRequestedPosition(): void {
    if (requestedPos >= 0 && (!deferPositionRefresh || !measuring.current)) {
      componentHost.current.scrollTop = requestedPos;
      scrollPosition.current = componentHost.current.scrollTop;
      onScrolled?.(scrollPosition.current);
      setRequestedPos(-1);
    }
    if (requestedHorPos >= 0 && (!deferPositionRefresh || !measuring.current)) {
      componentHost.current.scrollLeft = requestedHorPos;
      setRequestedHorPos(-1);
    }
  }

  /**
   * Display the visible elements
   * @returns
   */
  function renderVisibleElements(force = false): void {
    if (deferPositionRefresh && measuring.current) {
      return;
    }

    const view = getViewPort();
    if (view.startIndex < 0 || view.endIndex < 0) {
      // --- The viewport is empty
      return;
    }

    // --- We have to avoid continuous React updates, so we
    // --- carry out rendering only if forced, or the viewport
    // --- changes
    if (
      !force &&
      lastViewport.current.startIndex === view.startIndex &&
      lastViewport.current.endIndex === view.endIndex
    ) {
      // --- The viewport has not changed
      return;
    }
    lastViewport.current = view;

    // --- Render the elements in the viewport
    const visible: VisibleItem[] = [];
    for (let i = view.startIndex; i <= view.endIndex; i++) {
      visible.push({
        index: i,
        item: renderItem(i, {
          ...explicitItemType,
          top: heights.current[i].top,
        }),
      });
    }
    setVisibleElements(visible);

    // --- Notify the host about the viewport change
    onViewPortChanged?.(view.startIndex, view.endIndex);
  }

  /**
   * Displays or hides the scrollbars
   * @param show Indicates if scrollbars should be displayed
   */
  function displayScrollbars(show: boolean): void {
    verticalApi.current?.display(show);
    horizontalApi.current?.display(show);
  }

  // --------------------------------------------------------------------------
  // Virtualized list API to be called by host components

  /**
   * Forces refreshing the list
   */
  function forceRefresh(scrollPosition?: number): void {
    forceRenderingVisible.current = true;
    if (scrollPosition !== undefined) {
      setRequestedPos(scrollPosition);
    } else {
      setRefreshTrigger(refreshTrigger + 1);
    }
  }

  /**
   * Scrolls to the item with the specified index
   */
  function scrollToItemByIndex(index: number): void {
    const heightItem = heights.current[index];
    if (heightItem) {
      setRequestedPos(heightItem.top);
    }
  }

  /**
   * Scrolls to the top
   */
  function scrollToTop(): void {
    setRequestedPos(0);
  }

  /**
   * Scrolls to the bottom
   */
  function scrollToBottom(): void {
    setRequestedPos(MAX_LIST_PIXELS);
  }

  /**
   * Retrieves the current viewport of the virtual list
   */
  function getViewPort(): Viewport {
    if (
      !heights.current ||
      heights.current.length === 0 ||
      !componentHost.current
    ) {
      return { startIndex: -1, endIndex: -1 };
    }
    var scrollTop = componentHost.current.scrollTop;
    var height = componentHost.current.offsetHeight;
    const startIndex = binarySearch(heights.current, scrollTop);
    const endIndex = binarySearch(heights.current, scrollTop + height);
    const result = { startIndex, endIndex };
    return result;

    function binarySearch(items: HeightInfo[], value: number): number {
      var startIndex = 0,
        stopIndex = items.length - 1,
        middle = Math.floor((stopIndex + startIndex) / 2);

      while (
        (value < items[middle].top ||
          value >= items[middle].top + items[middle].height) &&
        startIndex < stopIndex
      ) {
        // --- Adjust search area
        if (value < items[middle].top) {
          stopIndex = middle - 1;
        } else if (value > items[middle].top) {
          startIndex = middle + 1;
        }

        // --- Recalculate middle
        middle = Math.max(0, Math.floor((stopIndex + startIndex) / 2));
      }

      // --- Done
      return middle;
    }
  }

  /**
   * Ensures that the item with the specified index gets visible
   * entirelly in the current viewport
   */
  function ensureVisible(index: number, location: ItemTargetLocation): void {
    const heightItem = heights.current[index];
    if (!heightItem) {
      // --- We cannot ensure the visibility of a non-existing item
      return;
    }
    let top = heightItem.top;
    switch (location) {
      case "bottom":
        top =
          heightItem.top -
          componentHost.current.offsetHeight +
          heightItem.height;
        break;
      case "center":
        top =
          heightItem.top -
          (componentHost.current.offsetHeight - heightItem.height) / 2;
        break;
    }
    setRequestedPos(top);
  }

  /**
   * Ensures that the virtualized list gets the focus
   */
  function focus(): void {
    requestAnimationFrame(() => componentHost.current?.focus());
  }

  /**
   * Initiates remeasuring the specified range of items
   */
  function remeasure(start: number, end: number) {
    // --- Prepare the next remeasure batch
    batchQueue.current.push({
      startIndex: Math.max(0, start),
      endIndex: Math.min(itemsCount, end),
    });

    // --- Let's keep the top item's position, if required so
    if (reposition) {
      positionToIndex.current = getViewPort().startIndex;
    }

    // --- Initiate remeasuring
    setRemeasureTrigger(remeasureTrigger + 1);
  }
};

// ----------------------------------------------------------------------------
// Helper types and values

/**
 * Handles scrolling keys
 * @param element HTML element to scroll
 * @param key Key pressed
 */
function calculateScrollPositionByKey(
  element: HTMLElement,
  key: string,
  shiftKey: boolean,
  itemHeight = 20,
  integralHeight = false
): number {
  switch (key) {
    case "Home":
      return getPos(0);
    case "ArrowDown":
      return getPos(element.scrollTop + itemHeight);
    case "ArrowUp":
      return getPos(element.scrollTop - itemHeight);
    case "PageDown":
      return getPos(
        element.scrollTop + element.offsetHeight * (shiftKey ? 5 : 1)
      );
    case "PageUp":
      return getPos(
        element.scrollTop - element.offsetHeight * (shiftKey ? 5 : 1)
      );
    case "End":
      return getPos((element.scrollTop = element.scrollHeight));
  }

  function getPos(position: number): number {
    return Math.max(
      0,
      integralHeight ? Math.round(position / itemHeight) * itemHeight : position
    );
  }
}

/**
 * Height information of a particular list item
 */
type HeightInfo = {
  top: number;
  height: number;
};

/**
 * Information about a visible item
 */
type VisibleItem = {
  index: number;
  item: JSX.Element;
};

/**
 * Viewport information
 */
type Viewport = { startIndex: number; endIndex: number };

/**
 * Each virtual item has this type for measuring and displaying the item
 */
const explicitItemType: CSSProperties = {
  position: "absolute",
  top: 0,
  overflowX: "hidden",
};

