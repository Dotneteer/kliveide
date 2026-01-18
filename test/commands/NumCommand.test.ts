import { describe, it, expect, vi, beforeEach } from "vitest";
import { NumCommand } from "@renderer/appIde/commands/NumCommand";
import { createMockContext } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";

describe("NumCommand", () => {
  let command: NumCommand;
  let context: IdeCommandContext;

  beforeEach(() => {
    command = new NumCommand();
    context = createMockContext();
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'num'", () => {
      expect(command.id).toBe("num");
    });

    it("should have correct description", () => {
      expect(command.description).toBe(
        "Converts the specified number to binary, decimal, and hexadecimal"
      );
    });

    it("should have usage 'num <number>'", () => {
      expect(command.usage).toBe("num <number>");
    });

    it("should have empty aliases array", () => {
      expect(command.aliases).toEqual([]);
    });

    it("should have correct argumentInfo", () => {
      expect(command.argumentInfo).toBeDefined();
      expect(command.argumentInfo.mandatory).toHaveLength(1);
      expect(command.argumentInfo.mandatory[0].name).toBe("num");
      expect(command.argumentInfo.mandatory[0].type).toBe("number");
    });
  });

  describe("execute", () => {
    it("should convert positive decimal number to all formats", async () => {
      // Arrange
      const args = { num: 255 };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      expect(context.output.writeLine).toHaveBeenCalled();
      const message = (context.output.writeLine as any).mock.calls[0][0];
      expect(message).toContain("255"); // decimal
      expect(message).toContain("$FF"); // hexadecimal
      expect(message).toMatch(/%0000 0000\s+1111 1111/); // binary with spaces
    });

    it("should convert hexadecimal number to all formats", async () => {
      // Arrange
      const args = { num: 0x1234 };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      const message = (context.output.writeLine as any).mock.calls[0][0];
      expect(message).toContain("4660"); // decimal
      expect(message).toContain("$1234"); // hexadecimal
    });

    it("should format hexadecimal in uppercase", async () => {
      // Arrange
      const args = { num: 0xabcd };

      // Act
      await command.execute(context, args);

      // Assert
      const message = (context.output.writeLine as any).mock.calls[0][0];
      expect(message).toContain("$ABCD");
      expect(message).not.toContain("$abcd");
    });

    it("should handle zero", async () => {
      // Arrange
      const args = { num: 0 };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      const message = (context.output.writeLine as any).mock.calls[0][0];
      expect(message).toContain("0");
      expect(message).toContain("$0");
    });

    it("should handle maximum 16-bit value", async () => {
      // Arrange
      const args = { num: 0xffff };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      const message = (context.output.writeLine as any).mock.calls[0][0];
      expect(message).toContain("65535");
      expect(message).toContain("$FFFF");
    });

    it("should handle negative numbers", async () => {
      // Arrange
      const args = { num: -100 };

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
      const message = (context.output.writeLine as any).mock.calls[0][0];
      expect(message).toContain("-100");
    });

    it("should handle power of 2", async () => {
      // Arrange
      const args = { num: 256 };

      // Act
      await command.execute(context, args);

      // Assert
      const message = (context.output.writeLine as any).mock.calls[0][0];
      expect(message).toContain("256");
      expect(message).toContain("$100");
      expect(message).toMatch(/%0000 0001\s+0000 0000/); // binary with spaces
    });

    it("should write success message with all formats", async () => {
      // Arrange
      const args = { num: 42 };

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalledTimes(1);
      const message = (context.output.writeLine as any).mock.calls[0][0];
      expect(message).toMatch(/Number:.*,.*\$.*,/);
    });

    it("should not modify store state", async () => {
      // Arrange
      const args = { num: 100 };

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.store.dispatch).not.toHaveBeenCalled();
    });

    it("should not call any APIs", async () => {
      // Arrange
      const args = { num: 100 };

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.emuApi.issueMachineCommand).not.toHaveBeenCalled();
      expect(context.mainApi.openFolder).not.toHaveBeenCalled();
    });
  });
});
