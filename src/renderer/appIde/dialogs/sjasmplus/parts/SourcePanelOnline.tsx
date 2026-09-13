import classnames from "classnames";

import { Button } from "@renderer/controls/Button";
import Dropdown from "@renderer/controls/Dropdown";
import { Checkbox } from "@renderer/controls/Checkbox";

import type { SjasmplusIntent } from "../SjasmplusIntents";
import type { OnlineViewModel } from "../SjasmplusViewModel";
import styles from "../SjasmplusIntegrationDialog.module.scss";
import { PathText } from "./PathText";
import { Row } from "./Row";

type Props = {
  online: OnlineViewModel;
  disabled: boolean;
  dispatch: (intent: SjasmplusIntent) => void;
};

export const SourcePanelOnline = ({ online, disabled, dispatch }: Props) =>
  online.kind === "unavailable" ? (
    // --- Upstream publishes Windows binaries and source archives only, so there
    // --- is nothing to download here. Explain and point at the repository.
    <>
      <Row label="Downloads">
        <span>Windows binaries only — no build is published for this system.</span>
      </Row>
      <div className={styles.steps}>
        <div>1. Build SJASMPLUS from source (see INSTALL.md in the repository).</div>
        <div>
          2. Come back, choose <em>Local executable</em>, and select the binary you built.
        </div>
      </div>
      <Row label="Project">
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
      <Row label="Release">
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
          ariaLabel="SjasmPlus release"
          options={
            online.releases.length === 0
              ? [{ value: "", label: "No releases" }]
              : online.releases
          }
          initialValue={online.selectedTag}
          enabled={!online.releaseSelectDisabled}
          onChanged={(tagName) => dispatch({ type: "releaseSelected", tagName })}
        />
        {/* --- The shared `Checkbox`, which associates its label with its input; the hand-rolled
            --- pair here did not, so it had no accessible name. */}
        <Checkbox
          label="Show prereleases"
          initialValue={online.includePrereleases}
          enabled={!online.prereleasesDisabled}
          onChange={(value) => dispatch({ type: "prereleasesToggled", value })}
        />
        <Button
          text="Refresh"
          variant="secondary"
          disabled={online.refreshDisabled}
          clicked={() => dispatch({ type: "refreshReleasesRequested" })}
        />
      </Row>
      <Row label="Asset">
        <Dropdown
          testId="sjasmplus-asset-select"
          ariaLabel="SjasmPlus asset"
          options={
            online.assets.length === 0 ? [{ value: "", label: "No assets" }] : online.assets
          }
          initialValue={online.selectedAssetName}
          enabled={!online.assetSelectDisabled}
          onChanged={(name) => dispatch({ type: "assetSelected", name })}
        />
      </Row>
      <Row label="Folder">
        <Button
          text="Select folder..."
          variant="secondary"
          disabled={disabled}
          clicked={() => dispatch({ type: "selectDownloadFolderRequested" })}
        />
        <PathText
          testId="sjasmplus-download-folder"
          value={online.downloadFolder}
          fallback="Not selected"
          muted
        />
        <span className={styles.pushRight}>
          <Button
            text="Download..."
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
