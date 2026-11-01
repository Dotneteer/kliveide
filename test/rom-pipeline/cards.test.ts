import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { imageFromRomPage, romPageBytes } from "@common/reverse/pipeline/image/romImage";
import { analyseRomPage } from "@common/reverse/pipeline/preprocess/analyse";
import { factsJson, renderCardFiles, renderOverview, renderQuestions } from "@common/reverse/pipeline/preprocess/cards";

/*
 * The routine cards (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §4.3, P2) on a finished Enterprise page:
 * callers, register facts, hidden entries, the sidecar's own text, and ranges in bottom-up order.
 */

const ROMS = join(__dirname, "../../src/public/roms");

async function exos21() {
  const sidecar = JSON.parse(readFileSync(join(ROMS, "ep-exos21.rom.dis"), "utf8"));
  const bytes = romPageBytes(new Uint8Array(readFileSync(join(ROMS, "ep-exos21.rom"))), 0);
  return analyseRomPage({ image: imageFromRomPage(bytes, { name: "ep-exos21.rom" }), bankId: "0", sidecar });
}

describe("routine cards", () => {
  it("render the facts of a routine, its listing and what is still needed", async () => {
    const analysis = await exos21();
    const text = renderCardFiles(analysis).map((f) => f.text).join("\n");
    const card = text.slice(text.indexOf("== $0B49 EXOS_CHANNEL"), text.indexOf("\n\n", text.indexOf("== $0B49")));
    expect(card).toMatch(/^== \$0B49 EXOS_CHANNEL \(run \$CB49\)  jump-target/);
    expect(card).toMatch(/in from: {2}jump \$0588/);
    expect(card).toMatch(/exits: {4}\$0BFC ret/);
    expect(card).toMatch(/0B49 @CB49 D9 {11}exx {2};; Keep the alternate registers/);
    expect(card).toMatch(/needed: /);
    // --- A hidden entry's own decode is on the card of the routine that owns its bytes
    expect(text).toMatch(/hidden entry \$0BEA \(from \$0B82\)[^\n]*\n {5}0BEA 3E FB {8}ld a,\$FB/);
  });

  it("order a range bottom-up: a callee's card comes before its caller's", async () => {
    const analysis = await exos21();
    const position = new Map<number, number>();
    analysis.ranges.flat().forEach((start, i) => position.set(start, i));
    let checked = 0;
    for (const r of analysis.routines) {
      for (const call of r.routine.calls) {
        const [caller, callee] = [position.get(r.routine.start), call.target !== undefined ? position.get(call.target) : undefined];
        if (caller === undefined || callee === undefined || call.target === r.routine.start) continue;
        checked++;
        // --- Recursion aside, a callee is placed first
        if (callee > caller) expect(analysis.routines.find((x) => x.routine.start === call.target)!.routine.calls.length).toBeGreaterThan(0);
      }
    }
    expect(checked).toBeGreaterThan(50);
  });

  it("write the overview, the questions and serialisable facts", async () => {
    const analysis = await exos21();
    expect(renderOverview(analysis)).toMatch(/^# ep-exos21\.rom page 0\n\nCPU z80; ROM kind ep-exos; decoded at \$C000/);
    expect(renderQuestions(analysis)).toMatch(/\$0BEA \(named by \$0B82\) lies inside an instruction/);
    const facts = JSON.parse(JSON.stringify(factsJson(analysis)));
    expect(facts.routines.length).toBe(analysis.routines.length);
    expect(facts.cpu).toBe("z80");
  });
});
