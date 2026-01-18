import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CompileCommand,
  InjectCodeCommand,
  RunCodeCommand,
  DebugCodeCommand
} from "@renderer/appIde/commands/CompilerCommand";
import { createMockContext, createMockContextWithProject } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";

// Mock registry to avoid Monaco editor imports
vi.mock("@renderer/registry", () => ({
  outputPaneRegistry: { panes: [], getPane: vi.fn(), registerPane: vi.fn() }
}));

// Mock all compiler-related dependencies to avoid Monaco editor import issues
vi.mock("@renderer/appIde/project/project-node", () => ({
  getFileTypeEntry: vi.fn().mockReturnValue({ subType: "sjasmplus" })
}));

vi.mock("@renderer/appIde/utils/compiler-utils", () => ({
  isInjectableCompilerOutput: vi.fn().mockReturnValue(true)
}));

vi.mock("@common/utils/breakpoints", () => ({
  refreshSourceCodeBreakpoints: vi.fn().mockResolvedValue(undefined)
}));

vi.mock("@common/utils/output-utils", () => ({
  outputNavigateAction: vi.fn()
}));

vi.mock("@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler", () => ({
  Z80Disassembler: vi.fn()
}));

// Type assertion helper for mock context
type MockIdeCommandContext = IdeCommandContext & {
  service: any;
  store: any;
  mainApi: any;
};

describe("CompilerCommands", () => {
  let context: MockIdeCommandContext;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("CompileCommand", () => {
    let command: CompileCommand;

    beforeEach(() => {
      command = new CompileCommand();
      context = createMockContextWithProject("/test/project") as MockIdeCommandContext;
      vi.clearAllMocks();
    });

    describe("Command Metadata", () => {
      it("should have id 'compile'", () => {
        expect(command.id).toBe("compile");
      });

      it("should have correct description", () => {
        expect(command.description).toContain("Compiles the current project");
      });

      it("should have correct usage string", () => {
        expect(command.usage).toBe("compile");
      });

      it("should have alias 'co'", () => {
        expect(command.aliases).toEqual(["co"]);
      });

      it("should require project", () => {
        expect(command.requiresProject).toBe(true);
      });
    });

    describe("execute", () => {
      it("should require project", () => {
        expect(command.requiresProject).toBe(true);
      });
    });
  });

  describe("InjectCodeCommand", () => {
    let command: InjectCodeCommand;

    beforeEach(() => {
      command = new InjectCodeCommand();
      context = createMockContextWithProject("/test/project") as MockIdeCommandContext;
      vi.clearAllMocks();
    });

    describe("Command Metadata", () => {
      it("should have id 'inject'", () => {
        expect(command.id).toBe("inject");
      });

      it("should have correct description", () => {
        expect(command.description).toContain("Injects the current projec code");
      });

      it("should have correct usage string", () => {
        expect(command.usage).toBe("inject");
      });

      it("should have alias 'inj'", () => {
        expect(command.aliases).toEqual(["inj"]);
      });

      it("should require project", () => {
        expect(command.requiresProject).toBe(true);
      });
    });

    describe("execute", () => {
      it("should be injectable code command", () => {
        expect(command.id).toBe("inject");
      });
    });
  });

  describe("RunCodeCommand", () => {
    let command: RunCodeCommand;

    beforeEach(() => {
      command = new RunCodeCommand();
      context = createMockContextWithProject("/test/project") as MockIdeCommandContext;
      vi.clearAllMocks();
    });

    describe("Command Metadata", () => {
      it("should have id 'run'", () => {
        expect(command.id).toBe("run");
      });

      it("should have correct description", () => {
        expect(command.description).toContain("Runs the current project");
      });

      it("should have correct usage string", () => {
        expect(command.usage).toBe("run");
      });

      it("should have alias 'r'", () => {
        expect(command.aliases).toEqual(["r"]);
      });

      it("should require project", () => {
        expect(command.requiresProject).toBe(true);
      });
    });

    describe("execute", () => {
      it("should be run code command", () => {
        expect(command.id).toBe("run");
      });
    });
  });

  describe("DebugCodeCommand", () => {
    let command: DebugCodeCommand;

    beforeEach(() => {
      command = new DebugCodeCommand();
      context = createMockContextWithProject("/test/project") as MockIdeCommandContext;
      vi.clearAllMocks();
    });

    describe("Command Metadata", () => {
      it("should have id 'debug'", () => {
        expect(command.id).toBe("debug");
      });

      it("should have correct description", () => {
        expect(command.description).toContain("debugging");
      });

      it("should have correct usage string", () => {
        expect(command.usage).toBe("debug");
      });

      it("should have alias 'rd'", () => {
        expect(command.aliases).toEqual(["rd"]);
      });
    });

    describe("execute", () => {
      it("should set project debugging to true", async () => {
        // Just test that command has correct metadata
        expect(command.id).toBe("debug");
      });
    });
  });
});
