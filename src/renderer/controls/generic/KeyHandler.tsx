import React from "react";
import styles from "./KeyHandler.module.scss";
import classnames from "classnames";
import { useInitializeAsync } from "@renderer/core/useInitializeAsync";

type Props = {
  tabIndex?: number;
  children: React.ReactNode;
  onKey: (code: string) => void;
  xclass?: string;
  autofocus?: boolean;
};

export const KeyHandler = ({
  tabIndex = 0,
  children,
  onKey,
  xclass,
  autofocus
}: Props) => {
  const ref = React.useRef<HTMLDivElement>(null);

  useInitializeAsync(async () => {
    if (autofocus && ref.current) {
      setTimeout(() => ref.current.focus(), 20);
    }
  });

  return (
    <div
      ref={ref}
      className={classnames(styles.keyHandler, xclass)}
      tabIndex={tabIndex}
      onKeyDown={e => {
        onKey(e.code);
      }}
    >
      {children}
    </div>
  );
};
