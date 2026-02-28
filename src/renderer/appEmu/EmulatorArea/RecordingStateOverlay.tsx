import { useEffect, useState } from "react";
import { useSelector } from "@renderer/core/RendererProvider";
import styles from "./RecordingStateOverlay.module.scss";

/**
 * Displays a floating pill below the ExecutionStateOverlay that shows the
 * current screen-recording state (armed / recording / paused).
 * Invisible when the state is idle.
 */
export const RecordingStateOverlay = () => {
  const recState = useSelector((s) => s.emulatorState?.screenRecordingState);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (recState !== "recording") {
      // Preserve elapsed while paused so the count continues on resume;
      // only reset when going back to armed or idle.
      if (recState !== "paused") setElapsed(0);
      return;
    }
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recState]);

  if (!recState || recState === "idle") return null;

  const icon =
    recState === "armed" ? "\u25CF" : recState === "recording" ? "\u25CF" : "\u23F8";

  const mins = Math.floor(elapsed / 60).toString().padStart(2, "0");
  const secs = (elapsed % 60).toString().padStart(2, "0");
  const timerSuffix = recState === "recording" && elapsed > 0 ? ` ${mins}:${secs}` : "";

  const text =
    recState === "armed"
      ? "Armed \u2013 recording starts when machine runs"
      : recState === "recording"
        ? `Recording...${timerSuffix}`
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
