import { describe, it, expect, vi, beforeEach } from "vitest";
import { SetBreakpointCommand } from "@renderer/appIde/commands/BreakpointCommands";
import { breakpointCommandSpec } from "@common/utils/breakpoint-spec";
import { createMockContext } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";
import {
  buildDmaWatch,
  decodeDmaHit,
  describeDmaStop,
  DmaWatchKind,
  formatDmaStop,
  matchesDmaStop,
  parseDmaStop
} from "@common/zxnext/dma/dmaStops";
import { breakpointToForm, formToBreakpointInfo, createEmptyForm } from "@renderer/appIde/utils/breakpoint-form";

type MockIdeCommandContext = IdeCommandContext & {
  service: { machineService: { getMachineInfo: ReturnType<typeof vi.fn> } };
};

/*
 * DMA stops (`dev/plans/NEXT_DMA_DEBUGGING_PLAN.md` §12): the spec module, the `dma:` address spec of
 * `bp-set`/`bp-del`/`bp-en`, and the breakpoint form. The core and the debug loop are covered by
 * test/wasm/zxNext/wasm-next-dma-stop.test.ts.
 */
describe("DMA stops - the spec", () => {
  it.each([
    ["enable", "enable"],
    ["END", "end"],
    ["count:256", "count:256"],
    ["count:$100", "count:256"],
    ["write:$4000", "write:$4000"],
    ["write:$4000-$5AFF", "write:$4000-$5aff"],
    ["held:70000", "held:70000"],
    ["problem", "problem"]
  ])("parses %s", (spec, normalized) => {
    const parsed = parseDmaStop(spec);
    expect("error" in parsed).toBe(false);
    expect(formatDmaStop(parsed as never)).toBe(normalized);
  });

  it.each([
    ["foo", "kind"],
    ["count", "count"],
    ["count:0", "count"],
    ["write:$5000-$4000", "address"],
    ["write:$10000", "address"],
    ["held:abc", "limit"],
    ["end:1", "extra"]
  ])("refuses %s (%s)", (spec, error) => {
    expect(parseDmaStop(spec)).toEqual({ error });
  });

  it("builds the core's watch: kinds, four slots, the smallest held limit, a step's one-shot", () => {
    const stops = ["end", "count:10", "count:20", "write:$4000-$4fff", "held:500", "held:200"].map((s) => parseDmaStop(s) as never);
    const watch = buildDmaWatch(stops, "byte");
    expect(watch.kinds).toBe(
      (1 << DmaWatchKind.End) | (1 << DmaWatchKind.Count) | (1 << DmaWatchKind.Write) | (1 << DmaWatchKind.Held) | (1 << DmaWatchKind.Byte)
    );
    expect(watch.counts).toEqual([10, 20]);
    expect(watch.writes).toEqual([{ from: 0x4000, to: 0x4fff }]);
    expect(watch.heldLimit).toBe(200);
    expect(buildDmaWatch([]).kinds).toBe(0);
  });

  it("decodes the hit record and matches it against stops", () => {
    const rec = new Uint8Array([DmaWatchKind.Count, 0, 10, 0, 0x0a, 0xc0, 0x0a, 0xd0, 0, 0, 0x09, 0x80, 0, 0, 0, 0]);
    const hit = decodeDmaHit(rec);
    expect(hit).toMatchObject({ kind: DmaWatchKind.Count, moved: 10, src: 0xc00a, dest: 0xd00a, pc: 0x8009 });
    expect(matchesDmaStop(parseDmaStop("count:10") as never, hit)).toBe(true);
    expect(matchesDmaStop(parseDmaStop("count:11") as never, hit)).toBe(false);
    expect(matchesDmaStop(parseDmaStop("end") as never, hit)).toBe(false);
    expect(describeDmaStop(hit)).toBe("DMA stop: 10 bytes moved (next $C00A → $D00A); the CPU continues at $8009");
  });
});

describe("DMA stops - the `dma:` address spec", () => {
  let command: SetBreakpointCommand;
  let context: MockIdeCommandContext;

  const parse = async (line: string) => {
    const args: any = {};
    const tokens = line.split(/\s+/).filter(Boolean);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (args.addrSpec === undefined && !token.startsWith("-")) args.addrSpec = token;
      else if (token === "-hit" || token === "-if") args[token] = tokens[++i];
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
    ["dma:end", "end"],
    ["DMA:COUNT:256", "count:256"],
    ["dma:write:$4000-$5AFF", "write:$4000-$5aff"],
    ["dma:held:70000", "held:70000"]
  ])("accepts %s", async (spec, normalized) => {
    const { args, errors } = await parse(spec);
    expect(errors, JSON.stringify(errors)).toHaveLength(0);
    expect(args.dmaStop).toBe(normalized);
  });

  it.each([
    ["dma:foo", /Unknown DMA event/],
    ["dma:count", /needs a number of bytes/],
    ["dma:end:1", /no more arguments/]
  ])("refuses %s", async (spec, message) => {
    expect((await parse(spec)).errors[0].message).toMatch(message);
  });

  it("refuses access options", async () => {
    expect((await parse("dma:end -w")).errors[0].message).toMatch(/A DMA stop takes none of/);
  });

  it("is refused on any machine but the ZX Spectrum Next", async () => {
    context.service.machineService.getMachineInfo.mockReturnValue({ machine: { machineId: "sp48", features: {} } });
    expect((await parse("dma:end")).errors[0].message).toMatch(/only on the ZX Spectrum Next/);
  });

  it("round-trips through bp-list's spec", () => {
    expect(breakpointCommandSpec({ dmaStop: "count:256" }, {})).toBe("DMA:COUNT:256");
  });
});

describe("DMA stops - the breakpoint form", () => {
  it("round-trips a stop through the form", () => {
    const form = breakpointToForm({ dmaStop: "write:$4000-$5aff" });
    expect(form).toMatchObject({ kind: "dma", dmaEvent: "write", dmaArg: "$4000-$5AFF" });
    expect(formToBreakpointInfo(form)).toMatchObject({ dmaStop: "write:$4000-$5aff", exec: false });
  });

  it("an event without an argument", () => {
    const form = { ...createEmptyForm(), kind: "dma" as const, dmaEvent: "problem" as const };
    expect(formToBreakpointInfo(form)).toMatchObject({ dmaStop: "problem" });
  });
});
