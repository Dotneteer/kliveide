import { describe, expect, it, vi } from "vitest";

import {
  createStaticDumpNavigationAdapter,
  disassemblyNavigationAdapter,
  memoryNavigationAdapter,
  parseNexBankDocumentId,
  REVEAL_API_TIMEOUT_MS
} from "@renderer/appIde/navigation/addressNavigationAdapters";
import { fileDocumentNavigationAdapter } from "@renderer/appIde/navigation/fileDocumentNavigationAdapter";

const at = (address: number, extra: Record<string, unknown> = {}) =>
  ({ kind: "address", address, ...extra }) as any;

function entry(documentId: string, locator: any, documentType = "Memory") {
  return { documentId, documentType, title: documentId, locator, reason: "memoryGoTo", time: 0 } as any;
}

/** A hub holding documents by id, with view states and APIs the test can set. */
function fakeHub(hubId = 0, openIds: string[] = []) {
  const open = new Set(openIds);
  const viewStates = new Map<string, any>();
  const apis = new Map<string, any>();
  return {
    hubId,
    open,
    viewStates,
    apis,
    isOpen: (id: string) => open.has(id),
    getDocumentViewState: (id: string) => viewStates.get(id),
    setDocumentViewState: vi.fn((id: string, vs: any) => viewStates.set(id, vs)),
    setActiveDocument: vi.fn(async (_id: string) => {}),
    waitOpen: vi.fn(async (id: string) => (open.has(id) ? { id } : null)),
    getDocumentApi: (id: string) => apis.get(id)
  } as any;
}

function services(hub: any, others: any[] = [], executeCommand = vi.fn(async () => ({ success: true }))) {
  let active = others[0] ?? hub;
  return {
    ideCommandsService: { executeCommand },
    projectService: {
      getActiveDocumentHubService: () => active,
      setActiveDocumentHubService: vi.fn((h: any) => (active = h)),
      getDocumentHubServiceInstances: () => [hub, ...others]
    }
  } as any;
}

const env = (readBinaryFile = vi.fn(async () => new Uint8Array(0))) =>
  ({ store: { getState: () => ({ project: { folderPath: "/project" } }) }, readBinaryFile }) as any;

describe("Memory and Disassembly navigation adapters", () => {
  it("capture a panel that is not mounted from its saved view state", () => {
    const hub = fakeHub();
    hub.viewStates.set("$memory", { topIndex: 0x5b, viewMode: "8x2", currentSegment: 5, isFullView: false });
    expect(memoryNavigationAdapter.capture({ id: "$memory" } as any, hub)).toEqual({
      kind: "address",
      address: 0x5b0,
      segment: 5,
      fullView: false,
      viewMode: "memory"
    });
    // --- An 8-bytes-per-row view counts rows of 8.
    hub.viewStates.set("$memory", { topIndex: 0x10, viewMode: "8x1" });
    expect(memoryNavigationAdapter.capture({ id: "$memory" } as any, hub)).toMatchObject({ address: 0x80 });

    hub.viewStates.set("$disassembly", { topAddress: 0x8000 });
    expect(disassemblyNavigationAdapter.capture({ id: "$disassembly" } as any, hub)).toEqual({
      kind: "address",
      address: 0x8000,
      segment: 0,
      fullView: true,
      viewMode: "disassembly"
    });
  });

  it("treat a screenful in the same segment as one place", () => {
    expect(memoryNavigationAdapter.isNear(at(0x8000), at(0x80f0))).toBe(true);
    expect(memoryNavigationAdapter.isNear(at(0x8000), at(0x8100))).toBe(false);
    expect(memoryNavigationAdapter.isNear(at(0x10, { fullView: false, segment: 2 }), at(0x10, { fullView: false, segment: 3 }))).toBe(false);
    expect(memoryNavigationAdapter.isNear(at(0x10, { fullView: true }), at(0x10, { fullView: false }))).toBe(false);
    expect(disassemblyNavigationAdapter.isNear(at(0x8000), at(0x807f))).toBe(true);
    expect(disassemblyNavigationAdapter.isNear(at(0x8000), at(0x8080))).toBe(false);
  });

  it("describe the address, and the segment when not showing the whole 64K", () => {
    expect(memoryNavigationAdapter.describe(entry("$memory", at(0x5b00)))).toBe("$5B00");
    expect(memoryNavigationAdapter.describe(entry("$memory", at(0x0010, { fullView: false, segment: 7 })))).toBe(
      "$0010 · segment 7"
    );
  });

  it("restore by showing the panel in the chosen area and asking its view to reveal", async () => {
    const hub = fakeHub(1, ["$memory"]);
    const revealLocator = vi.fn();
    hub.apis.set("$memory", { revealLocator });
    const other = fakeHub(0);
    const s = services(hub, [other]);

    const locator = at(0x5b00, { segment: null, fullView: true });
    expect(await memoryNavigationAdapter.restore(entry("$memory", locator), hub, s, env())).toBe(true);
    expect(s.projectService.setActiveDocumentHubService).toHaveBeenCalledWith(hub);
    expect(s.ideCommandsService.executeCommand).toHaveBeenCalledWith("show-memory");
    expect(revealLocator).toHaveBeenCalledWith(locator);
  });

  it("fail the restore when the panel never registers a way to reveal", async () => {
    vi.useFakeTimers();
    try {
      const hub = fakeHub(0, ["$disassembly"]);
      const pending = disassemblyNavigationAdapter.restore(entry("$disassembly", at(1)), hub, services(hub), env());
      await vi.advanceTimersByTimeAsync(REVEAL_API_TIMEOUT_MS + 100);
      expect(await pending).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("wait for a panel's view to mount and register its API before revealing", async () => {
    // --- Regression: `IDocumentHubService.waitOpen` answers from the project's file cache, which
    // --- never holds these views, so it reported an open, ready panel as not open.
    const hub = fakeHub(0, ["$memory"]);
    hub.waitOpen.mockResolvedValue(undefined);
    const revealLocator = vi.fn();
    setTimeout(() => hub.apis.set("$memory", { revealLocator }), 120);

    expect(await memoryNavigationAdapter.restore(entry("$memory", at(0x10)), hub, services(hub), env())).toBe(true);
    expect(revealLocator).toHaveBeenCalledWith(at(0x10));
  });
});

describe("static dump navigation adapter", () => {
  const bankId = "memoryDump-bankDump/project/build/Game.nex:12";

  function adapter() {
    const openStaticMemoryDump = vi.fn(async () => {});
    const readNexBankBytes = vi.fn(async () => new Uint8Array([1, 2, 3]));
    return {
      openStaticMemoryDump,
      readNexBankBytes,
      adapter: createStaticDumpNavigationAdapter({ openStaticMemoryDump, readNexBankBytes })
    };
  }

  it("reads the NEX file and bank a bank document was opened for from its id", () => {
    expect(parseNexBankDocumentId(bankId)).toEqual({ path: "/project/build/Game.nex", bank: 12 });
    expect(parseNexBankDocumentId("memoryDump-bankDumpC:\\Games\\A.nex:5")).toEqual({ path: "C:\\Games\\A.nex", bank: 5 });
    expect(parseNexBankDocumentId("memoryDump-layer2ScreenDump/p/A.nex")).toBeUndefined();
  });

  it("captures a dump that is not mounted from its view state", () => {
    const hub = fakeHub();
    hub.viewStates.set(bankId, { topAddress: 0xc240, viewMode: "disassembly", disassOffset: 0xc000 });
    expect(adapter().adapter.capture({ id: bankId } as any, hub)).toEqual({
      kind: "address",
      address: 0xc240,
      viewMode: "disassembly",
      base: 0xc000
    });
  });

  it("returns to an open dump: points its view state there, activates it, reveals", async () => {
    const { adapter: a, openStaticMemoryDump } = adapter();
    const hub = fakeHub(0, [bankId]);
    hub.viewStates.set(bankId, { disassOffset: 0xc000, decimalView: true });
    const revealLocator = vi.fn();
    hub.apis.set(bankId, { revealLocator });
    const locator = at(0xc240, { viewMode: "memory", base: 0xc000 });

    expect(await a.restore(entry(bankId, locator, "StaticMemoryDumpViewer"), hub, services(hub), env())).toBe(true);
    expect(hub.viewStates.get(bankId)).toEqual({ disassOffset: 0xc000, decimalView: true, topAddress: 0xc240, viewMode: "memory" });
    expect(hub.setActiveDocument).toHaveBeenCalledWith(bankId);
    expect(revealLocator).toHaveBeenCalledWith(locator);
    expect(openStaticMemoryDump).not.toHaveBeenCalled();
  });

  it("finds an open dump in another area", async () => {
    const { adapter: a } = adapter();
    const recorded = fakeHub(0);
    const holder = fakeHub(1, [bankId]);
    holder.apis.set(bankId, { revealLocator: vi.fn() });
    const s = services(recorded, [holder]);
    expect(await a.restore(entry(bankId, at(0xc000), "StaticMemoryDumpViewer"), recorded, s, env())).toBe(true);
    expect(holder.setActiveDocument).toHaveBeenCalledWith(bankId);
  });

  it("reopens a closed NEX bank from the file, where and how it was left", async () => {
    const { adapter: a, openStaticMemoryDump, readNexBankBytes } = adapter();
    const hub = fakeHub(0);
    const readBinaryFile = vi.fn(async () => new Uint8Array(0));

    const ok = await a.restore(
      entry(bankId, at(0xc240, { viewMode: "disassembly", base: 0xc000 }), "StaticMemoryDumpViewer"),
      hub,
      services(hub),
      env(readBinaryFile)
    );

    expect(ok).toBe(true);
    expect(readNexBankBytes).toHaveBeenCalledWith("/project/build/Game.nex", 12, readBinaryFile);
    expect(openStaticMemoryDump).toHaveBeenCalledWith(
      hub,
      "bankDump/project/build/Game.nex:12",
      "build/Game.nex - Bank: 12",
      new Uint8Array([1, 2, 3]),
      {
        disassemblyEnabled: true,
        disassOffset: 0xc000,
        nexAnnotationPath: "/project/build/Game.nex.dis",
        nexAnnotationBank: 12,
        topAddress: 0xc240,
        viewMode: "disassembly"
      }
    );
  });

  it("cannot reopen a closed dump that is not a NEX bank, or a bank the file no longer has", async () => {
    const { adapter: a, readNexBankBytes } = adapter();
    const hub = fakeHub(0);
    expect(await a.restore(entry("memoryDump-z80Dump/p/a.z80:0", at(0)), hub, services(hub), env())).toBe(false);

    readNexBankBytes.mockResolvedValueOnce(undefined);
    expect(await a.restore(entry(bankId, at(0)), hub, services(hub), env())).toBe(false);

    readNexBankBytes.mockRejectedValueOnce(new Error("gone"));
    expect(await a.restore(entry(bankId, at(0)), hub, services(hub), env())).toBe(false);
  });

  it("treats addresses within $40 as one place, whatever the listing", () => {
    const { adapter: a } = adapter();
    expect(a.isNear(at(0xc000, { viewMode: "memory" }), at(0xc03f, { viewMode: "disassembly" }))).toBe(true);
    expect(a.isNear(at(0xc000), at(0xc040))).toBe(false);
    expect(a.describe(entry(bankId, at(0xc240, { viewMode: "disassembly" })))).toBe("$C240 · disassembly");
  });
});

describe("file document navigation adapter", () => {
  it("is one place per file, restored through nav", async () => {
    const hub = fakeHub(0);
    const s = services(hub);
    expect(fileDocumentNavigationAdapter.capture({} as any, hub)).toEqual({ kind: "document" });
    expect(fileDocumentNavigationAdapter.isNear({ kind: "document" }, { kind: "document" })).toBe(true);
    expect(await fileDocumentNavigationAdapter.restore(entry("/p/Game.nex", { kind: "document" }), hub, s, env())).toBe(true);
    expect(s.ideCommandsService.executeCommand).toHaveBeenCalledWith('nav "/p/Game.nex"');
  });
});
