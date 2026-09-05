import classnames from "classnames";

import { Icon } from "@renderer/controls/Icon";

import type { StatusViewModel } from "../SjasmplusViewModel";
import styles from "../SjasmplusIntegrationDialog.module.scss";
import { PathText } from "./PathText";

const BADGE_ICON = {
  passed: { iconName: "check", fill: "--color-secondary-label", testId: "sjasmplus-integrated-badge" },
  failed: { iconName: "warning", fill: "--console-ansi-bright-red", testId: "sjasmplus-broken-badge" }
} as const;

const DETAIL_TEST_ID = {
  note: "sjasmplus-status-note",
  error: "sjasmplus-status-error",
  version: "sjasmplus-version"
} as const;

// --- What Klive uses right now, as a readable sentence.
export const StatusBlock = ({ status }: { status: StatusViewModel }) => (
  <div className={classnames(styles.row, styles.block)}>
    <span className={styles.label}>In use</span>
    <div className={styles.blockValue}>
      {status.kind === "none" ? (
        <>
          <div className={styles.blockLine}>
            <span data-testid="sjasmplus-status">{status.text}</span>
          </div>
          <div className={styles.blockHint}>{status.hint}</div>
        </>
      ) : (
        <>
          {/* --- The highlight is earned by the check, not by the presence of a
              --- setting, so both the badge and the color follow one verdict. */}
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
            <PathText
              testId="sjasmplus-executable-path"
              value={status.executablePath}
              fallback="Not resolved"
            />
          </div>
          <div
            className={classnames(styles.blockHint, styles.twoLines, {
              [styles.integrated]: status.badge === "passed",
              [styles.failed]: status.badge === "failed"
            })}
            title={status.detailTitle}
          >
            <span data-testid="sjasmplus-status">{status.headline}</span> in{" "}
            <span data-testid="sjasmplus-scope">{status.scopeLabel}</span>
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
