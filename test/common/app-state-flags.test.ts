import { describe, expect, it } from "vitest";
import { selectActivityAction } from "../../src/common/state/actions";
import createAppStore from "../../src/common/state/store";

describe("app state flags", () => {
  it("stores the selected IDE activity immutably", () => {
    const store = createAppStore("test");
    const initialState = store.getState();

    expect(initialState.activeActivity).toBe("explorer");

    store.dispatch(selectActivityAction("debug"));

    const selectedState = store.getState();
    expect(selectedState).not.toBe(initialState);
    expect(selectedState.activeActivity).toBe("debug");
    expect(initialState.activeActivity).toBe("explorer");
  });
});
