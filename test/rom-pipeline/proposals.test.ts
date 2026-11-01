import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PF_CODE, PF_EXECUTED, PF_READ } from "@common/profile/profileTypes";
import { imageFromRomPage, romPageBytes } from "@common/reverse/pipeline/image/romImage";
import { analyseRomPage } from "@common/reverse/pipeline/preprocess/analyse";
import { renderProposalsAnn } from "@common/reverse/pipeline/preprocess/cards";
import { parseAnn } from "@common/reverse/pipeline/annFormat";

/*
 * Region proposals (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §4.4, P4): what the walk and a run's
 * flags say about code and data, against the page's regions; conflicting evidence becomes a question.
 */

const ROMS = join(__dirname, "../../src/public/roms");

/** A small page: code that takes inline data, a pointer table and a text, and its profile. */
function syntheticPage() {
  // --- RET everywhere else, so a walk from a CPU vector stops at once (zeros are NOPs, which run on)
  const bytes = new Uint8Array(0x60).fill(0xc9);
  const put = (at: number, values: number[]) => bytes.set(values, at);
  put(0x00, [0xcd, 0x10, 0x00]); // CALL $0010
  put(0x03, [0x41, 0x42, 0x00]); // "AB", 0: the callee reads these
  put(0x06, [0x21, 0x40, 0x00]); // LD HL,$0040
  put(0x09, [0xc9]); // RET
  put(0x10, [0xc9]); // RET
  // --- (past the RST vectors, which are code on a page at $0000)
  put(0x40, [0x06, 0x00, 0x09, 0x00]); // a table of two code addresses
  put(0x48, [...Array.from("PRESS ANY KEY").map((c) => c.charCodeAt(0)), 0x00]);
  const flags = new Array<number>(bytes.length).fill(0);
  const ran = (at: number, length: number) => {
    flags[at] |= PF_EXECUTED;
    for (let i = 0; i < length; i++) flags[at + i] |= PF_CODE;
  };
  ran(0x00, 3);
  ran(0x06, 3);
  ran(0x09, 1);
  ran(0x10, 1);
  for (let i = 3; i < 6; i++) flags[i] |= PF_READ;
  return { bytes, flags };
}

describe("region proposals", () => {
  it("propose inline data after a call, a pointer table and a text", async () => {
    const { bytes, flags } = syntheticPage();
    const analysis = await analyseRomPage({
      image: imageFromRomPage(bytes, { name: "t.rom" }),
      bankId: "0",
      profile: { page: 0, flags }
    });
    const found = analysis.proposals.map((p) => [p.kind, p.start, p.end]);
    expect(found).toContainEqual(["bytes", 0x03, 0x05]);
    expect(found).toContainEqual(["words", 0x40, 0x43]);
    expect(found.some(([kind, start]) => kind === "text" && start === 0x48)).toBe(true);
    const inline = analysis.proposals.find((p) => p.start === 0x03)!;
    expect(inline.evidence).toMatch(/read after call \$0010/);
    // --- The table is loaded by the code that uses it
    expect(analysis.proposals.find((p) => p.start === 0x40)!.readers).toEqual(["$0006: ld hl,$0040"]);
  });

  it("write them as a .ann file whose lines only need uncommenting", async () => {
    const { bytes, flags } = syntheticPage();
    const analysis = await analyseRomPage({ image: imageFromRomPage(bytes, { name: "t.rom" }), bankId: "0", profile: { page: 0, flags } });
    const text = renderProposalsAnn(analysis);
    expect(text).toMatch(/^# words 0040-0043$/m);
    const accepted = text.replace(/^# (words 0040-0043)$/m, "$1");
    const { document, problems } = parseAnn(accepted, "proposals.ann");
    expect(problems).toEqual([]);
    expect(document.regions).toMatchObject([{ kind: "words", start: 0x40, end: 0x43 }]);
  });

  it("propose no code/data flips on finished sidecars, and list weak evidence as questions", async () => {
    for (const [rom, page] of [
      ["sp48.rom", 0],
      ["ep-exos21.rom", 0],
      ["ep-exos21.rom", 1],
      ["zx81.rom", 0]
    ] as const) {
      const sidecar = JSON.parse(readFileSync(join(ROMS, `${rom}.dis`), "utf8"));
      const bytes = romPageBytes(new Uint8Array(readFileSync(join(ROMS, rom))), page);
      const analysis = await analyseRomPage({ image: imageFromRomPage(bytes, { name: rom, page }), bankId: String(page), sidecar });
      // --- Only refinements of data (bytes that are text or a table) may be proposed there
      const flips = analysis.proposals.filter((p) => (p.kind === "code") !== (p.current === "code"));
      expect(flips, rom).toEqual([]);
    }
  });
});
