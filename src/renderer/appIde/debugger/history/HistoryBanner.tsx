import type { HistoricalCpuInfo } from "@common/history/historyNavigation";
import { historyStepText } from "@common/history/historyNavigation";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import styles from "./HistoryBanner.module.scss";

/*
 * The history cursor's banners (`.plans/LITE_STEP_BACK_PLAN.md` D6, D7). Where a view shows the
 * past, its band says where; where a view reads memory, which lite step back leaves at the present,
 * its band says that. Both disappear when G4.4 makes memory historical (D14): the present band keys
 * off `memoryIsHistorical`, never off "a cursor is set".
 */

/** The interrupt that entered the routine, in the banner's words */
function enteredByText(info: HistoricalCpuInfo): string | undefined {
  if (info.enteredBy === "nmi") return "entered by NMI";
  if (info.enteredBy === "int") return `entered by IM ${info.enteredByMode ?? ""} interrupt`.replace("  ", " ");
  return undefined;
}

/** The CPU panel's band: where in the past the registers are from */
export const HistoryCpuBanner = ({ info }: { info: HistoricalCpuInfo }) => {
  const { ideCommandsService } = useAppServices();
  const entered = enteredByText(info);
  return (
    <div className={styles.band} role="status" aria-label="History cursor">
      <span className={styles.title}>History · step {historyStepText(info.position)}</span>
      <span className={styles.fact}>frame {info.frame.toLocaleString("en-US")}</span>
      {!info.memoryIsHistorical && <span className={styles.warning}>memory shows the present</span>}
      <span
        className={styles.link}
        role="button"
        title="Return to the present (history-present)"
        onClick={() => void ideCommandsService.executeCommand("history-present")}
      >
        Present
      </span>
      {(entered || info.haltRepeat !== undefined) && (
        <span className={styles.note}>
          {[entered, info.haltRepeat !== undefined ? `HALT ×${info.haltRepeat.toLocaleString("en-US")}` : undefined]
            .filter(Boolean)
            .join(" · ")}
        </span>
      )}
    </div>
  );
};
