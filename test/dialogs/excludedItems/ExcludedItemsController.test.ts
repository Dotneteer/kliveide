import { describe, expect, it } from "vitest";

import type { ExcludedItemInfo } from "@renderer/appIde/dialogs/excludedItems/ExcludedItemsModel";

import { deferred } from "../../mvc/deferred";
import { anItem, createExcludedItemsDialog, openExcludedItemsDialog } from "./fakes";

describe("ExcludedItemsController — opening", () => {
  it("loads the application-wide exclusions", async () => {
    const h = await openExcludedItemsDialog();

    expect(h.ports.service.getGlobalExcludes).toHaveBeenCalled();
    expect(h.vm.globalList.items.map((item) => item.id)).toEqual(["node_modules"]);
    expect(h.vm.globalList.loading).toBe(false);
  });

  it("shows the global list as loading while it is fetched", async () => {
    const gate = deferred<ExcludedItemInfo[]>();
    const h = createExcludedItemsDialog({ service: { getGlobalExcludes: () => gate.promise } });

    void h.send({ type: "opened" });
    expect(h.vm.globalList.loading).toBe(true);

    gate.resolve([anItem("node_modules")]);
    await h.settle();
    expect(h.vm.globalList.loading).toBe(false);
  });

  it("survives a global lookup that fails", async () => {
    // --- The old effect had no failure path: the rejection escaped and the
    // --- dialog sat there with an empty list and no explanation.
    const h = await openExcludedItemsDialog({
      service: {
        getGlobalExcludes: async () => {
          throw new Error("settings unreadable");
        }
      }
    });

    expect(h.vm.globalList.loading).toBe(false);
    expect(h.vm.globalList.items).toEqual([]);
    // --- And the project's own list is still editable, which is the point.
    expect(h.vm.projectList.items).toHaveLength(2);
  });

  it("shows the project's list from the snapshot it opened on", async () => {
    const h = await openExcludedItemsDialog({
      projectItems: [anItem("build"), anItem("out")]
    });

    expect(h.vm.projectList.items.map((item) => item.id)).toEqual(["build", "out"]);
  });
});

describe("ExcludedItemsController — pruning the list", () => {
  it("removes an item the user dismissed", async () => {
    const h = await openExcludedItemsDialog();

    await h.dispatch({ type: "itemRemovalRequested", id: "build" });

    expect(h.vm.projectList.items.map((item) => item.id)).toEqual(["temp"]);
  });

  it("writes nothing until OK is pressed", async () => {
    const h = await openExcludedItemsDialog();

    await h.dispatch({ type: "itemRemovalRequested", id: "build" });

    expect(h.ports.service.saveExcludedItems).not.toHaveBeenCalled();
  });

  it("discards the edits when the dialog is dismissed", async () => {
    const h = await openExcludedItemsDialog();
    await h.dispatch({ type: "itemRemovalRequested", id: "build" });

    await h.dispatch({ type: "cancelRequested" });

    expect(h.ports.service.saveExcludedItems).not.toHaveBeenCalled();
    expect(h.ports.close.dismissed).toHaveBeenCalledTimes(1);
    expect(h.ports.close.applied).not.toHaveBeenCalled();
  });
});

describe("ExcludedItemsController — applying", () => {
  it("saves what is left and hands the ids back", async () => {
    const h = await openExcludedItemsDialog();
    await h.dispatch({ type: "itemRemovalRequested", id: "build" });

    await h.dispatch({ type: "applyRequested" });

    expect(h.ports.service.saveExcludedItems).toHaveBeenCalledWith(["temp"]);
    expect(h.ports.close.applied).toHaveBeenCalledWith({ excludedItemIds: ["temp"] });
  });

  it("saves an emptied list rather than treating it as nothing to do", async () => {
    const h = await openExcludedItemsDialog();
    await h.dispatch({ type: "itemRemovalRequested", id: "build" });
    await h.dispatch({ type: "itemRemovalRequested", id: "temp" });

    await h.dispatch({ type: "applyRequested" });

    expect(h.ports.service.saveExcludedItems).toHaveBeenCalledWith([]);
    expect(h.ports.close.applied).toHaveBeenCalledWith({ excludedItemIds: [] });
  });

  it("does not close when the save fails", async () => {
    const h = await openExcludedItemsDialog({
      service: {
        saveExcludedItems: async () => {
          throw new Error("project file is read-only");
        }
      }
    });

    await h.dispatch({ type: "applyRequested" });

    expect(h.ports.close.applied).not.toHaveBeenCalled();
    // --- And the dialog comes back to life so the user can try again.
    expect(h.vm.applyEnabled).toBe(true);
  });
});

describe("ExcludedItemsController — work in flight", () => {
  it("disables OK while the project is being saved", async () => {
    const gate = deferred<void>();
    const h = await openExcludedItemsDialog({
      service: { saveExcludedItems: () => gate.promise }
    });

    void h.send({ type: "applyRequested" });
    expect(h.vm.applyEnabled).toBe(false);

    gate.resolve();
    await h.settle();
    expect(h.vm.applyEnabled).toBe(true);
  });

  it("saves once when OK is pressed twice", async () => {
    // --- Saving the project takes a second by design, so a second click is easy
    // --- to land and the old dialog had nothing to stop it.
    const gate = deferred<void>();
    const h = await openExcludedItemsDialog({
      service: { saveExcludedItems: () => gate.promise }
    });

    void h.send({ type: "applyRequested" });
    void h.send({ type: "applyRequested" });
    gate.resolve();
    await h.settle();

    expect(h.ports.service.saveExcludedItems).toHaveBeenCalledTimes(1);
    expect(h.ports.close.applied).toHaveBeenCalledTimes(1);
  });

  it("does not settle a dialog that was torn down mid-save", async () => {
    const gate = deferred<void>();
    const h = await openExcludedItemsDialog({
      service: { saveExcludedItems: () => gate.promise }
    });

    void h.send({ type: "applyRequested" });
    h.dispose();
    gate.resolve();
    await h.settle();

    expect(h.ports.close.applied).not.toHaveBeenCalled();
  });

  it("survives a dispose/activate cycle and still applies", async () => {
    const h = await openExcludedItemsDialog();
    h.controller.dispose();
    h.controller.activate();

    await h.dispatch({ type: "applyRequested" });

    expect(h.ports.close.applied).toHaveBeenCalled();
  });
});

describe("ExcludedItemsController — environment", () => {
  it("relabels the list when the project is renamed underneath it", async () => {
    const h = await openExcludedItemsDialog();

    await h.dispatch({ type: "environmentChanged", env: { projectName: "Renamed" } });

    expect(h.vm.projectList.label).toBe("Renamed Excludes:");
  });

  it("keeps the same view model when an unchanged environment is pushed in", async () => {
    const h = await openExcludedItemsDialog();
    const before = h.vm;

    await h.dispatch({
      type: "environmentChanged",
      env: { projectName: h.env.projectName }
    });

    expect(h.vm).toBe(before);
  });
});
