import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SetBreakpointCommand
} from "@renderer/appIde/commands/BreakpointCommands";
import { breakpointCommandSpec } from "@common/utils/breakpoint-spec";
import { createMockContext } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";

type MockIdeCommandContext = IdeCommandContext & {
  service: { machineService: { getMachineInfo: ReturnType<typeof vi.fn> } };
  emuApi: { setBreakpoint: ReturnType<typeof vi.fn> };
};

/*
 * The `cu:<index>` address spec: a ZX Spectrum Next Copper-instruction breakpoint
 * (`.plans/COPPER_DEBUGGING_PLAN.md` §4.8). It goes through the shared
 * `BreakpointWithAddressCommand.validateCommandArgs`, so `bp-set`, `bp-del` and `bp-en` all take it.
 */
describe("Copper breakpoints - the `cu:` address spec", () => {
  let command: SetBreakpointCommand;
  let context: MockIdeCommandContext;

  const parse = async (line: string) => {
    const args: any = {};
    for (const token of line.split(/\s+/).filter(Boolean)) {
      if (args.addrSpec === undefined && !token.startsWith("-")) {
        args.addrSpec = token;
      } else if (token === "-v" || token === "-m") {
        args.__pending = token;
      } else if (args.__pending) {
        args[args.__pending] = parseInt(token.replace("$", ""), 16);
        args.__pending = undefined;
      } else {
        args[token] = true;
      }
    }
    delete args.__pending;
    const messages = await command.validateCommandArgs(context, args);
    const errors = messages.filter((m) => m.type === ValidationMessageType.Error);
    return { args, messages, errors };
  };

  beforeEach(() => {
    command = new SetBreakpointCommand();
    context = createMockContext() as MockIdeCommandContext;
    context.service.machineService.getMachineInfo.mockReturnValue({
      machine: { machineId: "zxnext", features: { rom: 7, bank: 224 } }
    });
    vi.clearAllMocks();
  });

  it.each([
    ["$00B", 0x0b],
    ["$00b", 0x0b],
    ["11", 11],
    ["$3FF", 0x3ff],
    ["0", 0]
  ])("accepts cu:%s", async (spec, expected) => {
    const { args, errors } = await parse(`cu:${spec}`);
    expect(errors, JSON.stringify(errors)).toHaveLength(0);
    expect(args.copperIndex).toBe(expected);
  });

  it("is case-insensitive", async () => {
    expect((await parse("CU:$00B")).args.copperIndex).toBe(0x0b);
  });

  it("rejects an index outside $000..$3FF", async () => {
    expect((await parse("cu:$400")).errors[0].message).toMatch(/between \$000 and \$3FF/);
  });

  it("rejects garbage as an invalid index", async () => {
    expect((await parse("cu:zzz")).errors[0].message).toMatch(/Invalid Copper list index/);
  });

  it("is refused on any machine but the ZX Spectrum Next", async () => {
    context.service.machineService.getMachineInfo.mockReturnValue({
      machine: { machineId: "sp48", features: {} }
    });
    const { errors } = await parse("cu:$00B");
    expect(errors[0].message).toMatch(/ZX Spectrum Next only/);
    expect(errors[0].message).not.toMatch(/partition/i);
  });

  it.each(["-r", "-w", "-i", "-o", "-c", "-v $03", "-m $0f"])("refuses %s", async (flag) => {
    expect((await parse(`cu:$00B ${flag}`)).errors[0].message).toMatch(
      /A Copper breakpoint watches a list index, not memory, a port or a register/
    );
  });

  it("accepts -once and builds a non-exec breakpoint", async () => {
    context.emuApi.setBreakpoint.mockResolvedValue(true);
    const { args, errors } = await parse("cu:$00B -once");
    expect(errors).toHaveLength(0);
    await command.execute(context, args);
    const bp = context.emuApi.setBreakpoint.mock.calls[0][0];
    expect(bp).toMatchObject({ copperIndex: 0x0b, exec: false, oneShot: true });
  });

  it("round-trips through breakpointCommandSpec", async () => {
    expect(breakpointCommandSpec({ copperIndex: 0x0b }, {})).toBe("CU:$00B");
    expect(breakpointCommandSpec({ copperIndex: 0x0b, hitCount: 50, hitMode: "eq" }, {})).toBe(
      "CU:$00B -hit 50"
    );
    const { args, errors } = await parse(breakpointCommandSpec({ copperIndex: 0x3ff }, {}));
    expect(errors).toHaveLength(0);
    expect(args.copperIndex).toBe(0x3ff);
  });
});
