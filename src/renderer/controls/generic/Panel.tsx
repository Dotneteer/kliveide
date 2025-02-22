import styles from "./GeneralControls.module.scss";
import { useInitialize } from "@renderer/core/useInitializeAsync";
import classnames from "classnames";
import { useRef } from "react";
import { ScrollViewerApi, ScrollViewer } from "../ScrollViewer";

type PanelProps = {
  xclass?: string;
  children?: React.ReactNode;
  initialScrollPosition?: number;
  onScrolled?: (pos: number) => void;
};

// --- Represents a scrollable panel
export const Panel = ({
  children,
  xclass,
  initialScrollPosition,
  onScrolled
}: PanelProps) => {
  const scrollApi = useRef<ScrollViewerApi>(null);

  useInitialize(() => {
    if (scrollApi.current && initialScrollPosition !== undefined)
      scrollApi.current.scrollToVertical(initialScrollPosition);
  });

  return (
    <div className={classnames(styles.panel, xclass)}>
      <ScrollViewer
        onScrolled={pos => onScrolled?.(pos)}
        apiLoaded={api => (scrollApi.current = api)}
      >
        {children}
      </ScrollViewer>
    </div>
  );
};
