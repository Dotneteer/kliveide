import { describe, expect, it } from "vitest";

import { reduce } from "@renderer/appIde/dialogs/z88dk/Z88dkModel";
import {
  formatProgress,
  selectHasPendingChanges,
  selectViewModel
} from "@renderer/appIde/dialogs/z88dk/Z88dkViewModel";

import { aConfiguredState, aReleaseList, aState, okProbe, V23, V24 } from "./fakes";

describe("status block", () => {
  it("asks for a setup when nothing is configured", () => {
    const vm = selectViewModel(aState());
    expect(vm.status).toMatchObject({ kind: "none", text: "No z88dk installation is set up." });
  });

  it("shows the configured folder and its version once it passed", () => {
    const state = reduce(aConfiguredState(), {
      type: "validationSettled",
      origin: "configuredCheck",
      requestedRoot: "/tools/z88dk",
      result: okProbe("/tools/z88dk")
    });
    expect(selectViewModel(state).status).toMatchObject({
      kind: "configured",
      badge: "passed",
      root: "/tools/z88dk",
      headline: "Configured",
      scopeLabel: "User settings",
      detail: { kind: "version", text: V24 }
    });
  });

  it("marks a configured version outside the supported range", () => {
    const state = reduce(aConfiguredState(), {
      type: "validationSettled",
      origin: "configuredCheck",
      requestedRoot: "/tools/z88dk",
      result: okProbe("/tools/z88dk", V23)
    });
    const status = selectViewModel(state).status;
    expect(status.kind === "configured" && status.detail.text).toBe(`${V23} (not a supported version)`);
  });
});

describe("local suggestions", () => {
  it("labels each detected install with its version and support", () => {
    const state = aState({ pathSuggestions: [okProbe("/a"), okProbe("/b", V23), { ok: true, root: "/c" }] });
    expect(selectViewModel(state).source.local.suggestions.map((s) => [s.label, s.supported])).toEqual([
      [`/a · ${V24}`, true],
      [`/b · ${V23} (not supported)`, false],
      ["/c", true]
    ]);
  });
});

describe("online panel", () => {
  it("explains the missing Linux download and links the build guide", () => {
    const online = selectViewModel(aState({}, { platform: "linux", isKliveProject: false, configured: { source: "none" } })).source.online;
    expect(online).toMatchObject({ kind: "unavailable", releasesLabel: "github.com/z88dk/z88dk/releases" });
  });

  it("lists releases with their date and enables the download once a folder is set", () => {
    let state = reduce(aState({ setupMode: "online" }), { type: "releaseListSettled", result: aReleaseList() });
    let online = selectViewModel(state).source.online;
    expect(online.kind === "available" && online.releases).toEqual([{ value: "v2.4", label: "v2.4 — 2025-10-02" }]);
    expect(online.kind === "available" && online.assets[0].label).toBe("z88dk-osx-2.4.zip · 68.6 MB");
    expect(online.kind === "available" && online.downloadEnabled).toBe(false);
    expect(online.kind === "available" && online.statusText).toBe("Suggested v2.4");
    state = reduce(state, { type: "downloadFolderChanged", folder: "/dl" });
    online = selectViewModel(state).source.online;
    expect(online.kind === "available" && online.downloadEnabled).toBe(true);
  });

  it("shows progress, and locks the rest of the panel, while downloading", () => {
    let state = reduce(aState({ setupMode: "online", downloadFolder: "/dl" }), { type: "releaseListSettled", result: aReleaseList() });
    state = reduce(state, { type: "downloadStarted" });
    state = reduce(state, { type: "downloadProgressed", progress: { phase: "downloading", receivedBytes: 35967013, totalBytes: 71934026 } });
    const online = selectViewModel(state).source.online;
    expect(online.kind === "available" && online.progress).toEqual({ label: "34.3 MB of 68.6 MB", percent: 50, cancelEnabled: true });
    expect(online.kind === "available" && [online.downloadEnabled, online.releaseSelectDisabled, online.folderDisabled]).toEqual([
      false,
      true,
      true
    ]);
    expect(selectViewModel(state).buttons).toMatchObject({ applyEnabled: false, testEnabled: false, busy: true });
  });
});

describe("formatProgress", () => {
  it("words each phase, with Cancel where it can still stop the install", () => {
    expect(formatProgress({ phase: "downloading", receivedBytes: 2048 })).toEqual({ label: "Downloaded 2 KB", cancelEnabled: true });
    expect(formatProgress({ phase: "verifying", receivedBytes: 1 })).toMatchObject({ label: "Checking the download...", cancelEnabled: false });
    expect(formatProgress({ phase: "extracting", receivedBytes: 1 })).toEqual({ label: "Unpacking...", cancelEnabled: true });
    expect(formatProgress({ phase: "testing", receivedBytes: 1 })).toEqual({ label: "Testing the compiler...", cancelEnabled: false });
  });
});

describe("apply block", () => {
  it("warns about a working install of an unsupported version", () => {
    const state = reduce(aState(), { type: "validationSettled", origin: "candidate", requestedRoot: "/old", result: okProbe("/old", V23) });
    expect(selectViewModel(state).apply).toMatchObject({ tone: "warning", validationLabel: "Passed (old version)" });
    expect(selectViewModel(state).buttons.applyEnabled).toBe(true);
  });

  it("hints at the next step when nothing is selected", () => {
    expect(selectViewModel(aState()).apply.message).toBe("Choose a z88dk folder, or download a release.");
  });
});

describe("pending changes", () => {
  it("counts only a tested candidate that differs from what is in use", () => {
    expect(selectHasPendingChanges(aConfiguredState())).toBe(false);
    const tested = reduce(aConfiguredState(), { type: "validationSettled", origin: "candidate", requestedRoot: "/new", result: okProbe("/new") });
    expect(selectHasPendingChanges(tested)).toBe(true);
    const failed = reduce(aConfiguredState(), { type: "validationSettled", origin: "candidate", requestedRoot: "/new", result: { ok: false } });
    expect(selectHasPendingChanges(failed)).toBe(false);
  });

  it("counts a scope change of the configured install", () => {
    let state = reduce(aConfiguredState(), {
      type: "validationSettled",
      origin: "configuredCheck",
      requestedRoot: "/tools/z88dk",
      result: okProbe("/tools/z88dk")
    });
    state = reduce(state, { type: "scopeChanged", scope: "project" });
    expect(selectHasPendingChanges(state)).toBe(true);
  });
});
