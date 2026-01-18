import { describe, it, expect, vi, beforeEach } from "vitest";
import { OpenFolderCommand } from "@renderer/appIde/commands/OpenFolderCommand";
import { CloseFolderCommand } from "@renderer/appIde/commands/CloseFolderCommand";
import { ShellCommand } from "@renderer/appIde/commands/ShellCommand";
import { createMockContext } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";

// Type assertion helper for mock context
type MockIdeCommandContext = IdeCommandContext & {
  store: any;
  mainApi: any;
  service: any;
};

describe("OpenFolderCommand", () => {
  let command: OpenFolderCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new OpenFolderCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'open'", () => {
      expect(command.id).toBe("open");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("Opens a folder in the IDE");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toBe("open <project folder>");
    });

    it("should have alias 'op'", () => {
      expect(command.aliases).toEqual(["op"]);
    });
  });

  describe("execute", () => {
    it("should open folder when no project is open", async () => {
      // Arrange
      const args = { folder: "/test/project" };
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        project: { folderPath: undefined }
      });
      context.mainApi.openFolder.mockResolvedValue(undefined);

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(context.mainApi.openFolder).toHaveBeenCalledWith("/test/project");
      expect(result.success).toBe(true);
    });

    it("should display success message with folder path", async () => {
      // Arrange
      const args = { folder: "/test/project" };
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        project: { folderPath: undefined }
      });
      context.mainApi.openFolder.mockResolvedValue(undefined);

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const message = calls.map((call: any) => call[0]).join(" ");
      expect(message).toContain("/test/project");
      expect(message).toContain("opened");
    });

    it("should fail with error message from mainApi", async () => {
      // Arrange
      const args = { folder: "/test/project" };
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        project: { folderPath: undefined }
      });
      context.mainApi.openFolder.mockResolvedValue("Permission denied");

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("Error opening folder");
      expect(result.finalMessage).toContain("Permission denied");
    });

    it("should close existing folder before opening new one", async () => {
      // Arrange
      const args = { folder: "/test/new-project" };
      let stateHasProject = true;
      const mockStore = context.store as any;
      mockStore.getState.mockImplementation(() => ({
        project: { folderPath: stateHasProject ? "/test/old-project" : undefined as any }
      }));
      // Simulate state changing after close command
      mockStore.getState.mockImplementationOnce(() => ({
        project: { folderPath: "/test/old-project" }
      })).mockImplementationOnce(() => ({
        project: { folderPath: "/test/old-project" }
      })).mockImplementationOnce(() => ({
        project: { folderPath: undefined as any } // After delay, project is closed
      })).mockImplementation(() => ({
        project: { folderPath: undefined as any }
      }));
      
      context.mainApi.openFolder.mockResolvedValue(undefined);
      const mockIdService = {
        executeCommand: vi.fn()
      };
      (context.service as any).ideCommandsService = mockIdService;

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(mockIdService.executeCommand).toHaveBeenCalledWith(
        "close",
        context.output
      );
      expect(result.success).toBe(true);
    });

    it("should handle timeout when closing existing folder", async () => {
      // Arrange
      const args = { folder: "/test/new-project" };
      const mockStore = context.store as any;
      // Always return a folder path to simulate timeout
      mockStore.getState.mockReturnValue({
        project: { folderPath: "/test/old-project" }
      });
      const mockIdService = {
        executeCommand: vi.fn()
      };
      (context.service as any).ideCommandsService = mockIdService;

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("Timeout");
    });
  });
});

describe("CloseFolderCommand", () => {
  let command: CloseFolderCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new CloseFolderCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'close'", () => {
      expect(command.id).toBe("close");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("Closes the open IDE folder");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toBe("close");
    });
  });

  describe("execute", () => {
    it("should fail when no folder is open", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        project: { folderPath: undefined }
      });

      // Act
      const result = await command.execute(context);

      // Assert
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("No folder");
    });

    it("should dispatch action when folder is open", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        project: { folderPath: "/test/project" },
        dimMenu: false
      });
      const mockCloseAllDocuments = vi.fn();
      const mockProjectService = {
        performAllDelayedSavesNow: vi.fn().mockResolvedValue(undefined),
        getActiveDocumentHubService: vi.fn().mockReturnValue({
          closeAllDocuments: mockCloseAllDocuments
        })
      };
      (context.service as any).projectService = mockProjectService;
      context.emuApi.eraseAllBreakpoints = vi.fn();

      // Act
      const result = await command.execute(context);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should erase all breakpoints when folder is closed", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        project: { folderPath: "/test/project" },
        dimMenu: false
      });
      const mockProjectService = {
        performAllDelayedSavesNow: vi.fn().mockResolvedValue(undefined),
        getActiveDocumentHubService: vi.fn().mockReturnValue({
          closeAllDocuments: vi.fn()
        })
      };
      (context.service as any).projectService = mockProjectService;
      context.emuApi.eraseAllBreakpoints = vi.fn();

      // Act
      await command.execute(context);

      // Assert
      expect(context.emuApi.eraseAllBreakpoints).toHaveBeenCalled();
    });

    it("should dispatch close folder action", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        project: { folderPath: "/test/project" },
        dimMenu: false
      });
      const mockProjectService = {
        performAllDelayedSavesNow: vi.fn().mockResolvedValue(undefined),
        getActiveDocumentHubService: vi.fn().mockReturnValue({
          closeAllDocuments: vi.fn()
        })
      };
      (context.service as any).projectService = mockProjectService;
      context.emuApi.eraseAllBreakpoints = vi.fn();

      // Act
      await command.execute(context);

      // Assert
      expect(context.store.dispatch).toHaveBeenCalled();
    });
  });
});

describe("ShellCommand", () => {
  let command: ShellCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new ShellCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'sh'", () => {
      expect(command.id).toBe("sh");
    });

    it("should have correct description", () => {
      expect(command.description).toBe(
        "Opens a file in the shell with its associated program"
      );
    });

    it("should have correct usage string", () => {
      expect(command.usage).toBe("sh <filename>");
    });

    it("should have empty aliases", () => {
      expect(command.aliases).toEqual([]);
    });
  });

  describe("execute", () => {
    it("should open file with shell when successful", async () => {
      // Arrange
      const args = { filename: "/test/file.txt" };
      context.mainApi.openWithShell.mockResolvedValue({
        error: undefined,
        path: "/test/file.txt"
      });

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(context.mainApi.openWithShell).toHaveBeenCalledWith(
        "/test/file.txt"
      );
      expect(result.success).toBe(true);
    });

    it("should display success message with file path", async () => {
      // Arrange
      const args = { filename: "/test/file.txt" };
      context.mainApi.openWithShell.mockResolvedValue({
        error: undefined,
        path: "/test/file.txt"
      });

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const message = calls.map((call: any) => call[0]).join(" ");
      expect(message).toContain("Executing shell");
      expect(message).toContain("/test/file.txt");
    });

    it("should fail when shell returns error", async () => {
      // Arrange
      const args = { filename: "/test/file.txt" };
      context.mainApi.openWithShell.mockResolvedValue({
        error: "File not found",
        path: undefined
      });

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("File not found");
    });

    it("should handle exception from mainApi", async () => {
      // Arrange
      const args = { filename: "/test/file.txt" };
      context.mainApi.openWithShell.mockRejectedValue(
        new Error("Shell error")
      );

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("Shell error");
    });

    it("should handle absolute paths", async () => {
      // Arrange
      const args = { filename: "/absolute/path/to/file.pdf" };
      context.mainApi.openWithShell.mockResolvedValue({
        error: undefined,
        path: "/absolute/path/to/file.pdf"
      });

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(context.mainApi.openWithShell).toHaveBeenCalledWith(
        "/absolute/path/to/file.pdf"
      );
      expect(result.success).toBe(true);
    });

    it("should handle relative paths", async () => {
      // Arrange
      const args = { filename: "relative/file.txt" };
      context.mainApi.openWithShell.mockResolvedValue({
        error: undefined,
        path: "relative/file.txt"
      });

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(context.mainApi.openWithShell).toHaveBeenCalledWith(
        "relative/file.txt"
      );
      expect(result.success).toBe(true);
    });

    it("should handle files with special characters", async () => {
      // Arrange
      const args = { filename: "/test/file with spaces (1).txt" };
      context.mainApi.openWithShell.mockResolvedValue({
        error: undefined,
        path: "/test/file with spaces (1).txt"
      });

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(context.mainApi.openWithShell).toHaveBeenCalledWith(
        "/test/file with spaces (1).txt"
      );
      expect(result.success).toBe(true);
    });
  });
});
