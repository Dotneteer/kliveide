import { describe, expect, it } from "vitest";
import {
  initGlobalSettingsAction,
  movePanelInstanceAction,
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

  it("initializes document group panel instances independently", () => {
    const state = createDefaultIdePanelLayoutState();

    expect(state.documentGroups.group1.instanceIds).toEqual(["memory.group1"]);
    expect(state.documentGroups.group2.instanceIds).toEqual(["memory.group2"]);
    expect(state.instances["memory.group1"]).toMatchObject({
      contributionId: "memory",
      rendererId: "memory",
      placement: "document",
      groupId: "group1"
    });
    expect(state.instances["memory.group2"]).toMatchObject({
      contributionId: "memory",
      rendererId: "memory",
      placement: "document",
      groupId: "group2"
    });
  });

  it("initializes Commands and Output as tool area panel instances", () => {
    const state = createDefaultIdePanelLayoutState();

    expect(state.toolArea).toEqual(["commands", "output"]);
    expect(state.instances.commands).toMatchObject({
      contributionId: "commands",
      rendererId: "commands",
      placement: "toolArea"
    });
    expect(state.instances.output).toMatchObject({
      contributionId: "output",
      rendererId: "output",
      placement: "toolArea"
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

  it("moves a panel instance from primary to secondary side bar", () => {
    const state = idePanelLayoutReducer(
      createDefaultIdePanelLayoutState(),
      movePanelInstanceAction("z80Cpu", "secondarySideBar")
    );

    expect(state.instances.z80Cpu).toMatchObject({
      placement: "secondarySideBar",
      activityId: undefined
    });
    expect(state.primarySideBarByActivity.debug).not.toContain("z80Cpu");
    expect(state.secondarySideBar).toContain("z80Cpu");
  });

  it("moves a panel instance from secondary side bar to a primary activity", () => {
    const state = idePanelLayoutReducer(
      createDefaultIdePanelLayoutState(),
      movePanelInstanceAction("memory", "primarySideBar", "debug")
    );

    expect(state.instances.memory).toMatchObject({
      placement: "primarySideBar",
      activityId: "debug"
    });
    expect(state.secondarySideBar).not.toContain("memory");
    expect(state.primarySideBarByActivity.debug).toContain("memory");
  });

  it("moves a panel instance into a document group", () => {
    const state = idePanelLayoutReducer(
      createDefaultIdePanelLayoutState(),
      movePanelInstanceAction("z80Cpu", "document", undefined, "group1")
    );

    expect(state.instances.z80Cpu).toMatchObject({
      placement: "document",
      groupId: "group1"
    });
    expect(state.documentGroups.group1.instanceIds).toContain("z80Cpu");
    expect(state.documentGroups.group1.activeInstanceId).toBe("z80Cpu");
  });

  it("mirrors panel layout changes into persisted global settings", () => {
    const store = createAppStore("test");

    store.dispatch(setPanelExpandedAction("watch", false), "ide");

    expect(store.getState().idePanelLayout?.instances.watch.expanded).toBe(false);
    expect(
      store.getState().globalSettings?.ideViewOptions?.panelLayout?.instances.watch.expanded
    ).toBe(false);
  });

  it("mirrors moved panel layout into persisted global settings", () => {
    const store = createAppStore("test");

    store.dispatch(movePanelInstanceAction("z80Cpu", "secondarySideBar"), "ide");

    expect(
      store.getState().globalSettings?.ideViewOptions?.panelLayout?.instances.z80Cpu.placement
    ).toBe("secondarySideBar");
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
