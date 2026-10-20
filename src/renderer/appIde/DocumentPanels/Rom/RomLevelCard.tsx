import { useT } from "@common/i18n/useT";
import classnames from "classnames";
import { Icon } from "@renderer/controls/Icon";
import styles from "./RomLevelCard.module.scss";

/** The levels the card explains (README §5.6); the tool measures up to 2, and 3 is not a goal. */
const LEVELS = [1, 2, 3] as const;

type Props = {
  /**
   * `legend`: what the levels mean, nothing measured (the Completeness column head).
   * `page`: one page's measured level. `file`: the whole file - its lowest page level and the
   * level it records.
   */
  kind: "legend" | "page" | "file";
  page?: number;
  measured?: number;
  recorded?: number;
  /** Call and jump targets without a label: what level 1 still needs. */
  unlabelled?: number;
  /** Labels without a synopsis: what level 2 still needs. */
  withoutSynopsis?: number;
  /** A line under the title, for what the anchor itself does (the readiness chip's). */
  note?: string;
};

/**
 * The content of the level hover card in the ROM annotation editor: the three levels, each marked
 * reached, next or not reached when something was measured, with what is still missing for the
 * first two.
 */
export const RomLevelCard = ({
  kind,
  page,
  measured,
  recorded,
  unlabelled,
  withoutSynopsis,
  note
}: Props) => {
  const t = useT();
  const level = kind === "legend" ? undefined : (measured ?? 0);
  const title =
    kind === "legend"
      ? t("panels.rom.levelCard.legendTitle")
      : kind === "page"
        ? t("panels.rom.levelCard.pageTitle", { page: page ?? 0, level: level ?? 0 })
        : t("panels.rom.levelCard.fileTitle", { level: level ?? 0 });
  const aside =
    kind === "legend"
      ? undefined
      : kind === "page"
        ? t("panels.rom.levelCard.measured")
        : t("panels.rom.levelCard.measuredRecords", { measured: level ?? 0, recorded: recorded ?? 0 });

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        {aside && <span className={styles.aside}>{aside}</span>}
      </div>
      {note && <div className={styles.note}>{note}</div>}
      {LEVELS.map((n) => {
        const state =
          level === undefined
            ? "legend"
            : n <= level
              ? "reached"
              : n === level + 1 && n <= 2
                ? "next"
                : "notReached";
        const count =
          level === undefined ? undefined : n === 1 ? unlabelled : n === 2 ? withoutSynopsis : undefined;
        return (
          <div
            key={n}
            className={classnames(styles.level, { [styles.current]: level !== undefined && n === level })}
            data-state={state}
          >
            <span className={classnames(styles.mark, styles[state])}>
              {state === "reached" ? (
                <Icon iconName="check" width={14} height={14} fill="currentColor" />
              ) : state === "legend" ? (
                <span className={styles.number}>{n}</span>
              ) : (
                <Icon iconName="circle-large-outline" width={12} height={12} fill="currentColor" />
              )}
            </span>
            <span className={styles.text}>
              <span className={styles.name}>{t("panels.rom.levelCard.levelName", { level: n })}</span>{" "}
              {n === 1
                ? t("panels.rom.levelCard.rule1")
                : n === 2
                  ? t("panels.rom.levelCard.rule2")
                  : t("panels.rom.levelCard.rule3")}
              {count !== undefined && (
                <span className={classnames(styles.count, { [styles.countNext]: state === "next" })}>
                  {n === 1
                    ? t("panels.rom.levelCard.unlabelled", { count })
                    : t("panels.rom.levelCard.withoutSynopsis", { count })}
                </span>
              )}
            </span>
          </div>
        );
      })}
      <div className={styles.footer}>{t("panels.rom.levelCard.footer")}</div>
    </div>
  );
};
