import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import styles from "./ExecutionStateOverlay.module.scss";

type Props = {
  text: string;
  clicked?: () => void;
};

/**
 * Represents the overlay of the emulator's panel
 */
export const ExecutionStateOverlay = ({ text, clicked }: Props) => {
  const ref = useTooltipRef();

  if (text) {
    return (
      <div
        ref={ref}
        className={styles.stateOverlay}
        onClick={(e) => {
          e.stopPropagation();
          clicked?.();
        }}
      >
        <div className={styles.overlay}>{text}</div>
        <TooltipFactory
          refElement={ref.current}
          placement="top"
          showDelay={1000}
          content="Hide overlay (click to show again)"
        />
      </div>
    );
  } else {
    return null;
  }
};
