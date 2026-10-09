import { describe, expect, it } from "vitest";

import { createInteractiveCommandsService } from "@renderer/appIde/services/IdeCommandService";
import { registerIdeCommands } from "@renderer/appIde/IdeCommands";
import { automationDeniedCommand, outputBufferLines } from "@renderer/appIde/MainToIdeProcessor";
import { OutputPaneBuffer } from "@renderer/appIde/ToolArea/OutputPaneBuffer";
import { buildDiagnosticsValue } from "@renderer/appIde/utils/compile-code";

/*
 * The IDE side of automation (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D9, D10, T5).
 */

describe("automation: commands that cannot run unattended (T5)", () => {
  const service = createInteractiveCommandsService({ getState: () => ({}) } as any, {} as any, "ide");
  registerIdeCommands(service);

  it("lists them: quitting, dialogs and confirmations", () => {
    const denied = service
      .getRegisteredCommands()
      .filter((c) => c.automation === "deny")
      .map((c) => c.id)
      .sort();
    expect(denied).toEqual(["display-dialog", "exit", "history-take-over", "settings"]);
  });

  it("refuses them by id or alias, and lets everything else through", () => {
    expect(automationDeniedCommand(service, "exit")).toBe("exit");
    expect(automationDeniedCommand(service, "  settings general")).toBe("settings");
    expect(automationDeniedCommand(service, "bp-set $8000")).toBeUndefined();
    expect(automationDeniedCommand(service, "nosuchcommand")).toBeUndefined();
    expect(automationDeniedCommand(service, "")).toBeUndefined();
  });
});

describe("automation: captured output (D9)", () => {
  it("returns the lines as plain text, colours and styles dropped", () => {
    const buffer = new OutputPaneBuffer();
    buffer.color("bright-red");
    buffer.bold(true);
    buffer.write("Z0101: ");
    buffer.bold(false);
    buffer.color("bright-cyan");
    buffer.writeLine("main.asm:3");
    buffer.resetStyle();
    buffer.writeLine("Compilation failed.");
    expect(outputBufferLines(buffer)).toEqual(["Z0101: main.asm:3", "Compilation failed."]);
  });
});

describe("automation: a build's structured result (D10)", () => {
  it("maps the compiler's errors and warnings", () => {
    const value = buildDiagnosticsValue({
      errors: [
        { errorCode: "Z0101", filename: "/p/main.asm", line: 3, startPosition: 0, endPosition: 0, startColumn: 5, endColumn: 9, message: "Unknown instruction" },
        { errorCode: "W001", filename: "/p/main.asm", line: 9, startPosition: 0, endPosition: 0, startColumn: 0, endColumn: 0, message: "Unused", isWarning: true }
      ]
    } as any);
    expect(value).toEqual({
      errors: [
        { file: "/p/main.asm", line: 3, column: 5, code: "Z0101", message: "Unknown instruction" },
        { file: "/p/main.asm", line: 9, column: 0, code: "W001", message: "Unused", warning: true }
      ]
    });
    expect(buildDiagnosticsValue(undefined)).toEqual({ errors: [] });
  });
});
