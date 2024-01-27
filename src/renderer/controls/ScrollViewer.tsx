import { useResizeObserver } from "@renderer/core/useResizeObserver";
import React, { ReactNode, useEffect, useRef, useState } from "react";
import classnames from "@renderer/utils/classnames";
import styles from "./ScrollViewer.module.scss";
import { useAppServices } from "@appIde/services/AppServicesProvider";
import { AttachedShadow } from "./AttachedShadow";

export type ScrollViewerApi = {
  updateDims: () => void;
  getScrollTop: () => number;
  getScrollLeft: () => number;
  scrollToVertical: (pos: number) => void;
  scrollToHorizontal: (pos: number) => void;
};

type Props = {
  scrollBarWidth?: number;
  allowHorizontal?: boolean;
  allowVertical?: boolean;
  children?: ReactNode;
  onScrolled?: (pos: number) => void;
  apiLoaded?: (api: ScrollViewerApi) => void;
  getScrollHeightFn?: () => number;
  getScrollWidthFn?: () => number;
  getScrollTopFn?: () => number;
  getScrollLeftFn?: () => number;
  scrollVerticalFn?: (pos: number) => void;
  scrollHorizontalFn?: (pos: number) => void;
  shadowVisibleFn?: () => boolean;
};

export const ScrollViewer = ({
  scrollBarWidth = 10,
  allowHorizontal = true,
  allowVertical = true,
  children,
  onScrolled,
  apiLoaded,
  getScrollHeightFn,
  getScrollWidthFn,
  getScrollTopFn,
  getScrollLeftFn,
  scrollVerticalFn,
  scrollHorizontalFn,
  shadowVisibleFn
}: Props) => {
  const ref = useRef<HTMLDivElement>();
  const { uiService } = useAppServices();
  const [pointed, setPointed] = useState(false);
  const [vThumbPos, setVThumbPos] = useState(0);
  const [hThumbPos, setHThumbPos] = useState(0);
  const [shadowVisible, setShadowVisible] = useState(false);
  const [version, setVersion] = useState(0);
  const primaryDirVertical = allowVertical ?? true;

  // --- Scrollbar dimensions and positions
  const vScroll = useRef(false);
  const hScroll = useRef(false);
  const vLeft = useRef(-1);
  const vHeight = useRef(-1);
  const vTop = useRef(0);
  const vThumbHeight = useRef(-1);
  const vThumbRatio = useRef(0);
  const hLeft = useRef(-1);
  const hTop = useRef(-1);
  const hWidth = useRef(-1);
  const hThumbWidth = useRef(-1);
  const hThumbRatio = useRef(0);

  // --- Scrollbar drag status
  const vGrip = useRef(0);
  const vGripThumb = useRef(0);
  const hGrip = useRef(0);
  const hGripThumb = useRef(0);

  // --- Viewer virtualizer functions
  const getScrollHeight =
    getScrollHeightFn ?? (() => ref.current?.scrollHeight ?? 1);
  const getScrollWidth =
    getScrollWidthFn ?? (() => ref.current?.scrollWidth ?? 1);
  const getScrollTop = getScrollTopFn ?? (() => ref.current.scrollTop ?? 0);
  const getScrollLeft = getScrollLeftFn ?? (() => ref.current.scrollLeft ?? 0);
  const scrollVertical =
    scrollVerticalFn ?? ((pos: number) => ref.current?.scrollTo({ top: pos }));
  const scrollHorizontal =
    scrollHorizontalFn ??
    ((pos: number) => ref.current?.scrollTo({ left: pos }));

  const updateDims = () => {
    const el = ref.current;
    if (!el) return;

    // --- Obtain virtualized dimensions
    const scrollHeight = getScrollHeight();
    const scrollWidth = getScrollWidth();
    const scrollTop = getScrollTop();
    const scrollLeft = getScrollLeft();

    // --- Which scrollbast should be displayed?
    vScroll.current = allowVertical && scrollHeight > el.offsetHeight;
    hScroll.current = allowHorizontal && scrollWidth > el.offsetWidth;

    // --- Calculate vertical scrollbar and thumb dimensions
    vHeight.current = vScroll.current
      ? el.offsetHeight - (hScroll.current ? scrollBarWidth : 0)
      : 1;

    // --- Ratio of the visible viewport
    const vRatio = scrollHeight === 0 ? 0 : el.offsetHeight / scrollHeight;

    // --- Calculate the thumb height. Because we keep the thumb height at least the scrollbar's width,
    // --- we need to store the thumb ratio; we need to use it for scroll position calculation
    vThumbHeight.current = vScroll.current ? vHeight.current * vRatio : 0;
    vThumbRatio.current = 1.0;
    if (vThumbHeight.current < scrollBarWidth) {
      vThumbRatio.current = scrollBarWidth / vThumbHeight.current;
      vThumbHeight.current = scrollBarWidth;
    }

    // --- Calculate the scrollbar's top position
    vTop.current = el.offsetTop;

    // --- We need to adjust the thumb's position beacuse of the minimum size of the thumb
    const vThumbAdjustRatio =
      (vHeight.current - vThumbHeight.current) /
      (vHeight.current - vThumbHeight.current / vThumbRatio.current);
    setVThumbPos(
      vTop.current +
        ((vThumbAdjustRatio * scrollTop * vRatio) / (el.offsetHeight ?? 1)) *
          vHeight.current
    );
    vLeft.current = el.offsetLeft + el.offsetWidth - scrollBarWidth;
    if (isNaN(vLeft.current)) {
    }

    // --- Calculate vertical scrollbar and thumb dimensions
    hWidth.current = hScroll.current
      ? el.offsetWidth - (vScroll.current ? scrollBarWidth : 0)
      : 1;

    // --- Ratio of the visible viewport
    const hRatio = scrollWidth === 0 ? 0 : el.offsetWidth / scrollWidth;

    // --- Calculate the thumb width. Because we keep the thumb width at least the scrollbar's width,
    // --- we need to store the thumb ratio; we need to use it for scroll position calculation
    hThumbWidth.current = hScroll.current ? hWidth.current * hRatio : 0;
    hThumbRatio.current = 1.0;
    if (hThumbWidth.current < scrollBarWidth) {
      hThumbRatio.current = scrollBarWidth / hThumbWidth.current;
      hThumbWidth.current = scrollBarWidth;
    }

    // --- Calculate the scrollbar's top position
    hLeft.current = el.offsetLeft;
    hTop.current = el.offsetTop + el.offsetHeight - scrollBarWidth;

    // --- We need to adjust the thumb's position beacuse of the minimum size of the thumb
    const hThumbAdjustRatio =
      (hWidth.current - hThumbWidth.current) /
      (hWidth.current - hThumbWidth.current / hThumbRatio.current);
    setHThumbPos(
      hLeft.current +
        ((hThumbAdjustRatio * scrollLeft * hRatio) / (el.offsetWidth ?? 1)) *
          hWidth.current
    );

    // --- Check shadow visibility
    if (shadowVisibleFn) {
      setShadowVisible(shadowVisibleFn());
    }
  };

  // --- Update scrollbar dimensions and positions, whenever something related changes
  useResizeObserver(ref, () => updateDims());

  // --- Take care to manage the attached shadow visibility
  useEffect(() => {
    updateDims();
    apiLoaded?.({
      updateDims,
      getScrollLeft: () => ref.current?.scrollLeft ?? 0,
      getScrollTop: () => ref.current?.scrollTop ?? 0,
      scrollToVertical: top => ref.current?.scrollTo({ top }),
      scrollToHorizontal: left => ref.current?.scrollTo({ left })
    });

    const scrolled = () =>
      setShadowVisible(shadowVisibleFn?.() ?? ref.current?.scrollTop > 0);

    if (ref.current) {
      ref.current.addEventListener("scroll", scrolled);
    }

    return () => {
      if (ref.current) {
        ref.current.removeEventListener("scroll", scrolled);
      }
    };
  }, [ref.current]);

  useEffect(() => {
    updateDims();
  }, [pointed]);

  // --- Start moving the vertical thumb
  const vStartMove = (e: MouseEvent | React.MouseEvent) => {
    vGrip.current = e.clientY;
    vGripThumb.current = vThumbPos - vTop.current;
    window.addEventListener("mouseup", vEndMove);
    window.addEventListener("mousemove", vMove);
    uiService.setDragging(true);
  };

  // --- Move the verical thumb
  const vMove = (e: MouseEvent | React.MouseEvent) => {
    const delta = e.clientY - vGrip.current;
    const el = ref.current;
    const newScrollPos =
      ((((vGripThumb.current + delta) * getScrollHeight()) /
        (vHeight.current + scrollBarWidth)) *
        (vHeight.current - vThumbHeight.current / vThumbRatio.current)) /
      (vHeight.current - vThumbHeight.current);
    scrollVertical(newScrollPos);
  };

  // --- Position verticvally when clicked the scrollbar
  const vPositionTo = (e: React.MouseEvent) => {
    const el = ref.current;
    const newScrollPos =
      ((((e.clientY - vTop.current - vThumbHeight.current / 2) *
        getScrollHeight()) /
        (vHeight.current + scrollBarWidth)) *
        (vHeight.current - vThumbHeight.current / vThumbRatio.current)) /
      (vHeight.current - vThumbHeight.current);
    scrollVertical(newScrollPos);
  };

  // --- Finish moving the vertical thumb
  const vEndMove = () => {
    window.removeEventListener("mouseup", vEndMove);
    window.removeEventListener("mousemove", vMove);
    uiService.setDragging(false);
    setVersion(version + 1);
  };

  // --- Start moving the horizontal thumb
  const hStartMove = (e: MouseEvent | React.MouseEvent) => {
    hGrip.current = e.clientX;
    hGripThumb.current = hThumbPos - hLeft.current;
    window.addEventListener("mouseup", hEndMove);
    window.addEventListener("mousemove", hMove);
    uiService.setDragging(true);
  };

  // --- Move the horizontal thumb
  const hMove = (e: MouseEvent | React.MouseEvent) => {
    const delta = e.clientX - hGrip.current;
    const el = ref.current;
    const newScrollPos =
      ((((hGripThumb.current + delta) * getScrollWidth()) /
        (hWidth.current + scrollBarWidth)) *
        (hWidth.current - hThumbWidth.current / hThumbRatio.current)) /
      (hWidth.current - hThumbWidth.current);
    scrollHorizontal(newScrollPos);
  };

  // --- Position verticvally when clicked the scrollbar
  const hPositionTo = (e: React.MouseEvent) => {
    const el = ref.current;
    const newScrollPos =
      ((((e.clientX - hLeft.current - hThumbWidth.current / 2) *
        getScrollWidth()) /
        (hWidth.current + scrollBarWidth)) *
        (hWidth.current - hThumbWidth.current / hThumbRatio.current)) /
      (hWidth.current - hThumbWidth.current);
    scrollHorizontal(newScrollPos);
  };

  // --- Finish moving the horizontal thumb
  const hEndMove = () => {
    window.removeEventListener("mouseup", hEndMove);
    window.removeEventListener("mousemove", hMove);
    uiService.setDragging(false);
    setVersion(version + 1);
  };

  // --- Handle the mouse wheel event
  const mouseWheel = (e: React.WheelEvent) => {
    if (
      (primaryDirVertical && e.ctrlKey) ||
      (!primaryDirVertical && !e.ctrlKey) ||
      (!primaryDirVertical && allowVertical === false)
    ) {
      ref.current.scrollLeft += e.deltaY / 4;
    } else {
      ref.current.scrollTop += e.deltaY / 4;
    }
    e.stopPropagation();
  };

  return (
    <>
      <div
        ref={ref}
        className={styles.scrollViewer}
        onMouseEnter={() => setPointed(true)}
        onMouseLeave={() => setPointed(false)}
        onScroll={() => {
          updateDims();
          onScrolled?.(getScrollTop());
        }}
        onWheel={e => mouseWheel(e)}
      >
        {children}
        <AttachedShadow parentElement={ref.current} visible={shadowVisible} />

        {/* Vertical scrollbar */}
        {vScroll.current && (
          <div
            className={styles.vScrollbar}
            style={{
              left: vLeft.current,
              top: vTop.current ?? 0,
              height: vHeight.current,
              width: scrollBarWidth
            }}
            onClick={e => vPositionTo(e)}
          />
        )}
        {/* Vertical scrollbar thumb */}
        <div
          className={classnames(
            styles.vScrollbarThumb,
            vScroll.current && (pointed || uiService.dragging)
              ? styles.pointed
              : styles.unpointed
          )}
          style={{
            left: vLeft.current,
            top: vThumbPos,
            height: vThumbHeight.current,
            width: scrollBarWidth
          }}
          onMouseDown={e => {
            e.stopPropagation();
            e.preventDefault();
            if (e.button === 0) {
              vStartMove(e);
            }
          }}
          onMouseUp={() => vEndMove()}
        />
        {/*Horizontal scrollbar*/}
        {hScroll.current && (
          <div
            className={styles.hScrollbar}
            style={{
              left: hLeft.current ?? 0,
              top: hTop.current,
              height: scrollBarWidth,
              width: hWidth.current
            }}
            onClick={e => hPositionTo(e)}
          />
        )}
        {/* Horizontal scrollbar thumb */}
        <div
          className={classnames(
            styles.hScrollbarThumb,
            hScroll.current && (pointed || uiService.dragging)
              ? styles.pointed
              : styles.unpointed
          )}
          style={{
            left: hThumbPos,
            top: hTop.current,
            height: scrollBarWidth,
            width: hThumbWidth.current ?? 0
          }}
          onMouseDown={e => {
            e.stopPropagation();
            e.preventDefault();
            if (e.button === 0) {
              hStartMove(e);
            }
          }}
          onMouseUp={() => hEndMove()}
        />
      </div>
    </>
  );
};
