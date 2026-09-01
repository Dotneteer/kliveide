import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("renderer IPC registration", () => {
  it("registers MainToIde once and unregisters the same listener", async () => {
    const ipcRenderer = createIpcRenderer();
    const { registerMainToIdeIpc } = await loadMainToIdeIpc({
      appServices: {}
    });

    const cleanup = registerMainToIdeIpc(ipcRenderer);
    const duplicateCleanup = registerMainToIdeIpc(ipcRenderer);

    expect(duplicateCleanup).toBe(cleanup);
    expect(ipcRenderer.on).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.on).toHaveBeenCalledWith("MainToIde", expect.any(Function));

    cleanup();

    expect(ipcRenderer.off).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.off).toHaveBeenCalledWith(
      "MainToIde",
      ipcRenderer.on.mock.calls[0][1]
    );
  });

  it("returns NotReady for MainToIde requests before services are cached", async () => {
    const ipcRenderer = createIpcRenderer();
    const { registerMainToIdeIpc, processMainToIdeMessages } = await loadMainToIdeIpc({
      appServices: undefined
    });

    registerMainToIdeIpc(ipcRenderer);
    await ipcRenderer.emit("MainToIde", { type: "ApiMethodRequest", correlationId: "ide-1" });

    expect(processMainToIdeMessages).not.toHaveBeenCalled();
    // --- The correlation ID must be echoed back, otherwise the sender cannot match the response
    // --- to its pending request and would wait forever instead of failing fast.
    expect(ipcRenderer.send).toHaveBeenCalledWith("MainToIdeResponse", {
      type: "NotReady",
      correlationId: "ide-1",
      sourceId: "ide"
    });
  });

  it("still applies forwarded state actions before services are cached", async () => {
    const ipcRenderer = createIpcRenderer();
    const store = {};
    const { registerMainToIdeIpc, processMainToIdeMessages } = await loadMainToIdeIpc({
      appServices: undefined,
      store
    });

    registerMainToIdeIpc(ipcRenderer);
    await ipcRenderer.emit("MainToIde", { type: "ForwardAction", correlationId: "ide-fwd" });

    // --- A forwarded action needs only the store. Rejecting it as "NotReady" would silently and
    // --- permanently drop the main process's initial state broadcast.
    expect(processMainToIdeMessages).toHaveBeenCalledWith(
      { type: "ForwardAction", correlationId: "ide-fwd" },
      store,
      undefined
    );
    expect(ipcRenderer.send).not.toHaveBeenCalledWith("MainToIdeResponse", {
      type: "NotReady",
      correlationId: "ide-fwd",
      sourceId: "ide"
    });
  });

  it("sends MainToIde processor responses with correlation and source", async () => {
    const ipcRenderer = createIpcRenderer();
    const store = {};
    const appServices = {};
    const { registerMainToIdeIpc, processMainToIdeMessages } = await loadMainToIdeIpc({
      appServices,
      store,
      processorResponse: { type: "DefaultResponse" }
    });

    registerMainToIdeIpc(ipcRenderer);
    await ipcRenderer.emit("MainToIde", { type: "ForwardAction", correlationId: "ide-2" });

    expect(processMainToIdeMessages).toHaveBeenCalledWith(
      { type: "ForwardAction", correlationId: "ide-2" },
      store,
      appServices
    );
    expect(ipcRenderer.send).toHaveBeenCalledWith("MainToIdeResponse", {
      type: "DefaultResponse",
      correlationId: "ide-2",
      sourceId: "ide"
    });
  });

  it("registers MainToEmu once and unregisters the same listener", async () => {
    const ipcRenderer = createIpcRenderer();
    const { registerMainToEmuIpc } = await loadMainToEmuIpc({
      appServices: {}
    });

    const cleanup = registerMainToEmuIpc(ipcRenderer);
    const duplicateCleanup = registerMainToEmuIpc(ipcRenderer);

    expect(duplicateCleanup).toBe(cleanup);
    expect(ipcRenderer.on).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.on).toHaveBeenCalledWith("MainToEmu", expect.any(Function));

    cleanup();

    expect(ipcRenderer.off).toHaveBeenCalledTimes(1);
    expect(ipcRenderer.off).toHaveBeenCalledWith(
      "MainToEmu",
      ipcRenderer.on.mock.calls[0][1]
    );
  });

  it("returns NotReady for MainToEmu requests before services are cached", async () => {
    const ipcRenderer = createIpcRenderer();
    const { registerMainToEmuIpc, processMainToEmuMessages } = await loadMainToEmuIpc({
      appServices: undefined
    });

    registerMainToEmuIpc(ipcRenderer);
    await ipcRenderer.emit("MainToEmu", { type: "ApiMethodRequest", correlationId: "emu-1" });

    expect(processMainToEmuMessages).not.toHaveBeenCalled();
    // --- The correlation ID must be echoed back, otherwise the sender cannot match the response
    // --- to its pending request and would wait forever instead of failing fast.
    expect(ipcRenderer.send).toHaveBeenCalledWith("MainToEmuResponse", {
      type: "NotReady",
      correlationId: "emu-1",
      sourceId: "emu"
    });
  });

  it("still applies forwarded state actions to EMU before services are cached", async () => {
    const ipcRenderer = createIpcRenderer();
    const store = {};
    const messenger = {};
    const { registerMainToEmuIpc, processMainToEmuMessages } = await loadMainToEmuIpc({
      appServices: undefined,
      messenger,
      store
    });

    registerMainToEmuIpc(ipcRenderer);
    await ipcRenderer.emit("MainToEmu", { type: "ForwardAction", correlationId: "emu-fwd" });

    // --- A forwarded action needs only the store, not the app services.
    expect(processMainToEmuMessages).toHaveBeenCalledWith(
      { type: "ForwardAction", correlationId: "emu-fwd" },
      store,
      messenger,
      undefined
    );
  });

  it("sends MainToEmu processor responses with correlation and source", async () => {
    const ipcRenderer = createIpcRenderer();
    const store = {};
    const messenger = {};
    const appServices = {};
    const { registerMainToEmuIpc, processMainToEmuMessages } = await loadMainToEmuIpc({
      appServices,
      messenger,
      store,
      processorResponse: { type: "DefaultResponse" }
    });

    registerMainToEmuIpc(ipcRenderer);
    await ipcRenderer.emit("MainToEmu", { type: "ForwardAction", correlationId: "emu-2" });

    expect(processMainToEmuMessages).toHaveBeenCalledWith(
      { type: "ForwardAction", correlationId: "emu-2" },
      store,
      messenger,
      appServices
    );
    expect(ipcRenderer.send).toHaveBeenCalledWith("MainToEmuResponse", {
      type: "DefaultResponse",
      correlationId: "emu-2",
      sourceId: "emu"
    });
  });
});

function createIpcRenderer() {
  const listeners = new Map<string, (...args: any[]) => void>();
  return {
    on: vi.fn((channel: string, listener: (...args: any[]) => void) => {
      listeners.set(channel, listener);
    }),
    off: vi.fn((channel: string, listener: (...args: any[]) => void) => {
      if (listeners.get(channel) === listener) {
        listeners.delete(channel);
      }
    }),
    send: vi.fn(),
    emit: async (channel: string, message: unknown) => {
      await listeners.get(channel)?.({}, message);
    }
  };
}

async function loadMainToIdeIpc({
  appServices,
  processorResponse = { type: "DefaultResponse" },
  store = {}
}: {
  appServices?: unknown;
  processorResponse?: unknown;
  store?: unknown;
}) {
  const processMainToIdeMessages = vi.fn(async () => processorResponse);
  vi.doMock("@renderer/CachedServices", () => ({
    getCachedAppServices: () => appServices,
    getCachedStore: () => store
  }));
  vi.doMock("@renderer/appIde/MainToIdeProcessor", () => ({
    processMainToIdeMessages
  }));

  const { registerMainToIdeIpc } = await import("@renderer/appIde/MainToIdeIpc");
  return { registerMainToIdeIpc, processMainToIdeMessages };
}

async function loadMainToEmuIpc({
  appServices,
  messenger = {},
  processorResponse = { type: "DefaultResponse" },
  store = {}
}: {
  appServices?: unknown;
  messenger?: unknown;
  processorResponse?: unknown;
  store?: unknown;
}) {
  const processMainToEmuMessages = vi.fn(async () => processorResponse);
  vi.doMock("@renderer/CachedServices", () => ({
    getCachedAppServices: () => appServices,
    getCachedMessenger: () => messenger,
    getCachedStore: () => store
  }));
  vi.doMock("@renderer/appEmu/MainToEmuProcessor", () => ({
    processMainToEmuMessages
  }));

  const { registerMainToEmuIpc } = await import("@renderer/appEmu/MainToEmuIpc");
  return { registerMainToEmuIpc, processMainToEmuMessages };
}
