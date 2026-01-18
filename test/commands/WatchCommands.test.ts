import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  AddWatchCommand,
  RemoveWatchCommand,
  ListWatchCommand,
  EraseAllWatchCommand
} from "@renderer/appIde/commands/WatchCommands";
import { createMockContext } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";

// Type assertion helper for mock context
type MockIdeCommandContext = IdeCommandContext & {
  store: any;
};

// This type mirrors the internal WatchSpecArgs type
type WatchSpecArgs = {
  watchSpec?: string;
  symbol?: string;
  type?: string;
  length?: number;
  direct?: boolean;
};

type WatchSymbolArgs = {
  symbol: string;
};

describe("AddWatchCommand", () => {
  let command: AddWatchCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new AddWatchCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'w-add'", () => {
      expect(command.id).toBe("w-add");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("Adds a watch expression for a symbol");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toContain("symbol");
      expect(command.usage).toContain("type");
      expect(command.usage).toContain("length");
    });

    it("should have alias 'w'", () => {
      expect(command.aliases).toEqual(["w"]);
    });
  });

  describe("validateCommandArgs", () => {
    it("should validate simple symbol name", async () => {
      // Arrange
      const args: WatchSpecArgs = { watchSpec: "mySymbol" };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBe(0);
      expect(args.symbol).toBe("mySymbol");
      expect(args.type).toBe("b");
    });

    it("should validate symbol with type", async () => {
      // Arrange
      const args: WatchSpecArgs = { watchSpec: "myVar:w" };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBe(0);
      expect(args.symbol).toBe("myVar");
      expect(args.type).toBe("w");
    });

    it("should validate symbol with type and length", async () => {
      // Arrange
      const args: WatchSpecArgs = { watchSpec: "myArray:a:16" };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBe(0);
      expect(args.symbol).toBe("myArray");
      expect(args.type).toBe("a");
      expect(args.length).toBe(16);
    });

    it("should parse direct flag", async () => {
      // Arrange
      const args: WatchSpecArgs = { watchSpec: ">myVar" };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBe(0);
      expect(args.direct).toBe(true);
      expect(args.symbol).toBe("myVar");
    });

    it("should reject empty watch specification", async () => {
      // Arrange
      const args: WatchSpecArgs = { watchSpec: "" };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].message).toContain("empty");
    });

    it("should reject invalid symbol name", async () => {
      // Arrange
      const args: WatchSpecArgs = { watchSpec: "123invalid" };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].message).toContain("Invalid symbol");
    });

    it("should reject invalid type", async () => {
      // Arrange
      const args: WatchSpecArgs = { watchSpec: "myVar:invalid" };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].message).toContain("Invalid type");
    });

    it("should reject length for non-array/string types", async () => {
      // Arrange
      const args: WatchSpecArgs = { watchSpec: "myVar:b:16" };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].message).toContain("Length specification");
    });

    it("should reject invalid length", async () => {
      // Arrange
      const args: WatchSpecArgs = { watchSpec: "myArray:a:invalid" };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].message).toContain("must be a positive number");
    });

    it("should reject length too large", async () => {
      // Arrange
      const args: WatchSpecArgs = { watchSpec: "myArray:a:2000" };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].message).toContain("between 1 and 1024");
    });
  });

  describe("execute", () => {
    it("should add watch to Redux store", async () => {
      // Arrange
      const args: WatchSpecArgs = { watchSpec: "myVar:b", symbol: "myVar", type: "b" };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.store.dispatch).toHaveBeenCalled();
    });

    it("should display success message", async () => {
      // Arrange
      const args: WatchSpecArgs = { watchSpec: "myVar:b", symbol: "myVar", type: "b" };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
    });

    it("should display symbol name in uppercase", async () => {
      // Arrange
      const args: WatchSpecArgs = { watchSpec: "myvar:b", symbol: "myvar", type: "b" };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const message = calls.map((call: any) => call[0]).join(" ");
      expect(message.toUpperCase()).toContain("MYVAR");
    });

    it("should display type description", async () => {
      // Arrange
      const args: WatchSpecArgs = { watchSpec: "myArray:a:16", symbol: "myArray", type: "a", length: 16 };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
    });

    it("should return successful result", async () => {
      // Arrange
      const args: WatchSpecArgs = { watchSpec: "myVar:b", symbol: "myVar", type: "b" };
      await command.validateCommandArgs(context, args);

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
    });
  });
});

describe("RemoveWatchCommand", () => {
  let command: RemoveWatchCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new RemoveWatchCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'w-del'", () => {
      expect(command.id).toBe("w-del");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("Removes a watch expression by symbol name");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toBe("w-del <symbol>");
    });

    it("should have alias 'wd'", () => {
      expect(command.aliases).toEqual(["wd"]);
    });
  });

  describe("validateCommandArgs", () => {
    it("should validate symbol name", async () => {
      // Arrange
      const args: WatchSymbolArgs = { symbol: "myVar" };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBe(0);
    });

    it("should reject empty symbol", async () => {
      // Arrange
      const args: WatchSymbolArgs = { symbol: "" };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].message).toContain("empty");
    });

    it("should reject invalid symbol name", async () => {
      // Arrange
      const args: WatchSymbolArgs = { symbol: "invalid-name" };

      // Act
      const messages = await command.validateCommandArgs(context, args);

      // Assert
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].message).toContain("Invalid symbol");
    });
  });

  describe("execute", () => {
    it("should remove watch from Redux store", async () => {
      // Arrange
      const args: WatchSymbolArgs = { symbol: "myVar" };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.store.dispatch).toHaveBeenCalled();
    });

    it("should display success message", async () => {
      // Arrange
      const args: WatchSymbolArgs = { symbol: "myVar" };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const message = calls.map((call: any) => call[0]).join(" ");
      expect(message).toContain("removed");
    });

    it("should display symbol name in uppercase", async () => {
      // Arrange
      const args: WatchSymbolArgs = { symbol: "myvar" };
      await command.validateCommandArgs(context, args);

      // Act
      await command.execute(context, args);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const message = calls.map((call: any) => call[0]).join(" ");
      expect(message).toContain("MYVAR");
    });

    it("should return successful result", async () => {
      // Arrange
      const args: WatchSymbolArgs = { symbol: "myVar" };
      await command.validateCommandArgs(context, args);

      // Act
      const result = await command.execute(context, args);

      // Assert
      expect(result.success).toBe(true);
    });
  });
});

describe("ListWatchCommand", () => {
  let command: ListWatchCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new ListWatchCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'w-list'", () => {
      expect(command.id).toBe("w-list");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("Lists all defined watch expressions");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toBe("w-list");
    });

    it("should have alias 'wl'", () => {
      expect(command.aliases).toEqual(["wl"]);
    });
  });

  describe("execute", () => {
    it("should display message when no watches defined", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({ watchExpressions: [] });

      // Act
      await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const message = calls.map((call: any) => call[0]).join(" ");
      expect(message).toContain("No watch");
    });

    it("should list all watch expressions", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        watchExpressions: [
          { symbol: "var1", type: "b" },
          { symbol: "var2", type: "w" }
        ]
      });

      // Act
      await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
    });

    it("should display correct count for single watch", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        watchExpressions: [{ symbol: "var1", type: "b" }]
      });

      // Act
      await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const messages = calls.map((call: any) => call[0]);
      const message = messages.join(" ");
      expect(message).toContain("1 watch expression");
      expect(message).not.toContain("1 watch expressions");
    });

    it("should display correct count for multiple watches", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({
        watchExpressions: [
          { symbol: "var1", type: "b" },
          { symbol: "var2", type: "w" },
          { symbol: "var3", type: "l" }
        ]
      });

      // Act
      await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const message = calls.map((call: any) => call[0]).join(" ");
      expect(message).toContain("3 watch expressions");
    });

    it("should return successful result", async () => {
      // Arrange
      const mockStore = context.store as any;
      mockStore.getState.mockReturnValue({ watchExpressions: [] });

      // Act
      const result = await command.execute(context);

      // Assert
      expect(result.success).toBe(true);
    });
  });
});

describe("EraseAllWatchCommand", () => {
  let command: EraseAllWatchCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new EraseAllWatchCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'w-ea'", () => {
      expect(command.id).toBe("w-ea");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("Erases all watch expressions");
    });

    it("should have correct usage string", () => {
      expect(command.usage).toBe("w-ea");
    });

    it("should have alias 'wea'", () => {
      expect(command.aliases).toEqual(["wea"]);
    });
  });

  describe("execute", () => {
    it("should dispatch clear action", async () => {
      // Arrange
      // No arguments needed

      // Act
      await command.execute(context);

      // Assert
      expect(context.store.dispatch).toHaveBeenCalled();
    });

    it("should display success message", async () => {
      // Arrange
      // No arguments needed

      // Act
      await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const message = calls.map((call: any) => call[0]).join(" ");
      expect(message).toContain("removed");
    });

    it("should return successful result", async () => {
      // Arrange
      // No arguments needed

      // Act
      const result = await command.execute(context);

      // Assert
      expect(result.success).toBe(true);
    });
  });
});
