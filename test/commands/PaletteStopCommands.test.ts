import { describe, it, expect, vi, beforeEach } from "vitest";
import { SetBreakpointCommand } from "@renderer/appIde/commands/BreakpointCommands";
import { breakpointCommandSpec, breakpointKind } from "@common/utils/breakpoint-spec";
import { getBreakpointStorageKey } from "@common/utils/breakpoints";
import { isEventBreakpoint, isPaletteStop } from "@common/utils/breakpoint-scope";
import { compileCondition } from "@common/utils/breakpoint-condition/condition-checker";
import { createMockContext } from "./test-helpers/mock-context";
import type { IdeCommandContext } from "@renderer/abstractions/IdeCommandContext";
import { ValidationMessageType } from "@renderer/abstractions/ValidationMessageType";
import {
  buildPaletteWatch,
  decodePaletteHit,
  describePaletteStop,
  formatPaletteStop,
  matchesPaletteStop,
  paletteHitAccess,
  paletteStopSlots,
  parsePaletteStop,
  passesPaletteOptions,
  PaletteWatchFlag,
  type PaletteStop
} from "@common/zxnext/palette/paletteStops";
import {
  breakpointToForm,
  createEmptyForm,
  formToBreakpointInfo,
  paletteTriggerText,
  validateBreakpointForm
} from "@renderer/appIde/utils/breakpoint-form";
import { groupOf } from "@renderer/appIde/utils/breakpoint-grouping";

type MockIdeCommandContext = IdeCommandContext & {
  service: { machineService: { getMachineInfo: ReturnType<typeof vi.fn> } };
};

const stop = (spec: string) => parsePaletteStop(spec) as PaletteStop;

/*
 * Palette breakpoints (`dev/plans/NEXT_PALETTE_DEBUGGING_PLAN.md` §3): the spec module, the `pal:`
 * address spec of `bp-set`, the condition names and the breakpoint form. The core and the debug loop
 * are covered by test/wasm/zxNext/wasm-next-palette-breakpoint.test.ts.
 */
describe("palette breakpoints - the spec", () => {
  it.each([
    ["spr1:$03", "spr1:$03"],
    ["SPR1:$03", "spr1:$03"],
    ["l2:$00-$0F", "l2:$00-$0f"],
    ["l2:0-15", "l2:$00-$0f"],
    ["ula2", "ula2"],
    ["tm:$00-$FF", "tm"],
    ["any", "any"],
    ["tm:live", "tm:live"],
    ["any:live", "any:live"]
  ])("parses %s", (spec, normalized) => {
    const parsed = parsePaletteStop(spec);
    expect("error" in parsed).toBe(false);
    expect(formatPaletteStop(parsed as PaletteStop)).toBe(normalized);
  });

  it.each([
    ["foo", "device"],
    ["spr3", "device"],
    ["spr1:$100", "entries"],
    ["spr1:$10-$05", "entries"],
    ["spr1:abc", "entries"],
    ["spr1:live", "live"],
    ["spr1:$03:x", "extra"]
  ])("refuses %s (%s)", (spec, error) => {
    expect(parsePaletteStop(spec)).toEqual({ error });
  });

  it("names the core slots a device and bank cover", () => {
    expect(paletteStopSlots(stop("spr1"))).toEqual([2]);
    expect(paletteStopSlots(stop("spr"))).toEqual([2, 6]);
    expect(paletteStopSlots(stop("any2"))).toEqual([4, 5, 6, 7]);
  });

  it("builds the core's watch: an exact entry bitmap, the union of the options, the live devices", () => {
    const watch = buildPaletteWatch([
      { stop: stop("spr1:$03"), changed: true },
      { stop: stop("tm:live"), copper: true }
    ]);
    expect(watch.entries[2 * 32]).toBe(1 << 3);
    expect(watch.entries.reduce((n, b) => n + (b ? 1 : 0), 0)).toBe(1);
    // --- Every entry breakpoint wants -changed, so unchanged writes are not reported
    expect(watch.flags).toBe(PaletteWatchFlag.Armed | PaletteWatchFlag.Copper | (0x08 << PaletteWatchFlag.LiveShift));
    expect(buildPaletteWatch([{ stop: stop("l2") }]).flags & PaletteWatchFlag.AnyWrite).toBeTruthy();
    expect(buildPaletteWatch([]).flags).toBe(0);
  });

  it("decodes the core's hit and matches it against stops", () => {
    // --- Present, CPU through a NextReg, $41, slot 6 (sprites 2), entry $1F; $007 -> $1C0
    const hit = decodePaletteHit((0x8000_0000 | (1 << 27) | (0 << 24) | (6 << 8) | 0x1f) >>> 0, 0x007 | (0x1c0 << 16));
    expect(hit).toEqual({ kind: "entry", slot: 6, index: 0x1f, oldValue: 7, newValue: 0x1c0, origin: "nextreg", path: "$41" });
    expect(matchesPaletteStop(stop("spr2:$1f"), hit!)).toBe(true);
    expect(matchesPaletteStop(stop("spr"), hit!)).toBe(true);
    expect(matchesPaletteStop(stop("spr1"), hit!)).toBe(false);
    expect(matchesPaletteStop(stop("spr:$00-$1e"), hit!)).toBe(false);
    expect(matchesPaletteStop(stop("spr:live"), hit!)).toBe(false);
    expect(decodePaletteHit(0, 0)).toBeUndefined();

    const flip = decodePaletteHit((0xc000_0000 | (2 << 27) | (4 << 24) | (7 << 8)) >>> 0, 0 | (1 << 16));
    expect(flip).toMatchObject({ kind: "live", slot: 7, origin: "copper", path: "$6B", newValue: 1 });
    expect(matchesPaletteStop(stop("tm:live"), flip!)).toBe(true);
    expect(matchesPaletteStop(stop("any:live"), flip!)).toBe(true);
    expect(matchesPaletteStop(stop("tm"), flip!)).toBe(false);
  });

  it("applies -c and -changed", () => {
    const write = { kind: "entry" as const, origin: "nextreg" as const, oldValue: 5, newValue: 5 };
    expect(passesPaletteOptions(write, {})).toBe(true);
    expect(passesPaletteOptions(write, { changed: true })).toBe(false);
    expect(passesPaletteOptions({ ...write, origin: "copper" }, {})).toBe(false);
    expect(passesPaletteOptions({ ...write, origin: "copper" }, { copper: true })).toBe(true);
  });

  it("packs VAL and ADDR for a condition", () => {
    expect(paletteHitAccess({ slot: 2, index: 4, oldValue: 0x008, newValue: 0x1c0 })).toEqual({
      value: 0x1c0,
      address: (0x008 << 16) | (2 << 8) | 4
    });
  });

  it("describes a stop", () => {
    expect(
      describePaletteStop({
        kind: "entry",
        slot: 1,
        index: 0,
        oldValue: 0,
        newValue: 1,
        origin: "dma",
        path: "$FF3B",
        pc: 0x8003
      })
    ).toBe("Palette breakpoint: Layer 2 bank 1 entry $00 $000 -> $001 by the DMA (port $FF3B), with the CPU at $8003");
  });

  it("is an event breakpoint with a PAL: key and its own group", () => {
    const bp = { paletteStop: "spr1:$03", paletteCopper: true, paletteChanged: true };
    expect(isPaletteStop(bp)).toBe(true);
    expect(isEventBreakpoint(bp)).toBe(true);
    expect(getBreakpointStorageKey(bp)).toBe("PAL:SPR1:$03");
    expect(breakpointCommandSpec(bp, {})).toBe("PAL:SPR1:$03 -c -changed");
    expect(breakpointKind(bp)).toBe("palette");
    expect(groupOf(bp)).toBe("palette");
  });
});

describe("palette breakpoints - the condition names", () => {
  it("resolves palSlot, palIndex, palOld and palNew on a palette breakpoint", () => {
    const result = compileCondition("palSlot == 2 && palIndex == 4 && palOld == $008 && palNew == $1C0", {
      accessKind: "palette",
      isNext: true,
      symbols: {}
    });
    expect(result.errors).toEqual([]);
    expect(result.compiled?.labels ?? []).toEqual([]);
  });

  it("leaves them label names on any other breakpoint", () => {
    const result = compileCondition("palNew == 1", { accessKind: "exec", isNext: true, symbols: {} });
    expect(result.errors).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

describe("palette breakpoints - the `pal:` address spec", () => {
  let command: SetBreakpointCommand;
  let context: MockIdeCommandContext;

  const parse = async (line: string) => {
    const args: any = {};
    const tokens = line.split(/\s+/).filter(Boolean);
    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (args.addrSpec === undefined && !token.startsWith("-")) args.addrSpec = token;
      else if (token === "-hit" || token === "-if" || token === "-attr") args[token] = tokens[++i];
      else if (token === "-m" || token === "-v") args[token] = Number(tokens[++i]);
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
    ["pal:spr1:$03", "spr1:$03"],
    ["PAL:L2:$00-$0F", "l2:$00-$0f"],
    ["pal:tm:live", "tm:live"],
    ["pal:any", "any"]
  ])("accepts %s", async (spec, normalized) => {
    const { args, errors } = await parse(spec);
    expect(errors, JSON.stringify(errors)).toHaveLength(0);
    expect(args.paletteStop).toBe(normalized);
  });

  it("accepts -c and -changed", async () => {
    const { errors } = await parse("pal:spr1 -c -changed");
    expect(errors).toHaveLength(0);
  });

  it.each([
    ["pal:foo", /Unknown palette/],
    ["pal:spr1:$1FF", /entry or a range/],
    ["pal:spr1:live", /watches both banks/],
    ["pal:spr1 -w", /A palette breakpoint takes none of/],
    ["pal:spr1 -attr 0", /A palette breakpoint takes none of/],
    ["$8000 -changed", /only with a palette breakpoint/]
  ])("refuses %s", async (spec, message) => {
    expect((await parse(spec)).errors[0].message).toMatch(message);
  });

  it("is refused on any machine but the ZX Spectrum Next", async () => {
    context.service.machineService.getMachineInfo.mockReturnValue({ machine: { machineId: "sp48", features: {} } });
    expect((await parse("pal:any")).errors[0].message).toMatch(/only on the ZX Spectrum Next/);
  });
});

describe("palette breakpoints - the breakpoint form", () => {
  it("round-trips a breakpoint through the form", () => {
    const form = breakpointToForm({ paletteStop: "spr2:$00-$0f", paletteChanged: true, paletteCopper: true });
    expect(form).toMatchObject({
      kind: "palette",
      paletteDevice: "spr",
      paletteBank: "2",
      paletteTarget: "entries",
      paletteEntries: "$00-$0F",
      paletteChanged: true,
      paletteCopper: true
    });
    expect(formToBreakpointInfo(form)).toMatchObject({
      paletteStop: "spr2:$00-$0f",
      paletteChanged: true,
      paletteCopper: true,
      exec: false
    });
    expect(paletteTriggerText(form)).toBe("PAL:SPR2:$00-$0F");
  });

  it("a flip ignores the bank and -changed", () => {
    const form = {
      ...createEmptyForm(),
      kind: "palette" as const,
      paletteDevice: "tm" as const,
      paletteBank: "1" as const,
      paletteTarget: "live" as const,
      paletteChanged: true
    };
    expect(formToBreakpointInfo(form)).toMatchObject({ paletteStop: "tm:live", paletteChanged: undefined });
  });

  it("refuses entries that do not parse, and machines without them", () => {
    const form = { ...createEmptyForm(), kind: "palette" as const, paletteEntries: "$1FF" };
    expect(validateBreakpointForm(form, { supportsNextRegBreakpoints: true } as never).paletteEntries).toMatch(/\$00 to \$FF/);
    expect(
      validateBreakpointForm({ ...form, paletteEntries: "" }, { supportsNextRegBreakpoints: false } as never).paletteEntries
    ).toMatch(/only on the ZX Spectrum Next/);
  });
});
