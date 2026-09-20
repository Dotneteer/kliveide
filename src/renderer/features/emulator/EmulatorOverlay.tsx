import { ExecutionStateOverlay } from "./ExecutionStateOverlay";
import { MouseCaptureOverlay } from "./MouseCaptureOverlay";
import { RecordingStateOverlay } from "./RecordingStateOverlay";
import styles from "./EmulatorPanel.module.scss";

type Props = {
  overlay: string | null;
  showOverlay: boolean;
  onDismiss: () => void;
  /** True while the screen holds the pointer lock. */
  mouseCaptured?: boolean;
  /** True just after a capture was refused, so the pill can say to click again. */
  mouseCaptureRefused?: boolean;
};

/**
 * The pills that float over the screen, stacked rather than each positioning itself.
 *
 * The mouse state arrives as props rather than from the store, unlike `RecordingStateOverlay`: the
 * refusal is a momentary hint owned by `useEmulatorMouse` and of no interest to anything outside
 * this panel. The *captured* flag does reach the store, because the toolbar button and the menu
 * need it - but it is written there by the same hook, so there is still only one source of truth.
 */
export const EmulatorOverlay = ({
  overlay,
  showOverlay,
  onDismiss,
  mouseCaptured = false,
  mouseCaptureRefused = false
}: Props) => (
  <div className={styles.overlayStack}>
    {showOverlay && <ExecutionStateOverlay text={overlay} clicked={onDismiss} />}
    <RecordingStateOverlay />
    <MouseCaptureOverlay captured={mouseCaptured} refused={mouseCaptureRefused} />
  </div>
);
