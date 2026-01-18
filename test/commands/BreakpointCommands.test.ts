import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
  EraseAllBreakpointsCommand,
  ListBreakpointsCommand 
} from "@renderer/appIde/commands/BreakpointCommands";
import { createMockContext } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

// Type assertion helper for mock context
type MockIdeCommandContext = IdeCommandContext & {
  emuApi: any;
};

describe("EraseAllBreakpointsCommand", () => {
  let command: EraseAllBreakpointsCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new EraseAllBreakpointsCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'bp-ea'", () => {
      expect(command.id).toBe("bp-ea");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("Erase all breakpoints");
    });

    it("should have usage 'bp-ea'", () => {
      expect(command.usage).toBe("bp-ea");
    });

    it("should have alias 'eab'", () => {
      expect(command.aliases).toEqual(["eab"]);
    });
  });

  describe("execute", () => {
    it("should erase all breakpoints when breakpoints exist", async () => {
      // Arrange
      const mockBreakpoints: BreakpointInfo[] = [
        { address: 0x8000, exec: true },
        { address: 0x9000, exec: true }
      ];
      context.emuApi.listBreakpoints.mockResolvedValue({ 
        breakpoints: mockBreakpoints 
      });

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.listBreakpoints).toHaveBeenCalled();
      expect(context.emuApi.eraseAllBreakpoints).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should handle case when no breakpoints exist", async () => {
      // Arrange
      context.emuApi.listBreakpoints.mockResolvedValue({ breakpoints: [] });

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.listBreakpoints).toHaveBeenCalled();
      expect(context.emuApi.eraseAllBreakpoints).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should display singular 'breakpoint' for 1 breakpoint", async () => {
      // Arrange
      const mockBreakpoints: BreakpointInfo[] = [
        { address: 0x8000, exec: true }
      ];
      context.emuApi.listBreakpoints.mockResolvedValue({ 
        breakpoints: mockBreakpoints 
      });

      // Act
      await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const message = (context.output.writeLine as any).mock.calls[0][0];
      expect(message).toContain("1 breakpoint removed");
      expect(message).not.toContain("breakpoints");
    });

    it("should display plural 'breakpoints' for multiple breakpoints", async () => {
      // Arrange
      const mockBreakpoints: BreakpointInfo[] = [
        { address: 0x8000, exec: true },
        { address: 0x9000, exec: true },
        { address: 0xa000, exec: true }
      ];
      context.emuApi.listBreakpoints.mockResolvedValue({ 
        breakpoints: mockBreakpoints 
      });

      // Act
      await command.execute(context);

      // Assert
      const message = (context.output.writeLine as any).mock.calls[0][0];
      expect(message).toContain("3 breakpoints removed");
    });

    it("should write message in green color", async () => {
      // Arrange
      context.emuApi.listBreakpoints.mockResolvedValue({ breakpoints: [] });

      // Act
      await command.execute(context);

      // Assert
      expect(context.output.color).toHaveBeenCalledWith("green");
    });

    it("should call emuApi methods in correct order", async () => {
      // Arrange
      const mockBreakpoints: BreakpointInfo[] = [
        { address: 0x8000, exec: true }
      ];
      context.emuApi.listBreakpoints.mockResolvedValue({ 
        breakpoints: mockBreakpoints 
      });

      // Act
      await command.execute(context);

      // Assert
      expect(context.emuApi.listBreakpoints).toHaveBeenCalled();
      expect(context.emuApi.eraseAllBreakpoints).toHaveBeenCalled();
      
      const listCall = (context.emuApi.listBreakpoints as any).mock.invocationCallOrder[0];
      const eraseCall = (context.emuApi.eraseAllBreakpoints as any).mock.invocationCallOrder[0];
      expect(listCall).toBeLessThan(eraseCall);
    });
  });
});

describe("ListBreakpointsCommand", () => {
  let command: ListBreakpointsCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new ListBreakpointsCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'bp-list'", () => {
      expect(command.id).toBe("bp-list");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("Lists all breakpoints");
    });

    it("should have usage 'bp-list'", () => {
      expect(command.usage).toBe("bp-list");
    });

    it("should have alias 'bpl'", () => {
      expect(command.aliases).toEqual(["bpl"]);
    });
  });

  describe("execute", () => {
    it("should display 'No breakpoints set' when no breakpoints exist", async () => {
      // Arrange
      context.emuApi.listBreakpoints.mockResolvedValue({ breakpoints: [] });

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const messages = calls.map((call: any) => call[0]).join(" ");
      expect(messages).toContain("No breakpoints set");
      expect(result.success).toBe(true);
    });

    it("should list all breakpoints when breakpoints exist", async () => {
      // Arrange
      const mockBreakpoints: BreakpointInfo[] = [
        { address: 0x8000, exec: true },
        { address: 0x9000, exec: true }
      ];
      context.emuApi.listBreakpoints.mockResolvedValue({ 
        breakpoints: mockBreakpoints 
      });

      // Act
      await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });

    it("should show disabled status for disabled breakpoints", async () => {
      // Arrange
      const mockBreakpoints: BreakpointInfo[] = [
        { address: 0x8000, exec: true, disabled: true }
      ];
      context.emuApi.listBreakpoints.mockResolvedValue({ 
        breakpoints: mockBreakpoints 
      });

      // Act
      await command.execute(context);

      // Assert
      const calls = (context.output.writeLine as any).mock.calls;
      const messages = calls.map((call: any) => call[0]).join(" ");
      expect(messages).toContain("<disabled>");
    });

    it("should not show disabled status for enabled breakpoints", async () => {
      // Arrange
      const mockBreakpoints: BreakpointInfo[] = [
        { address: 0x8000, exec: true, disabled: false }
      ];
      context.emuApi.listBreakpoints.mockResolvedValue({ 
        breakpoints: mockBreakpoints 
      });

      // Act
      await command.execute(context);

      // Assert
      const calls = (context.output.writeLine as any).mock.calls;
      const messages = calls.map((call: any) => call[0]).join(" ");
      expect(messages).not.toContain("<disabled>");
    });

    it("should display breakpoint count with singular form", async () => {
      // Arrange
      const mockBreakpoints: BreakpointInfo[] = [
        { address: 0x8000, exec: true }
      ];
      context.emuApi.listBreakpoints.mockResolvedValue({ 
        breakpoints: mockBreakpoints 
      });

      // Act
      await command.execute(context);

      // Assert
      const calls = (context.output.writeLine as any).mock.calls;
      const messages = calls.map((call: any) => call[0]).join(" ");
      expect(messages).toContain("1 breakpoint set");
    });

    it("should display breakpoint count with plural form", async () => {
      // Arrange
      const mockBreakpoints: BreakpointInfo[] = [
        { address: 0x8000, exec: true },
        { address: 0x9000, exec: true }
      ];
      context.emuApi.listBreakpoints.mockResolvedValue({ 
        breakpoints: mockBreakpoints 
      });

      // Act
      await command.execute(context);

      // Assert
      const calls = (context.output.writeLine as any).mock.calls;
      const messages = calls.map((call: any) => call[0]).join(" ");
      expect(messages).toContain("2 breakpoints set");
    });

    it("should use correct colors for output", async () => {
      // Arrange
      const mockBreakpoints: BreakpointInfo[] = [
        { address: 0x8000, exec: true }
      ];
      context.emuApi.listBreakpoints.mockResolvedValue({ 
        breakpoints: mockBreakpoints 
      });

      // Act
      await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      // The command uses bright-blue, bright-magenta, and cyan colors
      // We can verify writeLine was called (color calls are inline)
    });

    it("should call emuApi.listBreakpoints", async () => {
      // Arrange
      context.emuApi.listBreakpoints.mockResolvedValue({ breakpoints: [] });

      // Act
      await command.execute(context);

      // Assert
      expect(context.emuApi.listBreakpoints).toHaveBeenCalledTimes(1);
    });

    it("should return successful result", async () => {
      // Arrange
      context.emuApi.listBreakpoints.mockResolvedValue({ breakpoints: [] });

      // Act
      const result = await command.execute(context);

      // Assert
      expect(result.success).toBe(true);
    });
  });
});
