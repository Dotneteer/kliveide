import { describe, it, expect, vi, beforeEach } from "vitest";
import { SetBreakpointCommand } from "@renderer/appIde/commands/BreakpointCommands";
import { breakpointCommandSpec } from "@common/utils/breakpoint-spec";
import { createMockContext } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";

type MockIdeCommandContext = IdeCommandContext & {
  service: { machineService: { getMachineInfo: ReturnType<typeof vi.fn> } };
};

/*
 * The `int:<kind>` address spec: a ZX Spectrum Next interrupt stop
 * (`dev/plans/NEXT_INTERRUPTS_DEBUGGING_PLAN.md` §5). It goes through the shared
 * `BreakpointWithAddressCommand.validateCommandArgs`, so `bp-set`, `bp-del` and `bp-en` all take it.
 */
describe("Interrupt stops - the `int:` address spec", () => {
  let command: SetBreakpointCommand;
  let context: MockIdeCommandContext;

  const parse = async (line: string) => {
    const args: any = {};
    const tokens = line.split(/\s+/).filter(Boolean);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (args.addrSpec === undefined && !token.startsWith("-")) args.addrSpec = token;
      else if (token === "-v" || token === "-m") args[token] = parseInt(tokens[++i].replace("$", ""), 16);
      else if (token === "-attr" || token === "-hit" || token === "-if") args[token] = tokens[++i];
      else args[token] = true;
    }
    const messages = await command.validateCommandArgs(context, args);
    const errors = messages.filter((m) => m.type === ValidationMessageType.Error);
    return { args, errors };
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
    ["int:ack", "ack"],
    ["INT:ACK:ULA", "ack:ula"],
    ["int:lost:line", "lost:line"],
    ["int:retn", "retn"],
    ["int:reti", "reti"],
    ["int:wait:228", "wait:228"],
    ["int:wait:$E4:ctc0", "wait:228:ctc0"],
    ["int:nmi:divmmc", "nmi:divmmc"]
  ])("accepts %s", async (spec, normalized) => {
    const { args, errors } = await parse(spec);
    expect(errors, JSON.stringify(errors)).toHaveLength(0);
    expect(args.interruptStop).toBe(normalized);
  });

  it.each([
    ["int:foo", /Unknown interrupt stop/],
    ["int:ack:ctc7", /Unknown interrupt source: use one of line, uart0rx/],
    ["int:nmi:esp", /Unknown NMI device/],
    ["int:wait", /needs a limit/],
    ["int:retn:ula", /Too many parts/]
  ])("refuses %s", async (spec, message) => {
    expect((await parse(spec)).errors[0].message).toMatch(message);
  });

  it("refuses access options", async () => {
    expect((await parse("int:ack -r")).errors[0].message).toMatch(/watches an interrupt event/);
  });

  it("is refused on any machine but the ZX Spectrum Next", async () => {
    context.service.machineService.getMachineInfo.mockReturnValue({ machine: { machineId: "sp48", features: {} } });
    expect((await parse("int:ack")).errors[0].message).toMatch(/only on the ZX Spectrum Next/);
  });

  it("round-trips through bp-list's spec", () => {
    expect(breakpointCommandSpec({ interruptStop: "ack:ula" }, {})).toBe("INT:ACK:ULA");
    expect(breakpointCommandSpec({ interruptStop: "wait:228", hitCount: 3, hitMode: "atLeast" } as never, {})).toMatch(
      /^INT:WAIT:228 -hit/
    );
  });
});
