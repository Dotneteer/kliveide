import { describe, expect, it } from "vitest";

import type { SjasmplusProbeResult } from "@common/messaging/SjasmplusIntegration";
import {
  CANDIDATE_REJECTED_MESSAGE,
  REPLACEMENT_READY_MESSAGE
} from "@renderer/appIde/dialogs/sjasmplus/SjasmplusModel";

import { deferred } from "../../mvc/deferred";
import {
  aConfiguredEnv,
  aRelease,
  aReleaseList,
  anAsset,
  createSjasmplusDialog,
  failProbe,
  okProbe,
  openSjasmplusDialog
} from "./fakes";

const CONFIGURED_PATH = "/tools/sjasmplus/sjasmplus";

describe("opening", () => {
  it("re-tests the configured executable and loads PATH suggestions", async () => {
    const h = await openSjasmplusDialog({
      configured: true,
      service: {
        getPathSuggestions: async () => [okProbe("/usr/local/bin/sjasmplus")],
        validateExecutable: async (path) => okProbe(path, "v1.24.0")
      }
    });

    expect(h.ports.service.validateExecutable).toHaveBeenCalledWith(CONFIGURED_PATH);
    expect(h.vm.status).toMatchObject({ badge: "passed", headline: "Configured" });
    expect(h.vm.source.local.suggestions).toEqual(["/usr/local/bin/sjasmplus"]);
  });

  it("does not test anything when no install is configured", async () => {
    const h = await openSjasmplusDialog();

    expect(h.ports.service.validateExecutable).not.toHaveBeenCalled();
    expect(h.state.statusCheck).toBe("none");
    expect(h.vm.status).toMatchObject({ kind: "none" });
  });

  it("flags a configured executable that no longer works", async () => {
    const h = await openSjasmplusDialog({
      configured: true,
      service: {
        validateExecutable: async () => ({
          ok: false,
          error: "Path does not exist: /tools/sjasmplus/sjasmplus"
        })
      }
    });

    // --- A folder that was moved or deleted must not keep the success badge
    expect(h.vm.status).toMatchObject({
      badge: "failed",
      headline: "Not working",
      detail: { kind: "error", text: "Path does not exist: /tools/sjasmplus/sjasmplus" }
    });
    // --- ...and the settings cannot be re-applied on top of a failed test
    expect(h.vm.buttons.applyEnabled).toBe(false);
  });

  it("treats an unreachable executable as a failed integration, not a crash", async () => {
    const h = await openSjasmplusDialog({
      configured: true,
      service: {
        validateExecutable: async () => {
          throw new Error("spawn ENOENT");
        }
      }
    });

    expect(h.vm.status).toMatchObject({ badge: "failed" });
    expect(h.state.statusError).toBe("spawn ENOENT");
  });

  it("keeps quiet when the PATH scan fails", async () => {
    const h = await openSjasmplusDialog({
      service: {
        getPathSuggestions: async () => {
          throw new Error("which: not found");
        }
      }
    });

    // --- Shortcuts are a convenience; their absence is not an error to report
    expect(h.vm.source.local.suggestions).toEqual([]);
    expect(h.vm.apply.message).toBe("Pick a local executable or download a release below.");
  });

  it("shows the checking state until the verdict arrives", async () => {
    const gate = deferred<SjasmplusProbeResult>();
    const h = createSjasmplusDialog({
      configured: true,
      service: { validateExecutable: () => gate.promise }
    });

    void h.send({ type: "opened" });
    expect(h.state.statusCheck).toBe("checking");
    expect(h.vm.status).toMatchObject({ badge: "none" });

    gate.resolve(okProbe(CONFIGURED_PATH));
    await h.settle();
    expect(h.vm.status).toMatchObject({ badge: "passed" });
  });
});

describe("choosing a local executable", () => {
  it("selects, validates, and applies an executable to user settings", async () => {
    const h = await openSjasmplusDialog({
      pickFile: CONFIGURED_PATH,
      service: {
        validateExecutable: async (path) => okProbe(path, "sjasmplus v1.23.0")
      }
    });

    await h.dispatch({ type: "selectExecutableRequested" });
    expect(h.vm.apply.validationLabel).toBe("Passed");
    expect(h.vm.buttons.applyEnabled).toBe(true);

    await h.dispatch({ type: "applyRequested" });
    expect(h.ports.service.apply).toHaveBeenCalledWith({
      scope: "user",
      installFolder: "/tools/sjasmplus",
      executablePath: CONFIGURED_PATH,
      version: "sjasmplus v1.23.0"
    });
    expect(h.ports.close.close).toHaveBeenCalledWith("close");
  });

  it("asks the picker for executables, keyed to its own remembered folder", async () => {
    const h = await openSjasmplusDialog({ pickFile: CONFIGURED_PATH });
    await h.dispatch({ type: "selectExecutableRequested" });

    expect(h.ports.files.pickFile).toHaveBeenCalledWith(
      [{ name: "SJASMPLUS executable", extensions: ["exe", "*"] }],
      "sjasmplusExecutable"
    );
  });

  it("does nothing when the picker is dismissed", async () => {
    const h = await openSjasmplusDialog();
    await h.dispatch({ type: "selectExecutableRequested" });

    expect(h.ports.service.probePath).not.toHaveBeenCalled();
    expect(h.vm.apply.candidatePath).toBeUndefined();
  });

  it("stops at a rejected path without running a smoke test", async () => {
    const h = await openSjasmplusDialog({
      pickFile: "/downloads/readme.txt",
      service: {
        probePath: async () => ({ ok: false, error: "Not an SJASMPLUS executable." })
      }
    });

    await h.dispatch({ type: "selectExecutableRequested" });

    expect(h.ports.service.validateExecutable).not.toHaveBeenCalled();
    expect(h.vm.apply.message).toBe("Not an SJASMPLUS executable.");
    expect(h.vm.buttons.applyEnabled).toBe(false);
  });

  it("validates a PATH suggestion before it can be applied", async () => {
    const suggestion = okProbe("/usr/local/bin/sjasmplus");
    const h = await openSjasmplusDialog({
      service: {
        getPathSuggestions: async () => [suggestion],
        validateExecutable: async (path) => okProbe(path, "sjasmplus v1.24.0")
      }
    });

    await h.dispatch({ type: "suggestionPicked", executablePath: suggestion.executablePath });
    expect(h.ports.service.validateExecutable).toHaveBeenCalledWith("/usr/local/bin/sjasmplus");

    await h.dispatch({ type: "applyRequested" });
    expect(h.ports.service.apply).toHaveBeenCalledWith({
      scope: "user",
      installFolder: "/usr/local/bin",
      executablePath: "/usr/local/bin/sjasmplus",
      version: "sjasmplus v1.24.0"
    });
  });

  it("saves to project settings when a Klive project is open", async () => {
    const h = await openSjasmplusDialog({
      env: { isKliveProject: true },
      pickFile: "/project/tools/sjasmplus"
    });

    await h.dispatch({ type: "scopeSelected", scope: "project" });
    await h.dispatch({ type: "selectExecutableRequested" });
    await h.dispatch({ type: "applyRequested" });

    expect(h.ports.service.apply).toHaveBeenCalledWith({
      scope: "project",
      installFolder: "/project/tools",
      executablePath: "/project/tools/sjasmplus",
      version: undefined
    });
  });

  it("keeps the dialog open and explains why when saving fails", async () => {
    const h = await openSjasmplusDialog({
      pickFile: CONFIGURED_PATH,
      service: {
        apply: async () => {
          throw new Error("EACCES: permission denied");
        }
      }
    });

    await h.dispatch({ type: "selectExecutableRequested" });
    await h.dispatch({ type: "applyRequested" });

    expect(h.vm.apply.message).toBe("EACCES: permission denied");
    expect(h.ports.close.close).not.toHaveBeenCalled();
  });

  it("refuses to apply anything that has not passed a test", async () => {
    const h = await openSjasmplusDialog({
      pickFile: CONFIGURED_PATH,
      service: { validateExecutable: async (path) => failProbe(path, "exited with code 1") }
    });

    await h.dispatch({ type: "selectExecutableRequested" });
    await h.dispatch({ type: "applyRequested" });

    expect(h.ports.service.apply).not.toHaveBeenCalled();
    expect(h.ports.close.close).not.toHaveBeenCalled();
  });
});

describe("re-testing", () => {
  it("clears the failure when the restored executable passes", async () => {
    let works = false;
    const h = await openSjasmplusDialog({
      configured: true,
      service: {
        validateExecutable: async (path) =>
          works ? okProbe(path, "v1.24.0") : failProbe(path, "Path does not exist")
      }
    });
    expect(h.vm.status).toMatchObject({ badge: "failed" });

    // --- The user puts the executable back and re-tests without reselecting it
    works = true;
    await h.dispatch({ type: "testAgainRequested" });

    expect(h.ports.service.validateExecutable).toHaveBeenLastCalledWith(CONFIGURED_PATH);
    expect(h.vm.status).toMatchObject({ badge: "passed", headline: "Configured" });
  });

  it("clears the failure when a re-test passes on a differently spelled path", async () => {
    // --- Settings hold the path as typed; every probe answers with slashes
    const h = createSjasmplusDialog({
      configured: true,
      env: {
        isWindows: true,
        configured: { executablePath: "C:\\tools\\sjasmplus\\sjasmplus.exe" }
      },
      service: { validateExecutable: async () => failProbe("C:/tools/sjasmplus/sjasmplus.exe", "exited with code 1") }
    });
    await h.dispatch({ type: "opened" });
    expect(h.vm.status).toMatchObject({ badge: "failed" });

    h.ports.service.validateExecutable.mockResolvedValue(
      okProbe("C:/Tools/SjasmPlus/sjasmplus.exe", "v1.24.0")
    );
    await h.dispatch({ type: "testAgainRequested" });

    // --- Same executable, so this is the configured setup working again, not a
    // --- replacement waiting to be applied
    expect(h.vm.status).toMatchObject({ badge: "passed", headline: "Configured" });
    expect(h.vm.status).not.toMatchObject({ detail: { kind: "note" } });
  });

  it("keeps the success badge when the configured executable is re-tested", async () => {
    const h = await openSjasmplusDialog({
      configured: true,
      service: { validateExecutable: async (path) => okProbe(path, "v1.24.0") }
    });

    await h.dispatch({ type: "testAgainRequested" });

    expect(h.vm.status).toMatchObject({
      badge: "passed",
      headline: "Configured",
      detail: { kind: "version", text: "v1.24.0" }
    });
    expect(h.vm.apply.validationLabel).toBe("Passed");
  });

  it("drops the success badge while a tested executable is failing", async () => {
    const h = await openSjasmplusDialog({
      configured: true,
      pickFile: "/downloads/readme.txt"
    });
    expect(h.vm.status).toMatchObject({ badge: "passed" });

    h.ports.service.validateExecutable.mockResolvedValue(
      failProbe("/downloads/readme.txt", "SJASMPLUS exited with code 1")
    );
    await h.dispatch({ type: "selectExecutableRequested" });

    // --- A success badge next to a failed test reads as a verdict on that test
    expect(h.vm.status).toMatchObject({
      badge: "none",
      headline: "Configured",
      detail: { kind: "note", text: CANDIDATE_REJECTED_MESSAGE }
    });
    expect(h.vm.buttons.applyEnabled).toBe(false);
  });

  it("stops flagging the old setup once a replacement passes", async () => {
    const h = await openSjasmplusDialog({
      configured: true,
      pickFile: "/new/tools/sjasmplus",
      service: {
        validateExecutable: async (path) =>
          path === CONFIGURED_PATH
            ? failProbe(path, "Path does not exist")
            : okProbe(path, "v1.25.0")
      }
    });
    expect(h.vm.status).toMatchObject({ badge: "failed" });

    await h.dispatch({ type: "selectExecutableRequested" });

    // --- The fix is a click away, so the stale error stops being the headline
    expect(h.vm.status).toMatchObject({
      badge: "none",
      detail: { kind: "note", text: REPLACEMENT_READY_MESSAGE }
    });
    expect(h.vm.buttons.applyEnabled).toBe(true);
  });

  it("says what it is doing and disables Apply while the smoke test runs", async () => {
    const gate = deferred<SjasmplusProbeResult>();
    const h = await openSjasmplusDialog({ configured: true });

    h.ports.service.validateExecutable.mockReturnValue(gate.promise);
    void h.send({ type: "testAgainRequested" });

    expect(h.vm.apply.validationLabel).toBe("Running smoke test...");
    expect(h.vm.buttons).toMatchObject({ applyEnabled: false, testEnabled: false, busy: true });

    gate.resolve(okProbe(CONFIGURED_PATH, "v1.24.0"));
    await h.settle();
    expect(h.vm.apply.validationLabel).toBe("Passed");
  });

  it("ignores a slow verdict that lands after a newer one", async () => {
    const slow = deferred<SjasmplusProbeResult>();
    const fast = deferred<SjasmplusProbeResult>();
    const h = await openSjasmplusDialog({ configured: true });

    h.ports.service.validateExecutable.mockReturnValueOnce(slow.promise);
    void h.send({ type: "testAgainRequested" });
    h.ports.service.validateExecutable.mockReturnValueOnce(fast.promise);
    void h.send({ type: "testAgainRequested" });

    fast.resolve(okProbe(CONFIGURED_PATH, "v1.24.0"));
    slow.resolve(failProbe(CONFIGURED_PATH, "stale failure"));
    await h.settle();

    // --- The stale answer arrived last but belongs to a superseded request
    expect(h.vm.apply.validationLabel).toBe("Passed");
    expect(h.vm.status).toMatchObject({ badge: "passed" });
  });
});

describe("closing", () => {
  it("closes without asking when nothing was changed", async () => {
    const h = await openSjasmplusDialog({ configured: true });

    await h.dispatch({ type: "closeRequested" });

    expect(h.ports.confirm.confirm).not.toHaveBeenCalled();
    expect(h.ports.close.close).toHaveBeenCalledWith("close");
  });

  it("closes without asking when nothing was selected at all", async () => {
    const h = await openSjasmplusDialog();

    await h.dispatch({ type: "closeRequested" });

    expect(h.ports.confirm.confirm).not.toHaveBeenCalled();
    expect(h.ports.close.close).toHaveBeenCalledWith("close");
  });

  it("asks before dropping an unapplied selection, naming it", async () => {
    const h = await openSjasmplusDialog({ pickFile: CONFIGURED_PATH, confirm: true });
    await h.dispatch({ type: "selectExecutableRequested" });

    await h.dispatch({ type: "closeRequested" });

    expect(h.ports.confirm.confirm).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Discard SJASMPLUS setup?", code: CONFIGURED_PATH })
    );
    expect(h.ports.close.close).toHaveBeenCalledWith("close");
  });

  it("stays open when the discard prompt is declined", async () => {
    const h = await openSjasmplusDialog({ pickFile: CONFIGURED_PATH, confirm: false });
    await h.dispatch({ type: "selectExecutableRequested" });

    await h.dispatch({ type: "closeRequested" });

    expect(h.ports.close.close).not.toHaveBeenCalled();
  });

  it("asks when only the save scope changed", async () => {
    const h = await openSjasmplusDialog({ configured: true, env: { isKliveProject: true } });

    await h.dispatch({ type: "scopeSelected", scope: "project" });
    await h.dispatch({ type: "closeRequested" });

    // --- Same executable, different destination: Apply would still do something
    expect(h.ports.confirm.confirm).toHaveBeenCalled();
  });
});

describe("online releases", () => {
  const windows = { env: { isWindows: true } } as const;

  it("queries GitHub when the online source is chosen", async () => {
    const h = await openSjasmplusDialog({
      ...windows,
      service: { listReleases: async () => aReleaseList() }
    });

    expect(h.ports.service.listReleases).not.toHaveBeenCalled();
    await h.dispatch({ type: "setupModeSelected", mode: "online" });

    expect(h.ports.service.listReleases).toHaveBeenCalledWith({ includePrereleases: false });
    expect(h.vm.source.online).toMatchObject({
      kind: "available",
      selectedTag: "v1.24.0",
      selectedAssetName: "sjasmplus-1.24.0.win.zip",
      statusText: "Suggested v1.24.0",
      // --- Nothing has been chosen to download into yet
      downloadFolder: undefined,
      downloadEnabled: false
    });
  });

  it("never queries GitHub off Windows", async () => {
    const h = await openSjasmplusDialog();

    await h.dispatch({ type: "setupModeSelected", mode: "online" });

    // --- Upstream publishes Windows binaries only; there is nothing to ask for
    expect(h.ports.service.listReleases).not.toHaveBeenCalled();
    expect(h.vm.source.online).toMatchObject({ kind: "unavailable" });
  });

  it("reloads with prereleases when they are enabled", async () => {
    const h = await openSjasmplusDialog({
      ...windows,
      service: { listReleases: async () => aReleaseList() }
    });
    await h.dispatch({ type: "setupModeSelected", mode: "online" });

    await h.dispatch({ type: "prereleasesToggled", value: true });

    expect(h.ports.service.listReleases).toHaveBeenLastCalledWith({ includePrereleases: true });
  });

  it("does not query GitHub for a prerelease toggle made off the online source", async () => {
    const h = await openSjasmplusDialog(windows);

    await h.dispatch({ type: "prereleasesToggled", value: true });

    expect(h.ports.service.listReleases).not.toHaveBeenCalled();
  });

  it("reports a failed fetch without losing the dialog", async () => {
    const h = await openSjasmplusDialog({
      ...windows,
      service: {
        listReleases: async () => {
          throw new Error("getaddrinfo ENOTFOUND github.com");
        }
      }
    });

    await h.dispatch({ type: "setupModeSelected", mode: "online" });

    expect(h.vm.source.online).toMatchObject({
      statusText: "getaddrinfo ENOTFOUND github.com",
      statusFailed: true
    });
  });

  it("downloads the selected release, then validates before it can be applied", async () => {
    const releaseList = aReleaseList();
    const h = await openSjasmplusDialog({
      ...windows,
      pickFolder: "/downloads",
      service: {
        listReleases: async () => releaseList,
        downloadRelease: async () => okProbe("/downloads/sjasmplus/v1.24.0/bin/sjasmplus"),
        validateExecutable: async (path) => okProbe(path, "sjasmplus v1.24.0")
      }
    });
    await h.dispatch({ type: "setupModeSelected", mode: "online" });

    expect(h.vm.source.online).toMatchObject({ downloadEnabled: false });
    await h.dispatch({ type: "selectDownloadFolderRequested" });
    expect(h.vm.source.online).toMatchObject({ downloadEnabled: true });

    await h.dispatch({ type: "downloadRequested" });
    expect(h.ports.service.downloadRelease).toHaveBeenCalledWith({
      releaseTag: "v1.24.0",
      asset: releaseList.suggestedAsset,
      destinationFolder: "/downloads"
    });
    expect(h.vm.apply.validationLabel).toBe("Passed");

    await h.dispatch({ type: "applyRequested" });
    expect(h.ports.service.apply).toHaveBeenCalledWith({
      scope: "user",
      installFolder: "/downloads/sjasmplus/v1.24.0/bin",
      executablePath: "/downloads/sjasmplus/v1.24.0/bin/sjasmplus",
      version: "sjasmplus v1.24.0"
    });
  });

  it("does not download without a destination folder", async () => {
    const h = await openSjasmplusDialog({
      ...windows,
      service: { listReleases: async () => aReleaseList() }
    });
    await h.dispatch({ type: "setupModeSelected", mode: "online" });

    await h.dispatch({ type: "downloadRequested" });

    expect(h.ports.service.downloadRelease).not.toHaveBeenCalled();
  });

  it("stops at a failed download without running a smoke test", async () => {
    const h = await openSjasmplusDialog({
      ...windows,
      pickFolder: "/downloads",
      service: {
        listReleases: async () => aReleaseList(),
        downloadRelease: async () => ({ ok: false, error: "404 from GitHub" })
      }
    });
    await h.dispatch({ type: "setupModeSelected", mode: "online" });
    await h.dispatch({ type: "selectDownloadFolderRequested" });

    await h.dispatch({ type: "downloadRequested" });

    expect(h.ports.service.validateExecutable).not.toHaveBeenCalled();
    expect(h.vm.apply.message).toBe("404 from GitHub");
  });

  it("re-picks the asset when another release is selected", async () => {
    const older = anAsset({ name: "older.win.zip" });
    const h = await openSjasmplusDialog({
      ...windows,
      service: {
        listReleases: async () =>
          aReleaseList({
            releases: [
              aRelease("v1.24.0"),
              aRelease("v1.23.0", { assets: [older], compatibleAssets: [older] })
            ]
          })
      }
    });
    await h.dispatch({ type: "setupModeSelected", mode: "online" });

    await h.dispatch({ type: "releaseSelected", tagName: "v1.23.0" });

    expect(h.vm.source.online).toMatchObject({ selectedAssetName: "older.win.zip" });
  });
});

describe("environment changes", () => {
  it("re-tests when the configured executable changes underneath the dialog", async () => {
    const h = await openSjasmplusDialog({ configured: true });
    expect(h.ports.service.validateExecutable).toHaveBeenCalledTimes(1);

    await h.dispatch({
      type: "environmentChanged",
      env: aConfiguredEnv({ configured: { executablePath: "/other/sjasmplus" } })
    });

    expect(h.ports.service.validateExecutable).toHaveBeenLastCalledWith("/other/sjasmplus");
  });

  it("ignores a settings write that changes nothing this dialog cares about", async () => {
    const h = await openSjasmplusDialog({ configured: true });
    const stateBefore = h.state;

    // --- The container hands over a fresh object on every unrelated write; a
    // --- re-test (or a re-render) for that would be pure noise.
    await h.dispatch({ type: "environmentChanged", env: aConfiguredEnv() });

    expect(h.state).toBe(stateBefore);
    expect(h.ports.service.validateExecutable).toHaveBeenCalledTimes(1);
  });

  it("keeps a selection in progress through an unrelated settings write", async () => {
    const h = await openSjasmplusDialog({ pickFile: "/new/tools/sjasmplus" });
    await h.dispatch({ type: "selectExecutableRequested" });

    // --- Same environment, fresh object: nothing to react to
    await h.dispatch({ type: "environmentChanged", env: h.env });

    expect(h.vm.apply.candidatePath).toBe("/new/tools/sjasmplus");
  });

  it("lets a newly configured executable take over the candidate", async () => {
    const h = await openSjasmplusDialog({ pickFile: "/new/tools/sjasmplus" });
    await h.dispatch({ type: "selectExecutableRequested" });

    await h.dispatch({ type: "environmentChanged", env: aConfiguredEnv() });

    // --- Faithful to the pre-MVC dialog: the re-check records its verdict
    // --- against the candidate, so an install configured elsewhere (the
    // --- `sjasm` command, another window) replaces an unapplied selection.
    // --- Worth revisiting once the refactor has landed, but not while the
    // --- legacy suite is the regression gate.
    expect(h.vm.apply.candidatePath).toBe("/tools/sjasmplus/sjasmplus");
  });
});

describe("teardown", () => {
  it("drops a verdict that arrives after the dialog is gone", async () => {
    const gate = deferred<SjasmplusProbeResult>();
    const h = await openSjasmplusDialog({ configured: true });

    h.ports.service.validateExecutable.mockReturnValue(gate.promise);
    const running = h.send({ type: "testAgainRequested" });
    h.dispose();
    gate.resolve(failProbe(CONFIGURED_PATH, "too late"));
    await running;

    expect(h.state.statusError).toBe("");
  });
});
