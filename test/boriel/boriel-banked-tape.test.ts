import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { parseZ80File } from "@common/spectrum/snapshot/z80File";
import { bankedSegments, extractBankedProgram, programBankIds } from "@main/boriel-integration/boriel-banked";
import { SpectrumModelType } from "@main/z80-compiler/SpectrumModelTypes";
import { createAutoStartBlock, createTapeBlocks, type SpectrumTapeOptions } from "@renderer/appIde/commands/spectrumTapeBlocks";

import { createSp128Session } from "../harness/sp128";

/*
 * Klive's own 128K tape loader (`expc -f tap -as`) with a banked zxbc program (fixture banked-128:
 * resident code at $8000, modules in RAM banks 0 and 1). The loader pages each bank in at $C000 to
 * load it, and the program's far calls page them again. With BASIC's default RAMTOP the machine
 * stack is in that window too, so the loader has to CLEAR below the code even without `-c`;
 * before it did, the first paging took the stack away and the 128K reset into 48 BASIC.
 */

const FIXTURE = path.join(__dirname, "fixtures", "banked-128");
const ORG = 0x8000;
const TOTAL = 0x802e; // --- `._total` in program.map: the program leaves 311 there and prints it

function bankedOutput() {
  const dbg = JSON.parse(fs.readFileSync(path.join(FIXTURE, "program.dbg"), "utf8"));
  const ram = parseZ80File(new Uint8Array(fs.readFileSync(path.join(FIXTURE, "program.z80")))).ram;
  const parts = extractBankedProgram(ram, ORG, programBankIds(dbg.sourceLevelDebug.extensions.codebank, "zx128k"), dbg.binaryLength, dbg.binaryChecksum);
  if (typeof parts === "string") throw new Error(parts);
  return { modelType: SpectrumModelType.Spectrum128, segments: bankedSegments(parts), errors: [] } as any;
}

describe("Klive's 128K tape loader with a banked Boriel BASIC program", () => {
  it.each<[string, SpectrumTapeOptions]>([
    ["without -c", { "-n": "banked" }],
    ["with -c", { "-n": "banked", "-c": true }]
  ])("loads every bank and runs the program (%s)", async (_label, args) => {
    const output = bankedOutput();
    const data = [...createAutoStartBlock(output, args, ORG), ...createTapeBlocks(output, args)];
    const s = await createSp128Session("sp128");
    s.insertTape(data.map((d) => Object.assign(new TapeDataBlock(), { data: d })));
    s.runFlow(s.machine.getTapeLoadFlow!());
    s.runFrames(2000);

    const resident = s.bank(2);
    expect(resident[TOTAL - ORG] | (resident[TOTAL - ORG + 1] << 8)).toBe(311);
    expect(s.screenText()).toContain("311");
    expect(s.cpu().sp).toBeLessThan(0xc000);
  });
});
