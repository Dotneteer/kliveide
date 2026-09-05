import { get } from "lodash";

import type {
  SjasmplusIntegrationScope,
  SjasmplusProbeResult,
  SjasmplusRelease,
  SjasmplusReleaseAsset,
  SjasmplusReleaseListResult
} from "@common/messaging/SjasmplusIntegration";
import {
  SJASMP_CONFIGURED_FAILED_MESSAGE,
  SJASMP_EXECUTABLE_PATH,
  SJASMP_INSTALL_FOLDER,
  SJASMP_VERSION
} from "@main/sjasmp-integration/sjasmp-config";
import type { UiReducer } from "@mvc/core/types";
import { getPathFolder, isSamePath, normalizeSeparators, removeTrailingSeparators } from "@utils/path-compare";

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export type SettingsScope = "project" | "user" | "none";
export type SetupMode = "local" | "online";
export type BusyState = "probe" | "download" | "validate" | "apply" | undefined;
// --- Verdict on the executable the settings point at. Saved settings alone say
// --- nothing about it: the folder may have been moved or deleted since setup.
export type StatusCheck = "none" | "checking" | "passed" | "failed";

// --- Which smoke test a verdict belongs to. A verdict on the configured
// --- executable reports on the integration; one on a candidate reports on what
// --- Apply would save. They earn different messages.
export type ValidationOrigin = "configuredCheck" | "candidate";

export const DISPLAYED_RELEASE_LIMIT = 20;
export const SJASMPLUS_REPOSITORY_URL = "https://github.com/z00m128/sjasmplus";

// --- Shared with the compiler, so a failed build says what the dialog says.
export const CONFIGURED_FAILED_MESSAGE = SJASMP_CONFIGURED_FAILED_MESSAGE;
export const CONFIGURED_PASSED_HINT = "The configured executable passed its test.";
export const CONFIGURED_FAILED_HINT =
  "Pick a working executable below, or restore the missing one and press Test again.";
export const REPLACEMENT_READY_MESSAGE = "Press Apply to replace it with the executable below.";
export const CANDIDATE_REJECTED_MESSAGE = "Unchanged — the executable below failed its test.";
export const VALIDATION_PASSED_MESSAGE =
  "The smoke-test compile succeeded, press Apply to save it.";
export const VALIDATION_FAILED_MESSAGE =
  "The smoke-test compile failed, so this executable cannot be saved.";
export const PROBE_FAILED_MESSAGE = "The selected path is not a valid SJASMPLUS candidate.";
export const DOWNLOAD_FAILED_MESSAGE = "SJASMPLUS release download failed.";
export const APPLY_SAVED_MESSAGE = "SJASMPLUS integration saved.";

// ─── State ───────────────────────────────────────────────────────────────────

// --- What the settings currently point at, whether or not it still works.
export type SjasmplusConfigured = {
  source: SettingsScope;
  installFolder?: string;
  executablePath?: string;
  version?: string;
};

// --- Everything the dialog reads from outside itself. Pushed in as data, so no
// --- layer below the container needs to know Redux exists.
export type SjasmplusEnvironment = {
  isWindows: boolean;
  isKliveProject: boolean;
  configured: SjasmplusConfigured;
};

export type SjasmplusReleaseState = {
  list?: SjasmplusReleaseListResult;
  busy: boolean;
  error: string;
  includePrereleases: boolean;
  selectedTag: string;
  selectedAssetName: string;
};

export type SjasmplusState = {
  env: SjasmplusEnvironment;
  // --- The scope the settings already use. Apply changing it is a pending
  // --- change even when the executable stays the same.
  initialScope: SjasmplusIntegrationScope;
  setupMode: SetupMode;
  scope: SjasmplusIntegrationScope;
  candidate?: SjasmplusProbeResult;
  validation?: SjasmplusProbeResult;
  pathSuggestions: SjasmplusProbeResult[];
  releases: SjasmplusReleaseState;
  downloadFolder: string;
  busy: BusyState;
  message: string;
  statusCheck: StatusCheck;
  statusError: string;
};

// ─── Events ──────────────────────────────────────────────────────────────────

export type SjasmplusEvent =
  | { type: "envReplaced"; env: SjasmplusEnvironment }
  | { type: "setupModeChanged"; mode: SetupMode }
  | { type: "scopeChanged"; scope: SjasmplusIntegrationScope }
  | { type: "suggestionsLoaded"; suggestions: SjasmplusProbeResult[] }
  | { type: "suggestionPicked"; suggestion: SjasmplusProbeResult }
  | { type: "probeStarted" }
  | { type: "probeSettled"; result: SjasmplusProbeResult }
  | { type: "validationStarted"; origin: ValidationOrigin }
  | { type: "configuredCheckSkipped" }
  | {
      type: "validationSettled";
      origin: ValidationOrigin;
      requestedPath: string;
      result: SjasmplusProbeResult;
    }
  | { type: "downloadFolderChanged"; folder: string }
  | { type: "downloadStarted" }
  | { type: "downloadSettled"; result: SjasmplusProbeResult }
  | { type: "applyStarted" }
  | { type: "applySettled"; ok: boolean; error?: string }
  | { type: "prereleasesChanged"; value: boolean }
  | { type: "releaseListStarted" }
  | { type: "releaseListSettled"; result: SjasmplusReleaseListResult }
  | { type: "releaseListFailed"; error: string }
  | { type: "releaseSelected"; tagName: string }
  | { type: "assetSelected"; name: string }
  // --- An operation that failed in a way that produced no verdict of its own.
  | { type: "operationFailed"; message: string };

// ─── Environment reading ─────────────────────────────────────────────────────

export function readSjasmplusEnvironment(
  userSettings: Record<string, any> | undefined,
  projectSettings: Record<string, any> | undefined,
  isWindows: boolean,
  isKliveProject: boolean
): SjasmplusEnvironment {
  return { isWindows, isKliveProject, configured: readConfigured(userSettings, projectSettings, isWindows) };
}

function readConfigured(
  userSettings: Record<string, any> | undefined,
  projectSettings: Record<string, any> | undefined,
  isWindows: boolean
): SjasmplusConfigured {
  // --- Project settings win: they are the narrower scope.
  const projectStatus = readScope(projectSettings, "project", isWindows);
  if (projectStatus.source !== "none") return projectStatus;

  const userStatus = readScope(userSettings, "user", isWindows);
  if (userStatus.source !== "none") return userStatus;

  return { source: "none" };
}

function readScope(
  settings: Record<string, any> | undefined,
  source: SettingsScope,
  isWindows: boolean
): SjasmplusConfigured {
  const installFolder = readStringSetting(settings, SJASMP_INSTALL_FOLDER);
  const executablePath = readStringSetting(settings, SJASMP_EXECUTABLE_PATH);
  const version = readStringSetting(settings, SJASMP_VERSION);
  if (!installFolder && !executablePath) return { source: "none" };

  // --- Settings can carry either separator: the `sjasm` command stores the path
  // --- the user typed, while the main process always hands back forward slashes.
  // --- Normalizing here keeps the displayed path and the probe results in the
  // --- same shape, so they can be compared later.
  const normalizedFolder = normalizeSeparators(installFolder || getPathFolder(executablePath));
  return {
    source,
    installFolder: normalizedFolder,
    executablePath:
      normalizeSeparators(executablePath) ||
      `${removeTrailingSeparators(normalizedFolder)}/${isWindows ? "sjasmplus.exe" : "sjasmplus"}`,
    version: version || undefined
  };
}

function readStringSetting(settings: Record<string, any> | undefined, key: string): string {
  const value = get(settings, key);
  return typeof value === "string" ? value.trim() : "";
}

// ─── Initial state ───────────────────────────────────────────────────────────

export function initialScopeOf(env: SjasmplusEnvironment): SjasmplusIntegrationScope {
  return env.configured.source === "project" ? "project" : "user";
}

export function initialState(env: SjasmplusEnvironment): SjasmplusState {
  const { configured } = env;
  return {
    env,
    initialScope: initialScopeOf(env),
    setupMode: "local",
    scope: initialScopeOf(env),
    // --- The configured install starts out as the candidate so "Test again"
    // --- has something to re-test without the user reselecting it.
    candidate:
      configured.source === "none"
        ? undefined
        : {
            ok: true,
            installFolder: configured.installFolder,
            executablePath: configured.executablePath,
            version: configured.version
          },
    validation: undefined,
    pathSuggestions: [],
    releases: {
      list: undefined,
      busy: false,
      error: "",
      includePrereleases: false,
      selectedTag: "",
      selectedAssetName: ""
    },
    downloadFolder: "",
    busy: undefined,
    message: "",
    statusCheck:
      configured.source === "none" || !configured.executablePath ? "none" : "checking",
    statusError: ""
  };
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export const reduce: UiReducer<SjasmplusState, SjasmplusEvent> = (state, event) => {
  switch (event.type) {
    case "envReplaced":
      // --- A settings change re-dates what "unchanged" means, but never throws
      // --- away a selection the user is in the middle of making. An unrelated
      // --- settings write reaches the container as a fresh object; ignoring it
      // --- here is what stops a re-render loop.
      return sameEnvironment(state.env, event.env)
        ? state
        : { ...state, env: event.env, initialScope: initialScopeOf(event.env) };

    case "setupModeChanged":
      return state.setupMode === event.mode
        ? state
        : { ...state, setupMode: event.mode, validation: undefined, message: "" };

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
        // --- A usable candidate goes straight into its smoke test, so the busy
        // --- label never blinks back to idle in between.
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
      const merged = mergeVerdict(event.result, event.requestedPath);
      // --- A verdict on the executable the settings point at is a verdict on
      // --- the integration itself: putting a missing folder back and pressing
      // --- "Test again" has to clear the failure, not just change the hint.
      const isConfigured = isSamePath(
        merged.executablePath,
        state.env.configured.executablePath,
        state.env.isWindows
      );
      return {
        ...state,
        busy: undefined,
        validation: merged,
        candidate: merged,
        statusCheck: isConfigured ? (merged.ok ? "passed" : "failed") : state.statusCheck,
        statusError: isConfigured
          ? merged.ok
            ? ""
            : merged.error ?? CONFIGURED_FAILED_MESSAGE
          : state.statusError,
        message: verdictMessage(event.origin, merged)
      };
    }

    case "downloadFolderChanged":
      return {
        ...state,
        downloadFolder: event.folder,
        validation: undefined,
        message: ""
      };

    case "downloadStarted":
      return { ...state, busy: "download", message: "", validation: undefined };

    case "downloadSettled":
      return {
        ...state,
        candidate: event.result,
        busy: event.result.ok ? "validate" : undefined,
        message: event.result.ok ? state.message : event.result.error ?? DOWNLOAD_FAILED_MESSAGE
      };

    case "applyStarted":
      return { ...state, busy: "apply", message: "" };

    case "applySettled":
      return {
        ...state,
        busy: undefined,
        message: event.ok ? APPLY_SAVED_MESSAGE : event.error ?? ""
      };

    case "prereleasesChanged":
      return state.releases.includePrereleases === event.value
        ? state
        : { ...state, releases: { ...state.releases, includePrereleases: event.value } };

    case "releaseListStarted":
      return { ...state, releases: { ...state.releases, busy: true, error: "" } };

    case "releaseListSettled": {
      const options = releaseOptionsOf(event.result);
      // --- The service's suggestion only counts when it survived the display
      // --- limit; otherwise the newest listed release is the sensible default.
      const suggested =
        event.result.suggestedRelease &&
        options.some((release) => release.tagName === event.result.suggestedRelease?.tagName)
          ? event.result.suggestedRelease
          : options[0];
      return {
        ...state,
        releases: {
          ...state.releases,
          list: event.result,
          busy: false,
          error: "",
          selectedTag: suggested?.tagName ?? "",
          selectedAssetName:
            event.result.suggestedAsset?.name ?? suggested?.assets[0]?.name ?? ""
        }
      };
    }

    case "releaseListFailed":
      return {
        ...state,
        releases: {
          ...state.releases,
          list: undefined,
          busy: false,
          error: event.error,
          selectedTag: "",
          selectedAssetName: ""
        }
      };

    case "releaseSelected": {
      const release = releaseOptionsOf(state.releases.list).find(
        (item) => item.tagName === event.tagName
      );
      return {
        ...state,
        releases: {
          ...state.releases,
          selectedTag: event.tagName,
          // --- A release change invalidates the asset chosen from the old one.
          selectedAssetName: usableAssetsOf(release)[0]?.name ?? ""
        }
      };
    }

    case "assetSelected":
      return { ...state, releases: { ...state.releases, selectedAssetName: event.name } };

    case "operationFailed":
      return { ...state, busy: undefined, message: event.message };

    default:
      return state;
  }
};

export function sameEnvironment(
  left: SjasmplusEnvironment,
  right: SjasmplusEnvironment
): boolean {
  return (
    left.isWindows === right.isWindows &&
    left.isKliveProject === right.isKliveProject &&
    sameConfigured(left.configured, right.configured)
  );
}

function sameConfigured(left: SjasmplusConfigured, right: SjasmplusConfigured): boolean {
  return (
    left.source === right.source &&
    left.installFolder === right.installFolder &&
    left.executablePath === right.executablePath &&
    left.version === right.version
  );
}

// --- The executable the dialog re-tests on open. A change here — and only
// --- here — has to restart that check.
export function configuredCheckSubject(env: SjasmplusEnvironment): string | undefined {
  return env.configured.source === "none" ? undefined : env.configured.executablePath;
}

// --- Records a verdict against the executable it was requested for. A probe
// --- that cannot resolve the path (a deleted folder) returns no path of its
// --- own, so the requested one is carried over and the dialog keeps saying
// --- which executable failed.
function mergeVerdict(
  result: SjasmplusProbeResult | undefined,
  requestedPath: string
): SjasmplusProbeResult {
  return {
    ok: false,
    ...result,
    executablePath: result?.executablePath ?? requestedPath,
    installFolder: result?.installFolder ?? getPathFolder(requestedPath)
  };
}

function verdictMessage(origin: ValidationOrigin, merged: SjasmplusProbeResult): string {
  if (origin === "configuredCheck") {
    // --- The failure itself is already reported next to the configured install,
    // --- so this only says what to do about it.
    return merged.ok ? CONFIGURED_PASSED_HINT : CONFIGURED_FAILED_HINT;
  }
  return merged.ok ? VALIDATION_PASSED_MESSAGE : merged.error ?? VALIDATION_FAILED_MESSAGE;
}

// ─── Shared derivations ──────────────────────────────────────────────────────

export function releaseOptionsOf(
  list: SjasmplusReleaseListResult | undefined
): SjasmplusRelease[] {
  return list?.releases.slice(0, DISPLAYED_RELEASE_LIMIT) ?? [];
}

// --- Only assets that can actually be installed here. Source archives and other
// --- platforms' builds are never offered.
export function usableAssetsOf(
  release: SjasmplusRelease | undefined
): SjasmplusReleaseAsset[] {
  return release?.compatibleAssets ?? [];
}

export function selectedReleaseOf(state: SjasmplusState): SjasmplusRelease | undefined {
  return releaseOptionsOf(state.releases.list).find(
    (release) => release.tagName === state.releases.selectedTag
  );
}

// --- Falls back to the first usable asset: the picker shows that one selected
// --- when the stored name matches nothing.
export function selectedAssetOf(state: SjasmplusState): SjasmplusReleaseAsset | undefined {
  const assets = usableAssetsOf(selectedReleaseOf(state));
  return assets.find((asset) => asset.name === state.releases.selectedAssetName) ?? assets[0];
}
