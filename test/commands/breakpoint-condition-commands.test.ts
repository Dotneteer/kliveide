import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";

import {
  BreakpointWithAddressCommand,
  EnableBreakpointCommand,
  ListBreakpointsCommand,
  RemoveBreakpointCommand,
  ResetBreakpointHitsCommand,
  SetBreakpointCommand
} from "@renderer/appIde/commands/BreakpointCommands";
import { breakpointCommandSpec, breakpointStatusText } from "@common/utils/breakpoint-spec";
import { extractArguments, splitRawTail } from "@renderer/appIde/services/ide-commands";
import { parseCommand } from "@renderer/appIde/services/command-parser";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";
import { getBreakpointStorageKey } from "@common/utils/breakpoints";
import { formatHitSpec, parseHitSpec } from "@common/utils/breakpoint-filters";
import {
  resetConditionSymbolsForTests,
  setBuildConditionSymbols
} from "@renderer/appIde/utils/condition-symbols";
import { createMockContext } from "./test-helpers/mock-context";

// --- The address-spec validation reaches the emulator through `createEmuApi(messenger)`, as the
// --- other breakpoint grammar tests stub it
const LABELS_128: Record<number, string> = { [-2]: "R1", [-1]: "R0", 0: "B0", 1: "B1", 5: "B5", 7: "B7" };
const parseLabel = async (label: string) => {
  const entry = Object.entries(LABELS_128).find(([, l]) => l.toLowerCase() === label.toLowerCase());
  return entry ? Number(entry[0]) : undefined;
};
vi.mock("@common/messaging/EmuApi", () => ({
  createEmuApi: () => ({
    getPartitionLabels: async () => LABELS_128,
    parsePartitionLabel: parseLabel
  })
}));

/*
 * Conditional breakpoints from the command line, Phase 4 of `.plans/CONDITIONAL_BREAKPOINTS_PLAN.md`
 * (§4.3): `-if` as a raw tail, `-hit` specs, the caret output, warnings, `bp-list` lines that paste
 * back into `bp-set`, and `bp-reset-hits`.
 */

type Ctx = IdeCommandContext & { emuApi: any; output: any; service: any };

function context128(): Ctx {
  const ctx = createMockContext() as Ctx;
  ctx.service.machineService.getMachineInfo.mockReturnValue({
    machine: { machineId: "sp128", features: { rom: 2, bank: 8 } }
  });
  ctx.emuApi.getPartitionLabels.mockResolvedValue(LABELS_128);
  ctx.emuApi.parsePartitionLabel.mockImplementation(async (label: string) => {
    const entry = Object.entries(LABELS_128).find(([, l]) => l.toLowerCase() === label.toLowerCase());
    return entry ? Number(entry[0]) : undefined;
  });
  ctx.emuApi.resetBreakpointHits = vi.fn().mockResolvedValue(true);
  return ctx;
}

/** Run a command line the way `IdeCommandService` does: raw tail first, then tokens. */
async function run(command: BreakpointWithAddressCommand, line: string, ctx: Ctx) {
  const option = command.argumentInfo.rawTailOption!;
  const split = splitRawTail(line, option);
  const tokens = parseCommand(split ? split.head : line);
  const args = extractArguments(tokens.slice(1), command.argumentInfo);
  if (Array.isArray(args)) return { errors: args, messages: [] as any[], args: undefined };
  if (split) args[option] = split.tail;
  const messages = await command.validateCommandArgs(ctx, args as any);
  const errors = messages.filter((m) => m.type === ValidationMessageType.Error).map((m) => m.message);
  if (!errors.length) await command.execute(ctx, args as any);
  return { errors, messages, args };
}

const written = (ctx: Ctx) =>
  [...ctx.output.write.mock.calls, ...ctx.output.writeLine.mock.calls].map((c: any[]) => c[0]).join("\n");

afterEach(() => resetConditionSymbolsForTests());

describe("splitRawTail", () => {
  it.each([
    ["bp-set $8000 -if A == $FF && l[HL] == \"KL\"", "bp-set $8000 ", 'A == $FF && l[HL] == "KL"'],
    ["bp-set $8000 -if \"A == 1\"", "bp-set $8000 ", "A == 1"],
    ['bp-set $8000 -if "a\\"b"', "bp-set $8000 ", 'a"b'],
    ['bp-set $8000 -if "KL" == w[HL]', "bp-set $8000 ", '"KL" == w[HL]'],
    ["bp-set [main.asm:42] -hit *8 -if B == 0", "bp-set [main.asm:42] -hit *8 ", "B == 0"],
    ["bp-set $8000 -if", "bp-set $8000 ", ""],
    ["bp-set $8000 -if   ", "bp-set $8000 ", ""]
  ])("splits %j", (line, head, tail) => {
    expect(splitRawTail(line, "-if")).toEqual({ head, tail });
  });

  it.each([
    "bp-set $8000",
    "bp-set $8000 -iff",
    "bp-set [dir -if/a.asm:3]",
    'bp-set "x -if y"',
    "bp-set $8000-if A"
  ])("does not split %j", (line) => {
    expect(splitRawTail(line, "-if")).toBeUndefined();
  });

  it("cuts at the first -if, so a condition may contain the word", () => {
    expect(splitRawTail("bp-set $8000 -if iflag -if 1", "-if")).toEqual({
      head: "bp-set $8000 ",
      tail: "iflag -if 1"
    });
  });
});

describe("hit specs", () => {
  it.each([
    ["10", "eq", 10],
    ["=10", "eq", 10],
    [">10", "gt", 10],
    [">=10", "ge", 10],
    ["<10", "lt", 10],
    ["<=10", "le", 10],
    ["*10", "every", 10],
    ["$10", "eq", 16],
    ["*%101", "every", 5],
    ["65535", "eq", 65535],
    ["1_000", "eq", 1000]
  ])("%s is %s %d", (text, hitMode, hitCount) => {
    expect(parseHitSpec(text)).toEqual({ hitMode, hitCount });
    expect(formatHitSpec({ hitMode: hitMode as any, hitCount })).toBe(
      text.startsWith("=") || text.includes("$") || text.includes("%") || text.includes("_")
        ? `${hitMode === "every" ? "*" : ""}${hitCount}`
        : text
    );
  });

  it.each([
    ["0", "between 1 and 65535"],
    ["<0", "between 1 and 65535"],
    ["65536", "between 1 and 65535"],
    ["abc", "Invalid hit count"],
    ["!=3", "Invalid hit count"],
    ["", "The hit count is empty"]
  ])("rejects %j", (text, message) => {
    const result = parseHitSpec(text);
    expect("error" in result && result.error).toContain(message);
  });
});

describe("bp-set -hit / -if", () => {
  let ctx: Ctx;
  beforeEach(() => {
    ctx = context128();
  });

  it("sets a condition taken verbatim from the rest of the line", async () => {
    const { errors } = await run(new SetBreakpointCommand(), 'bp-set $8000 -if A == $FF && l[HL] == "KLIV"', ctx);
    expect(errors).toEqual([]);
    expect(ctx.emuApi.setBreakpoint).toHaveBeenCalledWith(
      expect.objectContaining({ address: 0x8000, exec: true, condition: 'A == $FF && l[HL] == "KLIV"' })
    );
  });

  it("sets a hit rule", async () => {
    await run(new SetBreakpointCommand(), "bp-set $8000 -hit >=10", ctx);
    expect(ctx.emuApi.setBreakpoint).toHaveBeenCalledWith(
      expect.objectContaining({ hitMode: "ge", hitCount: 10 })
    );
  });

  it("sets both on a source breakpoint", async () => {
    ctx.service.projectService.getBreakpointAddressInfo = vi.fn(() => ({ resource: "main.asm", line: 42 }));
    const { errors } = await run(new SetBreakpointCommand(), "bp-set [main.asm:42] -hit *8 -if B == 0", ctx);
    expect(errors).toEqual([]);
    expect(ctx.emuApi.setBreakpoint).toHaveBeenCalledWith(
      expect.objectContaining({ resource: "main.asm", line: 42, hitMode: "every", hitCount: 8, condition: "B == 0" })
    );
  });

  it("states the whole breakpoint: without -if/-hit it sets none (C13)", async () => {
    await run(new SetBreakpointCommand(), "bp-set $8000", ctx);
    const [bp] = ctx.emuApi.setBreakpoint.mock.calls[0];
    expect(bp.condition).toBeUndefined();
    expect(bp.hitCount).toBeUndefined();
  });

  it("reports a condition error with its column and a caret line", async () => {
    const { errors, messages } = await run(new SetBreakpointCommand(), "bp-set $8000 -if A == == 1", ctx);
    expect(errors).toEqual(["Condition error at column 6: Unexpected '=='; expected a value"]);
    expect(messages[1].message).toBe("  A == == 1");
    expect(messages[2].message).toBe("       ^^");
    expect(ctx.emuApi.setBreakpoint).not.toHaveBeenCalled();
  });

  it.each([
    ["bp-set $8000 -if VAL == 1", "an execution breakpoint has none"],
    ["bp-set $8000 -w -if VAL == $100", "$100 is out of range for VAL (0…255)"],
    ['bp-set $8000 -if l[HL] == "AB"', 'String "AB" has 2 characters but l[…] compares 4'],
    ["bp-set $8000 -if b[B9:$C010] == 1", "Unknown partition 'B9'"],
    ["bp-set $8000 -if nr($56) == 1", "ZX Spectrum Next"],
    ["bp-set $8000 -if", "The -if option needs a condition"],
    ["bp-set $8000 -hit 0", "between 1 and 65535"],
    ["bp-set $8000 -hit often", "Invalid hit count"]
  ])("rejects %j", async (line, message) => {
    const { errors } = await run(new SetBreakpointCommand(), line, ctx);
    expect(errors.join("\n")).toContain(message);
  });

  it("validates against the breakpoint's own kind and the machine's partitions", async () => {
    for (const line of [
      "bp-set $8000 -w -if VAL == $AA && ADDR == $8000",
      "bp-set $00FE -o -m $00FF -if VAL & 7 == 2",
      "bp-set $8000 -if page($C000) == @B5 && b[B1:$C010] == 0"
    ]) {
      ctx.emuApi.setBreakpoint.mockClear();
      const { errors } = await run(new SetBreakpointCommand(), line, ctx);
      expect(errors, line).toEqual([]);
      expect(ctx.emuApi.setBreakpoint, line).toHaveBeenCalled();
    }
  });

  it("warns about an unknown label in yellow, and sets the breakpoint", async () => {
    setBuildConditionSymbols({ lives: 3 });
    const { errors } = await run(new SetBreakpointCommand(), "bp-set $8000 -if w[score] > lives", ctx);
    expect(errors).toEqual([]);
    expect(ctx.emuApi.setBreakpoint).toHaveBeenCalled();
    expect(written(ctx)).toContain(
      "Warning (column 3): Unknown label score: the breakpoint is inactive until a build defines it"
    );
    expect(written(ctx)).not.toContain("Unknown label lives");
  });

  it("is accepted and ignored by bp-del and bp-en", async () => {
    let result = await run(new RemoveBreakpointCommand(), "bp-del $8000 -hit *4 -if A == == bad", ctx);
    expect(result.errors).toEqual([]);
    expect(ctx.emuApi.removeBreakpoint).toHaveBeenCalledWith(expect.objectContaining({ address: 0x8000 }));
    result = await run(new EnableBreakpointCommand(), "bp-en $8000 -d -hit *4 -if A == 1", ctx);
    expect(result.errors).toEqual([]);
    expect(ctx.emuApi.enableBreakpoint).toHaveBeenCalledWith(expect.objectContaining({ address: 0x8000 }), false);
  });
});

describe("bp-list", () => {
  let ctx: Ctx;
  beforeEach(() => {
    ctx = context128();
  });

  it("prints the filters on the command line and the state on the next one", async () => {
    ctx.emuApi.listBreakpoints.mockResolvedValue({
      breakpoints: [
        {
          address: 0x8000,
          exec: true,
          hitMode: "ge",
          hitCount: 10,
          condition: "w[score] > 3",
          currentHits: 3,
          conditionInactive: "unknown label score"
        },
        { address: 0x9000, memoryWrite: true, condition: "VAL ==", conditionError: "column 7: oops", disabled: true }
      ]
    });
    await new ListBreakpointsCommand().execute(ctx);
    const text = written(ctx);
    expect(text).toContain("$8000 -hit >=10 -if w[score] > 3");
    expect(text).toContain("(hits: 3) <inactive: unknown label score>");
    expect(text).toContain("$9000 -w -if VAL ==");
    expect(text).toContain("<disabled> <condition error: column 7: oops>");
  });

  it("prints no status line for a plain breakpoint", () => {
    expect(breakpointStatusText({ address: 0x8000, exec: true })).toBe("");
  });

  /** Every shape the round trip has to survive. */
  const SHAPES: BreakpointInfo[] = [
    { address: 0x8000, exec: true },
    { address: 0x8000, exec: true, condition: 'A == $FF && l[HL] == "KLIV"' },
    { address: 0x8000, exec: true, hitMode: "every", hitCount: 4 },
    { address: 0x8000, exec: true, hitCount: 7 },
    { address: 0x8000, partition: -1, exec: true, hitMode: "lt", hitCount: 3, condition: "page($C000) == @B5" },
    { address: 0xc010, partition: 5, memoryRead: true, condition: "VAL != 0" },
    { address: 0x9000, memoryWrite: true, hitMode: "gt", hitCount: 2, condition: "ADDR >= $5800 && ADDR < $5B00" },
    { address: 0x00fe, ioWrite: true, ioMask: 0x00ff, condition: "VAL & 7 == 2" },
    { address: 0x00fe, ioRead: true, ioMask: 0xffff, hitMode: "le", hitCount: 9 },
    // --- Surrounding blanks are not part of what the command line can carry; the rest is verbatim
    { address: 0x8000, exec: true, condition: "  A  ==  1  " }
  ];

  it.each(SHAPES.map((bp) => [breakpointCommandSpec(bp, LABELS_128), bp] as const))(
    "'bp-set %s' recreates the same breakpoint",
    async (spec, bp) => {
      const { errors } = await run(new SetBreakpointCommand(), `bp-set ${spec}`, ctx);
      expect(errors).toEqual([]);
      const [set] = ctx.emuApi.setBreakpoint.mock.calls[0];
      expect(getBreakpointStorageKey(set)).toBe(getBreakpointStorageKey(bp));
      expect(set.condition).toBe(bp.condition?.trim() || undefined);
      expect(formatHitSpec(set)).toBe(formatHitSpec(bp));
    }
  );
});

describe("bp-reset-hits", () => {
  let ctx: Ctx;
  beforeEach(() => {
    ctx = context128();
  });

  it("resets every counter without an argument", async () => {
    const { errors } = await run(new ResetBreakpointHitsCommand(), "bp-reset-hits", ctx);
    expect(errors).toEqual([]);
    expect(ctx.emuApi.resetBreakpointHits).toHaveBeenCalledWith();
    expect(written(ctx)).toContain("All breakpoint hit counters reset");
  });

  it("resets one breakpoint's counter", async () => {
    const { errors } = await run(new ResetBreakpointHitsCommand(), "bprh B5:$C010 -r", ctx);
    expect(errors).toEqual([]);
    expect(ctx.emuApi.resetBreakpointHits).toHaveBeenCalledWith(
      expect.objectContaining({ address: 0xc010, partition: 5, memoryRead: true })
    );
  });

  it("says when the breakpoint does not exist", async () => {
    ctx.emuApi.resetBreakpointHits.mockResolvedValue(false);
    const command = new ResetBreakpointHitsCommand();
    const args: any = { addrSpec: "$8000" };
    await command.validateCommandArgs(ctx, args);
    const result = await command.execute(ctx, args);
    expect(result.success).toBe(false);
    expect(result.finalMessage).toContain("$8000 does not exist");
  });

  it("is registered with its alias", () => {
    const command = new ResetBreakpointHitsCommand();
    expect(command.id).toBe("bp-reset-hits");
    expect(command.aliases).toEqual(["bprh"]);
  });
});

describe("the command service hands -if the raw rest of the line", () => {
  it("passes the condition untouched, and the other options as tokens", async () => {
    const { createInteractiveCommandsService } = await import(
      "@renderer/appIde/services/IdeCommandService"
    );
    const store: any = { getState: () => ({ emulatorState: { machineId: "sp48" } }), dispatch: vi.fn() };
    const service = createInteractiveCommandsService(store, {} as any, "ide" as any);
    service.setAppServices({} as any);
    const seen: any[] = [];
    service.registerCommand({
      id: "probe",
      description: "",
      usage: "",
      argumentInfo: { mandatory: [{ name: "spec" }], namedOptions: [{ name: "-hit" }], rawTailOption: "-if" },
      execute: async (_ctx: any, args: any) => {
        seen.push(args);
        return { success: true };
      },
      usageMessage: () => []
    } as any);

    await service.executeInteractiveCommand('probe [main.asm:42] -hit >=10 -if A == $FF && l[HL] == "KLIV"');
    expect(seen).toEqual([
      { spec: "[main.asm:42]", "-hit": ">=10", "-if": 'A == $FF && l[HL] == "KLIV"' }
    ]);
  });
});
