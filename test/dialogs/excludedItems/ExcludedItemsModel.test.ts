import { describe, expect, it } from "vitest";

import {
  excludedIdsOf,
  initialState,
  projectListLabelOf,
  reduce
} from "@renderer/appIde/dialogs/excludedItems/ExcludedItemsModel";

import { aState, anEnv, anItem } from "./fakes";

describe("ExcludedItemsModel — initial state", () => {
  it("opens on the snapshot it was handed", () => {
    const state = initialState(anEnv(), [anItem("build")]);

    expect(state.projectItems).toEqual([anItem("build")]);
    expect(state.globalItems).toEqual([]);
    expect(state.globalsLoading).toBe(false);
    expect(state.busy).toBe(false);
  });
});

describe("ExcludedItemsModel — removing an item", () => {
  it("takes the named item off the project's list", () => {
    const state = aState({}, anEnv(), [anItem("build"), anItem("temp")]);

    const next = reduce(state, { type: "itemRemoved", id: "build" });

    expect(next.projectItems).toEqual([anItem("temp")]);
  });

  it("returns the same state for an item that is not on the list", () => {
    const state = aState({}, anEnv(), [anItem("build")]);

    expect(reduce(state, { type: "itemRemoved", id: "nope" })).toBe(state);
  });

  it("never touches the global list", () => {
    // --- The global exclusions are managed elsewhere; this dialog shows them.
    const state = aState({ globalItems: [anItem("node_modules")] }, anEnv(), [anItem("build")]);

    const next = reduce(state, { type: "itemRemoved", id: "node_modules" });

    expect(next).toBe(state);
  });
});

describe("ExcludedItemsModel — the global list", () => {
  it("records what was loaded", () => {
    const started = reduce(aState(), { type: "globalsStarted" });
    expect(started.globalsLoading).toBe(true);

    const settled = reduce(started, {
      type: "globalsSettled",
      items: [anItem("node_modules")]
    });

    expect(settled.globalItems).toEqual([anItem("node_modules")]);
    expect(settled.globalsLoading).toBe(false);
  });

  it("stops loading when the lookup fails", () => {
    // --- The old effect had no failure path: a rejection escaped and the list
    // --- stayed empty with no explanation.
    const started = reduce(aState(), { type: "globalsStarted" });

    expect(reduce(started, { type: "globalsFailed" }).globalsLoading).toBe(false);
  });

  it("returns the same state for a redundant start or failure", () => {
    const idle = aState();
    const started = reduce(idle, { type: "globalsStarted" });

    expect(reduce(started, { type: "globalsStarted" })).toBe(started);
    expect(reduce(idle, { type: "globalsFailed" })).toBe(idle);
  });
});

describe("ExcludedItemsModel — busy", () => {
  it("marks and clears the save", () => {
    const idle = aState();
    const started = reduce(idle, { type: "applyStarted" });

    expect(started.busy).toBe(true);
    expect(reduce(started, { type: "applyStarted" })).toBe(started);
    expect(reduce(started, { type: "applySettled" }).busy).toBe(false);
    expect(reduce(idle, { type: "applySettled" })).toBe(idle);
  });
});

describe("ExcludedItemsModel — derived", () => {
  it("writes back the ids in list order", () => {
    const state = aState({}, anEnv(), [anItem("build"), anItem("temp")]);

    expect(excludedIdsOf(state)).toEqual(["build", "temp"]);
  });

  it("labels the project list with the project's name", () => {
    expect(projectListLabelOf(aState({}, anEnv({ projectName: "Klive" })))).toBe(
      "Klive Excludes:"
    );
  });
});

describe("ExcludedItemsModel — environment", () => {
  it("returns the same state for the same project name", () => {
    const state = aState();

    expect(reduce(state, { type: "envReplaced", env: anEnv() })).toBe(state);
  });

  it("adopts a renamed project", () => {
    const state = aState();

    const next = reduce(state, { type: "envReplaced", env: anEnv({ projectName: "Other" }) });

    expect(projectListLabelOf(next)).toBe("Other Excludes:");
  });
});
