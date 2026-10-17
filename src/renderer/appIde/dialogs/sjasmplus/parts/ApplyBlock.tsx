import classnames from "classnames";

import { useT } from "@common/i18n/useT";

import type { SjasmplusViewModel } from "../SjasmplusViewModel";
import styles from "../SjasmplusIntegrationDialog.module.scss";
import { PathText } from "./PathText";

// --- What Apply would save, with a fixed height so messages never resize the
// --- dialog.
export const ApplyBlock = ({ apply }: { apply: SjasmplusViewModel["apply"] }) => {
  const t = useT();
  return (
  <div className={classnames(styles.row, styles.block)}>
    <span className={styles.label}>{t("dialog.sjasmplus.row.toApply")}</span>
    <div className={styles.blockValue}>
      <div className={styles.blockLine}>
        {apply.candidatePath ? (
          <PathText testId="sjasmplus-candidate-path" value={apply.candidatePath} fallback="" />
        ) : (
          <span data-testid="sjasmplus-candidate-path">
            {t("dialog.sjasmplus.apply.nothingSelected")}
          </span>
        )}
      </div>
      <div
        className={classnames(styles.blockHint, styles.twoLines, {
          [styles.integrated]: apply.tone === "passed",
          [styles.failed]: apply.tone === "failed"
        })}
        role="status"
        title={apply.messageTitle}
      >
        <span data-testid="sjasmplus-validation">{apply.validationLabel}</span>
        <span className={styles.sep}>&middot;</span>
        <span className={styles.messageText} data-testid="sjasmplus-message">
          {apply.message}
        </span>
      </div>
    </div>
  </div>
  );
};
