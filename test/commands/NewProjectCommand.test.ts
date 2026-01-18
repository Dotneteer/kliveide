import { describe, it, expect, vi, beforeEach } from "vitest";
import { NewProjectCommand } from "@renderer/appIde/commands/NewProjectCommand";
import { createMockContext } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";

// Mock registry to avoid Monaco editor imports
vi.mock("@renderer/registry", () => ({
  outputPaneRegistry: { panes: [], getPane: vi.fn(), registerPane: vi.fn() }
}));

// Mock IdeEventsHandler to avoid external dependencies
vi.mock("@renderer/appIde/IdeEventsHandler", () => ({
  ensureProjectLoaded: vi.fn().mockResolvedValue(undefined),
  ensureWorkspaceLoaded: vi.fn().mockResolvedValue(undefined)
}));

// Type assertion helper for mock context
type MockIdeCommandContext = IdeCommandContext & {
  service: any;
  store: any;
  mainApi: any;
};

type NewProjectCommandArgs = {
  machineId: string;
  projectName: string;
  templateId?: string;
  projectFolder?: string;
  "-o"?: boolean;
  "-p"?: string;
};

describe("NewProjectCommand", () => {
  let command: NewProjectCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new NewProjectCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'newp'", () => {
      expect(command.id).toBe("newp");
    });

    it("should have correct description", () => {
      expect(command.description).toContain("Creates a new Klive project");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toContain("newp");
      expect(command.usage).toContain("machine ID");
      expect(command.usage).toContain("project name");
    });

    it("should have alias 'np'", () => {
      expect(command.aliases).toEqual(["np"]);
    });

    it("should have correct argumentInfo structure", () => {
      expect(command.argumentInfo).toBeDefined();
      expect(command.argumentInfo.mandatory).toHaveLength(2);
      expect(command.argumentInfo.mandatory[0].name).toBe("machineId");
      expect(command.argumentInfo.mandatory[1].name).toBe("projectName");
    });

    it("should have optional template argument", () => {
      expect(command.argumentInfo.optional).toBeDefined();
      expect(command.argumentInfo.optional[0].name).toBe("template");
    });

    it("should have commandOptions including -o", () => {
      expect(command.argumentInfo.commandOptions).toContain("-o");
    });
  });

  describe("execute", () => {
    it("should create project with default template", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createKliveProject.mockResolvedValue("/new/project");
      const args: NewProjectCommandArgs = { machineId: "spectrum", projectName: "MyProject" };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(mockMainApi.createKliveProject).toHaveBeenCalledWith(
        "spectrum",
        "MyProject",
        undefined,
        undefined,
        "default"
      );
      expect(result.success).toBe(true);
    });

    it("should create project with specified template", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createKliveProject.mockResolvedValue("/new/project");
      const args: NewProjectCommandArgs = { 
        machineId: "spectrum", 
        projectName: "MyProject",
        templateId: "custom"
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(mockMainApi.createKliveProject).toHaveBeenCalledWith(
        "spectrum",
        "MyProject",
        undefined,
        undefined,
        "custom"
      );
      expect(result.success).toBe(true);
    });

    it("should parse machine ID with model ID", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createKliveProject.mockResolvedValue("/new/project");
      const args: NewProjectCommandArgs = { machineId: "spectrum:128k", projectName: "MyProject" };

      // Act
      await command.execute(context, args);

      // Assert
      expect(mockMainApi.createKliveProject).toHaveBeenCalledWith(
        "spectrum",
        "MyProject",
        undefined,
        "128k",
        "default"
      );
    });

    it("should create project without opening when -o flag is not present", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createKliveProject.mockResolvedValue("/new/project");
      const args: NewProjectCommandArgs = { machineId: "spectrum", projectName: "MyProject" };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(mockMainApi.openFolder).not.toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should open project folder when -o flag is present", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createKliveProject.mockResolvedValue("/new/project");
      mockMainApi.openFolder.mockResolvedValue(undefined);
      
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({ project: { buildRoots: ["src"] } });
      
      const mockService = context.service as any;
      mockService.ideCommandsService.executeCommand.mockResolvedValue(undefined);
      
      const args: NewProjectCommandArgs = { 
        machineId: "spectrum", 
        projectName: "MyProject",
        "-o": true
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(mockMainApi.openFolder).toHaveBeenCalledWith("/new/project");
      expect(result.success).toBe(true);
    });

    it("should return error when openFolder fails", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createKliveProject.mockResolvedValue("/new/project");
      mockMainApi.openFolder.mockResolvedValue("Failed to open folder");
      
      const args: NewProjectCommandArgs = { 
        machineId: "spectrum", 
        projectName: "MyProject",
        "-o": true
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("Error opening folder");
    });

    it("should write success message with project path", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createKliveProject.mockResolvedValue("/new/project");
      const args: NewProjectCommandArgs = { machineId: "spectrum", projectName: "MyProject" };

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("/new/project")
      );
    });

    it("should write success message with 'created' text", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createKliveProject.mockResolvedValue("/new/project");
      const args: NewProjectCommandArgs = { machineId: "spectrum", projectName: "MyProject" };

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("successfully created")
      );
    });

    it("should handle project creation error", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createKliveProject.mockRejectedValue(new Error("Creation failed"));
      const args: NewProjectCommandArgs = { machineId: "spectrum", projectName: "MyProject" };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("Creation failed");
    });

    it("should navigate to build root when -o is used and buildRoots exist", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createKliveProject.mockResolvedValue("/new/project");
      mockMainApi.openFolder.mockResolvedValue(undefined);
      
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({ project: { buildRoots: ["src/main.asm"] } });
      
      const mockService = context.service as any;
      mockService.ideCommandsService.executeCommand.mockResolvedValue(undefined);
      
      const args: NewProjectCommandArgs = { 
        machineId: "spectrum", 
        projectName: "MyProject",
        "-o": true
      };

      // Act
      await command.execute(context, args);

      // Assert
      expect(mockService.ideCommandsService.executeCommand).toHaveBeenCalledWith(
        expect.stringContaining("nav")
      );
    });

    it("should not navigate to build root when buildRoots is empty", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createKliveProject.mockResolvedValue("/new/project");
      mockMainApi.openFolder.mockResolvedValue(undefined);
      
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({ project: { buildRoots: [] } });
      
      const mockService = context.service as any;
      mockService.ideCommandsService.executeCommand.mockResolvedValue(undefined);
      
      const args: NewProjectCommandArgs = { 
        machineId: "spectrum", 
        projectName: "MyProject",
        "-o": true
      };

      // Act
      await command.execute(context, args);

      // Assert
      expect(mockService.ideCommandsService.executeCommand).not.toHaveBeenCalled();
    });

    it("should pass project folder with -p option", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createKliveProject.mockResolvedValue("/new/project");
      const args: NewProjectCommandArgs = { 
        machineId: "spectrum", 
        projectName: "MyProject",
        "-p": "/custom/path"
      };

      // Act
      await command.execute(context, args);

      // Assert
      expect(mockMainApi.createKliveProject).toHaveBeenCalledWith(
        "spectrum",
        "MyProject",
        "/custom/path",
        undefined,
        "default"
      );
    });

    it("should return commandSuccess on successful creation", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createKliveProject.mockResolvedValue("/new/project");
      const args: NewProjectCommandArgs = { machineId: "spectrum", projectName: "MyProject" };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should handle machine ID without model ID", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createKliveProject.mockResolvedValue("/new/project");
      const args: NewProjectCommandArgs = { machineId: "c64", projectName: "MyProject" };

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (mockMainApi.createKliveProject as any).mock.calls[0];
      expect(callArgs[0]).toBe("c64");
      expect(callArgs[3]).toBeUndefined();
    });

    it("should support multiple machine ID formats", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createKliveProject.mockResolvedValue("/new/project");

      // Test with colons in machine ID
      const args: NewProjectCommandArgs = { machineId: "z80:model:variant", projectName: "MyProject" };

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (mockMainApi.createKliveProject as any).mock.calls[0];
      expect(callArgs[0]).toBe("z80");
      expect(callArgs[3]).toBe("model");
    });
  });
});
