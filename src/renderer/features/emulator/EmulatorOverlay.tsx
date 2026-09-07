import { ExecutionStateOverlay } from "./ExecutionStateOverlay";
import { RecordingStateOverlay } from "./RecordingStateOverlay";
import styles from "./EmulatorPanel.module.scss";

type Props = {
  overlay: string | null;
  showOverlay: boolean;
  onDismiss: () => void;
};

/** The pills that float over the screen, stacked rather than each positioning itself. */
export const EmulatorOverlay = ({ overlay, showOverlay, onDismiss }: Props) => (
  <div className={styles.overlayStack}>
    {showOverlay && <ExecutionStateOverlay text={overlay} clicked={onDismiss} />}
    <RecordingStateOverlay />
  </div>
);
