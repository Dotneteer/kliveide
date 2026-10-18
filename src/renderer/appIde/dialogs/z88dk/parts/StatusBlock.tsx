import classnames from "classnames";

import { useT } from "@common/i18n/useT";
import { Icon } from "@renderer/controls/Icon";

import type { StatusViewModel } from "../Z88dkViewModel";
import styles from "../Z88dkIntegrationDialog.module.scss";
import { PathText } from "./PathText";
import { richText } from "./richText";

const BADGE_ICON = {
  passed: { iconName: "check", fill: "--status-success", testId: "z88dk-integrated-badge" },
  failed: { iconName: "warning", fill: "--status-error", testId: "z88dk-broken-badge" }
} as const;

const DETAIL_TEST_ID = {
  note: "z88dk-status-note",
  error: "z88dk-status-error",
  version: "z88dk-version"
} as const;

// --- The install Klive uses right now, as a readable sentence
export const StatusBlock = ({ status }: { status: StatusViewModel }) => {
  const t = useT();
  return (
    <div className={classnames(styles.row, styles.block)}>
      <span className={styles.label}>{t("dialog.z88dk.row.inUse")}</span>
      <div className={styles.blockValue}>
        {status.kind === "none" ? (
          <>
            <div className={styles.blockLine}>
              <span data-testid="z88dk-status">{status.text}</span>
            </div>
            <div className={styles.blockHint}>{status.hint}</div>
          </>
        ) : (
          <>
            <div
              className={classnames(styles.blockLine, {
                [styles.integrated]: status.badge === "passed",
                [styles.failed]: status.badge === "failed"
              })}
            >
              {status.badge !== "none" && (
                <span
                  className={styles.badge}
                  role="img"
                  aria-label={status.badgeLabel}
                  title={status.badgeTitle}
                  data-testid={BADGE_ICON[status.badge].testId}
                >
                  <Icon
                    iconName={BADGE_ICON[status.badge].iconName}
                    width={16}
                    height={16}
                    fill={BADGE_ICON[status.badge].fill}
                  />
                </span>
              )}
              <PathText testId="z88dk-root" value={status.root} fallback={t("dialog.z88dk.status.notResolved")} />
            </div>
            <div
              className={classnames(styles.blockHint, styles.twoLines, {
                [styles.integrated]: status.badge === "passed",
                [styles.failed]: status.badge === "failed"
              })}
              title={status.detailTitle}
            >
              {richText(t, "dialog.z88dk.status.headlineInScope", {
                headline: <span data-testid="z88dk-status">{status.headline}</span>,
                scope: <span data-testid="z88dk-scope">{status.scopeLabel}</span>
              })}
              <span className={styles.sep}>&middot;</span>
              <span
                className={status.detail.kind === "version" ? undefined : styles.messageText}
                data-testid={DETAIL_TEST_ID[status.detail.kind]}
              >
                {status.detail.text}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
