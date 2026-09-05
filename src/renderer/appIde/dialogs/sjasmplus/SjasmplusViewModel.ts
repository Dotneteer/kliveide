import type {
  SjasmplusIntegrationScope,
  SjasmplusProbeResult,
  SjasmplusRelease,
  SjasmplusReleaseAsset,
  SjasmplusReleaseListResult
} from "@common/messaging/SjasmplusIntegration";
import type { ConfirmRequest } from "@mvc/dialogs/DialogPorts";
import { isSamePath } from "@utils/path-compare";

import {
  CANDIDATE_REJECTED_MESSAGE,
  CONFIGURED_FAILED_MESSAGE,
  REPLACEMENT_READY_MESSAGE,
  SJASMPLUS_REPOSITORY_URL,
  releaseOptionsOf,
  usableAssetsOf,
  type BusyState,
  type SetupMode,
  type SettingsScope,
  type SjasmplusState
} from "./SjasmplusModel";

// ─── View model shape ────────────────────────────────────────────────────────

export type StatusBadge = "none" | "passed" | "failed";

export type StatusDetail = {
  kind: "note" | "error" | "version";
  text: string;
};

export type StatusViewModel =
  | { kind: "none"; text: string; hint: string }
  | {
      kind: "configured";
      badge: StatusBadge;
      badgeLabel: string;
      badgeTitle: string;
      executablePath?: string;
      headline: string;
      scopeLabel: string;
      detail: StatusDetail;
      detailTitle?: string;
    };

export type OptionViewModel = { value: string; label: string };

// --- A string discriminant, not a boolean: this project compiles with
// --- `strictNullChecks: false`, under which TypeScript does not narrow a union
// --- on a boolean-literal discriminant.
export type OnlineViewModel =
  | { kind: "unavailable"; repositoryUrl: string; repositoryLabel: string }
  | {
      kind: "available";
      releases: OptionViewModel[];
      selectedTag: string;
      releaseSelectDisabled: boolean;
      assets: OptionViewModel[];
      selectedAssetName: string;
      assetSelectDisabled: boolean;
      includePrereleases: boolean;
      prereleasesDisabled: boolean;
      refreshDisabled: boolean;
      downloadFolder?: string;
      downloadEnabled: boolean;
      statusText: string;
      statusFailed: boolean;
    };

export type SjasmplusViewModel = {
  status: StatusViewModel;
  scopeChoice: {
    value: SjasmplusIntegrationScope;
    projectEnabled: boolean;
    disabled: boolean;
    note?: string;
  };
  source: {
    mode: SetupMode;
    disabled: boolean;
    local: { suggestions: string[] };
    online: OnlineViewModel;
  };
  apply: {
    candidatePath?: string;
    validationLabel: string;
    message: string;
    messageTitle: string;
    tone: "none" | "passed" | "failed";
  };
  buttons: { applyEnabled: boolean; testEnabled: boolean; busy: boolean };
  // --- Anything Apply would still change: a different executable than the one
  // --- in use, or the same one destined for a different scope. Read by the
  // --- controller to decide whether closing needs a confirmation.
  hasPendingChanges: boolean;
};

// ─── Selector ────────────────────────────────────────────────────────────────

export function selectViewModel(state: SjasmplusState): SjasmplusViewModel {
  const { candidate, validation, busy, env } = state;
  const canApply =
    !!validation?.ok && !!candidate?.installFolder && !!candidate?.executablePath && !busy;

  return {
    status: selectStatus(state),
    scopeChoice: {
      value: state.scope,
      projectEnabled: env.isKliveProject,
      disabled: !!busy,
      note: env.isKliveProject ? undefined : "(no Klive project is open)"
    },
    source: {
      mode: state.setupMode,
      disabled: !!busy,
      local: {
        suggestions: state.pathSuggestions
          .map((suggestion) => suggestion.executablePath)
          .filter((path): path is string => !!path)
      },
      online: selectOnline(state)
    },
    apply: {
      candidatePath: candidate?.executablePath,
      validationLabel: formatValidation(validation, busy),
      message: state.message || nextStepHint(candidate, validation, busy),
      // --- The tooltip carries the real message only; a fallback hint is
      // --- already fully visible.
      messageTitle: state.message,
      tone: validation?.ok && !busy ? "passed" : validation && !validation.ok ? "failed" : "none"
    },
    buttons: {
      applyEnabled: canApply,
      testEnabled: !!candidate?.executablePath && !busy,
      busy: !!busy
    },
    hasPendingChanges: selectHasPendingChanges(state)
  };
}

export function selectHasPendingChanges(state: SjasmplusState): boolean {
  return (
    !!state.candidate?.executablePath &&
    (!isConfiguredCandidate(state) || state.scope !== state.initialScope)
  );
}

function isConfiguredCandidate(state: SjasmplusState): boolean {
  return isSamePath(
    state.candidate?.executablePath,
    state.env.configured.executablePath,
    state.env.isWindows
  );
}

/**
 * The status block reports on the configured executable, while the "To apply"
 * block reports on whatever the user just tested. When those two verdicts
 * disagree, this block drops its own badge and says what the newer one means
 * for the setup instead: a badge next to a contradicting result reads as a
 * verdict on that result.
 */
export function selectStatusBadge(state: SjasmplusState): StatusBadge {
  if (statusNoteOf(state)) return "none";
  if (state.statusCheck === "passed") return "passed";
  if (state.statusCheck === "failed") return "failed";
  return "none";
}

function statusNoteOf(state: SjasmplusState): string {
  const { validation, candidate, statusCheck } = state;
  const testedAnother =
    !!validation && !!candidate?.executablePath && !isConfiguredCandidate(state);
  if (!testedAnother) return "";
  // --- A working executable is one Apply away, so the old failure is no longer
  // --- what the user has to act on.
  if (statusCheck === "failed" && validation!.ok) return REPLACEMENT_READY_MESSAGE;
  // --- The tested executable is unusable, so nothing is going to change; saying
  // --- so is more useful than a success badge for a setup nobody asked about.
  if (statusCheck === "passed" && !validation!.ok) return CANDIDATE_REJECTED_MESSAGE;
  return "";
}

function selectStatus(state: SjasmplusState): StatusViewModel {
  const { configured } = state.env;
  if (configured.source === "none") {
    return {
      kind: "none",
      text: "No SJASMPLUS assembler is set up yet",
      hint: "Klive cannot assemble SJASMPLUS sources until you set one up below."
    };
  }

  const badge = selectStatusBadge(state);
  const note = statusNoteOf(state);
  const error = state.statusError || CONFIGURED_FAILED_MESSAGE;

  return {
    kind: "configured",
    badge,
    badgeLabel: badge === "failed" ? "SJASMPLUS is not usable" : "SJASMPLUS is set up",
    badgeTitle:
      badge === "failed" ? error : "SJASMPLUS is set up and passed its last test",
    executablePath: configured.executablePath,
    headline: state.statusCheck === "failed" ? "Not working" : "Configured",
    scopeLabel: formatScope(configured.source),
    // --- What the newer verdict means comes first, then the reason this setup
    // --- is broken; the version is only worth the room when neither of those
    // --- has anything to say.
    detail: note
      ? { kind: "note", text: note }
      : state.statusCheck === "failed"
        ? { kind: "error", text: error }
        : { kind: "version", text: configured.version ?? "version unknown" },
    detailTitle: note || state.statusError || undefined
  };
}

function selectOnline(state: SjasmplusState): OnlineViewModel {
  // --- Upstream ships Windows binaries only, so there is nothing to list
  // --- anywhere else.
  if (!state.env.isWindows) {
    return {
      kind: "unavailable",
      repositoryUrl: SJASMPLUS_REPOSITORY_URL,
      repositoryLabel: SJASMPLUS_REPOSITORY_URL.replace("https://", "")
    };
  }

  const { releases } = state;
  const options = releaseOptionsOf(releases.list);
  const selectedRelease = options.find((release) => release.tagName === releases.selectedTag);
  const assetOptions = usableAssetsOf(selectedRelease);
  const selectedAsset =
    assetOptions.find((asset) => asset.name === releases.selectedAssetName) ?? assetOptions[0];

  return {
    kind: "available",
    releases: options.map((release) => ({
      value: release.tagName,
      label: formatReleaseLabel(release, releases.list?.targetPlatform)
    })),
    selectedTag: releases.selectedTag,
    releaseSelectDisabled: releases.busy || options.length === 0,
    assets: assetOptions.map((asset) => ({
      value: asset.name,
      label: formatAssetLabel(asset)
    })),
    selectedAssetName: selectedAsset?.name ?? "",
    assetSelectDisabled: releases.busy || assetOptions.length === 0,
    includePrereleases: releases.includePrereleases,
    prereleasesDisabled: releases.busy,
    refreshDisabled: releases.busy,
    downloadFolder: state.downloadFolder || undefined,
    downloadEnabled:
      state.setupMode === "online" &&
      !!selectedRelease &&
      !!selectedAsset &&
      !!state.downloadFolder &&
      !releases.busy &&
      !state.busy,
    statusText: formatReleaseStatus(releases.busy, releases.error, releases.list, options),
    statusFailed: !!releases.error
  };
}

// --- The question asked before an unapplied selection is dropped.
export function discardConfirmRequest(state: SjasmplusState): ConfirmRequest {
  return {
    title: "Discard SJASMPLUS setup?",
    lines: ["This setup has not been applied yet:"],
    code: state.candidate?.executablePath ?? "",
    linesAfterCode: ["Closing now leaves SJASMPLUS unchanged."],
    confirmLabel: "Discard",
    cancelLabel: "Keep editing",
    danger: true
  };
}

// ─── Formatting ──────────────────────────────────────────────────────────────

export function formatScope(scope: SettingsScope): string {
  switch (scope) {
    case "project":
      return "Project settings";
    case "user":
      return "User settings";
    default:
      return "None";
  }
}

export function formatValidation(
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
export function nextStepHint(
  candidate: SjasmplusProbeResult | undefined,
  validation: SjasmplusProbeResult | undefined,
  busy: BusyState
): string {
  if (busy) return "";
  if (!candidate?.executablePath) return "Pick a local executable or download a release below.";
  if (!validation) return "Press Test again to check this executable.";
  return "";
}

const PLATFORM_NAMES: Record<string, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux"
};

export function formatReleaseStatus(
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

export function formatReleaseLabel(release: SjasmplusRelease, targetPlatform?: string): string {
  const prerelease = release.prerelease ? " (prerelease)" : "";
  const usable = release.compatibleAssets.length;
  const platform = (targetPlatform && PLATFORM_NAMES[targetPlatform]) || "this system";
  const suffix =
    usable > 0 ? `${usable} build${usable > 1 ? "s" : ""} for ${platform}` : `nothing for ${platform}`;
  return `${release.tagName}${prerelease} — ${suffix}`;
}

export function formatAssetLabel(asset: SjasmplusReleaseAsset): string {
  const parts = [describeAssetContent(asset)];
  if (asset.size > 0) parts.push(formatFileSize(asset.size));
  return `${asset.name} — ${parts.join(" · ")}`;
}

// --- Says what the file actually is, in words a user can act on.
export function describeAssetContent(asset: SjasmplusReleaseAsset): string {
  if (asset.kind === "source") return "source code, needs compiling";

  const platform = PLATFORM_NAMES[asset.platform];
  if (!platform) return "unrecognized build";
  const arch = asset.arch === "unknown" ? "" : ` ${asset.arch}`;
  return `${platform}${arch} build`;
}

export function formatFileSize(size: number): string {
  if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.round(size / 1024)} KB`;
  return `${size} B`;
}
