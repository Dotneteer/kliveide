import { describe, expect, it, vi, type Mock } from "vitest";

import { t } from "@common/i18n/i18n";
import type {
  BorielInstallResult,
  BorielSetupStatus
} from "@common/messaging/BorielIntegration";
import { BorielSetupController } from "@renderer/appIde/dialogs/boriel/BorielSetupController";
import { initialState, reduce, type BorielSetupMode } from "@renderer/appIde/dialogs/boriel/BorielSetupModel";
import type { BorielServicePort } from "@renderer/appIde/dialogs/boriel/BorielSetupPorts";
import { LICENCE_NOTE, primaryLabel, selectViewModel } from "@renderer/appIde/dialogs/boriel/BorielSetupViewModel";

import { harnessFor } from "../../mvc/ControllerHarness";
import { deferred } from "../../mvc/deferred";

const HOME_FOLDER = "/home/me/zxbasic2";
const KIT = { kind: "available", version: "2.0.0-beta25", file: "kit.tar.gz", platformKey: "darwin-arm64" } as const;

const aStatus = (over: Partial<BorielSetupStatus> = {}): BorielSetupStatus => ({
  kit: KIT,
  installation: { kind: "notConfigured" },
  defaultFolder: HOME_FOLDER,
  declined: false,
  compiler: "klive",
  compilerFromProject: false,
  ...over
});
const working = (folder = HOME_FOLDER, outdated = false): BorielSetupStatus["installation"] => ({
  kind: "working",
  folder,
  executablePath: `${folder}/zxbc`,
  version: outdated ? "2.0.0-beta3" : "2.0.0-beta25",
  outdated
});
const installed = (folder = HOME_FOLDER): BorielInstallResult => ({
  kind: "installed",
  folder,
  executablePath: `${folder}/zxbc`,
  version: "2.0.0-beta25"
});

type Options = {
  mode?: BorielSetupMode;
  statuses?: BorielSetupStatus[];
  service?: Partial<BorielServicePort>;
  pickFolder?: string;
};

async function openDialog(options: Options = {}) {
  const statuses = [...(options.statuses ?? [aStatus()])];
  const service = {
    getStatus: vi.fn(options.service?.getStatus ?? (async () => statuses.length > 1 ? statuses.shift()! : statuses[0])),
    install: vi.fn(options.service?.install ?? (async (folder: string) => installed(folder))),
    useExisting: vi.fn(options.service?.useExisting ?? (async (folder: string) => installed(folder))),
    recordDecision: vi.fn(options.service?.recordDecision ?? (async () => undefined)),
    setCompiler: vi.fn(options.service?.setCompiler ?? (async () => undefined))
  } satisfies Record<keyof BorielServicePort, Mock>;
  const ports = {
    files: { pickFile: vi.fn(async () => undefined), pickFolder: vi.fn(async () => options.pickFolder) },
    close: { close: vi.fn() },
    service
  };
  const controller = new BorielSetupController(ports, options.mode ?? "settings");
  const h = harnessFor(controller, { ports });
  await h.dispatch({ type: "opened" });
  return h;
}

describe("opening", () => {
  it("proposes ~/zxbasic2 when nothing is installed", async () => {
    const h = await openDialog();
    expect(h.vm.status).toMatchObject({ kind: "none", headline: "Not installed" });
    expect(h.vm.folder.value).toBe(HOME_FOLDER);
    expect(h.vm.primary).toEqual({ label: "Install", enabled: true });
    expect(h.vm.kit.text).toBe("Boriel BASIC 2.0.0-beta25 (bundled with Klive)");
    expect(h.vm.licenceNote).toBe(t(LICENCE_NOTE));
  });

  it("proposes the configured installation's folder and names the action", async () => {
    const h = await openDialog({ statuses: [aStatus({ installation: working("/opt/boriel", true) })] });
    expect(h.vm.folder.value).toBe("/opt/boriel");
    expect(h.vm.status.kind).toBe("outdated");
    expect(h.vm.primary.label).toBe("Update");
  });

  it("cannot install without a bundled kit", async () => {
    const h = await openDialog({
      statuses: [aStatus({ kit: { kind: "unavailable", platformKey: "linux-arm", reason: "No kit here." } })]
    });
    expect(h.vm.primary.enabled).toBe(false);
    expect(h.vm.kit).toEqual({ available: false, text: "No kit here." });
    expect(h.vm.useExisting.enabled).toBe(true);
  });

  it("reports a status that cannot be read", async () => {
    const h = await openDialog({ service: { getStatus: async () => Promise.reject(new Error("main is gone")) } });
    expect(h.vm.status).toMatchObject({ kind: "error", detail: "main is gone" });
    expect(h.vm.primary.enabled).toBe(false);
  });
});

describe("installing", () => {
  it("installs into the chosen folder, then shows what Klive uses now", async () => {
    const h = await openDialog({
      statuses: [aStatus(), aStatus({ installation: working("/data/zx") })],
      pickFolder: "/data/zx"
    });
    await h.dispatch({ type: "browseFolderRequested" });
    expect(h.vm.folder.value).toBe("/data/zx");
    await h.dispatch({ type: "installRequested" });
    expect(h.ports.service.install).toHaveBeenCalledWith("/data/zx");
    expect(h.vm.message).toEqual({ kind: "installed", text: "Boriel BASIC 2.0.0-beta25 is installed in /data/zx." });
    expect(h.vm.status.kind).toBe("working");
    expect(h.vm.primary.label).toBe("Reinstall");
  });

  it("locks the dialog while installing", async () => {
    const gate = deferred<BorielInstallResult>();
    const h = await openDialog({ service: { install: () => gate.promise } });
    void h.send({ type: "installRequested" });
    expect(h.vm.message).toEqual({ kind: "progress", text: "Installing Boriel BASIC..." });
    expect(h.vm.primary.enabled).toBe(false);
    expect(h.vm.cancel.enabled).toBe(false);
    // --- send, not dispatch: dispatch also waits for the install this test holds open
    await h.send({ type: "closeRequested" });
    expect(h.ports.close.close).not.toHaveBeenCalled();
    gate.resolve(installed());
    await h.settle();
    expect(h.vm.primary.enabled).toBe(true);
  });

  it("shows why an installation failed and keeps the typed folder", async () => {
    const h = await openDialog({
      service: { install: async (folder) => ({ kind: "failed", folder, error: "Folder is not empty." }) }
    });
    await h.dispatch({ type: "folderEdited", folder: "/busy" });
    await h.dispatch({ type: "installRequested" });
    expect(h.vm.message).toEqual({ kind: "failed", text: "Folder is not empty." });
    expect(h.vm.folder.value).toBe("/busy");
  });

  it("does not install into an empty folder field", async () => {
    const h = await openDialog();
    await h.dispatch({ type: "folderEdited", folder: "  " });
    expect(h.vm.primary.enabled).toBe(false);
    await h.dispatch({ type: "installRequested" });
    expect(h.ports.service.install).not.toHaveBeenCalled();
  });

  it("uses an existing installation the user picks", async () => {
    const h = await openDialog({ pickFolder: "/opt/zxbasic" });
    await h.dispatch({ type: "useExistingRequested" });
    expect(h.ports.service.useExisting).toHaveBeenCalledWith("/opt/zxbasic");
    expect(h.vm.message?.text).toBe("Klive now uses Boriel BASIC 2.0.0-beta25 in /opt/zxbasic.");
  });

  it("does nothing when the folder picker is dismissed", async () => {
    const h = await openDialog();
    await h.dispatch({ type: "useExistingRequested" });
    expect(h.ports.service.useExisting).not.toHaveBeenCalled();
  });
});

describe("closing", () => {
  it("records 'Not now' in the offer, so it asks again", async () => {
    const h = await openDialog({ mode: "offer" });
    expect(h.vm.cancel.label).toBe("Not now");
    expect(h.vm.intro).toMatch(/comes with Boriel BASIC 2\.0\.0-beta25/);
    await h.dispatch({ type: "closeRequested" });
    expect(h.ports.service.recordDecision).toHaveBeenCalledWith("postponed");
    expect(h.ports.close.close).toHaveBeenCalledWith("close");
  });

  it("records 'Don't offer this again'", async () => {
    const h = await openDialog({ mode: "offer" });
    await h.dispatch({ type: "dontAskAgainToggled", value: true });
    await h.dispatch({ type: "closeRequested" });
    expect(h.ports.service.recordDecision).toHaveBeenCalledWith("declined");
  });

  it("needs no answer once Boriel BASIC got installed", async () => {
    const h = await openDialog({ mode: "offer", statuses: [aStatus(), aStatus({ installation: working() })] });
    await h.dispatch({ type: "installRequested" });
    await h.dispatch({ type: "closeRequested" });
    expect(h.ports.service.recordDecision).not.toHaveBeenCalled();
    expect(h.ports.close.close).toHaveBeenCalled();
  });

  it("records nothing when opened from Settings", async () => {
    const h = await openDialog();
    expect(h.vm.cancel.label).toBe("Close");
    expect(h.vm.dontAskAgain.visible).toBe(false);
    expect(h.vm.intro).toBeUndefined();
    await h.dispatch({ type: "closeRequested" });
    expect(h.ports.service.recordDecision).not.toHaveBeenCalled();
    expect(h.ports.close.close).toHaveBeenCalled();
  });

  it("stays open when the answer cannot be saved", async () => {
    const h = await openDialog({ mode: "offer", service: { recordDecision: async () => Promise.reject(new Error("disk full")) } });
    await h.dispatch({ type: "closeRequested" });
    expect(h.ports.close.close).not.toHaveBeenCalled();
    expect(h.vm.message).toEqual({ kind: "failed", text: "disk full" });
  });
});

describe("choosing the compiler", () => {
  it("offers the switch only once Boriel BASIC works", async () => {
    const none = await openDialog();
    expect(none.vm.useBoriel.visible).toBe(false);
    const ready = await openDialog({ statuses: [aStatus({ installation: working() })] });
    expect(ready.vm.useBoriel).toMatchObject({ visible: true, value: false, enabled: true });
  });

  it("makes Boriel BASIC the compiler, then shows the new state", async () => {
    const h = await openDialog({
      statuses: [aStatus({ installation: working() }), aStatus({ installation: working(), compiler: "boriel" })]
    });
    await h.dispatch({ type: "useBorielToggled", value: true });
    expect(h.ports.service.setCompiler).toHaveBeenCalledWith("boriel");
    expect(h.vm.useBoriel.value).toBe(true);
    // --- Already the chosen compiler: nothing to write
    await h.dispatch({ type: "useBorielToggled", value: true });
    expect(h.ports.service.setCompiler).toHaveBeenCalledTimes(1);
    await h.dispatch({ type: "useBorielToggled", value: false });
    expect(h.ports.service.setCompiler).toHaveBeenLastCalledWith("klive");
  });

  it("says when the project chooses its own compiler, which the checkbox then changes", async () => {
    const h = await openDialog({ statuses: [aStatus({ installation: working(), compilerFromProject: true })] });
    expect(h.vm.useBoriel.note).toMatch(/project chooses its own compiler: this changes the project's choice/);
  });

  it("shows why the setting could not be written", async () => {
    const h = await openDialog({
      statuses: [aStatus({ installation: working() })],
      service: { setCompiler: async () => Promise.reject(new Error("settings are read-only")) }
    });
    await h.dispatch({ type: "useBorielToggled", value: true });
    expect(h.vm.message).toEqual({ kind: "failed", text: "settings are read-only" });
    expect(h.vm.primary.enabled).toBe(true);
  });
});

describe("model rules", () => {
  it("names the primary action after the installation", () => {
    expect(primaryLabel(undefined)).toBe("Install");
    expect(primaryLabel({ kind: "broken", folder: "/x", executablePath: "/x/zxbc", error: "gone" })).toBe("Repair");
    expect(primaryLabel(working(HOME_FOLDER, true))).toBe("Update");
    expect(primaryLabel(working())).toBe("Reinstall");
  });

  it("keeps a folder the user edited when the status reloads", () => {
    let state = reduce(initialState("settings"), { type: "folderChanged", folder: "/mine", edited: true });
    state = reduce(state, { type: "statusLoaded", status: aStatus() });
    expect(state.folder).toBe("/mine");
  });

  it("returns the same state for a no-op", () => {
    const state = reduce(initialState("settings"), { type: "statusLoaded", status: aStatus() });
    expect(reduce(state, { type: "folderChanged", folder: HOME_FOLDER, edited: false })).toBe(state);
    expect(reduce(state, { type: "dontAskAgainChanged", value: false })).toBe(state);
  });

  it("shows a broken installation's error", () => {
    const vm = selectViewModel(
      reduce(initialState("settings"), {
        type: "statusLoaded",
        status: aStatus({ installation: { kind: "broken", folder: "/x", executablePath: "/x/zxbc", error: "zxbc was not found" } })
      })
    );
    expect(vm.status).toEqual({ kind: "broken", headline: "Not working", detail: "zxbc was not found" });
    expect(vm.folder.value).toBe("/x");
  });
});
