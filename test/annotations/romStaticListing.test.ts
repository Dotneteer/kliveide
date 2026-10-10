import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createAnnotatedDisassemblyItems } from "@renderer/appIde/annotations/annotatedDisassembly";
import { parseAnnotations } from "@renderer/appIde/annotations/programAnnotations";
import { prepareRomDisassembler, romDecoderFor } from "@renderer/appIde/annotations/romDecoder";

/*
 * A ROM page document lists through the ROM's own decoding (`.plans/ROM_ANNOTATION_EDITING_PLAN.md`
 * W-0): the byte after `RST $08` is a report code, not an instruction. `StaticMemoryDump` passes
 * `prepareRomDisassembler` to the annotated listing for `disassemblyFlavor: "rom"`.
 */

const ROMS = join(__dirname, "../../src/public/roms");
const SP48 = new Uint8Array(readFileSync(join(ROMS, "sp48.rom")));
const annotations = parseAnnotations(readFileSync(join(ROMS, "sp48.rom.dis"), "utf8")).annotations!;

async function rowsAfterRst8(prepare?: Parameters<typeof prepareRomDisassembler>[1]) {
  // --- An `RST $08` the ROM's own decoder finds in code, so the test does not hunt for one by hand
  const decoded = await romDecoderFor("sp48-basic")(SP48, 0x0100, 0x3cff);
  const rst = decoded.find((instr) => SP48[instr.offset] === 0xcf)!;
  const items = await createAnnotatedDisassemblyItems({
    annotations,
    bank: 0,
    contents: SP48,
    disassOffset: 0,
    allowExtendedSet: false,
    range: { start: rst.offset, end: rst.offset + 8 },
    ...(prepare ? { prepareDisassembler: (d) => prepareRomDisassembler(d, prepare) } : {})
  });
  const rows = (items ?? []).filter((item) => !item.isPrefixItem);
  return { rst: rst.offset, after: rows.find((item) => item.address === rst.offset + 1)?.instruction };
}

describe("the ROM page listing", () => {
  it("does not decode the report code after RST $08 as an instruction", async () => {
    const { after } = await rowsAfterRst8("sp48-basic");
    expect(after).toMatch(/^\.defb /);
  });

  it("would without it — which is why a ROM document needs the flavour", async () => {
    const { after } = await rowsAfterRst8();
    expect(after).toBeDefined();
    expect(after).not.toMatch(/^\.defb /);
  });
});
