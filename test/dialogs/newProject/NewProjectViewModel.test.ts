import { describe, expect, it } from "vitest";

import { selectViewModel } from "@renderer/appIde/dialogs/newProject/NewProjectViewModel";

import { aState, anEnv, rejectingValidation } from "./fakes";

describe("NewProjectViewModel — dropdowns", () => {
  it("offers the machine types and the selected type's models", () => {
    const vm = selectViewModel(aState({ machineId: "z88", modelId: "OZ47" }));

    expect(vm.machineType.value).toBe("z88");
    expect(vm.machineType.options.length).toBe(13);
    // --- The model groups by family id; the view model shows the family's label.
    expect(vm.machineType.options[0].group).toBe("ZX Spectrum");
    expect(vm.machineType.options.find((o) => o.value === "c64")?.group).toBe("Other");
    expect(vm.model.value).toBe("OZ47");
    expect(vm.model.options.length).toBe(10);
    expect(vm.model.enabled).toBe(true);
  });

  it("disables, rather than hides, the model of a one-model type", () => {
    const vm = selectViewModel(aState({ machineId: "zxnext", modelId: undefined }));

    expect(vm.model.options.length).toBe(1);
    expect(vm.model.enabled).toBe(false);
  });

  it("turns the template directories into options", () => {
    const vm = selectViewModel(
      aState({ templates: ["default", "zxbasic"], templateId: "zxbasic" })
    );

    // --- A template directory is its own label; there is nothing to pretty up.
    expect(vm.template.options).toEqual([
      { value: "default", label: "default" },
      { value: "zxbasic", label: "zxbasic" }
    ]);
    expect(vm.template.value).toBe("zxbasic");
  });

  it("reports the template lookup as running", () => {
    expect(selectViewModel(aState({ templatesLoading: true })).template.loading).toBe(true);
  });
});

describe("NewProjectViewModel — fields", () => {
  it("shows what the user typed, untrimmed", () => {
    // --- The box shows exactly what was typed; only the request is trimmed.
    const vm = selectViewModel(aState({ projectFolder: "  /projects  " }));

    expect(vm.projectFolder.value).toBe("  /projects  ");
  });

  it("carries the name error so the input can mark itself invalid", () => {
    expect(selectViewModel(aState()).projectName.error).toBe("Enter a file name.");
  });

  it("carries no folder error for an empty folder", () => {
    expect(selectViewModel(aState()).projectFolder.error).toBeUndefined();
  });
});

describe("NewProjectViewModel — submission", () => {
  it("refuses a form with no project name", () => {
    expect(selectViewModel(aState()).submitEnabled).toBe(false);
  });

  it("allows a form with just a project name", () => {
    expect(selectViewModel(aState({ projectName: "MyProject" })).submitEnabled).toBe(true);
  });

  it("refuses a folder the rules reject", () => {
    const state = aState(
      { projectFolder: "??", projectName: "MyProject" },
      anEnv({ validation: rejectingValidation({ isValidPath: () => false }) })
    );

    expect(selectViewModel(state).submitEnabled).toBe(false);
  });

  it("refuses while a creation is already running", () => {
    const vm = selectViewModel(aState({ projectName: "MyProject", busy: true }));

    expect(vm.submitting).toBe(true);
    expect(vm.submitEnabled).toBe(false);
  });

  it("labels the submit button Create", () => {
    expect(selectViewModel(aState()).submitLabel).toBe("Create");
  });
});
