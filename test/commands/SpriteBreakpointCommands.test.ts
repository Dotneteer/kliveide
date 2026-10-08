import { describe, it, expect, vi, beforeEach } from "vitest";
import { SetBreakpointCommand, breakpointCommandSpec } from "@renderer/appIde/commands/BreakpointCommands";
import { createMockContext } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";

type MockIdeCommandContext = IdeCommandContext & {
  service: { machineService: { getMachineInfo: ReturnType<typeof vi.fn> } };
  emuApi: { setBreakpoint: ReturnType<typeof vi.fn> };
};

/*
 * The `sp:<sprite>` address spec and its `-attr` filter: a ZX Spectrum Next sprite-attribute
 * breakpoint (`.plans/SPRITE_ATTRIBUTE_BREAKPOINTS_PLAN.md`). It goes through the shared
 * `BreakpointWithAddressCommand.validateCommandArgs`, so `bp-set`, `bp-del` and `bp-en` all take it.
 */
describe("Sprite breakpoints - the `sp:` address spec", () => {
  let command: SetBreakpointCommand;
  let context: MockIdeCommandContext;

  const parse = async (line: string) => {
    const args: any = {};
    const tokens = line.split(/\s+/).filter(Boolean);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (args.addrSpec === undefined && !token.startsWith("-")) {
        args.addrSpec = token;
      } else if (token === "-v" || token === "-m") {
        args[token] = parseInt(tokens[++i].replace("$", ""), 16);
      } else if (token === "-attr" || token === "-hit") {
        args[token] = tokens[++i];
      } else {
        args[token] = true;
      }
    }
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
    ["$0C", 0x0c],
    ["$0c", 0x0c],
    ["12", 12],
    ["$7F", 0x7f],
    ["0", 0]
  ])("accepts sp:%s", async (spec, expected) => {
    const { args, errors } = await parse(`sp:${spec}`);
    expect(errors, JSON.stringify(errors)).toHaveLength(0);
    expect(args.spriteIndex).toBe(expected);
  });

  it("is case-insensitive", async () => {
    expect((await parse("SP:$0C")).args.spriteIndex).toBe(0x0c);
  });

  it("rejects a sprite outside $00..$7F", async () => {
    expect((await parse("sp:$80")).errors[0].message).toMatch(/between \$00 and \$7F/);
  });

  it("rejects garbage as an invalid sprite", async () => {
    expect((await parse("sp:zzz")).errors[0].message).toMatch(/Invalid sprite index/);
  });

  it("is refused on any machine but the ZX Spectrum Next", async () => {
    context.service.machineService.getMachineInfo.mockReturnValue({
      machine: { machineId: "sp48", features: {} }
    });
    const { errors } = await parse("sp:$0C");
    expect(errors[0].message).toMatch(/ZX Spectrum Next only/);
    expect(errors[0].message).not.toMatch(/partition/i);
  });

  it.each(["-r", "-w", "-i", "-o", "-c", "-v $03", "-m $0f"])("refuses %s", async (flag) => {
    expect((await parse(`sp:$0C ${flag}`)).errors[0].message).toMatch(
      /A sprite breakpoint watches a sprite's attribute writes/
    );
  });

  it("accepts -attr and stores the mask", async () => {
    context.emuApi.setBreakpoint.mockResolvedValue(true);
    const { args, errors } = await parse("sp:$0C -attr 0,1");
    expect(errors).toHaveLength(0);
    await command.execute(context, args);
    const bp = context.emuApi.setBreakpoint.mock.calls[0][0];
    expect(bp).toMatchObject({ spriteIndex: 0x0c, spriteAttrMask: 0x03, exec: false });
  });

  it("does not store a mask for all five bytes", async () => {
    context.emuApi.setBreakpoint.mockResolvedValue(true);
    const { args } = await parse("sp:$0C -attr 0-4");
    await command.execute(context, args);
    expect(context.emuApi.setBreakpoint.mock.calls[0][0].spriteAttrMask).toBeUndefined();
  });

  it("refuses a bad -attr list, and -attr without sp:", async () => {
    expect((await parse("sp:$0C -attr 5")).errors[0].message).toMatch(/attribute bytes 0-4/);
    expect((await parse("$8000 -attr 0")).errors[0].message).toMatch(/only with a sprite breakpoint/);
  });

  it("accepts -once and builds a non-exec breakpoint", async () => {
    context.emuApi.setBreakpoint.mockResolvedValue(true);
    const { args, errors } = await parse("sp:$0C -once");
    expect(errors).toHaveLength(0);
    await command.execute(context, args);
    expect(context.emuApi.setBreakpoint.mock.calls[0][0]).toMatchObject({
      spriteIndex: 0x0c,
      exec: false,
      oneShot: true
    });
  });

  it("round-trips through breakpointCommandSpec", async () => {
    expect(breakpointCommandSpec({ spriteIndex: 0x0c }, {})).toBe("SP:$0C");
    expect(breakpointCommandSpec({ spriteIndex: 0x0c, spriteAttrMask: 0x05, hitCount: 3, hitMode: "eq" }, {})).toBe(
      "SP:$0C -attr 0,2 -hit 3"
    );
    const { args, errors } = await parse(breakpointCommandSpec({ spriteIndex: 0x7f, spriteAttrMask: 0x0f }, {}));
    expect(errors).toHaveLength(0);
    expect(args.spriteIndex).toBe(0x7f);
    expect(args["-attr"]).toBe("0-3");
  });
});
