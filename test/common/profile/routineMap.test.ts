import fs from "fs";
import os from "os";
import path from "path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DebuggableOutput, KliveCompilerOutput } from "@abstractions/CompilerInfo";
import type { AppState } from "@common/state/AppState";
import { profileOffsetOf, type ProfileLayout } from "@common/profile/layouts/profileLayout";
import { sp48ProfileLayout } from "@common/profile/layouts/sp48";
import { sp128ProfileLayout } from "@common/profile/layouts/sp128";
import { PROFILE_KEY_ROOT, type ProfileEdge } from "@common/profile/profileTypes";
import { buildRoutineMap, routineSourceLabel } from "@common/profile/routineMap";
import { KBasicCompiler } from "@main/kbasic/KBasicCompiler";
import { extractSldInfo, sldSymbols } from "@main/sjasmp-integration/SjasmPCompiler";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { AssemblerOptions } from "@main/compiler-common/assembler-in-out";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";

/*
 * The profiler's routine maps (`.plans/PROFILER_PLAN.md` D6, Phase 1): from Klive BASIC callables,
 * the Klive assembler's `.proc` extents and labels (modules included), sjasmplus SLD labels with
 * pages, call targets and bare blocks.
 */

/** The offsets of a fixed-map or banked layout; unbanked addresses through a fixed paging */
function offsets(layout: ProfileLayout, paged: (address: number) => number | undefined = () => undefined) {
  return (partition: number | undefined, address: number) =>
    profileOffsetOf(layout, partition ?? paged(address), address) ?? profileOffsetOf(layout, undefined, address);
}

async function assemble(source: string, model?: SpectrumModelType): Promise<KliveCompilerOutput> {
  const options = new AssemblerOptions();
  if (model) options.currentModel = model;
  const output = await new Z80Assembler().compile(source, options);
  expect(output.errors.filter((e) => !e.isWarning)).toEqual([]);
  return output as unknown as KliveCompilerOutput;
}

describe("routine maps from the Klive assembler", () => {
  it("rolls labels up to the next label, skipping temporary and proc-local ones (D6 (3))", async () => {
    const compilation = await assemble(`
      .org $8000
Main:   call Draw
        ret
Draw:   ld b,4
\`loop: djnz \`loop
        ret
Table:  .defb 1,2,3
`);
    const map = buildRoutineMap({ compilation, layout: sp48ProfileLayout, offsetOf: offsets(sp48ProfileLayout) });
    expect(map.source).toBe("labels");
    expect(routineSourceLabel(map)).toBe("Routines from labels (Klive asm)");
    expect(map.routines.map((r) => [r.name, r.entry, r.end])).toEqual([
      ["Main", 0x8000, 0x8004],
      ["Draw", 0x8004, 0x8009],
      // --- Shown as written, though a case-insensitive build stores names lower-case
      ["Table", 0x8009, 0x800c]
    ]);
    expect(map.routineAt(0x8006).name).toBe("Draw");
    expect(map.routineByEntry(0x8004)?.name).toBe("Draw");
    expect(map.routines[1]).toMatchObject({ fileIndex: 0, line: 5 });
    // --- Outside every routine: the 256-byte block
    expect(map.routineAt(0x9012)).toMatchObject({ name: "$9000-$90FF", source: "blocks" });
  });

  it("prefers .proc extents and names nested-module labels with their path (D6 (2))", async () => {
    const compilation = await assemble(`
      .org $8000
Main:   call Gfx.Plot
        call Print
        ret
Print:  .proc
        ld a,1
Inner:  ret
        .endp
Gfx:    .module
Plot:   nop
        ret
        .endmodule
`);
    const map = buildRoutineMap({ compilation, layout: sp48ProfileLayout, offsetOf: offsets(sp48ProfileLayout) });
    expect(map.source).toBe("proc");
    expect(map.routineAt(0x8007)).toMatchObject({ name: "Print", source: "proc", entry: 0x8007, end: 0x800a });
    // --- Labels fill what the procs leave
    expect(map.routineAt(0x8000)).toMatchObject({ name: "Main", source: "labels" });
    expect(map.routineAt(0x800b)).toMatchObject({ name: "gfx.Plot", source: "labels" });
  });

  it("puts a banked label in its bank's partition", async () => {
    const compilation = await assemble(
      `
      .model Spectrum128
      .org $8000
Main:   ret
      .bank 3
Far:    nop
        ret
`,
      SpectrumModelType.Spectrum128
    );
    // --- $8000 is bank 2 on the 128K
    const offsetOf = offsets(sp128ProfileLayout, (address) => (address >= 0x8000 && address < 0xc000 ? 2 : 0));
    const map = buildRoutineMap({ compilation, layout: sp128ProfileLayout, offsetOf, machineId: "sp128" });
    const far = map.routines.find((r) => r.name === "Far")!;
    expect(far.partition).toBe(3);
    expect(far.entryOffset).toBe(3 * 0x4000);
    expect(map.routineAt(3 * 0x4000 + 1).name).toBe("Far");
    expect(map.routineAt(2 * 0x4000).name).toBe("Main");
    // --- The same address in bank 0 is not Far's
    expect(map.routineAt(0).source).toBe("blocks");
  });
});

describe("routine maps from sjasmplus", () => {
  const SLD = [
    "|SLD.data.version|1",
    "main.asm|4||0|2|32768|L|,Main,,+used",
    "main.asm|6||0|2|32772|L|,Main,loop",
    "main.asm|9||0|-1|254|L|,PORT,,+equ",
    "main.asm|12||0|0|49152|L|gfx,Plot,,+used",
    "main.asm|20||0|3|49152|L|,Far,,+used"
  ].join("\n");

  it("uses non-local labels and their pages (D8)", () => {
    const files = ["main.asm"];
    const symbols = sldSymbols(extractSldInfo(SLD), { banked: true, fileIndexOf: () => 0 });
    const compilation = {
      sourceType: "sjasmp",
      symbols,
      segments: [],
      sourceFileList: files.map((filename) => ({ filename })),
      listFileItems: []
    } as unknown as KliveCompilerOutput;
    const map = buildRoutineMap({ compilation, layout: sp128ProfileLayout, offsetOf: offsets(sp128ProfileLayout), machineId: "sp128" });
    expect(routineSourceLabel(map)).toBe("Routines from labels (sjasmplus)");
    // --- Main.loop is local: Main runs on past it
    expect(map.routineAt(2 * 0x4000 + 4)).toMatchObject({ name: "Main", file: "main.asm", line: 4 });
    // --- One address, two banks, two routines (T3)
    expect(map.routineAt(0)).toMatchObject({ name: "gfx.Plot", partition: 0 });
    expect(map.routineAt(3 * 0x4000)).toMatchObject({ name: "Far", partition: 3 });
    // --- An EQU is not a routine
    expect(map.routines.some((r) => r.name === "PORT")).toBe(false);
  });
});

describe("routine maps without symbols", () => {
  it("makes routines of call targets when the call graph ran (D6 (4))", () => {
    const edges: ProfileEdge[] = [
      { caller: PROFILE_KEY_ROOT, callee: 0x8000, calleeAddress: 0x8000, kind: "call", calls: 1, inclusive: 100, exclusive: 50 },
      { caller: 0x8000, callee: 0x8040, calleeAddress: 0x8040, kind: "call", calls: 2, inclusive: 50, exclusive: 50 }
    ];
    const map = buildRoutineMap({ layout: sp48ProfileLayout, offsetOf: offsets(sp48ProfileLayout), edges });
    expect(map.source).toBe("callTargets");
    expect(map.routineAt(0x803f)).toMatchObject({ name: "sub_8000", entry: 0x8000 });
    expect(map.routineAt(0x8040)).toMatchObject({ name: "sub_8040" });
    expect(map.routineAt(0x7fff).source).toBe("blocks");
  });

  it("falls back to 256-byte blocks, named by partition on a banked machine (D6 (5))", () => {
    const map = buildRoutineMap({
      layout: sp128ProfileLayout,
      offsetOf: offsets(sp128ProfileLayout),
      partitionLabel: (p) => (p < 0 ? `R${-p - 1}` : String(p))
    });
    expect(map.source).toBe("blocks");
    expect(routineSourceLabel(map)).toBe("256-byte blocks (no symbols)");
    expect(map.routineAt(5 * 0x4000 + 0x1234).name).toBe("5:$1200-$12FF");
    expect(map.routineAt(0x40000 + 0x38).name).toBe("R0:$0000-$00FF");
  });
});

describe("routine maps from Klive BASIC", () => {
  let folder: string;
  let compilation: DebuggableOutput;

  beforeAll(async () => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), "kbasic-routines-"));
    const file = path.join(folder, "main.bas");
    fs.writeFileSync(file, ["SUB Blip(n AS UByte)", "  POKE 23296, n", "END SUB", "Blip(1)", "Blip(2)", ""].join("\n"));
    const compiler = new KBasicCompiler();
    compiler.setAppState({ userSettings: {}, projectSettings: {}, emulatorState: { machineId: "sp48" } } as unknown as AppState);
    compilation = (await compiler.compileFile(file, undefined, "debug")) as DebuggableOutput;
    expect(compilation.errors?.filter((e) => !e.isWarning)).toEqual([]);
  });
  afterAll(() => fs.rmSync(folder, { recursive: true, force: true }));

  it("uses the callables' exact extents first (D6 (1))", () => {
    const map = buildRoutineMap({ compilation, layout: sp48ProfileLayout, offsetOf: offsets(sp48ProfileLayout), machineId: "sp48" });
    expect(map.source).toBe("kbasic");
    expect(routineSourceLabel(map)).toBe("Routines from Klive BASIC SUBs and FUNCTIONs (Klive BASIC)");
    const debug = compilation.sourceLevelDebug!;
    const beep = debug.callables.find((c) => c.name.toLowerCase() === "blip")!;
    const frame = debug.extensions!.frames.find((f) => f.callableIndex === beep.index)!;
    const routine = map.routineAt(frame.bodyStart);
    expect(routine).toMatchObject({ source: "kbasic", entry: frame.startAddress, end: frame.endAddress, line: beep.startLine });
    expect(routine.name.toLowerCase()).toBe("blip");
    // --- The runtime between the callables is named by its runtime symbols
    const runtime = debug.extensions!.runtimeSymbols[0];
    if (runtime) expect(map.routineAt(runtime.address).source).not.toBe("blocks");
  });
});
