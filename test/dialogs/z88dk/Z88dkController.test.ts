import { describe, expect, it } from "vitest";

import { DOWNLOAD_POLL_MS, Z88DK_DOWNLOAD_FOLDER_SETTINGS_KEY } from "@renderer/appIde/dialogs/z88dk/Z88dkPorts";

import { deferred } from "../../mvc/deferred";
import { aReleaseList, failProbe, okProbe, openZ88dkDialog, V23 } from "./fakes";

describe("opening", () => {
  it("re-tests the configured install, lists detected ones and loads the default folder", async () => {
    const h = await openZ88dkDialog({ configured: true, service: { getPathSuggestions: async () => [okProbe("/opt/z88dk")] } });
    expect(h.ports.service.validateInstall).toHaveBeenCalledWith("/tools/z88dk");
    expect(h.state.statusCheck).toBe("passed");
    expect(h.vm.source.local.suggestions.map((s) => s.root)).toEqual(["/opt/z88dk"]);
    expect(h.state.downloadFolder).toBe("/home/u/KliveTools/z88dk");
    // --- GitHub is not asked until the user looks at the online source
    expect(h.ports.service.listReleases).not.toHaveBeenCalled();
  });

  it("reports a configured folder that no longer works", async () => {
    const h = await openZ88dkDialog({
      configured: true,
      service: { validateInstall: async (root) => failProbe(root, "The selected folder is not a z88dk installation: it needs bin/zcc and lib/config.") }
    });
    expect(h.vm.status).toMatchObject({ kind: "configured", badge: "failed", headline: "Not working" });
  });
});

describe("local installation", () => {
  it("probes and tests a chosen folder, then applies it to the user settings", async () => {
    const h = await openZ88dkDialog({ pickFolder: "/Users/me/z88dk" });
    await h.dispatch({ type: "chooseFolderRequested" });
    expect(h.ports.service.probePath).toHaveBeenCalledWith("/Users/me/z88dk");
    expect(h.vm.apply).toMatchObject({ candidatePath: "/Users/me/z88dk", validationLabel: "Passed" });
    await h.dispatch({ type: "applyRequested" });
    expect(h.ports.service.apply).toHaveBeenCalledWith({ scope: "user", root: "/Users/me/z88dk", version: "v23854-4d530b6eb7-20251002" });
    expect(h.ports.close.close).toHaveBeenCalledWith("close");
  });

  it("shows the probe's reason for a folder that is not an install", async () => {
    const h = await openZ88dkDialog({
      pickFolder: "/tmp/empty",
      service: { probePath: async (p) => failProbe(p, "The selected folder is not a z88dk installation: it needs bin/zcc and lib/config.") }
    });
    await h.dispatch({ type: "chooseFolderRequested" });
    expect(h.ports.service.validateInstall).not.toHaveBeenCalledWith("/tmp/empty");
    expect(h.vm.apply.message).toMatch(/not a z88dk installation/);
  });

  it("picks only a listed detected install", async () => {
    const h = await openZ88dkDialog({ service: { getPathSuggestions: async () => [okProbe("/opt/z88dk")] } });
    await h.dispatch({ type: "suggestionPicked", root: "/elsewhere" });
    expect(h.ports.service.validateInstall).not.toHaveBeenCalled();
    await h.dispatch({ type: "suggestionPicked", root: "/opt/z88dk" });
    expect(h.ports.service.validateInstall).toHaveBeenCalledWith("/opt/z88dk");
  });

  it("drops a smoke test that a newer one overtook", async () => {
    const slow = deferred<ReturnType<typeof okProbe>>();
    let calls = 0;
    const h = await openZ88dkDialog({
      service: {
        getPathSuggestions: async () => [okProbe("/a"), okProbe("/b")],
        validateInstall: async (root) => (++calls === 1 ? slow.promise : okProbe(root))
      }
    });
    void h.send({ type: "suggestionPicked", root: "/a" });
    await h.send({ type: "suggestionPicked", root: "/b" });
    slow.resolve(failProbe("/a", "late"));
    await h.settle();
    expect(h.state.validation?.root).toBe("/b");
    expect(h.state.validation?.ok).toBe(true);
  });
});

describe("unsupported versions (C3)", () => {
  it("asks before applying an older version, and applies when confirmed", async () => {
    const h = await openZ88dkDialog({ pickFolder: "/old", confirm: true, service: { validateInstall: async (r) => okProbe(r, V23) } });
    await h.dispatch({ type: "chooseFolderRequested" });
    await h.dispatch({ type: "applyRequested" });
    expect(h.ports.confirm.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Use an unsupported z88dk?", code: "/old" }));
    expect(h.ports.service.apply).toHaveBeenCalledWith({ scope: "user", root: "/old", version: V23 });
  });

  it("saves nothing when the user declines", async () => {
    const h = await openZ88dkDialog({ pickFolder: "/old", confirm: false, service: { validateInstall: async (r) => okProbe(r, V23) } });
    await h.dispatch({ type: "chooseFolderRequested" });
    await h.dispatch({ type: "applyRequested" });
    expect(h.ports.service.apply).not.toHaveBeenCalled();
    expect(h.state.busy).toBeUndefined();
    expect(h.ports.close.close).not.toHaveBeenCalled();
  });

  it("applies a supported version without asking", async () => {
    const h = await openZ88dkDialog({ pickFolder: "/new" });
    await h.dispatch({ type: "chooseFolderRequested" });
    await h.dispatch({ type: "applyRequested" });
    expect(h.ports.confirm.confirm).not.toHaveBeenCalled();
  });
});

describe("online release", () => {
  it("lists releases once per session, and again on Refresh", async () => {
    const h = await openZ88dkDialog({ service: { listReleases: async () => aReleaseList() } });
    await h.dispatch({ type: "setupModeSelected", mode: "online" });
    await h.dispatch({ type: "setupModeSelected", mode: "local" });
    await h.dispatch({ type: "setupModeSelected", mode: "online" });
    expect(h.ports.service.listReleases).toHaveBeenCalledTimes(1);
    expect(h.ports.service.listReleases).toHaveBeenCalledWith({ refresh: false });
    await h.dispatch({ type: "refreshReleasesRequested" });
    expect(h.ports.service.listReleases).toHaveBeenLastCalledWith({ refresh: true });
  });

  it("never asks GitHub on Linux, where nothing can be downloaded", async () => {
    const h = await openZ88dkDialog({ env: { platform: "linux" } });
    await h.dispatch({ type: "setupModeSelected", mode: "online" });
    expect(h.ports.service.listReleases).not.toHaveBeenCalled();
    expect(h.vm.source.online.kind).toBe("unavailable");
  });

  it("reports GitHub's refusal in the panel", async () => {
    const h = await openZ88dkDialog({
      service: { listReleases: async () => Promise.reject(new Error("Cannot list z88dk releases. GitHub returned 403 Forbidden.")) }
    });
    await h.dispatch({ type: "setupModeSelected", mode: "online" });
    const online = h.vm.source.online;
    expect(online.kind === "available" && [online.statusText, online.statusFailed]).toEqual([
      "Cannot list z88dk releases. GitHub returned 403 Forbidden.",
      true
    ]);
  });

  it("downloads into the chosen folder, polls progress, and ends with a tested install", async () => {
    const gate = deferred<ReturnType<typeof okProbe>>();
    const h = await openZ88dkDialog({
      pickFolder: (key) => (key === Z88DK_DOWNLOAD_FOLDER_SETTINGS_KEY ? "/dl" : undefined),
      service: {
        listReleases: async () => aReleaseList(),
        downloadRelease: () => gate.promise,
        getDownloadProgress: async () => ({ phase: "downloading", receivedBytes: 1048576, totalBytes: 71934026 })
      }
    });
    await h.dispatch({ type: "setupModeSelected", mode: "online" });
    await h.dispatch({ type: "selectDownloadFolderRequested" });
    void h.send({ type: "downloadRequested" });
    await Promise.resolve();
    expect(h.ports.service.downloadRelease).toHaveBeenCalledWith({
      releaseTag: "v2.4",
      asset: expect.objectContaining({ name: "z88dk-osx-2.4.zip" }),
      destinationFolder: "/dl"
    });
    expect(h.ports.ticker.start).toHaveBeenCalledWith(DOWNLOAD_POLL_MS, expect.any(Function));
    h.ports.ticker.tick();
    await new Promise((r) => setTimeout(r, 0));
    const online = h.vm.source.online;
    expect(online.kind === "available" && online.progress?.label).toBe("1.0 MB of 68.6 MB");

    gate.resolve(okProbe("/dl/v2.4"));
    await h.settle();
    expect(h.ports.ticker.running()).toBe(false);
    expect(h.vm.apply).toMatchObject({ candidatePath: "/dl/v2.4", validationLabel: "Passed" });
    expect(h.vm.buttons.applyEnabled).toBe(true);
    // --- The download is tested by the service: no second smoke test
    expect(h.ports.service.validateInstall).not.toHaveBeenCalled();
    // --- The new install joins the detected ones
    expect(h.ports.service.getPathSuggestions).toHaveBeenCalledTimes(2);
  });

  it("cancels a running download", async () => {
    const gate = deferred<any>();
    const h = await openZ88dkDialog({ service: { listReleases: async () => aReleaseList(), downloadRelease: () => gate.promise } });
    await h.dispatch({ type: "setupModeSelected", mode: "online" });
    void h.send({ type: "downloadRequested" });
    await Promise.resolve();
    await h.send({ type: "cancelDownloadRequested" });
    expect(h.ports.service.cancelDownload).toHaveBeenCalled();
    gate.resolve({ ok: false, cancelled: true, error: "The download was cancelled." });
    await h.settle();
    expect(h.vm.apply.message).toBe("The download was cancelled; nothing was installed.");
    expect(h.vm.apply.validationLabel).toBe("Not tested");
  });

  it("shows a failed download's reason", async () => {
    const h = await openZ88dkDialog({
      service: {
        listReleases: async () => aReleaseList(),
        downloadRelease: async () => ({ ok: false, error: "Downloaded 10 bytes, expected 71934026." })
      }
    });
    await h.dispatch({ type: "setupModeSelected", mode: "online" });
    await h.dispatch({ type: "downloadRequested" });
    expect(h.vm.apply.message).toBe("Downloaded 10 bytes, expected 71934026.");
    expect(h.ports.ticker.running()).toBe(false);
  });
});

describe("closing", () => {
  it("closes at once with nothing pending", async () => {
    const h = await openZ88dkDialog({ configured: true });
    await h.dispatch({ type: "closeRequested" });
    expect(h.ports.confirm.confirm).not.toHaveBeenCalled();
    expect(h.ports.close.close).toHaveBeenCalledWith("close");
  });

  it("asks before dropping a tested, unapplied install", async () => {
    const h = await openZ88dkDialog({ pickFolder: "/new", confirm: false });
    await h.dispatch({ type: "chooseFolderRequested" });
    await h.dispatch({ type: "closeRequested" });
    expect(h.ports.confirm.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: "Discard the selection?", code: "/new" }));
    expect(h.ports.close.close).not.toHaveBeenCalled();
  });

  it("stops a running download when closed", async () => {
    const gate = deferred<any>();
    const h = await openZ88dkDialog({ service: { listReleases: async () => aReleaseList(), downloadRelease: () => gate.promise } });
    await h.dispatch({ type: "setupModeSelected", mode: "online" });
    void h.send({ type: "downloadRequested" });
    await Promise.resolve();
    await h.send({ type: "closeRequested" });
    expect(h.ports.service.cancelDownload).toHaveBeenCalled();
    expect(h.ports.close.close).toHaveBeenCalledWith("close");
    gate.resolve({ ok: false, cancelled: true });
    await h.settle();
  });
});

describe("teardown", () => {
  it("stops polling and ignores results after dispose, and works again once re-activated", async () => {
    const gate = deferred<any>();
    const h = await openZ88dkDialog({ service: { listReleases: async () => aReleaseList(), downloadRelease: () => gate.promise } });
    await h.dispatch({ type: "setupModeSelected", mode: "online" });
    void h.send({ type: "downloadRequested" });
    await Promise.resolve();
    h.dispose();
    expect(h.ports.ticker.running()).toBe(false);
    gate.resolve(okProbe("/dl/v2.4"));
    await h.settle();
    expect(h.state.validation).toBeUndefined();
    h.controller.activate();
    await h.dispatch({ type: "scopeSelected", scope: "project" });
    expect(h.state.scope).toBe("project");
  });
});
