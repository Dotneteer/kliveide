import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClearHistoryCommand } from "@renderer/appIde/commands/ClearHistoryCommand";
import { createMockContext } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";

describe("ClearHistoryCommand", () => {
  let command: ClearHistoryCommand;
  let context: IdeCommandContext;

  beforeEach(() => {
    command = new ClearHistoryCommand();
    context = createMockContext();
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'clh'", () => {
      expect(command.id).toBe("clh");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("Clears the command prompt history");
    });

    it("should have usage 'clh'", () => {
      expect(command.usage).toBe("clh");
    });

    it("should have empty aliases array", () => {
      // Base class defaults to empty array
      expect(command.aliases).toEqual([]);
    });

    it("should not require a project", () => {
      expect(command.requiresProject).toBeFalsy();
    });

    it("should have empty or default argument info", () => {
      // Commands inherit default empty argumentInfo object from base class
      expect(command.argumentInfo).toBeDefined();
    });
  });

  describe("execute", () => {
    it("should call ideCommandsService.clearHistory()", async () => {
      // Act
      await command.execute(context);

      // Assert
      expect(context.service.ideCommandsService.clearHistory).toHaveBeenCalledTimes(1);
    });

    it("should write success message to output", async () => {
      // Act
      await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const message = (context.output.writeLine as any).mock.calls[0][0];
      expect(message).toContain("Interactive command prompt history cleared");
    });

    it("should return successful command result", async () => {
      // Act
      const result = await command.execute(context);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should not modify store state", async () => {
      // Act
      await command.execute(context);

      // Assert
      expect(context.store.dispatch).not.toHaveBeenCalled();
    });

    it("should not call emulator APIs", async () => {
      // Act
      await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).not.toHaveBeenCalled();
      expect(context.emuApi.listBreakpoints).not.toHaveBeenCalled();
    });

    it("should not call main APIs", async () => {
      // Act
      await command.execute(context);

      // Assert
      expect(context.mainApi.openFolder).not.toHaveBeenCalled();
      expect(context.mainApi.exitApp).not.toHaveBeenCalled();
    });

    it("should call clearHistory before writing output", async () => {
      // Arrange
      const callOrder: string[] = [];
      context.service.ideCommandsService.clearHistory = vi.fn(() => {
        callOrder.push("clearHistory");
      });
      context.output.writeLine = vi.fn(() => {
        callOrder.push("writeLine");
      }) as any;

      // Act
      await command.execute(context);

      // Assert
      expect(callOrder).toEqual(["clearHistory", "writeLine"]);
    });
  });
});
