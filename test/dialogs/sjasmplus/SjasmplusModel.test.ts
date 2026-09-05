import { describe, expect, it } from "vitest";

import {
  SJASMP_EXECUTABLE_PATH,
  SJASMP_INSTALL_FOLDER,
  SJASMP_VERSION
} from "@main/sjasmp-integration/sjasmp-config";
import {
  APPLY_SAVED_MESSAGE,
  CONFIGURED_FAILED_HINT,
  CONFIGURED_FAILED_MESSAGE,
  CONFIGURED_PASSED_HINT,
  DOWNLOAD_FAILED_MESSAGE,
  PROBE_FAILED_MESSAGE,
  VALIDATION_PASSED_MESSAGE,
  initialState,
  readSjasmplusEnvironment,
  reduce
} from "@renderer/appIde/dialogs/sjasmplus/SjasmplusModel";

import {
  aConfiguredEnv,
  aConfiguredState,
  aRelease,
  aReleaseList,
  aState,
  anAsset,
  anEnv,
  failProbe,
  okProbe
} from "./fakes";

describe("readSjasmplusEnvironment", () => {
  it("reports no install when neither scope defines one", () => {
    expect(readSjasmplusEnvironment({}, {}, false, false).configured).toEqual({ source: "none" });
  });

  it("derives the executable from the install folder on posix", () => {
    const env = readSjasmplusEnvironment(
      { sjasmp: { root: "/tools/sjasmplus" } },
      undefined,
      false,
      false
    );

    expect(env.configured).toMatchObject({
      source: "user",
      installFolder: "/tools/sjasmplus",
      executablePath: "/tools/sjasmplus/sjasmplus"
    });
  });

  it("derives the .exe name on Windows and normalizes the separators", () => {
    const env = readSjasmplusEnvironment(
      { sjasmp: { root: "C:\\tools\\sjasmplus\\" } },
      undefined,
      true,
      false
    );

    expect(env.configured.executablePath).toBe("C:/tools/sjasmplus/sjasmplus.exe");
  });

  it("prefers an explicit executable path over the install folder", () => {
    const env = readSjasmplusEnvironment(
      {
        sjasmp: {
          root: "/tools/sjasmplus",
          executablePath: "/custom/bin/sjasmplus",
          version: "sjasmplus v1.23.0"
        }
      },
      undefined,
      false,
      false
    );

    expect(env.configured).toMatchObject({
      executablePath: "/custom/bin/sjasmplus",
      version: "sjasmplus v1.23.0"
    });
  });

  it("lets project settings win over user settings", () => {
    const env = readSjasmplusEnvironment(
      { sjasmp: { root: "/user/sjasmplus" } },
      { sjasmp: { root: "/project/sjasmplus" } },
      false,
      true
    );

    // --- The narrower scope is the effective one
    expect(env.configured.source).toBe("project");
    expect(env.configured.executablePath).toBe("/project/sjasmplus/sjasmplus");
  });

  it("ignores blank and non-string settings", () => {
    expect(
      readSjasmplusEnvironment({ sjasmp: { root: "   ", executablePath: 42 } }, {}, false, false)
        .configured
    ).toEqual({ source: "none" });
  });

  it("uses the exported SJASMPLUS setting keys", () => {
    expect(SJASMP_INSTALL_FOLDER).toBe("sjasmp.root");
    expect(SJASMP_EXECUTABLE_PATH).toBe("sjasmp.executablePath");
    expect(SJASMP_VERSION).toBe("sjasmp.version");
  });
});

describe("initialState", () => {
  it("starts with nothing selected and no check pending when nothing is configured", () => {
    const state = initialState(anEnv());

    expect(state.candidate).toBeUndefined();
    expect(state.statusCheck).toBe("none");
    expect(state.scope).toBe("user");
  });

  it("seeds the candidate from the configured install so Test again has a subject", () => {
    const state = initialState(aConfiguredEnv());

    expect(state.candidate).toMatchObject({
      ok: true,
      executablePath: "/tools/sjasmplus/sjasmplus",
      installFolder: "/tools/sjasmplus"
    });
    // --- Settings survive whatever happens to the disk, so the configured
    // --- install is unverified until it has been re-tested.
    expect(state.statusCheck).toBe("checking");
  });

  it("defaults the save scope to the scope already in use", () => {
    expect(initialState(aConfiguredEnv({ configured: { source: "project" } })).scope).toBe(
      "project"
    );
  });
});

describe("reduce", () => {
  describe("validationSettled", () => {
    it("carries the requested path into a verdict that resolved nothing", () => {
      const next = reduce(aState(), {
        type: "validationSettled",
        origin: "candidate",
        requestedPath: "/moved/away/sjasmplus",
        result: { ok: false, error: "Path does not exist: /moved/away/sjasmplus" }
      });

      // --- A probe on a deleted folder returns no path of its own; the dialog
      // --- still has to say which executable failed.
      expect(next.validation).toMatchObject({
        ok: false,
        executablePath: "/moved/away/sjasmplus",
        installFolder: "/moved/away"
      });
      expect(next.candidate).toEqual(next.validation);
      expect(next.busy).toBeUndefined();
    });

    it("marks the integration failed when the configured executable fails", () => {
      const next = reduce(aConfiguredState({ statusCheck: "checking" }), {
        type: "validationSettled",
        origin: "configuredCheck",
        requestedPath: "/tools/sjasmplus/sjasmplus",
        result: { ok: false, error: "SJASMPLUS exited with code 1" }
      });

      expect(next.statusCheck).toBe("failed");
      expect(next.statusError).toBe("SJASMPLUS exited with code 1");
      // --- The failure is reported next to the install, so the message only
      // --- says what to do about it.
      expect(next.message).toBe(CONFIGURED_FAILED_HINT);
    });

    it("falls back to a generic reason when a failed verdict carries none", () => {
      const next = reduce(aConfiguredState(), {
        type: "validationSettled",
        origin: "configuredCheck",
        requestedPath: "/tools/sjasmplus/sjasmplus",
        result: { ok: false }
      });

      expect(next.statusError).toBe(CONFIGURED_FAILED_MESSAGE);
    });

    it("clears the configured failure when the same executable passes", () => {
      const state = aConfiguredState({ statusCheck: "failed", statusError: "gone" });
      const next = reduce(state, {
        type: "validationSettled",
        origin: "configuredCheck",
        requestedPath: "/tools/sjasmplus/sjasmplus",
        result: okProbe("/tools/sjasmplus/sjasmplus", "v1.24.0")
      });

      expect(next.statusCheck).toBe("passed");
      expect(next.statusError).toBe("");
      expect(next.message).toBe(CONFIGURED_PASSED_HINT);
    });

    it("clears the configured failure when the same executable passes, spelled differently", () => {
      // --- The `sjasm` command stores the path as typed, so settings can hold
      // --- backslashes while every probe result comes back with forward slashes.
      const state = aConfiguredState({
        env: {
          isWindows: true,
          configured: { executablePath: "C:\\tools\\sjasmplus\\sjasmplus.exe" }
        },
        statusCheck: "failed",
        statusError: "SJASMPLUS exited with code 1"
      });

      const next = reduce(state, {
        type: "validationSettled",
        origin: "candidate",
        requestedPath: "C:/Tools/SjasmPlus/sjasmplus.exe",
        result: okProbe("C:/Tools/SjasmPlus/sjasmplus.exe", "v1.24.0")
      });

      expect(next.statusCheck).toBe("passed");
      expect(next.statusError).toBe("");
    });

    it("leaves the configured verdict alone when a different executable is tested", () => {
      const state = aConfiguredState({ statusCheck: "passed" });
      const next = reduce(state, {
        type: "validationSettled",
        origin: "candidate",
        requestedPath: "/downloads/readme.txt",
        result: failProbe("/downloads/readme.txt", "SJASMPLUS exited with code 1")
      });

      // --- The saved setup was not the one that failed
      expect(next.statusCheck).toBe("passed");
      expect(next.statusError).toBe("");
      expect(next.validation?.ok).toBe(false);
    });

    it("uses the candidate wording for a candidate verdict", () => {
      const next = reduce(aState(), {
        type: "validationSettled",
        origin: "candidate",
        requestedPath: "/tools/sjasmplus/sjasmplus",
        result: okProbe("/tools/sjasmplus/sjasmplus")
      });

      expect(next.message).toBe(VALIDATION_PASSED_MESSAGE);
    });
  });

  describe("probe and download", () => {
    it("keeps the busy label on a usable candidate so it never blinks back to idle", () => {
      const next = reduce(aState({ busy: "probe" }), {
        type: "probeSettled",
        result: okProbe("/tools/sjasmplus/sjasmplus")
      });

      expect(next.busy).toBe("validate");
      expect(next.message).toBe("");
    });

    it("explains a rejected path and stops there", () => {
      const next = reduce(aState({ busy: "probe" }), {
        type: "probeSettled",
        result: { ok: false }
      });

      expect(next.busy).toBeUndefined();
      expect(next.message).toBe(PROBE_FAILED_MESSAGE);
    });

    it("reports a failed download with the reason it came back with", () => {
      const next = reduce(aState({ busy: "download" }), {
        type: "downloadSettled",
        result: { ok: false, error: "404 from GitHub" }
      });

      expect(next.message).toBe("404 from GitHub");
      expect(next.busy).toBeUndefined();
    });

    it("falls back to a generic reason for a failed download", () => {
      const next = reduce(aState({ busy: "download" }), {
        type: "downloadSettled",
        result: { ok: false }
      });

      expect(next.message).toBe(DOWNLOAD_FAILED_MESSAGE);
    });

    it("clears a stale verdict when a new download folder is chosen", () => {
      const state = aState({ validation: okProbe("/old/sjasmplus"), message: "stale" });
      const next = reduce(state, { type: "downloadFolderChanged", folder: "/downloads" });

      expect(next.downloadFolder).toBe("/downloads");
      expect(next.validation).toBeUndefined();
      expect(next.message).toBe("");
    });
  });

  describe("apply", () => {
    it("confirms a saved integration", () => {
      const next = reduce(aState({ busy: "apply" }), { type: "applySettled", ok: true });

      expect(next.message).toBe(APPLY_SAVED_MESSAGE);
      expect(next.busy).toBeUndefined();
    });

    it("shows why saving failed", () => {
      const next = reduce(aState({ busy: "apply" }), {
        type: "applySettled",
        ok: false,
        error: "EACCES"
      });

      expect(next.message).toBe("EACCES");
    });
  });

  describe("release list", () => {
    it("selects the suggested release and asset", () => {
      const next = reduce(aState(), { type: "releaseListSettled", result: aReleaseList() });

      expect(next.releases.selectedTag).toBe("v1.24.0");
      expect(next.releases.selectedAssetName).toBe("sjasmplus-1.24.0.win.zip");
      expect(next.releases.busy).toBe(false);
    });

    it("falls back to the newest listed release when the suggestion is off the list", () => {
      // --- Only the newest 20 are shown; a suggestion below the cut cannot be
      // --- selected in a picker that does not offer it.
      const releases = Array.from({ length: 25 }, (_, index) => aRelease(`v${25 - index}.0.0`));
      const next = reduce(aState(), {
        type: "releaseListSettled",
        result: aReleaseList({
          releases,
          suggestedRelease: releases[24],
          suggestedAsset: undefined
        })
      });

      expect(next.releases.selectedTag).toBe("v25.0.0");
    });

    it("drops the selection when the list cannot be fetched", () => {
      const state = aState({
        releases: { busy: true, selectedTag: "v1.24.0", selectedAssetName: "a.zip" }
      });
      const next = reduce(state, { type: "releaseListFailed", error: "offline" });

      expect(next.releases).toMatchObject({
        list: undefined,
        busy: false,
        error: "offline",
        selectedTag: "",
        selectedAssetName: ""
      });
    });

    it("re-picks the asset when the release changes", () => {
      const other = aRelease("v1.23.0", {
        assets: [anAsset({ name: "older.win.zip" })],
        compatibleAssets: [anAsset({ name: "older.win.zip" })]
      });
      const withList = reduce(aState(), {
        type: "releaseListSettled",
        result: aReleaseList({ releases: [aRelease("v1.24.0"), other] })
      });

      const next = reduce(withList, { type: "releaseSelected", tagName: "v1.23.0" });

      // --- An asset chosen from the previous release is not valid for this one
      expect(next.releases.selectedAssetName).toBe("older.win.zip");
    });

    it("empties the asset when the chosen release offers nothing usable", () => {
      const withList = reduce(aState(), { type: "releaseListSettled", result: aReleaseList() });
      const next = reduce(withList, { type: "releaseSelected", tagName: "unknown" });

      expect(next.releases.selectedAssetName).toBe("");
    });
  });

  describe("no-op transitions", () => {
    it.each([
      ["setupModeChanged", { type: "setupModeChanged", mode: "local" } as const],
      ["scopeChanged", { type: "scopeChanged", scope: "user" } as const],
      ["prereleasesChanged", { type: "prereleasesChanged", value: false } as const]
    ])("%s to the current value returns the same state object", (_name, event) => {
      const state = aState();

      // --- Reference equality is how the store decides nobody needs waking
      expect(reduce(state, event)).toBe(state);
    });
  });

  it("re-dates what 'unchanged' means without dropping a selection in progress", () => {
    const state = aState({ candidate: okProbe("/tools/sjasmplus/sjasmplus") });
    const next = reduce(state, {
      type: "envReplaced",
      env: aConfiguredEnv({ configured: { source: "project" } })
    });

    expect(next.initialScope).toBe("project");
    expect(next.candidate).toBe(state.candidate);
  });

  it("clears a stale verdict when the setup source changes", () => {
    const state = aState({ validation: okProbe("/tools/sjasmplus/sjasmplus"), message: "stale" });
    const next = reduce(state, { type: "setupModeChanged", mode: "online" });

    expect(next.validation).toBeUndefined();
    expect(next.message).toBe("");
  });

  it("reports an operation that failed without producing a verdict", () => {
    const next = reduce(aState({ busy: "probe" }), {
      type: "operationFailed",
      message: "IPC channel closed"
    });

    expect(next.busy).toBeUndefined();
    expect(next.message).toBe("IPC channel closed");
    // --- No verdict was reached, so none is invented
    expect(next.validation).toBeUndefined();
  });
});
