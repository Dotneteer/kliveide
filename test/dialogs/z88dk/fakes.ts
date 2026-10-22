import { vi, type Mock } from "vitest";

import type {
  Z88dkProbeResult,
  Z88dkRelease,
  Z88dkReleaseAsset,
  Z88dkReleaseListResult
} from "@common/messaging/Z88dkIntegration";
import { Z88dkController } from "@renderer/appIde/dialogs/z88dk/Z88dkController";
import {
  initialState,
  type Z88dkEnvironment,
  type Z88dkEvent,
  type Z88dkState
} from "@renderer/appIde/dialogs/z88dk/Z88dkModel";
import type { Z88dkIntent } from "@renderer/appIde/dialogs/z88dk/Z88dkIntents";
import type { Z88dkPorts, Z88dkServicePort } from "@renderer/appIde/dialogs/z88dk/Z88dkPorts";
import { selectViewModel, type Z88dkViewModel } from "@renderer/appIde/dialogs/z88dk/Z88dkViewModel";

import { harnessFor, type ControllerHarness } from "../../mvc/ControllerHarness";
import { deepMerge, type DeepPartial } from "../../mvc/fixtures";

export { deepMerge };
export type { DeepPartial };

/** Fixture builders for the z88dk dialog tests: each deep-merges an override onto a sensible default. */

// ─── Environment ─────────────────────────────────────────────────────────────

export const NO_INSTALL: Z88dkEnvironment = {
  platform: "macos",
  isKliveProject: false,
  configured: { source: "none" }
};

export const CONFIGURED_INSTALL: Z88dkEnvironment = {
  platform: "macos",
  isKliveProject: false,
  configured: { source: "user", root: "/tools/z88dk", version: "v23854-4d530b6eb7-20251002" }
};

export const anEnv = (over?: DeepPartial<Z88dkEnvironment>): Z88dkEnvironment => deepMerge(NO_INSTALL, over);
export const aConfiguredEnv = (over?: DeepPartial<Z88dkEnvironment>): Z88dkEnvironment =>
  deepMerge(CONFIGURED_INSTALL, over);

// ─── State ───────────────────────────────────────────────────────────────────

export const aState = (over?: DeepPartial<Z88dkState>, env: Z88dkEnvironment = NO_INSTALL): Z88dkState =>
  deepMerge(initialState(env), over);

export const aConfiguredState = (over?: DeepPartial<Z88dkState>): Z88dkState => aState(over, CONFIGURED_INSTALL);

export const aViewModel = (over?: DeepPartial<Z88dkViewModel>, state: Z88dkState = aState()): Z88dkViewModel =>
  deepMerge(selectViewModel(state), over);

// ─── Probe results ───────────────────────────────────────────────────────────

export const V24 = "v23854-4d530b6eb7-20251002";
export const V23 = "v22110-51889e5300-20231220";

export const okProbe = (root: string, version = V24): Z88dkProbeResult => ({
  ok: true,
  root,
  zccPath: `${root}/bin/zcc`,
  version,
  build: Number(version.slice(1, 6)),
  supported: version === V24
});

export const failProbe = (root: string, error: string): Z88dkProbeResult => ({ ok: false, root, error });

// ─── Releases ────────────────────────────────────────────────────────────────

export function anAsset(over?: Partial<Z88dkReleaseAsset>): Z88dkReleaseAsset {
  return {
    name: "z88dk-osx-2.4.zip",
    downloadUrl: "https://github.com/z88dk/z88dk/releases/download/v2.4/z88dk-osx-2.4.zip",
    size: 71934026,
    kind: "binary",
    platform: "macos",
    compatible: true,
    ...over
  };
}

export function aRelease(tagName: string, over?: Partial<Z88dkRelease>): Z88dkRelease {
  const asset = anAsset({ name: `z88dk-osx-${tagName.slice(1)}.zip` });
  return {
    tagName,
    name: tagName,
    prerelease: false,
    publishedAt: tagName === "v2.4" ? "2025-10-02T07:36:53Z" : "2023-12-20T11:20:17Z",
    htmlUrl: `https://github.com/z88dk/z88dk/releases/tag/${tagName}`,
    supported: tagName === "v2.4",
    assets: [asset],
    compatibleAssets: [asset],
    ...over
  };
}

/** v2.4 (supported) and v2.3 (older), as the service sorts them. */
export function aReleaseList(over?: Partial<Z88dkReleaseListResult>): Z88dkReleaseListResult {
  const v24 = aRelease("v2.4");
  const v23 = aRelease("v2.3");
  return {
    releases: [v24, v23],
    suggestedRelease: v24,
    suggestedAsset: v24.compatibleAssets[0],
    targetPlatform: "macos",
    ...over
  };
}

// ─── Ports ───────────────────────────────────────────────────────────────────

export type Z88dkFakePorts = {
  files: { pickFile: Mock; pickFolder: Mock };
  confirm: { confirm: Mock };
  close: { close: Mock };
  service: Record<keyof Z88dkServicePort, Mock>;
  ticker: { start: Mock; stop: Mock; tick: () => void; running: () => boolean };
};

export type Z88dkHarnessOptions = {
  env?: DeepPartial<Z88dkEnvironment>;
  configured?: boolean;
  service?: Partial<Z88dkServicePort>;
  pickFolder?: string | ((settingsKey?: string) => string | undefined);
  /** The answer every confirmation gets (or one answer per call, in order). */
  confirm?: boolean | boolean[];
};

export function fakeZ88dkPorts(over: Z88dkHarnessOptions = {}): Z88dkFakePorts {
  const service = over.service ?? {};
  const answers = Array.isArray(over.confirm) ? [...over.confirm] : undefined;
  // --- A ticker the test drives: `tick()` runs the callback the controller registered
  let callback: (() => void) | undefined;
  const stop = vi.fn(() => (callback = undefined));
  return {
    files: {
      pickFile: vi.fn(async () => undefined),
      pickFolder: vi.fn(async (key?: string) => (typeof over.pickFolder === "function" ? over.pickFolder(key) : over.pickFolder))
    },
    confirm: {
      confirm: vi.fn(async () => (answers ? (answers.shift() ?? true) : ((over.confirm as boolean | undefined) ?? true)))
    },
    close: { close: vi.fn() },
    ticker: {
      start: vi.fn((_ms: number, tick: () => void) => {
        callback = tick;
        return stop;
      }),
      stop,
      tick: () => callback?.(),
      running: () => !!callback
    },
    // --- Defaults describe a healthy, boring system: a folder probes and validates as a v2.4 install,
    // --- nothing is detected, GitHub lists nothing, the default download folder is Klive's
    service: {
      probePath: vi.fn(service.probePath ?? (async (path: string) => ({ ok: true, root: path }))),
      getPathSuggestions: vi.fn(service.getPathSuggestions ?? (async () => [])),
      listReleases: vi.fn(
        service.listReleases ?? (async (): Promise<Z88dkReleaseListResult> => ({ releases: [], targetPlatform: "macos" }))
      ),
      downloadRelease: vi.fn(service.downloadRelease ?? (async () => ({ ok: false, error: "Download not mocked." }))),
      getDownloadProgress: vi.fn(service.getDownloadProgress ?? (async () => ({ phase: "idle" as const, receivedBytes: 0 }))),
      cancelDownload: vi.fn(service.cancelDownload ?? (async () => undefined)),
      getDefaultDownloadFolder: vi.fn(service.getDefaultDownloadFolder ?? (async () => "/home/u/KliveTools/z88dk")),
      validateInstall: vi.fn(service.validateInstall ?? (async (root: string) => okProbe(root))),
      apply: vi.fn(service.apply ?? (async () => undefined))
    }
  };
}

export type Z88dkHarness = ControllerHarness<Z88dkState, Z88dkIntent, Z88dkEvent, Z88dkViewModel> & {
  ports: Z88dkFakePorts;
  env: Z88dkEnvironment;
};

export function createZ88dkDialog(over: Z88dkHarnessOptions = {}): Z88dkHarness {
  const ports = fakeZ88dkPorts(over);
  const env = over.configured ? aConfiguredEnv(over.env) : anEnv(over.env);
  const controller = new Z88dkController(ports as unknown as Z88dkPorts, env);
  return harnessFor(controller, { ports, env });
}

export async function openZ88dkDialog(over: Z88dkHarnessOptions = {}): Promise<Z88dkHarness> {
  const harness = createZ88dkDialog(over);
  await harness.dispatch({ type: "opened" });
  return harness;
}
