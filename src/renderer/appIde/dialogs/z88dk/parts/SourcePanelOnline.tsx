import classnames from "classnames";

import { useT } from "@common/i18n/useT";
import { Button } from "@renderer/controls/Button";
import Dropdown from "@renderer/controls/Dropdown";
import { Checkbox } from "@renderer/controls/Checkbox";

import type { Z88dkIntent } from "../Z88dkIntents";
import type { OnlineViewModel } from "../Z88dkViewModel";
import styles from "../Z88dkIntegrationDialog.module.scss";
import { PathText } from "./PathText";
import { Row } from "./Row";
import { richText } from "./richText";

type Props = {
  online: OnlineViewModel;
  dispatch: (intent: Z88dkIntent) => void;
};

export const SourcePanelOnline = ({ online, dispatch }: Props) => {
  const t = useT();
  if (online.kind === "unavailable") {
    // --- No Linux binary is published: say how to get z88dk instead (§4.1)
    return (
      <>
        <Row label={t("dialog.z88dk.row.downloads")}>
          <span data-testid="z88dk-no-download">{t("dialog.z88dk.online.noBinary")}</span>
        </Row>
        <div className={styles.steps}>
          <div>{t("dialog.z88dk.online.stepPackage")}</div>
          <div>
            {richText(t, "dialog.z88dk.online.stepBuild", {
              guide: (
                <a className={styles.link} href={online.buildUrl} target="_blank" rel="noreferrer">
                  {t("dialog.z88dk.online.buildGuide")}
                </a>
              )
            })}
          </div>
          <div>
            {richText(t, "dialog.z88dk.online.stepSelect", {
              local: <em>{t("dialog.z88dk.source.local")}</em>
            })}
          </div>
        </div>
        <Row label={t("dialog.z88dk.row.project")}>
          <a className={styles.link} href={online.releasesUrl} target="_blank" rel="noreferrer">
            {online.releasesLabel}
          </a>
        </Row>
        <div className={styles.spacer} />
      </>
    );
  }

  return (
    <>
      <Row label={t("dialog.z88dk.row.release")}>
        <Dropdown
          testId="z88dk-release-select"
          ariaLabel={t("dialog.z88dk.online.releaseAriaLabel")}
          options={online.releases.length === 0 ? [{ value: "", label: t("dialog.z88dk.online.noReleases") }] : online.releases}
          initialValue={online.selectedTag}
          enabled={!online.releaseSelectDisabled}
          onChanged={(tagName) => dispatch({ type: "releaseSelected", tagName })}
        />
        <Checkbox
          label={t("dialog.z88dk.online.showOlder")}
          initialValue={online.showOlder}
          enabled={!online.showOlderDisabled}
          onChange={(value) => dispatch({ type: "showOlderToggled", value })}
        />
        <Button
          text={t("dialog.z88dk.button.refresh")}
          variant="secondary"
          disabled={online.refreshDisabled}
          clicked={() => dispatch({ type: "refreshReleasesRequested" })}
        />
      </Row>
      <Row label={t("dialog.z88dk.row.asset")}>
        <Dropdown
          testId="z88dk-asset-select"
          ariaLabel={t("dialog.z88dk.online.assetAriaLabel")}
          options={online.assets.length === 0 ? [{ value: "", label: t("dialog.z88dk.online.noAssets") }] : online.assets}
          initialValue={online.selectedAssetName}
          enabled={!online.assetSelectDisabled}
          onChanged={(name) => dispatch({ type: "assetSelected", name })}
        />
      </Row>
      <Row label={t("dialog.z88dk.row.downloadTo")}>
        <Button
          text={t("dialog.z88dk.button.selectFolder")}
          variant="secondary"
          disabled={online.folderDisabled}
          clicked={() => dispatch({ type: "selectDownloadFolderRequested" })}
        />
        <PathText
          testId="z88dk-download-folder"
          value={online.downloadFolder}
          fallback={t("dialog.z88dk.online.folderNotSelected")}
          muted
        />
        <span className={styles.pushRight}>
          <Button
            text={t("dialog.z88dk.button.download")}
            variant="secondary"
            disabled={!online.downloadEnabled}
            clicked={() => dispatch({ type: "downloadRequested" })}
          />
        </span>
      </Row>
      <Row label={t("dialog.z88dk.row.progress")}>
        {online.progress ? (
          <div className={styles.progressRow} data-testid="z88dk-progress">
            <div
              className={styles.progressTrack}
              role="progressbar"
              aria-label={online.progress.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={online.progress.percent}
            >
              {online.progress.percent === undefined ? (
                <div className={styles.progressIndeterminate} />
              ) : (
                <div className={styles.progressFill} style={{ width: `${online.progress.percent}%` }} />
              )}
            </div>
            <span className={styles.progressLabel} data-testid="z88dk-progress-label">
              {online.progress.label}
            </span>
            <Button
              text={t("common.button.cancel")}
              variant="secondary"
              disabled={!online.progress.cancelEnabled}
              clicked={() => dispatch({ type: "cancelDownloadRequested" })}
            />
          </div>
        ) : (
          <span className={styles.muted}>{t("dialog.z88dk.online.noDownload")}</span>
        )}
      </Row>
      <Row label="GitHub">
        <span
          className={classnames(styles.messageText, { [styles.failed]: online.statusFailed })}
          data-testid="z88dk-release-status"
        >
          {online.statusText}
        </span>
      </Row>
      <div className={styles.spacer} />
    </>
  );
};
