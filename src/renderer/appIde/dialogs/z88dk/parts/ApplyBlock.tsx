import classnames from "classnames";

import { useT } from "@common/i18n/useT";

import type { Z88dkViewModel } from "../Z88dkViewModel";
import styles from "../Z88dkIntegrationDialog.module.scss";
import { PathText } from "./PathText";

// --- What Apply would save, at a fixed height so messages never resize the dialog
export const ApplyBlock = ({ apply }: { apply: Z88dkViewModel["apply"] }) => {
  const t = useT();
  return (
    <div className={classnames(styles.row, styles.block)}>
      <span className={styles.label}>{t("dialog.z88dk.row.toApply")}</span>
      <div className={styles.blockValue}>
        <div className={styles.blockLine}>
          {apply.candidatePath ? (
            <PathText testId="z88dk-candidate-path" value={apply.candidatePath} fallback="" />
          ) : (
            <span data-testid="z88dk-candidate-path">{t("dialog.z88dk.apply.nothingSelected")}</span>
          )}
        </div>
        <div
          className={classnames(styles.blockHint, styles.twoLines, {
            [styles.integrated]: apply.tone === "passed",
            [styles.failed]: apply.tone === "failed",
            [styles.warning]: apply.tone === "warning"
          })}
          role="status"
          title={apply.messageTitle}
        >
          <span data-testid="z88dk-validation">{apply.validationLabel}</span>
          <span className={styles.sep}>&middot;</span>
          <span className={styles.messageText} data-testid="z88dk-message">
            {apply.message}
          </span>
        </div>
      </div>
    </div>
  );
};
