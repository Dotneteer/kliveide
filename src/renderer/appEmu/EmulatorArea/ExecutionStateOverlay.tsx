import styles from "./ExecutionStateOverlay.module.scss";
import { Tooltip, useTooltipId } from "@renderer/controls/Tooltip2";

type Props = {
  text: string;
  clicked?: () => void;
};

/**
 * Represents the overlay of the emulator's panel
 */
export const ExecutionStateOverlay = ({ text, clicked }: Props) => {
  const tooltipId = useTooltipId();

  if (text) {
    return (
      <div
        id={tooltipId.current}
        className={styles.stateOverlay}
        onClick={(e) => {
          e.stopPropagation();
          clicked?.();
        }}
      >
        <div className={styles.overlay}>{text}</div>
        <Tooltip
          anchorId={tooltipId.current}
          delayShow={2000}
          place="top"
          content="Hide overlay (click to show again)"
        />
      </div>
    );
  } else {
    return null;
  }
};
