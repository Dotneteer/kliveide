import { describe, expect, it } from "vitest";

import {
  INITIAL_MACHINE_ID,
  INITIAL_MODEL_ID,
  INITIAL_TEMPLATE_ID,
  MACHINE_OPTIONS,
  folderErrorOf,
  initialState,
  isComplete,
  machineOptionValue,
  machineValueOf,
  openFolderErrorMessage,
  parseMachineOption,
  projectFolderPathOf,
  projectNameErrorOf,
  reduce,
  requestOf,
  resolveTemplateId,
  timeoutMessage,
  withTimeout
} from "@renderer/appIde/dialogs/newProject/NewProjectModel";

import { aState, anEnv, rejectingValidation } from "./fakes";

describe("NewProjectModel — machine options", () => {
  it("offers the machine registry", () => {
    expect(MACHINE_OPTIONS.length).toBeGreaterThan(0);
    expect(MACHINE_OPTIONS.every((option) => option.value && option.label)).toBe(true);
  });

  it("joins machine and model into the one value a dropdown can carry", () => {
    expect(machineOptionValue("sp48", "pal")).toBe("sp48:pal");
  });

  it("omits the separator for a machine with no model", () => {
    expect(machineOptionValue("z88")).toBe("z88");
  });

  it("splits a dropdown value back into machine and model", () => {
    expect(parseMachineOption("spp3e:floppy")).toEqual({
      machineId: "spp3e",
      modelId: "floppy"
    });
  });

  it("reads a model-less value back without inventing one", () => {
    expect(parseMachineOption("z88")).toEqual({ machineId: "z88", modelId: undefined });
  });

  it("round-trips every option the dropdown can offer", () => {
    for (const option of MACHINE_OPTIONS) {
      const parsed = parseMachineOption(option.value);
      expect(machineOptionValue(parsed.machineId, parsed.modelId)).toBe(option.value);
    }
  });
});

describe("NewProjectModel — initial state", () => {
  it("opens on the default machine, model and template", () => {
    const state = initialState(anEnv());

    expect(state.machineId).toBe(INITIAL_MACHINE_ID);
    expect(state.modelId).toBe(INITIAL_MODEL_ID);
    expect(state.templateId).toBe(INITIAL_TEMPLATE_ID);
    expect(machineValueOf(state)).toBe("sp48:pal");
    expect(state.templates).toEqual([]);
    expect(state.busy).toBe(false);
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
    expect(timeoutMessage("Creating the Klive project", 30_000)).toBe(
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

    await expect(withTimeout(never, 10, "Working")).rejects.toThrow(
      "Working timed out after 0.01 seconds."
    );
  });
});

describe("NewProjectModel — messages", () => {
  it("wraps what the main process said about the folder", () => {
    // --- The main process reports this failure as a value rather than a
    // --- rejection, so the dialog has to turn it into one.
    expect(openFolderErrorMessage("no such directory")).toBe(
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
