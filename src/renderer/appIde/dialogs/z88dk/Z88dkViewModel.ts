import type {
  Z88dkDownloadProgress,
  Z88dkIntegrationScope,
  Z88dkProbeResult,
  Z88dkRelease,
  Z88dkReleaseAsset,
  Z88dkReleaseListResult
} from "@common/messaging/Z88dkIntegration";
import { t } from "@common/i18n/i18n";
import type { MessageKey } from "@common/i18n/keys.generated";
import type { ConfirmRequest } from "@mvc/dialogs/DialogPorts";
import { isSamePath } from "@utils/path-compare";

import {
  CANDIDATE_REJECTED_MESSAGE,
  CONFIGURED_FAILED_MESSAGE,
  MODEL_MESSAGE_KEYS,
  REPLACEMENT_READY_MESSAGE,
  Z88DK_BUILD_WIKI_URL,
  Z88DK_RELEASES_URL,
  onlineAvailable,
  releaseOptionsOf,
  selectedAssetOf,
  selectedReleaseOf,
  usableAssetsOf,
  type BusyState,
  type HostPlatform,
  type SetupMode,
  type SettingsScope,
  type Z88dkState
} from "./Z88dkModel";

// ─── View model shape ────────────────────────────────────────────────────────

export type StatusBadge = "none" | "passed" | "failed";

export type StatusDetail = { kind: "note" | "error" | "version"; text: string };

export type StatusViewModel =
  | { kind: "none"; text: string; hint: string }
  | {
      kind: "configured";
      badge: StatusBadge;
      badgeLabel: string;
      badgeTitle: string;
      root?: string;
      headline: string;
      scopeLabel: string;
      detail: StatusDetail;
      detailTitle?: string;
    };

export type OptionViewModel = { value: string; label: string };

export type SuggestionViewModel = { root: string; label: string; title: string; supported: boolean };

export type DownloadProgressViewModel = {
  label: string;
  /** 0–100, or undefined when the size is unknown (an indeterminate bar). */
  percent?: number;
  cancelEnabled: boolean;
};

// --- A string discriminant: `strictNullChecks` is off, so a boolean one would not narrow
export type OnlineViewModel =
  | { kind: "unavailable"; releasesUrl: string; releasesLabel: string; buildUrl: string }
  | {
      kind: "available";
      releases: OptionViewModel[];
      selectedTag: string;
      releaseSelectDisabled: boolean;
      assets: OptionViewModel[];
      selectedAssetName: string;
      assetSelectDisabled: boolean;
      showOlder: boolean;
      showOlderDisabled: boolean;
      refreshDisabled: boolean;
      downloadFolder?: string;
      folderDisabled: boolean;
      downloadEnabled: boolean;
      statusText: string;
      statusFailed: boolean;
      progress?: DownloadProgressViewModel;
    };

export type Z88dkViewModel = {
  status: StatusViewModel;
  scopeChoice: { value: Z88dkIntegrationScope; projectEnabled: boolean; disabled: boolean; note?: string };
  source: {
    mode: SetupMode;
    disabled: boolean;
    local: { suggestions: SuggestionViewModel[] };
    online: OnlineViewModel;
  };
  apply: {
    candidatePath?: string;
    validationLabel: string;
    message: string;
    messageTitle: string;
    tone: "none" | "passed" | "failed" | "warning";
  };
  buttons: { applyEnabled: boolean; testEnabled: boolean; busy: boolean };
  hasPendingChanges: boolean;
};

// ─── Selector ────────────────────────────────────────────────────────────────

export function displayText(message: string): string {
  return message && MODEL_MESSAGE_KEYS.has(message) ? t(message as MessageKey) : message;
}

export function selectViewModel(state: Z88dkState): Z88dkViewModel {
  const { candidate, validation, busy, env } = state;
  const canApply = !!validation?.ok && !!candidate?.root && !busy;
  return {
    status: selectStatus(state),
    scopeChoice: {
      value: state.scope,
      projectEnabled: env.isKliveProject,
      disabled: !!busy,
      note: env.isKliveProject ? undefined : t("dialog.z88dk.scope.noProject")
    },
    source: {
      mode: state.setupMode,
      disabled: !!busy,
      local: { suggestions: state.pathSuggestions.filter((s) => !!s.root).map(formatSuggestion) },
      online: selectOnline(state)
    },
    apply: {
      candidatePath: candidate?.root,
      validationLabel: formatValidation(validation, busy),
      message: displayText(state.message) || nextStepHint(candidate, validation, busy),
      messageTitle: displayText(state.message),
      tone:
        busy || !validation
          ? "none"
          : !validation.ok
            ? "failed"
            : validation.supported === false
              ? "warning"
              : "passed"
    },
    buttons: { applyEnabled: canApply, testEnabled: !!candidate?.root && !busy, busy: !!busy },
    hasPendingChanges: selectHasPendingChanges(state)
  };
}

/**
 * A tested candidate Apply would save: a different install than the one in use, or the same one
 * for another scope (§4.3: closing then asks first).
 */
export function selectHasPendingChanges(state: Z88dkState): boolean {
  return (
    !!state.validation?.ok &&
    !!state.candidate?.root &&
    (!isConfiguredCandidate(state) || state.scope !== state.initialScope)
  );
}

function isConfiguredCandidate(state: Z88dkState): boolean {
  return isSamePath(state.candidate?.root, state.env.configured.root, state.env.platform === "windows");
}

export function selectStatusBadge(state: Z88dkState): StatusBadge {
  if (statusNoteOf(state)) return "none";
  if (state.statusCheck === "passed") return "passed";
  if (state.statusCheck === "failed") return "failed";
  return "none";
}

function statusNoteOf(state: Z88dkState): string {
  const { validation, candidate, statusCheck } = state;
  const testedAnother = !!validation && !!candidate?.root && !isConfiguredCandidate(state);
  if (!testedAnother) return "";
  if (statusCheck === "failed" && validation!.ok) return t(REPLACEMENT_READY_MESSAGE);
  if (statusCheck === "passed" && !validation!.ok) return t(CANDIDATE_REJECTED_MESSAGE);
  return "";
}

function selectStatus(state: Z88dkState): StatusViewModel {
  const { configured } = state.env;
  if (configured.source === "none") {
    return { kind: "none", text: t("dialog.z88dk.status.noneText"), hint: t("dialog.z88dk.status.noneHint") };
  }
  const badge = selectStatusBadge(state);
  const note = statusNoteOf(state);
  const error = displayText(state.statusError) || t(CONFIGURED_FAILED_MESSAGE);
  // --- The verdict of the last check of the configured folder carries the freshest version
  const checked = isSamePath(state.validation?.root, configured.root, state.env.platform === "windows")
    ? state.validation
    : undefined;
  const version = checked?.version ?? configured.version;
  return {
    kind: "configured",
    badge,
    badgeLabel: badge === "failed" ? t("dialog.z88dk.status.badgeNotUsable") : t("dialog.z88dk.status.badgeSetUp"),
    badgeTitle: badge === "failed" ? error : t("dialog.z88dk.status.badgeSetUpTitle"),
    root: configured.root,
    headline: state.statusCheck === "failed" ? t("dialog.z88dk.status.notWorking") : t("dialog.z88dk.status.configured"),
    scopeLabel: formatScope(configured.source),
    detail: note
      ? { kind: "note", text: note }
      : state.statusCheck === "failed"
        ? { kind: "error", text: error }
        : { kind: "version", text: formatVersion(version, checked?.supported) },
    detailTitle: note || displayText(state.statusError) || undefined
  };
}

function selectOnline(state: Z88dkState): OnlineViewModel {
  if (!onlineAvailable(state.env)) {
    return {
      kind: "unavailable",
      releasesUrl: Z88DK_RELEASES_URL,
      releasesLabel: Z88DK_RELEASES_URL.replace("https://", ""),
      buildUrl: Z88DK_BUILD_WIKI_URL
    };
  }
  const { releases } = state;
  const options = releaseOptionsOf(releases);
  const selectedRelease = selectedReleaseOf(state);
  const assetOptions = usableAssetsOf(selectedRelease);
  const selectedAsset = selectedAssetOf(state);
  const downloading = state.busy === "download";
  return {
    kind: "available",
    releases: options.map((release) => ({ value: release.tagName, label: formatReleaseLabel(release) })),
    selectedTag: releases.selectedTag,
    releaseSelectDisabled: releases.busy || options.length === 0 || !!state.busy,
    assets: assetOptions.map((asset) => ({ value: asset.name, label: formatAssetLabel(asset) })),
    selectedAssetName: selectedAsset?.name ?? "",
    assetSelectDisabled: releases.busy || assetOptions.length === 0 || !!state.busy,
    showOlder: releases.showOlder,
    showOlderDisabled: releases.busy || !!state.busy,
    refreshDisabled: releases.busy || !!state.busy,
    downloadFolder: state.downloadFolder || undefined,
    folderDisabled: !!state.busy,
    downloadEnabled:
      state.setupMode === "online" &&
      !!selectedRelease &&
      !!selectedAsset &&
      !!state.downloadFolder &&
      !releases.busy &&
      !state.busy,
    statusText: formatReleaseStatus(releases.busy, releases.error, releases.list, options, state.env.platform),
    statusFailed: !!releases.error,
    progress: downloading ? formatProgress(state.download) : undefined
  };
}

export function discardConfirmRequest(state: Z88dkState): ConfirmRequest {
  return {
    title: t("dialog.z88dk.discard.title"),
    lines: [t("dialog.z88dk.discard.notApplied")],
    code: state.candidate?.root ?? "",
    linesAfterCode: [t("dialog.z88dk.discard.unchanged")],
    confirmLabel: t("dialog.z88dk.discard.confirm"),
    cancelLabel: t("dialog.z88dk.discard.keepEditing"),
    danger: true
  };
}

/** The question Apply asks for a version outside the supported range (C3). */
export function unsupportedConfirmRequest(state: Z88dkState): ConfirmRequest {
  return {
    title: t("dialog.z88dk.unsupported.title"),
    lines: [t("dialog.z88dk.unsupported.lines", { version: state.validation?.version ?? "?" })],
    code: state.candidate?.root ?? "",
    linesAfterCode: [t("dialog.z88dk.unsupported.after")],
    confirmLabel: t("dialog.z88dk.unsupported.confirm"),
    cancelLabel: t("common.button.cancel")
  };
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export function formatScope(scope: SettingsScope): string {
  switch (scope) {
    case "project":
      return t("dialog.z88dk.scope.project");
    case "user":
      return t("dialog.z88dk.scope.user");
    default:
      return t("dialog.z88dk.scope.none");
  }
}

export function formatVersion(version: string | undefined, supported: boolean | undefined): string {
  if (!version) return t("dialog.z88dk.status.versionUnknown");
  return supported === false ? t("dialog.z88dk.version.unsupported", { version }) : version;
}

export function formatSuggestion(suggestion: Z88dkProbeResult): SuggestionViewModel {
  const root = suggestion.root!;
  const label = suggestion.version
    ? suggestion.supported === false
      ? t("dialog.z88dk.local.suggestionUnsupported", { path: root, version: suggestion.version })
      : t("dialog.z88dk.local.suggestion", { path: root, version: suggestion.version })
    : root;
  return { root, label, title: t("dialog.z88dk.local.useSuggestion", { path: root }), supported: suggestion.supported !== false };
}

export function formatValidation(validation: Z88dkProbeResult | undefined, busy: BusyState): string {
  switch (busy) {
    case "probe":
      return t("dialog.z88dk.validation.probing");
    case "download":
      return t("dialog.z88dk.validation.downloading");
    case "validate":
      return t("dialog.z88dk.validation.testing");
    case "apply":
      return t("dialog.z88dk.validation.saving");
    default:
      if (!validation) return t("dialog.z88dk.validation.notTested");
      if (!validation.ok) return t("dialog.z88dk.validation.failed");
      return validation.supported === false ? t("dialog.z88dk.validation.passedUnsupported") : t("dialog.z88dk.validation.passed");
  }
}

export function nextStepHint(
  candidate: Z88dkProbeResult | undefined,
  validation: Z88dkProbeResult | undefined,
  busy: BusyState
): string {
  if (busy) return "";
  if (!candidate?.root) return t("dialog.z88dk.hint.pickFolder");
  if (!validation) return t("dialog.z88dk.hint.testAgain");
  return "";
}

const PLATFORM_NAMES: Record<HostPlatform, string> = { windows: "Windows", macos: "macOS", linux: "Linux" };

export function formatReleaseStatus(
  busy: boolean,
  error: string,
  list: Z88dkReleaseListResult | undefined,
  options: Z88dkRelease[],
  platform: HostPlatform
): string {
  if (busy) return t("dialog.z88dk.releases.checking");
  if (error) return error;
  if (!list) return t("dialog.z88dk.releases.notChecked");
  if (options.length === 0) return t("dialog.z88dk.releases.noneFound");
  const suggested = options.find((release) => release.supported && release.compatibleAssets.length > 0);
  if (suggested) return t("dialog.z88dk.releases.suggested", { tag: suggested.tagName });
  return t("dialog.z88dk.releases.noBinaryFor", { platform: PLATFORM_NAMES[platform] });
}

export function formatReleaseLabel(release: Z88dkRelease): string {
  return t("dialog.z88dk.release.label", {
    tag: release.tagName,
    supported: release.supported ? "yes" : "no",
    date: (release.publishedAt || "").slice(0, 10)
  });
}

export function formatAssetLabel(asset: Z88dkReleaseAsset): string {
  return asset.size > 0
    ? t("dialog.z88dk.asset.labelWithSize", { name: asset.name, size: formatFileSize(asset.size) })
    : asset.name;
}

export function formatProgress(progress: Z88dkDownloadProgress | undefined): DownloadProgressViewModel {
  const phase = progress?.phase ?? "downloading";
  const received = progress?.receivedBytes ?? 0;
  const total = progress?.totalBytes;
  switch (phase) {
    case "verifying":
      return { label: t("dialog.z88dk.progress.verifying"), percent: 100, cancelEnabled: false };
    case "extracting":
      return { label: t("dialog.z88dk.progress.extracting"), cancelEnabled: true };
    case "testing":
      return { label: t("dialog.z88dk.progress.testing"), cancelEnabled: false };
    default:
      return total
        ? {
            label: t("dialog.z88dk.progress.downloadingOf", { received: formatFileSize(received), total: formatFileSize(total) }),
            percent: Math.min(100, Math.round((received / total) * 100)),
            cancelEnabled: true
          }
        : { label: t("dialog.z88dk.progress.downloading", { received: formatFileSize(received) }), cancelEnabled: true };
  }
}

export function formatFileSize(size: number): string {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}
