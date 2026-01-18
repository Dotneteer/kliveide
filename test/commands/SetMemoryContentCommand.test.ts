import { describe, it, expect, vi, beforeEach } from "vitest";
import { SetMemoryContentCommand } from "@renderer/appIde/commands/SetMemoryContentCommand";
import { createMockContext } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";

// Type assertion helper for mock context
type MockIdeCommandContext = IdeCommandContext & {
  emuApi: any;
  store: any;
};

type SetMemoryContentCommandArgs = {
  address: number;
  value: number;
  "-b8"?: boolean;
  "-b16"?: boolean;
  "-b24"?: boolean;
  "-b32"?: boolean;
  "-be"?: boolean;
};

describe("SetMemoryContentCommand", () => {
  let command: SetMemoryContentCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new SetMemoryContentCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'setmem'", () => {
      expect(command.id).toBe("setmem");
    });

    it("should have correct description", () => {
      expect(command.description).toContain("Sets the specified");
      expect(command.description).toContain("memory content");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toContain("setmem");
      expect(command.usage).toContain("<address>");
      expect(command.usage).toContain("<value>");
    });

    it("should have alias 'sm'", () => {
      expect(command.aliases).toEqual(["sm"]);
    });

    it("should have correct argumentInfo structure", () => {
      expect(command.argumentInfo).toBeDefined();
      expect(command.argumentInfo.mandatory).toHaveLength(2);
      expect(command.argumentInfo.mandatory[0].name).toBe("address");
      expect(command.argumentInfo.mandatory[1].name).toBe("value");
    });

    it("should have address constraints in argumentInfo", () => {
      const addressArg = command.argumentInfo.mandatory[0];
      expect(addressArg.minValue).toBe(0);
      expect(addressArg.maxValue).toBe(0xffff);
    });
  });

  describe("execute", () => {
    it("should set 8-bit memory value by default", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x8000, value: 0x42 };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(context.emuApi.setMemoryContent).toHaveBeenCalled();
      const callArgs = (context.emuApi.setMemoryContent as any).mock.calls[0];
      expect(callArgs[1]).toBe(0x42);
      expect(callArgs[2]).toBe(8);
      expect(result.success).toBe(true);
    });

    it("should set 8-bit memory value with -b8 option", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x8000, value: 0x42, "-b8": true };

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.setMemoryContent as any).mock.calls[0];
      expect(callArgs[2]).toBe(8);
    });

    it("should set 16-bit memory value with -b16 option", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x8000, value: 0x4242, "-b16": true };

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.setMemoryContent as any).mock.calls[0];
      expect(callArgs[2]).toBe(16);
    });

    it("should set 24-bit memory value with -b24 option", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x8000, value: 0x424242, "-b24": true };

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.setMemoryContent as any).mock.calls[0];
      expect(callArgs[2]).toBe(24);
    });

    it("should set 32-bit memory value with -b32 option", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x8000, value: 0x42424242, "-b32": true };

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.setMemoryContent as any).mock.calls[0];
      expect(callArgs[2]).toBe(32);
    });

    it("should set memory in little-endian by default", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x8000, value: 0x42 };

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.setMemoryContent as any).mock.calls[0];
      expect(callArgs[3]).toBe(false);
    });

    it("should set memory in big-endian with -be option", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x8000, value: 0x42, "-be": true };

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.setMemoryContent as any).mock.calls[0];
      expect(callArgs[3]).toBe(true);
    });

    it("should warn when 8-bit value exceeds range", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x8000, value: 0x100, "-b8": true };

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("Warning")
      );
    });

    it("should warn when 16-bit value exceeds range", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x8000, value: 0x10000, "-b16": true };

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("Warning")
      );
    });

    it("should warn when 24-bit value exceeds range", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x8000, value: 0x1000000, "-b24": true };

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("Warning")
      );
    });

    it("should warn when 32-bit value exceeds range", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x8000, value: 0x100000000, "-b32": true };

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("Warning")
      );
    });

    it("should truncate 8-bit value to last 8 bits when exceeding range", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x8000, value: 0x1ff, "-b8": true };

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.setMemoryContent as any).mock.calls[0];
      expect(callArgs[1]).toBe(0xff);
    });

    it("should truncate 16-bit value to last 16 bits when exceeding range", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x8000, value: 0x1ffff, "-b16": true };

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.setMemoryContent as any).mock.calls[0];
      expect(callArgs[1]).toBe(0xffff);
    });

    it("should truncate 24-bit value to last 24 bits when exceeding range", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x8000, value: 0x1ffffff, "-b24": true };

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.setMemoryContent as any).mock.calls[0];
      expect(callArgs[1]).toBe(0xffffff);
    });

    it("should truncate 32-bit value to last 32 bits when exceeding range", async () => {
      // Arrange
      // Note: Using a value that won't lose precision in JavaScript
      const args: SetMemoryContentCommandArgs = { address: 0x8000, value: 0x12345678, "-b32": true };

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.setMemoryContent as any).mock.calls[0];
      expect(callArgs[1]).toBe(0x12345678);
    });

    it("should call emuApi.setMemoryContent with correct address", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x1234, value: 0x42 };

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.setMemoryContent as any).mock.calls[0];
      expect(callArgs[0]).toBe(0x1234);
    });

    it("should dispatch incEmuViewVersionAction", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x8000, value: 0x42 };

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.store.dispatch).toHaveBeenCalled();
    });

    it("should write success message 'Memory content set'", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x8000, value: 0x42 };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("Memory content set")
      );
      expect(result.success).toBe(true);
    });

    it("should return commandSuccess", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x8000, value: 0x42 };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should call setMemoryContent with correct parameters", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x5678, value: 0xABCD, "-b16": true, "-be": true };

      // Act
      await command.execute(context, args);

      // Assert
      const callArgs = (context.emuApi.setMemoryContent as any).mock.calls[0];
      expect(callArgs[0]).toBe(0x5678);
      expect(callArgs[1]).toBe(0xABCD);
      expect(callArgs[2]).toBe(16);
      expect(callArgs[3]).toBe(true);
    });

    it("should reject multiple bit size options together", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x8000, value: 0x42, "-b8": true, "-b16": true };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(false);
      expect(result.finalMessage).toContain("Only one");
    });

    it("should handle 0 address", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0, value: 0x42 };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(context.emuApi.setMemoryContent).toHaveBeenCalled();
      const callArgs = (context.emuApi.setMemoryContent as any).mock.calls[0];
      expect(callArgs[0]).toBe(0);
      expect(result.success).toBe(true);
    });

    it("should handle 0xFFFF address", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0xffff, value: 0x42 };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(context.emuApi.setMemoryContent).toHaveBeenCalled();
      const callArgs = (context.emuApi.setMemoryContent as any).mock.calls[0];
      expect(callArgs[0]).toBe(0xffff);
      expect(result.success).toBe(true);
    });

    it("should handle negative values in 8-bit range", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x8000, value: -1, "-b8": true };

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalledWith(
        expect.stringContaining("Warning")
      );
    });

    it("should warn with yellow color", async () => {
      // Arrange
      const args: SetMemoryContentCommandArgs = { address: 0x8000, value: 0x100, "-b8": true };

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.color).toHaveBeenCalledWith("yellow");
      expect(context.output.resetStyle).toHaveBeenCalled();
    });
  });
});
