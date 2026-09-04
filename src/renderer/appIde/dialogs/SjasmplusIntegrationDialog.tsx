import { get } from "lodash";
import classnames from "classnames";
import { ReactNode, useCallback, useEffect, useState } from "react";

import { Modal } from "@controls/Modal";
import { DialogForm } from "@renderer/controls/DialogForm";
import type { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import { useDialogs } from "@renderer/controls/overlay/DialogProvider";
import { useSelector } from "@renderer/core/RendererProvider";
import { Button } from "@renderer/controls/Button";
import { Icon } from "@renderer/controls/Icon";
import { useMainApi } from "@renderer/core/MainApi";
import type {
  SjasmplusIntegrationScope,
  SjasmplusProbeResult,
  SjasmplusRelease,
  SjasmplusReleaseAsset,
  SjasmplusReleaseListResult
} from "@common/messaging/SjasmplusIntegration";
import {
  SJASMP_EXECUTABLE_PATH,
  SJASMP_INSTALL_FOLDER,
  SJASMP_VERSION
} from "@main/sjasmp-integration/sjasmp-config";
import styles from "./SjasmplusIntegrationDialog.module.scss";

export type SjasmplusIntegrationDialogResult = "close";

type Props = {
  onClose: (result: SjasmplusIntegrationDialogResult) => void;
};

type SettingsScope = "project" | "user" | "none";
type SetupMode = "local" | "online";
type BusyState = "probe" | "download" | "validate" | "apply" | undefined;

const DISPLAYED_RELEASE_LIMIT = 20;
const SJASMPLUS_REPOSITORY_URL = "https://github.com/z00m128/sjasmplus";

type SjasmplusStatus = {
  source: SettingsScope;
  installFolder?: string;
  executablePath?: string;
  version?: string;
};

export const SjasmplusIntegrationDialog = ({ onClose }: Props) => {
  const mainApi = useMainApi();
  const dialogs = useDialogs();
  const { status, isKliveProject, isWindows } = useSelector((state) => ({
    status: getSjasmplusStatus(
      state.userSettings,
      state.projectSettings,
      state.isWindows ?? false
    ),
    isKliveProject: state.project?.isKliveProject ?? false,
    isWindows: state.isWindows ?? false
  }));
  const [setupMode, setSetupMode] = useState<SetupMode>("local");
  const initialScope: SjasmplusIntegrationScope =
    status.source === "project" ? "project" : "user";
  const [scope, setScope] = useState<SjasmplusIntegrationScope>(initialScope);
  const [candidate, setCandidate] = useState<SjasmplusProbeResult | undefined>(
    status.source === "none"
      ? undefined
      : {
          ok: true,
          installFolder: status.installFolder,
          executablePath: status.executablePath,
          version: status.version
        }
  );
  const [pathSuggestions, setPathSuggestions] = useState<SjasmplusProbeResult[]>([]);
  const [includePrereleases, setIncludePrereleases] = useState(false);
  const [releaseList, setReleaseList] = useState<SjasmplusReleaseListResult | undefined>();
  const [releaseBusy, setReleaseBusy] = useState(false);
  const [releaseError, setReleaseError] = useState("");
  const [selectedReleaseTag, setSelectedReleaseTag] = useState("");
  const [selectedAssetName, setSelectedAssetName] = useState("");
  const [downloadFolder, setDownloadFolder] = useState("");
  const [validation, setValidation] = useState<SjasmplusProbeResult | undefined>();
  const [busy, setBusy] = useState<BusyState>();
  const [message, setMessage] = useState<string>("");

  const canUseProjectScope = isKliveProject;
  // --- Anything Apply would still change: a different executable than the one in
  // --- use, or the same one destined for a different scope.
  const hasPendingChanges =
    !!candidate?.executablePath &&
    (candidate.executablePath !== status.executablePath || scope !== initialScope);
  const canValidate = !!candidate?.executablePath && !busy;
  const canApply =
    !!validation?.ok && !!candidate?.installFolder && !!candidate?.executablePath && !busy;

  const updateReleaseSelection = useCallback((result: SjasmplusReleaseListResult): void => {
    setReleaseList(result);
    const releaseOptions = getReleaseOptions(result);
    const suggestedRelease =
      result.suggestedRelease &&
      releaseOptions.some((release) => release.tagName === result.suggestedRelease?.tagName)
        ? result.suggestedRelease
        : releaseOptions[0];
    setSelectedReleaseTag(suggestedRelease?.tagName ?? "");
    setSelectedAssetName(
      result.suggestedAsset?.name ??
        suggestedRelease?.assets[0]?.name ??
        ""
    );
  }, []);

  useEffect(() => {
    let cancelled = false;

    void mainApi
      .getSjasmplusPathSuggestions()
      .then((suggestions) => {
        if (!cancelled) {
          setPathSuggestions(suggestions);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPathSuggestions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [mainApi]);

  useEffect(() => {
    // --- Upstream ships Windows binaries only, so there is nothing to list
    // --- anywhere else.
    if (setupMode !== "online" || !isWindows) return;

    let cancelled = false;

    setReleaseBusy(true);
    setReleaseError("");
    void mainApi
      .listSjasmplusReleases({ includePrereleases })
      .then((result) => {
        if (cancelled) return;
        updateReleaseSelection(result);
      })
      .catch((err: any) => {
        if (cancelled) return;
        setReleaseList(undefined);
        setSelectedReleaseTag("");
        setSelectedAssetName("");
        setReleaseError(err?.message ?? String(err));
      })
      .finally(() => {
        if (!cancelled) {
          setReleaseBusy(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [includePrereleases, isWindows, mainApi, setupMode, updateReleaseSelection]);

  const releaseOptions = getReleaseOptions(releaseList);
  const selectedRelease = releaseOptions.find(
    (release) => release.tagName === selectedReleaseTag
  );
  const assetOptions = getUsableAssets(selectedRelease);
  const selectedAsset =
    assetOptions.find((asset) => asset.name === selectedAssetName) ?? assetOptions[0];
  const canDownload =
    setupMode === "online" &&
    !!selectedRelease &&
    !!selectedAsset &&
    !!downloadFolder &&
    !releaseBusy &&
    !busy;

  return (
    <Modal
      title="SJASMPLUS Integration"
      isOpen={true}
      fullScreen={false}
      width={640}
      primaryLabel="Apply"
      primaryEnabled={canApply}
      secondaryLabel="Test again"
      secondaryVisible={true}
      secondaryEnabled={canValidate}
      cancelLabel="Close"
      initialFocus="primary"
      closeOnOutsideClick={false}
      onClose={() => {
        void requestClose();
      }}
      onCancelClicked={async () => {
        // --- Returning true keeps the modal open; requestClose decides.
        void requestClose();
        return true;
      }}
      onSecondaryClicked={async () => {
        await validateCandidate();
        return true;
      }}
      onPrimaryClicked={async () => {
        if (await applyIntegration()) {
          onClose("close");
        }
        return true;
      }}
    >
      <div className={styles.body}>
        {/* --- What Klive uses right now, as a readable sentence */}
        <div className={classnames(styles.row, styles.block)}>
          <span className={styles.label}>In use</span>
          <div className={styles.blockValue}>
            {status.source === "none" ? (
              <>
                <div className={styles.blockLine}>
                  <span data-testid="sjasmplus-status">
                    No SJASMPLUS assembler is set up yet
                  </span>
                </div>
                <div className={styles.blockHint}>
                  Klive cannot assemble SJASMPLUS sources until you set one up below.
                </div>
              </>
            ) : (
              <>
                <div className={classnames(styles.blockLine, styles.integrated)}>
                  <span
                    className={styles.badge}
                    role="img"
                    aria-label="SJASMPLUS is set up"
                    title="SJASMPLUS is set up and passed its last test"
                    data-testid="sjasmplus-integrated-badge"
                  >
                    <Icon
                      iconName="check"
                      width={16}
                      height={16}
                      fill="--color-secondary-label"
                    />
                  </span>
                  <Path
                    testId="sjasmplus-executable-path"
                    value={status.executablePath}
                    fallback="Not resolved"
                  />
                </div>
                <div className={classnames(styles.blockHint, styles.integrated)}>
                  <span data-testid="sjasmplus-status">Configured</span> in{" "}
                  <span data-testid="sjasmplus-scope">{formatScope(status.source)}</span>
                  <span className={styles.sep}>&middot;</span>
                  <span data-testid="sjasmplus-version">
                    {status.version ?? "version unknown"}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className={styles.divider} />

        {/* --- Setup source and save scope: one row each */}
        <Row label="Source">
          <label className={styles.option}>
            <input
              type="radio"
              name="sjasmplus-setup-mode"
              checked={setupMode === "local"}
              disabled={!!busy}
              onChange={() => selectSetupMode("local")}
            />
            Local executable
          </label>
          <label className={styles.option}>
            <input
              type="radio"
              name="sjasmplus-setup-mode"
              checked={setupMode === "online"}
              disabled={!!busy}
              onChange={() => selectSetupMode("online")}
            />
            Online release
          </label>
        </Row>
        <Row label="Save to">
          <label className={styles.option}>
            <input
              type="radio"
              name="sjasmplus-scope"
              checked={scope === "user"}
              disabled={!!busy}
              onChange={() => setScope("user")}
            />
            User settings
          </label>
          <label
            className={classnames(styles.option, { [styles.disabled]: !canUseProjectScope })}
          >
            <input
              type="radio"
              name="sjasmplus-scope"
              checked={scope === "project"}
              disabled={!canUseProjectScope || !!busy}
              onChange={() => setScope("project")}
            />
            Project settings
          </label>
          {!canUseProjectScope && (
            <span className={classnames(styles.muted, styles.message)}>
              (no Klive project is open)
            </span>
          )}
        </Row>

        <div className={styles.divider} />

        {/* --- Only the controls of the selected source are shown. The panel has a
            --- fixed minimum height, so both sources render the same dialog height. */}
        <div className={styles.panel}>
          {setupMode === "local" ? (
            <>
              <Row label="Executable">
                <Button
                  text="Select executable..."
                  disabled={!!busy}
                  clicked={() => {
                    void selectExecutable();
                  }}
                />
              </Row>
              {/* --- One-click shortcuts for binaries found on PATH. This is a
                  --- convenience list, not a verdict on the user's own selection, so
                  --- it stays hidden when PATH holds nothing. */}
              {pathSuggestions.length > 0 && (
                <Row label="On PATH">
                  <div className={styles.suggestions}>
                    {pathSuggestions.map((suggestion) => (
                      <button
                        key={suggestion.executablePath}
                        type="button"
                        className={styles.suggestionButton}
                        disabled={!!busy}
                        title={`Use ${suggestion.executablePath}`}
                        onClick={() => {
                          void selectSuggestion(suggestion);
                        }}
                      >
                        {suggestion.executablePath}
                      </button>
                    ))}
                  </div>
                </Row>
              )}
              <div className={styles.spacer} />
            </>
          ) : !isWindows ? (
            // --- Upstream publishes Windows binaries and source archives only, so
            // --- there is nothing to download here. Explain and point at the repo.
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
                  href={SJASMPLUS_REPOSITORY_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  {SJASMPLUS_REPOSITORY_URL.replace("https://", "")}
                </a>
              </Row>
              <div className={styles.spacer} />
            </>
          ) : (
            <>
              <Row label="Release">
                <select
                  className={styles.selectBox}
                  value={selectedReleaseTag}
                  disabled={releaseBusy || releaseOptions.length === 0}
                  onChange={(event) => selectRelease(event.target.value)}
                  data-testid="sjasmplus-release-select"
                >
                  {releaseOptions.length === 0 && <option value="">No releases</option>}
                  {releaseOptions.map((release) => (
                    <option key={release.tagName} value={release.tagName}>
                      {formatReleaseLabel(release, releaseList?.targetPlatform)}
                    </option>
                  ))}
                </select>
                <label className={styles.option}>
                  <input
                    type="checkbox"
                    checked={includePrereleases}
                    disabled={releaseBusy}
                    onChange={(event) => setIncludePrereleases(event.target.checked)}
                  />
                  Show prereleases
                </label>
                <Button
                  text="Refresh"
                  disabled={releaseBusy}
                  clicked={() => {
                    void refreshReleases();
                  }}
                />
              </Row>
              <Row label="Asset">
                <select
                  className={styles.selectBox}
                  value={selectedAsset?.name ?? ""}
                  disabled={releaseBusy || assetOptions.length === 0}
                  onChange={(event) => setSelectedAssetName(event.target.value)}
                  data-testid="sjasmplus-asset-select"
                >
                  {assetOptions.length === 0 && <option value="">No assets</option>}
                  {assetOptions.map((asset) => (
                    <option key={asset.name} value={asset.name}>
                      {formatAssetLabel(asset)}
                    </option>
                  ))}
                </select>
              </Row>
              <Row label="Folder">
                <Button
                  text="Select folder..."
                  disabled={!!busy}
                  clicked={() => {
                    void selectDownloadFolder();
                  }}
                />
                <Path
                  testId="sjasmplus-download-folder"
                  value={downloadFolder}
                  fallback="Not selected"
                  muted
                />
                <span className={styles.pushRight}>
                  <Button
                    text="Download..."
                    disabled={!canDownload}
                    clicked={() => {
                      void downloadSelectedRelease();
                    }}
                  />
                </span>
              </Row>
              <Row label="GitHub">
                <span
                  className={classnames(styles.messageText, {
                    [styles.failed]: !!releaseError
                  })}
                  data-testid="sjasmplus-release-status"
                >
                  {formatReleaseStatus(releaseBusy, releaseError, releaseList, releaseOptions)}
                </span>
              </Row>
              <div className={styles.spacer} />
            </>
          )}
        </div>

        <div className={styles.divider} />

        {/* --- What Apply would save, with a fixed height so messages never resize
            --- the dialog */}
        <div className={classnames(styles.row, styles.block)}>
          <span className={styles.label}>To apply</span>
          <div className={styles.blockValue}>
            <div className={styles.blockLine}>
              {candidate?.executablePath ? (
                <Path testId="sjasmplus-candidate-path" value={candidate.executablePath} fallback="" />
              ) : (
                <span data-testid="sjasmplus-candidate-path">Nothing selected yet</span>
              )}
            </div>
            <div
              className={classnames(styles.blockHint, {
                [styles.integrated]: !!validation?.ok && !busy,
                [styles.failed]: !!validation && !validation.ok
              })}
              role="status"
              title={message}
            >
              <span data-testid="sjasmplus-validation">{formatValidation(validation, busy)}</span>
              <span className={styles.sep}>&middot;</span>
              <span className={styles.messageText} data-testid="sjasmplus-message">
                {message || getNextStepHint(candidate, validation, busy)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );

  // --- Every dismissal route (Close, the X, Escape) funnels through here, so an
  // --- unsaved selection is never dropped silently.
  async function requestClose(): Promise<void> {
    if (!hasPendingChanges) {
      onClose("close");
      return;
    }

    const discard = await dialogs.open<boolean, { executablePath: string }>(
      ConfirmDiscardDialog,
      { executablePath: candidate?.executablePath ?? "" },
      {
        title: "Discard SJASMPLUS setup?",
        width: 460,
        dialogRole: "alertdialog",
        closeOnOutsideClick: false
      }
    );
    if (discard) {
      onClose("close");
    }
  }

  function selectSetupMode(mode: SetupMode): void {
    setSetupMode(mode);
    setValidation(undefined);
    setMessage("");
  }

  async function selectExecutable(): Promise<void> {
    const selectedFile = await mainApi.showOpenFileDialog(
      [{ name: "SJASMPLUS executable", extensions: ["exe", "*"] }],
      "sjasmplusExecutable"
    );
    if (selectedFile) {
      await probePath(selectedFile);
    }
  }

  async function probePath(path: string): Promise<void> {
    setBusy("probe");
    setMessage("");
    setValidation(undefined);
    try {
      const result = await mainApi.probeSjasmplusPath(path);
      setCandidate(result);
      if (!result.ok) {
        setMessage(result.error ?? "The selected path is not a valid SJASMPLUS candidate.");
        return;
      }
      setBusy("validate");
      await validateExecutable(result.executablePath);
    } catch (err: any) {
      setMessage(err?.message ?? String(err));
    } finally {
      setBusy(undefined);
    }
  }

  async function selectSuggestion(suggestion: SjasmplusProbeResult): Promise<void> {
    setCandidate(suggestion);
    setValidation(undefined);
    setMessage("");
    if (!suggestion.executablePath) return;

    setBusy("validate");
    try {
      await validateExecutable(suggestion.executablePath);
    } catch (err: any) {
      setMessage(err?.message ?? String(err));
    } finally {
      setBusy(undefined);
    }
  }

  async function refreshReleases(): Promise<void> {
    setReleaseBusy(true);
    setReleaseError("");
    try {
      const result = await mainApi.listSjasmplusReleases({ includePrereleases });
      updateReleaseSelection(result);
    } catch (err: any) {
      setReleaseList(undefined);
      setSelectedReleaseTag("");
      setSelectedAssetName("");
      setReleaseError(err?.message ?? String(err));
    } finally {
      setReleaseBusy(false);
    }
  }

  async function selectDownloadFolder(): Promise<void> {
    const selectedFolder = await mainApi.showOpenFolderDialog("sjasmplusDownloadFolder");
    if (selectedFolder) {
      setDownloadFolder(selectedFolder);
      setValidation(undefined);
      setMessage("");
    }
  }

  async function downloadSelectedRelease(): Promise<void> {
    if (!selectedRelease || !selectedAsset || !downloadFolder) return;

    setBusy("download");
    setMessage("");
    setValidation(undefined);
    try {
      const result = await mainApi.downloadSjasmplusRelease({
        releaseTag: selectedRelease.tagName,
        asset: selectedAsset,
        destinationFolder: downloadFolder
      });
      setCandidate(result);
      if (!result.ok) {
        setMessage(result.error ?? "SJASMPLUS release download failed.");
        return;
      }

      setBusy("validate");
      await validateExecutable(result.executablePath);
    } catch (err: any) {
      setMessage(err?.message ?? String(err));
    } finally {
      setBusy(undefined);
    }
  }

  function selectRelease(tagName: string): void {
    const release = releaseOptions.find((item) => item.tagName === tagName);
    setSelectedReleaseTag(tagName);
    setSelectedAssetName(getUsableAssets(release)[0]?.name ?? "");
  }

  async function validateCandidate(): Promise<void> {
    if (!candidate?.executablePath) return;
    setBusy("validate");
    setMessage("");
    try {
      await validateExecutable(candidate.executablePath);
    } catch (err: any) {
      setMessage(err?.message ?? String(err));
    } finally {
      setBusy(undefined);
    }
  }

  async function validateExecutable(
    executablePath: string | undefined
  ): Promise<SjasmplusProbeResult | undefined> {
    if (!executablePath) return undefined;
    const result = await mainApi.validateSjasmplusExecutable(executablePath);
    setValidation(result);
    setCandidate(result);
    setMessage(
      result.ok
        ? "The smoke-test compile succeeded, press Apply to save it."
        : result.error ?? "The smoke-test compile failed, so this executable cannot be saved."
    );
    return result;
  }

  async function applyIntegration(): Promise<boolean> {
    if (!validation?.ok || !candidate?.installFolder || !candidate?.executablePath) {
      return false;
    }
    setBusy("apply");
    setMessage("");
    try {
      await mainApi.applySjasmplusIntegration({
        scope,
        installFolder: candidate.installFolder,
        executablePath: candidate.executablePath,
        version: validation.version
      });
      setMessage("SJASMPLUS integration saved.");
      return true;
    } catch (err: any) {
      setMessage(err?.message ?? String(err));
      return false;
    } finally {
      setBusy(undefined);
    }
  }
};

type ConfirmDiscardProps = DialogComponentProps<boolean> & {
  executablePath: string;
};

const ConfirmDiscardDialog = ({ executablePath, controls }: ConfirmDiscardProps) => (
  <DialogForm
    submitLabel="Discard"
    submitDanger
    cancelLabel="Keep editing"
    onSubmit={() => controls.close(true)}
    onCancel={controls.cancel}
  >
    <div className={styles.confirmBody}>
      <div>This setup has not been applied yet:</div>
      <code className={styles.confirmPath}>
        <bdi>{executablePath}</bdi>
      </code>
      <div>Closing now leaves SJASMPLUS unchanged.</div>
    </div>
  </DialogForm>
);

type RowProps = {
  label: string;
  children: ReactNode;
  wrap?: boolean;
};

const Row = ({ label, children, wrap }: RowProps) => (
  <div className={styles.row}>
    <span className={styles.label}>{label}</span>
    <div className={classnames(styles.value, { [styles.wrapValue]: wrap })}>{children}</div>
  </div>
);

type PathProps = {
  testId?: string;
  value?: string;
  fallback: string;
  muted?: boolean;
};

// --- Renders a single-line path that truncates at its head, so the file name
// --- (the interesting part) always stays visible.
const Path = ({ testId, value, fallback, muted }: PathProps) => (
  <code
    className={classnames(styles.path, { [styles.muted]: muted })}
    title={value || fallback}
    data-testid={testId}
  >
    <bdi>{value || fallback}</bdi>
  </code>
);

function getSjasmplusStatus(
  userSettings: Record<string, any> | undefined,
  projectSettings: Record<string, any> | undefined,
  isWindows: boolean
): SjasmplusStatus {
  const projectStatus = readStatus(projectSettings, "project", isWindows);
  if (projectStatus.source !== "none") {
    return projectStatus;
  }

  const userStatus = readStatus(userSettings, "user", isWindows);
  if (userStatus.source !== "none") {
    return userStatus;
  }

  return { source: "none" };
}

function readStatus(
  settings: Record<string, any> | undefined,
  source: SettingsScope,
  isWindows: boolean
): SjasmplusStatus {
  const installFolder = readStringSetting(settings, SJASMP_INSTALL_FOLDER);
  const executablePath = readStringSetting(settings, SJASMP_EXECUTABLE_PATH);
  const version = readStringSetting(settings, SJASMP_VERSION);
  if (!installFolder && !executablePath) {
    return { source: "none" };
  }

  const normalizedFolder = installFolder || getPathFolder(executablePath);
  return {
    source,
    installFolder: normalizedFolder,
    executablePath:
      executablePath ||
      `${removeTrailingSeparators(normalizedFolder)}/${isWindows ? "sjasmplus.exe" : "sjasmplus"}`,
    version: version || undefined
  };
}

function readStringSetting(settings: Record<string, any> | undefined, key: string): string {
  const value = get(settings, key);
  return typeof value === "string" ? value.trim() : "";
}

function removeTrailingSeparators(path: string): string {
  return path.replace(/[\\/]+$/, "");
}

function getPathFolder(path: string): string {
  const normalized = path.replaceAll("\\", "/");
  const lastSeparator = normalized.lastIndexOf("/");
  return lastSeparator >= 0 ? normalized.substring(0, lastSeparator) : "";
}

function formatScope(scope: SettingsScope): string {
  switch (scope) {
    case "project":
      return "Project settings";
    case "user":
      return "User settings";
    default:
      return "None";
  }
}

function formatValidation(
  validation: SjasmplusProbeResult | undefined,
  busy: BusyState
): string {
  switch (busy) {
    case "probe":
      return "Checking selected path...";
    case "download":
      return "Downloading release...";
    case "validate":
      return "Running smoke test...";
    case "apply":
      return "Saving...";
    default:
      if (!validation) return "Not tested";
      return validation.ok ? "Passed" : "Failed";
  }
}

// --- Tells the user what to do next whenever there is no message to show.
function getNextStepHint(
  candidate: SjasmplusProbeResult | undefined,
  validation: SjasmplusProbeResult | undefined,
  busy: BusyState
): string {
  if (busy) return "";
  if (!candidate?.executablePath) {
    return "Pick a local executable or download a release below.";
  }
  if (!validation) {
    return "Press Test again to check this executable.";
  }
  return "";
}

// --- Only assets that can actually be installed here. Source archives and other
// --- platforms' builds are never offered.
function getUsableAssets(release: SjasmplusRelease | undefined): SjasmplusReleaseAsset[] {
  return release?.compatibleAssets ?? [];
}

function getReleaseOptions(
  releaseList: SjasmplusReleaseListResult | undefined
): SjasmplusRelease[] {
  return releaseList?.releases.slice(0, DISPLAYED_RELEASE_LIMIT) ?? [];
}

const PLATFORM_NAMES: Record<string, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux"
};

function formatReleaseStatus(
  releaseBusy: boolean,
  releaseError: string,
  releaseList: SjasmplusReleaseListResult | undefined,
  releaseOptions: SjasmplusRelease[]
): string {
  if (releaseBusy) return "Checking GitHub releases...";
  if (releaseError) return releaseError;
  if (!releaseList) return "Not checked";
  if (releaseOptions.length === 0) return "No releases found";
  const suggestedRelease = releaseOptions.find((release) => release.compatibleAssets.length > 0);
  if (suggestedRelease) return `Suggested ${suggestedRelease.tagName}`;

  // --- Upstream publishes Windows binaries and source archives only, so this is
  // --- the normal outcome on macOS and Linux. Say what to do instead.
  const platform = PLATFORM_NAMES[releaseList.targetPlatform];
  return platform
    ? `SJASMPLUS publishes no ${platform} binary — build it from source, then use Local executable.`
    : "No downloadable build matches this system — use Local executable instead.";
}

function formatReleaseLabel(release: SjasmplusRelease, targetPlatform?: string): string {
  const prerelease = release.prerelease ? " (prerelease)" : "";
  const usable = release.compatibleAssets.length;
  const platform = (targetPlatform && PLATFORM_NAMES[targetPlatform]) || "this system";
  const suffix = usable > 0 ? `${usable} build${usable > 1 ? "s" : ""} for ${platform}` : `nothing for ${platform}`;
  return `${release.tagName}${prerelease} — ${suffix}`;
}

function formatAssetLabel(asset: SjasmplusReleaseAsset): string {
  const parts = [describeAssetContent(asset)];
  if (asset.size > 0) {
    parts.push(formatFileSize(asset.size));
  }
  return `${asset.name} — ${parts.join(" · ")}`;
}

// --- Says what the file actually is, in words a user can act on.
function describeAssetContent(asset: SjasmplusReleaseAsset): string {
  if (asset.kind === "source") return "source code, needs compiling";

  const platform = PLATFORM_NAMES[asset.platform];
  if (!platform) return "unrecognized build";
  const arch = asset.arch === "unknown" ? "" : ` ${asset.arch}`;
  return `${platform}${arch} build`;
}

function formatFileSize(size: number): string {
  if (size >= 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (size >= 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${size} B`;
}
