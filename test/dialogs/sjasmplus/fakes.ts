import { vi, type Mock } from "vitest";

import type {
  SjasmplusProbeResult,
  SjasmplusRelease,
  SjasmplusReleaseAsset,
  SjasmplusReleaseListResult
} from "@common/messaging/SjasmplusIntegration";
import { SjasmplusController } from "@renderer/appIde/dialogs/sjasmplus/SjasmplusController";
import {
  initialState,
  type SjasmplusEnvironment,
  type SjasmplusEvent,
  type SjasmplusState
} from "@renderer/appIde/dialogs/sjasmplus/SjasmplusModel";
import type { SjasmplusIntent } from "@renderer/appIde/dialogs/sjasmplus/SjasmplusIntents";
import type {
  SjasmplusPorts,
  SjasmplusServicePort
} from "@renderer/appIde/dialogs/sjasmplus/SjasmplusPorts";
import {
  selectViewModel,
  type SjasmplusViewModel
} from "@renderer/appIde/dialogs/sjasmplus/SjasmplusViewModel";
import { getPathFolder } from "@utils/path-compare";

import { harnessFor, type ControllerHarness } from "../../mvc/ControllerHarness";
import { deepMerge, type DeepPartial } from "../../mvc/fixtures";

// --- Re-exported so a suite imports its whole fixture vocabulary from one file.
export { deepMerge };
export type { DeepPartial };

/**
 * Fixture builders for the SJASMPLUS dialog tests.
 *
 * Every builder deep-merges an override onto a sensible default, so a test
 * names only the field it is actually about.
 */

// ─── Environment ─────────────────────────────────────────────────────────────

export const NO_INSTALL: SjasmplusEnvironment = {
  isWindows: false,
  isKliveProject: false,
  configured: { source: "none" }
};

export const CONFIGURED_INSTALL: SjasmplusEnvironment = {
  isWindows: false,
  isKliveProject: false,
  configured: {
    source: "user",
    installFolder: "/tools/sjasmplus",
    executablePath: "/tools/sjasmplus/sjasmplus",
    version: "v1.24.0"
  }
};

export const anEnv = (over?: DeepPartial<SjasmplusEnvironment>): SjasmplusEnvironment =>
  deepMerge(NO_INSTALL, over);

export const aConfiguredEnv = (over?: DeepPartial<SjasmplusEnvironment>): SjasmplusEnvironment =>
  deepMerge(CONFIGURED_INSTALL, over);

// ─── State ───────────────────────────────────────────────────────────────────

export const aState = (
  over?: DeepPartial<SjasmplusState>,
  env: SjasmplusEnvironment = NO_INSTALL
): SjasmplusState => deepMerge(initialState(env), over);

export const aConfiguredState = (over?: DeepPartial<SjasmplusState>): SjasmplusState =>
  aState(over, CONFIGURED_INSTALL);

// --- Derived from a real state, so a field the model gains cannot be missed
// --- here; the override names only what the test is about.
export const aViewModel = (
  over?: DeepPartial<SjasmplusViewModel>,
  state: SjasmplusState = aState()
): SjasmplusViewModel => deepMerge(selectViewModel(state), over);

// ─── Probe results ───────────────────────────────────────────────────────────

export const okProbe = (executablePath: string, version?: string): SjasmplusProbeResult => ({
  ok: true,
  executablePath,
  installFolder: getPathFolder(executablePath),
  version
});

export const failProbe = (executablePath: string, error: string): SjasmplusProbeResult => ({
  ok: false,
  executablePath,
  installFolder: getPathFolder(executablePath),
  error
});

// ─── Releases ────────────────────────────────────────────────────────────────

export function anAsset(over?: Partial<SjasmplusReleaseAsset>): SjasmplusReleaseAsset {
  return {
    name: "sjasmplus-1.24.0.win.zip",
    downloadUrl: "https://github.com/z00m128/sjasmplus/releases/download/v1.24.0/sjasmplus.zip",
    size: 2048,
    kind: "binary",
    platform: "windows",
    arch: "x64",
    compatible: true,
    ...over
  };
}

export function aRelease(
  tagName: string,
  over?: Partial<SjasmplusRelease>
): SjasmplusRelease {
  const asset = anAsset();
  return {
    tagName,
    name: tagName,
    prerelease: false,
    publishedAt: "2026-01-01T00:00:00Z",
    htmlUrl: `https://github.com/z00m128/sjasmplus/releases/tag/${tagName}`,
    assets: [asset],
    compatibleAssets: [asset],
    ...over
  };
}

export function aReleaseList(
  over?: Partial<SjasmplusReleaseListResult>
): SjasmplusReleaseListResult {
  const release = aRelease("v1.24.0");
  return {
    releases: [release],
    suggestedRelease: release,
    suggestedAsset: release.assets[0],
    targetPlatform: "windows",
    ...over
  };
}


// ─── Ports ───────────────────────────────────────────────────────────────────

export type SjasmplusFakePorts = {
  files: { pickFile: Mock; pickFolder: Mock };
  confirm: { confirm: Mock };
  close: { close: Mock };
  service: Record<keyof SjasmplusServicePort, Mock>;
};

export type SjasmplusHarnessOptions = {
  env?: DeepPartial<SjasmplusEnvironment>;
  // --- Start from a configured install rather than an empty one.
  configured?: boolean;
  // --- Per-method overrides; anything omitted keeps a working default.
  service?: Partial<SjasmplusServicePort>;
  // --- What the pickers return; undefined means the user dismissed them.
  pickFile?: string;
  pickFolder?: string;
  // --- The answer the discard prompt gets.
  confirm?: boolean;
};

export function fakeSjasmplusPorts(over: SjasmplusHarnessOptions = {}): SjasmplusFakePorts {
  const service = over.service ?? {};
  return {
    files: {
      pickFile: vi.fn(async () => over.pickFile),
      pickFolder: vi.fn(async () => over.pickFolder)
    },
    confirm: { confirm: vi.fn(async () => over.confirm ?? true) },
    close: { close: vi.fn() },
    // --- Defaults describe a healthy, boring system: a path probes and
    // --- validates as itself, PATH holds nothing, GitHub lists nothing.
    service: {
      probePath: vi.fn(service.probePath ?? (async (path: string) => okProbe(path))),
      getPathSuggestions: vi.fn(service.getPathSuggestions ?? (async () => [])),
      listReleases: vi.fn(
        service.listReleases ??
          (async (): Promise<SjasmplusReleaseListResult> => ({
            releases: [],
            targetPlatform: "windows"
          }))
      ),
      downloadRelease: vi.fn(
        service.downloadRelease ?? (async () => ({ ok: false, error: "Download not mocked." }))
      ),
      validateExecutable: vi.fn(
        service.validateExecutable ?? (async (path: string) => okProbe(path))
      ),
      apply: vi.fn(service.apply ?? (async () => undefined))
    }
  };
}

export type SjasmplusHarness = ControllerHarness<
  SjasmplusState,
  SjasmplusIntent,
  SjasmplusEvent,
  SjasmplusViewModel
> & {
  ports: SjasmplusFakePorts;
  env: SjasmplusEnvironment;
};

/**
 * Builds a controller over fake ports without opening it. Use this when the
 * opening sequence itself is what the test is about.
 */
export function createSjasmplusDialog(over: SjasmplusHarnessOptions = {}): SjasmplusHarness {
  const ports = fakeSjasmplusPorts(over);
  const env = over.configured ? aConfiguredEnv(over.env) : anEnv(over.env);
  const controller = new SjasmplusController(ports as unknown as SjasmplusPorts, env);
  // --- Never spread the harness: `state`, `vm` and `events` are live getters.
  return harnessFor(controller, { ports, env });
}

/**
 * Builds a controller and runs the opening sequence — where every test about
 * later interactions should start, because that is what the user sees.
 */
export async function openSjasmplusDialog(
  over: SjasmplusHarnessOptions = {}
): Promise<SjasmplusHarness> {
  const harness = createSjasmplusDialog(over);
  await harness.dispatch({ type: "opened" });
  return harness;
}
