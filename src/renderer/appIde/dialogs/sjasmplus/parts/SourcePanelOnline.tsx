import classnames from "classnames";

import { Button } from "@renderer/controls/Button";

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
        <select
          className={styles.selectBox}
          value={online.selectedTag}
          disabled={online.releaseSelectDisabled}
          onChange={(event) => dispatch({ type: "releaseSelected", tagName: event.target.value })}
          data-testid="sjasmplus-release-select"
        >
          {online.releases.length === 0 && <option value="">No releases</option>}
          {online.releases.map((release) => (
            <option key={release.value} value={release.value}>
              {release.label}
            </option>
          ))}
        </select>
        <label className={styles.option}>
          <input
            type="checkbox"
            checked={online.includePrereleases}
            disabled={online.prereleasesDisabled}
            onChange={(event) =>
              dispatch({ type: "prereleasesToggled", value: event.target.checked })
            }
          />
          Show prereleases
        </label>
        <Button
          text="Refresh"
          disabled={online.refreshDisabled}
          clicked={() => dispatch({ type: "refreshReleasesRequested" })}
        />
      </Row>
      <Row label="Asset">
        <select
          className={styles.selectBox}
          value={online.selectedAssetName}
          disabled={online.assetSelectDisabled}
          onChange={(event) => dispatch({ type: "assetSelected", name: event.target.value })}
          data-testid="sjasmplus-asset-select"
        >
          {online.assets.length === 0 && <option value="">No assets</option>}
          {online.assets.map((asset) => (
            <option key={asset.value} value={asset.value}>
              {asset.label}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Folder">
        <Button
          text="Select folder..."
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
