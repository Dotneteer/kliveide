import { describe, expect, it, vi } from "vitest";

import type { NavigationEntry } from "@renderer/abstractions/NavigationLocation";
import { LiteEvent } from "@emu/utils/lite-event";
import {
  createTextNavigationAdapter,
  type TrackableTextModel
} from "@renderer/appIde/navigation/textNavigationAdapter";
import { NavigationHistoryService } from "@renderer/appIde/services/NavigationHistoryService";

/**
 * A text model that does what matters here: holds lines, and moves point decorations when lines are
 * inserted or deleted above them — Monaco's own behaviour for a sticky decoration.
 */
class FakeModel implements TrackableTextModel {
  lines: string[];
  decorations = new Map<string, { line: number; column: number }>();
  disposed = false;
  private nextId = 1;
  private disposeListeners: (() => void)[] = [];

  constructor(lineCount: number) {
    this.lines = Array.from({ length: lineCount }, (_, i) => `line ${i + 1}`);
  }
  isDisposed() {
    return this.disposed;
  }
  getLineCount() {
    return this.lines.length;
  }
  getLineContent(n: number) {
    return this.lines[n - 1];
  }
  getLineMaxColumn(n: number) {
    return this.lines[n - 1].length + 1;
  }
  deltaDecorations(old: string[], added: any[]) {
    old.forEach((id) => this.decorations.delete(id));
    return added.map((d) => {
      const id = `d${this.nextId++}`;
      this.decorations.set(id, { line: d.range.startLineNumber, column: d.range.startColumn });
      return id;
    });
  }
  getDecorationRange(id: string) {
    const d = this.decorations.get(id);
    return d ? { startLineNumber: d.line, startColumn: d.column } : null;
  }
  onWillDispose(listener: () => void) {
    this.disposeListeners.push(listener);
    return { dispose: () => (this.disposeListeners = this.disposeListeners.filter((l) => l !== listener)) };
  }
  /** Inserts `count` lines before line `at`. */
  insertLines(at: number, count: number) {
    this.lines.splice(at - 1, 0, ...Array.from({ length: count }, () => "inserted"));
    for (const d of this.decorations.values()) if (d.line >= at) d.line += count;
  }
  /** Deletes `count` lines starting at line `at`. */
  deleteLines(at: number, count: number) {
    this.lines.splice(at - 1, count);
    for (const d of this.decorations.values()) {
      if (d.line >= at + count) d.line -= count;
      else if (d.line >= at) d.line = at;
    }
  }
  dispose() {
    this.disposeListeners.forEach((l) => l());
    this.disposed = true;
    this.decorations.clear();
  }
}

function entry(documentId: string, line: number, column = 1): NavigationEntry {
  return {
    documentId,
    documentType: "CodeEditor",
    title: documentId,
    locator: { kind: "text", line, column },
    reason: "definition",
    time: 0
  };
}

describe("text navigation adapter line drift", () => {
  it("follows an entry's line as lines are inserted and deleted above it", () => {
    const model = new FakeModel(100);
    const adapter = createTextNavigationAdapter({ getModel: (id) => (id === "/p/a.asm" ? model : undefined) });
    const e = entry("/p/a.asm", 40, 5);

    adapter.track!([e]);
    model.insertLines(10, 7);
    expect(adapter.resolve!(e)).toEqual({ kind: "text", line: 47, column: 5 });
    model.deleteLines(1, 3);
    expect(adapter.resolve!(e)).toEqual({ kind: "text", line: 44, column: 5 });
    // --- Lines after it change nothing.
    model.insertLines(80, 20);
    expect(adapter.resolve!(e)).toMatchObject({ line: 44 });
  });

  it("keeps the recorded position for a file with no editor model", () => {
    const adapter = createTextNavigationAdapter({ getModel: () => undefined });
    const e = entry("/p/closed.asm", 12);
    adapter.track!([e]);
    expect(adapter.resolve!(e)).toBe(e.locator);
  });

  it("starts following once the file's model appears", () => {
    let model: FakeModel | undefined;
    const adapter = createTextNavigationAdapter({ getModel: () => model });
    const e = entry("/p/a.asm", 20);
    adapter.track!([e]);

    model = new FakeModel(50);
    adapter.track!([e]);
    model.insertLines(1, 2);
    expect(adapter.resolve!(e)).toMatchObject({ line: 22 });
  });

  it("clamps a recorded line past the end of the file", () => {
    const model = new FakeModel(10);
    const adapter = createTextNavigationAdapter({ getModel: () => model });
    const e = entry("/p/a.asm", 99, 40);
    adapter.track!([e]);
    expect(adapter.resolve!(e)).toEqual({ kind: "text", line: 10, column: 8 });
  });

  it("stops following entries that left the history, removing their decorations", () => {
    const model = new FakeModel(50);
    const adapter = createTextNavigationAdapter({ getModel: () => model });
    const a = entry("/p/a.asm", 5);
    const b = entry("/p/a.asm", 30);
    adapter.track!([a, b]);
    expect(model.decorations.size).toBe(2);

    adapter.track!([b]);
    expect(model.decorations.size).toBe(1);
    model.insertLines(1, 1);
    expect(adapter.resolve!(a)).toBe(a.locator);
    expect(adapter.resolve!(b)).toMatchObject({ line: 31 });
  });

  it("writes the followed position back into the entry when the model is disposed", () => {
    const model = new FakeModel(50);
    const adapter = createTextNavigationAdapter({ getModel: () => (model.disposed ? undefined : model) });
    const e = entry("/p/a.asm", 20);
    adapter.track!([e]);
    model.insertLines(1, 4);

    model.dispose();

    expect(e.locator).toMatchObject({ line: 24 });
    expect(adapter.resolve!(e)).toMatchObject({ line: 24 });
  });

  it("previews from the live model, unsaved edits included", () => {
    const model = new FakeModel(5);
    model.lines[2] = "  call PutChar  ";
    const adapter = createTextNavigationAdapter({ getModel: () => model });
    const services = { projectService: { getDocumentById: () => ({ contents: "stale" }) } } as any;
    expect(adapter.preview!(entry("/p/a.asm", 3), services)).toBe("call PutChar");
    expect(adapter.preview!(entry("/p/a.asm", 9), services)).toBeUndefined();
  });
});

describe("navigation history with line drift", () => {
  function setup() {
    const model = new FakeModel(200);
    const adapter = createTextNavigationAdapter({ getModel: (id) => (id === "main" ? model : undefined) });
    const restore = vi.fn(async () => true);
    const tracked = { ...adapter, restore } as any;

    let active: any = { id: "main", name: "main", type: "Code", editPosition: { line: 1, column: 1 } };
    const hub = {
      hubId: 0,
      getActiveDocument: () => active,
      getDocumentApi: () => undefined,
      isOpen: () => true
    };
    const projectService = {
      projectClosed: new LiteEvent<void>(),
      itemRenamed: new LiteEvent<any>(),
      itemDeleted: new LiteEvent<any>(),
      getActiveDocumentHubService: () => hub,
      getDocumentHubServiceInstances: () => [hub]
    } as any;
    const store = { getState: () => ({ globalSettings: {} }), dispatch: vi.fn() } as any;
    const service = new NavigationHistoryService(store, projectService, (t) => (t === "Code" ? tracked : undefined));
    service.setAppServices({} as any);
    const at = (id: string, line: number) => {
      active = { id, name: id, type: "Code", editPosition: { line, column: 1 } };
    };
    return { model, service, restore, at };
  }

  it("goes back to where the code moved, and describes it there", async () => {
    const { model, service, restore, at } = setup();
    at("main", 100);
    await service.recordJump("definition", () => at("utils", 5));

    // --- Twelve lines typed in above the place we left.
    model.insertLines(50, 12);

    const [left] = service.getEntries().entries;
    expect(service.describe(left)).toBe("line 112");
    await service.goBack();
    expect(restore.mock.calls[0][0].locator).toMatchObject({ line: 112 });
  });

  it("judges 'the same place' by the moved line", async () => {
    const { model, service, at } = setup();
    at("main", 100);
    await service.recordJump("definition", () => at("utils", 5));
    await service.goBack();
    model.insertLines(1, 30);

    // --- The cursor is now at the moved code (line 130); leaving from there must not count as a
    // --- different place from the entry recorded at line 100.
    at("main", 131);
    await service.recordJump("definition", () => at("lib", 1));
    expect(service.getEntries().entries.map((e) => e.documentId)).toEqual(["main", "lib"]);
  });
});
