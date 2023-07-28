import { TooltipFactory } from "@/renderer/controls/Tooltip";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./ExecutionStateOverlay.module.scss";

type Props = {
  text: string;
  clicked?: () => void;
};

/**
 * Represents the overlay of the emulator's panel
 */
export const ExecutionStateOverlay = ({ text, clicked }: Props) => {
  const ref = useRef<HTMLDivElement>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setVersion(version + 1);
  }, [ref, text]);

  if (text) {
    return (
      <div
        ref={ref}
        className={styles.stateOverlay}
        onClick={e => {
          e.stopPropagation();
          clicked?.();
        }}
      >
        <div className={styles.overlay}>{text}</div>
        <TooltipFactory refElement={ref.current} placement='top' showDelay={2000}>
          Hide overlay (click to show again)
        </TooltipFactory>
      </div>
    );
  } else {
    return null;
  }
};
