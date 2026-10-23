import { describe, expect, it } from "vitest";

import {
  INITIAL_MACHINE_ID,
  INITIAL_MODEL_ID,
  INITIAL_TEMPLATE_ID,
  MACHINE_TYPES,
  OTHER_FAMILY,
  defaultModelOf,
  folderErrorOf,
  initialState,
  isComplete,
  machineTypeOptionsOf,
  modelOptionsOf,
  projectFolderPathOf,
  projectNameErrorOf,
  reduce,
  requestOf,
  resolveTemplateId,
  withTimeout
} from "@renderer/appIde/dialogs/newProject/NewProjectModel";

import { t } from "@common/i18n/i18n";
import { getAllMachineModels } from "@common/machines/machine-registry";

import { aState, anEnv, rejectingValidation } from "./fakes";

describe("NewProjectModel — machine types and models", () => {
  it("offers each machine type once, grouped by family in family order", () => {
    expect(MACHINE_TYPES.map((t) => t.machineId)).toEqual([
      "sp48", "sp128", "spp3e", "zxnext", "timex", "scorpion", "zx81", "zx80", "z88", "ht1080z", "c64"
    ]);
    expect(machineTypeOptionsOf(aState())[0]).toEqual({ value: "sp48", label: "ZX Spectrum 48K", group: "zxSpectrum" });
    expect(MACHINE_TYPES.find((t) => t.machineId === "c64")?.family).toBe(OTHER_FAMILY);
  });

  it("keeps every model of the registry under its type", () => {
    const models = MACHINE_TYPES.flatMap((t) => t.models.map((m) => `${t.machineId}:${m.modelId ?? ""}`));
    const registry = getAllMachineModels().map((m) => `${m.machineId}:${m.modelId ?? ""}`);
    expect(models.sort()).toEqual(registry.sort());
  });

  it("offers the Amstrad +2A/+3 models next to the +2E/+3E ones", () => {
    const p3 = modelOptionsOf(aState({ machineId: "spp3e" })).map((o) => o.value);
    expect(p3).toEqual(expect.arrayContaining(["nofdd", "fdd1", "plus2a", "plus3-fdd1", "plus3-es-fdd2"]));
  });

  it("offers the 128K and the Pentagon 128 as models of the 128K machine", () => {
    const sp128 = modelOptionsOf(aState({ machineId: "sp128" }));
    expect(sp128.map((o) => o.value)).toEqual(["sp128", "pentagon"]);
    expect(sp128[1].label).toContain("Pentagon 128");
  });

  it("offers a one-model type its single model", () => {
    expect(modelOptionsOf(aState({ machineId: "zxnext" })).length).toBe(1);
  });

  it("offers only the types that have templates, once that is known", () => {
    const state = aState({ availableMachineIds: ["sp48", "zx81"] });
    expect(machineTypeOptionsOf(state).map((o) => o.value)).toEqual(["sp48", "zx81"]);
  });
});

describe("NewProjectModel — the default model of a type", () => {
  const favorites = [{ machineId: "spp3e", modelId: "plus3-fdd1" }, { machineId: "z88", modelId: "OZ47" }];

  it("is the running model when that machine runs", () => {
    expect(defaultModelOf("spp3e", { running: { machineId: "spp3e", modelId: "plus2a" }, favorites })).toBe("plus2a");
  });

  it("is the first favourite of the type otherwise", () => {
    expect(defaultModelOf("spp3e", { running: { machineId: "sp48", modelId: "pal" }, favorites })).toBe("plus3-fdd1");
  });

  it("is the type's first model without a favourite", () => {
    expect(defaultModelOf("zx81", { favorites })).toBe(MACHINE_TYPES.find((t) => t.machineId === "zx81")?.models[0].modelId);
  });
});

describe("NewProjectModel — choosing a template for a machine", () => {
  it("keeps the current choice when the new machine also offers it", () => {
    expect(resolveTemplateId(["default", "advanced"], "advanced")).toBe("advanced");
  });

  it("falls back to the conventional default", () => {
    expect(resolveTemplateId(["default", "zxbasic"], "advanced")).toBe("default");
  });

  it("takes the first template when there is no default", () => {
    expect(resolveTemplateId(["zxbasic", "asm"], "advanced")).toBe("zxbasic");
  });

  it("keeps the name rather than clearing it when a machine has no templates", () => {
    expect(resolveTemplateId([], "advanced")).toBe(INITIAL_TEMPLATE_ID);
  });

  it("applies the rule when a template list settles", () => {
    const state = aState({ templateId: "advanced", templatesLoading: true });

    const next = reduce(state, { type: "templatesSettled", templates: ["default", "zxbasic"] });

    expect(next.templates).toEqual(["default", "zxbasic"]);
    expect(next.templateId).toBe("default");
    expect(next.templatesLoading).toBe(false);
  });

  it("keeps the previous list when the lookup fails", () => {
    // --- A machine whose templates cannot be read is more usefully shown stale
    // --- than blank; the old effect had no failure path at all.
    const state = aState({ templates: ["default"], templatesLoading: true });

    const next = reduce(state, { type: "templatesFailed" });

    expect(next.templates).toEqual(["default"]);
    expect(next.templatesLoading).toBe(false);
  });

  it("returns the same state for a failure with nothing in flight", () => {
    const idle = aState();

    expect(reduce(idle, { type: "templatesFailed" })).toBe(idle);
  });
});

describe("NewProjectModel — field edits", () => {
  it("records the machine, the folder, the name and the template", () => {
    let state = aState();
    state = reduce(state, { type: "machineChanged", machineId: "z88", modelId: undefined });
    state = reduce(state, { type: "projectFolderChanged", folder: "/projects" });
    state = reduce(state, { type: "projectNameChanged", name: "MyProject" });
    state = reduce(state, { type: "templateChanged", templateId: "advanced" });

    expect(state).toMatchObject({
      machineId: "z88",
      modelId: undefined,
      projectFolder: "/projects",
      projectName: "MyProject",
      templateId: "advanced"
    });
  });

  it("returns the same state when a field is set to what it already holds", () => {
    const state = aState({
      machineId: "sp48",
      modelId: "pal",
      projectFolder: "/projects",
      projectName: "MyProject",
      templateId: "default"
    });

    expect(
      reduce(state, { type: "machineChanged", machineId: "sp48", modelId: "pal" })
    ).toBe(state);
    expect(reduce(state, { type: "projectFolderChanged", folder: "/projects" })).toBe(state);
    expect(reduce(state, { type: "projectNameChanged", name: "MyProject" })).toBe(state);
    expect(reduce(state, { type: "templateChanged", templateId: "default" })).toBe(state);
  });

  it("treats a changed model on the same machine as a change", () => {
    const state = aState({ machineId: "sp48", modelId: "pal" });

    expect(reduce(state, { type: "machineChanged", machineId: "sp48", modelId: "ntsc" })).not.toBe(
      state
    );
  });
});

describe("NewProjectModel — busy flags", () => {
  it("marks and clears the template lookup", () => {
    const started = reduce(aState(), { type: "templatesStarted" });

    expect(started.templatesLoading).toBe(true);
    expect(reduce(started, { type: "templatesStarted" })).toBe(started);
  });

  it("marks and clears the creation", () => {
    const idle = aState();
    const started = reduce(idle, { type: "createStarted" });

    expect(started.busy).toBe(true);
    expect(reduce(started, { type: "createStarted" })).toBe(started);
    expect(reduce(started, { type: "createSettled" }).busy).toBe(false);
    expect(reduce(idle, { type: "createSettled" })).toBe(idle);
  });
});

describe("NewProjectModel — validation", () => {
  it("requires a project name", () => {
    expect(projectNameErrorOf(aState())).toBe("Enter a file name.");
    expect(isComplete(aState())).toBe(false);
  });

  it("does not require a folder", () => {
    // --- An empty folder means "wherever the app puts projects by default".
    expect(folderErrorOf(aState())).toBeUndefined();
    expect(isComplete(aState({ projectName: "MyProject" }))).toBe(true);
  });

  it("trims the folder before validating and before using it", () => {
    const state = aState({ projectFolder: "  /projects  ", projectName: "MyProject" });

    expect(projectFolderPathOf(state)).toBe("/projects");
    expect(requestOf(state).projectFolder).toBe("/projects");
  });

  it("reports a folder the rules reject", () => {
    const state = aState(
      { projectFolder: "??", projectName: "MyProject" },
      anEnv({ validation: rejectingValidation({ isValidPath: () => false }) })
    );

    expect(folderErrorOf(state)).toBe("Enter a valid path.");
    expect(isComplete(state)).toBe(false);
  });

  it("reports a name the rules reject", () => {
    const state = aState(
      { projectName: "bad/name" },
      anEnv({ validation: rejectingValidation({ isValidFilename: () => false }) })
    );

    expect(projectNameErrorOf(state)).toBe("Enter a valid file name.");
    expect(isComplete(state)).toBe(false);
  });

  it("treats completeness as independent of a creation already running", () => {
    expect(isComplete(aState({ projectName: "MyProject", busy: true }))).toBe(true);
  });
});

describe("NewProjectModel — the request", () => {
  it("carries everything the main process needs", () => {
    const state = aState({
      machineId: "z88",
      modelId: undefined,
      templateId: "advanced",
      projectName: "MyProject",
      projectFolder: "/projects"
    });

    expect(requestOf(state)).toEqual({
      machineId: "z88",
      modelId: undefined,
      templateId: "advanced",
      projectName: "MyProject",
      projectFolder: "/projects"
    });
  });
});

describe("NewProjectModel — timeouts", () => {
  it("names the step and its budget in seconds", () => {
    // --- The controller formats each step's own sentence; the model only carries it.
    expect(t("dialog.newProject.timeout.create", { seconds: 30_000 / 1000 })).toBe(
      "Creating the Klive project timed out after 30 seconds."
    );
  });

  it("passes a result through when the work finishes in time", async () => {
    await expect(withTimeout(Promise.resolve("done"), 1000, "Working")).resolves.toBe("done");
  });

  it("passes a rejection through unchanged", async () => {
    await expect(
      withTimeout(Promise.reject(new Error("boom")), 1000, "Working")
    ).rejects.toThrow("boom");
  });

  it("rejects with the timeout message when the work overruns", async () => {
    const never = new Promise<never>(() => undefined);

    await expect(withTimeout(never, 10, "Working timed out after 0.01 seconds.")).rejects.toThrow(
      "Working timed out after 0.01 seconds."
    );
  });
});

describe("NewProjectModel — messages", () => {
  it("wraps what the main process said about the folder", () => {
    // --- The main process reports this failure as a value rather than a
    // --- rejection, so the dialog has to turn it into one.
    expect(t("dialog.newProject.error.openFolder", { error: "no such directory" })).toBe(
      "Error opening folder: no such directory"
    );
  });
});

describe("NewProjectModel — environment", () => {
  it("returns the same state when the rule set is unchanged", () => {
    const state = aState();

    expect(reduce(state, { type: "envReplaced", env: { validation: state.env.validation } })).toBe(
      state
    );
  });
});
