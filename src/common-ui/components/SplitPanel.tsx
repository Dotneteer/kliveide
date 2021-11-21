import * as React from "react";
import {
  CSSProperties,
  PropsWithChildren,
  ReactElement,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Column, Fill, Row } from "./Panels";
import { useResizeObserver } from "./useResizeObserver";

/**
 * Properties of a SplitPanel
 */
export type SplitPanelProperties = {
  panel1: ReactElement;
  panel1MinSize?: number | string;
  showPanel1?: boolean;
  panel2: ReactElement;
  panel2MinSize?: number | string;
  showPanel2?: boolean;
  initialSize?: number | string;
  horizontal?: boolean;
  reverse?: boolean;
  splitterSize?: number;
  style?: CSSProperties;
  resized?: (newPos: number) => void;
};

/**
 * A split panel with two child panels and a movable splitter between them
 */
export const SplitPanel: React.FC<SplitPanelProperties> = ({
  panel1: first,
  panel1MinSize,
  showPanel1 = true,
  panel2: second,
  panel2MinSize,
  showPanel2 = true,
  initialSize,
  horizontal = false,
  reverse = false,
  splitterSize = 6,
  style,
  resized,
}: PropsWithChildren<SplitPanelProperties>) => {
  // --- Component state to trigger rendering
  const [primaryPanelSize, setPrimaryPanelSize] = useState(
    initialSize ?? "50%"
  );
  const [pointed, setPointed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [splitterTop, setSplitterTop] = useState(0);
  const [splitterLeft, setSplitterLeft] = useState(0);

  // --- Other state information
  const containerRef = useRef<HTMLDivElement>(null);
  const primaryIsDisplayed = useRef(false);
  const primaryPanelRef = useRef<HTMLDivElement>(null);
  const secondaryIsDisplayed = useRef(false);
  const secondaryPanelRef = useRef<HTMLDivElement>(null);
  const primaryPanelSizeSaved = useRef(0);
  const gripPosition = useRef(0);
  const gripSize = useRef(0);
  const minSplitterValue = useRef(0);
  const maxSplitterValue = useRef(0);

  // --- Obtain the container and panel sizes
  const crossSize = horizontal
    ? containerRef.current?.offsetHeight ?? 0
    : containerRef.current?.offsetWidth ?? 0;
  // --- Set up the style of the splitter <div>
  const splitterStyle: CSSProperties = {
    position: "absolute",
    top: splitterTop,
    left: splitterLeft,
    height: horizontal ? crossSize : splitterSize,
    width: horizontal ? splitterSize : crossSize,
    backgroundColor:
      pointed || dragging ? "var(--splitter-hover-color)" : "transparent",
    opacity: pointed || dragging ? 1 : 0,
    cursor: horizontal ? "ew-resize" : "ns-resize",
    transitionProperty: "background-color",
    transitionDelay: "0.25s",
    transitionDuration: "0.25s",
    zIndex: 100,
    marginLeft: horizontal ? -splitterSize / 2 : 0,
    marginTop: horizontal ? 0 : -splitterSize / 2,
  };

  // --- Bind functions (used by window events)
  const _move = (e: MouseEvent) => move(e);
  const _endMove = () => endMove();
  const _onResized = () => onResized();

  // --- Respond to resizing the main container
  useResizeObserver(containerRef, _onResized);

  // --- Set up initial comtainer and panel sizes
  useLayoutEffect(() => {
    _onResized();
  });

  return (
    <>
      <Fill
        hostRef={containerRef}
        useColumns={!!horizontal}
        reverse={reverse}
        style={style}
      >
        {horizontal && (
          <>
            {showPanel1 && showPanel2 && (
              <>
                <Column hostRef={primaryPanelRef} width={primaryPanelSize}>
                  {first}
                </Column>
                <Column hostRef={secondaryPanelRef}>{second}</Column>
              </>
            )}
            {showPanel1 && !showPanel2 && (
              <Column hostRef={primaryPanelRef} flexible>
                {first}
              </Column>
            )}
            {!showPanel1 && showPanel2 && (
              <Column hostRef={secondaryPanelRef}>{second}</Column>
            )}
          </>
        )}
        {!horizontal && (
          <>
            {showPanel1 && showPanel2 && (
              <>
                <Row hostRef={primaryPanelRef} height={primaryPanelSize}>
                  {first}
                </Row>
                <Row hostRef={secondaryPanelRef}>{second}</Row>
              </>
            )}
            {showPanel1 && !showPanel2 && (
              <Row hostRef={primaryPanelRef}>{first}</Row>
            )}
            {!showPanel1 && showPanel2 && (
              <Row hostRef={secondaryPanelRef}>{second}</Row>
            )}
          </>
        )}
      </Fill>
      {showPanel1 && showPanel2 && (
        <div
          style={splitterStyle}
          onMouseEnter={() => setPointed(true)}
          onMouseLeave={() => setPointed(false)}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            if (e.button === 0) {
              startMove(e);
            }
          }}
          onMouseUp={() => endMove()}
        ></div>
      )}
    </>
  );

  /**
   * Calculate the new panel sizes when the container is resized
   * (or set up initially)
   */
  function onResized(): void {
    // --- Keep track of the display state of the primary panel
    const wasDisplayed = primaryIsDisplayed.current;
    const displayed = !!primaryPanelRef.current;
    primaryIsDisplayed.current = displayed;
    const secondaryWasDisplayed = secondaryIsDisplayed.current;
    const secondaryDisplayed = !!secondaryPanelRef.current;
    secondaryIsDisplayed.current = secondaryDisplayed;

    // --- Determine the container size
    const containerSize =
      (horizontal
        ? containerRef.current?.offsetWidth
        : containerRef.current?.offsetHeight) ?? -1;

    // --- Calculate splitter positions
    const rect = containerRef.current?.getBoundingClientRect();
    const primarySize =
      typeof primaryPanelSize === "string" ? 0 : primaryPanelSize;
    const splitterShift =
      (horizontal
        ? containerRef.current?.offsetTop
        : containerRef.current?.offsetLeft) ?? 0;
    const splitterTop = horizontal
      ? splitterShift
      : reverse
      ? (containerRef.current?.offsetHeight ?? 0) -
        primarySize +
        (rect?.top ?? 0)
      : primarySize + (rect?.top ?? 0);
    const splitterLeft = horizontal
      ? reverse
        ? (containerRef.current?.offsetWidth ?? 0) -
          primarySize +
          (rect?.left ?? 0)
        : primarySize + (rect?.left ?? 0)
      : splitterShift;

    setSplitterTop(splitterTop);
    setSplitterLeft(splitterLeft);

    let panel1Size = 0;

    // --- Calculate panel sizes
    if (secondaryWasDisplayed && !secondaryDisplayed) {
      // --- We're about to hide the secondary panel, save the primary size
      primaryPanelSizeSaved.current = primarySize;
    }

    if (
      secondaryDisplayed &&
      !secondaryWasDisplayed &&
      wasDisplayed &&
      displayed
    ) {
      // --- We have just restored the secondary panel, restore the primary size
      panel1Size = primaryPanelSizeSaved.current;
    } else if (displayed) {
      if (wasDisplayed) {
        // --- Retrieve the panel size from the current DOM element
        panel1Size =
          (horizontal
            ? primaryPanelRef.current?.offsetWidth
            : primaryPanelRef.current?.offsetHeight) ?? -1;
      } else {
        // --- We have just displayed the primary panel, so set its size
        if (typeof primaryPanelSize === "string") {
          // --- Use percentage size
          panel1Size =
            (parseInt(primaryPanelSize.substr(0, primaryPanelSize.length - 1)) /
              100) *
            containerSize;
        } else {
          // --- Use pixel size
          panel1Size = primaryPanelSize;
        }
      }
    } else {
      // --- Primary panel is not displayed, nothing to resize
      return;
    }

    // --- Take care that the panel sizes do not shrink below the minimum size
    let panel2Size = containerSize - panel1Size;

    // --- Keep the first panel size
    const minSize1 = getMinimumSize(
      containerSize,
      panel1Size,
      panel1MinSize ?? 0
    );
    if (panel1Size < minSize1) {
      panel1Size = minSize1;
    }
    const minSize2 = getMinimumSize(
      containerSize,
      panel2Size,
      panel2MinSize ?? 0
    );
    if (panel2Size < minSize2 && containerSize - minSize2 >= minSize1) {
      panel1Size = containerSize - minSize2;
    }
    if (panel1Size > containerSize) {
      panel1Size = containerSize;
    }

    // --- Set the resulting size and the new splitter range
    setPrimaryPanelSize(panel1Size);
    minSplitterValue.current = minSize1;
    maxSplitterValue.current = containerSize - minSize2;
  }

  /**
   * The new size of a panel
   * @param containerSize The container's size
   * @param panelSize New size to set
   * @param minSize Minimum size specification
   * @returns New panel size
   */
  function getMinimumSize(
    containerSize: number,
    panelSize: number,
    minSize: number | string
  ): number {
    if (typeof minSize === "number") {
      return minSize;
    }
    if (minSize.endsWith("%")) {
      const percSize = parseInt(minSize.substr(0, minSize.length - 1));
      return isNaN(percSize) ? panelSize : (containerSize * percSize) / 100;
    }
    return panelSize;
  }

  /**
   * Start moving the splitter (when mouse is down)
   */
  function startMove(e: React.MouseEvent): void {
    // --- Take a note of start position
    gripPosition.current = horizontal ? e.clientX : e.clientY;
    gripSize.current = primaryPanelSize as number;

    // --- Capture mouse move vie window events
    window.addEventListener("mouseup", _endMove);
    window.addEventListener("mousemove", _move);
    document.body.style.cursor = horizontal ? "ew-resize" : "ns-resize";
    setDragging(true);
  }

  /**
   * Move the splitter (as the mouse moves)
   */
  function move(e: MouseEvent): void {
    if (maxSplitterValue.current < minSplitterValue.current) {
      // --- We do not have a range to move within
      return;
    }

    // --- Calculate the delta move
    const delta = (horizontal ? e.clientX : e.clientY) - gripPosition.current;
    let newPosition = gripSize.current + (reverse ? -delta : delta);

    // --- Do not allow moving out of the range defined by the minimum panel sizes
    if (newPosition < minSplitterValue.current) {
      newPosition = minSplitterValue.current;
    } else if (newPosition > maxSplitterValue.current) {
      newPosition = maxSplitterValue.current;
    }
    setPrimaryPanelSize(newPosition);
    resized?.(newPosition);
  }

  /**
   * Stop moving the splitter
   */
  function endMove(): void {
    // --- Release the captured mouse
    window.removeEventListener("mouseup", _endMove);
    window.removeEventListener("mousemove", _move);
    document.body.style.cursor = "default";
    setDragging(false);
  }
};
