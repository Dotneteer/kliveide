import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CloseEditorAreaCommand,
  CloseEditorsInOtherAreasCommand,
  MoveEditorToNextAreaCommand,
  MoveEditorToPreviousAreaCommand,
  NavigateToDocumentCommand,
  SplitEditorDownCommand,
  SplitEditorRightCommand
} from "@renderer/appIde/commands/DocumentCommands";
import { createMockContext } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { setDocumentAreaCommandTarget } from "@renderer/features/documents/documentAreaCommandTarget";

// Type assertion helper for mock context
type MockIdeCommandContext = IdeCommandContext & {
  service: any;
  store: any;
};

type NavigateToDocumentCommandArgs = {
  filename: string;
  lineNo?: number;
  columnNo?: number;
};

describe("NavigateToDocumentCommand", () => {
  let command: NavigateToDocumentCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new NavigateToDocumentCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'nav'", () => {
      expect(command.id).toBe("nav");
    });

    it("should have correct description", () => {
      expect(command.description).toContain("Navigates");
      expect(command.description).toContain("document");
    });

    it("should have correct usage string", () => {
      expect(command.usage[0]).toContain("nav");
      expect(command.usage[0]).toContain("projectFile");
      expect(command.usage[0]).toContain("-r reason");
    });

    it("should have correct argumentInfo structure", () => {
      expect(command.argumentInfo).toBeDefined();
      expect(command.argumentInfo.mandatory).toBeDefined();
      expect(command.argumentInfo.mandatory[0].name).toBe("filename");
      expect(command.argumentInfo.optional).toBeDefined();
    });

    it("should have optional lineNo and columnNo arguments", () => {
      expect(command.argumentInfo.optional).toHaveLength(2);
      expect(command.argumentInfo.optional[0].name).toBe("lineNo");
      expect(command.argumentInfo.optional[1].name).toBe("columnNo");
    });
  });

  describe("execute", () => {
    it("should return error when no project is open", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({ project: { folderPath: undefined as any } });
      const args: NavigateToDocumentCommandArgs = { filename: "test.asm" };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("No project is open");
    });

    it("should return error when file not found in project", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({ project: { folderPath: "/test/project" } });
      const mockService = context.service as any;
      mockService.projectService.getNodeForFile.mockReturnValue(undefined);
      const args: NavigateToDocumentCommandArgs = { filename: "nonexistent.asm" };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("not found");
    });

    it("should navigate to file when document is already open", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({ project: { folderPath: "/test/project" } });
      
      const mockService = context.service as any;
      const mockNode = { data: { fullPath: "test.asm" } };
      mockService.projectService.getNodeForFile.mockReturnValue(mockNode);
      
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.getDocument.mockReturnValue({ id: "doc-1" });
      mockDocService.setActiveDocument.mockResolvedValue(undefined);
      mockDocService.waitOpen.mockResolvedValue({ id: "doc-1" });
      
      const args: NavigateToDocumentCommandArgs = { filename: "test.asm" };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(mockDocService.setActiveDocument).toHaveBeenCalledWith("doc-1");
      expect(result.success).toBe(true);
    });

    it("should open document when not already open", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({ project: { folderPath: "/test/project" } });
      
      const mockService = context.service as any;
      const mockNode = { data: { fullPath: "test.asm" } };
      mockService.projectService.getNodeForFile.mockReturnValue(mockNode);
      mockService.projectService.getDocumentForProjectNode.mockResolvedValue({ id: "new-doc" });
      
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.getDocument.mockReturnValue(undefined);
      mockDocService.openDocument.mockResolvedValue(undefined);
      mockDocService.waitOpen.mockResolvedValue({ id: "new-doc" });
      
      const args: NavigateToDocumentCommandArgs = { filename: "test.asm" };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(mockDocService.openDocument).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should navigate to specified line number", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({ project: { folderPath: "/test/project" } });
      
      const mockService = context.service as any;
      const mockNode = { data: { fullPath: "test.asm" } };
      mockService.projectService.getNodeForFile.mockReturnValue(mockNode);
      mockService.projectService.getDocumentForProjectNode.mockResolvedValue({ id: "new-doc" });
      
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.getDocument.mockReturnValue(undefined);
      mockDocService.openDocument.mockResolvedValue(undefined);
      mockDocService.waitOpen.mockResolvedValue({ id: "new-doc" });
      
      const mockApi = { setPosition: vi.fn() };
      mockDocService.getDocumentApi.mockReturnValue(mockApi);
      
      const args: NavigateToDocumentCommandArgs = { filename: "test.asm", lineNo: 10 };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(mockApi.setPosition).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should navigate to specified line and column", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({ project: { folderPath: "/test/project" } });
      
      const mockService = context.service as any;
      const mockNode = { data: { fullPath: "test.asm" } };
      mockService.projectService.getNodeForFile.mockReturnValue(mockNode);
      mockService.projectService.getDocumentForProjectNode.mockResolvedValue({ id: "new-doc" });
      
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.getDocument.mockReturnValue(undefined);
      mockDocService.openDocument.mockResolvedValue(undefined);
      mockDocService.waitOpen.mockResolvedValue({ id: "new-doc" });
      
      const mockApi = { setPosition: vi.fn() };
      mockDocService.getDocumentApi.mockReturnValue(mockApi);
      
      const args: NavigateToDocumentCommandArgs = { filename: "test.asm", lineNo: 10, columnNo: 5 };

      // Act
      await command.execute(context, args);

      // Assert
      expect(mockApi.setPosition).toHaveBeenCalledWith(10, 4);
    });

    it("should write success message with filename", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({ project: { folderPath: "/test/project" } });
      
      const mockService = context.service as any;
      const mockNode = { data: { fullPath: "test.asm" } };
      mockService.projectService.getNodeForFile.mockReturnValue(mockNode);
      mockService.projectService.getDocumentForProjectNode.mockResolvedValue({ id: "new-doc" });
      
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.getDocument.mockReturnValue(undefined);
      mockDocService.openDocument.mockResolvedValue(undefined);
      mockDocService.waitOpen.mockResolvedValue({ id: "new-doc" });
      
      const args: NavigateToDocumentCommandArgs = { filename: "test.asm" };

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("test.asm")
      );
    });

    it("should write success message with line and column if provided", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({ project: { folderPath: "/test/project" } });
      
      const mockService = context.service as any;
      const mockNode = { data: { fullPath: "test.asm" } };
      mockService.projectService.getNodeForFile.mockReturnValue(mockNode);
      mockService.projectService.getDocumentForProjectNode.mockResolvedValue({ id: "new-doc" });
      
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.getDocument.mockReturnValue(undefined);
      mockDocService.openDocument.mockResolvedValue(undefined);
      mockDocService.waitOpen.mockResolvedValue({ id: "new-doc" });
      
      const args: NavigateToDocumentCommandArgs = { filename: "test.asm", lineNo: 10, columnNo: 5 };

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("10:5")
      );
    });

    it("should call getNodeForFile with correct filename", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({ project: { folderPath: "/test/project" } });
      
      const mockService = context.service as any;
      const mockNode = { data: { fullPath: "test.asm" } };
      mockService.projectService.getNodeForFile.mockReturnValue(mockNode);
      mockService.projectService.getDocumentForProjectNode.mockResolvedValue({ id: "new-doc" });
      
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.getDocument.mockReturnValue(undefined);
      mockDocService.openDocument.mockResolvedValue(undefined);
      mockDocService.waitOpen.mockResolvedValue({ id: "new-doc" });
      
      const args: NavigateToDocumentCommandArgs = { filename: "myfile.asm" };

      // Act
      await command.execute(context, args);

      // Assert
      expect(mockService.projectService.getNodeForFile).toHaveBeenCalledWith("myfile.asm");
    });

    it("should return success when document is opened", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({ project: { folderPath: "/test/project" } });
      
      const mockService = context.service as any;
      const mockNode = { data: { fullPath: "test.asm" } };
      mockService.projectService.getNodeForFile.mockReturnValue(mockNode);
      mockService.projectService.getDocumentForProjectNode.mockResolvedValue({ id: "new-doc" });
      
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.getDocument.mockReturnValue(undefined);
      mockDocService.openDocument.mockResolvedValue(undefined);
      mockDocService.waitOpen.mockResolvedValue({ id: "new-doc" });
      
      const args: NavigateToDocumentCommandArgs = { filename: "test.asm" };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should handle missing document API gracefully", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({ project: { folderPath: "/test/project" } });
      
      const mockService = context.service as any;
      const mockNode = { data: { fullPath: "test.asm" } };
      mockService.projectService.getNodeForFile.mockReturnValue(mockNode);
      mockService.projectService.getDocumentForProjectNode.mockResolvedValue({ id: "new-doc" });
      
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.getDocument.mockReturnValue(undefined);
      mockDocService.openDocument.mockResolvedValue(undefined);
      mockDocService.waitOpen.mockResolvedValue({ id: "new-doc" });
      mockDocService.getDocumentApi.mockReturnValue(undefined);
      
      const args: NavigateToDocumentCommandArgs = { filename: "test.asm", lineNo: 10 };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should handle case where document is not fully opened", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({ project: { folderPath: "/test/project" } });
      
      const mockService = context.service as any;
      const mockNode = { data: { fullPath: "test.asm" } };
      mockService.projectService.getNodeForFile.mockReturnValue(mockNode);
      
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.getDocument.mockReturnValue(undefined);
      mockDocService.openDocument.mockResolvedValue(undefined);
      mockDocService.waitOpen.mockResolvedValue(undefined);
      
      const args: NavigateToDocumentCommandArgs = { filename: "test.asm" };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
    });
  });
});

describe("Document area commands", () => {
  it("split commands call the active document area target", async () => {
    const splitActiveArea = vi.fn(() => Promise.resolve());
    const cleanup = setDocumentAreaCommandTarget(createDocumentAreaTarget({ splitActiveArea }));

    try {
      expect(await new SplitEditorRightCommand().execute()).toEqual({ success: true });
      expect(await new SplitEditorDownCommand().execute()).toEqual({ success: true });

      expect(splitActiveArea).toHaveBeenCalledWith("horizontal");
      expect(splitActiveArea).toHaveBeenCalledWith("vertical");
    } finally {
      cleanup();
    }
  });

  it("move commands call the active document area target", async () => {
    const moveActiveDocumentToNextArea = vi.fn(() => Promise.resolve());
    const moveActiveDocumentToPreviousArea = vi.fn(() => Promise.resolve());
    const cleanup = setDocumentAreaCommandTarget(
      createDocumentAreaTarget({
        moveActiveDocumentToNextArea,
        moveActiveDocumentToPreviousArea
      })
    );

    try {
      expect(await new MoveEditorToNextAreaCommand().execute()).toEqual({ success: true });
      expect(await new MoveEditorToPreviousAreaCommand().execute()).toEqual({ success: true });

      expect(moveActiveDocumentToNextArea).toHaveBeenCalledTimes(1);
      expect(moveActiveDocumentToPreviousArea).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
    }
  });

  it("close commands call the active document area target", async () => {
    const closeActiveArea = vi.fn(() => Promise.resolve());
    const closeOtherAreas = vi.fn(() => Promise.resolve());
    const cleanup = setDocumentAreaCommandTarget(
      createDocumentAreaTarget({
        closeActiveArea,
        closeOtherAreas
      })
    );

    try {
      expect(await new CloseEditorAreaCommand().execute()).toEqual({ success: true });
      expect(await new CloseEditorsInOtherAreasCommand().execute()).toEqual({ success: true });

      expect(closeActiveArea).toHaveBeenCalledTimes(1);
      expect(closeOtherAreas).toHaveBeenCalledTimes(1);
    } finally {
      cleanup();
    }
  });

  it("returns an error when no document area target is available", async () => {
    const result = await new SplitEditorRightCommand().execute();

    expect(result.success).toBe(false);
    expect(result.finalMessage).toContain("No document area");
  });
});

function createDocumentAreaTarget(overrides: Record<string, unknown>) {
  return {
    closeActiveArea: vi.fn(() => Promise.resolve()),
    closeOtherAreas: vi.fn(() => Promise.resolve()),
    getActiveAreaState: vi.fn(() => ({
      hasActiveDocument: true,
      hasNextArea: true,
      hasPreviousArea: true
    })),
    splitActiveArea: vi.fn(() => Promise.resolve()),
    moveActiveDocumentToNextArea: vi.fn(() => Promise.resolve()),
    moveActiveDocumentToPreviousArea: vi.fn(() => Promise.resolve()),
    moveDocumentToArea: vi.fn(() => Promise.resolve()),
    ...overrides
  };
}

describe("NavigateToDocumentCommand navigation history (-r)", () => {
  let command: NavigateToDocumentCommand;
  let context: MockIdeCommandContext;
  let setPosition: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    command = new NavigateToDocumentCommand();
    context = createMockContext() as MockIdeCommandContext;
    context.store.getState.mockReturnValue({ project: { folderPath: "/test/project" } });
    context.service.projectService.getNodeForFile.mockReturnValue({ data: { fullPath: "test.asm" } });
    const docService = context.service.projectService.getActiveDocumentHubService();
    docService.getDocument.mockReturnValue({ id: "test.asm" });
    docService.waitOpen.mockResolvedValue({ id: "test.asm" });
    setPosition = vi.fn();
    docService.getDocumentApi.mockReturnValue({ setPosition });
  });

  it("declares -r as a named option", () => {
    expect(command.argumentInfo.namedOptions).toEqual([{ name: "-r", type: "string" }]);
  });

  it("records the jump when -r is given, moving the cursor inside the recorded jump", async () => {
    const history = context.service.navigationHistoryService;
    history.recordJump.mockImplementation(async (_reason: string, jump: () => Promise<void>) => {
      expect(setPosition).not.toHaveBeenCalled();
      await jump();
      expect(setPosition).toHaveBeenCalledWith(12, 4);
    });

    const result = await command.execute(context, {
      filename: "test.asm",
      lineNo: 12,
      columnNo: 5,
      "-r": "definition"
    } as any);

    expect(result.success).toBe(true);
    expect(history.recordJump).toHaveBeenCalledWith("definition", expect.any(Function));
    expect(setPosition).toHaveBeenCalledWith(12, 4);
  });

  it("waits for the editor API only when it has a cursor to move", async () => {
    // --- A viewer with no API (the NEX file viewer) used to hold every `nav` for the full timeout.
    const docService = context.service.projectService.getActiveDocumentHubService();
    await command.execute(context, { filename: "test.asm" });
    expect(docService.waitOpen).toHaveBeenLastCalledWith("test.asm", false);
    expect(setPosition).not.toHaveBeenCalled();

    await command.execute(context, { filename: "test.asm", lineNo: 3 });
    expect(docService.waitOpen).toHaveBeenLastCalledWith("test.asm", true);
    expect(setPosition).toHaveBeenCalledWith(3, 0);
  });

  it("does not record the jump without -r", async () => {
    await command.execute(context, { filename: "test.asm", lineNo: 12 });
    expect(context.service.navigationHistoryService.recordJump).not.toHaveBeenCalled();
    expect(setPosition).toHaveBeenCalledWith(12, 0);
  });

  it("accepts known reasons and rejects unknown ones", async () => {
    expect(
      await command.validateCommandArgs(context, { filename: "a.asm", "-r": "outputLink" } as any)
    ).toEqual([]);
    const messages = await command.validateCommandArgs(context, {
      filename: "a.asm",
      "-r": "whim"
    } as any);
    expect(messages).toHaveLength(1);
    expect(messages[0].message).toContain("whim");
  });
});
