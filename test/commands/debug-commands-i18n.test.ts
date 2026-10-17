import { afterEach, describe, expect, it } from "vitest";
import { setLanguage } from "@common/i18n/i18n";
import { historyReasonText } from "@common/history/historyNavigation";
import { forkConfirmation, type ForkAction } from "@common/history/reverseDebugText";
import * as breakpointCommands from "@renderer/appIde/commands/BreakpointCommands";
import * as historyCommands from "@renderer/appIde/commands/HistoryCommands";
import * as machineCommands from "@renderer/appIde/commands/MachineCommands";
import * as watchCommands from "@renderer/appIde/commands/WatchCommands";
import * as navigationCommands from "@renderer/appIde/commands/NavigationCommands";
import * as setMemoryCommand from "@renderer/appIde/commands/SetMemoryContentCommand";
import * as setRegisterCommand from "@renderer/appIde/commands/SetZ80RegisterCommand";
import * as runToCursorCommand from "@renderer/appIde/commands/RunToCursorCommand";
import * as numCommand from "@renderer/appIde/commands/NumCommand";
import * as clearHistoryCommand from "@renderer/appIde/commands/ClearHistoryCommand";
import * as clearScreenCommand from "@renderer/appIde/commands/ClearScreenCommand";

/*
 * The debugging commands in the pseudo-locale (`.plans/LOCALIZATION_PLAN.md` step 12): every
 * command description, the history reasons and the fork confirmation are pseudo text, so none of
 * them is still a hard-coded English string.
 */
const isPseudo = (text: string) => /^\[.*~+\]$/s.test(text);

const MODULES = [
  breakpointCommands,
  historyCommands,
  machineCommands,
  watchCommands,
  navigationCommands,
  setMemoryCommand,
  setRegisterCommand,
  runToCursorCommand,
  numCommand,
  clearHistoryCommand,
  clearScreenCommand
];

/** Every concrete command class the modules export */
function commandsOf(module: Record<string, unknown>): { id: string; description: string }[] {
  const result: { id: string; description: string }[] = [];
  for (const value of Object.values(module)) {
    if (typeof value !== "function" || typeof value.prototype?.execute !== "function") continue;
    const command = new (value as new () => { id?: string; description?: string })();
    if (command.id) result.push({ id: command.id, description: command.description ?? "" });
  }
  return result;
}

describe("the debugging commands in the pseudo-locale", () => {
  afterEach(() => setLanguage("en"));

  it("translates every command description", () => {
    setLanguage("qps");
    const commands = MODULES.flatMap((m) => commandsOf(m as Record<string, unknown>));
    expect(commands.length).toBeGreaterThan(40);
    const problems = commands.filter((c) => !isPseudo(c.description)).map((c) => `${c.id}: ${c.description}`);
    expect(problems).toEqual([]);
  });

  it("translates the history reasons and the fork confirmation", () => {
    setLanguage("qps");
    for (const reason of ["start", "noHit", "noCall", "present", "empty", "running", "noHistory", "gone", "canceled"] as const) {
      expect(isPseudo(historyReasonText({ reason })!)).toBe(true);
      expect(isPseudo(historyReasonText({ reason }, 42)!)).toBe(true);
    }
    const actions: ForkAction[] = [
      { kind: "takeOver" },
      { kind: "editMemory" },
      { kind: "editRegister", register: "HL" },
      { kind: "editVariable", name: "score" }
    ];
    for (const action of actions) {
      const text = forkConfirmation({ sdWrites: 2, hostFiles: ["a.tzx"] }, action);
      expect(isPseudo(text.title)).toBe(true);
      expect(isPseudo(text.message)).toBe(true);
      expect(isPseudo(text.confirmLabel)).toBe(true);
      for (const paragraph of text.detail.split("\n\n")) expect(isPseudo(paragraph)).toBe(true);
    }
  });

  it("asks a whole question per fork action in English", () => {
    expect(forkConfirmation(undefined).message).toBe("Continue from this point in the past?");
    expect(forkConfirmation(undefined, { kind: "editMemory" }).message).toBe("Edit memory in the past?");
    expect(forkConfirmation(undefined, { kind: "editVariable", name: "score" }).message).toBe("Edit score in the past?");
  });
});
