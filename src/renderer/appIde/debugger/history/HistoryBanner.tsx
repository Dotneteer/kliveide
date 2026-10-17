import type { HistoricalCpuInfo } from "@common/history/historyNavigation";
import { historyStepText } from "@common/history/historyNavigation";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useT, type TFunction } from "@common/i18n/useT";
import styles from "./HistoryBanner.module.scss";

/*
 * The history cursor's banners (`.plans/LITE_STEP_BACK_PLAN.md` D6, D7). Where a view shows the
 * past, its band says where; where a view reads memory, which lite step back leaves at the present,
 * its band says that. Both disappear when G4.4 makes memory historical (D14): the present band keys
 * off `memoryIsHistorical`, never off "a cursor is set".
 */

/** The interrupt that entered the routine, in the banner's words */
function enteredByText(t: TFunction, info: HistoricalCpuInfo): string | undefined {
  if (info.enteredBy === "nmi") return t("panels.side.historyCpu.enteredByNmi");
  if (info.enteredBy === "int") {
    return info.enteredByMode === undefined
      ? t("panels.side.historyCpu.enteredByInterrupt")
      : t("panels.side.historyCpu.enteredByImInterrupt", { mode: info.enteredByMode });
  }
  return undefined;
}

/** The CPU panel's band: where in the past the registers are from */
export const HistoryCpuBanner = ({ info }: { info: HistoricalCpuInfo }) => {
  const t = useT();
  const { ideCommandsService } = useAppServices();
  const entered = enteredByText(t, info);
  return (
    <div className={styles.band} role="status" aria-label={t("panels.side.historyCpu.label")}>
      <span className={styles.title}>{t("panels.side.historyCpu.title", { step: historyStepText(info.position) })}</span>
      <span className={styles.fact}>{t("panels.side.historyCpu.frame", { frame: info.frame.toLocaleString("en-US") })}</span>
      {!info.memoryIsHistorical && <span className={styles.warning}>{t("panels.side.historyCpu.memoryPresent")}</span>}
      <span
        className={styles.link}
        role="button"
        title={t("panels.side.historyCpu.presentTooltip")}
        onClick={() => void ideCommandsService.executeCommand("history-present")}
      >
        {t("panels.side.historyCpu.present")}
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
