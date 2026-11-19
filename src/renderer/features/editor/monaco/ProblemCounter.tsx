import { Icon } from "@controls/Icon";
import { IconButton } from "@controls/IconButton";
import { useT } from "@common/i18n/useT";
import styles from "./ProblemCounter.module.scss";

type Props = {
  errors: number;
  warnings: number;
  /** Moves to the previous (-1) or next (1) problem of the file */
  go: (direction: -1 | 1) => void;
};

/**
 * The open file's problem counter: its errors and warnings from the last background build, and
 * buttons to step through them (Monaco's own problem peek, as F8 / Shift+F8 do). Drawn in the
 * editor's top-right corner, and only while the file has a problem.
 */
export const ProblemCounter = ({ errors, warnings, go }: Props) => {
  const t = useT();
  if (errors + warnings === 0) return null;
  return (
    <div className={styles.problemCounter} role="status">
      {errors > 0 && (
        <span className={styles.count} title={t("panels.feature.editor.problems.errors", { count: errors })}>
          <Icon iconName="circle-x" width={13} height={13} fill="--status-error" />
          <span className={styles.errors}>{errors}</span>
        </span>
      )}
      {warnings > 0 && (
        <span className={styles.count} title={t("panels.feature.editor.problems.warnings", { count: warnings })}>
          <Icon iconName="triangle-alert" width={13} height={13} fill="--status-warning" />
          <span className={styles.warnings}>{warnings}</span>
        </span>
      )}
      <span className={styles.separator} />
      <IconButton
        iconName="chevron-up"
        iconSize={14}
        buttonWidth={18}
        buttonHeight={18}
        title={t("panels.feature.editor.problems.previous")}
        clicked={() => go(-1)}
      />
      <IconButton
        iconName="chevron-down"
        iconSize={14}
        buttonWidth={18}
        buttonHeight={18}
        title={t("panels.feature.editor.problems.next")}
        clicked={() => go(1)}
      />
    </div>
  );
};
