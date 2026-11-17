import { describe, expect, it } from "vitest";

import { t } from "@common/i18n/i18n";
import { DEFAULT_BUILD_ROOT } from "@renderer/appIde/dialogs/makeProject/MakeProjectModel";
import { selectViewModel } from "@renderer/appIde/dialogs/makeProject/MakeProjectViewModel";

import { FOLDER, aState } from "./fakes";

describe("MakeProjectViewModel", () => {
  it("names the folder and says why the dialog appeared", () => {
    expect(selectViewModel(aState({ offer: true })).lead).toBe(
      t("dialog.makeProject.lead.offer", { folder: FOLDER })
    );
    expect(selectViewModel(aState({ offer: false })).lead).toBe(
      t("dialog.makeProject.lead.menu", { folder: FOLDER })
    );
  });

  it("offers only the machine types that have templates, once known (Q7)", () => {
    const all = selectViewModel(aState()).machineType.options.map((o) => o.value);
    expect(all).toContain("zx81");
    const vm = selectViewModel(aState({ availableMachineIds: ["sp48", "ht1080z"] }));
    expect(vm.machineType.options.map((o) => o.value)).toEqual(["sp48", "ht1080z"]);
    expect(vm.machineType.options.every((o) => typeof o.group === "string")).toBe(true);
  });

  it("lists only the machine's templates: there is no 'None' (Q7)", () => {
    const vm = selectViewModel(aState({ templates: ["default", "zx-basic"], templateId: "default" }));
    expect(vm.template.options.map((o) => o.value)).toEqual(["default", "zx-basic"]);
    expect(vm.template.value).toBe("default");
  });

  it("offers the template's build root first, then the folder's files", () => {
    const vm = selectViewModel(aState({ candidates: ["main.bas"], templateId: "zx-basic" }));
    expect(vm.buildRoot.options).toEqual([
      { value: DEFAULT_BUILD_ROOT, label: t("dialog.makeProject.buildRoot.template") },
      { value: "main.bas", label: "main.bas" }
    ]);
  });

  it("disables the project fields while 'keep' is chosen, and changes the button", () => {
    const vm = selectViewModel(aState({ choice: "keep" }));
    expect(vm.fieldsEnabled).toBe(false);
    expect(vm.model.enabled).toBe(false);
    expect(vm.submitLabel).toBe(t("dialog.makeProject.submit.keep"));
    expect(vm.submitEnabled).toBe(true);
  });

  it("shows the conflicts only for a template that lands on existing items", () => {
    const conflicts = [
      { path: "build.ksx", canOverwrite: true },
      { path: "code/program.zxbas", canOverwrite: false }
    ];
    expect(selectViewModel(aState({ conflicts })).conflicts.visible).toBe(false);
    const vm = selectViewModel(aState({ conflicts, templateId: "zx-basic", overwrite: ["build.ksx", "code/program.zxbas"] }));
    expect(vm.conflicts.visible).toBe(true);
    expect(vm.conflicts.items).toEqual([
      { path: "build.ksx", canOverwrite: true, overwrite: true },
      // --- Never shown as ticked: it cannot be written
      { path: "code/program.zxbas", canOverwrite: false, overwrite: false }
    ]);
    expect(selectViewModel(aState({ conflicts, templateId: "zx-basic", choice: "keep" })).conflicts.visible).toBe(false);
  });
});
