import styles from "./ScrollViewer.module.scss";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OverlayScrollbarsComponent, OverlayScrollbarsComponentRef } from "overlayscrollbars-react";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { AttachedShadow } from "./AttachedShadow";
import classnames from "classnames";

/**
 * API exposed by the ScrollViewer component for programmatic control
 */
export type ScrollViewerApi = {
  /** Get the current vertical scroll position */
  getScrollTop: () => number;
  
  /** Get the current horizontal scroll position */
  getScrollLeft: () => number;
  
  /** Scroll to a specific vertical position */
  scrollToVertical: (pos: number) => void;
  
  /** Scroll to a specific horizontal position */
  scrollToHorizontal: (pos: number) => void;
};

/**
 * Props for the ScrollViewer component
 */
interface ScrollViewerProps {
  /** Content to be scrolled */
  children: React.ReactNode;
  
  /** Whether to use a thin scrollbar design */
  thinScrollBar?: boolean;
  
  /** Whether to enable horizontal scrolling */
  allowHorizontal?: boolean;
  
  /** Whether to enable vertical scrolling */
  allowVertical?: boolean;
  
  /** Custom CSS styles */
  style?: React.CSSProperties;
  
  /** Custom CSS class name */
  className?: string;
  
  /** Callback fired when the API is ready */
  apiLoaded?: (api: ScrollViewerApi) => void;
  
  /** Callback fired when content is scrolled, providing the current scroll position */
  onScrolled?: (pos: number) => void;
}

/**
 * ScrollViewer component provides custom scrolling functionality 
 * with theming support and scroll position tracking.
 */
const ScrollViewer: React.FC<ScrollViewerProps> = ({
  children,
  style,
  allowHorizontal = true,
  allowVertical = true,
  thinScrollBar,
  className,
  apiLoaded,
  onScrolled
}) => {
  // Component state
  const [scrollState, setScrollState] = useState({
    pointed: false,
    isScrolled: false
  });
  
  // Refs
  const osRef = useRef<OverlayScrollbarsComponentRef>(null);
  const parentElement = useRef<HTMLDivElement>(null);
  
  // Theme service
  const themeService = useTheme();
  
  // Derived values
  const customTheme = useMemo(() => {
    return themeService.theme.tone === "dark"
      ? thinScrollBar
        ? "os-theme-dark-small"
        : "os-theme-dark"
      : thinScrollBar
        ? "os-theme-light-small"
        : "os-theme-light";
  }, [themeService.theme.tone, thinScrollBar]);
  
  // Create and expose the API
  useEffect(() => {
    const osInstance = osRef.current?.osInstance?.();
    if (!osInstance) return;
    
    const api: ScrollViewerApi = {
      getScrollTop: () => osInstance.elements()?.scrollOffsetElement.scrollTop,
      getScrollLeft: () => osInstance.elements()?.scrollOffsetElement.scrollLeft,
      scrollToVertical: (pos: number) => 
        osInstance.elements().scrollOffsetElement.scrollTo({ top: pos }),
      scrollToHorizontal: (pos: number) => 
        osInstance.elements().scrollOffsetElement.scrollTo({ left: pos })
    };
    
    apiLoaded?.(api);
  }, [apiLoaded]);

  // Handle scroll events
  const handleScroll = useCallback(() => {
    const element = osRef.current?.osInstance()?.elements();
    if (element) {
      const scrollTop = element.scrollOffsetElement.scrollTop;
      setScrollState(prev => ({
        ...prev,
        isScrolled: scrollTop > 0
      }));
      onScrolled?.(scrollTop);
    }
  }, [onScrolled]);

  // Mouse event handlers for showing/hiding scrollbars
  const handleMousePointerPresent = useCallback(() => {
    setScrollState(prev => ({
      ...prev,
      pointed: true
    }));
  }, []);
  
  const handleMousePointerLeave = useCallback(() => {
    setScrollState(prev => ({
      ...prev,
      pointed: false
    }));
  }, []);

  // Scroll options
  const scrollOptions = useMemo(() => ({
    scrollbars: { 
      theme: scrollState.pointed ? customTheme : "os-theme-not-hovered" 
    },
    overflow: {
      x: allowHorizontal ? "scroll" as const : "hidden" as const,
      y: allowVertical ? "scroll" as const : "hidden" as const
    }
  }), [scrollState.pointed, customTheme, allowHorizontal, allowVertical]);

  return (
    <div
      ref={parentElement}
      className={classnames(styles.scrollViewer, className)}
      style={style}
      onMouseDown={handleMousePointerPresent}
      onMouseMove={handleMousePointerPresent}
      onMouseEnter={handleMousePointerPresent}
      onMouseLeave={handleMousePointerLeave}
      role="region"
      aria-label="Scrollable content"
    >
      <OverlayScrollbarsComponent
        ref={osRef}
        style={{ height: "100%" }}
        options={scrollOptions}
        events={{
          scroll: handleScroll
        }}
        defer
      >
        {children}
      </OverlayScrollbarsComponent>
      <AttachedShadow 
        parentElement={parentElement.current} 
        visible={scrollState.isScrolled} 
      />
    </div>
  );
};

export default ScrollViewer;
