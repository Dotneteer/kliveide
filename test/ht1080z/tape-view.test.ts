import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buildHt1080zCmd } from "@common/ht1080z/cmdFile";
import { ht1080zCharsFor } from "@common/machines/char-codes";
import { Z80Assembler } from "@main/z80-compiler/z80-assembler";
import { basToBasicTape, cmdToSystemTape } from "@emu/machines/ht1080z/Ht1080zTapeFile";
import {
  analyzeHt1080zFile,
  fitsSixteenK,
  HT1080Z_CELL_ONE,
  HT1080Z_CELL_ZERO,
  HT1080Z_SYNC_GAP,
  HT1080Z_TAPE_CLOCK
} from "@renderer/appIde/DocumentPanels/Ht1080zTape/ht1080zTapeView";
import { ht1080zPartAnatomy } from "@renderer/appIde/DocumentPanels/Ht1080zTape/ht1080zTapeFields";

/*
 * The HT-1080Z tape viewer's model (`.plans/HT1080Z_TAPE_VIEWERS_PLAN.md` D4) on real files: the demo
 * program the Series II saved, the `default` template assembled into a `.cmd`, and the tapes Klive
 * makes of them.
 */
const REPO = join(__dirname, "../..");
const DEMO = new Uint8Array(readFileSync(join(REPO, "scripts/doc-shots/recipes/ht1080z-demo.bas")));
const S2 = ht1080zCharsFor("s2");

async function templateCmd(): Promise<{ cmd: Uint8Array; code: number[] }> {
  const source = readFileSync(join(REPO, "src/public/project-templates/ht1080z/default/code/code.kz80.asm"), "utf8");
  const out = await new Z80Assembler().compile(source);
  const code = out.segments[0].emittedCode;
  return { cmd: buildHt1080zCmd([{ startAddress: 0x7000, emittedCode: code }], 0x7000, "HELLO"), code };
}

/** How long a tape image plays, bit by bit, as the core's player plays it */
function tapeMs(tape: Uint8Array, syncByteIndex: number): number {
  let tacts = 0;
  for (let i = 0; i < tape.length; i++) {
    for (let bit = 7; bit >= 0; bit--) tacts += (tape[i] >> bit) & 1 ? HT1080Z_CELL_ONE : HT1080Z_CELL_ZERO;
    if (i === syncByteIndex) tacts += HT1080Z_SYNC_GAP;
  }
  return (tacts * 1000) / HT1080Z_TAPE_CLOCK;
}

describe("HT-1080Z tape viewer model", () => {
  it("takes a tokenised .bas apart into its lines", () => {
    const { analysis } = analyzeHt1080zFile(DEMO, "demo.bas");
    expect(analysis).toMatchObject({ kind: "bas", size: 155, hasProblems: false });
    expect(analysis!.lines!.map((l) => l.lineNo)).toEqual([10, 20, 30, 40, 50, 60]);
    expect(analysis!.parts.map((p) => p.role)).toEqual([...new Array(6).fill("basLine"), "programEnd"]);
    const line40 = analysis!.parts[3];
    expect(line40).toMatchObject({ offset: 1 + 0x5c, loadFrom: 0x4345, loadTo: 0x4345 + 24 });
    expect(line40.line!.link).toBe(0x435d);
    expect(analysis!.loadTop).toBe(0x42e9 + 154);
    // --- As the CLOAD tape Klive makes of it
    expect(analysis!.playMs).toBeCloseTo(tapeMs(basToBasicTape(DEMO, "A"), 255), 3);
  });

  it("reads a BASIC tape: leader, sync, header, the program and its end, with real play times", () => {
    const tape = basToBasicTape(DEMO, "D");
    const { analysis } = analyzeHt1080zFile(tape, "demo.cas");
    expect(analysis).toMatchObject({ kind: "basicTape", name: "D", size: 414, hasProblems: false });
    expect(analysis!.parts.map((p) => [p.role, p.bytes.length])).toEqual([
      ["leader", 255], ["sync", 1], ["basicHeader", 4], ["basicProgram", 152], ["programEnd", 2]
    ]);
    expect(analysis!.parts[3]).toMatchObject({ loadFrom: 0x42e9, loadTo: 0x42e9 + 152 });
    expect(analysis!.lines).toHaveLength(6);
    expect(analysis!.playMs).toBeCloseTo(tapeMs(tape, 255), 3);
    // --- 255 zero bytes of leader: 8 cells of 3,570 T each
    expect(analysis!.parts[0].endMs).toBeCloseTo((255 * 8 * HT1080Z_CELL_ZERO * 1000) / HT1080Z_TAPE_CLOCK, 3);
    expect(analysis!.parts[4].endMs).toBeCloseTo(analysis!.playMs, 6);
  });

  it("reads a SYSTEM tape: the block's address, length and checksum, and the entry", async () => {
    const { cmd, code } = await templateCmd();
    const tape = cmdToSystemTape(cmd, "HELLO");
    const { analysis } = analyzeHt1080zFile(tape, "hello.cas");
    expect(analysis).toMatchObject({ kind: "systemTape", name: "HELLO", codeBytes: code.length, entry: 0x7000, hasProblems: false });
    expect(analysis!.parts.map((p) => p.role)).toEqual(["leader", "sync", "systemHeader", "systemBlock", "systemEntry"]);
    const block = analysis!.parts[3];
    expect(block).toMatchObject({ loadFrom: 0x7000, loadTo: 0x7000 + code.length });
    expect(block.checksum!.stored).toBe(block.checksum!.computed);
    expect(fitsSixteenK(analysis!)).toBe(true);
    // --- One damaged byte: the block says so, and the rest still reads
    const damaged = new Uint8Array(tape);
    damaged[255 + 1 + 7 + 4 + 10] ^= 0x01;
    const broken = analyzeHt1080zFile(damaged, "hello.cas").analysis!;
    expect(broken.parts[3].problem).toBe("checksum");
    expect(broken.hasProblems).toBe(true);
    expect(broken.parts[4].role).toBe("systemEntry");
  });

  it("finds the header at any bit offset, as the ROM does", () => {
    const tape = basToBasicTape(DEMO, "D");
    // --- The whole image shifted 3 bits later
    const shifted = new Uint8Array(tape.length + 1);
    for (let i = 0; i < tape.length; i++) {
      shifted[i] |= tape[i] >> 3;
      shifted[i + 1] |= (tape[i] << 5) & 0xff;
    }
    const { analysis } = analyzeHt1080zFile(shifted, "shifted.cas");
    expect(analysis!.lines!.map((l) => l.lineNo)).toEqual([10, 20, 30, 40, 50, 60]);
  });

  it("reads a .cmd's records, and how long its tape plays", async () => {
    const { cmd, code } = await templateCmd();
    const { analysis } = analyzeHt1080zFile(cmd, "hello.cmd");
    expect(analysis).toMatchObject({ kind: "cmd", name: "HELLO", codeBytes: code.length, entry: 0x7000, hasProblems: false });
    expect(analysis!.parts.map((p) => [p.role, p.offset, p.bytes.length])).toEqual([
      ["cmdHeader", 0, 7], ["cmdLoad", 7, code.length + 4], ["cmdTransfer", 7 + code.length + 4, 4]
    ]);
    expect(analysis!.playMs).toBeCloseTo(tapeMs(cmdToSystemTape(cmd, "HELLO"), 255), 3);
  });

  it("marks what is cut short, and refuses what is no tape", async () => {
    const { cmd } = await templateCmd();
    const short = analyzeHt1080zFile(cmd.subarray(0, 40), "x.cmd").analysis!;
    expect(short.parts[1]).toMatchObject({ role: "cmdLoad", problem: "truncated" });
    const shortTape = analyzeHt1080zFile(basToBasicTape(DEMO, "D").subarray(0, 300), "x.cas").analysis!;
    expect(shortTape.parts[shortTape.parts.length - 1]).toMatchObject({ role: "programEnd", problem: "truncated" });
    const shortBas = analyzeHt1080zFile(DEMO.subarray(0, 50), "x.bas").analysis!;
    expect(shortBas.parts[shortBas.parts.length - 1]).toMatchObject({ role: "trailing", problem: "truncated" });
    expect(analyzeHt1080zFile(new Uint8Array(400), "silence.cas").error).toBe("noHeader");
    expect(analyzeHt1080zFile(new TextEncoder().encode("10 PRINT"), "x.bas").error).toBe("notTokenised");
    expect(analyzeHt1080zFile(DEMO, "x.txt").error).toBe("unknownFile");
  });

  it("explains a part's bytes, field by field", async () => {
    const { cmd } = await templateCmd();
    const { analysis } = analyzeHt1080zFile(cmdToSystemTape(cmd, "HELLO"), "hello.cas");
    const block = ht1080zPartAnatomy(analysis!.parts[3], S2)!;
    expect(block.groups.map((g) => [g.first, g.last])).toEqual([[0, 0], [1, 1], [2, 3], [4, 99], [100, 100]]);
    expect(block.fields.map((f) => f.name)).toEqual(["Marker", "Length", "Address", "Data", "Checksum"]);
    expect(block.fields[4].value).toMatch(/· OK$/);
    // --- A line: link, number, then text runs and tokens, the 00h; Series II shows 40h as É
    const bas = analyzeHt1080zFile(DEMO, "demo.bas").analysis!;
    const line40 = ht1080zPartAnatomy(bas.parts[3], S2)!;
    expect(line40.fields.map((f) => [f.name, f.value])).toEqual([
      ["Link", "$435D · the next line, where it sat when saved"],
      ["Line", "40"],
      ["Token", "B2h · PRINT"],
      ["Text", ' É 348,"HT-1080Z";'],
      ["End", "00 · the end of the line"]
    ]);
    expect(ht1080zPartAnatomy(bas.parts[3], ht1080zCharsFor("s1"))!.fields[3].value).toBe(' @ 348,"HT-1080Z";');
    expect(ht1080zPartAnatomy(analysis!.parts[0], S2)).toBeUndefined();
  });
});

describe("HT-1080Z tape viewer listing", () => {
  it("cuts a line into keyword, string and text runs as LIST prints it", async () => {
    const { ht1080zLineRuns, ht1080zLineText } = await import("@renderer/appIde/DocumentPanels/Ht1080zTape/ht1080zLineText");
    // --- PRINT "A@B":ELSE REM'X: 0xB2 is PRINT, 3A 95 is :ELSE, 3A 93 FB is :REM' (an apostrophe)
    const text = new Uint8Array([0xb2, 0x20, 0x22, 0x41, 0x40, 0x42, 0x22, 0x3a, 0x95, 0x3a, 0x93, 0xfb, 0x58]);
    expect(ht1080zLineRuns(text, S2)).toEqual([
      { kind: "keyword", text: "PRINT" },
      { kind: "text", text: " " },
      { kind: "string", text: '"AÉB"' },
      { kind: "keyword", text: "ELSE'" },
      { kind: "text", text: "X" }
    ]);
    expect(ht1080zLineText(text, ht1080zCharsFor("s1"))).toBe('PRINT "A@B"ELSE\'X');
  });

  it("relinks a program at 42E9h, wherever it was saved from", async () => {
    const { relinkedProgram } = await import("@renderer/appIde/DocumentPanels/Ht1080zTape/ht1080zLineText");
    const { analysis } = analyzeHt1080zFile(DEMO, "demo.bas");
    const lines = analysis!.lines!.map((l) => ({ ...l, link: l.link + 0x1000 }));
    const program = relinkedProgram(lines);
    expect(program.length).toBe(DEMO.length - 1);
    expect(Array.from(program)).toEqual(Array.from(DEMO.subarray(1)));
  });
});
