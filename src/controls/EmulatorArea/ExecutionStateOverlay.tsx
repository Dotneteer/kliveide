import styles from "./ExecutionStateOverlay.module.scss";

type Props = {
    text: string;
    clicked?: () => void;
};

/**
 * Represents the overlay of the emulator's panel
 */
export const ExecutionStateOverlay = ({
    text, 
    clicked
}: Props) => {
    if (text) {
      return (
        <div className={styles.component} onClick={(e) => {
            e.stopPropagation();
            clicked?.();
        }}>
          <div className={styles.overlay} title="Hide overlay (click to show again)">
            {text}
          </div>
        </div>
      );
    } else {
      return null;
    }
  };
  