import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  RemoveBreakpointCommand,
  EnableBreakpointCommand
} from "@renderer/appIde/commands/BreakpointCommands";
import { createMockContext } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";

// Type assertion helper for mock context
type MockIdeCommandContext = IdeCommandContext & {
  emuApi: any;
  store: any;
};

// This type mirrors the internal BreakpointWithAddressArgs type
type BreakpointWithAddressArgs = {
  addrSpec?: string;
  address?: number;
  partition?: number;
  resource?: string;
  line?: number;
  "-d"?: boolean;
  "-r"?: boolean;
  "-w"?: boolean;
  "-i"?: boolean;
  "-o"?: boolean;
  "-m"?: number;
};

describe("RemoveBreakpointCommand", () => {
  let command: RemoveBreakpointCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new RemoveBreakpointCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'bp-del'", () => {
      expect(command.id).toBe("bp-del");
    });

    it("should have correct description", () => {
      expect(command.description).toContain("Removes the breakpoint");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toContain("bp-del");
      expect(command.usage).toContain("<address>");
    });

    it("should have alias 'bd'", () => {
      expect(command.aliases).toEqual(["bd"]);
    });

    it("should have correct argumentInfo structure", () => {
      expect(command.argumentInfo).toBeDefined();
      expect(command.argumentInfo.mandatory).toBeDefined();
    });
  });

  describe("execute", () => {
    it("should remove breakpoint at specified address", async () => {
      // Arrange
      context.emuApi.removeBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000 };
      await command.validateCommandArgs(context, args);

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(context.emuApi.removeBreakpoint).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should handle removal of non-existent breakpoint", async () => {
      // Arrange
      context.emuApi.removeBreakpoint.mockResolvedValue(false);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000 };
      await command.validateCommandArgs(context, args);

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(context.emuApi.removeBreakpoint).toHaveBeenCalled();
      expect(result.success).toBe(true);
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("No breakpoint has been set")
      );
    });

    it("should call emuApi.removeBreakpoint with correct parameters", async () => {
      // Arrange
      context.emuApi.removeBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000 };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.removeBreakpoint as any).mock.calls[0][0];
      expect(callArgs.address).toBe(0x8000);
      expect(callArgs.exec).toBe(true);
    });

    it("should display 'removed' message when breakpoint exists", async () => {
      // Arrange
      context.emuApi.removeBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000 };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("removed")
      );
    });

    it("should remove memory read breakpoint with -r option", async () => {
      // Arrange
      context.emuApi.removeBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000, "-r": true };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.removeBreakpoint as any).mock.calls[0][0];
      expect(callArgs.memoryRead).toBe(true);
      expect(callArgs.exec).toBe(false);
    });

    it("should remove memory write breakpoint with -w option", async () => {
      // Arrange
      context.emuApi.removeBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000, "-w": true };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.removeBreakpoint as any).mock.calls[0][0];
      expect(callArgs.memoryWrite).toBe(true);
      expect(callArgs.exec).toBe(false);
    });

    it("should remove I/O read breakpoint with -i option", async () => {
      // Arrange
      context.emuApi.removeBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000, "-i": true };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.removeBreakpoint as any).mock.calls[0][0];
      expect(callArgs.ioRead).toBe(true);
      expect(callArgs.exec).toBe(false);
    });

    it("should remove I/O write breakpoint with -o option", async () => {
      // Arrange
      context.emuApi.removeBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000, "-o": true };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.removeBreakpoint as any).mock.calls[0][0];
      expect(callArgs.ioWrite).toBe(true);
      expect(callArgs.exec).toBe(false);
    });

    it("should pass port mask to removeBreakpoint when using -m option", async () => {
      // Arrange
      context.emuApi.removeBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000, "-i": true, "-m": 0xff };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.removeBreakpoint as any).mock.calls[0][0];
      expect(callArgs.ioMask).toBe(0xff);
    });

    it("should return commandSuccess on removal", async () => {
      // Arrange
      context.emuApi.removeBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000 };
      await command.validateCommandArgs(context, args);

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should return commandSuccess when breakpoint not found", async () => {
      // Arrange
      context.emuApi.removeBreakpoint.mockResolvedValue(false);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000 };
      await command.validateCommandArgs(context, args);

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
    });
  });
});

describe("EnableBreakpointCommand", () => {
  let command: EnableBreakpointCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new EnableBreakpointCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'bp-en'", () => {
      expect(command.id).toBe("bp-en");
    });

    it("should have correct description", () => {
      expect(command.description).toContain("Enables/disables a breakpoint");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toContain("bp-en");
      expect(command.usage).toContain("<address>");
      expect(command.usage).toContain("[-d]");
    });

    it("should have alias 'be'", () => {
      expect(command.aliases).toEqual(["be"]);
    });

    it("should include -d option in argumentInfo", () => {
      expect(command.argumentInfo.commandOptions).toContain("-d");
    });

    it("should have correct argumentInfo structure", () => {
      expect(command.argumentInfo).toBeDefined();
      expect(command.argumentInfo.mandatory).toBeDefined();
      expect(command.argumentInfo.commandOptions).toBeDefined();
    });
  });

  describe("execute", () => {
    it("should enable breakpoint at specified address", async () => {
      // Arrange
      context.emuApi.enableBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000 };
      await command.validateCommandArgs(context, args);

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(context.emuApi.enableBreakpoint).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should disable breakpoint with -d option", async () => {
      // Arrange
      context.emuApi.enableBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000, "-d": true };
      await command.validateCommandArgs(context, args);

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(context.emuApi.enableBreakpoint).toHaveBeenCalled();
      // Second parameter should be false when -d is present
      const callArgs = (context.emuApi.enableBreakpoint as any).mock.calls[0];
      expect(callArgs[1]).toBe(false);
      expect(result.success).toBe(true);
    });

    it("should pass enable=true when -d is not present", async () => {
      // Arrange
      context.emuApi.enableBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000 };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.enableBreakpoint as any).mock.calls[0];
      expect(callArgs[1]).toBe(true);
    });

    it("should call emuApi.enableBreakpoint with correct parameters", async () => {
      // Arrange
      context.emuApi.enableBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000 };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.enableBreakpoint as any).mock.calls[0];
      expect(callArgs[0].address).toBe(0x8000);
      expect(callArgs[0].exec).toBe(true);
    });

    it("should display 'enabled' message when enabling", async () => {
      // Arrange
      context.emuApi.enableBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000 };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("enabled")
      );
    });

    it("should display 'disabled' message when disabling", async () => {
      // Arrange
      context.emuApi.enableBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000, "-d": true };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("disabled")
      );
    });

    it("should handle memory read breakpoint with -r option", async () => {
      // Arrange
      context.emuApi.enableBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000, "-r": true };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.enableBreakpoint as any).mock.calls[0][0];
      expect(callArgs.memoryRead).toBe(true);
      expect(callArgs.exec).toBe(false);
    });

    it("should handle memory write breakpoint with -w option", async () => {
      // Arrange
      context.emuApi.enableBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000, "-w": true };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.enableBreakpoint as any).mock.calls[0][0];
      expect(callArgs.memoryWrite).toBe(true);
      expect(callArgs.exec).toBe(false);
    });

    it("should handle I/O read breakpoint with -i option", async () => {
      // Arrange
      context.emuApi.enableBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000, "-i": true };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.enableBreakpoint as any).mock.calls[0][0];
      expect(callArgs.ioRead).toBe(true);
      expect(callArgs.exec).toBe(false);
    });

    it("should handle I/O write breakpoint with -o option", async () => {
      // Arrange
      context.emuApi.enableBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000, "-o": true };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.enableBreakpoint as any).mock.calls[0][0];
      expect(callArgs.ioWrite).toBe(true);
      expect(callArgs.exec).toBe(false);
    });

    it("should pass port mask to enableBreakpoint when using -m option", async () => {
      // Arrange
      context.emuApi.enableBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000, "-i": true, "-m": 0xaa };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.enableBreakpoint as any).mock.calls[0][0];
      expect(callArgs.ioMask).toBe(0xaa);
    });

    it("should return error when breakpoint doesn't exist", async () => {
      // Arrange
      context.emuApi.enableBreakpoint.mockResolvedValue(false);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000 };
      await command.validateCommandArgs(context, args);

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("does not exist");
    });

    it("should handle hexadecimal address format", async () => {
      // Arrange
      context.emuApi.enableBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$ABCD", address: 0xabcd };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.enableBreakpoint as any).mock.calls[0][0];
      expect(callArgs.address).toBe(0xabcd);
    });

    it("should handle decimal address format", async () => {
      // Arrange
      context.emuApi.enableBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "32768", address: 0x8000 };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.enableBreakpoint as any).mock.calls[0][0];
      expect(callArgs.address).toBe(0x8000);
    });
  });
});
