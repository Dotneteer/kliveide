import { describe, expect, it } from "vitest";

import {
  DOWNLOAD_CANCELLED_MESSAGE,
  VALIDATION_PASSED_MESSAGE,
  VALIDATION_PASSED_UNSUPPORTED_MESSAGE,
  initialState,
  onlineAvailable,
  readZ88dkEnvironment,
  reduce,
  releaseOptionsOf,
  selectedAssetOf
} from "@renderer/appIde/dialogs/z88dk/Z88dkModel";

import { aConfiguredState, aReleaseList, aState, anEnv, okProbe, V23 } from "./fakes";

describe("readZ88dkEnvironment", () => {
  it("prefers the project's install over the user's", () => {
    const env = readZ88dkEnvironment(
      { z88dk: { root: "/user/z88dk" } },
      { z88dk: { root: "C:\\proj\\z88dk\\", version: "v23854-4d530b6eb7-20251002" } },
      "windows",
      true
    );
    expect(env.configured).toEqual({ source: "project", root: "C:/proj/z88dk", version: "v23854-4d530b6eb7-20251002" });
  });

  it("reports no install when neither scope has one", () => {
    expect(readZ88dkEnvironment({}, undefined, "macos", false).configured).toEqual({ source: "none" });
  });
});

describe("initialState", () => {
  it("starts re-testing a configured install, with it as the candidate", () => {
    const state = aConfiguredState();
    expect(state.statusCheck).toBe("checking");
    expect(state.candidate?.root).toBe("/tools/z88dk");
  });

  it("has nothing to check without an install", () => {
    expect(initialState(anEnv()).statusCheck).toBe("none");
  });
});

describe("online availability", () => {
  it("offers downloads on Windows and macOS only (no Linux binary)", () => {
    expect(onlineAvailable(anEnv({ platform: "windows" }))).toBe(true);
    expect(onlineAvailable(anEnv({ platform: "macos" }))).toBe(true);
    expect(onlineAvailable(anEnv({ platform: "linux" }))).toBe(false);
  });
});

describe("release list", () => {
  it("preselects the newest supported release and its asset", () => {
    const state = reduce(aState(), { type: "releaseListSettled", result: aReleaseList() });
    expect(state.releases.selectedTag).toBe("v2.4");
    expect(state.releases.selectedAssetName).toBe("z88dk-osx-2.4.zip");
  });

  it("hides older releases until asked, and keeps a selection that stays visible", () => {
    let state = reduce(aState(), { type: "releaseListSettled", result: aReleaseList() });
    expect(releaseOptionsOf(state.releases).map((r) => r.tagName)).toEqual(["v2.4"]);
    state = reduce(state, { type: "showOlderChanged", value: true });
    expect(releaseOptionsOf(state.releases).map((r) => r.tagName)).toEqual(["v2.4", "v2.3"]);
    state = reduce(state, { type: "releaseSelected", tagName: "v2.3" });
    expect(selectedAssetOf(state)?.name).toBe("z88dk-osx-2.3.zip");
    // --- Hiding the older releases again moves the selection to a visible one
    state = reduce(state, { type: "showOlderChanged", value: false });
    expect(state.releases.selectedTag).toBe("v2.4");
    expect(state.releases.selectedAssetName).toBe("z88dk-osx-2.4.zip");
  });

  it("lists every release when none is supported, so the dropdown is never empty", () => {
    const list = aReleaseList();
    const old = { ...list, releases: list.releases.filter((r) => !r.supported), suggestedRelease: undefined };
    const state = reduce(aState(), { type: "releaseListSettled", result: old });
    expect(releaseOptionsOf(state.releases).map((r) => r.tagName)).toEqual(["v2.3"]);
  });

  it("returns the same state for a no-op toggle", () => {
    const state = aState();
    expect(reduce(state, { type: "showOlderChanged", value: false })).toBe(state);
  });
});

describe("download", () => {
  it("takes the default folder only when the user picked none", () => {
    let state = reduce(aState(), { type: "defaultDownloadFolderLoaded", folder: "/home/u/KliveTools/z88dk" });
    expect(state.downloadFolder).toBe("/home/u/KliveTools/z88dk");
    state = reduce(aState({ downloadFolder: "/mine" }), { type: "defaultDownloadFolderLoaded", folder: "/x" });
    expect(state.downloadFolder).toBe("/mine");
  });

  it("tracks progress only while downloading", () => {
    const started = reduce(reduce(aState(), { type: "releaseListSettled", result: aReleaseList() }), { type: "downloadStarted" });
    expect(started.download).toEqual({ phase: "downloading", receivedBytes: 0, totalBytes: 71934026 });
    const progressed = reduce(started, { type: "downloadProgressed", progress: { phase: "extracting", receivedBytes: 71934026 } });
    expect(progressed.download?.phase).toBe("extracting");
    const idle = aState();
    expect(reduce(idle, { type: "downloadProgressed", progress: { phase: "downloading", receivedBytes: 5 } })).toBe(idle);
  });

  it("takes the service's tested install as the validation", () => {
    const state = reduce(aState({ busy: "download" }), { type: "downloadSettled", result: okProbe("/dl/v2.4") });
    expect(state).toMatchObject({ busy: undefined, download: undefined, message: VALIDATION_PASSED_MESSAGE });
    expect(state.validation?.root).toBe("/dl/v2.4");
    expect(state.candidate?.root).toBe("/dl/v2.4");
  });

  it("says a cancelled download installed nothing, without a failure verdict", () => {
    const state = reduce(aState({ busy: "download" }), {
      type: "downloadSettled",
      result: { ok: false, cancelled: true, error: "The download was cancelled." }
    });
    expect(state).toMatchObject({ busy: undefined, message: DOWNLOAD_CANCELLED_MESSAGE, validation: undefined });
  });
});

describe("validation", () => {
  it("marks a working older version as passed with a warning message", () => {
    const state = reduce(aState({ busy: "validate" }), {
      type: "validationSettled",
      origin: "candidate",
      requestedRoot: "/old",
      result: okProbe("/old", V23)
    });
    expect(state.message).toBe(VALIDATION_PASSED_UNSUPPORTED_MESSAGE);
    expect(state.validation?.supported).toBe(false);
  });

  it("records a verdict on the configured folder as the integration's status", () => {
    const state = reduce(aConfiguredState(), {
      type: "validationSettled",
      origin: "configuredCheck",
      requestedRoot: "/tools/z88dk",
      result: { ok: false, error: "zcc did not start." }
    });
    expect(state.statusCheck).toBe("failed");
    expect(state.statusError).toBe("zcc did not start.");
    expect(state.validation?.root).toBe("/tools/z88dk");
  });
});
