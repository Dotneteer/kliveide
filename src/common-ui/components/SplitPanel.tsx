import React, {
    CSSProperties,
    PropsWithChildren,
    ReactElement,
    useLayoutEffect,
    useRef,
    useState,
  } from "react";
  import { Column, Fill, Row } from "./Panels";
  import { useObserver } from "./useObserver";

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
    splitterSize = 8,
    style,
  }: PropsWithChildren<SplitPanelProperties>) => {
    // --- Component state to trigger rendering
    const [primaryPanelSize, setPrimaryPanelSize] = useState(
      initialSize ?? "50%"
    );
    const [lastLayoutSize, setLastLayoutSize] = useState<number>(-1);
    const [pointed, setPointed] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [splitterShift, setSplitterShift] = useState(0);
  
    // --- Other state information
    const containerRef = useRef<HTMLDivElement>(null);
    const primaryPanelRef = useRef<HTMLDivElement>(null);
    const gripPosition = useRef(0);
    const gripSize = useRef(0);
    const minSplitterValue = useRef(0);
    const maxSplitterValue = useRef(0);
  
    const rect = containerRef.current?.getBoundingClientRect();
    const primarySize =
      typeof primaryPanelSize === "string"
        ? horizontal
          ? primaryPanelRef.current?.offsetWidth ?? 0
          : primaryPanelRef.current?.offsetHeight ?? 0
        : primaryPanelSize;
    const crossSize = horizontal
      ? primaryPanelRef.current?.offsetHeight ?? 0
      : primaryPanelRef.current?.offsetWidth ?? 0;
    const splitterStyle: CSSProperties = {
      position: "absolute",
      top: horizontal
        ? splitterShift
        : reverse
        ? (containerRef.current?.offsetHeight ?? 0) -
          primarySize +
          (rect?.top ?? 0)
        : primarySize + (rect?.top ?? 0),
      left: horizontal
        ? reverse
          ? (containerRef.current?.offsetWidth ?? 0) -
            primarySize +
            (rect?.left ?? 0)
          : primarySize + (rect?.left ?? 0)
        : splitterShift,
      height: horizontal ? crossSize : splitterSize,
      width: horizontal ? splitterSize : crossSize,
      backgroundColor: pointed || dragging ? "navy" : "transparent",
      opacity: pointed || dragging ? 0.8 : 0,
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
    useObserver({
      callback: _onResized,
      element: containerRef,
    });
  
    // --- Set up initial comtainer and panel sizes
    useLayoutEffect(() => {
      _onResized();
    });
  
    return (
      <>
        <Fill
          hostRef={containerRef}
          useColumns={!!horizontal}
          flexible={true}
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
                  <Column flexible>{second}</Column>
                </>
              )}
              {showPanel1 && !showPanel2 && (
                <Column hostRef={primaryPanelRef} flexible>
                  {first}
                </Column>
              )}
              {!showPanel1 && showPanel2 && <Column flexible>{second}</Column>}
            </>
          )}
          {!horizontal && (
            <>
              {showPanel1 && showPanel2 && (
                <>
                  <Row hostRef={primaryPanelRef} height={primaryPanelSize}>
                    {first}
                  </Row>
                  <Row flexible>{second}</Row>
                </>
              )}
              {showPanel1 && !showPanel2 && (
                <Row hostRef={primaryPanelRef} flexible>
                  {first}
                </Row>
              )}
              {!showPanel1 && showPanel2 && <Row flexible>{second}</Row>}
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
  
    function onResized(): void {
      const containerSize =
        (horizontal
          ? containerRef.current?.offsetWidth
          : containerRef.current?.offsetHeight) ?? -1;
      setSplitterShift(
        (horizontal
          ? containerRef.current?.offsetTop
          : containerRef.current?.offsetLeft) ?? 0
      );
      let panel1Size =
        (horizontal
          ? primaryPanelRef.current?.offsetWidth
          : primaryPanelRef.current?.offsetHeight) ?? -1;
      let panel2Size = containerSize - panel1Size;
      const lastSize = lastLayoutSize;
      setLastLayoutSize(containerSize);
      if (lastSize === containerSize) {
        // --- Container size did not change, nothing to resize
        return;
      }
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
  
    function startMove(e: React.MouseEvent): void {
      gripPosition.current = horizontal ? e.clientX : e.clientY;
      gripSize.current = primaryPanelSize as number;
      window.addEventListener("mouseup", _endMove);
      window.addEventListener("mousemove", _move);
      document.body.style.cursor = horizontal ? "ew-resize" : "ns-resize";
      setDragging(true);
    }
  
    function move(e: MouseEvent): void {
      if (maxSplitterValue.current < minSplitterValue.current) {
        return;
      }
      const delta = (horizontal ? e.clientX : e.clientY) - gripPosition.current;
      let newPosition = gripSize.current + (reverse ? -delta : delta);
      if (newPosition < minSplitterValue.current) {
        newPosition = minSplitterValue.current;
      } else if (newPosition > maxSplitterValue.current) {
        newPosition = maxSplitterValue.current;
      }
      setPrimaryPanelSize(newPosition);
    }
  
    function endMove(): void {
      window.removeEventListener("mouseup", _endMove);
      window.removeEventListener("mousemove", _move);
      document.body.style.cursor = "default";
      setDragging(false);
    }
  };
  