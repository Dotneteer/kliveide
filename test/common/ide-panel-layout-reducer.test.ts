import { describe, expect, it } from "vitest";
import {
  closePanelInstanceAction,
  createPanelInstanceAction,
  initGlobalSettingsAction,
  movePanelInstanceAction,
  patchPanelViewStateAction,
  resetPanelLayoutAction,
  setWorkspaceSettingsAction,
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

  it("inserts a moved side bar panel at the requested order", () => {
    const state = idePanelLayoutReducer(
      createDefaultIdePanelLayoutState(),
      movePanelInstanceAction("memory", "primarySideBar", "debug", undefined, 1)
    );

    expect(state.primarySideBarByActivity.debug).toEqual([
      "z80Cpu",
      "memory",
      "callStack",
      "ulaIo",
      "watch",
      "breakpoints"
    ]);
    expect(state.instances.memory.order).toBe(1);
    expect(state.instances.callStack.order).toBe(2);
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

  it("rejects moves that the contribution does not allow", () => {
    const state = createDefaultIdePanelLayoutState();
    const nextState = idePanelLayoutReducer(
      state,
      movePanelInstanceAction("callStack", "document", undefined, "group1")
    );

    expect(nextState).toBe(state);
  });

  it("moves a panel instance into the tool area", () => {
    const state = idePanelLayoutReducer(
      createDefaultIdePanelLayoutState(),
      movePanelInstanceAction("z80Cpu", "toolArea")
    );

    expect(state.instances.z80Cpu).toMatchObject({
      placement: "toolArea",
      activityId: undefined,
      groupId: undefined
    });
    expect(state.primarySideBarByActivity.debug).not.toContain("z80Cpu");
    expect(state.toolArea).toContain("z80Cpu");
  });

  it("creates a new document panel instance", () => {
    const state = idePanelLayoutReducer(
      createDefaultIdePanelLayoutState(),
      createPanelInstanceAction("memory.group3", "memory", "memory", "document", undefined, "group3")
    );

    expect(state.instances["memory.group3"]).toMatchObject({
      contributionId: "memory",
      rendererId: "memory",
      placement: "document",
      groupId: "group3",
      expanded: true
    });
    expect(state.documentGroups.group3.instanceIds).toEqual(["memory.group3"]);
    expect(state.documentGroups.group3.activeInstanceId).toBe("memory.group3");
  });

  it("ignores duplicate panel instance creation", () => {
    const state = createDefaultIdePanelLayoutState();
    const nextState = idePanelLayoutReducer(
      state,
      createPanelInstanceAction("memory", "memory", "memory", "document", undefined, "group1")
    );

    expect(nextState).toBe(state);
  });

  it("rejects duplicate document instances when contribution does not allow multiples", () => {
    let state = createDefaultIdePanelLayoutState();
    state = idePanelLayoutReducer(
      state,
      createPanelInstanceAction("z80Cpu.document", "z80Cpu", "z80Cpu", "document", undefined, "group1")
    );
    const nextState = idePanelLayoutReducer(
      state,
      createPanelInstanceAction(
        "z80Cpu.document.copy",
        "z80Cpu",
        "z80Cpu",
        "document",
        undefined,
        "group1"
      )
    );

    expect(nextState).toBe(state);
  });

  it("closes a panel instance and falls back to another active document panel", () => {
    let state = createDefaultIdePanelLayoutState();

    state = idePanelLayoutReducer(
      state,
      movePanelInstanceAction("z80Cpu", "document", undefined, "group1")
    );
    state = idePanelLayoutReducer(state, setPanelInstanceStateAction("z80Cpu", "scrollTop", 128));
    state = idePanelLayoutReducer(state, closePanelInstanceAction("z80Cpu"));

    expect(state.instances.z80Cpu).toBeUndefined();
    expect(state.viewStateByInstance.z80Cpu).toBeUndefined();
    expect(state.documentGroups.group1.instanceIds).toEqual(["memory.group1"]);
    expect(state.documentGroups.group1.activeInstanceId).toBe("memory.group1");
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

  it("mirrors panel layout into workspace settings when workspace settings are active", () => {
    const store = createAppStore("test");

    store.dispatch(setWorkspaceSettingsAction({}), "main");
    store.dispatch(movePanelInstanceAction("z80Cpu", "secondarySideBar"), "ide");

    expect(
      store.getState().workspaceSettings?.ideViewOptions?.panelLayout?.instances.z80Cpu.placement
    ).toBe("secondarySideBar");
    expect(store.getState().globalSettings?.ideViewOptions?.panelLayout).toBeUndefined();
  });

  it("resets panel layout and persists the default layout", () => {
    const store = createAppStore("test");

    store.dispatch(movePanelInstanceAction("z80Cpu", "secondarySideBar"), "ide");
    store.dispatch(resetPanelLayoutAction(), "ide");

    expect(store.getState().idePanelLayout?.instances.z80Cpu).toMatchObject({
      placement: "primarySideBar",
      activityId: "debug"
    });
    expect(store.getState().globalSettings?.ideViewOptions?.panelLayout?.secondarySideBar).toEqual([
      "outline",
      "memory"
    ]);
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

  it("hydrates panel layout from workspace settings over global settings", () => {
    const store = createAppStore("test");
    const globalLayout = createDefaultIdePanelLayoutState();
    const workspaceLayout = createDefaultIdePanelLayoutState();
    globalLayout.instances.watch = {
      ...globalLayout.instances.watch,
      expanded: false
    };
    workspaceLayout.instances.watch = {
      ...workspaceLayout.instances.watch,
      expanded: true,
      size: 900
    };

    store.dispatch(
      initGlobalSettingsAction({
        ideViewOptions: {
          panelLayout: globalLayout
        }
      }),
      "main"
    );
    store.dispatch(
      setWorkspaceSettingsAction({
        ideViewOptions: {
          panelLayout: workspaceLayout
        }
      }),
      "main"
    );

    expect(store.getState().idePanelLayout?.instances.watch).toMatchObject({
      expanded: true,
      size: 900
    });
  });
});
