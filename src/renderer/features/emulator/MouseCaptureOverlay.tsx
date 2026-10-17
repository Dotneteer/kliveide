import styles from "./MouseCaptureOverlay.module.scss";
import { useT } from "@common/i18n/useT";

type Props = {
  /** True while the screen holds the pointer lock. */
  captured: boolean;
  /** True just after the browser refused a capture - practically always the Esc lockout. */
  refused: boolean;
};

/**
 * The pill that tells the user what the mouse is doing, a sibling of `RecordingStateOverlay`.
 *
 * Both states earn their place. **Captured** has to name Esc, because while the lock is held the
 * pointer is invisible and the toolbar button is unclickable (every mouse event goes to the locked
 * element), so Esc is the only way out and nothing else on screen says so.
 *
 * **Refused** exists because of a rule in the Pointer Lock spec: a capture requested straight after
 * the user released one with Esc is rejected for about a second, "even if a transient activation is
 * available". So pressing Esc and reaching straight back for the toolbar button or Ctrl+M always
 * fails the first time. Saying so is the difference between a quirk and an app that looks broken.
 */
export const MouseCaptureOverlay = ({ captured, refused }: Props) => {
  const t = useT();
  if (!captured && !refused) return null;

  return (
    <div className={styles.mouseOverlay}>
      <div className={captured ? styles.captured : styles.refused}>
        <span>
          {captured
            ? t("panels.feature.emulator.mouseCaptured")
            : t("panels.feature.emulator.mouseCaptureRefused")}
        </span>
      </div>
    </div>
  );
};
