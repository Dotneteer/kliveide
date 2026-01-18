import { describe, it, expect, vi, beforeEach } from "vitest";
import { SetZ80RegisterCommand } from "@renderer/appIde/commands/SetZ80RegisterCommand";
import { createMockContext, createMockContextWithMachineState } from "./test-helpers/mock-context";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";

// Type assertion helper for mock context
type MockIdeCommandContext = IdeCommandContext & {
  service: any;
  store: any;
  emuApi: any;
};

type SetZ80RegisterCommandArgs = {
  register: string;
  value: number;
};

describe("SetZ80RegisterCommand", () => {
  let command: SetZ80RegisterCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new SetZ80RegisterCommand();
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'setz80reg'", () => {
      expect(command.id).toBe("setz80reg");
    });

    it("should have correct description", () => {
      expect(command.description).toContain("Sets the value of the specified Z80 register");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toBe("setz80reg <register> <value>");
    });

    it("should have alias 'sr'", () => {
      expect(command.aliases).toEqual(["sr"]);
    });

    it("should have correct argument info", () => {
      expect(command.argumentInfo.mandatory).toHaveLength(2);
      expect(command.argumentInfo.mandatory[0].name).toBe("register");
      expect(command.argumentInfo.mandatory[1].name).toBe("value");
    });
  });

  describe("execute", () => {
    it("should return error when machine is not paused", async () => {
      // Arrange
      context = createMockContextWithMachineState(
        MachineControllerState.Running
      ) as MockIdeCommandContext;

      const args: SetZ80RegisterCommandArgs = {
        register: "A",
        value: 0x42
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("machine must be paused");
    });

    it("should return error for invalid register name", async () => {
      // Arrange
      context = createMockContextWithMachineState(
        MachineControllerState.Paused
      ) as MockIdeCommandContext;

      const args: SetZ80RegisterCommandArgs = {
        register: "INVALID",
        value: 0x42
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("Invalid register name");
    });

    it("should set 8-bit register successfully", async () => {
      // Arrange
      context = createMockContextWithMachineState(
        MachineControllerState.Paused
      ) as MockIdeCommandContext;

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.setRegisterValue = vi.fn().mockResolvedValue(undefined);

      const args: SetZ80RegisterCommandArgs = {
        register: "A",
        value: 0x42
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(mockEmuApi.setRegisterValue).toHaveBeenCalledWith("A", 0x42);
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("$42")
      );
    });

    it("should set 16-bit register successfully", async () => {
      // Arrange
      context = createMockContextWithMachineState(
        MachineControllerState.Paused
      ) as MockIdeCommandContext;

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.setRegisterValue = vi.fn().mockResolvedValue(undefined);

      const args: SetZ80RegisterCommandArgs = {
        register: "AF",
        value: 0x1234
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(mockEmuApi.setRegisterValue).toHaveBeenCalledWith("AF", 0x1234);
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("$1234")
      );
    });

    it("should handle case-insensitive register names", async () => {
      // Arrange
      context = createMockContextWithMachineState(
        MachineControllerState.Paused
      ) as MockIdeCommandContext;

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.setRegisterValue = vi.fn().mockResolvedValue(undefined);

      const args: SetZ80RegisterCommandArgs = {
        register: "a",
        value: 0x42
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(mockEmuApi.setRegisterValue).toHaveBeenCalledWith("a", 0x42);
    });

    it("should warn when 8-bit register value exceeds 255", async () => {
      // Arrange
      context = createMockContextWithMachineState(
        MachineControllerState.Paused
      ) as MockIdeCommandContext;

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.setRegisterValue = vi.fn().mockResolvedValue(undefined);

      const args: SetZ80RegisterCommandArgs = {
        register: "B",
        value: 0x1ff
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("out of range")
      );
      expect(mockEmuApi.setRegisterValue).toHaveBeenCalledWith("B", 0xff);
    });

    it("should warn when 16-bit register value exceeds 65535", async () => {
      // Arrange
      context = createMockContextWithMachineState(
        MachineControllerState.Paused
      ) as MockIdeCommandContext;

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.setRegisterValue = vi.fn().mockResolvedValue(undefined);

      const args: SetZ80RegisterCommandArgs = {
        register: "BC",
        value: 0x1ffff
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("out of range")
      );
      expect(mockEmuApi.setRegisterValue).toHaveBeenCalledWith("BC", 0xffff);
    });

    it("should dispatch incEmuViewVersionAction", async () => {
      // Arrange
      context = createMockContextWithMachineState(
        MachineControllerState.Paused
      ) as MockIdeCommandContext;

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.setRegisterValue = vi.fn().mockResolvedValue(undefined);

      const mockStore = context.store as any;
      mockStore.dispatch = vi.fn();

      const args: SetZ80RegisterCommandArgs = {
        register: "A",
        value: 0x42
      };

      // Act
      await command.execute(context, args);

      // Assert
      expect(mockStore.dispatch).toHaveBeenCalled();
    });

    it("should set alternate register AF'", async () => {
      // Arrange
      context = createMockContextWithMachineState(
        MachineControllerState.Paused
      ) as MockIdeCommandContext;

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.setRegisterValue = vi.fn().mockResolvedValue(undefined);

      const args: SetZ80RegisterCommandArgs = {
        register: "AF'",
        value: 0x5678
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(mockEmuApi.setRegisterValue).toHaveBeenCalledWith("AF'", 0x5678);
    });

    it("should set SP register", async () => {
      // Arrange
      context = createMockContextWithMachineState(
        MachineControllerState.Paused
      ) as MockIdeCommandContext;

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.setRegisterValue = vi.fn().mockResolvedValue(undefined);

      const args: SetZ80RegisterCommandArgs = {
        register: "SP",
        value: 0x0000
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(mockEmuApi.setRegisterValue).toHaveBeenCalledWith("SP", 0x0000);
    });

    it("should set PC register", async () => {
      // Arrange
      context = createMockContextWithMachineState(
        MachineControllerState.Paused
      ) as MockIdeCommandContext;

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.setRegisterValue = vi.fn().mockResolvedValue(undefined);

      const args: SetZ80RegisterCommandArgs = {
        register: "PC",
        value: 0x8000
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(mockEmuApi.setRegisterValue).toHaveBeenCalledWith("PC", 0x8000);
    });

    it("should display success message with hex and binary formats", async () => {
      // Arrange
      context = createMockContextWithMachineState(
        MachineControllerState.Paused
      ) as MockIdeCommandContext;

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.setRegisterValue = vi.fn().mockResolvedValue(undefined);

      const args: SetZ80RegisterCommandArgs = {
        register: "A",
        value: 0x42
      };

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("Z80 A register value is set")
      );
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("66") // 0x42 in binary
      );
    });

    it("should handle negative values by masking", async () => {
      // Arrange
      context = createMockContextWithMachineState(
        MachineControllerState.Paused
      ) as MockIdeCommandContext;

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.setRegisterValue = vi.fn().mockResolvedValue(undefined);

      const args: SetZ80RegisterCommandArgs = {
        register: "A",
        value: -1
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("out of range")
      );
    });

    it("should set IX register", async () => {
      // Arrange
      context = createMockContextWithMachineState(
        MachineControllerState.Paused
      ) as MockIdeCommandContext;

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.setRegisterValue = vi.fn().mockResolvedValue(undefined);

      const args: SetZ80RegisterCommandArgs = {
        register: "IX",
        value: 0x1000
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(mockEmuApi.setRegisterValue).toHaveBeenCalledWith("IX", 0x1000);
    });

    it("should set IY register", async () => {
      // Arrange
      context = createMockContextWithMachineState(
        MachineControllerState.Paused
      ) as MockIdeCommandContext;

      const mockEmuApi = context.emuApi as any;
      mockEmuApi.setRegisterValue = vi.fn().mockResolvedValue(undefined);

      const args: SetZ80RegisterCommandArgs = {
        register: "IY",
        value: 0x2000
      };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(mockEmuApi.setRegisterValue).toHaveBeenCalledWith("IY", 0x2000);
    });
  });
});
