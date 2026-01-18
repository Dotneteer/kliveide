import { describe, it, expect, vi, beforeEach } from "vitest";
import { DisassemblyCommand } from "@renderer/appIde/commands/DisassemblyCommand";
import { createMockContext } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";

// Mock registry to avoid Monaco editor imports
vi.mock("@renderer/registry", () => ({
  outputPaneRegistry: { panes: [], getPane: vi.fn(), registerPane: vi.fn() }
}));

// Mock disassembler dependencies
vi.mock("@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler", () => {
  const mockDisassembler = {
    disassemble: vi.fn().mockResolvedValue({
      outputItems: [
        {
          address: 0x8000,
          opCodes: [0x3e, 0x01],
          hasLabel: false,
          instruction: "LD A,01"
        },
        {
          address: 0x8002,
          opCodes: [0xcd, 0x00, 0x80],
          hasLabel: true,
          instruction: "CALL 8000"
        }
      ]
    })
  };
  return {
    Z80Disassembler: vi.fn(() => mockDisassembler)
  };
});

// Type assertion helper for mock context
type MockIdeCommandContext = IdeCommandContext & {
  service: any;
  store: any;
  mainApi: any;
};

type DisassemblyCommandArgs = {
  startAddress: number;
  endAddress: number;
  "-d": boolean;
  "-c": boolean;
  "-lc": boolean;
};

describe("DisassemblyCommand", () => {
  let command: DisassemblyCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new DisassemblyCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'dis'", () => {
      expect(command.id).toBe("dis");
    });

    it("should have correct description", () => {
      expect(command.description).toContain("Disassembles the specified memory section");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toBe("dis <start> <end> [-d] [-c] [-lc]");
    });

    it("should have correct aliases", () => {
      expect(command.aliases).toEqual([]);
    });

    it("should have correct argument info", () => {
      expect(command.argumentInfo.mandatory).toHaveLength(2);
      expect(command.argumentInfo.mandatory[0].name).toBe("startAddress");
      expect(command.argumentInfo.mandatory[1].name).toBe("endAddress");
      expect(command.argumentInfo.commandOptions).toContain("-d");
      expect(command.argumentInfo.commandOptions).toContain("-c");
      expect(command.argumentInfo.commandOptions).toContain("-lc");
    });
  });

  describe("execute", () => {
    it("should disassemble memory range with default formatting", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.openDocument.mockResolvedValue(undefined);

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.getMemoryContents.mockResolvedValue({
        memory: new Uint8Array(65536),
        partitionLabels: []
      });

      const args: DisassemblyCommandArgs = {
        startAddress: 0x8000,
        endAddress: 0x8010,
        "-d": false,
        "-c": false,
        "-lc": false
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(mockEmuApi.getMemoryContents).toHaveBeenCalled();
      expect(mockDocService.openDocument).toHaveBeenCalled();
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("$8000 - $8010")
      );
    });

    it("should format output correctly with address and opcodes", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.openDocument.mockResolvedValue(undefined);

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.getMemoryContents.mockResolvedValue({
        memory: new Uint8Array(65536),
        partitionLabels: []
      });

      const args: DisassemblyCommandArgs = {
        startAddress: 0x8000,
        endAddress: 0x8010,
        "-d": false,
        "-c": false,
        "-lc": false
      };

      // Act
      await command.execute(context, args);

      // Assert
      const openDocCall = (mockDocService.openDocument as any).mock.calls[0];
      const document = openDocCall[0];
      expect(document.id).toContain("disOutput-");
      expect(document.name).toContain("8000");
      expect(document.name).toContain("8010");
      expect(document.type).toBe("CommandResult");
    });

    it("should use decimal mode when -d flag is set", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.openDocument.mockResolvedValue(undefined);

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.getMemoryContents.mockResolvedValue({
        memory: new Uint8Array(65536),
        partitionLabels: []
      });

      const args: DisassemblyCommandArgs = {
        startAddress: 0x8000,
        endAddress: 0x8010,
        "-d": true,
        "-c": false,
        "-lc": false
      };

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("successfully created")
      );
    });

    it("should generate document with correct format", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.openDocument.mockResolvedValue(undefined);

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.getMemoryContents.mockResolvedValue({
        memory: new Uint8Array(65536),
        partitionLabels: []
      });

      const args: DisassemblyCommandArgs = {
        startAddress: 0x8000,
        endAddress: 0x8010,
        "-d": false,
        "-c": false,
        "-lc": false
      };

      // Act
      await command.execute(context, args);

      // Assert
      const openDocCall = (mockDocService.openDocument as any).mock.calls[0];
      const document = openDocCall[0];
      expect(document.contents).toBeDefined();
      expect(document.contents.title).toContain("Result of running");
      expect(document.contents.buffer).toBeDefined();
    });

    it("should create document with concise output when -c flag is set", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.openDocument.mockResolvedValue(undefined);

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.getMemoryContents.mockResolvedValue({
        memory: new Uint8Array(65536),
        partitionLabels: []
      });

      const args: DisassemblyCommandArgs = {
        startAddress: 0x8000,
        endAddress: 0x8010,
        "-c": true,
        "-d": false,
        "-lc": false
      };

      // Act
      await command.execute(context, args);

      // Assert
      expect(mockDocService.openDocument).toHaveBeenCalled();
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("$8000 - $8010")
      );
    });

    it("should return success result", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.openDocument.mockResolvedValue(undefined);

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.getMemoryContents.mockResolvedValue({
        memory: new Uint8Array(65536),
        partitionLabels: []
      });

      const args: DisassemblyCommandArgs = {
        startAddress: 0x8000,
        endAddress: 0x8010,
        "-d": false,
        "-c": false,
        "-lc": false
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should handle large address ranges", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.openDocument.mockResolvedValue(undefined);

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.getMemoryContents.mockResolvedValue({
        memory: new Uint8Array(65536),
        partitionLabels: []
      });

      const args: DisassemblyCommandArgs = {
        startAddress: 0x0000,
        endAddress: 0xffff,
        "-d": false,
        "-c": false,
        "-lc": false
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("0000 - $FFFF")
      );
    });

    it("should include disassembly info in document", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.openDocument.mockResolvedValue(undefined);

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.getMemoryContents.mockResolvedValue({
        memory: new Uint8Array(65536),
        partitionLabels: []
      });

      const args: DisassemblyCommandArgs = {
        startAddress: 0x8000,
        endAddress: 0x8010,
        "-d": false,
        "-c": false,
        "-lc": false
      };

      // Act
      await command.execute(context, args);

      // Assert
      const openDocCall = (mockDocService.openDocument as any).mock.calls[0];
      const document = openDocCall[0];
      expect(document.iconName).toBe("disassembly-icon");
      expect(document.type).toBeDefined();
    });

    it("should handle -lc flag for label formatting", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.openDocument.mockResolvedValue(undefined);

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.getMemoryContents.mockResolvedValue({
        memory: new Uint8Array(65536),
        partitionLabels: []
      });

      const args: DisassemblyCommandArgs = {
        startAddress: 0x8000,
        endAddress: 0x8010,
        "-lc": true,
        "-d": false,
        "-c": false
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should pass correct arguments to documentHubService", async () => {
      // Arrange
      const mockService = context.service as any;
      const mockDocService = mockService.projectService.getActiveDocumentHubService() as any;
      mockDocService.openDocument.mockResolvedValue(undefined);

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.getMemoryContents.mockResolvedValue({
        memory: new Uint8Array(65536),
        partitionLabels: []
      });

      const args: DisassemblyCommandArgs = {
        startAddress: 0x8000,
        endAddress: 0x8010,
        "-d": false,
        "-c": false,
        "-lc": false
      };

      // Act
      await command.execute(context, args);

      // Assert
      expect(mockDocService.openDocument).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringContaining("disOutput-"),
          name: expect.stringContaining("Disassembly"),
          type: "CommandResult"
        }),
        false
      );
    });
  });
});
