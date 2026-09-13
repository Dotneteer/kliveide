import { describe, expect, it } from "vitest";

import { DISK_TYPES } from "@renderer/appEmu/dialogs/createDisk/CreateDiskModel";
import { selectViewModel } from "@renderer/appEmu/dialogs/createDisk/CreateDiskViewModel";

import { aState, anEnv, rejectingValidation } from "./fakes";

describe("CreateDiskViewModel — fields", () => {
  it("offers every disk type and marks the selected one", () => {
    const vm = selectViewModel(aState({ diskType: "dse" }));

    expect(vm.diskType.options).toEqual(DISK_TYPES);
    expect(vm.diskType.value).toBe("dse");
  });

  it("shows what the user typed", () => {
    const vm = selectViewModel(aState({ folder: "/tmp", filename: "disk.dsk" }));

    expect(vm.folder.value).toBe("/tmp");
    expect(vm.filename.value).toBe("disk.dsk");
  });

  it("carries the field errors so the inputs can mark themselves invalid", () => {
    const vm = selectViewModel(aState());

    expect(vm.folder.error).toBe("Choose a folder.");
    expect(vm.filename.error).toBe("Enter a file name.");
  });

  it("clears the errors once both fields are acceptable", () => {
    const vm = selectViewModel(aState({ folder: "/tmp", filename: "disk.dsk" }));

    expect(vm.folder.error).toBeUndefined();
    expect(vm.filename.error).toBeUndefined();
  });
});

describe("CreateDiskViewModel — submission", () => {
  it("refuses an empty form", () => {
    expect(selectViewModel(aState()).submitEnabled).toBe(false);
  });

  it("allows a complete form", () => {
    expect(selectViewModel(aState({ folder: "/tmp", filename: "disk.dsk" })).submitEnabled).toBe(
      true
    );
  });

  it("refuses a file name the rules reject", () => {
    const state = aState(
      { folder: "/tmp", filename: "bad/name" },
      anEnv({
        validation: rejectingValidation({ isValidFilename: (value) => value !== "bad/name" })
      })
    );

    expect(selectViewModel(state).submitEnabled).toBe(false);
  });

  it("refuses a folder the rules reject", () => {
    const state = aState(
      { folder: "??", filename: "disk.dsk" },
      anEnv({ validation: rejectingValidation({ isValidPath: () => false }) })
    );

    expect(selectViewModel(state).submitEnabled).toBe(false);
  });

  it("refuses a complete form while a write is already running", () => {
    const vm = selectViewModel(aState({ folder: "/tmp", filename: "disk.dsk", busy: true }));

    expect(vm.submitting).toBe(true);
    expect(vm.submitEnabled).toBe(false);
  });

  it("labels the submit button Create", () => {
    expect(selectViewModel(aState()).submitLabel).toBe("Create");
  });
});
