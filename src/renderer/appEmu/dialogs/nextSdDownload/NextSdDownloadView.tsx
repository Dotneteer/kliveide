import { useT } from "@common/i18n/useT";
import { Button } from "@renderer/controls/Button";

import type { NextSdDownloadIntent } from "./NextSdDownloadIntents";
import type { NextSdDownloadViewModel } from "./NextSdDownloadViewModel";
import styles from "./NextSdDownloadDialog.module.scss";

export type NextSdDownloadViewProps = {
  vm: NextSdDownloadViewModel;
  dispatch: (intent: NextSdDownloadIntent) => void;
};

/** The dialog body: renders the view model and reports what the user did */
export const NextSdDownloadView = ({ vm, dispatch }: NextSdDownloadViewProps) => {
  const t = useT();
  return (
    <div className={styles.body}>
      <div className={styles.intro} data-testid="next-sd-intro">
        {vm.intro}
      </div>

      <div className={styles.progressRow} data-testid="next-sd-progress">
        <div
          className={styles.progressTrack}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={vm.progress.percent}
        >
          <i className={styles.progressFill} style={{ width: `${vm.progress.percent}%` }} />
        </div>
        <span className={styles.progressLabel} role="status">
          {vm.progress.text}
        </span>
      </div>

      {vm.error && (
        <div className={styles.error} role="alert" data-testid="next-sd-error">
          <span>{vm.error.text}</span>
          {vm.error.detail && <span className={styles.detail}>{vm.error.detail}</span>}
        </div>
      )}

      <div className={styles.url}>
        <span className={styles.muted}>{t("dialog.nextSdDownload.urlLabel")}</span>
        <span className={styles.urlText} title={vm.url.text} data-testid="next-sd-url">
          {vm.url.text}
        </span>
        <Button text={vm.url.copyLabel} variant="secondary" clicked={() => dispatch({ type: "copyUrlRequested" })} />
      </div>
    </div>
  );
};
