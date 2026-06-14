import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createPanelRenderContext,
  getPanelRuntimeValue,
  readPanelGlobalState,
  readPanelState,
  resetPanelRuntimeState,
  subscribePanelRuntime
} from "../../src/renderer/src/components/ide/panel-runtime";

const memoryTop = {
  contributionId: "memory",
  instanceId: "memory-top",
  placement: "document" as const,
  groupId: "group-1",
  chrome: "document" as const
};

const memoryBottom = {
  contributionId: "memory",
  instanceId: "memory-bottom",
  placement: "document" as const,
  groupId: "group-2",
  chrome: "document" as const
};

describe("panel runtime temporary store", () => {
  beforeEach(() => {
    resetPanelRuntimeState();
  });

  it("stores per-instance panel state independently", () => {
    const topRuntime = createPanelRenderContext(memoryTop);
    const bottomRuntime = createPanelRenderContext(memoryBottom);

    topRuntime.setState("scrollTop", 0);
    bottomRuntime.setState("scrollTop", 4096);

    expect(readPanelState("memory-top", "scrollTop")).toBe(0);
    expect(readPanelState("memory-bottom", "scrollTop")).toBe(4096);
    expect(topRuntime.getState("scrollTop")).toBe(0);
    expect(bottomRuntime.getState("scrollTop")).toBe(4096);
  });

  it("patches per-instance state without mutating previous snapshots", () => {
    const runtime = createPanelRenderContext(memoryTop);
    const before = runtime.setState("scrollTop", 128);

    const after = runtime.patchState({ address: 0x8000, scrollTop: 256 });

    expect(before.state).toEqual({ scrollTop: 128 });
    expect(after.state).toEqual({ address: 0x8000, scrollTop: 256 });
  });

  it("shares contribution global state between instances", () => {
    const topRuntime = createPanelRenderContext(memoryTop);
    const bottomRuntime = createPanelRenderContext(memoryBottom);

    topRuntime.setGlobalState("numberBase", "hex");

    expect(bottomRuntime.getGlobalState("numberBase")).toBe("hex");
    expect(readPanelGlobalState("memory", "numberBase")).toBe("hex");
  });

  it("publishes runtime metadata and state snapshots", () => {
    const runtime = createPanelRenderContext(memoryTop);
    runtime.setState("address", 0x4000);

    expect(getPanelRuntimeValue(memoryTop)).toMatchObject({
      contributionId: "memory",
      instanceId: "memory-top",
      placement: "document",
      groupId: "group-1",
      chrome: "document",
      state: { address: 0x4000 }
    });
  });

  it("notifies subscribers for instance and contribution state changes", () => {
    const listener = vi.fn();
    const unsubscribe = subscribePanelRuntime(memoryTop, listener);
    const runtime = createPanelRenderContext(memoryTop);

    runtime.setState("scrollTop", 12);
    runtime.setGlobalState("numberBase", "hex");
    unsubscribe();
    runtime.setState("scrollTop", 24);

    expect(listener).toHaveBeenCalledTimes(2);
  });
});
