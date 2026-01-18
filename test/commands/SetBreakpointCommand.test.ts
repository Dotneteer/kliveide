import { describe, it, expect, vi, beforeEach } from "vitest";
import { SetBreakpointCommand } from "@renderer/appIde/commands/BreakpointCommands";
import { createMockContext } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";

// Type assertion helper for mock context
type MockIdeCommandContext = IdeCommandContext & {
  emuApi: any;
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

describe("SetBreakpointCommand", () => {
  let command: SetBreakpointCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new SetBreakpointCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'bp-set'", () => {
      expect(command.id).toBe("bp-set");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("Sets a breakpoint at the specified address");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toContain("bp-set");
      expect(command.usage).toContain("<address>");
      expect(command.usage).toContain("[-r]");
      expect(command.usage).toContain("[-w]");
      expect(command.usage).toContain("[-i]");
      expect(command.usage).toContain("[-o]");
      expect(command.usage).toContain("[-m");
    });

    it("should have alias 'bp'", () => {
      expect(command.aliases).toEqual(["bp"]);
    });

    it("should have correct argumentInfo structure", () => {
      expect(command.argumentInfo).toBeDefined();
      expect(command.argumentInfo.mandatory).toBeDefined();
      expect(command.argumentInfo.mandatory?.length).toBeGreaterThan(0);
      expect(command.argumentInfo.commandOptions).toContain("-r");
      expect(command.argumentInfo.commandOptions).toContain("-w");
      expect(command.argumentInfo.commandOptions).toContain("-i");
      expect(command.argumentInfo.commandOptions).toContain("-o");
    });
  });

  describe("validateCommandArgs - Address Formats", () => {
    it("should parse decimal address correctly", async () => {
      // Arrange
      const args: BreakpointWithAddressArgs = { addrSpec: "32768" };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBe(0);
      expect(args.address).toBe(32768);
    });

    it("should parse hexadecimal address correctly", async () => {
      // Arrange
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000" };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBe(0);
      expect(args.address).toBe(0x8000);
    });

    it("should parse binary address correctly", async () => {
      // Arrange
      const args: BreakpointWithAddressArgs = { addrSpec: "%1000000000000000" };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBe(0);
      expect(args.address).toBe(0x8000);
    });

    it("should parse address with underscores correctly", async () => {
      // Arrange
      const args: BreakpointWithAddressArgs = { addrSpec: "$8_000" };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBe(0);
      expect(args.address).toBe(0x8000);
    });
  });

  describe("validateCommandArgs - Breakpoint Types", () => {
    it("should accept execution breakpoint (default, no flag)", async () => {
      // Arrange
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000" };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBe(0);
    });

    it("should accept memory read breakpoint (-r)", async () => {
      // Arrange
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", "-r": true };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBe(0);
    });

    it("should accept memory write breakpoint (-w)", async () => {
      // Arrange
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", "-w": true };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBe(0);
    });

    it("should accept I/O read breakpoint (-i)", async () => {
      // Arrange
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", "-i": true };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBe(0);
    });

    it("should accept I/O write breakpoint (-o)", async () => {
      // Arrange
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", "-o": true };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBe(0);
    });

    it("should reject multiple breakpoint type flags", async () => {
      // Arrange
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", "-r": true, "-w": true };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].message).toContain("only one of");
    });

    it("should reject -r and -i together", async () => {
      // Arrange
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", "-r": true, "-i": true };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBeGreaterThan(0);
    });

    it("should reject -w and -o together", async () => {
      // Arrange
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", "-w": true, "-o": true };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe("validateCommandArgs - Port Mask (-m option)", () => {
    it("should accept port mask with I/O read (-i -m)", async () => {
      // Arrange
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", "-i": true, "-m": 0xff };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBe(0);
    });

    it("should accept port mask with I/O write (-o -m)", async () => {
      // Arrange
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", "-o": true, "-m": 0xff };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBe(0);
    });

    it("should reject -m option without -i or -o", async () => {
      // Arrange
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", "-m": 0xff };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].message).toContain("-m");
    });

    it("should reject -m option with -r", async () => {
      // Arrange
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", "-r": true, "-m": 0xff };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBeGreaterThan(0);
    });

    it("should reject -m option with -w", async () => {
      // Arrange
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", "-w": true, "-m": 0xff };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBeGreaterThan(0);
    });
  });

  describe("validateCommandArgs - Partitions", () => {
    beforeEach(() => {
      // Setup context with partition support
      const machineService = context.service.machineService as any;
      machineService.getMachineInfo.mockReturnValue({
        machine: {
          features: {
            "rom": 1
          }
        }
      });
    });

    it("should reject invalid partition labels", async () => {
      // Arrange
      context.emuApi.parsePartitionLabel.mockResolvedValue(undefined);
      const args: BreakpointWithAddressArgs = { addrSpec: "invalid:$8000" };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].message).toContain("partition");
    });

    it("should reject partition with I/O read breakpoints", async () => {
      // Arrange
      context.emuApi.parsePartitionLabel.mockResolvedValue(0);
      const args: BreakpointWithAddressArgs = { addrSpec: "rom0:$8000", "-i": true };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      // Should get partition+I/O error
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].message.toLowerCase()).toContain("partition");
    });

    it("should reject partition with I/O write breakpoints", async () => {
      // Arrange
      context.emuApi.parsePartitionLabel.mockResolvedValue(0);
      const args: BreakpointWithAddressArgs = { addrSpec: "rom0:$8000", "-o": true };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].message.toLowerCase()).toContain("partition");
    });

    it("should reject partition when machine doesn't support them", async () => {
      // Arrange
      const machineService = context.service.machineService as any;
      machineService.getMachineInfo.mockReturnValue({
        machine: {
          features: {}
        }
      });
      const args: BreakpointWithAddressArgs = { addrSpec: "rom0:$8000" };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].message).toContain("does not support partitions");
    });
  });

  describe("validateCommandArgs - Error Cases", () => {
    it("should reject invalid numeric value", async () => {
      // Arrange
      const args: BreakpointWithAddressArgs = { addrSpec: "INVALID" };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].message).toContain("Invalid");
    });
  });

  describe("execute", () => {
    it("should set execution breakpoint at specified address", async () => {
      // Arrange
      context.emuApi.setBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000 };
      await command.validateCommandArgs(context, args);

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(context.emuApi.setBreakpoint).toHaveBeenCalled();
      const callArgs = (context.emuApi.setBreakpoint as any).mock.calls[0][0];
      expect(callArgs.address).toBe(0x8000);
      expect(callArgs.exec).toBe(true);
      expect(result.success).toBe(true);
    });

    it("should set memory read breakpoint with -r option", async () => {
      // Arrange
      context.emuApi.setBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000, "-r": true };
      await command.validateCommandArgs(context, args);

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(context.emuApi.setBreakpoint).toHaveBeenCalled();
      const callArgs = (context.emuApi.setBreakpoint as any).mock.calls[0][0];
      expect(callArgs.memoryRead).toBe(true);
      expect(callArgs.exec).toBe(false);
      expect(result.success).toBe(true);
    });

    it("should set memory write breakpoint with -w option", async () => {
      // Arrange
      context.emuApi.setBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000, "-w": true };
      await command.validateCommandArgs(context, args);

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(context.emuApi.setBreakpoint).toHaveBeenCalled();
      const callArgs = (context.emuApi.setBreakpoint as any).mock.calls[0][0];
      expect(callArgs.memoryWrite).toBe(true);
      expect(result.success).toBe(true);
    });

    it("should set I/O read breakpoint with -i option", async () => {
      // Arrange
      context.emuApi.setBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000, "-i": true };
      await command.validateCommandArgs(context, args);

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(context.emuApi.setBreakpoint).toHaveBeenCalled();
      const callArgs = (context.emuApi.setBreakpoint as any).mock.calls[0][0];
      expect(callArgs.ioRead).toBe(true);
      expect(result.success).toBe(true);
    });

    it("should set I/O write breakpoint with -o option", async () => {
      // Arrange
      context.emuApi.setBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000, "-o": true };
      await command.validateCommandArgs(context, args);

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(context.emuApi.setBreakpoint).toHaveBeenCalled();
      const callArgs = (context.emuApi.setBreakpoint as any).mock.calls[0][0];
      expect(callArgs.ioWrite).toBe(true);
      expect(result.success).toBe(true);
    });

    it("should set I/O breakpoint with port mask using -m option", async () => {
      // Arrange
      context.emuApi.setBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000, "-i": true, "-m": 0xff };
      await command.validateCommandArgs(context, args);

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(context.emuApi.setBreakpoint).toHaveBeenCalled();
      const callArgs = (context.emuApi.setBreakpoint as any).mock.calls[0][0];
      expect(callArgs.ioMask).toBe(0xff);
      expect(result.success).toBe(true);
    });

    it("should display 'set' message for new breakpoint", async () => {
      // Arrange
      context.emuApi.setBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000 };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const message = calls.map((call: any) => call[0]).join(" ");
      expect(message).toContain("set");
    });

    it("should display 'updated' message for existing breakpoint", async () => {
      // Arrange
      context.emuApi.setBreakpoint.mockResolvedValue(false);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000 };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const message = calls.map((call: any) => call[0]).join(" ");
      expect(message).toContain("updated");
    });

    it("should display breakpoint address in success message", async () => {
      // Arrange
      context.emuApi.setBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000 };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const message = calls.map((call: any) => call[0]).join(" ");
      expect(message).toContain("8000");
    });

    it("should write success message to output", async () => {
      // Arrange
      context.emuApi.setBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000 };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
    });

    it("should include port mask in message when present with I/O breakpoint", async () => {
      // Arrange
      context.emuApi.setBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000, "-i": true, "-m": 0xab };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const message = calls.map((call: any) => call[0]).join(" ");
      expect(message).toContain("AB");
    });

    it("should call emuApi.setBreakpoint() with correct parameters", async () => {
      // Arrange
      context.emuApi.setBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$9000", address: 0x9000, "-w": true };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.emuApi.setBreakpoint).toHaveBeenCalledTimes(1);
      const callArgs = (context.emuApi.setBreakpoint as any).mock.calls[0][0];
      expect(callArgs.address).toBe(0x9000);
      expect(callArgs.memoryWrite).toBe(true);
      expect(callArgs.exec).toBe(false);
    });

    it("should return successful result", async () => {
      // Arrange
      context.emuApi.setBreakpoint.mockResolvedValue(true);
      const args: BreakpointWithAddressArgs = { addrSpec: "$8000", address: 0x8000 };
      await command.validateCommandArgs(context, args);

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
    });
  });
});
