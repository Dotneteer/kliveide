import { describe, expect, it } from "vitest";

import {
  DEFAULT_DISK_TYPE,
  DISK_TYPES,
  filenameErrorOf,
  folderErrorOf,
  initialState,
  isComplete,
  reduce
} from "@renderer/appEmu/dialogs/createDisk/CreateDiskModel";

import { aState, anEnv, rejectingValidation } from "./fakes";

describe("CreateDiskModel — initial state", () => {
  it("starts on an empty form with the first disk type selected", () => {
    const state = initialState(anEnv());

    expect(state.diskType).toBe(DEFAULT_DISK_TYPE);
    expect(state.diskType).toBe(DISK_TYPES[0].value);
    expect(state.folder).toBe("");
    expect(state.filename).toBe("");
    expect(state.busy).toBe(false);
  });
});

describe("CreateDiskModel — field edits", () => {
  it("records the folder, the filename and the disk type", () => {
    let state = aState();
    state = reduce(state, { type: "folderChanged", folder: "/tmp" });
    state = reduce(state, { type: "filenameChanged", filename: "disk.dsk" });
    state = reduce(state, { type: "diskTypeChanged", diskType: "dse" });

    expect(state).toMatchObject({ folder: "/tmp", filename: "disk.dsk", diskType: "dse" });
  });

  it("returns the same state when a field is set to what it already holds", () => {
    const state = aState({ folder: "/tmp", filename: "disk.dsk", diskType: "ds" });

    expect(reduce(state, { type: "folderChanged", folder: "/tmp" })).toBe(state);
    expect(reduce(state, { type: "filenameChanged", filename: "disk.dsk" })).toBe(state);
    expect(reduce(state, { type: "diskTypeChanged", diskType: "ds" })).toBe(state);
  });
});

describe("CreateDiskModel — environment", () => {
  it("adopts a different rule set", () => {
    const state = aState();
    const env = anEnv({ validation: rejectingValidation({ isValidPath: () => false }) });

    const next = reduce(state, { type: "envReplaced", env });

    expect(next).not.toBe(state);
    expect(next.env).toBe(env);
  });

  it("returns the same state when the rule set is unchanged", () => {
    // --- The container rebuilds the environment object on every settings
    // --- write. Only a different validation service is a real change, and
    // --- returning the same state is what keeps the dialog from re-rendering.
    const state = aState();
    const sameRules = { validation: state.env.validation };

    expect(reduce(state, { type: "envReplaced", env: sameRules })).toBe(state);
  });
});

describe("CreateDiskModel — busy", () => {
  it("marks the dialog busy while the write runs and clears it when it settles", () => {
    const started = reduce(aState(), { type: "createStarted" });
    expect(started.busy).toBe(true);

    expect(reduce(started, { type: "createSettled" }).busy).toBe(false);
  });

  it("returns the same state for a start that is already running", () => {
    const started = reduce(aState(), { type: "createStarted" });

    expect(reduce(started, { type: "createStarted" })).toBe(started);
  });

  it("returns the same state for a settle with nothing in flight", () => {
    const idle = aState();

    expect(reduce(idle, { type: "createSettled" })).toBe(idle);
  });
});

describe("CreateDiskModel — field errors", () => {
  it("asks for a folder and a file name while the form is empty", () => {
    const state = aState();

    expect(folderErrorOf(state)).toBe("Choose a folder.");
    expect(filenameErrorOf(state)).toBe("Enter a file name.");
    expect(isComplete(state)).toBe(false);
  });

  it("accepts a folder and a file name the rules allow", () => {
    const state = aState({ folder: "/tmp", filename: "disk.dsk" });

    expect(folderErrorOf(state)).toBeUndefined();
    expect(filenameErrorOf(state)).toBeUndefined();
    expect(isComplete(state)).toBe(true);
  });

  it("reports a file name the rules reject", () => {
    const state = aState(
      { folder: "/tmp", filename: "bad/name" },
      anEnv({
        validation: rejectingValidation({ isValidFilename: (value) => value !== "bad/name" })
      })
    );

    expect(filenameErrorOf(state)).toBe("Enter a valid file name.");
    expect(isComplete(state)).toBe(false);
  });

  it("reports a folder the rules reject", () => {
    const state = aState(
      { folder: "??", filename: "disk.dsk" },
      anEnv({ validation: rejectingValidation({ isValidPath: () => false }) })
    );

    expect(folderErrorOf(state)).toBe("Enter a valid folder path.");
    expect(isComplete(state)).toBe(false);
  });

  it("treats completeness as independent of a write already running", () => {
    // --- `isComplete` answers "could this be written", not "may we write now".
    // --- The controller asks both, and conflating them would let a retry be
    // --- refused for the wrong reason.
    expect(isComplete(aState({ folder: "/tmp", filename: "d.dsk", busy: true }))).toBe(true);
  });
});
