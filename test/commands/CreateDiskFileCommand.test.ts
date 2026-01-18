import { describe, it, expect, vi, beforeEach } from "vitest";
import { CreateDiskFileCommand } from "@renderer/appIde/commands/CreateDiskFileCommand";
import { createMockContext, createMockContextWithProject } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";

// Type assertion helper for mock context
type MockIdeCommandContext = IdeCommandContext & {
  service: any;
  store: any;
  mainApi: any;
};

type CreateDiskFileCommandArgs = {
  diskType: string;
  diskName: string;
  diskFolder?: string;
  "-p"?: boolean;
};

describe("CreateDiskFileCommand", () => {
  let command: CreateDiskFileCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new CreateDiskFileCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'crd'", () => {
      expect(command.id).toBe("crd");
    });

    it("should have correct description", () => {
      expect(command.description).toContain("Creates a new disk file");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toBe("crd <disk type> <disk name> [<disk folder>] [-p]");
    });

    it("should have correct argument info", () => {
      expect(command.argumentInfo.mandatory).toHaveLength(2);
      expect(command.argumentInfo.mandatory[0].name).toBe("diskType");
      expect(command.argumentInfo.mandatory[1].name).toBe("diskName");
      expect(command.argumentInfo.commandOptions).toContain("-p");
    });
  });

  describe("validateCommandArgs", () => {
    it("should accept valid disk type 'ss'", async () => {
      const args = { diskType: "ss", diskName: "test" };

      const messages = await command.validateCommandArgs(context, args);

      expect(messages).toHaveLength(0);
    });

    it("should accept valid disk type 'ds'", async () => {
      const args = { diskType: "ds", diskName: "test" };

      const messages = await command.validateCommandArgs(context, args);

      expect(messages).toHaveLength(0);
    });

    it("should accept valid disk type 'sse'", async () => {
      const args = { diskType: "sse", diskName: "test" };

      const messages = await command.validateCommandArgs(context, args);

      expect(messages).toHaveLength(0);
    });

    it("should accept valid disk type 'dse'", async () => {
      const args = { diskType: "dse", diskName: "test" };

      const messages = await command.validateCommandArgs(context, args);

      expect(messages).toHaveLength(0);
    });

    it("should reject invalid disk type", async () => {
      const args = { diskType: "invalid", diskName: "test" };

      const messages = await command.validateCommandArgs(context, args);

      expect(messages).toHaveLength(1);
      expect(messages[0].type).toBe(2); // ValidationMessageType.Error
      expect(messages[0].message).toContain("Invalid disk type");
      expect(messages[0].message).toContain("invalid");
    });

    it("should list available disk types in error message", async () => {
      const args = { diskType: "xyz", diskName: "test" };

      const messages = await command.validateCommandArgs(context, args);

      expect(messages[0].message).toContain("'ss'");
      expect(messages[0].message).toContain("'ds'");
      expect(messages[0].message).toContain("'sse'");
      expect(messages[0].message).toContain("'dse'");
    });
  });

  describe("execute", () => {
    it("should create disk file with specified folder", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createDiskFile = vi.fn().mockResolvedValue("/path/to/disk.dsk");

      const args: CreateDiskFileCommandArgs = {
        diskType: "ss",
        diskName: "test.dsk",
        diskFolder: "/custom/path"
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(mockMainApi.createDiskFile).toHaveBeenCalledWith(
        "/custom/path",
        "test.dsk",
        "ss"
      );
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("successfully created")
      );
    });

    it("should create disk file without folder", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createDiskFile = vi.fn().mockResolvedValue("/path/to/disk.dsk");

      const args: CreateDiskFileCommandArgs = {
        diskType: "ds",
        diskName: "data.dsk"
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(mockMainApi.createDiskFile).toHaveBeenCalledWith(
        undefined,
        "data.dsk",
        "ds"
      );
    });

    it("should create disk in project folder when -p flag is set", async () => {
      // Arrange
      context = createMockContextWithProject("/test/project") as MockIdeCommandContext;

      const mockMainApi = context.mainApi as any;
      mockMainApi.createDiskFile = vi.fn().mockResolvedValue("/test/project/disks/test.dsk");

      const args: CreateDiskFileCommandArgs = {
        diskType: "sse",
        diskName: "test.dsk",
        diskFolder: "custom",
        "-p": true
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(mockMainApi.createDiskFile).toHaveBeenCalledWith(
        "/test/project/disks/custom",
        "test.dsk",
        "sse"
      );
    });

    it("should create disk in default project disk folder when -p flag is set without folder", async () => {
      // Arrange
      context = createMockContextWithProject("/test/project") as MockIdeCommandContext;

      const mockMainApi = context.mainApi as any;
      mockMainApi.createDiskFile = vi.fn().mockResolvedValue("/test/project/disks/test.dsk");

      const args: CreateDiskFileCommandArgs = {
        diskType: "dse",
        diskName: "test.dsk",
        "-p": true
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(mockMainApi.createDiskFile).toHaveBeenCalledWith(
        "/test/project/disks",
        "test.dsk",
        "dse"
      );
    });

    it("should return success with created disk path", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createDiskFile = vi.fn().mockResolvedValue("/path/to/my_disk.dsk");

      const args: CreateDiskFileCommandArgs = {
        diskType: "ss",
        diskName: "my_disk.dsk",
        diskFolder: "/path/to"
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("/path/to/my_disk.dsk")
      );
    });

    it("should handle API error", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createDiskFile = vi.fn().mockRejectedValue(new Error("Disk creation failed"));

      const args: CreateDiskFileCommandArgs = {
        diskType: "ss",
        diskName: "test.dsk"
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("Disk creation failed");
    });

    it("should handle 'ss' disk type", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createDiskFile = vi.fn().mockResolvedValue("/disk.dsk");

      const args: CreateDiskFileCommandArgs = {
        diskType: "ss",
        diskName: "single_side.dsk"
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(mockMainApi.createDiskFile).toHaveBeenCalledWith(
        undefined,
        "single_side.dsk",
        "ss"
      );
    });

    it("should handle 'ds' disk type", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createDiskFile = vi.fn().mockResolvedValue("/disk.dsk");

      const args: CreateDiskFileCommandArgs = {
        diskType: "ds",
        diskName: "double_side.dsk"
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(mockMainApi.createDiskFile).toHaveBeenCalledWith(
        undefined,
        "double_side.dsk",
        "ds"
      );
    });

    it("should handle 'sse' disk type", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createDiskFile = vi.fn().mockResolvedValue("/disk.dsk");

      const args: CreateDiskFileCommandArgs = {
        diskType: "sse",
        diskName: "ext_single.dsk"
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(mockMainApi.createDiskFile).toHaveBeenCalledWith(
        undefined,
        "ext_single.dsk",
        "sse"
      );
    });

    it("should handle 'dse' disk type", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createDiskFile = vi.fn().mockResolvedValue("/disk.dsk");

      const args: CreateDiskFileCommandArgs = {
        diskType: "dse",
        diskName: "ext_double.dsk"
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(mockMainApi.createDiskFile).toHaveBeenCalledWith(
        undefined,
        "ext_double.dsk",
        "dse"
      );
    });

    it("should handle complex folder paths", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createDiskFile = vi.fn().mockResolvedValue("/path/to/nested/disk.dsk");

      const args: CreateDiskFileCommandArgs = {
        diskType: "ds",
        diskName: "disk.dsk",
        diskFolder: "/path/to/nested"
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(mockMainApi.createDiskFile).toHaveBeenCalledWith(
        "/path/to/nested",
        "disk.dsk",
        "ds"
      );
    });

    it("should ignore -p flag when folder is not open", async () => {
      // Arrange
      const mockMainApi = context.mainApi as any;
      mockMainApi.createDiskFile = vi.fn().mockResolvedValue("/disk.dsk");

      const args: CreateDiskFileCommandArgs = {
        diskType: "ss",
        diskName: "test.dsk",
        diskFolder: "custom",
        "-p": true
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      // When no project, should use the specified folder
      expect(mockMainApi.createDiskFile).toHaveBeenCalledWith(
        "custom",
        "test.dsk",
        "ss"
      );
    });
  });
});
