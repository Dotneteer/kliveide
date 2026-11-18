import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the registry before importing ToolCommands
vi.mock("@renderer/registry", () => ({
  outputPaneRegistry: [
    { id: "output", name: "Output" },
    { id: "debug", name: "Debug" }
  ]
}));

// --- The reveal waits for a mounted view; here it records what it was asked to show
const revealWhenMounted = vi.fn(async () => true);
vi.mock("@renderer/appIde/navigation/addressNavigationAdapters", () => ({
  revealWhenMounted: (...args: unknown[]) => revealWhenMounted(...(args as []))
}));

import { spectrumPartitionInfo } from "@common/annotations/partitionInfo";
import {
  SelectOutputPaneCommand,
  ShowMemoryCommand,
  HideMemoryCommand,
  ShowDisassemblyCommand,
  HideDisassemblyCommand
} from "@renderer/appIde/commands/ToolCommands";
import { createMockContext } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";

// Type assertion helper for mock context
type MockIdeCommandContext = IdeCommandContext & {
  service: any;
  store: any;
  mainApi: any;
};

type SelectOutputArgs = {
  paneId: string;
};

describe("SelectOutputPaneCommand", () => {
  let command: SelectOutputPaneCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new SelectOutputPaneCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'outp'", () => {
      expect(command.id).toBe("outp");
    });

    it("should have correct description", () => {
      expect(command.description).toContain("output panel");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toContain("outp");
      expect(command.usage).toContain("<paneId>");
    });

    it("should have correct argumentInfo", () => {
      expect(command.argumentInfo).toBeDefined();
      expect(command.argumentInfo.mandatory).toHaveLength(1);
      expect(command.argumentInfo.mandatory[0].name).toBe("paneId");
    });
  });

  describe("execute", () => {
    it("should return error for unknown pane ID", async () => {
      // Arrange
      const args: SelectOutputArgs = { paneId: "unknown-pane" };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("Unknown output pane");
    });

    it("should call setGlobalSettingsValue to show tools", async () => {
      // Arrange
      const args: SelectOutputArgs = { paneId: "output" };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(context.mainApi.setGlobalSettingsValue).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should write success message with pane ID", async () => {
      // Arrange
      const args: SelectOutputArgs = { paneId: "output" };

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("output")
      );
    });

    it("should return commandSuccess", async () => {
      // Arrange
      const args: SelectOutputArgs = { paneId: "output" };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
    });
  });
});

describe("ShowMemoryCommand", () => {
  let command: ShowMemoryCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new ShowMemoryCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'show-memory'", () => {
      expect(command.id).toBe("show-memory");
    });

    it("should have correct description", () => {
      expect(command.description).toContain("memory panel");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toContain("show-memory [<address>");
      expect(command.usage).toContain("<partition>:<offset>");
    });

    it("should have alias 'shmem'", () => {
      expect(command.aliases).toEqual(["shmem"]);
    });
  });

  describe("execute", () => {
    it("should activate memory panel if already open", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.isOpen.mockReturnValue(true);
      mockDocService.setActiveDocument.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(mockDocService.setActiveDocument).toHaveBeenCalledWith("$memory");
      expect(result.success).toBe(true);
    });

    it("should open memory panel if not already open", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.isOpen.mockReturnValue(false);
      mockDocService.openDocument.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(mockDocService.openDocument).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("opens Memory only in the active document hub", async () => {
      const activeHub = {
        isOpen: vi.fn(() => false),
        openDocument: vi.fn().mockResolvedValue(undefined),
        setActiveDocument: vi.fn()
      };
      const inactiveHub = {
        isOpen: vi.fn(() => false),
        openDocument: vi.fn(),
        setActiveDocument: vi.fn()
      };
      (context.service.projectService.getActiveDocumentHubService as any).mockReturnValue(activeHub);

      await command.execute(context);

      expect(activeHub.openDocument).toHaveBeenCalledWith(
        expect.objectContaining({ id: "$memory" }),
        undefined,
        false
      );
      expect(inactiveHub.openDocument).not.toHaveBeenCalled();
      expect(inactiveHub.setActiveDocument).not.toHaveBeenCalled();
    });

    it("should not update a global visibility flag when opening", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.isOpen.mockReturnValue(false);
      mockDocService.openDocument.mockResolvedValue(undefined);

      // Act
      await command.execute(context);

      // Assert
      expect(context.store.dispatch).not.toHaveBeenCalled();
    });

    it("should return success", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.isOpen.mockReturnValue(true);
      mockDocService.setActiveDocument.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should open document with correct properties", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.isOpen.mockReturnValue(false);
      mockDocService.openDocument.mockResolvedValue(undefined);

      // Act
      await command.execute(context);

      // Assert
      const callArgs = (mockDocService.openDocument as any).mock.calls[0];
      expect(callArgs[0].name).toBe("Machine Memory");
      expect(callArgs[0].id).toBe("$memory");
    });
  });
});

describe("HideMemoryCommand", () => {
  let command: HideMemoryCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new HideMemoryCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'hide-memory'", () => {
      expect(command.id).toBe("hide-memory");
    });

    it("should have correct description", () => {
      expect(command.description).toContain("memory panel");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toBe("hide-memory");
    });

    it("should have alias 'hmem'", () => {
      expect(command.aliases).toEqual(["hmem"]);
    });
  });

  describe("execute", () => {
    it("should close memory panel", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.closeDocument.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(mockDocService.closeDocument).toHaveBeenCalledWith("$memory");
      expect(result.success).toBe(true);
    });

    it("closes Memory only in the active document hub", async () => {
      const activeHub = { closeDocument: vi.fn().mockResolvedValue(undefined) };
      const inactiveHub = { closeDocument: vi.fn() };
      (context.service.projectService.getActiveDocumentHubService as any).mockReturnValue(activeHub);

      await command.execute(context);

      expect(activeHub.closeDocument).toHaveBeenCalledWith("$memory");
      expect(inactiveHub.closeDocument).not.toHaveBeenCalled();
    });

    it("should not update a global visibility flag when closing", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.closeDocument.mockResolvedValue(undefined);

      // Act
      await command.execute(context);

      // Assert
      expect(context.store.dispatch).not.toHaveBeenCalled();
    });

    it("should return success", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.closeDocument.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(result.success).toBe(true);
    });
  });
});

describe("ShowDisassemblyCommand", () => {
  let command: ShowDisassemblyCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new ShowDisassemblyCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'show-disass'", () => {
      expect(command.id).toBe("show-disass");
    });

    it("should have correct description", () => {
      expect(command.description).toContain("disassembly panel");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toContain("show-disass [<address>");
      expect(command.usage).toContain("<label>");
    });

    it("should have alias 'shdis'", () => {
      expect(command.aliases).toEqual(["shdis"]);
    });
  });

  describe("execute", () => {
    it("should activate disassembly panel if already open", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.isOpen.mockReturnValue(true);
      mockDocService.setActiveDocument.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(mockDocService.setActiveDocument).toHaveBeenCalledWith("$disassembly");
      expect(result.success).toBe(true);
    });

    it("should open disassembly panel if not already open", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.isOpen.mockReturnValue(false);
      mockDocService.openDocument.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(mockDocService.openDocument).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should not update a global visibility flag when opening", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.isOpen.mockReturnValue(false);
      mockDocService.openDocument.mockResolvedValue(undefined);

      // Act
      await command.execute(context);

      // Assert
      expect(context.store.dispatch).not.toHaveBeenCalled();
    });

    it("should return success", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.isOpen.mockReturnValue(true);
      mockDocService.setActiveDocument.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should open document with correct properties", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.isOpen.mockReturnValue(false);
      mockDocService.openDocument.mockResolvedValue(undefined);

      // Act
      await command.execute(context);

      // Assert
      const callArgs = (mockDocService.openDocument as any).mock.calls[0];
      expect(callArgs[0].name).toBe("Disassembly");
      expect(callArgs[0].id).toBe("$disassembly");
    });
  });
});

describe("HideDisassemblyCommand", () => {
  let command: HideDisassemblyCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new HideDisassemblyCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'hide-disass'", () => {
      expect(command.id).toBe("hide-disass");
    });

    it("should have correct description", () => {
      expect(command.description).toContain("disassembly panel");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toBe("hide-disass");
    });

    it("should have alias 'hdis'", () => {
      expect(command.aliases).toEqual(["hdis"]);
    });
  });

  describe("execute", () => {
    it("should close disassembly panel", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.closeDocument.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(mockDocService.closeDocument).toHaveBeenCalledWith("$disassembly");
      expect(result.success).toBe(true);
    });

    it("should not update a global visibility flag when closing", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.closeDocument.mockResolvedValue(undefined);

      // Act
      await command.execute(context);

      // Assert
      expect(context.store.dispatch).not.toHaveBeenCalled();
    });

    it("should return success", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.closeDocument.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context);

      // Assert
      expect(result.success).toBe(true);
    });
  });
});

/*
 * `show-memory` and `show-disass` take the views' Go to language
 * (`dev/plans/MEMORY_DISASSEMBLY_VIEWS_PLAN.md` phase 6): a number, a register, a label, `PART:offset`.
 */
describe("show-memory and show-disass targets", () => {
  const labels = { [-2]: "R1", [-1]: "R0", 0: "B0", 2: "B2", 5: "B5", 7: "B7" };
  function targetContext() {
    const context = createMockContext() as MockIdeCommandContext;
    const emuApi = context.emuApi as any;
    emuApi.getPartitionLabels = vi.fn(async () => labels);
    emuApi.getPartitionInfo = vi.fn(async () => spectrumPartitionInfo({ labels }));
    emuApi.getMemoryContents = vi.fn(async () => ({
      pc: 0x8008,
      sp: 0xff3c,
      hl: 0x5812,
      de: 0x8020,
      bc: 0x0e00,
      ix: 0x5c3a,
      iy: 0x5c3a,
      slotPartitions: [-2, -2, 5, 5, 2, 2, 0, 0]
    }));
    const hub = (context.service as any).projectService.getActiveDocumentHubService();
    hub.isOpen.mockReturnValue(true);
    hub.setActiveDocument.mockResolvedValue(undefined);
    return context;
  }

  beforeEach(() => revealWhenMounted.mockClear());

  it("keeps a bare number decimal, as the command prompt reads numbers", async () => {
    await new ShowMemoryCommand().execute(targetContext(), { address: "32768" });
    expect(revealWhenMounted).toHaveBeenCalledWith(expect.anything(), "$memory", {
      kind: "address",
      address: 0x8000,
      fullView: true
    });
  });

  it("goes to a register's address", async () => {
    await new ShowMemoryCommand().execute(targetContext(), { address: "hl" });
    expect(revealWhenMounted).toHaveBeenCalledWith(expect.anything(), "$memory", expect.objectContaining({ address: 0x5812 }));
  });

  it("opens a partition at an offset in the Memory view", async () => {
    await new ShowMemoryCommand().execute(targetContext(), { address: "B7:$0010" });
    expect(revealWhenMounted).toHaveBeenCalledWith(expect.anything(), "$memory", {
      kind: "address",
      address: 0x10,
      segment: 7,
      fullView: false
    });
  });

  it("lists a partition in the Disassembly view at its Origin", async () => {
    // --- B2 is paged in at $8000: the listing's Origin
    await new ShowDisassemblyCommand().execute(targetContext(), { address: "b2:$10" });
    expect(revealWhenMounted).toHaveBeenCalledWith(expect.anything(), "$disassembly", {
      kind: "address",
      address: 0x8010,
      segment: 2,
      fullView: false,
      base: 0x8000
    });
    // --- B7 is not paged in: $0000
    await new ShowDisassemblyCommand().execute(targetContext(), { address: "B7:$10" });
    expect(revealWhenMounted).toHaveBeenLastCalledWith(expect.anything(), "$disassembly", expect.objectContaining({ address: 0x10, base: 0 }));
  });

  it("refuses an unknown partition or name", async () => {
    const result = await new ShowMemoryCommand().execute(targetContext(), { address: "Q9:0" });
    expect(result.success).toBe(false);
    expect(revealWhenMounted).not.toHaveBeenCalled();
    const unknown = await new ShowDisassemblyCommand().execute(targetContext(), { address: "no_such_label" });
    expect(unknown.success).toBe(false);
  });
});
