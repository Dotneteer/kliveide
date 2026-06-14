import { describe, expect, it } from "vitest";
import {
  initGlobalSettingsAction,
  patchPanelViewStateAction,
  setPanelContributionStateAction,
  setPanelExpandedAction,
  setPanelInstanceStateAction,
  setPanelSizeAction
} from "../../src/common/state/actions";
import { idePanelLayoutReducer } from "../../src/common/state/ide-panel-layout-reducer";
import { createDefaultIdePanelLayoutState } from "../../src/common/state/ide-panel-layout-state";
import createAppStore from "../../src/common/state/store";

describe("idePanelLayoutReducer", () => {
  it("initializes default Debug and secondary panel layout", () => {
    const state = createDefaultIdePanelLayoutState();

    expect(state.primarySideBarByActivity.debug).toEqual([
      "z80Cpu",
      "callStack",
      "ulaIo",
      "watch",
      "breakpoints"
    ]);
    expect(state.secondarySideBar).toEqual(["outline", "memory"]);
    expect(state.instances.z80Cpu).toMatchObject({
      contributionId: "z80Cpu",
      rendererId: "z80Cpu",
      placement: "primarySideBar",
      activityId: "debug",
      expanded: true
    });
  });

  it("updates panel expanded and size state immutably", () => {
    const state = createDefaultIdePanelLayoutState();

    const collapsed = idePanelLayoutReducer(state, setPanelExpandedAction("watch", false));
    const resized = idePanelLayoutReducer(collapsed, setPanelSizeAction("watch", 720));

    expect(collapsed).not.toBe(state);
    expect(collapsed.instances.watch.expanded).toBe(false);
    expect(state.instances.watch.expanded).toBe(true);
    expect(resized.instances.watch.size).toBe(720);
  });

  it("stores per-instance panel state independently", () => {
    let state = createDefaultIdePanelLayoutState();

    state = idePanelLayoutReducer(state, setPanelInstanceStateAction("memory-top", "scrollTop", 0));
    state = idePanelLayoutReducer(
      state,
      setPanelInstanceStateAction("memory-bottom", "scrollTop", 4096)
    );

    expect(state.viewStateByInstance["memory-top"].scrollTop).toBe(0);
    expect(state.viewStateByInstance["memory-bottom"].scrollTop).toBe(4096);
  });

  it("patches per-instance panel state", () => {
    let state = createDefaultIdePanelLayoutState();

    state = idePanelLayoutReducer(state, setPanelInstanceStateAction("memory", "scrollTop", 128));
    state = idePanelLayoutReducer(
      state,
      patchPanelViewStateAction("memory", { address: 0x8000, scrollTop: 256 })
    );

    expect(state.viewStateByInstance.memory).toEqual({
      address: 0x8000,
      scrollTop: 256
    });
  });

  it("stores contribution global state separately from instance state", () => {
    const state = idePanelLayoutReducer(
      createDefaultIdePanelLayoutState(),
      setPanelContributionStateAction("memory", "numberBase", "hex")
    );

    expect(state.contributionState.memory.numberBase).toBe("hex");
    expect(state.viewStateByInstance.memory).toBeUndefined();
  });

  it("mirrors panel layout changes into persisted global settings", () => {
    const store = createAppStore("test");

    store.dispatch(setPanelExpandedAction("watch", false), "ide");

    expect(store.getState().idePanelLayout?.instances.watch.expanded).toBe(false);
    expect(
      store.getState().globalSettings?.ideViewOptions?.panelLayout?.instances.watch.expanded
    ).toBe(false);
  });

  it("hydrates panel layout from persisted global settings", () => {
    const store = createAppStore("test");
    const persistedLayout = createDefaultIdePanelLayoutState();
    persistedLayout.instances.watch = {
      ...persistedLayout.instances.watch,
      expanded: false
    };

    store.dispatch(
      initGlobalSettingsAction({
        ideViewOptions: {
          panelLayout: persistedLayout
        }
      }),
      "main"
    );

    expect(store.getState().idePanelLayout?.instances.watch.expanded).toBe(false);
  });
});
