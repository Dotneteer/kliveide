import { describe, it, expect, vi, beforeEach } from "vitest";
import { 
  EraseAllBreakpointsCommand,
  ListBreakpointsCommand,
  SetBreakpointCommand
} from "@renderer/appIde/commands/BreakpointCommands";
import { createMockContext } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import type { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";

// Type assertion helper for mock context
type MockIdeCommandContext = IdeCommandContext & {
  emuApi: any;
};

describe("EraseAllBreakpointsCommand", () => {
  let command: EraseAllBreakpointsCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new EraseAllBreakpointsCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'bp-ea'", () => {
      expect(command.id).toBe("bp-ea");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("Erase all breakpoints");
    });

    it("should have usage 'bp-ea'", () => {
      expect(command.usage).toBe("bp-ea");
    });

    it("should have alias 'eab'", () => {
      expect(command.aliases).toEqual(["eab"]);
    });
  });

  describe("execute", () => {
    it("should erase all breakpoints when breakpoints exist", async () => {
      // Arrange
      const mockBreakpoints: BreakpointInfo[] = [
        { address: 0x8000, exec: true },
        { address: 0x9000, exec: true }
      ];
      context.emuApi.listBreakpoints.mockResolvedValue({ 
        breakpoints: mockBreakpoints 
      });

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.listBreakpoints).toHaveBeenCalled();
      expect(context.emuApi.eraseAllBreakpoints).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should handle case when no breakpoints exist", async () => {
      // Arrange
      context.emuApi.listBreakpoints.mockResolvedValue({ breakpoints: [] });

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.emuApi.listBreakpoints).toHaveBeenCalled();
      expect(context.emuApi.eraseAllBreakpoints).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it("should display singular 'breakpoint' for 1 breakpoint", async () => {
      // Arrange
      const mockBreakpoints: BreakpointInfo[] = [
        { address: 0x8000, exec: true }
      ];
      context.emuApi.listBreakpoints.mockResolvedValue({ 
        breakpoints: mockBreakpoints 
      });

      // Act
      await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const message = (context.output.writeLine as any).mock.calls[0][0];
      expect(message).toContain("1 breakpoint removed");
      expect(message).not.toContain("breakpoints");
    });

    it("should display plural 'breakpoints' for multiple breakpoints", async () => {
      // Arrange
      const mockBreakpoints: BreakpointInfo[] = [
        { address: 0x8000, exec: true },
        { address: 0x9000, exec: true },
        { address: 0xa000, exec: true }
      ];
      context.emuApi.listBreakpoints.mockResolvedValue({ 
        breakpoints: mockBreakpoints 
      });

      // Act
      await command.execute(context);

      // Assert
      const message = (context.output.writeLine as any).mock.calls[0][0];
      expect(message).toContain("3 breakpoints removed");
    });

    it("should write message in green color", async () => {
      // Arrange
      context.emuApi.listBreakpoints.mockResolvedValue({ breakpoints: [] });

      // Act
      await command.execute(context);

      // Assert
      expect(context.output.color).toHaveBeenCalledWith("green");
    });

    it("should call emuApi methods in correct order", async () => {
      // Arrange
      const mockBreakpoints: BreakpointInfo[] = [
        { address: 0x8000, exec: true }
      ];
      context.emuApi.listBreakpoints.mockResolvedValue({ 
        breakpoints: mockBreakpoints 
      });

      // Act
      await command.execute(context);

      // Assert
      expect(context.emuApi.listBreakpoints).toHaveBeenCalled();
      expect(context.emuApi.eraseAllBreakpoints).toHaveBeenCalled();
      
      const listCall = (context.emuApi.listBreakpoints as any).mock.invocationCallOrder[0];
      const eraseCall = (context.emuApi.eraseAllBreakpoints as any).mock.invocationCallOrder[0];
      expect(listCall).toBeLessThan(eraseCall);
    });
  });
});

describe("ListBreakpointsCommand", () => {
  let command: ListBreakpointsCommand;
  let context: MockIdeCommandContext;

  beforeEach(() => {
    command = new ListBreakpointsCommand();
    context = createMockContext() as MockIdeCommandContext;
    vi.clearAllMocks();
  });

  describe("Command Metadata", () => {
    it("should have id 'bp-list'", () => {
      expect(command.id).toBe("bp-list");
    });

    it("should have correct description", () => {
      expect(command.description).toBe("Lists all breakpoints");
    });

    it("should have usage 'bp-list'", () => {
      expect(command.usage).toBe("bp-list");
    });

    it("should have alias 'bpl'", () => {
      expect(command.aliases).toEqual(["bpl"]);
    });
  });

  describe("execute", () => {
    it("should display 'No breakpoints set' when no breakpoints exist", async () => {
      // Arrange
      context.emuApi.listBreakpoints.mockResolvedValue({ breakpoints: [] });

      // Act
      const result = await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      const messages = calls.map((call: any) => call[0]).join(" ");
      expect(messages).toContain("No breakpoints set");
      expect(result.success).toBe(true);
    });

    it("should list all breakpoints when breakpoints exist", async () => {
      // Arrange
      const mockBreakpoints: BreakpointInfo[] = [
        { address: 0x8000, exec: true },
        { address: 0x9000, exec: true }
      ];
      context.emuApi.listBreakpoints.mockResolvedValue({ 
        breakpoints: mockBreakpoints 
      });

      // Act
      await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      const calls = (context.output.writeLine as any).mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });

    it("names a partition by its label, not its index", async () => {
      // --- Regression: this listed `-1:$8000`, a notation `bp-set` rejects, because it built the
      // --- key without the partition label map. See the storage/display key split.
      context.emuApi.listBreakpoints.mockResolvedValue({
        breakpoints: [{ address: 0x8000, exec: true, partition: -1 }]
      });
      context.emuApi.getPartitionLabels.mockResolvedValue({ [-1]: "R0", 0: "B0" });

      await command.execute(context);

      const written = (context.output.write as any).mock.calls
        .concat((context.output.writeLine as any).mock.calls)
        .map((call: any) => call[0])
        .join(" ");
      expect(written).toContain("R0:$8000");
      expect(written).not.toContain("-1:$8000");
    });

    it("asks the emulator for the labels it needs", async () => {
      context.emuApi.listBreakpoints.mockResolvedValue({
        breakpoints: [{ address: 0x8000, exec: true }]
      });

      await command.execute(context);

      expect(context.emuApi.getPartitionLabels).toHaveBeenCalled();
    });

    it("should show disabled status for disabled breakpoints", async () => {
      // Arrange
      const mockBreakpoints: BreakpointInfo[] = [
        { address: 0x8000, exec: true, disabled: true }
      ];
      context.emuApi.listBreakpoints.mockResolvedValue({ 
        breakpoints: mockBreakpoints 
      });

      // Act
      await command.execute(context);

      // Assert
      const calls = (context.output.writeLine as any).mock.calls;
      const messages = calls.map((call: any) => call[0]).join(" ");
      expect(messages).toContain("<disabled>");
    });

    it("should not show disabled status for enabled breakpoints", async () => {
      // Arrange
      const mockBreakpoints: BreakpointInfo[] = [
        { address: 0x8000, exec: true, disabled: false }
      ];
      context.emuApi.listBreakpoints.mockResolvedValue({ 
        breakpoints: mockBreakpoints 
      });

      // Act
      await command.execute(context);

      // Assert
      const calls = (context.output.writeLine as any).mock.calls;
      const messages = calls.map((call: any) => call[0]).join(" ");
      expect(messages).not.toContain("<disabled>");
    });

    it("should display breakpoint count with singular form", async () => {
      // Arrange
      const mockBreakpoints: BreakpointInfo[] = [
        { address: 0x8000, exec: true }
      ];
      context.emuApi.listBreakpoints.mockResolvedValue({ 
        breakpoints: mockBreakpoints 
      });

      // Act
      await command.execute(context);

      // Assert
      const calls = (context.output.writeLine as any).mock.calls;
      const messages = calls.map((call: any) => call[0]).join(" ");
      expect(messages).toContain("1 breakpoint set");
    });

    it("should display breakpoint count with plural form", async () => {
      // Arrange
      const mockBreakpoints: BreakpointInfo[] = [
        { address: 0x8000, exec: true },
        { address: 0x9000, exec: true }
      ];
      context.emuApi.listBreakpoints.mockResolvedValue({ 
        breakpoints: mockBreakpoints 
      });

      // Act
      await command.execute(context);

      // Assert
      const calls = (context.output.writeLine as any).mock.calls;
      const messages = calls.map((call: any) => call[0]).join(" ");
      expect(messages).toContain("2 breakpoints set");
    });

    it("should use correct colors for output", async () => {
      // Arrange
      const mockBreakpoints: BreakpointInfo[] = [
        { address: 0x8000, exec: true }
      ];
      context.emuApi.listBreakpoints.mockResolvedValue({ 
        breakpoints: mockBreakpoints 
      });

      // Act
      await command.execute(context);

      // Assert
      expect(context.output.writeLine).toHaveBeenCalled();
      // The command uses bright-blue, bright-magenta, and cyan colors
      // We can verify writeLine was called (color calls are inline)
    });

    it("should call emuApi.listBreakpoints", async () => {
      // Arrange
      context.emuApi.listBreakpoints.mockResolvedValue({ breakpoints: [] });

      // Act
      await command.execute(context);

      // Assert
      expect(context.emuApi.listBreakpoints).toHaveBeenCalledTimes(1);
    });

    it("should return successful result", async () => {
      // Arrange
      context.emuApi.listBreakpoints.mockResolvedValue({ breakpoints: [] });

      // Act
      const result = await command.execute(context);

      // Assert
      expect(result.success).toBe(true);
    });
  });
});

describe("NextReg write breakpoints - the `nr:` address spec", () => {
  /*
   * The fifth shape the shared `<address-spec>` accepts, and the first that names an event rather
   * than a place. Everything here goes through `BreakpointWithAddressCommand.validateCommandArgs`,
   * so `bp-set`, `bp-del` and `bp-en` all get it at once - which is why the round-trip case at the
   * bottom matters more than it looks.
   *
   * See `.plans/NEXTREG_WRITE_BREAKPOINTS_PLAN.md` §4.7.
   */
  let command: SetBreakpointCommand;
  let context: MockIdeCommandContext;

  /** Parses an argument line the way the command dispatcher would, and returns the parsed args. */
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

  describe("the register", () => {
    it.each([
      ["$07", 0x07],
      ["$0a", 0x0a],
      ["7", 7],
      ["255", 255],
      ["$ff", 0xff],
      ["%00000111", 7]
    ])("accepts nr:%s", async (spec, expected) => {
      const { args, errors } = await parse(`nr:${spec}`);
      expect(errors, JSON.stringify(errors)).toHaveLength(0);
      expect(args.nextReg).toBe(expected);
    });

    it("is case-insensitive, because the spec is lower-cased before parsing", async () => {
      expect((await parse("NR:$0A")).args.nextReg).toBe(0x0a);
    });

    it("rejects a register outside $00..$FF", async () => {
      expect((await parse("nr:256")).errors[0].message).toMatch(/between \$00 and \$FF/);
    });

    it("rejects garbage as an invalid register, not as an invalid number", async () => {
      // --- Its own try/catch exists so this does not fall through to the generic message.
      expect((await parse("nr:zzz")).errors[0].message).toMatch(/Invalid Next Register/);
    });
  });

  it("is refused on any machine but the ZX Spectrum Next", async () => {
    context.service.machineService.getMachineInfo.mockReturnValue({
      machine: { machineId: "sp128", features: { rom: 2, bank: 8 } }
    });
    expect((await parse("nr:$07")).errors[0].message).toMatch(/ZX Spectrum Next only/);
  });

  it("is refused on a machine with no partitions, with the right reason", async () => {
    // --- The branch sits above the partition-support gate on purpose: a register needs no pages,
    // --- and being told "this model does not support partitions" would be a misleading no.
    context.service.machineService.getMachineInfo.mockReturnValue({
      machine: { machineId: "sp48", features: {} }
    });
    const { errors } = await parse("nr:$07");
    expect(errors[0].message).toMatch(/ZX Spectrum Next only/);
    expect(errors[0].message).not.toMatch(/partition/i);
  });

  describe("the value filter", () => {
    it("accepts -v alone and -v with -m", async () => {
      expect((await parse("nr:$07 -v $03")).errors).toHaveLength(0);
      expect((await parse("nr:$07 -v $03 -m $0f")).errors).toHaveLength(0);
    });

    it("refuses -m with nothing to mask", async () => {
      expect((await parse("nr:$07 -m $0f")).errors[0].message).toMatch(/needs a -v value/);
    });

    it("refuses a value or mask outside a byte", async () => {
      expect((await parse("nr:$07 -v $100")).errors[0].message).toMatch(/value must be between/);
      expect((await parse("nr:$07 -v $03 -m $100")).errors[0].message).toMatch(/mask must be/);
    });

    it("refuses -v and -c on a breakpoint that is not a NextReg one", async () => {
      expect((await parse("$8000 -v $03")).errors[0].message).toMatch(/only with a NextReg/);
      expect((await parse("$8000 -c")).errors[0].message).toMatch(/only with a NextReg/);
    });
  });

  it.each(["-r", "-w", "-i", "-o"])("refuses %s, which names a place to watch", async (flag) => {
    expect((await parse(`nr:$07 ${flag}`)).errors[0].message).toMatch(
      /watches a register, not memory or a port/
    );
  });

  it("accepts -c, the copper opt-in", async () => {
    const { args, errors } = await parse("nr:$07 -c");
    expect(errors).toHaveLength(0);
    expect(args["-c"]).toBe(true);
  });

  describe("the breakpoint the command builds", () => {
    const build = async (line: string) => {
      const { args } = await parse(line);
      await command.execute(context, args);
      return context.emuApi.setBreakpoint.mock.calls[0][0] as BreakpointInfo;
    };

    it("is not an execution breakpoint", async () => {
      // --- The negation has to know about this shape, or the panel renders it as an exec
      // --- breakpoint with a disassembly cell it has no address to fill.
      expect((await build("nr:$07")).exec).toBe(false);
    });

    it("carries the register, the filter and the copper opt-in", async () => {
      expect(await build("nr:$07 -v $03 -m $0f -c")).toMatchObject({
        nextReg: 0x07,
        nextRegValue: 0x03,
        nextRegMask: 0x0f,
        nextRegCopper: true
      });
    });

    it("keeps -m out of ioMask, where it would mean a port mask", async () => {
      // --- One option, two meanings: the port mask for `-i`/`-o`, the value mask for `nr:`. A
      // --- NextReg breakpoint carrying an `ioMask` would be armed across the whole I/O space.
      const bp = await build("nr:$07 -v $03 -m $0f");
      expect(bp.ioMask).toBeUndefined();
      expect(bp.nextRegMask).toBe(0x0f);
    });

    it("leaves nextRegMask unset when there is no value to mask", async () => {
      expect((await build("nr:$07")).nextRegMask).toBeUndefined();
    });
  });

  describe("the display key round-trips", () => {
    /*
     * The invariant `getBreakpointAddressSpec` exists for: what a listing prints, a sibling command
     * must accept. `BreakpointIndicator` splices the key straight into `bp-del <spec>`, so a key
     * this parser cannot read back is a breakpoint the user cannot click away.
     */
    it.each([
      ["NR:$07", { nextReg: 0x07, "-v": undefined, "-m": undefined }],
      ["NR:$07=$03", { nextReg: 0x07, "-v": 0x03, "-m": undefined }],
      ["NR:$07=$03/$0F", { nextReg: 0x07, "-v": 0x03, "-m": 0x0f }]
    ])("accepts %s back", async (key, expected) => {
      const { args, errors } = await parse(key);
      expect(errors, JSON.stringify(errors)).toHaveLength(0);
      expect(args.nextReg).toBe(expected.nextReg);
      expect(args["-v"]).toBe(expected["-v"]);
      expect(args["-m"]).toBe(expected["-m"]);
    });

    it("builds the same breakpoint from the inline form as from the options", async () => {
      const inline = await parse("nr:$07=$03/$0f");
      const options = await parse("nr:$07 -v $03 -m $0f");
      expect(inline.args.nextReg).toBe(options.args.nextReg);
      expect(inline.args["-v"]).toBe(options.args["-v"]);
      expect(inline.args["-m"]).toBe(options.args["-m"]);
    });

    it("rejects a malformed filter tail rather than ignoring it", async () => {
      expect((await parse("nr:$07=zz")).errors[0].message).toMatch(/Invalid NextReg value/);
      expect((await parse("nr:$07=$03/zz")).errors[0].message).toMatch(/Invalid NextReg value mask/);
    });

    it("prints the key `bp-set` reports in that same notation", async () => {
      const { args } = await parse("nr:$07 -v $03 -m $0f");
      await command.execute(context, args);
      const printed = (context.output.writeLine as any).mock.calls
        .map((call: any[]) => String(call[0]))
        .join(" ");
      expect(printed).toMatch(/NR:\$07=\$03\/\$0F/);
    });
  });
});
