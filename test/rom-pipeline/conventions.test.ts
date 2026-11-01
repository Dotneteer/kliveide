import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { enterpriseConvention } from "@common/reverse/pipeline/conventions/enterprise";
import { conventionsFor } from "@common/reverse/pipeline/conventions/registry";
import { imageFromRomPage, romPageBytes } from "@common/reverse/pipeline/image/romImage";
import { analyseRomPage } from "@common/reverse/pipeline/preprocess/analyse";
import { renderTexts } from "@common/reverse/pipeline/preprocess/cards";

/*
 * Convention plug-ins (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §4.5, P5): the Enterprise's EXOS call
 * contract in the register facts, IS-BASIC's restarts explained, and the packed texts decoded to what
 * Klive's own sidecars say they hold.
 */

const ROMS = join(__dirname, "../../src/public/roms");

function exosPage(rom: string, page: number) {
  const sidecar = JSON.parse(readFileSync(join(ROMS, `${rom}.dis`), "utf8"));
  const bytes = romPageBytes(new Uint8Array(readFileSync(join(ROMS, rom))), page);
  const bank = sidecar.banks[String(page)];
  return {
    sidecar,
    bytes,
    context: { bytes, labels: new Map<string, number>(bank.localLabels.map((l: any) => [l.name, l.value])), regions: bank.regions }
  };
}

describe("the Enterprise convention", () => {
  it("applies to the Enterprise's ROM kinds only", () => {
    expect(conventionsFor("ep-ext").map((c) => c.id)).toEqual(["enterprise"]);
    expect(conventionsFor("ep-basic").map((c) => c.id)).toEqual(["enterprise"]);
    expect(conventionsFor("sp48-basic")).toEqual([]);
  });

  it("decodes EXOS 2.1's packed texts as its sidecar describes them", () => {
    const tables = new Map(enterpriseConvention.texts!(exosPage("ep-exos21.rom", 1).context).map((t) => [t.name, t]));
    const messages = tables.get("ERR_MESSAGES")!.texts;
    expect(messages).toHaveLength(60);
    expect(messages[0]).toBe("unexpected value given");
    expect(messages[59]).toBe("BASIC data has been corrupted");
    expect(tables.get("TEXT_WORDS")!.texts).toHaveLength(31);
    expect(tables.get("TEXT_WORDS")!.texts).toContain("EXOS ");
    const exos = tables.get("ERR_TEXT_PACKED")!.texts;
    expect(exos).toHaveLength(48);
    expect(exos[0]).toBe("invalid EXOS function code");
    expect(exos[47]).toMatch(/^cassette CRC error/);
    // --- The codes the spec gives no text have an empty one ($F8 is the eighth)
    expect(exos[7]).toBe("");
    // --- What each text answers: ERR_NUMBERS for IS-BASIC's, the status codes from $FF for EXOS's
    expect(tables.get("ERR_MESSAGES")!.keys?.[0]).toBe("1000");
    expect(tables.get("ERR_MESSAGES")!.keys?.[59]).toBe("30000");
    expect(tables.get("ERR_TEXT_PACKED")!.keys?.[47]).toBe("$D0");
    expect(tables.get("WP_PHRASES")!.texts).toHaveLength(28);
    expect(tables.get("WP_PHRASES")!.packing).toMatch(/bit stream/);
  });

  it("decodes EXOS 2.0's, whose WP phrases use the byte-and-phrase packing", () => {
    const tables = new Map(enterpriseConvention.texts!(exosPage("ep-exos20.rom", 1).context).map((t) => [t.name, t]));
    expect(tables.get("ERR_MESSAGES")!.texts).toHaveLength(60);
    expect(tables.get("TEXT_WORDS")!.texts).toHaveLength(28);
    expect(tables.get("ERR_TEXT_PACKED")!.texts.at(-1)).toBe("cassette CRC error");
    expect(tables.get("WP_PHRASES")!.texts).toHaveLength(35);
    expect(tables.get("WP_PHRASES")!.packing).toMatch(/EXOS 2\.0/);
  });

  it("gives an EXOS call its manual contract in the register facts", async () => {
    // --- PUSH HL; RST 30h with EXOS 16; POP HL; RET, on an extension ROM page at $C000
    const bytes = new Uint8Array(0x4000).fill(0xc9);
    bytes.set([0xe5, 0xf7, 0x10, 0xe1, 0xc9], 0x100);
    const sidecar = {
      banks: {
        "0": {
          regions: [{ start: 0, end: 0x3fff, type: "disassemble" }],
          localLabels: [{ name: "READ_VAR", value: 0x100 }],
          lineAnnotations: {}
        }
      }
    };
    const analysis = await analyseRomPage({ image: imageFromRomPage(bytes, { name: "t.rom", kind: "ep-ext" }), bankId: "0", sidecar });
    const facts = analysis.registers.get(0x100)!;
    expect(facts.unknowns).toEqual([]);
    expect(facts.assumed).toMatchObject([{ offset: 0x101, name: "EXOS call", source: expect.stringMatching(/manual/) }]);
    expect(facts.changes.filter((r) => !r.endsWith("'"))).toEqual(["A", "F", "B", "C", "D", "E"]);
    expect(facts.keeps).toEqual(expect.arrayContaining(["H", "L", "IXH", "IYL", "A'"]));
    expect(analysis.notes.get(0x101)).toMatch(/^EXOS call: A, BC, DE in; A = status/);
  });

  it("explains IS-BASIC's restarts on the pages that hold IS-BASIC", async () => {
    const bytes = new Uint8Array(0x4000).fill(0xc9);
    bytes.set([0xdf], 0x200); // RST 18h
    const analysis = await analyseRomPage({ image: imageFromRomPage(bytes, { name: "b.rom", kind: "ep-basic" }), bankId: "0" });
    expect(analysis.notes.get(0x200)).toBe("IS-BASIC: raises error 9000 + A when NZ");
    const plain = await analyseRomPage({ image: imageFromRomPage(bytes, { name: "x.rom", kind: "ep-ext" }), bankId: "0" });
    expect(plain.notes.has(0x200)).toBe(false);
  });

  it("lists the hidden entries and writes texts.md", async () => {
    const { sidecar, bytes } = exosPage("ep-exos21.rom", 1);
    const analysis = await analyseRomPage({ image: imageFromRomPage(bytes, { name: "ep-exos21.rom", page: 1 }), bankId: "1", sidecar });
    expect(renderTexts(analysis)).toMatch(/## ERR_MESSAGES \(\$2038\): 60 text\(s\)/);
    const page0 = exosPage("ep-exos21.rom", 0);
    const first = await analyseRomPage({ image: imageFromRomPage(page0.bytes, { name: "ep-exos21.rom" }), bankId: "0", sidecar: page0.sidecar });
    expect(first.hiddenEntries).toContainEqual({ offset: 0x0bea, from: [0x0b82], first: "ld a,$FB" });
  });
});
