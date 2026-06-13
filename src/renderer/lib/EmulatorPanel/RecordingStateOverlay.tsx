import { useEffect, useState } from "react";
import type { ScreenRecordingState } from "../../../common/state/AppState";
import { useSharedState } from "../../shared-store";
import styles from "./RecordingStateOverlay.module.scss";

export const RecordingStateOverlay = () => {
  const sharedState = useSharedState();
  const recState: ScreenRecordingState | undefined = sharedState.emulatorState?.screenRecordingState;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (recState !== "recording") {
      if (recState !== "paused") {
        setElapsed(0);
      }
      return;
    }
    const interval = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [recState]);

  if (!recState || recState === "idle") {
    return null;
  }

  const icon = recState === "paused" ? "||" : "●";
  const mins = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const secs = (elapsed % 60).toString().padStart(2, "0");
  const timerSuffix = recState === "recording" && elapsed > 0 ? ` ${mins}:${secs}` : "";
  const text =
    recState === "armed"
      ? "Ready - recording starts when machine runs"
      : recState === "recording"
        ? `Recording...${timerSuffix}`
        : "Recording paused";

  return (
    <div className={styles.recordingOverlay}>
      <div className={`${styles.pill} ${styles[recState]}`}>
        <span className={styles.icon}>{icon}</span>
        <span>{text}</span>
      </div>
    </div>
  );
};
