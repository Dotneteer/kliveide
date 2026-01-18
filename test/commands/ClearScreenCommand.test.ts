import { describe, it, expect, vi, beforeEach } from "vitest";
import { ClearScreenCommand } from "@renderer/appIde/commands/ClearScreenCommand";
import { createMockContext } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";

describe("ClearScreenCommand", () => {
  let command: ClearScreenCommand;
  let context: IdeCommandContext;

  beforeEach(() => {
    command = new ClearScreenCommand();
    context = createMockContext();
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'cls'", () => {
      expect(command.id).toBe("cls");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("Clears the interactive command output");
    });

    it("should have usage 'cls'", () => {
      expect(command.usage).toBe("cls");
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
    it("should call output.clear()", async () => {
      // Act
      await command.execute(context);

      // Assert
      expect(context.output.clear).toHaveBeenCalledTimes(1);
    });

    it("should return successful command result", async () => {
      // Act
      const result = await command.execute(context);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should not write any messages to output", async () => {
      // Act
      await command.execute(context);

      // Assert
      expect(context.output.writeLine).not.toHaveBeenCalled();
      expect(context.output.write).not.toHaveBeenCalled();
    });

    it("should not modify store state", async () => {
      // Act
      await command.execute(context);

      // Assert
      expect(context.store.dispatch).not.toHaveBeenCalled();
    });

    it("should not call any APIs", async () => {
      // Act
      await command.execute(context);

      // Assert
      expect(context.emuApi.issueMachineCommand).not.toHaveBeenCalled();
      expect(context.mainApi.openFolder).not.toHaveBeenCalled();
    });
  });
});
