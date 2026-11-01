import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { imageFromRomPage, romPageBytes } from "@common/reverse/pipeline/image/romImage";
import { analyseRomPage } from "@common/reverse/pipeline/preprocess/analyse";
import { regList } from "@common/reverse/pipeline/preprocess/cards";
import { decodeBank } from "@common/reverse/pipeline/preprocess/decode";
import { analyseRegisters, type RegisterFacts } from "@common/reverse/pipeline/preprocess/registers";

/*
 * The register facts (`.plans/ROM_ANNOTATION_PIPELINE_PLAN.md` §4.1 stage 8, D10): hand-made routines
 * with a known answer, and agreement with the `Changes:` lines a finished sidecar's authors wrote.
 */

const ROMS = join(__dirname, "../../src/public/roms");

async function facts(code: number[], options: { entries?: number[]; cuts?: number[]; cpu?: "z80" | "z80n" } = {}): Promise<RegisterFacts> {
  const image = imageFromRomPage(new Uint8Array([...code, 0, 0, 0]), { name: "t", cpu: options.cpu ?? "z80n" });
  const decoded = await decodeBank(image, "0", { regions: [{ start: 0, end: code.length - 1, type: "disassemble" }], cuts: options.cuts });
  return analyseRegisters(decoded, options.entries ?? [0]).get(0)!;
}

const main = (regs: readonly string[]) => regs.filter((r) => !r.endsWith("'"));

describe("analyseRegisters", () => {
  it("sees a pushed and popped pair kept", async () => {
    const f = await facts([0xc5, 0x06, 0x05, 0xc1, 0xc9]); // PUSH BC; LD B,5; POP BC; RET
    expect(f.changes).toEqual([]);
    expect(f.inputs).toEqual([]);
  });

  it("follows EX DE,HL as moved values, and EXX into the alternate set", async () => {
    const ex = await facts([0xeb, 0xc9]);
    expect(ex.moved).toEqual([
      { reg: "D", from: "H" },
      { reg: "E", from: "L" },
      { reg: "H", from: "D" },
      { reg: "L", from: "E" }
    ]);
    const exx = await facts([0xd9, 0x06, 0x00, 0xd9, 0xc9]); // EXX; LD B,0; EXX; RET
    expect(exx.changes).toEqual(["B'"]);
  });

  it("applies a callee's summary at a call", async () => {
    // --- CALL 4; RET; 4: LD A,1; RET
    const f = await facts([0xcd, 0x04, 0x00, 0xc9, 0x3e, 0x01, 0xc9], { entries: [0, 4], cuts: [4] });
    expect(f.changes).toEqual(["A"]);
  });

  it("finds inputs: registers read while they still hold their entry value", async () => {
    expect((await facts([0x7e, 0xc9])).inputs).toEqual(["H", "L"]); // LD A,(HL)
    expect((await facts([0xed, 0x92, 0x07, 0xed, 0x30, 0xc9])).inputs).toEqual(["A", "D", "E"]); // NEXTREG 7,A; MUL D,E
  });

  it("records the flags each exit leaves", async () => {
    // --- AND A; RET C; SCF; RET
    const f = await facts([0xa7, 0xd8, 0x37, 0xc9]);
    expect(f.exits).toEqual([
      { offset: 1, kind: "ret-cc", condition: "c", known: { carry: 1 } },
      { offset: 3, kind: "ret", known: { carry: 1 } }
    ]);
    expect(f.changes).toEqual(["F"]);
    expect(main(f.keeps)).toContain("A");
  });

  it("does not count a RET as a return once the routine has taken the caller's stack", async () => {
    const f = await facts([0xe1, 0xc9]); // POP HL; RET
    expect(f.returns).toBe(false);
    expect(f.unknowns[0].reason).toMatch(/return address/);
    const jp = await facts([0xe1, 0xe9]); // POP HL; JP (HL)
    expect(jp.exits).toMatchObject([{ kind: "indirect" }]);
    const computed = await facts([0xe5, 0xc9]); // PUSH HL; RET
    expect(computed.returns).toBe(false);
    expect(computed.unknowns[0].reason).toMatch(/computed jump/);
  });

  it("follows a jump into the middle of an instruction (a hidden entry)", async () => {
    // --- 0: JR 3, into 2: LD DE,$C93E, where the bytes from 3 read LD A,$C9; both meet at 5: RET
    const image = imageFromRomPage(new Uint8Array([0x18, 0x01, 0x11, 0x3e, 0xc9, 0xc9]), { name: "t", cpu: "z80" });
    const decoded = await decodeBank(image, "0", { regions: [{ start: 0, end: 5, type: "disassemble" }] });
    expect(decoded.hidden.get(3)?.text).toBe("ld a,$C9");
    const f = analyseRegisters(decoded, [0]).get(0)!;
    expect(f.unknowns).toEqual([]);
    expect(f.changes).toEqual(["A"]);
  });
});

describe("register facts on a finished sidecar", () => {
  it("agree with most of sp48's Changes: lines (by register pair)", async () => {
    const sidecar = JSON.parse(readFileSync(join(ROMS, "sp48.rom.dis"), "utf8"));
    const bytes = romPageBytes(new Uint8Array(readFileSync(join(ROMS, "sp48.rom"))), 0);
    const analysis = await analyseRomPage({ image: imageFromRomPage(bytes, { name: "sp48.rom" }), bankId: "0", sidecar });
    const pair: Record<string, string> = { A: "AF", F: "AF", B: "BC", C: "BC", D: "DE", E: "DE", H: "HL", L: "HL" };
    let compared = 0;
    let agree = 0;
    for (const r of analysis.routines) {
      const line = /^Changes: ([^;\n]*)/m.exec(r.synopsis ?? "");
      if (!line || !r.registers?.returns || r.registers.unknowns.length) continue;
      const written = new Set(line[1].replace(/\.$/, "").split(/,\s*/).map((x) => pair[x.trim().toUpperCase()] ?? x.trim().toUpperCase()));
      const computed = new Set(regList(main(r.registers.changes) as any).split(", ").filter(Boolean).map((x) => pair[x] ?? x));
      compared++;
      if (written.size === computed.size && [...written].every((x) => computed.has(x))) agree++;
    }
    // --- 39 of 42 when this was written; the rest are the pass's conservative "may change" (a value
    // --- restored by arithmetic, as SBC HL,DE; ADD HL,DE does, reads as changed)
    expect(compared).toBeGreaterThan(35);
    expect(agree / compared).toBeGreaterThan(0.85);
  });
});
