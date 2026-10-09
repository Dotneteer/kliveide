import { describe, expect, it, vi } from "vitest";

import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";

import {
  BreakpointWithAddressCommand,
  RemoveBreakpointCommand,
  SetBreakpointCommand
} from "@renderer/appIde/commands/BreakpointCommands";
import { breakpointCommandSpec, breakpointStatusText } from "@common/utils/breakpoint-spec";
import { extractArguments, splitRawTail } from "@renderer/appIde/services/ide-commands";
import { parseCommand } from "@renderer/appIde/services/command-parser";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";
import { createMockContext } from "./test-helpers/mock-context";

vi.mock("@common/messaging/EmuApi", () => ({
  createEmuApi: () => ({
    getPartitionLabels: async () => ({}),
    parsePartitionLabel: async () => undefined
  })
}));

/*
 * `bp-set -once` and `-len` (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` §4.2, §4.6).
 */

type Ctx = IdeCommandContext & { emuApi: any; output: any; service: any; store: any };

function context48(): Ctx {
  const ctx = createMockContext() as Ctx;
  ctx.service.machineService.getMachineInfo.mockReturnValue({
    machine: { machineId: "sp48", features: {} }
  });
  ctx.emuApi.getPartitionLabels.mockResolvedValue({});
  return ctx;
}

async function run(command: BreakpointWithAddressCommand, line: string, ctx: Ctx) {
  const option = command.argumentInfo.rawTailOption!;
  const split = splitRawTail(line, option);
  const tokens = parseCommand(split ? split.head : line);
  const args = extractArguments(tokens.slice(1), command.argumentInfo);
  if (Array.isArray(args)) return { errors: args };
  if (split) args[option] = split.tail;
  const messages = await command.validateCommandArgs(ctx, args as any);
  const errors = messages.filter((m) => m.type === ValidationMessageType.Error).map((m) => m.message);
  if (!errors.length) await command.execute(ctx, args as any);
  return { errors };
}

describe("bp-set -once", () => {
  it("sets a session-owned one-shot", async () => {
    const ctx = context48();
    const { errors } = await run(new SetBreakpointCommand(), "bp-set $8000 -once -hit 10", ctx);
    expect(errors).toEqual([]);
    expect(ctx.emuApi.setBreakpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        address: 0x8000,
        oneShot: true,
        owner: { kind: "session" },
        hitCount: 10
      })
    );
  });

  it("without -once, bp-set makes it a regular breakpoint again", async () => {
    const ctx = context48();
    await run(new SetBreakpointCommand(), "bp-set $8000", ctx);
    const bp = ctx.emuApi.setBreakpoint.mock.calls[0][0];
    expect(bp.oneShot).toBeUndefined();
    expect(bp.owner).toBeUndefined();
  });

  it("refuses a one-shot logpoint", async () => {
    const { errors } = await run(new SetBreakpointCommand(), 'bp-set $8000 -once -log "x"', context48());
    expect(errors[0]).toMatch(/logpoint cannot be a one-shot/);
  });

  it("is listed before -hit and -if, so the line pastes back", async () => {
    const spec = breakpointCommandSpec(
      { address: 0x8000, exec: true, oneShot: true, hitCount: 3, condition: "A == 1" },
      {}
    );
    expect(spec).toBe("$8000 -once -hit 3 -if A == 1");
    const ctx = context48();
    await run(new SetBreakpointCommand(), `bp-set ${spec}`, ctx);
    expect(ctx.emuApi.setBreakpoint).toHaveBeenCalledWith(
      expect.objectContaining({ oneShot: true, hitCount: 3, condition: "A == 1" })
    );
  });

  it("marks a run-to target and does not offer it as a user one-shot", () => {
    const bp = { address: 0x8000, exec: true, oneShot: true, runTo: true };
    expect(breakpointCommandSpec(bp, {})).toBe("$8000");
    expect(breakpointStatusText(bp)).toMatch(/run-to target/);
  });
});

describe("bp-set -len", () => {
  it("sets a memory range", async () => {
    const ctx = context48();
    const { errors } = await run(new SetBreakpointCommand(), "bp-set $8000 -w -len 5", ctx);
    expect(errors).toEqual([]);
    expect(ctx.emuApi.setBreakpoint).toHaveBeenCalledWith(
      expect.objectContaining({ address: 0x8000, memoryWrite: true, length: 5 })
    );
    expect(breakpointCommandSpec({ address: 0x8000, memoryWrite: true, length: 5 }, {})).toBe(
      "$8000 -w -len 5"
    );
  });

  it("refuses a length without -r/-w, out of range, or wrapping", async () => {
    expect((await run(new SetBreakpointCommand(), "bp-set $8000 -len 5", context48())).errors[0]).toMatch(
      /only with -r or -w/
    );
    expect((await run(new SetBreakpointCommand(), "bp-set $8000 -w -len 0", context48())).errors[0]).toMatch(
      /between 1 and 65536/
    );
    expect((await run(new SetBreakpointCommand(), "bp-set $FFFE -w -len 4", context48())).errors[0]).toMatch(
      /wrap/
    );
  });

  it("bp-del needs the length too: it is part of the identity", async () => {
    const ctx = context48();
    ctx.emuApi.removeBreakpoint.mockResolvedValue(true);
    await run(new RemoveBreakpointCommand(), "bp-del $8000 -w -len 5", ctx);
    expect(ctx.emuApi.removeBreakpoint).toHaveBeenCalledWith(
      expect.objectContaining({ address: 0x8000, memoryWrite: true, length: 5 })
    );
  });
});

describe("WS:<symbol> watchpoints (W3)", () => {
  it("lists a watch-made watchpoint in a form bp-set reads back", async () => {
    const spec = breakpointCommandSpec({ watchSymbol: "buf", memoryWrite: true, length: 2 }, {});
    expect(spec).toBe("WS:buf -w -len 2");
    const ctx = context48();
    const { errors } = await run(new SetBreakpointCommand(), `bp-set ${spec}`, ctx);
    expect(errors).toEqual([]);
    expect(ctx.emuApi.setBreakpoint).toHaveBeenCalledWith(
      expect.objectContaining({ watchSymbol: "buf", memoryWrite: true, length: 2 })
    );
  });

  it("needs -r or -w", async () => {
    expect((await run(new SetBreakpointCommand(), "bp-set WS:buf", context48())).errors[0]).toMatch(
      /use -r or -w/
    );
  });
});
