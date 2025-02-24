import styles from "./ScrollViewer.module.scss";
import React, { useEffect, useRef, useState } from "react";
import { OverlayScrollbarsComponent, OverlayScrollbarsComponentRef } from "overlayscrollbars-react";
import { useTheme } from "@renderer/theming/ThemeProvider";
import { AttachedShadow } from "../AttachedShadow";

export type ScrollViewerApi = {
  updateDims: () => void;
  getScrollTop: () => number;
  getScrollLeft: () => number;
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
}

const ScrollViewer: React.FC<Props> = ({
  children,
  style,
  allowHorizontal = true,
  allowVertical = true,
  thinScrollBar
}) => {
  const [pointed, setPointed] = useState(false);
  const [customTheme, setCustomTheme] = useState("");
  const [isScrolled, setIsScrolled] = useState(false);
  const themeService = useTheme();
  const osRef = useRef<OverlayScrollbarsComponentRef>(null);
  const parentElement = useRef(null);

  useEffect(() => {
    setCustomTheme(
      themeService.theme.tone === "dark"
        ? thinScrollBar
          ? "os-theme-dark-small"
          : "os-theme-dark"
        : thinScrollBar
          ? "os-theme-light-small"
          : "os-theme-light"
    );
  }, [themeService.theme]);

  const handleScroll = () => {
    const element = osRef.current?.osInstance().elements();
    if (element) {
      setIsScrolled(element.scrollOffsetElement.scrollTop > 0);
    }
  };

  return (
    <div
      ref={parentElement}
      className={styles.scrollViewer}
      style={style}
      onMouseDown={() => setPointed(true)}
      onMouseMove={() => setPointed(true)}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
    >
      <OverlayScrollbarsComponent
        ref={osRef}
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
