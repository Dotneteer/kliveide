import { describe, expect, it } from "vitest";
import createAppStore from "../../src/common/state/store";
import { setKeyMappingsAction } from "../../src/common/state/actions";

describe("key mapping shared state", () => {
  it("sets and clears key mappings", () => {
    const store = createAppStore("test");

    store.dispatch(setKeyMappingsAction("/tmp/test.keymap", {
      merge: true,
      mapping: {
        KeyQ: "A"
      }
    }));

    expect(store.getState().keyMappingFile).toBe("/tmp/test.keymap");
    expect(store.getState().keyMappings).toEqual({
      merge: true,
      mapping: {
        KeyQ: "A"
      }
    });

    store.dispatch(setKeyMappingsAction(undefined, undefined));

    expect(store.getState().keyMappingFile).toBeUndefined();
    expect(store.getState().keyMappings).toBeUndefined();
  });
});
