import { beforeEach, describe, expect, it } from "vitest";

import {
  ClearNavigationHistoryCommand,
  NavigateBackCommand,
  NavigateForwardCommand,
  NavigationHistoryCommand
} from "@renderer/appIde/commands/NavigationCommands";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { createMockContext } from "./test-helpers/mock-context";

type Ctx = IdeCommandContext & { service: any; output: any };

function entry(title: string, line: number, reason = "definition") {
  return {
    documentId: `/p/${title}`,
    documentType: "CodeEditor",
    title,
    locator: { kind: "text", line, column: 1 },
    reason,
    time: 0
  };
}

describe("Navigation commands", () => {
  let context: Ctx;

  beforeEach(() => {
    context = createMockContext() as Ctx;
  });

  it("have ids, aliases and usage", () => {
    expect(new NavigateBackCommand()).toMatchObject({ id: "nav-back", aliases: ["nb"] });
    expect(new NavigateForwardCommand()).toMatchObject({ id: "nav-forward", aliases: ["nf"] });
    expect(new NavigationHistoryCommand()).toMatchObject({ id: "nav-history", aliases: ["nh"] });
    expect(new ClearNavigationHistoryCommand().id).toBe("nav-clear");
  });

  it("nav-back goes back, and reports nowhere to go without failing", async () => {
    const history = context.service.navigationHistoryService;
    history.goBack.mockResolvedValueOnce(true);
    expect(await new NavigateBackCommand().execute(context)).toEqual({ success: true });

    history.goBack.mockResolvedValueOnce(false);
    const result = await new NavigateBackCommand().execute(context);
    expect(result.success).toBe(true);
    expect(result.finalMessage).toContain("No location");
  });

  it("nav-forward goes forward, and reports nowhere to go without failing", async () => {
    const history = context.service.navigationHistoryService;
    history.goForward.mockResolvedValueOnce(true);
    expect(await new NavigateForwardCommand().execute(context)).toEqual({ success: true });

    history.goForward.mockResolvedValueOnce(false);
    const result = await new NavigateForwardCommand().execute(context);
    expect(result.success).toBe(true);
    expect(result.finalMessage).toContain("No location");
  });

  it("nav-history lists newest first and marks the current entry", async () => {
    const history = context.service.navigationHistoryService;
    history.getEntries.mockReturnValue({
      entries: [entry("main.asm", 5), entry("utils.asm", 28, "outputLink"), entry("input.asm", 6)],
      index: 1
    });
    history.describe.mockImplementation((e: any) => `line ${e.locator.line}`);

    await new NavigationHistoryCommand().execute(context);

    const lines = context.output.writeLine.mock.calls.map((c: any[]) => c[0]);
    expect(lines).toEqual([
      "  2: input.asm (line 6) [definition]",
      "> 1: utils.asm (line 28) [outputLink]",
      "  0: main.asm (line 5) [definition]"
    ]);
  });

  it("nav-history says when the history is empty", async () => {
    await new NavigationHistoryCommand().execute(context);
    expect(context.output.writeLine).toHaveBeenCalledWith(expect.stringContaining("empty"));
  });

  it("nav-clear clears", async () => {
    const result = await new ClearNavigationHistoryCommand().execute(context);
    expect(context.service.navigationHistoryService.clear).toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});
