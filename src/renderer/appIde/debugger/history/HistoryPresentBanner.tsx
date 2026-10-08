import classnames from "classnames";

import { historyStepText } from "@common/history/historyNavigation";
import { useSelector } from "@renderer/core/RendererProvider";
import styles from "./HistoryBanner.module.scss";

/*
 * The "present" band (`.plans/LITE_STEP_BACK_PLAN.md` D6): its own module, with nothing but the
 * store behind it, so every memory-reading panel can show it without pulling in the IDE services.
 */

/**
 * The band of a view that reads memory or devices: they show the present while the cursor is in
 * the past (D6). Renders nothing at the present, or when memory is historical too.
 */
export const HistoryPresentBanner = ({ what = "Memory", plural = false }: { what?: string; plural?: boolean }) => {
  const position = useSelector((s) => s.emulatorState?.historyPosition);
  const historical = useSelector((s) => s.emulatorState?.historyMemoryIsHistorical);
  if (!position || historical) return null;
  return (
    <div className={classnames(styles.band, styles.present)} role="note">
      <span className={styles.warning}>
        {what} {plural ? "show" : "shows"} the present, not history step {historyStepText(position)}
      </span>
    </div>
  );
};
