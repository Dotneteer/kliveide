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
  const [pointed, setPointed] = useState(false);
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
      onMouseDown={() => setPointed(true)}
      onMouseMove={() => setPointed(true)}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
    >
      <OverlayScrollbarsComponent
        ref={osRef}
        style={{ height: "100%" }}
        options={{
          scrollbars: { theme: pointed ? customTheme : "os-theme-not-hovered" },
          overflow: {
            x: allowHorizontal ? "scroll" : "hidden",
            y: allowVertical ? "scroll" : "hidden"
          }
        }}
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
