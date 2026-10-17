import classnames from "classnames";

import { useT } from "@common/i18n/useT";
import { Button } from "@renderer/controls/Button";
import Dropdown from "@renderer/controls/Dropdown";
import { Checkbox } from "@renderer/controls/Checkbox";

import type { SjasmplusIntent } from "../SjasmplusIntents";
import type { OnlineViewModel } from "../SjasmplusViewModel";
import styles from "../SjasmplusIntegrationDialog.module.scss";
import { PathText } from "./PathText";
import { Row } from "./Row";
import { richText } from "./richText";

type Props = {
  online: OnlineViewModel;
  disabled: boolean;
  dispatch: (intent: SjasmplusIntent) => void;
};

export const SourcePanelOnline = ({ online, disabled, dispatch }: Props) => {
  const t = useT();
  return online.kind === "unavailable" ? (
    // --- Upstream publishes Windows binaries and source archives only, so there
    // --- is nothing to download here. Explain and point at the repository.
    <>
      <Row label={t("dialog.sjasmplus.row.downloads")}>
        <span>{t("dialog.sjasmplus.online.windowsOnly")}</span>
      </Row>
      <div className={styles.steps}>
        <div>{t("dialog.sjasmplus.online.stepBuild")}</div>
        <div>
          {richText(t, "dialog.sjasmplus.online.stepSelect", {
            localExecutable: <em>{t("dialog.sjasmplus.source.local")}</em>
          })}
        </div>
      </div>
      <Row label={t("dialog.sjasmplus.row.project")}>
        <a
          className={styles.link}
          href={online.repositoryUrl}
          target="_blank"
          rel="noreferrer"
        >
          {online.repositoryLabel}
        </a>
      </Row>
      <div className={styles.spacer} />
    </>
  ) : (
    <>
      <Row label={t("dialog.sjasmplus.row.release")}>
        {/*
          * The app's `Dropdown`, not a native `<select>`.
          *
          * This dialog is the MVC pattern's reference implementation and was the last place still
          * using bare form controls, so a native select sat beside the app's own dropdowns looking
          * like neither. The swap waited on `Dropdown` gaining an `enabled` prop — these two
          * selects need to disable while a refresh is in flight, and the shared control had no way
          * to say so.
          */}
        <Dropdown
          testId="sjasmplus-release-select"
          ariaLabel={t("dialog.sjasmplus.online.releaseAriaLabel")}
          options={
            online.releases.length === 0
              ? [{ value: "", label: t("dialog.sjasmplus.online.noReleases") }]
              : online.releases
          }
          initialValue={online.selectedTag}
          enabled={!online.releaseSelectDisabled}
          onChanged={(tagName) => dispatch({ type: "releaseSelected", tagName })}
        />
        {/* --- The shared `Checkbox`, which associates its label with its input; the hand-rolled
            --- pair here did not, so it had no accessible name. */}
        <Checkbox
          label={t("dialog.sjasmplus.online.showPrereleases")}
          initialValue={online.includePrereleases}
          enabled={!online.prereleasesDisabled}
          onChange={(value) => dispatch({ type: "prereleasesToggled", value })}
        />
        <Button
          text={t("dialog.sjasmplus.button.refresh")}
          variant="secondary"
          disabled={online.refreshDisabled}
          clicked={() => dispatch({ type: "refreshReleasesRequested" })}
        />
      </Row>
      <Row label={t("dialog.sjasmplus.row.asset")}>
        <Dropdown
          testId="sjasmplus-asset-select"
          ariaLabel={t("dialog.sjasmplus.online.assetAriaLabel")}
          options={
            online.assets.length === 0 ? [{ value: "", label: t("dialog.sjasmplus.online.noAssets") }] : online.assets
          }
          initialValue={online.selectedAssetName}
          enabled={!online.assetSelectDisabled}
          onChanged={(name) => dispatch({ type: "assetSelected", name })}
        />
      </Row>
      <Row label={t("dialog.sjasmplus.row.folder")}>
        <Button
          text={t("dialog.sjasmplus.button.selectFolder")}
          variant="secondary"
          disabled={disabled}
          clicked={() => dispatch({ type: "selectDownloadFolderRequested" })}
        />
        <PathText
          testId="sjasmplus-download-folder"
          value={online.downloadFolder}
          fallback={t("dialog.sjasmplus.online.folderNotSelected")}
          muted
        />
        <span className={styles.pushRight}>
          <Button
            text={t("dialog.sjasmplus.button.download")}
          variant="secondary"
            disabled={!online.downloadEnabled}
            clicked={() => dispatch({ type: "downloadRequested" })}
          />
        </span>
      </Row>
      <Row label="GitHub">
        <span
          className={classnames(styles.messageText, { [styles.failed]: online.statusFailed })}
          data-testid="sjasmplus-release-status"
        >
          {online.statusText}
        </span>
      </Row>
      <div className={styles.spacer} />
    </>
  );
};
