import { describe, expect, it } from "vitest";

import { t } from "@common/i18n/i18n";

import { deferred } from "../../mvc/deferred";
import { expectConsole } from "../../expectedConsole";
import { FOLDER, createMakeProjectDialog, openMakeProjectDialog } from "./fakes";

describe("MakeProjectController — opening", () => {
  it("reads the folder's files and the machine's templates, and preselects zx-basic for BASIC", async () => {
    const h = await openMakeProjectDialog();

    expect(h.ports.service.getBuildRootCandidates).toHaveBeenCalledWith(FOLDER);
    expect(h.ports.service.getTemplateDirectories).toHaveBeenCalledWith("sp48");
    expect(h.state.templateId).toBe("zx-basic");
    expect(h.state.buildRoot).toBe("main.bas");
    expect(h.ports.service.getConflicts).toHaveBeenLastCalledWith(FOLDER, "sp48", "zx-basic");
    expect(h.vm.submitEnabled).toBe(true);
  });

  it("is not ready while the folder's files are being read", async () => {
    const gate = deferred<string[]>();
    const h = createMakeProjectDialog({ service: { getBuildRootCandidates: () => gate.promise } });

    void h.send({ type: "opened" });
    await Promise.resolve();
    expect(h.vm.submitEnabled).toBe(false);
    expect(h.vm.buildRoot.loading).toBe(true);

    gate.resolve(["main.bas"]);
    await h.settle();
    expect(h.vm.submitEnabled).toBe(true);
  });

  it("goes on without a file list when it cannot be read", async () => {
    const consoleError = expectConsole("error");
    const h = await openMakeProjectDialog({
      service: {
        getBuildRootCandidates: async () => {
          throw new Error("no tree");
        }
      }
    });
    expect(consoleError.mock.calls[0][0]).toMatch(/build-root candidates/);
    expect(h.state.candidates).toEqual([]);
    // --- Without BASIC files to go by, the machine's default template (Q7)
    expect(h.state.templateId).toBe("default");
    expect(h.vm.submitEnabled).toBe(true);
  });
});

describe("MakeProjectController — choosing", () => {
  it("reloads the conflicts when the template changes", async () => {
    const h = await openMakeProjectDialog({
      service: {
        getConflicts: async (_f, _m, templateId) =>
          templateId === "zx-basic" ? [{ path: "build.ksx", canOverwrite: true }] : []
      }
    });
    expect(h.vm.conflicts.visible).toBe(true);

    await h.dispatch({ type: "templateSelected", templateId: "default" });

    expect(h.ports.service.getConflicts).toHaveBeenLastCalledWith(FOLDER, "sp48", "default");
    expect(h.vm.conflicts.visible).toBe(false);
  });

  // --- Decision Q7: a machine without templates cannot make a project
  it("offers only the machine types that have templates", async () => {
    const h = await openMakeProjectDialog({
      service: {
        getTemplateDirectories: async (machineId) => (machineId === "unknown" ? [] : ["default", "zx-basic"])
      }
    });

    const ids = h.vm.machineType.options.map((o) => o.value);
    expect(ids).toContain("sp48");
    expect(ids).not.toContain("unknown");
  });

  it("moves off a running machine without templates and loads the new one's templates", async () => {
    const h = await openMakeProjectDialog({
      context: { running: { machineId: "unknown" }, favorites: [] },
      service: { getTemplateDirectories: async (machineId) => (machineId === "unknown" ? [] : ["default"]) }
    });

    expect(h.state.machineId).not.toBe("unknown");
    expect(h.ports.service.getTemplateDirectories).toHaveBeenCalledWith(h.state.machineId);
    expect(h.state.templateId).toBe("default");
    expect(h.vm.submitEnabled).toBe(true);
  });

  it("cannot make a project when the machine's templates cannot be read", async () => {
    const h = await openMakeProjectDialog({
      service: {
        getTemplateDirectories: async () => {
          throw new Error("no templates folder");
        }
      }
    });

    expect(h.vm.template.options).toEqual([]);
    expect(h.vm.submitEnabled).toBe(false);
    await h.dispatch({ type: "submitRequested" });
    expect(h.ports.service.convert).not.toHaveBeenCalled();
  });

  it("reloads the templates and the conflicts for another machine", async () => {
    const h = await openMakeProjectDialog();

    await h.dispatch({ type: "machineTypeSelected", machineId: "zxnext" });

    expect(h.ports.service.getTemplateDirectories).toHaveBeenLastCalledWith("zxnext");
    // --- Same template name, another machine: its files may differ
    expect(h.ports.service.getConflicts).toHaveBeenLastCalledWith(FOLDER, "zxnext", "zx-basic");
  });

  it("lets a slow conflict list of an earlier template not land on a later one", async () => {
    const slow = deferred<{ path: string; canOverwrite: boolean }[]>();
    let calls = 0;
    const h = await openMakeProjectDialog({
      service: {
        getConflicts: async (_f, _m, templateId) => {
          calls++;
          return templateId === "default" ? slow.promise : [];
        }
      }
    });

    void h.send({ type: "templateSelected", templateId: "default" });
    void h.send({ type: "templateSelected", templateId: "zx-basic" });
    await Promise.resolve();
    slow.resolve([{ path: "build.ksx", canOverwrite: true }]);
    await h.settle();

    expect(calls).toBeGreaterThan(1);
    expect(h.state.conflicts).toEqual([]);
  });
});

describe("MakeProjectController — keeping the folder", () => {
  it("remembers the folder and closes, writing nothing", async () => {
    const h = await openMakeProjectDialog();

    await h.dispatch({ type: "choiceSelected", choice: "keep" });
    await h.dispatch({ type: "submitRequested" });

    expect(h.ports.service.rememberPlainFolder).toHaveBeenCalledWith(FOLDER);
    expect(h.ports.service.convert).not.toHaveBeenCalled();
    expect(h.ports.close.done).toHaveBeenCalledWith({ choice: "keep", folder: FOLDER });
  });

  it("does not remember the folder on Cancel", async () => {
    const h = await openMakeProjectDialog();

    await h.dispatch({ type: "cancelRequested" });

    expect(h.ports.service.rememberPlainFolder).not.toHaveBeenCalled();
    expect(h.ports.close.cancelled).toHaveBeenCalled();
  });
});

describe("MakeProjectController — making the project", () => {
  it("converts, reopens the folder, waits for it and shows the build root", async () => {
    const h = await openMakeProjectDialog({
      service: { getConflicts: async () => [{ path: "build.ksx", canOverwrite: true }] }
    });
    await h.dispatch({ type: "overwriteToggled", path: "build.ksx", overwrite: true });

    await h.dispatch({ type: "submitRequested" });

    expect(h.ports.service.convert).toHaveBeenCalledWith({
      folder: FOLDER,
      machineId: "sp48",
      modelId: "pal",
      templateId: "zx-basic",
      overwrite: ["build.ksx"],
      buildRoot: "main.bas"
    });
    expect(h.ports.service.openFolder).toHaveBeenCalledWith(FOLDER);
    expect(h.ports.service.ensureProjectLoaded).toHaveBeenCalledWith(FOLDER);
    expect(h.ports.service.ensureWorkspaceLoaded).toHaveBeenCalledWith(FOLDER);
    expect(h.ports.service.navigateTo).toHaveBeenCalledWith("main.bas");
    expect(h.ports.close.done).toHaveBeenCalledWith({ choice: "make", folder: FOLDER });
    expect(h.state.busy).toBe(false);
  });

  it("shows the main process's refusal and stays open", async () => {
    const h = await openMakeProjectDialog({
      service: { convert: async () => ({ errorMessage: "The build root x is not a file" }) }
    });

    const consoleError = expectConsole("error");
    await h.dispatch({ type: "submitRequested" });
    expect(consoleError.mock.calls[0][0]).toMatch(/Making the folder a Klive project failed/);

    expect(h.ports.service.notify).toHaveBeenCalledWith(
      "error",
      t("dialog.makeProject.error.title"),
      "The build root x is not a file"
    );
    expect(h.ports.service.openFolder).not.toHaveBeenCalled();
    expect(h.ports.close.done).not.toHaveBeenCalled();
    expect(h.vm.submitEnabled).toBe(true);
  });

  it("reports a folder that could not be reopened", async () => {
    const h = await openMakeProjectDialog({ service: { openFolder: async () => "locked" } });

    const consoleError = expectConsole("error");
    await h.dispatch({ type: "submitRequested" });
    expect(consoleError.mock.calls[0][0]).toMatch(/Making the folder a Klive project failed/);

    expect(h.ports.service.notify.mock.calls[0][2]).toContain("locked");
    expect(h.ports.close.done).not.toHaveBeenCalled();
  });

  it("times out a step that never answers", async () => {
    const h = await openMakeProjectDialog({
      timeoutMs: 20,
      service: { convert: () => new Promise(() => {}) }
    });

    const consoleError = expectConsole("error");
    await h.dispatch({ type: "submitRequested" });
    expect(consoleError.mock.calls[0][0]).toMatch(/Making the folder a Klive project failed/);

    expect(h.ports.service.notify.mock.calls[0][2]).toBe(
      t("dialog.makeProject.error.timeout", { seconds: 0.02 })
    );
    expect(h.state.busy).toBe(false);
  });

  it("ignores a submit before the dialog is ready", async () => {
    const h = createMakeProjectDialog();

    await h.dispatch({ type: "submitRequested" });

    expect(h.ports.service.convert).not.toHaveBeenCalled();
  });
});
