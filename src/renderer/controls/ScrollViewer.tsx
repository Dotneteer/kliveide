import styles from "./ScrollViewer.module.scss";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { OverlayScrollbarsComponent, OverlayScrollbarsComponentRef } from "overlayscrollbars-react";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { AttachedShadow } from "./AttachedShadow";
import classnames from "classnames";

export type ScrollViewerApi = {
  getScrollTop: () => number;
  getScrollLeft: () => number;
  getClientWidth: () => number;
  scrollToVertical: (pos: number) => void;
  scrollToHorizontal: (pos: number) => void;
};

interface Props {
  children: React.ReactNode;
  thinScrollBar?: boolean;
  allowHorizontal?: boolean;
  allowVertical?: boolean;
  style?: React.CSSProperties;
  className?: string;
  apiLoaded?: (api: ScrollViewerApi) => void;
  onScrolled?: (pos: number) => void;
}

const ScrollViewer: React.FC<Props> = ({
  children,
  style,
  allowHorizontal = true,
  allowVertical = true,
  thinScrollBar,
  className,
  apiLoaded,
  onScrolled
}) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const themeService = useTheme();
  const osRef = useRef<OverlayScrollbarsComponentRef>(null);
  const parentElement = useRef<HTMLDivElement | null>(null);

  const customTheme = useMemo(
    () =>
      themeService.theme.tone === "dark"
        ? thinScrollBar
          ? "os-theme-dark-small"
          : "os-theme-dark"
        : thinScrollBar
          ? "os-theme-light-small"
          : "os-theme-light",
    [themeService.theme, thinScrollBar]
  );

  /*
   * Auto-hide is the library's, not ours.
   *
   * This used to be a `pointed` React state set from `onMouseEnter`/`onMouseMove`/`onMouseDown` and
   * cleared from `onMouseLeave`, feeding a second theme (`os-theme-not-hovered`) whose only job was
   * `--os-handle-bg: transparent`. Three things were wrong with that, and all three are fixed by
   * simply asking OverlayScrollbars to do what it already knows how to do:
   *
   *  - **It could stick.** React synthesises `onMouseLeave` from `mouseout` at the root container,
   *    and a pointer does not always leave an element by a path that produces one. When it did not
   *    arrive, `pointed` stayed `true` and the scrollbar stayed painted until the next enter/leave
   *    pair. The library tracks its own pointer state instead.
   *  - **It could not fade.** Swapping the handle's colour to `transparent` is an instant change of
   *    a custom property. The library's auto-hide toggles a class the stylesheet transitions, so
   *    the bar fades out over 150ms and back in on approach.
   *  - **It re-rendered this subtree on every mouse move.** `onMouseMove` called `setPointed(true)`
   *    unconditionally, so every pointer move over a sidebar panel re-rendered the panel's whole
   *    content tree.
   *
   * `autoHideSuspend: false` keeps the bar hidden until the pointer arrives; left at its default
   * (`true`) the library holds every scrollbar visible until the first scroll, which is the state
   * the panels used to sit in.
   */
  const options = useMemo(
    () =>
      ({
        scrollbars: {
          theme: customTheme,
          autoHide: "leave",
          /*
           * 100ms, not the library's 1300ms default (and not the 300ms first tried here).
           *
           * The delay runs *before* the 150ms fade, so it is the whole of the "why is that still
           * there" feeling: at 300ms the bar was measurably still on screen 470ms after the pointer
           * left, which is long enough to read as the old stuck-scrollbar bug even though it was
           * hiding correctly. 100ms keeps the bar from flickering when the pointer clips a corner
           * and settles the whole exit inside ~265ms. Measured in the running app, not guessed.
           */
          autoHideDelay: 100,
          autoHideSuspend: false
        },
        overflow: {
          x: allowHorizontal ? "scroll" : "hidden",
          y: allowVertical ? "scroll" : "hidden"
        }
      }) as const,
    [customTheme, allowHorizontal, allowVertical]
  );

  useEffect(() => {
    let cancelled = false;
    let retryHandle: ReturnType<typeof setTimeout> | undefined;
    let retryCount = 0;

    const publishApi = (): boolean => {
      if (cancelled || !osRef.current?.osInstance?.()) return false;
      const api: ScrollViewerApi = {
        getScrollTop: () => osRef.current?.osInstance()?.elements()?.scrollOffsetElement.scrollTop,
        getScrollLeft: () =>
          osRef.current?.osInstance()?.elements()?.scrollOffsetElement.scrollLeft,
        getClientWidth: () =>
          osRef.current?.osInstance()?.elements()?.scrollOffsetElement.clientWidth,
        scrollToVertical: (pos: number) =>
          osRef.current?.osInstance()?.elements().scrollOffsetElement.scrollTo({ top: pos }),
        scrollToHorizontal: (pos: number) =>
          osRef.current?.osInstance()?.elements().scrollOffsetElement.scrollTo({ left: pos })
      };
      apiLoaded?.(api);
      return true;
    };

    const retryPublishApi = () => {
      if (publishApi() || retryCount >= 20) return;
      retryCount++;
      retryHandle = setTimeout(retryPublishApi, 25);
    };

    retryPublishApi();

    return () => {
      cancelled = true;
      if (retryHandle) {
        clearTimeout(retryHandle);
      }
    };
  }, [apiLoaded]);

  useEffect(() => {
    if (!allowHorizontal || allowVertical) return;
    const element = parentElement.current;
    if (!element) return;

    const handleHorizontalWheel = (event: WheelEvent) => {
      const scrollElement = osRef.current?.osInstance()?.elements()?.scrollOffsetElement;
      if (!scrollElement) return;

      const delta =
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (!delta) return;

      event.preventDefault();
      event.stopPropagation();
      scrollElement.scrollLeft += delta;
      if (scrollElement.scrollTop !== 0) {
        scrollElement.scrollTop = 0;
      }
    };

    element.addEventListener("wheel", handleHorizontalWheel, { passive: false });
    return () => {
      element.removeEventListener("wheel", handleHorizontalWheel);
    };
  }, [allowHorizontal, allowVertical]);

  const handleScroll = () => {
    const element = osRef.current?.osInstance().elements();
    if (element) {
      const scrollElement = element.scrollOffsetElement;
      if (!allowVertical && scrollElement.scrollTop !== 0) {
        scrollElement.scrollTop = 0;
      }
      const scrollTop = allowVertical ? scrollElement.scrollTop : 0;
      setIsScrolled(scrollTop > 0);
      onScrolled?.(scrollTop);
    }
  };

  return (
    <div
      ref={parentElement}
      className={classnames(styles.scrollViewer, className)}
      style={style}
    >
      <OverlayScrollbarsComponent
        ref={osRef}
        style={{ height: "100%" }}
        options={options}
        events={{
          scroll: handleScroll
        }}
        defer
      >
        {children}
      </OverlayScrollbarsComponent>
      <AttachedShadow parentElement={parentElement.current} visible={isScrolled} />
    </div>
  );
};

export default ScrollViewer;
