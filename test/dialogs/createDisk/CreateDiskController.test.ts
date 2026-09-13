import { describe, expect, it } from "vitest";

import { NEW_DISK_FOLDER_SETTINGS_KEY } from "@renderer/appEmu/dialogs/createDisk/CreateDiskModel";

import { deferred } from "../../mvc/deferred";
import { anEnv, fillForm, openCreateDiskDialog, rejectingValidation } from "./fakes";

describe("CreateDiskController — editing", () => {
  it("records what the user types", async () => {
    const h = openCreateDiskDialog();

    await fillForm(h, { folder: "/disks", filename: "game.dsk", diskType: "ds" });

    expect(h.state).toMatchObject({
      folder: "/disks",
      filename: "game.dsk",
      diskType: "ds"
    });
    expect(h.vm.submitEnabled).toBe(true);
  });

  it("fills the folder from the picker", async () => {
    const h = openCreateDiskDialog({ pickFolder: "/picked" });

    await h.dispatch({ type: "selectFolderRequested" });

    expect(h.ports.files.pickFolder).toHaveBeenCalledWith(NEW_DISK_FOLDER_SETTINGS_KEY);
    expect(h.vm.folder.value).toBe("/picked");
  });

  it("leaves the folder alone when the picker is dismissed", async () => {
    const h = openCreateDiskDialog();
    await fillForm(h, { folder: "/kept" });

    await h.dispatch({ type: "selectFolderRequested" });

    // --- A dismissed picker is "never mind", not "clear what I had".
    expect(h.vm.folder.value).toBe("/kept");
  });
});

describe("CreateDiskController — creating", () => {
  it("writes the disk, reports it, and hands the result back", async () => {
    const h = openCreateDiskDialog({
      service: { createDiskFile: async () => "/tmp/disk.dsk" }
    });
    await fillForm(h);

    await h.dispatch({ type: "createRequested" });

    expect(h.ports.service.createDiskFile).toHaveBeenCalledWith("/tmp", "disk.dsk", "ss");
    expect(h.ports.service.notify).toHaveBeenCalledWith(
      "info",
      "Disk created",
      "Disk file successfully created: /tmp/disk.dsk"
    );
    expect(h.ports.close.created).toHaveBeenCalledWith({
      diskType: "ss",
      folder: "/tmp",
      filename: "disk.dsk",
      path: "/tmp/disk.dsk"
    });
  });

  it("reports the failure and stays open", async () => {
    const h = openCreateDiskDialog({
      service: {
        createDiskFile: async () => {
          throw new Error("Disk is full");
        }
      }
    });
    await fillForm(h);

    await h.dispatch({ type: "createRequested" });

    expect(h.ports.service.notify).toHaveBeenCalledWith(
      "error",
      "Create Disk File Error",
      "Disk is full"
    );
    expect(h.ports.close.created).not.toHaveBeenCalled();
    expect(h.ports.close.cancelled).not.toHaveBeenCalled();
    // --- The form keeps what the user typed, so the folder can be fixed.
    expect(h.vm.folder.value).toBe("/tmp");
    expect(h.vm.submitEnabled).toBe(true);
  });

  it("refuses an incomplete form even when asked directly", async () => {
    // --- The footer button is disabled, but Enter in a text field submits the
    // --- form regardless, so the controller has to refuse for itself.
    const h = openCreateDiskDialog();
    await fillForm(h, { filename: "" });

    await h.dispatch({ type: "createRequested" });

    expect(h.ports.service.createDiskFile).not.toHaveBeenCalled();
  });

  it("refuses a form the rules reject", async () => {
    const h = openCreateDiskDialog({
      env: anEnv({ validation: rejectingValidation({ isValidFilename: () => false }) })
    });
    await fillForm(h);

    await h.dispatch({ type: "createRequested" });

    expect(h.ports.service.createDiskFile).not.toHaveBeenCalled();
  });
});

describe("CreateDiskController — work in flight", () => {
  it("shows the form as submitting while the write runs", async () => {
    const gate = deferred<string>();
    const h = openCreateDiskDialog({ service: { createDiskFile: () => gate.promise } });
    await fillForm(h);

    void h.send({ type: "createRequested" });

    expect(h.vm.submitting).toBe(true);
    expect(h.vm.submitEnabled).toBe(false);

    gate.resolve("/tmp/disk.dsk");
    await h.settle();

    expect(h.vm.submitting).toBe(false);
  });

  it("writes once when Create is pressed twice", async () => {
    const gate = deferred<string>();
    const h = openCreateDiskDialog({ service: { createDiskFile: () => gate.promise } });
    await fillForm(h);

    void h.send({ type: "createRequested" });
    void h.send({ type: "createRequested" });

    gate.resolve("/tmp/disk.dsk");
    await h.settle();

    // --- Two writes of the same path would have raced each other; the old
    // --- component had nothing to stop the second one.
    expect(h.ports.service.createDiskFile).toHaveBeenCalledTimes(1);
    expect(h.ports.close.created).toHaveBeenCalledTimes(1);
  });

  it("writes the values as they were when Create was pressed", async () => {
    const gate = deferred<string>();
    const h = openCreateDiskDialog({ service: { createDiskFile: () => gate.promise } });
    await fillForm(h, { folder: "/tmp", filename: "first.dsk" });

    void h.send({ type: "createRequested" });
    // --- The fields stay editable while the write runs; the result must name
    // --- the file that was actually written, not what is in the box now.
    // --- `send`, not `dispatch`: dispatch drains every pending handler, and the
    // --- write it would wait for is the one this test is holding open.
    await h.send({ type: "filenameEdited", filename: "second.dsk" });

    gate.resolve("/tmp/first.dsk");
    await h.settle();

    expect(h.ports.close.created).toHaveBeenCalledWith(
      expect.objectContaining({ filename: "first.dsk", path: "/tmp/first.dsk" })
    );
  });

  it("does not settle a dialog that was torn down mid-write", async () => {
    const gate = deferred<string>();
    const h = openCreateDiskDialog({ service: { createDiskFile: () => gate.promise } });
    await fillForm(h);

    void h.send({ type: "createRequested" });
    h.dispose();
    gate.resolve("/tmp/disk.dsk");
    await h.settle();

    expect(h.ports.service.notify).not.toHaveBeenCalled();
    expect(h.ports.close.created).not.toHaveBeenCalled();
  });

  it("survives a dispose/activate cycle and still creates", async () => {
    // --- StrictMode runs every effect setup → cleanup → setup, so a controller
    // --- that could only be disposed would be dead before the user touched it.
    const h = openCreateDiskDialog();
    h.controller.dispose();
    h.controller.activate();

    await fillForm(h);
    await h.dispatch({ type: "createRequested" });

    expect(h.ports.close.created).toHaveBeenCalled();
  });
});

describe("CreateDiskController — closing", () => {
  it("cancels without writing anything", async () => {
    const h = openCreateDiskDialog();
    await fillForm(h);

    await h.dispatch({ type: "cancelRequested" });

    expect(h.ports.close.cancelled).toHaveBeenCalledTimes(1);
    expect(h.ports.service.createDiskFile).not.toHaveBeenCalled();
  });
});

describe("CreateDiskController — environment", () => {
  it("re-validates against a rule set that arrived while the dialog was open", async () => {
    const h = openCreateDiskDialog();
    await fillForm(h);
    expect(h.vm.submitEnabled).toBe(true);

    await h.dispatch({
      type: "environmentChanged",
      env: anEnv({ validation: rejectingValidation({ isValidFilename: () => false }) })
    });

    expect(h.vm.submitEnabled).toBe(false);
    expect(h.vm.filename.error).toBe("Enter a valid file name.");
  });

  it("keeps the same view model when an unchanged environment is pushed in", async () => {
    const h = openCreateDiskDialog();
    const before = h.vm;

    await h.dispatch({ type: "environmentChanged", env: { validation: h.env.validation } });

    // --- Reference equality is the contract `useSyncExternalStore` relies on:
    // --- a rebuilt view model here would re-render the dialog on every
    // --- unrelated settings write.
    expect(h.vm).toBe(before);
  });
});
