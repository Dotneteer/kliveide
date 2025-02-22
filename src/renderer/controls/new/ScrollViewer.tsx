import styles from "./ScrollViewer.module.scss";
import React, { useEffect, useState } from "react";
import { OverlayScrollbarsComponent } from "overlayscrollbars-react";
import { useTheme } from "@renderer/theming/ThemeProvider";

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
  const themeService = useTheme();

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

  return (
    <div
      className={styles.scrollViewer}
      style={style}
      onMouseDown={() => setPointed(true)}
      onMouseMove={() => setPointed(true)}
      onMouseEnter={() => setPointed(true)}
      onMouseLeave={() => setPointed(false)}
    >
      <OverlayScrollbarsComponent
        options={{
          scrollbars: { theme: pointed ? customTheme : "os-theme-not-hovered" },
          overflow: {
            x: allowHorizontal ? "scroll" : "hidden",
            y: allowVertical ? "scroll" : "hidden"
          }
        }}
      >
        {children}
      </OverlayScrollbarsComponent>
    </div>
  );
};

export default ScrollViewer;
