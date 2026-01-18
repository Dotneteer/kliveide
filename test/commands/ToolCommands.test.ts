import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the registry before importing ToolCommands
vi.mock("@renderer/registry", () => ({
  outputPaneRegistry: [
    { id: "output", name: "Output" },
    { id: "debug", name: "Debug" }
  ]
}));

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
      expect(command.usage).toBe("show-memory");
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

    it("should dispatch setVolatileDocStateAction when opening", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.isOpen.mockReturnValue(false);
      mockDocService.openDocument.mockResolvedValue(undefined);

      // Act
      await command.execute(context);

      // Assert
      expect(context.store.dispatch).toHaveBeenCalled();
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

    it("should dispatch setVolatileDocStateAction when closing", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.closeDocument.mockResolvedValue(undefined);

      // Act
      await command.execute(context);

      // Assert
      expect(context.store.dispatch).toHaveBeenCalled();
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
      expect(command.usage).toBe("show-disass");
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

    it("should dispatch setVolatileDocStateAction when opening", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.isOpen.mockReturnValue(false);
      mockDocService.openDocument.mockResolvedValue(undefined);

      // Act
      await command.execute(context);

      // Assert
      expect(context.store.dispatch).toHaveBeenCalled();
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

    it("should dispatch setVolatileDocStateAction when closing", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.closeDocument.mockResolvedValue(undefined);

      // Act
      await command.execute(context);

      // Assert
      expect(context.store.dispatch).toHaveBeenCalled();
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
