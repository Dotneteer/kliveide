import classnames from "classnames";
import { useRef } from "react";
import ScrollViewer, { ScrollViewerApi } from "@renderer/controls/ScrollViewer";
import { useInitialize } from "@renderer/core/useInitializeAsync";
import styles from "./Layout.module.scss";

type Props = {
  xclass?: string;
  children?: React.ReactNode;
  initialScrollPosition?: number;
  onScrolled?: (pos: number) => void;
};

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
