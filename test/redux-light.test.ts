import { describe, it, expect } from "vitest";
import { Action } from "@state/Action";
import { dimMenuAction, emuLoadedAction } from "@state/actions";
import createAppStore from "@state/store";

describe("AppState management", () => {
  it("Initial AppState after createAppStore", () => {
    const store = createAppStore("test");

    const state = store.getState();
    expect(state.emuLoaded).toBe(false);
    expect(state.dimMenu).toBe(undefined);
  });

  it("AppFlags reducer works", () => {
    const store = createAppStore("test");

    store.dispatch(emuLoadedAction(true));

    const state = store.getState();
    expect(state.emuLoaded).toBe(true);
  });

  it("AppFlags reducer with subscribe works", () => {
    const store = createAppStore("test");

    let counter = 0;
    const unsubscribe = store.subscribe(() => {
      counter++;
    });
    store.dispatch(emuLoadedAction(true));
    unsubscribe();

    const state = store.getState();
    expect(state.emuLoaded).toBe(true);
    expect(counter).toBe(1);
  });

  it("EmuViewOptions reducer works", () => {
    const store = createAppStore("test");

    store.dispatch(dimMenuAction(false));

    const state = store.getState();
    expect(state.dimMenu).toBe(false);
  });

  it("EmuViewOptions reducer with subscribe works", () => {
    const store = createAppStore("test");

    let counter = 0;
    const unsubscribe = store.subscribe(() => {
      counter++;
    });
    store.dispatch(dimMenuAction(false));
    unsubscribe();

    const state = store.getState();
    expect(state.dimMenu).toBe(false);
    expect(counter).toBe(1);
  });

  it("Combined reducers works", () => {
    const store = createAppStore("test");

    store.dispatch(emuLoadedAction(true));
    store.dispatch(dimMenuAction(false));

    const state = store.getState();
    expect(state.emuLoaded).toBe(true);
    expect(state.dimMenu).toBe(false);
  });

  it("Combined reducers with subscribe work", () => {
    const store = createAppStore("test");

    let counter = 0;
    const unsubscribe = store.subscribe(() => {
      counter++;
    });
    store.dispatch(emuLoadedAction(true));
    store.dispatch(dimMenuAction(false));
    unsubscribe();

    const state = store.getState();
    expect(state.emuLoaded).toBe(true);
    expect(state.dimMenu).toBe(false);
    expect(counter).toBe(2);
  });

  it("Combined reducers with forwarding work", () => {
    let forwarded = 0;
    const store = createAppStore("test", async (action: Action) => {
      forwarded++;
    });

    let counter = 0;
    const unsubscribe = store.subscribe(() => {
      counter++;
    });
    store.dispatch(emuLoadedAction(true));
    store.dispatch(dimMenuAction(false));
    unsubscribe();

    const state = store.getState();
    expect(state.emuLoaded).toBe(true);
    expect(state.dimMenu).toBe(false);
    expect(counter).toBe(2);
    expect(forwarded).toBe(2);
  });
});
