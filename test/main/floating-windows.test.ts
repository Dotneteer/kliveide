import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import createAppStore from "@state/store";
import { FloatingWindowManager, type FloatingWindowLike } from "@main/floating-windows";
import type { FloatSlot } from "@messaging/messages-core";

type FakeWindow = FloatingWindowLike & {
  slot: FloatSlot;
  destroyed: boolean;
  focused: boolean;
  listeners: Record<string, ((...args: any[]) => void)[]>;
  emit(event: string, ...args: any[]): void;
};

function fakeWindow(slot: FloatSlot): FakeWindow {
  const w: FakeWindow = {
    slot,
    destroyed: false,
    focused: false,
    listeners: {},
    isDestroyed: () => w.destroyed,
    destroy: () => {
      w.destroyed = true;
      w.emit("closed");
    },
    focus: () => {
      w.focused = true;
    },
    show: () => {},
    restore: () => {},
    isMinimized: () => false,
    isFocused: () => w.focused,
    getBounds: () => ({ x: 10, y: 20, width: 300, height: 200 }),
    on: (event, listener) => {
      (w.listeners[event] ??= []).push(listener);
    },
    emit: (event, ...args) => w.listeners[event]?.forEach((l) => l(...args)),
    webContents: { send: () => {} }
  };
  return w;
}

function setup() {
  const store = createAppStore("main");
  const windows: FakeWindow[] = [];
  const floatApis = new Map<number, any>();
  const ideApi = {
    openDockedDocument: vi.fn(async () => true)
  };
  const manager = new FloatingWindowManager({
    createWindow: (slot) => {
      const w = fakeWindow(slot);
      windows.push(w);
      floatApis.set(slot, {
        saveAllBeforeQuit: vi.fn(async () => true),
        revealFloatingDocument: vi.fn(async () => {}),
        floatingDocumentRenamed: vi.fn(async () => {}),
        requestFloatingClose: vi.fn(async () => true)
      });
      return w;
    },
    defaultBounds: () => ({ x: 1, y: 2, width: 3, height: 4 }),
    getState: () => store.getState(),
    dispatch: (action) => store.dispatch(action),
    registerMessenger: vi.fn(),
    unregisterMessenger: vi.fn(),
    getFloatApi: (slot) => floatApis.get(slot),
    getIdeApi: () => ideApi as any,
    showIdeWindow: vi.fn(),
    focusChanged: vi.fn()
  });
  return { store, windows, floatApis, ideApi, manager };
}

const doc = (id: string) => ({ document: { id, type: "CodeEditor", position: { line: 3, column: 4 } } });

describe("FloatingWindowManager", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("records the entry before the window starts, with the default bounds", () => {
    const { store, manager } = setup();
    const result = manager.open({ ...doc("/p/a.asm"), sourceAreaId: "document-area-2" });
    expect(result).toEqual({ slot: 1 });
    expect(store.getState().floatingDocuments?.[1]).toMatchObject({
      slot: 1,
      sourceAreaId: "document-area-2",
      document: { id: "/p/a.asm", position: { line: 3, column: 4 } },
      bounds: { x: 1, y: 2, width: 3, height: 4 }
    });
  });

  it("allows at most 8 windows, then reuses a freed slot", () => {
    const { manager } = setup();
    for (let i = 1; i <= 8; i++) {
      expect(manager.open(doc(`/p/${i}.asm`))).toEqual({ slot: i });
    }
    expect(manager.open(doc("/p/9.asm"))).toEqual({ error: "limit" });
    manager.destroy(4);
    expect(manager.open(doc("/p/9.asm"))).toEqual({ slot: 4 });
  });

  it("never floats one document twice: it focuses the window instead", () => {
    const { windows, manager } = setup();
    manager.open(doc("/p/a.asm"));
    expect(manager.open(doc("/p/a.asm"))).toEqual({ error: "alreadyFloating" });
    expect(windows).toHaveLength(1);
    expect(windows[0].focused).toBe(true);
  });

  it("docks through the IDE first, then destroys the window and clears the slot", async () => {
    const { store, windows, ideApi, manager } = setup();
    manager.open({ ...doc("/p/a.asm"), sourceAreaId: "document-area-3" });
    const moved = { id: "/p/a.asm", type: "CodeEditor", position: { line: 9, column: 1 } };
    expect(await manager.dock(1, moved)).toBe(true);
    expect(ideApi.openDockedDocument).toHaveBeenCalledWith({
      document: moved,
      sourceAreaId: "document-area-3"
    });
    expect(windows[0].destroyed).toBe(true);
    expect(store.getState().floatingDocuments?.[1]).toBeUndefined();
  });

  it("keeps the window when the IDE cannot take the document back", async () => {
    const { store, windows, ideApi, manager } = setup();
    manager.open(doc("/p/a.asm"));
    ideApi.openDockedDocument.mockResolvedValueOnce(false);
    expect(await manager.dock(1)).toBe(false);
    expect(windows[0].destroyed).toBe(false);
    expect(store.getState().floatingDocuments?.[1]).toBeDefined();
  });

  it("turns the OS close into the renderer's Close", () => {
    const { windows, floatApis, manager } = setup();
    manager.open(doc("/p/a.asm"));
    const preventDefault = vi.fn();
    windows[0].emit("close", { preventDefault });
    expect(preventDefault).toHaveBeenCalled();
    expect(floatApis.get(1).requestFloatingClose).toHaveBeenCalled();
    expect(windows[0].destroyed).toBe(false);
  });

  it("lets the windows close while quitting, and keeps their entries for the workspace", () => {
    const { store, windows, manager } = setup();
    manager.open(doc("/p/a.asm"));
    manager.setQuitting(true);
    const preventDefault = vi.fn();
    windows[0].emit("close", { preventDefault });
    expect(preventDefault).not.toHaveBeenCalled();
    manager.destroyAll();
    expect(windows[0].destroyed).toBe(true);
    expect(store.getState().floatingDocuments?.[1]).toBeDefined();
  });

  it("flushes every window's saves before a quit; one refusal stops it", async () => {
    const { floatApis, manager } = setup();
    manager.open(doc("/p/a.asm"));
    manager.open(doc("/p/b.asm"));
    expect(await manager.saveAllBeforeQuit()).toBe(true);
    floatApis.get(2).saveAllBeforeQuit.mockResolvedValueOnce(false);
    expect(await manager.saveAllBeforeQuit()).toBe(false);
    expect(floatApis.get(1).saveAllBeforeQuit).toHaveBeenCalledTimes(2);
  });

  it("focuses the window of a floating document and moves its view", async () => {
    const { windows, floatApis, manager } = setup();
    manager.open(doc("/p/a.asm"));
    manager.open(doc("/p/b.asm"));
    expect(await manager.focusDocument({ documentId: "/p/b.asm", line: 12 })).toBe(true);
    expect(windows[1].focused).toBe(true);
    expect(floatApis.get(2).revealFloatingDocument).toHaveBeenCalledWith({
      documentId: "/p/b.asm",
      line: 12
    });
    expect(await manager.focusDocument({ documentId: "/p/c.asm" })).toBe(false);
  });

  it("follows a rename", async () => {
    const { store, floatApis, manager } = setup();
    manager.open(doc("/p/a.asm"));
    await manager.renameDocument("/p/a.asm", "/p/z.asm");
    expect(store.getState().floatingDocuments?.[1]?.document.id).toBe("/p/z.asm");
    expect(floatApis.get(1).floatingDocumentRenamed).toHaveBeenCalledWith("/p/a.asm", "/p/z.asm");
  });

  it("remembers the bounds once a move settles", () => {
    const { store, windows, manager } = setup();
    manager.open(doc("/p/a.asm"));
    windows[0].emit("move");
    windows[0].emit("resize");
    expect(store.getState().floatingDocuments?.[1]?.bounds).toEqual({ x: 1, y: 2, width: 3, height: 4 });
    vi.advanceTimersByTime(600);
    expect(store.getState().floatingDocuments?.[1]?.bounds).toEqual({
      x: 10,
      y: 20,
      width: 300,
      height: 200
    });
  });

  it("reports focus to the menus", () => {
    const { windows, manager } = setup();
    manager.open(doc("/p/a.asm"));
    windows[0].emit("focus");
    windows[0].focused = true;
    expect(manager.hasFocus()).toBe(true);
  });
});

describe("FloatingWindowManager during a quit", () => {
  it("does not wait for a window that is destroyed before it answers", async () => {
    const { windows, floatApis, manager } = setup();
    manager.open(doc("/p/a.asm"));
    floatApis.get(1).saveAllBeforeQuit.mockReturnValue(new Promise(() => {}));
    const saving = manager.saveAllBeforeQuit();
    manager.setQuitting(true);
    windows[0].destroy();
    await expect(saving).resolves.toBe(true);
  });
});
