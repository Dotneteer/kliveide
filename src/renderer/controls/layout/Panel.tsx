import classnames from "classnames";
import { useRef } from "react";
import ScrollViewer, { ScrollViewerApi } from "@renderer/controls/ScrollViewer";
import { useInitialize } from "@renderer/core/useInitializeAsync";
import styles from "./Layout.module.scss";

type Props = {
  /** Extra CSS class appended to the panel shell. */
  xclass?: string;
  /** Scrollable panel content. */
  children?: React.ReactNode;
  /** Initial vertical scroll offset restored after mount. */
  initialScrollPosition?: number;
  /** Receives vertical scroll offset changes. */
  onScrolled?: (pos: number) => void;
};

/**
 * Provides a scrollable content panel for dense renderer views.
 */
export const Panel = ({
  children,
  xclass,
  initialScrollPosition,
  onScrolled
}: Props) => {
  const scrollApi = useRef<ScrollViewerApi>(null);

  useInitialize(() => {
    if (scrollApi.current && initialScrollPosition !== undefined) {
      scrollApi.current.scrollToVertical(initialScrollPosition);
    }
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
