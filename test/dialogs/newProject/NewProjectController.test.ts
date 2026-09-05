import { describe, expect, it, vi } from "vitest";

import {
  CREATE_ERROR_TITLE,
  NEW_PROJECT_FOLDER_SETTINGS_KEY
} from "@renderer/appIde/dialogs/newProject/NewProjectModel";

import { deferred } from "../../mvc/deferred";
import {
  anEnv,
  createNewProjectDialog,
  fillForm,
  openNewProjectDialog,
  rejectingValidation
} from "./fakes";

describe("NewProjectController — opening", () => {
  it("loads the templates of the machine it opened on", async () => {
    const h = await openNewProjectDialog();

    expect(h.ports.service.getTemplateDirectories).toHaveBeenCalledWith("sp48");
    expect(h.vm.template.options.map((option) => option.value)).toEqual([
      "default",
      "advanced"
    ]);
    expect(h.vm.template.loading).toBe(false);
  });

  it("shows the template list as loading while it is fetched", async () => {
    const gate = deferred<string[]>();
    const h = createNewProjectDialog({
      service: { getTemplateDirectories: () => gate.promise }
    });

    void h.send({ type: "opened" });
    expect(h.vm.template.loading).toBe(true);

    gate.resolve(["default"]);
    await h.settle();
    expect(h.vm.template.loading).toBe(false);
  });

  it("survives a template lookup that fails", async () => {
    // --- The old effect had no failure path: a rejection escaped as an
    // --- unhandled promise and left the dialog loading forever.
    const h = await openNewProjectDialog({
      service: {
        getTemplateDirectories: async () => {
          throw new Error("no templates directory");
        }
      }
    });

    expect(h.vm.template.loading).toBe(false);
    expect(h.vm.template.options).toEqual([]);
  });
});

describe("NewProjectController — choosing a machine", () => {
  it("reloads the templates for the machine that was picked", async () => {
    const h = await openNewProjectDialog();

    await h.dispatch({ type: "machineSelected", value: "z88" });

    expect(h.state).toMatchObject({ machineId: "z88", modelId: undefined });
    expect(h.ports.service.getTemplateDirectories).toHaveBeenLastCalledWith("z88");
  });

  it("keeps the chosen template when the new machine also offers it", async () => {
    const h = await openNewProjectDialog();
    await h.dispatch({ type: "templateSelected", templateId: "advanced" });

    await h.dispatch({ type: "machineSelected", value: "z88" });

    expect(h.vm.template.value).toBe("advanced");
  });

  it("falls back to the default when the new machine does not offer it", async () => {
    const h = await openNewProjectDialog();
    await h.dispatch({ type: "templateSelected", templateId: "advanced" });
    h.ports.service.getTemplateDirectories.mockResolvedValue(["default", "zxbasic"]);

    await h.dispatch({ type: "machineSelected", value: "z88" });

    expect(h.vm.template.value).toBe("default");
  });

  it("ignores a template list that a newer machine has superseded", async () => {
    // --- Switching machines twice quickly used to let the first machine's
    // --- templates land on the second machine's dropdown, because the old
    // --- effect's `cancelled` flag only covered unmount, not overtaking.
    const slow = deferred<string[]>();
    const fast = deferred<string[]>();
    const h = createNewProjectDialog();
    h.ports.service.getTemplateDirectories
      .mockReturnValueOnce(slow.promise)
      .mockReturnValueOnce(fast.promise);

    void h.send({ type: "machineSelected", value: "z88" });
    void h.send({ type: "machineSelected", value: "spp3e:floppy" });

    fast.resolve(["floppy-template"]);
    slow.resolve(["z88-template"]);
    await h.settle();

    expect(h.vm.template.options.map((option) => option.value)).toEqual(["floppy-template"]);
  });
});

describe("NewProjectController — the folder picker", () => {
  it("fills the folder from the picker", async () => {
    const h = await openNewProjectDialog({ pickFolder: "/picked" });

    await h.dispatch({ type: "selectFolderRequested" });

    expect(h.ports.files.pickFolder).toHaveBeenCalledWith(NEW_PROJECT_FOLDER_SETTINGS_KEY);
    expect(h.vm.projectFolder.value).toBe("/picked");
  });

  it("leaves the folder alone when the picker is dismissed", async () => {
    const h = await openNewProjectDialog();
    await fillForm(h, { folder: "/kept" });

    await h.dispatch({ type: "selectFolderRequested" });

    expect(h.vm.projectFolder.value).toBe("/kept");
  });
});

describe("NewProjectController — creating a project", () => {
  it("runs the whole sequence in order and hands the result back", async () => {
    const order: string[] = [];
    const h = await openNewProjectDialog({
      service: {
        createProject: async () => {
          order.push("create");
          return "/projects/MyProject";
        },
        openFolder: async () => {
          order.push("open");
          return undefined;
        },
        ensureProjectLoaded: async () => {
          order.push("project");
        },
        ensureWorkspaceLoaded: async () => {
          order.push("workspace");
        },
        loadBuildRoots: async () => {
          order.push("buildRoots");
          return ["code/main.kz80.asm"];
        }
      }
    });
    await fillForm(h, { name: "MyProject", folder: "/projects" });

    await h.dispatch({ type: "createRequested" });

    expect(order).toEqual(["create", "open", "project", "workspace", "buildRoots"]);
    expect(h.ports.service.createProject).toHaveBeenCalledWith({
      machineId: "sp48",
      modelId: "pal",
      templateId: "default",
      projectName: "MyProject",
      projectFolder: "/projects"
    });
    expect(h.ports.service.navigateTo).toHaveBeenCalledWith("code/main.kz80.asm");
    expect(h.ports.close.created).toHaveBeenCalledWith(
      expect.objectContaining({ projectName: "MyProject" })
    );
  });

  it("navigates nowhere when the new project has no build root", async () => {
    const h = await openNewProjectDialog({ service: { loadBuildRoots: async () => [] } });
    await fillForm(h);

    await h.dispatch({ type: "createRequested" });

    expect(h.ports.service.navigateTo).not.toHaveBeenCalled();
    // --- Still a success: a project without a build root is a valid project.
    expect(h.ports.close.created).toHaveBeenCalled();
  });

  it("refuses an incomplete form even when asked directly", async () => {
    const h = await openNewProjectDialog();

    await h.dispatch({ type: "createRequested" });

    expect(h.ports.service.createProject).not.toHaveBeenCalled();
  });

  it("refuses a form the rules reject", async () => {
    const h = await openNewProjectDialog({
      env: anEnv({ validation: rejectingValidation({ isValidFilename: () => false }) })
    });
    await fillForm(h);

    await h.dispatch({ type: "createRequested" });

    expect(h.ports.service.createProject).not.toHaveBeenCalled();
  });
});

describe("NewProjectController — when a step fails", () => {
  it("stops after a failed creation and reports it", async () => {
    const h = await openNewProjectDialog({
      service: {
        createProject: async () => {
          throw new Error("disk full");
        }
      }
    });
    await fillForm(h);

    await h.dispatch({ type: "createRequested" });

    expect(h.ports.service.openFolder).not.toHaveBeenCalled();
    expect(h.ports.service.notify).toHaveBeenCalledWith("error", CREATE_ERROR_TITLE, "disk full");
    expect(h.ports.close.created).not.toHaveBeenCalled();
    // --- The dialog stays open with what the user typed still in it.
    expect(h.vm.projectName.value).toBe("MyProject");
    expect(h.vm.submitEnabled).toBe(true);
  });

  it("treats a folder that reports a problem as a failure", async () => {
    // --- The main process reports this one as a value, not a rejection, so it
    // --- would otherwise sail straight past.
    const h = await openNewProjectDialog({
      service: { openFolder: async () => "no such directory" }
    });
    await fillForm(h);

    await h.dispatch({ type: "createRequested" });

    expect(h.ports.service.ensureProjectLoaded).not.toHaveBeenCalled();
    expect(h.ports.service.notify).toHaveBeenCalledWith(
      "error",
      CREATE_ERROR_TITLE,
      "Error opening folder: no such directory"
    );
    expect(h.ports.close.created).not.toHaveBeenCalled();
  });

  it("stops after the project fails to load", async () => {
    const h = await openNewProjectDialog({
      service: {
        ensureProjectLoaded: async () => {
          throw new Error("project is corrupt");
        }
      }
    });
    await fillForm(h);

    await h.dispatch({ type: "createRequested" });

    expect(h.ports.service.ensureWorkspaceLoaded).not.toHaveBeenCalled();
    expect(h.ports.service.notify).toHaveBeenCalledWith(
      "error",
      CREATE_ERROR_TITLE,
      "project is corrupt"
    );
  });

  it("reports a step that overran its budget", async () => {
    const h = await openNewProjectDialog({
      timeoutMs: 10,
      service: { createProject: () => new Promise<string>(() => undefined) }
    });
    await fillForm(h);

    await h.dispatch({ type: "createRequested" });

    expect(h.ports.service.notify).toHaveBeenCalledWith(
      "error",
      CREATE_ERROR_TITLE,
      "Creating the Klive project timed out after 0.01 seconds."
    );
    // --- And the dialog comes back to life rather than staying stuck busy.
    expect(h.vm.submitting).toBe(false);
  });

  it("does not let a failing message box replace the failure it reports", async () => {
    const h = await openNewProjectDialog({
      service: {
        createProject: async () => {
          throw new Error("disk full");
        },
        notify: async () => {
          throw new Error("no window to show it in");
        }
      }
    });
    await fillForm(h);

    await h.dispatch({ type: "createRequested" });

    // --- The dialog is still usable, which is the point: the second failure
    // --- must not take the first one's place or wedge the form.
    expect(h.vm.submitting).toBe(false);
    expect(h.vm.submitEnabled).toBe(true);
  });
});

describe("NewProjectController — work in flight", () => {
  it("shows the form as submitting while the sequence runs", async () => {
    const gate = deferred<string>();
    const h = await openNewProjectDialog({ service: { createProject: () => gate.promise } });
    await fillForm(h);

    void h.send({ type: "createRequested" });
    expect(h.vm.submitting).toBe(true);
    expect(h.vm.submitEnabled).toBe(false);

    gate.resolve("/projects/MyProject");
    await h.settle();
    expect(h.vm.submitting).toBe(false);
  });

  it("creates once when Create is pressed twice", async () => {
    const gate = deferred<string>();
    const h = await openNewProjectDialog({ service: { createProject: () => gate.promise } });
    await fillForm(h);

    void h.send({ type: "createRequested" });
    void h.send({ type: "createRequested" });
    gate.resolve("/projects/MyProject");
    await h.settle();

    expect(h.ports.service.createProject).toHaveBeenCalledTimes(1);
    expect(h.ports.close.created).toHaveBeenCalledTimes(1);
  });

  it("creates the project as it was described when Create was pressed", async () => {
    const gate = deferred<string>();
    const h = await openNewProjectDialog({ service: { createProject: () => gate.promise } });
    await fillForm(h, { name: "First" });

    void h.send({ type: "createRequested" });
    // --- `send`, not `dispatch`: dispatch drains every pending handler, and the
    // --- creation it would wait for is the one this test is holding open.
    await h.send({ type: "projectNameEdited", name: "Second" });

    gate.resolve("/projects/First");
    await h.settle();

    expect(h.ports.close.created).toHaveBeenCalledWith(
      expect.objectContaining({ projectName: "First" })
    );
  });

  it("does not settle a dialog that was torn down mid-sequence", async () => {
    const gate = deferred<string>();
    const h = await openNewProjectDialog({ service: { createProject: () => gate.promise } });
    await fillForm(h);

    void h.send({ type: "createRequested" });
    h.dispose();
    gate.resolve("/projects/MyProject");
    await h.settle();

    expect(h.ports.close.created).not.toHaveBeenCalled();
    expect(h.ports.service.navigateTo).not.toHaveBeenCalled();
  });

  it("does not report a failure to a dialog that was torn down", async () => {
    const gate = deferred<string>();
    const h = await openNewProjectDialog({ service: { createProject: () => gate.promise } });
    await fillForm(h);

    void h.send({ type: "createRequested" });
    h.dispose();
    gate.reject(new Error("disk full"));
    await h.settle();

    expect(h.ports.service.notify).not.toHaveBeenCalled();
  });

  it("survives a dispose/activate cycle and still creates", async () => {
    const h = await openNewProjectDialog();
    h.controller.dispose();
    h.controller.activate();

    await fillForm(h);
    await h.dispatch({ type: "createRequested" });

    expect(h.ports.close.created).toHaveBeenCalled();
  });
});

describe("NewProjectController — closing", () => {
  it("cancels without creating anything", async () => {
    const h = await openNewProjectDialog();
    await fillForm(h);

    await h.dispatch({ type: "cancelRequested" });

    expect(h.ports.close.cancelled).toHaveBeenCalledTimes(1);
    expect(h.ports.service.createProject).not.toHaveBeenCalled();
  });
});

describe("NewProjectController — environment", () => {
  it("re-validates against a rule set that arrived while the dialog was open", async () => {
    const h = await openNewProjectDialog();
    await fillForm(h);
    expect(h.vm.submitEnabled).toBe(true);

    await h.dispatch({
      type: "environmentChanged",
      env: anEnv({ validation: rejectingValidation({ isValidFilename: () => false }) })
    });

    expect(h.vm.submitEnabled).toBe(false);
  });

  it("keeps the same view model when an unchanged environment is pushed in", async () => {
    const h = await openNewProjectDialog();
    const before = h.vm;

    await h.dispatch({ type: "environmentChanged", env: { validation: h.env.validation } });

    expect(h.vm).toBe(before);
  });
});
