import * as React from "react";
import {
  CSSProperties,
  PropsWithChildren,
  useEffect,
  useRef,
  useState,
} from "react";

/**
 * The minimum size of the scrollbar's handle
 */
const MIN_HANDLE_SIZE = 10;

/**
 * The orientation of the scrollbar element
 */
export type ElementOrientation = "vertical" | "horizontal";

/**
 * Represents the data of the scrollbar
 */
export type ScrollBarData = {
  barSize?: number;
  hostLeft: number;
  hostTop: number;
  hostSize: number;
  hostCrossSize: number;
  hostScrollSize: number;
  hostScrollPos: number;
};

/**
 * Represents the API of the scrollbar
 */
export type ScrollbarApi = {
  signHostDimension: (dims: ScrollBarData) => void;
  display: (forceShow: boolean) => void;
};

/**
 * Scrollbar properties
 */
type FloatingScrollbarProps = {
  direction: ElementOrientation;
  barSize: number;
  forceShow?: boolean;
  registerApi?: (api: ScrollbarApi) => void;
  sizing?: (isSizing: boolean) => void;
  moved?: (newPosition: number) => void;
};

export const FloatingScrollbar: React.FC<FloatingScrollbarProps> = ({
  direction,
  barSize,
  forceShow = false,
  registerApi,
  sizing,
  moved,
}: PropsWithChildren<FloatingScrollbarProps>) => {
  const [barTop, setBarTop] = useState(0);
  const [barLeft, setBarLeft] = useState(0);
  const [barWidth, setBarWidth] = useState(0);
  const [barHeight, setBarHeight] = useState(0);
  const [handleTop, setHandleTop] = useState(0);
  const [handleLeft, setHandleLeft] = useState(0);
  const [handleWidth, setHandleWidth] = useState(0);
  const [handleHeight, setHandleHeight] = useState(0);
  const [show, setShow] = useState(false);
  const [pointed, setPointed] = useState(false);
  const [dragging, setDragging] = useState(false);

  const mounted = useRef(false);
  const gripPosition = useRef(0);
  const startPosition = useRef(0);
  const dims = useRef<ScrollBarData>();

  // --- Bind these functions to the current context
  const moveFunc = (e: MouseEvent) => move(e);
  const endResizeFunc = () => endResize();

  useEffect(() => {
    if (!mounted.current) {
      registerApi?.({ signHostDimension, display });
      mounted.current = true;
    }
  });

  const barStyle: CSSProperties = {
    position: "absolute",
    top: barTop,
    left: barLeft,
    width: barWidth,
    height: barHeight,
    background: "transparent",
  };

  const handleStyle: CSSProperties = {
    position: "absolute",
    top: handleTop,
    left: handleLeft,
    width: handleWidth,
    height: handleHeight,
    background: "#a0a0a0",
    opacity: dragging ? 1.0 : pointed || forceShow ? 0.8 : 0.0,
    transitionProperty: "opacity",
    transitionDuration: dragging ? "0s" : "0.5s",
    transitionDelay: dragging ? "0s" : "0.25s",
  };

  return show ? (
    <div
      style={barStyle}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
    >
      <div
        style={handleStyle}
        onMouseDown={(ev) => {
          if (ev.button === 0) {
            sizing?.(true);
            startResize(ev);
            setDragging(true);
          }
          ev.stopPropagation();
        }}
        onMouseUp={(ev) => {
          endResize();
          setDragging(false);
          sizing?.(false);
        }}
        onClick={(ev) => {
          ev.stopPropagation();
        }}
      ></div>
    </div>
  ) : null;

  /**
   * The parent calls this method whenewer its dimensions or the scrollbar's
   * position changes.
   * @param dims New host/scrollbar dimensions
   */
  function signHostDimension(data: ScrollBarData): void {
    dims.current = data;

    // --- Calculate handle dimensions
    const show = data.hostScrollSize > data.hostSize;
    const handleSize =
      show &&
      Math.max(
        data.hostScrollSize > 0
          ? (data.hostSize * data.hostSize) / data.hostScrollSize
          : 0,
        MIN_HANDLE_SIZE
      );
    let initialPos =
      show && data.hostScrollSize > 0
        ? (data.hostScrollPos * (data.hostSize - handleSize)) /
          (data.hostScrollSize - data.hostSize)
        : 0;
    if (initialPos + handleSize > data.hostSize) {
      initialPos = data.hostSize - handleSize;
    }

    // --- Set bar and handles dimensions
    setShow(show);
    setBarTop(
      direction === "horizontal"
        ? data.hostTop + data.hostCrossSize - barSize
        : undefined
    );
    setBarLeft(
      direction === "vertical"
        ? data.hostLeft + data.hostCrossSize - barSize
        : undefined
    );
    setBarWidth(direction === "horizontal" ? data.hostSize : barSize);
    setBarHeight(direction === "vertical" ? data.hostSize : barSize);
    setHandleTop(direction === "horizontal" ? undefined : initialPos);
    setHandleLeft(direction === "vertical" ? undefined : initialPos);
    setHandleWidth(direction === "horizontal" ? handleSize : barSize);
    setHandleHeight(direction === "vertical" ? handleSize : barSize);
  }

  /**
   * The parent call this methods to show/hide the scrollbar
   * @param show Indicates if the scrollbar should be displayed
   */
  function display(show: boolean): void {
    setPointed(show);
  }

  /**
   * Starts resizing this panel
   */
  function startResize(e: React.MouseEvent): void {
    gripPosition.current = direction === "horizontal" ? e.clientX : e.clientY;
    startPosition.current = direction === "horizontal" ? handleLeft : handleTop;
    window.addEventListener("mouseup", endResizeFunc as any);
    window.addEventListener("touchend", endResizeFunc as any);
    window.addEventListener("touchcancel", endResizeFunc as any);
    window.addEventListener("mousemove", moveFunc as any);
    window.addEventListener("touchmove", moveFunc as any);
  }

  /**
   * Ends resizing this panel
   */
  function endResize(): void {
    window.removeEventListener("mouseup", endResizeFunc as any);
    window.removeEventListener("touchend", endResizeFunc as any);
    window.removeEventListener("touchcancel", endResizeFunc as any);
    window.removeEventListener("mousemove", moveFunc as any);
    window.removeEventListener("touchmove", moveFunc as any);
    setDragging(false);
    sizing?.(false);
  }

  /**
   * Change the size of the element
   */
  function move(e: MouseEvent): void {
    const delta =
      (direction === "horizontal" ? e.clientX : e.clientY) -
      gripPosition.current;
    const maxPosition =
      dims.current.hostSize -
      (direction === "horizontal" ? handleWidth : handleHeight);
    var newPosition = Math.max(0, startPosition.current + delta);
    newPosition = Math.min(newPosition, maxPosition);
    var newScrollPosition =
      (newPosition * (dims.current.hostScrollSize - dims.current.hostSize)) /
      maxPosition;
    moved?.(newScrollPosition);
  }
};
