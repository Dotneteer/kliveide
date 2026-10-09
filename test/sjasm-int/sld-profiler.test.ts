import { describe, expect, it } from "vitest";

import { extractSldInfo, sldPagesArePartitions, sldSymbols } from "@main/sjasmp-integration/SjasmPCompiler";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import {
  buildLabelsOfCompilation,
  createAddressSymbols
} from "@renderer/appIde/annotations/symbolResolver";

/*
 * sjasmplus debug info as the profiler needs it (`.plans/PROFILER_PLAN.md` D8): `L` lines are
 * labels the Execution History and the routine rollup see (D8a), local labels say so, and on a
 * banked device a label's SLD page is its partition (D8b). The fixture follows sjasmplus's SLD
 * version 1 format.
 */

const SLD = [
  "|SLD.data.version|1",
  "main.asm|1||0|-1|-1|Z|pages.size:16384,pages.count:8,slots.count:4,slots.adr:0,16384,32768,49152",
  "main.asm|4||0|2|32768|L|,Main,,+used",
  "main.asm|6||0|2|32772|L|,Main,loop",
  "main.asm|9||0|-1|254|L|,PORT,,+equ",
  "main.asm|12||0|0|49152|L|gfx,Plot,,+used",
  "main.asm|14||0|2|32780|D|,counter",
  "inc.asm|3:5:9||0|3|49200|F|,Banked3"
].join("\n");

describe("sjasmplus symbols for the profiler", () => {
  const lines = extractSldInfo(SLD);

  it("types labels, constants and DEFL variables like the Klive assembler (D8a)", () => {
    const symbols = sldSymbols(lines) as Record<string, { type: number; isLocal?: boolean }>;
    expect(symbols.main.type).toBe(1);
    expect(symbols["main.loop"]).toMatchObject({ type: 1, isLocal: true });
    expect(symbols.port.type).toBe(3);
    expect(symbols["gfx.plot"].type).toBe(1);
    expect(symbols["gfx.plot"].isLocal).toBeUndefined();
    expect(symbols.counter.type).toBe(2);
    expect(symbols.banked3.type).toBe(1);
  });

  it("lets the Execution History name sjasmplus labels", () => {
    const symbols = createAddressSymbols({
      buildLabels: buildLabelsOfCompilation({ symbols: sldSymbols(lines) }, undefined)
    });
    const lookup = (address: number) => symbols.labelAt(address, undefined)?.name;
    expect(lookup(0x8000)).toBe("Main");
    expect(lookup(0xc000)).toBe("gfx.Plot");
    // --- An EQU and a DEFL are not code addresses
    expect(lookup(254)).toBeUndefined();
    expect(lookup(32780)).toBeUndefined();
  });

  it("keeps a label's page as its partition on a banked device (D8b), with its source line", () => {
    const files: string[] = [];
    const fileIndexOf = (f: string) => (files.includes(f) ? files.indexOf(f) : files.push(f) - 1);
    const symbols = sldSymbols(lines, { banked: true, fileIndexOf }) as Record<string, Record<string, unknown>>;
    expect(symbols.main).toMatchObject({ partition: 2, definitionFileIndex: 0, definitionLine: 4 });
    expect(symbols.banked3).toMatchObject({ partition: 3, definitionFileIndex: 1, definitionLine: 3 });
    // --- An EQU's page (-1) is no partition, and neither is any page without `banked`
    expect(symbols.port.partition).toBeUndefined();
    expect((sldSymbols(lines) as Record<string, Record<string, unknown>>).main.partition).toBeUndefined();
  });

  it("treats only the 128K, +3 and Next devices' pages as partitions", () => {
    expect(sldPagesArePartitions(SpectrumModelType.Spectrum48)).toBe(false);
    expect(sldPagesArePartitions(SpectrumModelType.Spectrum128)).toBe(true);
    expect(sldPagesArePartitions(SpectrumModelType.SpectrumP3)).toBe(true);
    expect(sldPagesArePartitions(SpectrumModelType.Next)).toBe(true);
  });
});
