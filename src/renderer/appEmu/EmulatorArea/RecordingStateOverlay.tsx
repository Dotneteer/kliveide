import { useSelector } from "@renderer/core/RendererProvider";
import styles from "./RecordingStateOverlay.module.scss";

/**
 * Displays a floating pill below the ExecutionStateOverlay that shows the
 * current screen-recording state (armed / recording / paused).
 * Invisible when the state is idle.
 */
export const RecordingStateOverlay = () => {
  const recState = useSelector((s) => s.emulatorState?.screenRecordingState);

  if (!recState || recState === "idle") return null;

  const icon =
    recState === "armed" ? "\u25CF" : recState === "recording" ? "\u25CF" : "\u23F8";
  const text =
    recState === "armed"
      ? "Armed \u2013 recording starts when machine runs"
      : recState === "recording"
        ? "Recording..."
        : "Recording paused";

  return (
    <div className={styles.recordingOverlay}>
      <div className={styles[recState]}>
        <span className={styles.icon}>{icon}</span>
        <span>{text}</span>
      </div>
    </div>
  );
};
