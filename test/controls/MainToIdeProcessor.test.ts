import { describe, expect, it, vi } from "vitest";
import { processMainToIdeMessages } from "@renderer/appIde/MainToIdeProcessor";

function createHarness() {
  const activeHub = {
    closeDocument: vi.fn().mockResolvedValue(undefined),
    isOpen: vi.fn(() => false),
    openDocument: vi.fn().mockResolvedValue(undefined),
    setActiveDocument: vi.fn().mockResolvedValue(undefined)
  };
  const inactiveHub = {
    closeDocument: vi.fn(),
    isOpen: vi.fn(),
    openDocument: vi.fn(),
    setActiveDocument: vi.fn()
  };
  const executeCommand = vi.fn().mockResolvedValue({ success: true });
  const services = {
    ideCommandsService: { executeCommand },
    outputPaneService: { getOutputPaneBuffer: vi.fn() },
    projectService: {
      getActiveDocumentHubService: vi.fn(() => activeHub),
      getDocumentHubServiceInstances: vi.fn(() => []),
      performAllDelayedSavesNow: vi.fn().mockResolvedValue(undefined)
    },
    scriptService: { getScriptOutputBuffer: vi.fn() }
  };
  const store = { dispatch: vi.fn(), getState: vi.fn(() => ({ dimMenu: false })) };

  const invoke = (method: string, ...args: unknown[]) =>
    processMainToIdeMessages(
      { type: "ApiMethodRequest", method, args } as never,
      store as never,
      services as never
    );

  return { activeHub, executeCommand, inactiveHub, invoke, services, store };
}

describe("MainToIde special-document visibility", () => {
  it("uses the command path for Memory and Disassembly visibility", async () => {
    const { executeCommand, invoke } = createHarness();

    await invoke("showMemory", true);
    await invoke("showMemory", false);
    await invoke("showDisassembly", true);
    await invoke("showDisassembly", false);

    expect(executeCommand).toHaveBeenNthCalledWith(1, "show-memory");
    expect(executeCommand).toHaveBeenNthCalledWith(2, "hide-memory");
    expect(executeCommand).toHaveBeenNthCalledWith(3, "show-disass");
    expect(executeCommand).toHaveBeenNthCalledWith(4, "hide-disass");
  });

  it("opens BASIC in the active hub and waits for the open operation", async () => {
    const { activeHub, inactiveHub, invoke } = createHarness();
    let resolveOpen: (() => void) | undefined;
    activeHub.openDocument.mockImplementation(
      () => new Promise<void>((resolve) => (resolveOpen = resolve))
    );
    let completed = false;
    const request = invoke("showBasic", true).then(() => {
      completed = true;
    });

    await Promise.resolve();

    expect(activeHub.openDocument).toHaveBeenCalledWith(
      expect.objectContaining({ id: "$basic", name: "BASIC Listing" }),
      undefined,
      false
    );
    expect(inactiveHub.openDocument).not.toHaveBeenCalled();
    expect(completed).toBe(false);

    resolveOpen?.();
    await request;
    expect(completed).toBe(true);
  });

  it("activates an existing BASIC tab and closes only the active hub copy", async () => {
    const { activeHub, inactiveHub, invoke } = createHarness();
    activeHub.isOpen.mockReturnValue(true);

    await invoke("showBasic", true);
    await invoke("showBasic", false);

    expect(activeHub.setActiveDocument).toHaveBeenCalledWith("$basic");
    expect(activeHub.openDocument).not.toHaveBeenCalled();
    expect(activeHub.closeDocument).toHaveBeenCalledWith("$basic");
    expect(inactiveHub.setActiveDocument).not.toHaveBeenCalled();
    expect(inactiveHub.closeDocument).not.toHaveBeenCalled();
  });
});

describe("MainToIde shutdown preparation", () => {
  it("saves delayed files and allows shutdown when all document hubs can close", async () => {
    const { invoke, services } = createHarness();
    const firstHub = {
      canCloseAllDocuments: vi.fn().mockResolvedValue(true)
    };
    const secondHub = {
      canCloseAllDocuments: vi.fn().mockResolvedValue(true)
    };
    services.projectService.getDocumentHubServiceInstances.mockReturnValue([
      firstHub,
      secondHub
    ]);

    const response = await invoke("saveAllBeforeQuit");

    expect(response).toEqual(expect.objectContaining({
      type: "ApiMethodResponse",
      result: true
    }));
    expect(services.projectService.performAllDelayedSavesNow).toHaveBeenCalledTimes(1);
    expect(firstHub.canCloseAllDocuments).toHaveBeenCalledTimes(1);
    expect(secondHub.canCloseAllDocuments).toHaveBeenCalledTimes(1);
  });

  it("blocks shutdown when any document hub vetoes close", async () => {
    const { invoke, services } = createHarness();
    services.projectService.getDocumentHubServiceInstances.mockReturnValue([
      {
        canCloseAllDocuments: vi.fn().mockResolvedValue(true)
      },
      {
        canCloseAllDocuments: vi.fn().mockResolvedValue(false)
      }
    ]);

    const response = await invoke("saveAllBeforeQuit");

    expect(response).toEqual(expect.objectContaining({
      type: "ApiMethodResponse",
      result: false
    }));
  });
});
