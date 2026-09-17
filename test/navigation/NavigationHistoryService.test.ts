import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DocumentNavigationAdapter } from "@renderer/abstractions/DocumentNavigationAdapter";
import type { NavigationLocator } from "@renderer/abstractions/NavigationLocation";
import { LiteEvent } from "@emu/utils/lite-event";
import { NavigationHistoryService } from "@renderer/appIde/services/NavigationHistoryService";
import { textNavigationAdapter } from "@renderer/appIde/navigation/textNavigationAdapter";
import { SETTING_IDE_NAV_RECORD_TAB_SWITCH } from "@common/settings/setting-const";

/*
 * A small IDE: document areas ("hubs") holding documents with a cursor line, a project service that
 * knows the active area, and a text-like adapter whose restore moves the fake cursor. Enough to drive
 * the service through real jumps without React or Monaco.
 */

type FakeDoc = { id: string; name: string; type: string; line: number };

class FakeHub {
  docs: FakeDoc[] = [];
  active: FakeDoc | undefined;
  constructor(readonly hubId: number) {}
  getActiveDocument() {
    return this.active
      ? { id: this.active.id, name: this.active.name, type: this.active.type, editPosition: { line: this.active.line, column: 1 } }
      : undefined;
  }
  getDocumentApi() {
    return undefined;
  }
  isOpen(id: string) {
    return this.docs.some((d) => d.id === id);
  }
  open(doc: FakeDoc) {
    if (!this.isOpen(doc.id)) this.docs.push(doc);
    this.active = doc;
  }
}

function setup() {
  const hubs = [new FakeHub(0), new FakeHub(1)];
  const files = new Map<string, FakeDoc>();
  let activeHub = hubs[0];
  const deleted = new Set<string>();

  const projectClosed = new LiteEvent<void>();
  const itemRenamed = new LiteEvent<any>();
  const itemDeleted = new LiteEvent<any>();
  const projectService = {
    projectClosed,
    itemRenamed,
    itemDeleted,
    getActiveDocumentHubService: () => activeHub,
    setActiveDocumentHubService: (h: FakeHub) => (activeHub = h),
    getDocumentHubServiceInstances: () => hubs
  } as any;

  const state: any = { globalSettings: {}, ideView: { documentHubState: { 0: 1 } } };
  const listeners: (() => void)[] = [];
  const store = {
    getState: () => state,
    dispatch: vi.fn(),
    subscribe: (l: () => void) => {
      listeners.push(l);
      return () => {};
    }
  } as any;
  /** A document activation, as the hubs report it. */
  const signalActivation = () => {
    state.ideView = { documentHubState: { ...state.ideView.documentHubState, 0: Math.random() } };
    listeners.forEach((l) => l());
  };

  const restore = vi.fn(async (entry: any, hub: FakeHub) => {
    if (deleted.has(entry.documentId)) return false;
    const doc = files.get(entry.documentId)!;
    doc.line = entry.locator.line;
    hub.open(doc);
    activeHub = hub;
    return true;
  });
  const adapter: DocumentNavigationAdapter = {
    capture: textNavigationAdapter.capture,
    isNear: textNavigationAdapter.isNear,
    describe: textNavigationAdapter.describe,
    restore: restore as any
  };

  const service = new NavigationHistoryService(store, projectService, (type) =>
    type === "Code" ? adapter : undefined
  );
  service.setAppServices({} as any);

  /** Opens (or activates) a file in the active area at a line — what a jump does. */
  const go = (id: string, line: number, type = "Code") => {
    let doc = files.get(id);
    if (!doc) {
      doc = { id, name: id, type, line };
      files.set(id, doc);
    }
    doc.line = line;
    activeHub.open(doc);
  };
  const where = () => {
    const d = activeHub.active;
    return d ? `${d.id}:${d.line}` : undefined;
  };

  return {
    service,
    hubs,
    store,
    state,
    restore,
    deleted,
    go,
    where,
    projectClosed,
    itemRenamed,
    itemDeleted,
    setActiveHub: (h: FakeHub) => (activeHub = h),
    signalActivation,
    lastPublished: () => store.dispatch.mock.calls.at(-1)?.[0]?.payload?.value
  };
}

describe("NavigationHistoryService", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup();
  });

  it("records a jump and goes back and forward through it", async () => {
    t.go("main", 5);
    await t.service.recordJump("definition", () => t.go("utils", 28));
    await t.service.recordJump("definition", () => t.go("input", 6));

    expect(await t.service.goBack()).toBe(true);
    expect(t.where()).toBe("utils:28");
    expect(await t.service.goBack()).toBe(true);
    expect(t.where()).toBe("main:5");
    expect(await t.service.goBack()).toBe(false);

    expect(await t.service.goForward()).toBe(true);
    expect(await t.service.goForward()).toBe(true);
    expect(t.where()).toBe("input:6");
    expect(await t.service.goForward()).toBe(false);
  });

  it("publishes whether Back and Forward are available", async () => {
    t.go("main", 5);
    await t.service.recordJump("definition", () => t.go("utils", 28));
    expect(t.lastPublished()).toEqual({ canGoBack: true, canGoForward: false, count: 2, index: 1 });
    await t.service.goBack();
    expect(t.lastPublished()).toEqual({ canGoBack: false, canGoForward: true, count: 2, index: 0 });
  });

  it("does not record the jumps a restore makes", async () => {
    t.go("main", 5);
    await t.service.recordJump("definition", () => t.go("utils", 28));
    t.restore.mockImplementationOnce(async (entry: any, hub: FakeHub) => {
      // --- An adapter restores through `nav -r`, which calls recordJump: it must not record.
      await t.service.recordJump("definition", () => t.go(entry.documentId, entry.locator.line));
      expect(t.service.isRestoring).toBe(true);
      hub.open({ id: "main", name: "main", type: "Code", line: 5 });
      return true;
    });
    await t.service.goBack();
    expect(t.service.getEntries().entries).toHaveLength(2);
  });

  it("does not record a jump nested in another recorded jump", async () => {
    t.go("main", 5);
    await t.service.recordJump("definition", async () => {
      await t.service.recordJump("definition", () => t.go("lib", 3));
      t.go("utils", 28);
    });
    expect(t.service.getEntries().entries.map((e) => e.documentId)).toEqual(["main", "utils"]);
  });

  it("skips and drops entries that can no longer be restored", async () => {
    t.go("main", 5);
    await t.service.recordJump("definition", () => t.go("utils", 28));
    await t.service.recordJump("definition", () => t.go("input", 6));
    t.deleted.add("utils");

    expect(await t.service.goBack()).toBe(true);
    expect(t.where()).toBe("main:5");
    expect(t.service.getEntries().entries.map((e) => e.documentId)).toEqual(["main", "input"]);
  });

  it("does not create entries for a document type without an adapter", async () => {
    t.go("main", 5);
    await t.service.recordJump("tabSwitch", () => t.go("sprites", 1, "Sprite"));
    expect(t.service.getEntries().entries.map((e) => e.documentId)).toEqual(["main"]);
    // --- ...and Back from there returns to where the user left.
    expect(await t.service.goBack()).toBe(true);
    expect(t.where()).toBe("main:5");
  });

  it("records tab switches only while the setting is on", async () => {
    t.go("main", 5);
    t.state.globalSettings = { ideBehavior: { navRecordTabSwitches: false } };
    expect(SETTING_IDE_NAV_RECORD_TAB_SWITCH).toBe("ideBehavior.navRecordTabSwitches");
    await t.service.recordJump("tabSwitch", () => t.go("utils", 28));
    await t.service.recordJump("explorer", () => t.go("input", 1));
    expect(t.service.getEntries().entries).toHaveLength(0);

    t.state.globalSettings = {};
    await t.service.recordJump("tabSwitch", () => t.go("main", 5));
    expect(t.service.getEntries().entries).toHaveLength(2);
  });

  it("restores into the area the location was seen in", async () => {
    // --- `main` is seen in area 0; the jump lands in area 1.
    t.go("main", 5);
    await t.service.recordJump("definition", () => {
      t.setActiveHub(t.hubs[1]);
      t.go("utils", 28);
    });
    expect(t.service.getEntries().entries.map((e) => e.hubId)).toEqual([0, 1]);
    await t.service.goBack();
    expect(t.restore.mock.calls.at(-1)?.[1]).toBe(t.hubs[0]);
  });

  it("goes to an arbitrary entry", async () => {
    t.go("main", 5);
    await t.service.recordJump("definition", () => t.go("utils", 28));
    await t.service.recordJump("definition", () => t.go("input", 6));
    expect(await t.service.goTo(0)).toBe(true);
    expect(t.where()).toBe("main:5");
    expect(t.service.getEntries().index).toBe(0);
    expect(await t.service.goTo(7)).toBe(false);
  });

  it("clears on project close, and follows renames and deletions", async () => {
    t.go("/p/main.asm", 5);
    await t.service.recordJump("definition", () => t.go("/p/utils.asm", 28));
    await t.service.recordJump("definition", () => t.go("/p/input.asm", 6));

    t.itemRenamed.fire({ oldName: "/p/utils.asm", node: { data: { fullPath: "/p/lib.asm", name: "lib.asm" } } });
    expect(t.service.getEntries().entries[1]).toMatchObject({ documentId: "/p/lib.asm", title: "lib.asm" });

    t.itemDeleted.fire({ data: { fullPath: "/p/input.asm" } });
    expect(t.service.getEntries().entries.map((e) => e.documentId)).toEqual(["/p/main.asm", "/p/lib.asm"]);

    t.projectClosed.fire();
    expect(t.service.getEntries().entries).toHaveLength(0);
  });

  it("answers Back/Forward availability and targets from where the user is now", async () => {
    t.go("main", 5);
    await t.service.recordJump("definition", () => t.go("utils", 28));
    expect(t.service.canGoBack()).toBe(true);
    expect(t.service.peekBack()?.documentId).toBe("main");
    expect(t.service.canGoForward()).toBe(false);
    expect(t.service.peekForward()).toBeUndefined();

    await t.service.goBack();
    expect(t.service.canGoBack()).toBe(false);
    expect(t.service.peekForward()?.documentId).toBe("utils");

    // --- Wandering off without a recorded jump makes Back possible again, to the current entry.
    t.go("lib", 3);
    expect(t.service.canGoBack()).toBe(true);
    expect(t.service.peekBack()?.documentId).toBe("main");
  });

  it("republishes availability when a document is activated without a recorded jump", async () => {
    t.go("main", 5);
    await t.service.recordJump("definition", () => t.go("utils", 28));
    await t.service.goBack();
    expect(t.lastPublished()?.canGoBack).toBe(false);

    // --- A debugger pause opens another file: no jump recorded, but Back now has somewhere to go.
    t.go("lib", 3);
    t.signalActivation();
    expect(t.lastPublished()?.canGoBack).toBe(true);

    // --- Nothing changed: nothing dispatched.
    const dispatches = t.store.dispatch.mock.calls.length;
    t.signalActivation();
    expect(t.store.dispatch.mock.calls.length).toBe(dispatches);
  });

  it("describes entries through their adapter", async () => {
    t.go("main", 5);
    await t.service.recordJump("definition", () => t.go("utils", 28));
    expect(t.service.describe(t.service.getEntries().entries[1])).toBe("line 28");
  });
});

describe("textNavigationAdapter", () => {
  it("previews the entry's source line from the cached document", () => {
    const services = {
      projectService: {
        getDocumentById: (id: string) =>
          id === "/p/a.asm" ? { contents: "; header\r\n  ld a,1\n  call PutChar\n" } : undefined
      }
    } as any;
    const at = (line: number, id = "/p/a.asm") =>
      ({ documentId: id, locator: { kind: "text", line, column: 1 } }) as any;
    expect(textNavigationAdapter.preview!(at(3), services)).toBe("call PutChar");
    expect(textNavigationAdapter.preview!(at(9), services)).toBeUndefined();
    expect(textNavigationAdapter.preview!(at(1, "/p/closed.asm"), services)).toBeUndefined();
  });

  const text = (line: number): NavigationLocator => ({ kind: "text", line, column: 1 });

  it("treats lines within 10 of each other as one place", () => {
    expect(textNavigationAdapter.isNear(text(10), text(20))).toBe(true);
    expect(textNavigationAdapter.isNear(text(10), text(21))).toBe(false);
  });

  it("captures the document's saved cursor position", () => {
    expect(
      textNavigationAdapter.capture({ editPosition: { line: 7, column: 3 } } as any, {} as any)
    ).toEqual({ kind: "text", line: 7, column: 3 });
  });

  it("restores through nav in the chosen area, passing nav's one-higher column", async () => {
    const hub = { hubId: 1 } as any;
    const executeCommand = vi.fn().mockResolvedValue({ success: true });
    const setActiveDocumentHubService = vi.fn();
    const ok = await textNavigationAdapter.restore(
      {
        documentId: "/p/main.asm",
        documentType: "CodeEditor",
        title: "main.asm",
        locator: { kind: "text", line: 42, column: 9 },
        reason: "definition",
        time: 0
      },
      hub,
      {
        ideCommandsService: { executeCommand },
        projectService: { getActiveDocumentHubService: () => ({}), setActiveDocumentHubService }
      } as any
    );
    expect(ok).toBe(true);
    expect(setActiveDocumentHubService).toHaveBeenCalledWith(hub);
    expect(executeCommand).toHaveBeenCalledWith('nav "/p/main.asm" 42 10');
  });
});
