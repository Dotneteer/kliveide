import { describe, expect, it } from "vitest";

import { selectViewModel } from "@renderer/appIde/dialogs/excludedItems/ExcludedItemsViewModel";

import { aState, anEnv, anItem } from "./fakes";

describe("ExcludedItemsViewModel", () => {
  it("labels each list", () => {
    const vm = selectViewModel(aState({}, anEnv({ projectName: "Klive" })));

    expect(vm.projectList.label).toBe("Klive Excludes:");
    expect(vm.globalList.label).toBe("Global Excludes:");
  });

  it("marks the project's own items as removable", () => {
    const vm = selectViewModel(aState({}, anEnv(), [anItem("build")]));

    expect(vm.projectList.items).toEqual([{ id: "build", value: "build", removable: true }]);
  });

  it("marks the global items as not removable", () => {
    // --- They are managed in the application settings, not here.
    const vm = selectViewModel(aState({ globalItems: [anItem("node_modules")] }));

    expect(vm.globalList.items).toEqual([
      { id: "node_modules", value: "node_modules", removable: false }
    ]);
  });

  it("reports the global lookup as running", () => {
    expect(selectViewModel(aState({ globalsLoading: true })).globalList.loading).toBe(true);
  });

  it("disables OK while the project is being saved", () => {
    expect(selectViewModel(aState()).applyEnabled).toBe(true);
    expect(selectViewModel(aState({ busy: true })).applyEnabled).toBe(false);
  });
});
