import { get } from "lodash";

import type {
  Z88dkDownloadProgress,
  Z88dkIntegrationScope,
  Z88dkProbeResult,
  Z88dkRelease,
  Z88dkReleaseAsset,
  Z88dkReleaseListResult
} from "@common/messaging/Z88dkIntegration";
import type { MessageKey } from "@common/i18n/keys.generated";
import { Z88DK_INSTALL_FOLDER, Z88DK_VERSION } from "@main/z88dk-integration/z88dk-config";
import type { UiReducer } from "@mvc/core/types";
import { isSamePath, normalizeSeparators, removeTrailingSeparators } from "@utils/path-compare";

/*
 * The Z88DK integration dialog (`.plans/Z88DK_INTEGRATION_PLAN.md` §4), copied from the SJASMPLUS
 * dialog and adapted, not generalised (§4): what is configured is an install *folder*, the online
 * source has a supported-version mark and a download with progress and Cancel, and Apply on an
 * unsupported version asks first (C3).
 */

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export type SettingsScope = "project" | "user" | "none";
export type SetupMode = "local" | "online";
export type BusyState = "probe" | "download" | "validate" | "apply" | undefined;
export type StatusCheck = "none" | "checking" | "passed" | "failed";
export type ValidationOrigin = "configuredCheck" | "candidate";
export type HostPlatform = "windows" | "macos" | "linux";

export const DISPLAYED_RELEASE_LIMIT = 20;
export const Z88DK_RELEASES_URL = "https://github.com/z88dk/z88dk/releases";
export const Z88DK_BUILD_WIKI_URL = "https://github.com/z88dk/z88dk/wiki/installation";

// --- The messages the reducer reports, as translation keys (the model stays text-free). `message`
// --- and `statusError` hold either one of these keys or text from outside (a service error).
export const CONFIGURED_FAILED_MESSAGE: MessageKey = "dialog.z88dk.message.configuredFailed";
export const CONFIGURED_PASSED_HINT: MessageKey = "dialog.z88dk.message.configuredPassed";
export const CONFIGURED_FAILED_HINT: MessageKey = "dialog.z88dk.message.configuredFailedHint";
export const REPLACEMENT_READY_MESSAGE: MessageKey = "dialog.z88dk.message.replacementReady";
export const CANDIDATE_REJECTED_MESSAGE: MessageKey = "dialog.z88dk.message.candidateRejected";
export const VALIDATION_PASSED_MESSAGE: MessageKey = "dialog.z88dk.message.validationPassed";
export const VALIDATION_PASSED_UNSUPPORTED_MESSAGE: MessageKey = "dialog.z88dk.message.validationPassedUnsupported";
export const VALIDATION_FAILED_MESSAGE: MessageKey = "dialog.z88dk.message.validationFailed";
export const PROBE_FAILED_MESSAGE: MessageKey = "dialog.z88dk.message.probeFailed";
export const DOWNLOAD_FAILED_MESSAGE: MessageKey = "dialog.z88dk.message.downloadFailed";
export const DOWNLOAD_CANCELLED_MESSAGE: MessageKey = "dialog.z88dk.message.downloadCancelled";
export const APPLY_SAVED_MESSAGE: MessageKey = "dialog.z88dk.message.applySaved";

export const MODEL_MESSAGE_KEYS: ReadonlySet<string> = new Set<string>([
  CONFIGURED_FAILED_MESSAGE,
  CONFIGURED_PASSED_HINT,
  CONFIGURED_FAILED_HINT,
  REPLACEMENT_READY_MESSAGE,
  CANDIDATE_REJECTED_MESSAGE,
  VALIDATION_PASSED_MESSAGE,
  VALIDATION_PASSED_UNSUPPORTED_MESSAGE,
  VALIDATION_FAILED_MESSAGE,
  PROBE_FAILED_MESSAGE,
  DOWNLOAD_FAILED_MESSAGE,
  DOWNLOAD_CANCELLED_MESSAGE,
  APPLY_SAVED_MESSAGE
]);

// ─── State ───────────────────────────────────────────────────────────────────

export type Z88dkConfigured = {
  source: SettingsScope;
  root?: string;
  version?: string;
};

export type Z88dkEnvironment = {
  platform: HostPlatform;
  isKliveProject: boolean;
  configured: Z88dkConfigured;
};

export type Z88dkReleaseState = {
  list?: Z88dkReleaseListResult;
  busy: boolean;
  error: string;
  /** Unsupported (older) releases are listed too. */
  showOlder: boolean;
  selectedTag: string;
  selectedAssetName: string;
};

export type Z88dkState = {
  env: Z88dkEnvironment;
  initialScope: Z88dkIntegrationScope;
  setupMode: SetupMode;
  scope: Z88dkIntegrationScope;
  candidate?: Z88dkProbeResult;
  validation?: Z88dkProbeResult;
  pathSuggestions: Z88dkProbeResult[];
  releases: Z88dkReleaseState;
  downloadFolder: string;
  /** What the running download reported last; undefined while none runs. */
  download?: Z88dkDownloadProgress;
  busy: BusyState;
  message: string;
  statusCheck: StatusCheck;
  statusError: string;
};

// ─── Events ──────────────────────────────────────────────────────────────────

export type Z88dkEvent =
  | { type: "envReplaced"; env: Z88dkEnvironment }
  | { type: "setupModeChanged"; mode: SetupMode }
  | { type: "scopeChanged"; scope: Z88dkIntegrationScope }
  | { type: "suggestionsLoaded"; suggestions: Z88dkProbeResult[] }
  | { type: "suggestionPicked"; suggestion: Z88dkProbeResult }
  | { type: "probeStarted" }
  | { type: "probeSettled"; result: Z88dkProbeResult }
  | { type: "validationStarted"; origin: ValidationOrigin }
  | { type: "configuredCheckSkipped" }
  | { type: "validationSettled"; origin: ValidationOrigin; requestedRoot: string; result: Z88dkProbeResult }
  | { type: "defaultDownloadFolderLoaded"; folder: string }
  | { type: "downloadFolderChanged"; folder: string }
  | { type: "downloadStarted" }
  | { type: "downloadProgressed"; progress: Z88dkDownloadProgress }
  | { type: "downloadSettled"; result: Z88dkProbeResult & { cancelled?: boolean } }
  | { type: "applyStarted" }
  | { type: "applySettled"; ok: boolean; error?: string }
  | { type: "applyDeclined" }
  | { type: "showOlderChanged"; value: boolean }
  | { type: "releaseListStarted" }
  | { type: "releaseListSettled"; result: Z88dkReleaseListResult }
  | { type: "releaseListFailed"; error: string }
  | { type: "releaseSelected"; tagName: string }
  | { type: "assetSelected"; name: string }
  | { type: "operationFailed"; message: string };

// ─── Environment reading ─────────────────────────────────────────────────────

export function readZ88dkEnvironment(
  userSettings: Record<string, any> | undefined,
  projectSettings: Record<string, any> | undefined,
  platform: HostPlatform,
  isKliveProject: boolean
): Z88dkEnvironment {
  const project = readScope(projectSettings, "project");
  const configured = project.source !== "none" ? project : readScope(userSettings, "user");
  return { platform, isKliveProject, configured };
}

/** The host platform as the renderer knows it. */
export function hostPlatformOf(isWindows: boolean, userAgentPlatform: string | undefined): HostPlatform {
  if (isWindows) return "windows";
  return /mac/i.test(userAgentPlatform ?? "") ? "macos" : "linux";
}

function readScope(settings: Record<string, any> | undefined, source: SettingsScope): Z88dkConfigured {
  const root = readString(settings, Z88DK_INSTALL_FOLDER);
  if (!root) return { source: "none" };
  const version = readString(settings, Z88DK_VERSION);
  return { source, root: removeTrailingSeparators(normalizeSeparators(root)), version: version || undefined };
}

function readString(settings: Record<string, any> | undefined, key: string): string {
  const value = get(settings, key);
  return typeof value === "string" ? value.trim() : "";
}

// ─── Initial state ───────────────────────────────────────────────────────────

export function initialScopeOf(env: Z88dkEnvironment): Z88dkIntegrationScope {
  return env.configured.source === "project" ? "project" : "user";
}

export function initialState(env: Z88dkEnvironment): Z88dkState {
  const { configured } = env;
  return {
    env,
    initialScope: initialScopeOf(env),
    setupMode: "local",
    scope: initialScopeOf(env),
    candidate:
      configured.source === "none" ? undefined : { ok: true, root: configured.root, version: configured.version },
    validation: undefined,
    pathSuggestions: [],
    releases: { list: undefined, busy: false, error: "", showOlder: false, selectedTag: "", selectedAssetName: "" },
    downloadFolder: "",
    download: undefined,
    busy: undefined,
    message: "",
    statusCheck: configured.source === "none" ? "none" : "checking",
    statusError: ""
  };
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export const reduce: UiReducer<Z88dkState, Z88dkEvent> = (state, event) => {
  switch (event.type) {
    case "envReplaced":
      return sameEnvironment(state.env, event.env)
        ? state
        : { ...state, env: event.env, initialScope: initialScopeOf(event.env) };

    case "setupModeChanged":
      return state.setupMode === event.mode ? state : { ...state, setupMode: event.mode, message: "" };

    case "scopeChanged":
      return state.scope === event.scope ? state : { ...state, scope: event.scope };

    case "suggestionsLoaded":
      return { ...state, pathSuggestions: event.suggestions };

    case "suggestionPicked":
      return { ...state, candidate: event.suggestion, validation: undefined, message: "" };

    case "probeStarted":
      return { ...state, busy: "probe", message: "", validation: undefined };

    case "probeSettled":
      return {
        ...state,
        candidate: event.result,
        busy: event.result.ok ? "validate" : undefined,
        message: event.result.ok ? state.message : event.result.error ?? PROBE_FAILED_MESSAGE
      };

    case "validationStarted":
      return event.origin === "configuredCheck"
        ? { ...state, busy: "validate", statusCheck: "checking", statusError: "" }
        : { ...state, busy: "validate", message: "" };

    case "configuredCheckSkipped":
      return { ...state, statusCheck: "none", statusError: "" };

    case "validationSettled": {
      const merged: Z88dkProbeResult = { ok: false, ...event.result, root: event.result?.root ?? event.requestedRoot };
      const isConfigured = isSamePath(merged.root, state.env.configured.root, state.env.platform === "windows");
      return {
        ...state,
        busy: undefined,
        validation: merged,
        candidate: merged,
        statusCheck: isConfigured ? (merged.ok ? "passed" : "failed") : state.statusCheck,
        statusError: isConfigured ? (merged.ok ? "" : merged.error ?? CONFIGURED_FAILED_MESSAGE) : state.statusError,
        message: verdictMessage(event.origin, merged)
      };
    }

    case "defaultDownloadFolderLoaded":
      // --- Never overwrites a folder the user already picked
      return state.downloadFolder ? state : { ...state, downloadFolder: event.folder };

    case "downloadFolderChanged":
      return { ...state, downloadFolder: event.folder, message: "" };

    case "downloadStarted":
      return {
        ...state,
        busy: "download",
        message: "",
        validation: undefined,
        download: { phase: "downloading", receivedBytes: 0, totalBytes: selectedAssetOf(state)?.size || undefined }
      };

    case "downloadProgressed":
      // --- A late poll after the download settled must not bring the progress row back
      return state.busy !== "download" || event.progress.phase === "idle"
        ? state
        : { ...state, download: event.progress };

    case "downloadSettled": {
      const { result } = event;
      if (result.cancelled) {
        return { ...state, busy: undefined, download: undefined, message: DOWNLOAD_CANCELLED_MESSAGE };
      }
      // --- The service tested the install before moving it into place: its verdict is the validation
      return result.ok
        ? {
            ...state,
            busy: undefined,
            download: undefined,
            candidate: result,
            validation: result,
            message: result.supported === false ? VALIDATION_PASSED_UNSUPPORTED_MESSAGE : VALIDATION_PASSED_MESSAGE
          }
        : {
            ...state,
            busy: undefined,
            download: undefined,
            message: result.error ?? DOWNLOAD_FAILED_MESSAGE
          };
    }

    case "applyStarted":
      return { ...state, busy: "apply", message: "" };

    case "applySettled":
      return { ...state, busy: undefined, message: event.ok ? APPLY_SAVED_MESSAGE : event.error ?? "" };

    case "applyDeclined":
      return state.busy === undefined ? state : { ...state, busy: undefined };

    case "showOlderChanged": {
      if (state.releases.showOlder === event.value) return state;
      const releases = { ...state.releases, showOlder: event.value };
      // --- Hiding the older releases may hide the selected one
      const options = releaseOptionsOf(releases);
      const keep = options.some((r) => r.tagName === releases.selectedTag);
      return {
        ...state,
        releases: keep
          ? releases
          : { ...releases, selectedTag: options[0]?.tagName ?? "", selectedAssetName: usableAssetsOf(options[0])[0]?.name ?? "" }
      };
    }

    case "releaseListStarted":
      return { ...state, releases: { ...state.releases, busy: true, error: "" } };

    case "releaseListSettled": {
      const releases = { ...state.releases, list: event.result, busy: false, error: "" };
      const options = releaseOptionsOf(releases);
      const suggested =
        event.result.suggestedRelease && options.some((r) => r.tagName === event.result.suggestedRelease?.tagName)
          ? event.result.suggestedRelease
          : options[0];
      return {
        ...state,
        releases: {
          ...releases,
          selectedTag: suggested?.tagName ?? "",
          selectedAssetName:
            (suggested === event.result.suggestedRelease ? event.result.suggestedAsset?.name : undefined) ??
            usableAssetsOf(suggested)[0]?.name ??
            ""
        }
      };
    }

    case "releaseListFailed":
      return {
        ...state,
        releases: { ...state.releases, list: undefined, busy: false, error: event.error, selectedTag: "", selectedAssetName: "" }
      };

    case "releaseSelected": {
      const release = releaseOptionsOf(state.releases).find((r) => r.tagName === event.tagName);
      return {
        ...state,
        releases: { ...state.releases, selectedTag: event.tagName, selectedAssetName: usableAssetsOf(release)[0]?.name ?? "" }
      };
    }

    case "assetSelected":
      return { ...state, releases: { ...state.releases, selectedAssetName: event.name } };

    case "operationFailed":
      return { ...state, busy: undefined, download: undefined, message: event.message };

    default:
      return state;
  }
};

export function sameEnvironment(left: Z88dkEnvironment, right: Z88dkEnvironment): boolean {
  return (
    left.platform === right.platform &&
    left.isKliveProject === right.isKliveProject &&
    left.configured.source === right.configured.source &&
    left.configured.root === right.configured.root &&
    left.configured.version === right.configured.version
  );
}

/** The folder the dialog re-tests on open; a change here (and only here) restarts that check. */
export function configuredCheckSubject(env: Z88dkEnvironment): string | undefined {
  return env.configured.source === "none" ? undefined : env.configured.root;
}

function verdictMessage(origin: ValidationOrigin, merged: Z88dkProbeResult): string {
  if (origin === "configuredCheck") return merged.ok ? CONFIGURED_PASSED_HINT : CONFIGURED_FAILED_HINT;
  if (!merged.ok) return merged.error ?? VALIDATION_FAILED_MESSAGE;
  return merged.supported === false ? VALIDATION_PASSED_UNSUPPORTED_MESSAGE : VALIDATION_PASSED_MESSAGE;
}

// ─── Shared derivations ──────────────────────────────────────────────────────

/** Downloads exist for Windows and macOS only (`.ai/z88dk/releases.md`). */
export function onlineAvailable(env: Z88dkEnvironment): boolean {
  return env.platform === "windows" || env.platform === "macos";
}

/**
 * The releases the dropdown offers: the supported ones, plus the older ones when asked for. When no
 * release is supported (an old cached list), all of them, so the dropdown is never empty for no reason.
 */
export function releaseOptionsOf(releases: Pick<Z88dkReleaseState, "list" | "showOlder">): Z88dkRelease[] {
  const all = releases.list?.releases ?? [];
  const supported = all.filter((release) => release.supported);
  const shown = releases.showOlder || supported.length === 0 ? all : supported;
  return shown.slice(0, DISPLAYED_RELEASE_LIMIT);
}

export function usableAssetsOf(release: Z88dkRelease | undefined): Z88dkReleaseAsset[] {
  return release?.compatibleAssets ?? [];
}

export function selectedReleaseOf(state: Z88dkState): Z88dkRelease | undefined {
  return releaseOptionsOf(state.releases).find((release) => release.tagName === state.releases.selectedTag);
}

export function selectedAssetOf(state: Z88dkState): Z88dkReleaseAsset | undefined {
  const assets = usableAssetsOf(selectedReleaseOf(state));
  return assets.find((asset) => asset.name === state.releases.selectedAssetName) ?? assets[0];
}

/** Has the tested candidate a version outside the supported range (C3)? */
export function isUnsupportedCandidate(state: Z88dkState): boolean {
  return state.validation?.ok === true && state.validation.supported === false;
}
