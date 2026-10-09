import { afterEach, describe, expect, it, vi } from "vitest";

import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";

import {
  BreakpointWithAddressCommand,
  EnableBreakpointCommand,
  EnableLogpointGroupsCommand,
  ListBreakpointsCommand,
  ListLogpointGroupsCommand,
  RemoveBreakpointCommand,
  SetBreakpointCommand,
  unescapeLogOption
} from "@renderer/appIde/commands/BreakpointCommands";
import { breakpointCommandSpec, breakpointStatusText, quoteLogTemplate } from "@common/utils/breakpoint-spec";
import { extractArguments, splitRawTail } from "@renderer/appIde/services/ide-commands";
import { parseCommand } from "@renderer/appIde/services/command-parser";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";
import { resetConditionSymbolsForTests } from "@renderer/appIde/utils/condition-symbols";
import { createMockContext } from "./test-helpers/mock-context";

vi.mock("@common/messaging/EmuApi", () => ({
  createEmuApi: () => ({
    getPartitionLabels: async () => ({}),
    parsePartitionLabel: async () => undefined
  })
}));
vi.mock("@renderer/appIde/utils/save-project", () => ({ saveProject: vi.fn() }));

/*
 * Logpoints from the command line (`.plans/LOGPOINTS_PLAN.md` §4.4, Phase 5): `-log` on `bp-set`,
 * accepted and ignored by `bp-del`/`bp-en`, `bp-list` lines that paste back, the annotation
 * section, and `lp-en` / `lp-groups`.
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
  if (Array.isArray(args)) return { errors: args, messages: [] as any[] };
  if (split) args[option] = split.tail;
  const messages = await command.validateCommandArgs(ctx, args as any);
  const errors = messages.filter((m) => m.type === ValidationMessageType.Error).map((m) => m.message);
  if (!errors.length) await command.execute(ctx, args as any);
  return { errors, messages };
}

/** Everything written, in call order; a `writeLine` ends a line. */
const written = (ctx: Ctx) => {
  const calls = [
    ...ctx.output.write.mock.calls.map((c: any[], i: number) => [ctx.output.write.mock.invocationCallOrder[i], c[0] ?? ""]),
    ...ctx.output.writeLine.mock.calls.map((c: any[], i: number) => [
      ctx.output.writeLine.mock.invocationCallOrder[i],
      `${c[0] ?? ""}\n`
    ])
  ].sort((a, b) => a[0] - b[0]);
  return calls.map((c) => c[1]).join("");
};

afterEach(() => resetConditionSymbolsForTests());

describe("bp-set -log", () => {
  it("sets a logpoint with its template", async () => {
    const ctx = context48();
    const { errors } = await run(new SetBreakpointCommand(), 'bp-set $8000 -log "x={A} at {PC:hex16}"', ctx);
    expect(errors).toEqual([]);
    expect(ctx.emuApi.setBreakpoint).toHaveBeenCalledWith(
      expect.objectContaining({ address: 0x8000, exec: true, logMessage: "x={A} at {PC:hex16}" })
    );
    expect(written(ctx)).toMatch(/Logpoint at address \$8000 set -log "x=\{A\} at \{PC:hex16\}"/);
  });

  it("combines -log with -hit and -if, -if last", async () => {
    const ctx = context48();
    const { errors } = await run(
      new SetBreakpointCommand(),
      'bp-set $8000 -log "[LOOP] B={B}" -hit *100 -if A == 0',
      ctx
    );
    expect(errors).toEqual([]);
    expect(ctx.emuApi.setBreakpoint).toHaveBeenCalledWith(
      expect.objectContaining({
        logMessage: "[LOOP] B={B}",
        hitMode: "every",
        hitCount: 100,
        condition: "A == 0"
      })
    );
  });

  it("decodes the tokenizer's escapes", async () => {
    const ctx = context48();
    await run(new SetBreakpointCommand(), 'bp-set $8000 -log "say \\"{A}\\" \\\\ done"', ctx);
    expect(ctx.emuApi.setBreakpoint.mock.calls[0][0].logMessage).toBe('say "{A}" \\ done');
  });

  it("without -log states a stopping breakpoint (L2)", async () => {
    const ctx = context48();
    await run(new SetBreakpointCommand(), "bp-set $8000", ctx);
    expect(ctx.emuApi.setBreakpoint.mock.calls[0][0].logMessage).toBeUndefined();
  });

  it("reports a template error with a caret under it", async () => {
    const ctx = context48();
    const { errors, messages } = await run(new SetBreakpointCommand(), 'bp-set $8000 -log "x={A +}"', ctx);
    expect(errors[0]).toMatch(/^Log template error at column \d+:/);
    expect(messages[1].message).toBe("  x={A +}");
    expect(messages[2].message).toMatch(/^\s+\^+$/);
    expect(ctx.emuApi.setBreakpoint).not.toHaveBeenCalled();
  });

  it("refuses an empty template and VAL on an execution logpoint", async () => {
    expect((await run(new SetBreakpointCommand(), 'bp-set $8000 -log ""', context48())).errors).toEqual([
      "The -log option needs a message template"
    ]);
    expect((await run(new SetBreakpointCommand(), 'bp-set $8000 -log "{VAL}"', context48())).errors[0]).toMatch(
      /execution breakpoint has none/
    );
    expect((await run(new SetBreakpointCommand(), 'bp-set $4000 -w -log "{VAL}"', context48())).errors).toEqual([]);
  });

  it("warns about an unknown label", async () => {
    const ctx = context48();
    const { errors } = await run(new SetBreakpointCommand(), 'bp-set $8000 -log "{b[counter]}"', ctx);
    expect(errors).toEqual([]);
    expect(written(ctx)).toMatch(/Warning \(log template column 4\): Unknown label counter/);
  });

  it("is accepted and ignored by bp-del and bp-en", async () => {
    const ctx = context48();
    expect((await run(new RemoveBreakpointCommand(), 'bp-del $8000 -log "x"', ctx)).errors).toEqual([]);
    expect(ctx.emuApi.removeBreakpoint.mock.calls[0][0].logMessage).toBeUndefined();
    expect((await run(new EnableBreakpointCommand(), 'bp-en $8000 -log "x" -d', ctx)).errors).toEqual([]);
  });
});

describe("bp-list", () => {
  it("lists a logpoint so the line pastes back into bp-set", async () => {
    const bp: BreakpointInfo = {
      address: 0x8000,
      exec: true,
      logMessage: 'say "{A}" \\',
      hitMode: "every",
      hitCount: 4,
      condition: "A == 0"
    };
    const spec = breakpointCommandSpec(bp, {});
    expect(spec).toBe('$8000 -log "say \\"{A}\\" \\\\" -hit *4 -if A == 0');

    const ctx = context48();
    await run(new SetBreakpointCommand(), `bp-set ${spec}`, ctx);
    expect(ctx.emuApi.setBreakpoint).toHaveBeenCalledWith(
      expect.objectContaining({ logMessage: bp.logMessage, condition: "A == 0", hitCount: 4 })
    );
  });

  it("round-trips quoting", () => {
    for (const t of ["plain", 'q"q', "b\\s", '\\"', "{{x}}"]) {
      expect(unescapeLogOption(quoteLogTemplate(t).slice(1, -1))).toBe(t);
    }
  });

  it("shows a template error in the status line", () => {
    expect(breakpointStatusText({ address: 1, logError: "column 3: bad" })).toBe(
      "<log template error: column 3: bad>"
    );
  });

  it("lists LOGPOINT comments apart, read-only", async () => {
    const ctx = context48();
    ctx.emuApi.listBreakpoints.mockResolvedValue({
      breakpoints: [
        { address: 0x9000, exec: true },
        {
          owner: { kind: "annotation" },
          address: 0x8000,
          exec: true,
          resource: "main.asm",
          line: 12,
          logMessage: "[S] ${A}",
          logDialect: "dezog",
          currentHits: 3
        }
      ]
    });
    await new ListBreakpointsCommand().execute(ctx);
    const out = written(ctx);
    expect(out).toMatch(/1 breakpoint set/);
    expect(out).toMatch(/LOGPOINT comments/);
    expect(out).toMatch(/\[main\.asm\]:12 @ \$8000: /);
    expect(out).toMatch(/\[S\] \$\{A\}/);
  });
});

describe("lp-en and lp-groups", () => {
  function ctxWithGroups(state = { enabled: true } as { enabled: boolean; groups?: string[] }) {
    const ctx = context48();
    ctx.store.getState.mockReturnValue({ logpointGroups: state });
    ctx.emuApi.listBreakpoints.mockResolvedValue({
      breakpoints: [
        { address: 1, exec: true, logMessage: "[A] a" },
        { address: 2, exec: true, logMessage: "[B] b" },
        { address: 3, exec: true, logMessage: "c" },
        { address: 4, exec: true }
      ]
    });
    return ctx;
  }
  const dispatched = (ctx: Ctx) => ctx.store.dispatch.mock.calls.at(-1)[0].payload.value;

  it("switches everything on and off", async () => {
    const ctx = ctxWithGroups();
    await new EnableLogpointGroupsCommand().execute(ctx, { "-d": true });
    expect(dispatched(ctx)).toEqual({ enabled: false });
    await new EnableLogpointGroupsCommand().execute(ctx, {});
    expect(dispatched(ctx)).toEqual({ enabled: true });
  });

  it("logs only the named groups, or stops logging the named ones", async () => {
    const ctx = ctxWithGroups();
    await new EnableLogpointGroupsCommand().execute(ctx, { rest: ["a", "default"] });
    expect(dispatched(ctx)).toEqual({ enabled: true, groups: ["A", "DEFAULT"] });
    await new EnableLogpointGroupsCommand().execute(ctx, { rest: ["B"], "-d": true });
    expect(dispatched(ctx)).toEqual({ enabled: true, groups: ["A", "DEFAULT"] });

    const listed = ctxWithGroups({ enabled: true, groups: ["A", "B"] });
    await new EnableLogpointGroupsCommand().execute(listed, { rest: ["A"], "-d": true });
    expect(dispatched(listed)).toEqual({ enabled: true, groups: ["B"] });
  });

  it("lists every group, its state and its logpoints", async () => {
    const ctx = ctxWithGroups({ enabled: true, groups: ["A", "GONE"] });
    await new ListLogpointGroupsCommand().execute(ctx);
    const out = written(ctx);
    expect(out).toMatch(/Logging: only A, GONE/);
    expect(out).toMatch(/\[A\] on   1 logpoint/);
    expect(out).toMatch(/\[B\] off  1 logpoint/);
    expect(out).toMatch(/\[DEFAULT\] off  1 logpoint/);
    expect(out).toMatch(/\[GONE\] on   0 logpoints/);
  });
});
