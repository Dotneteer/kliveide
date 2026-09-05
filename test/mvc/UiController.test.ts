import { beforeEach, describe, expect, it, vi } from "vitest";

import { deferred } from "./deferred";
import { TestController, selectorCalls, type TestPorts } from "./testController";

function createController(load?: TestPorts["load"]) {
  const ports: TestPorts = { load: vi.fn(load ?? (async (key: string) => `value:${key}`)) };
  return { controller: new TestController(ports), ports };
}

describe("UiController", () => {
  beforeEach(() => {
    selectorCalls.count = 0;
  });

  it("exposes the initial state and view model before anything is dispatched", () => {
    const { controller } = createController();

    expect(controller.state).toEqual({ busy: false, value: "", error: "" });
    expect(controller.viewModel).toEqual({ busy: false, label: "Idle" });
  });

  it("makes in-flight state observable before the port resolves", async () => {
    const gate = deferred<string>();
    const { controller } = createController(() => gate.promise);

    // --- Deliberately not awaited: this is the only way to see the busy view
    // --- model a user actually looks at while the work runs.
    const running = controller.dispatch({ type: "loadRequested", key: "a" });
    expect(controller.viewModel).toEqual({ busy: true, label: "Loading..." });

    gate.resolve("done");
    await running;
    expect(controller.viewModel).toEqual({ busy: false, label: "done" });
  });

  it("settle() waits for work the handler started", async () => {
    const gate = deferred<string>();
    const { controller } = createController(() => gate.promise);

    void controller.dispatch({ type: "loadRequested", key: "a" });
    gate.resolve("done");
    await controller.settle();

    expect(controller.state.busy).toBe(false);
    expect(controller.state.value).toBe("done");
  });

  it("ignores a slow result that lands after a newer one", async () => {
    const slow = deferred<string>();
    const fast = deferred<string>();
    const responses = [slow.promise, fast.promise];
    const { controller } = createController(() => responses.shift()!);

    void controller.dispatch({ type: "loadRequested", key: "slow" });
    void controller.dispatch({ type: "loadRequested", key: "fast" });

    fast.resolve("newest");
    slow.resolve("stale");
    await controller.settle();

    // --- The stale answer arrived last but belongs to a superseded request
    expect(controller.state.value).toBe("newest");
    expect(controller.events.map((event) => event.type)).toEqual([
      "loadStarted",
      "loadStarted",
      "loadSettled"
    ]);
  });

  it("memoizes the view model on state identity", () => {
    const { controller } = createController();

    const first = controller.viewModel;
    const second = controller.viewModel;

    // --- The useSyncExternalStore contract: an unchanged state must yield the
    // --- very same object, or React re-renders forever.
    expect(second).toBe(first);
    expect(selectorCalls.count).toBe(1);
  });

  it("recomputes the view model only when state actually changes", async () => {
    const { controller } = createController();

    const before = controller.viewModel;
    // --- The reducer returns the same state for a redundant clear
    await controller.dispatch({ type: "cleared" });

    expect(controller.viewModel).toBe(before);
    expect(selectorCalls.count).toBe(1);
  });

  it("notifies subscribers when an event changes state", async () => {
    const { controller } = createController();
    const listener = vi.fn();
    controller.subscribe(listener);

    await controller.dispatch({ type: "loadRequested", key: "a" });

    // --- loadStarted and loadSettled both changed state
    expect(listener).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot()).toEqual({ busy: false, label: "value:a" });
  });

  it("routes a rejected handler to onUnhandled instead of an unhandled rejection", async () => {
    const { controller } = createController();

    await expect(controller.dispatch({ type: "throwsAsync" })).resolves.toBeUndefined();

    expect(controller.unhandled).toHaveLength(1);
    expect((controller.unhandled[0] as Error).message).toBe("async boom");
  });

  it("routes a handler that throws synchronously to onUnhandled", async () => {
    const { controller } = createController();

    await expect(controller.dispatch({ type: "throwsSync" })).resolves.toBeUndefined();

    // --- A view dispatches from a DOM event handler; a synchronous throw there
    // --- would escape into React, not into the caller.
    expect((controller.unhandled[0] as Error).message).toBe("sync boom");
  });

  it("turns a port rejection into a modeled event, not an unhandled error", async () => {
    const { controller } = createController(async () => {
      throw new Error("port exploded");
    });

    await controller.dispatch({ type: "loadRequested", key: "a" });

    expect(controller.state.error).toBe("port exploded");
    expect(controller.viewModel.label).toBe("port exploded");
    expect(controller.unhandled).toHaveLength(0);
  });

  it("ignores intents dispatched after dispose", async () => {
    const { controller, ports } = createController();
    controller.dispose();

    await controller.dispatch({ type: "loadRequested", key: "a" });

    expect(ports.load).not.toHaveBeenCalled();
    expect(controller.isDisposed).toBe(true);
  });

  it("drops a result that arrives after dispose", async () => {
    const gate = deferred<string>();
    const { controller } = createController(() => gate.promise);
    const listener = vi.fn();
    controller.subscribe(listener);

    const running = controller.dispatch({ type: "loadRequested", key: "a" });
    controller.dispose();
    gate.resolve("too late");
    await running;

    // --- Only the loadStarted before dispose reached the store
    expect(controller.state.value).toBe("");
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
