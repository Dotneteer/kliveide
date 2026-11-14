import { describe, expect, it, vi } from "vitest";

import type { DocumentNavigationAdapter } from "@renderer/abstractions/DocumentNavigationAdapter";
import type { NavigationEntry } from "@renderer/abstractions/NavigationLocation";
import { LiteEvent } from "@emu/utils/lite-event";
import { NavigationHistoryService } from "@renderer/appIde/services/NavigationHistoryService";
import { textNavigationAdapter } from "@renderer/appIde/navigation/textNavigationAdapter";

/*
 * One navigation history shared by the IDE and its floating document windows
 * (`dev/plans/FLOATING_DOCUMENT_WINDOWS_PLAN.md` §3.5). Each "window" is a NavigationHistoryService
 * over one fake document area; the satellite is wired to the IDE the way main relays them.
 */

type FakeDoc = { id: string; name: string; type: string; line: number };

function window(hubId: number, navHistory: () => any) {
  const files = new Map<string, FakeDoc>();
  const hub = {
    hubId,
    active: undefined as FakeDoc | undefined,
    docs: [] as FakeDoc[],
    getActiveDocument() {
      const d = this.active;
      return d ? { id: d.id, name: d.name, type: d.type, editPosition: { line: d.line, column: 1 } } : undefined;
    },
    getDocumentApi: () => undefined,
    isOpen(id: string) {
      return this.docs.some((d) => d.id === id);
    },
    open(doc: FakeDoc) {
      if (!this.isOpen(doc.id)) this.docs.push(doc);
      this.active = doc;
    }
  };
  const projectService = {
    projectClosed: new LiteEvent<void>(),
    itemRenamed: new LiteEvent<any>(),
    itemDeleted: new LiteEvent<any>(),
    getActiveDocumentHubService: () => hub,
    getDocumentHubServiceInstances: () => [hub]
  } as any;
  const state: any = { globalSettings: {}, ideView: { documentHubState: {} } };
  const store = {
    getState: () => ({ ...state, ideView: { ...state.ideView, navHistory: navHistory() } }),
    dispatch: vi.fn(),
    subscribe: () => () => {}
  } as any;
  const restore = vi.fn(async (entry: any, h: typeof hub) => {
    const doc = files.get(entry.documentId) ?? { id: entry.documentId, name: entry.documentId, type: "Code", line: 0 };
    files.set(doc.id, doc);
    doc.line = entry.locator.line;
    h.open(doc);
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
  const go = (id: string, line: number) => {
    let doc = files.get(id);
    if (!doc) {
      doc = { id, name: id, type: "Code", line };
      files.set(id, doc);
    }
    doc.line = line;
    hub.open(doc);
  };
  const where = () => (hub.active ? `${hub.active.id}:${hub.active.line}` : undefined);
  return { service, store, restore, go, where, hub };
}

function setup() {
  let published: any;
  const ide = window(1, () => published);
  ide.store.dispatch.mockImplementation((action: any) => {
    if (action.type === "SET_NAV_HISTORY_STATE") published = action.payload.value;
  });
  const float = window(3001, () => published);
  const floatingDocs = new Set<string>(["float.asm"]);
  // --- What main relays
  ide.service.setFloatingRestorer((entry) =>
    floatingDocs.has(entry.documentId) ? float.service.restoreExternal(entry) : undefined
  );
  float.service.setRemote({
    record: async (from, to) => ide.service.recordExternal(from, to),
    step: (direction, current) => ide.service.stepFrom(direction, current)
  });
  return { ide, float, floatingDocs };
}

describe("one navigation history for the IDE and its floating windows", () => {
  it("records a floating window's jump in the IDE's history, not its own", async () => {
    const { ide, float } = setup();
    float.go("float.asm", 4);
    await float.service.recordJump("definition", () => float.go("float.asm", 40));
    expect(ide.service.getEntries().entries.map((e) => `${e.documentId}:${(e.locator as any).line}`)).toEqual([
      "float.asm:4",
      "float.asm:40"
    ]);
    expect(float.service.getEntries().entries).toHaveLength(0);
    // --- The IDE publishes the shared state; the satellite reads it
    expect(float.service.canGoBack()).toBe(true);
    expect(float.store.dispatch).not.toHaveBeenCalled();
  });

  it("Go Back in the floating window restores the location there", async () => {
    const { ide, float } = setup();
    float.go("float.asm", 4);
    await float.service.recordJump("definition", () => float.go("float.asm", 40));
    expect(await float.service.goBack()).toBe(true);
    expect(float.where()).toBe("float.asm:4");
    expect(ide.restore).not.toHaveBeenCalled();
    expect(ide.where()).toBeUndefined();
  });

  it("Go Back from the IDE into a floating document restores it in its window", async () => {
    const { ide, float } = setup();
    float.go("float.asm", 7);
    // --- A nav in the floating window to another document runs in the IDE, with the origin
    ide.service.setNextJumpOrigin(float.service.captureCurrent("definition"));
    await ide.service.recordJump("definition", () => ide.go("main.asm", 12));
    expect(await ide.service.goBack()).toBe(true);
    expect(float.where()).toBe("float.asm:7");
    expect(ide.where()).toBe("main.asm:12");
    expect(ide.hub.isOpen("float.asm")).toBe(false);
  });

  it("Go Forward from the floating window returns to the IDE's document", async () => {
    const { ide, float } = setup();
    float.go("float.asm", 7);
    ide.service.setNextJumpOrigin(float.service.captureCurrent("definition"));
    await ide.service.recordJump("definition", () => ide.go("main.asm", 12));
    await ide.service.goBack();
    expect(await float.service.goForward()).toBe(true);
    expect(ide.where()).toBe("main.asm:12");
  });

  it("uses the origin once", async () => {
    const { ide, float } = setup();
    float.go("float.asm", 7);
    ide.go("main.asm", 1);
    ide.service.setNextJumpOrigin(float.service.captureCurrent());
    await ide.service.recordJump("definition", () => ide.go("main.asm", 30));
    await ide.service.recordJump("definition", () => ide.go("other.asm", 2));
    const entries: NavigationEntry[] = ide.service.getEntries().entries as NavigationEntry[];
    expect(entries.map((e) => e.documentId)).toEqual(["float.asm", "main.asm", "other.asm"]);
  });
});
