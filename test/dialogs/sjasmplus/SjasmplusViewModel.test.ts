import { describe, expect, it } from "vitest";

import {
  CANDIDATE_REJECTED_MESSAGE,
  CONFIGURED_FAILED_MESSAGE,
  REPLACEMENT_READY_MESSAGE,
  SJASMPLUS_REPOSITORY_URL
} from "@renderer/appIde/dialogs/sjasmplus/SjasmplusModel";
import {
  discardConfirmRequest,
  formatAssetLabel,
  formatFileSize,
  formatValidation,
  nextStepHint,
  selectViewModel
} from "@renderer/appIde/dialogs/sjasmplus/SjasmplusViewModel";

import {
  aConfiguredState,
  aRelease,
  aReleaseList,
  aState,
  anAsset,
  failProbe,
  okProbe
} from "./fakes";

const CONFIGURED_PATH = "/tools/sjasmplus/sjasmplus";
const OTHER_PATH = "/downloads/readme.txt";

describe("status block", () => {
  it("says nothing is set up when no settings define an install", () => {
    const status = selectViewModel(aState()).status;

    expect(status).toMatchObject({
      kind: "none",
      text: "No SJASMPLUS assembler is set up yet"
    });
  });

  /**
   * The status block reports on the configured executable; the "To apply" block
   * reports on whatever was just tested. When the two disagree, the badge is
   * dropped and the note says what the newer verdict means instead — a badge
   * next to a contradicting result reads as a verdict on that result.
   */
  it.each([
    // statusCheck | tested executable | verdict | badge | note
    ["passed", CONFIGURED_PATH, true, "passed", ""],
    ["failed", CONFIGURED_PATH, false, "failed", ""],
    ["failed", OTHER_PATH, true, "none", REPLACEMENT_READY_MESSAGE],
    ["passed", OTHER_PATH, false, "none", CANDIDATE_REJECTED_MESSAGE],
    // --- Agreeing verdicts on different executables keep the badge
    ["passed", OTHER_PATH, true, "passed", ""],
    ["failed", OTHER_PATH, false, "failed", ""]
  ] as const)(
    "statusCheck=%s after testing %s (ok=%s) -> badge %s",
    (statusCheck, testedPath, ok, badge, note) => {
      const verdict = ok ? okProbe(testedPath) : failProbe(testedPath, "SJASMPLUS exited with code 1");
      const status = selectViewModel(
        aConfiguredState({
          statusCheck,
          statusError: statusCheck === "failed" ? "Path does not exist" : "",
          candidate: verdict,
          validation: verdict
        })
      ).status;

      expect(status).toMatchObject({ kind: "configured", badge });
      if (note) {
        expect(status).toMatchObject({ detail: { kind: "note", text: note } });
      } else {
        expect(status).not.toMatchObject({ detail: { kind: "note" } });
      }
    }
  );

  it("shows no badge while the configured executable is still being checked", () => {
    expect(selectViewModel(aConfiguredState({ statusCheck: "checking" })).status).toMatchObject({
      badge: "none"
    });
  });

  it("prefers the failure reason over a stale version for a broken setup", () => {
    const status = selectViewModel(
      aConfiguredState({ statusCheck: "failed", statusError: "Path does not exist: /moved/away" })
    ).status;

    expect(status).toMatchObject({
      headline: "Not working",
      detail: { kind: "error", text: "Path does not exist: /moved/away" }
    });
  });

  it("falls back to a generic reason when the failure carries none", () => {
    const status = selectViewModel(aConfiguredState({ statusCheck: "failed" })).status;

    expect(status).toMatchObject({ detail: { text: CONFIGURED_FAILED_MESSAGE } });
  });

  it("shows the version and the scope for a working setup", () => {
    const status = selectViewModel(aConfiguredState({ statusCheck: "passed" })).status;

    expect(status).toMatchObject({
      headline: "Configured",
      scopeLabel: "User settings",
      detail: { kind: "version", text: "v1.24.0" }
    });
  });

  it("admits an unknown version rather than showing nothing", () => {
    const status = selectViewModel(
      aConfiguredState({ statusCheck: "passed", env: { configured: { version: undefined } } })
    ).status;

    expect(status).toMatchObject({ detail: { text: "version unknown" } });
  });
});

describe("buttons and pending changes", () => {
  it("keeps Apply disabled until a candidate has passed its test", () => {
    const nothing = selectViewModel(aState()).buttons;
    expect(nothing).toEqual({ applyEnabled: false, testEnabled: false, busy: false });

    const untested = selectViewModel(aState({ candidate: okProbe(CONFIGURED_PATH) })).buttons;
    expect(untested).toMatchObject({ applyEnabled: false, testEnabled: true });

    const passed = selectViewModel(
      aState({ candidate: okProbe(CONFIGURED_PATH), validation: okProbe(CONFIGURED_PATH) })
    ).buttons;
    expect(passed).toMatchObject({ applyEnabled: true, testEnabled: true });
  });

  it("disables every action while work is in flight", () => {
    const vm = selectViewModel(
      aState({
        candidate: okProbe(CONFIGURED_PATH),
        validation: okProbe(CONFIGURED_PATH),
        busy: "validate"
      })
    );

    expect(vm.buttons).toEqual({ applyEnabled: false, testEnabled: false, busy: true });
    expect(vm.scopeChoice.disabled).toBe(true);
    expect(vm.source.disabled).toBe(true);
  });

  it("refuses to apply a verdict whose install folder never resolved", () => {
    const vm = selectViewModel(
      aState({
        candidate: { ok: true, executablePath: CONFIGURED_PATH },
        validation: { ok: true, executablePath: CONFIGURED_PATH }
      })
    );

    // --- There is nothing to write into the install-folder setting
    expect(vm.buttons.applyEnabled).toBe(false);
  });

  it("treats an untouched configured setup as having nothing to apply", () => {
    expect(selectViewModel(aConfiguredState()).hasPendingChanges).toBe(false);
  });

  it("treats a different executable as a pending change", () => {
    expect(
      selectViewModel(aConfiguredState({ candidate: okProbe(OTHER_PATH) })).hasPendingChanges
    ).toBe(true);
  });

  it("treats the same executable in another scope as a pending change", () => {
    expect(
      selectViewModel(aConfiguredState({ scope: "project" })).hasPendingChanges
    ).toBe(true);
  });
});

describe("scope choice", () => {
  it("disables project scope and explains why without a Klive project", () => {
    expect(selectViewModel(aState()).scopeChoice).toMatchObject({
      projectEnabled: false,
      note: "(no Klive project is open)"
    });
  });

  it("offers project scope inside a Klive project, with nothing to explain", () => {
    expect(
      selectViewModel(aState({ env: { isKliveProject: true } })).scopeChoice
    ).toMatchObject({ projectEnabled: true, note: undefined });
  });
});

describe("apply block", () => {
  it.each([
    ["probe", "Checking selected path..."],
    ["download", "Downloading release..."],
    ["validate", "Running smoke test..."],
    ["apply", "Saving..."]
  ] as const)("labels the %s phase", (busy, label) => {
    expect(formatValidation(undefined, busy)).toBe(label);
  });

  it.each([
    [undefined, "Not tested"],
    [okProbe(CONFIGURED_PATH), "Passed"],
    [failProbe(CONFIGURED_PATH, "nope"), "Failed"]
  ])("labels a settled verdict", (validation, label) => {
    expect(formatValidation(validation, undefined)).toBe(label);
  });

  it("tells the user what to do next when there is no message", () => {
    expect(nextStepHint(undefined, undefined, undefined)).toBe(
      "Pick a local executable or download a release below."
    );
    expect(nextStepHint(okProbe(CONFIGURED_PATH), undefined, undefined)).toBe(
      "Press Test again to check this executable."
    );
    expect(nextStepHint(okProbe(CONFIGURED_PATH), okProbe(CONFIGURED_PATH), undefined)).toBe("");
    // --- Nothing to suggest while work is running
    expect(nextStepHint(undefined, undefined, "probe")).toBe("");
  });

  it("shows a real message in place of the hint, and only that in the tooltip", () => {
    const apply = selectViewModel(aState({ message: "Something went wrong" })).apply;

    expect(apply.message).toBe("Something went wrong");
    expect(apply.messageTitle).toBe("Something went wrong");
  });

  it("leaves the tooltip empty when only a fallback hint is shown", () => {
    const apply = selectViewModel(aState()).apply;

    expect(apply.message).toBe("Pick a local executable or download a release below.");
    // --- A hint that is fully visible needs no tooltip repeating it
    expect(apply.messageTitle).toBe("");
  });

  it("drops the success tone while a new operation is running", () => {
    expect(
      selectViewModel(aState({ validation: okProbe(CONFIGURED_PATH), busy: "apply" })).apply.tone
    ).toBe("none");
  });
});

describe("local source", () => {
  it("lists only suggestions that resolved to an executable", () => {
    const vm = selectViewModel(
      aState({
        pathSuggestions: [okProbe("/usr/local/bin/sjasmplus"), { ok: false }]
      })
    );

    expect(vm.source.local.suggestions).toEqual(["/usr/local/bin/sjasmplus"]);
  });
});

describe("online source", () => {
  it("offers the repository instead of downloads off Windows", () => {
    const online = selectViewModel(aState()).source.online;

    expect(online).toEqual({
      kind: "unavailable",
      repositoryUrl: SJASMPLUS_REPOSITORY_URL,
      repositoryLabel: "github.com/z00m128/sjasmplus"
    });
  });

  it("lists only usable assets, never source archives", () => {
    const sourceAsset = anAsset({
      name: "sjasmplus-1.24.0-src.tar.xz",
      kind: "source",
      platform: "unknown",
      arch: "unknown",
      compatible: false
    });
    const binary = anAsset();
    const release = aRelease("v1.24.0", {
      assets: [sourceAsset, binary],
      compatibleAssets: [binary]
    });
    const online = onlineViewModel({ releases: [release], suggestedAsset: binary });

    expect(online.assets.map((asset) => asset.value)).toEqual(["sjasmplus-1.24.0.win.zip"]);
  });

  it("limits the release list to the newest 20", () => {
    const releases = Array.from({ length: 25 }, (_, index) => aRelease(`v${25 - index}.0.0`));
    const online = onlineViewModel({ releases, suggestedRelease: releases[0] });

    expect(online.releases).toHaveLength(20);
    expect(online.releases[0].value).toBe("v25.0.0");
    expect(online.releases.map((release) => release.value)).not.toContain("v5.0.0");
  });

  it("describes a release by how much of it is usable here", () => {
    const online = onlineViewModel({ releases: [aRelease("v1.24.0")] });

    expect(online.releases[0].label).toBe("v1.24.0 — 1 build for Windows");
  });

  it("marks a prerelease and a release with nothing usable", () => {
    const empty = aRelease("v2.0.0", { prerelease: true, compatibleAssets: [] });
    const online = onlineViewModel({ releases: [empty] });

    expect(online.releases[0].label).toBe("v2.0.0 (prerelease) — nothing for Windows");
  });

  it("says what to do when upstream publishes nothing for this system", () => {
    const online = onlineViewModel({
      releases: [aRelease("v1.24.0", { compatibleAssets: [] })],
      targetPlatform: "macos"
    });

    expect(online.statusText).toContain("SJASMPLUS publishes no macOS binary");
  });

  it("reports a fetch failure in place of the status", () => {
    const state = windowsState({
      releases: { error: "offline", list: undefined, selectedTag: "", selectedAssetName: "" }
    });
    const online = selectViewModel(state).source.online;

    expect(online).toMatchObject({ kind: "available", statusText: "offline", statusFailed: true });
  });

  it("keeps Download disabled until a folder is chosen", () => {
    const withList = windowsState({
      releases: {
        list: aReleaseList(),
        selectedTag: "v1.24.0",
        selectedAssetName: "sjasmplus-1.24.0.win.zip"
      },
      setupMode: "online"
    });

    expect(selectViewModel(withList).source.online).toMatchObject({ downloadEnabled: false });
    expect(
      selectViewModel({ ...withList, downloadFolder: "/downloads" }).source.online
    ).toMatchObject({ downloadEnabled: true });
  });
});

describe("asset labels", () => {
  it("says what the file is and how big it is", () => {
    expect(formatAssetLabel(anAsset({ size: 2048 }))).toBe(
      "sjasmplus-1.24.0.win.zip — Windows x64 build · 2 KB"
    );
  });

  it("names a source archive as needing compilation", () => {
    expect(formatAssetLabel(anAsset({ kind: "source", size: 0 }))).toBe(
      "sjasmplus-1.24.0.win.zip — source code, needs compiling"
    );
  });

  it.each([
    [512, "512 B"],
    [2048, "2 KB"],
    [3 * 1024 * 1024, "3.0 MB"]
  ])("formats %s bytes as %s", (size, expected) => {
    expect(formatFileSize(size)).toBe(expected);
  });
});

describe("discardConfirmRequest", () => {
  it("names the executable that would be dropped", () => {
    const request = discardConfirmRequest(aState({ candidate: okProbe(OTHER_PATH) }));

    expect(request).toMatchObject({
      title: "Discard SJASMPLUS setup?",
      code: OTHER_PATH,
      confirmLabel: "Discard",
      cancelLabel: "Keep editing",
      danger: true
    });
  });
});

// --- Helpers ────────────────────────────────────────────────────────────────

function windowsState(over?: Parameters<typeof aState>[0]) {
  return aState({ env: { isWindows: true }, ...over } as never);
}

function onlineViewModel(list: Partial<ReturnType<typeof aReleaseList>>) {
  const result = aReleaseList(list);
  const state = windowsState({
    releases: {
      list: result,
      selectedTag: result.releases[0]?.tagName ?? "",
      selectedAssetName: result.suggestedAsset?.name ?? ""
    }
  });
  const online = selectViewModel(state).source.online;
  if (online.kind !== "available") throw new Error("expected the online panel to be available");
  return online;
}
