import { describe, expect, it } from "vitest";
import { clearTapeMediaAction, setTapeMediaAction } from "../../src/common/state/actions";
import createAppStore from "../../src/common/state/store";

describe("media state", () => {
  it("stores and clears selected tape media immutably", () => {
    const store = createAppStore("test");
    const initialState = store.getState();

    store.dispatch(
      setTapeMediaAction({
        fileName: "/tmp/demo.tap",
        displayName: "demo.tap",
        size: 1234,
        blockCount: 2
      })
    );

    const selectedState = store.getState();
    expect(selectedState).not.toBe(initialState);
    expect(selectedState.media?.tape).toEqual({
      fileName: "/tmp/demo.tap",
      displayName: "demo.tap",
      size: 1234,
      blockCount: 2
    });
    expect(initialState.media?.tape).toBeUndefined();

    store.dispatch(clearTapeMediaAction());

    const clearedState = store.getState();
    expect(clearedState).not.toBe(selectedState);
    expect(clearedState.media?.tape).toBeUndefined();
  });
});
