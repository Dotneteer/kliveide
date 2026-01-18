import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ProjectListExcludedItemsCommand,
  ProjectExcludeItemsCommand
} from "@renderer/appIde/commands/ProjectExcludedItemsCommand";
import { createMockContext, createMockContextWithProject } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";

// Type assertion helper for mock context
type MockIdeCommandContext = IdeCommandContext & {
  service: any;
  store: any;
  mainApi: any;
  messenger: any;
  messageSource: any;
};

type ListExcludedItemArgs = {
  "-global"?: boolean;
};

type ExcludeItemArgs = {
  "-global"?: boolean;
  "-d"?: boolean;
  itemPath: string;
  rest: string[];
};

describe("ProjectExcludedItemsCommand", () => {
  let context: MockIdeCommandContext;

  describe("ProjectListExcludedItemsCommand", () => {
    let command: ProjectListExcludedItemsCommand;

    beforeEach(() => {
      command = new ProjectListExcludedItemsCommand();
      context = createMockContextWithProject("/test/project") as MockIdeCommandContext;
      vi.clearAllMocks();
    });

    describe("Command Metadata", () => {
      it("should have id 'project:excluded-items'", () => {
        expect(command.id).toBe("project:excluded-items");
      });

      it("should have correct description", () => {
        expect(command.description).toContain("Lists the paths of items currently excluded");
      });

      it("should have correct usage string", () => {
        expect(command.usage).toBe("project:excluded-items [-global]");
      });

      it("should have correct aliases", () => {
        expect(command.aliases).toContain("project:list-excluded");
        expect(command.aliases).toContain("proj:excluded-items");
        expect(command.aliases).toContain("proj:list-excluded");
        expect(command.aliases).toContain("p:lx");
      });

      it("should have -global command option", () => {
        expect(command.argumentInfo.commandOptions).toContain("-global");
      });
    });

    describe("execute", () => {
      it("should list project excluded items", async () => {
        // Arrange
        const mockStore = context.store as any;
        mockStore.getState.mockReturnValue({
          project: {
            isKliveProject: true,
            excludedItems: ["node_modules", "build"]
          }
        });

        const args: ListExcludedItemArgs = {};

        // Act
        const result = await command.execute(context, args);

        // Assert
        expect(result.success).toBe(true);
        expect(context.output.writeLine).toHaveBeenCalledWith(
          expect.stringContaining("Excluded items:")
        );
        expect(context.output.writeLine).toHaveBeenCalledWith(
          expect.stringContaining("node_modules")
        );
        expect(context.output.writeLine).toHaveBeenCalledWith(
          expect.stringContaining("build")
        );
      });

      it("should display info when no excluded items exist", async () => {
        // Arrange
        const mockStore = context.store as any;
        mockStore.getState.mockReturnValue({
          project: {
            excludedItems: []
          }
        });

        const args: ListExcludedItemArgs = {};

        // Act
        const result = await command.execute(context, args);

        // Assert
        expect(result.success).toBe(true);
        expect(context.output.writeLine).toHaveBeenCalledWith(
          expect.stringContaining("no excluded items")
        );
      });

      it("should list global excluded items when -global flag is set", async () => {
        // Arrange
        const mockMessenger = context.messenger as any;
        mockMessenger.sendMessage = vi.fn().mockResolvedValue({
          type: "ApiMethodResponse",
          result: "/home/user/.vscode:/home/user/.git"
        });

        const args: ListExcludedItemArgs = { "-global": true };

        // Act
        const result = await command.execute(context, args);

        // Assert
        expect(result.success).toBe(true);
      });

      it("should handle empty project excluded items list", async () => {
        // Arrange
        const mockStore = context.store as any;
        mockStore.getState.mockReturnValue({
          project: {
            excludedItems: undefined
          }
        });

        const args: ListExcludedItemArgs = {};

        // Act
        const result = await command.execute(context, args);

        // Assert
        expect(result.success).toBe(true);
      });
    });
  });

  describe("ProjectExcludeItemsCommand", () => {
    let command: ProjectExcludeItemsCommand;

    beforeEach(() => {
      command = new ProjectExcludeItemsCommand();
      context = createMockContextWithProject("/test/project") as MockIdeCommandContext;
      context.messageSource = "test";

      const mockService = context.service as any;
      mockService.validationService = {
        isValidPath: vi.fn().mockReturnValue(true)
      };

      vi.clearAllMocks();
    });

    describe("Command Metadata", () => {
      it("should have id 'project:exclude-item'", () => {
        expect(command.id).toBe("project:exclude-item");
      });

      it("should have correct description", () => {
        expect(command.description).toContain("Exclude/restore an item");
      });

      it("should have correct usage string", () => {
        expect(command.usage).toBe("project:exclude-item [-global] [-d] <item-path>...");
      });

      it("should have correct aliases", () => {
        expect(command.aliases).toContain("project:exclude");
        expect(command.aliases).toContain("proj:exclude-item");
        expect(command.aliases).toContain("proj:exclude");
        expect(command.aliases).toContain("p:x");
      });

      it("should have -global and -d command options", () => {
        expect(command.argumentInfo.commandOptions).toContain("-global");
        expect(command.argumentInfo.commandOptions).toContain("-d");
      });

      it("should allow rest arguments", () => {
        expect(command.argumentInfo.allowRest).toBe(true);
      });
    });

    describe("execute", () => {
      it("should exclude project item", async () => {
        // Arrange
        const mockStore = context.store as any;
        mockStore.getState.mockReturnValue({
          project: {
            isKliveProject: true,
            excludedItems: [],
            buildRoots: ["src/main.asm"]
          }
        });

        mockStore.dispatch = vi.fn();

        const mockMessenger = context.messenger as any;
        mockMessenger.sendMessage = vi.fn().mockResolvedValue({ success: true });

        const args: ExcludeItemArgs = {
          itemPath: "node_modules",
          rest: ["node_modules"]
        };

        // Act
        const result = await command.execute(context, args);

        // Assert
        expect(result.success).toBe(true);
        expect(mockStore.dispatch).toHaveBeenCalled();
      });

      it("should return error when no project is open", async () => {
        // Arrange
        context = createMockContext() as MockIdeCommandContext;
        const mockStore = context.store as any;
        mockStore.getState.mockReturnValue({
          project: {
            isKliveProject: false
          }
        });

        const args: ExcludeItemArgs = {
          itemPath: "test",
          rest: ["test"]
        };

        // Act
        const result = await command.execute(context, args);

        // Assert
        expect(result.success).toBe(false);
        expect(result.finalMessage).toContain("open the project");
      });

      it("should exclude multiple items", async () => {
        // Arrange
        const mockStore = context.store as any;
        mockStore.getState.mockReturnValue({
          project: {
            isKliveProject: true,
            excludedItems: [],
            buildRoots: ["src/main.asm"]
          }
        });

        mockStore.dispatch = vi.fn();

        const args: ExcludeItemArgs = {
          itemPath: "item1",
          rest: ["item1", "item2", "item3"]
        };

        // Act
        const result = await command.execute(context, args);

        // Assert
        expect(result.success).toBe(true);
      });

      it("should restore excluded item with -d flag", async () => {
        // Arrange
        const mockStore = context.store as any;
        mockStore.getState.mockReturnValue({
          project: {
            isKliveProject: true,
            excludedItems: ["node_modules", "build"],
            buildRoots: ["src/main.asm"]
          }
        });

        mockStore.dispatch = vi.fn();

        const args: ExcludeItemArgs = {
          "-d": true,
          itemPath: "node_modules",
          rest: ["node_modules"]
        };

        // Act
        const result = await command.execute(context, args);

        // Assert
        expect(result.success).toBe(true);
        expect(mockStore.dispatch).toHaveBeenCalled();
      });

      it("should handle invalid path validation", async () => {
        // Arrange
        const mockService = context.service as any;
        mockService.validationService.isValidPath = vi.fn().mockReturnValue(false);

        const mockStore = context.store as any;
        mockStore.getState.mockReturnValue({
          project: {
            isKliveProject: true,
            excludedItems: [],
            buildRoots: ["src/main.asm"]
          }
        });

        const args: ExcludeItemArgs = {
          itemPath: "invalid\\path",
          rest: ["invalid\\path"]
        };

        // Act
        const result = await command.execute(context, args);

        // Assert
        expect(result.success).toBe(true);
        expect(context.output.writeLine).toHaveBeenCalledWith(
          expect.stringContaining("not a valid path")
        );
      });

      it("should exclude global items with -global flag", async () => {
        // Arrange
        const mockMainApi = context.mainApi as any;
        mockMainApi.addGlobalExcludedProjectItem = vi.fn().mockResolvedValue(undefined);

        const mockStore = context.store as any;
        mockStore.getState.mockReturnValue({
          project: {
            isKliveProject: true
          }
        });

        const args: ExcludeItemArgs = {
          "-global": true,
          itemPath: "/home/user/.vscode",
          rest: ["/home/user/.vscode"]
        };

        // Act
        const result = await command.execute(context, args);

        // Assert
        expect(result.success).toBe(true);
        expect(mockMainApi.addGlobalExcludedProjectItem).toHaveBeenCalled();
      });

      it("should restore global items with -global and -d flags", async () => {
        // Arrange
        const mockMainApi = context.mainApi as any;
        mockMainApi.setGloballyExcludedProjectItems = vi.fn().mockResolvedValue(undefined);

        const mockMessenger = context.messenger as any;
        mockMessenger.sendMessage = vi.fn().mockResolvedValue({
          type: "ApiMethodResponse",
          result: "/home/user/.vscode:/home/user/.git"
        });

        const mockStore = context.store as any;
        mockStore.getState.mockReturnValue({
          project: {
            isKliveProject: true
          }
        });

        const args: ExcludeItemArgs = {
          "-global": true,
          "-d": true,
          itemPath: "/home/user/.vscode",
          rest: ["/home/user/.vscode"]
        };

        // Act
        const result = await command.execute(context, args);

        // Assert
        expect(result.success).toBe(true);
      });

      it("should clear all global exclusions when -global -d with empty rest", async () => {
        // Arrange
        const mockMainApi = context.mainApi as any;
        mockMainApi.setGloballyExcludedProjectItems = vi.fn().mockResolvedValue(undefined);

        const mockStore = context.store as any;
        mockStore.getState.mockReturnValue({
          project: {
            isKliveProject: true
          }
        });

        const args: ExcludeItemArgs = {
          "-global": true,
          "-d": true,
          itemPath: "",
          rest: []
        };

        // Act
        const result = await command.execute(context, args);

        // Assert
        expect(result.success).toBe(true);
        expect(mockMainApi.setGloballyExcludedProjectItems).toHaveBeenCalledWith([]);
      });

      it("should display success message", async () => {
        // Arrange
        const mockStore = context.store as any;
        mockStore.getState.mockReturnValue({
          project: {
            isKliveProject: true,
            excludedItems: [],
            buildRoots: ["src/main.asm"]
          }
        });

        mockStore.dispatch = vi.fn();

        const args: ExcludeItemArgs = {
          itemPath: "build",
          rest: ["build"]
        };

        // Act
        const result = await command.execute(context, args);

        // Assert
        expect(result.success).toBe(true);
        expect(context.output.writeLine).toHaveBeenCalledWith(
          expect.stringContaining("Done")
        );
      });

      it("should normalize path separators on Windows", async () => {
        // Arrange
        const mockStore = context.store as any;
        mockStore.getState.mockReturnValue({
          project: {
            isKliveProject: true,
            excludedItems: ["src\\old"],
            buildRoots: ["src/main.asm"]
          }
        });

        mockStore.dispatch = vi.fn();

        const args: ExcludeItemArgs = {
          "-d": true,
          itemPath: "src\\old",
          rest: ["src\\old"]
        };

        // Act
        const result = await command.execute(context, args);

        // Assert
        expect(result.success).toBe(true);
      });

      it("should skip empty path entries", async () => {
        // Arrange
        const mockStore = context.store as any;
        mockStore.getState.mockReturnValue({
          project: {
            isKliveProject: true,
            excludedItems: [],
            buildRoots: ["src/main.asm"]
          }
        });

        mockStore.dispatch = vi.fn();

        const args: ExcludeItemArgs = {
          itemPath: "item1",
          rest: ["item1", "", "item2"]
        };

        // Act
        const result = await command.execute(context, args);

        // Assert
        expect(result.success).toBe(true);
      });
    });
  });
});
