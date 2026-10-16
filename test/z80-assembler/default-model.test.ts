import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { AppState } from "@common/state/AppState";
import { Z80Compiler } from "@main/z80-compiler/Z80Compiler";
import { defaultModelTypeForMachine, SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";

/**
 * A source with no `.model` is assembled for the running machine (`.plans/ZX8081_CODE_INJECTION_PLAN.md`
 * §7, Q1): the IDE compiles without options, and `Z80Compiler` takes the model from the app state.
 */
const dir = mkdtempSync(join(tmpdir(), "klive-default-model-"));
afterAll(() => rmSync(dir, { recursive: true, force: true }));

async function compileOn(machineId: string | undefined, source: string, config: Record<string, any> = {}) {
  const file = join(dir, `src${Math.random().toString(36).slice(2)}.kz80.asm`);
  writeFileSync(file, source);
  const compiler = new Z80Compiler();
  compiler.setAppState({ emulatorState: { machineId, config } } as unknown as AppState);
  return (await compiler.compileFile(file)) as any;
}

const PROBE = `
  #ifmod SPECTRUM48
    .defb 1
  #endif
  #ifmod SPECTRUM128
    .defb 2
  #endif
  #ifmod SPECTRUMP3
    .defb 3
  #endif
  #ifmod NEXT
    .defb 4
  #endif
  #ifmod ZX80
    .defb 5
  #endif
  #ifmod ZX81
    .defb 6
  #endif
`;

describe("The default model of a source with no .model", () => {
  it.each([
    ["sp48", 1],
    ["sp128", 2],
    ["spp3e", 3],
    ["zxnext", 4],
    ["zx80", 5],
    ["zx81", 6],
    ["timex", 1],
    [undefined, 1]
  ])("on %s is model %i", async (machineId, model) => {
    const out = await compileOn(machineId, PROBE);
    expect(out.segments[0].emittedCode).toEqual([model]);
    // --- The output still names no model: run and debug take the machine's own flow
    expect(out.modelType).toBeUndefined();
  });

  it("is the ZX81 on a ZX80 with the 8K ROM", () => {
    expect(defaultModelTypeForMachine("zx80", { zx80Rom8K: true })).toBe(SpectrumModelType.ZX81);
  });

  it("lets .defzx work on a ZX81 without .model", async () => {
    const out = await compileOn("zx81", ` .defzx "A"`);
    expect(out.errors).toEqual([]);
    expect(out.segments[0].emittedCode).toEqual([0x26]);
  });

  it("does not change .bank, which still needs an explicit .model", async () => {
    const out = await compileOn("sp128", ` .bank 1\n nop`);
    expect(out.errors.map((e: any) => e.errorCode)).toEqual(["Z0308"]);
  });

  it("does not let Next instructions through without .model Next", async () => {
    const out = await compileOn("zxnext", ` swapnib`);
    expect(out.errors.map((e: any) => e.errorCode)).toEqual(["Z0414"]);
  });

  it("lets the Next pragmas work on a Next without .model", async () => {
    const out = await compileOn("zxnext", ` .copper halt`);
    expect(out.errors).toEqual([]);
  });
});
