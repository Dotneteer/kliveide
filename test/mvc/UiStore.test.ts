import { describe, expect, it, vi } from "vitest";

import { UiStore } from "@mvc/core/UiStore";

type CounterState = { n: number };
type CounterEvent = { type: "inc" } | { type: "noop" } | { type: "set"; n: number };

const reduce = (state: CounterState, event: CounterEvent): CounterState => {
  switch (event.type) {
    case "inc":
      return { n: state.n + 1 };
    case "set":
      // --- Returning the same object when nothing really changes is the
      // --- contract the store relies on to stay quiet.
      return event.n === state.n ? state : { n: event.n };
    default:
      return state;
  }
};

const createStore = (n = 0) => new UiStore<CounterState, CounterEvent>({ n }, reduce);

describe("UiStore", () => {
  it("exposes the initial state before anything is dispatched", () => {
    expect(createStore(3).getSnapshot()).toEqual({ n: 3 });
  });

  it("notifies subscribers only when the reducer returns a new state", () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.dispatch({ type: "noop" });
    expect(listener).not.toHaveBeenCalled();
    expect(store.getSnapshot()).toEqual({ n: 0 });

    store.dispatch({ type: "inc" });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getSnapshot()).toEqual({ n: 1 });

    // --- Same value, same reference: nothing changed, nobody is told
    store.dispatch({ type: "set", n: 1 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps the snapshot reference stable across a no-op dispatch", () => {
    const store = createStore();
    const before = store.getSnapshot();
    store.dispatch({ type: "noop" });
    // --- useSyncExternalStore compares by reference; a fresh object here would
    // --- re-render every subscriber for nothing.
    expect(store.getSnapshot()).toBe(before);
  });

  it("stops notifying after unsubscribe", () => {
    const store = createStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.dispatch({ type: "inc" });
    unsubscribe();
    store.dispatch({ type: "inc" });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.listenerCount).toBe(0);
  });

  it("survives a listener that unsubscribes itself while being notified", () => {
    const store = createStore();
    const second = vi.fn();
    const unsubscribeFirst = store.subscribe(() => unsubscribeFirst());
    store.subscribe(second);

    expect(() => store.dispatch({ type: "inc" })).not.toThrow();
    // --- The listener registered after the self-removing one still runs
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("records every dispatched event in order, including no-ops", () => {
    const store = createStore();
    store.dispatch({ type: "inc" });
    store.dispatch({ type: "noop" });
    store.dispatch({ type: "inc" });

    expect(store.events.map((event) => event.type)).toEqual(["inc", "noop", "inc"]);
  });
});
