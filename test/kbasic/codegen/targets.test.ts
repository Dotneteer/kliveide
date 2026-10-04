import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { SP128_MAIN_WAITING_LOOP } from "@emu/machines/ZxSpectrumBase";

import { p3ModelRomSet } from "@emu/machines/zxSpectrumP3e/p3RomSets";

import { Sp48TestSession } from "../../harness/sp48";
import { createSp128Session } from "../../harness/sp128";
import { createTestSp128WasmMachine } from "../../wasm/zxSpectrum/wasm-test-helpers";
import { compileBasic } from "./run-kit";

/**
 * The 128K target on a real 128K (both ROMs), booted to its menu: ROM 0 (the 128 editor) is paged
 * in, as a program that pages memory might leave it. The runtime must page the 48K BASIC ROM in for
 * the calculator and put ROM 0 back afterwards. The test gives the program what it has when BASIC
 * runs it and the menu does not: a stack high in RAM (the menu's sits below the calculator's
 * workspace) and the calculator's memory pointer MEM at MEMBOT.
 */
const rom = (name: string) => new Uint8Array(readFileSync(join(__dirname, "../../../src/public/roms", name)));

/**
 * One screen row as text, recognised against the 48K BASIC ROM's own font (from the file, not from
 * memory): with another ROM paged in, `$3D00` holds something else, and a program that drew its
 * characters from there must not pass by matching the same wrong bytes.
 */
const FONT = rom("sp48.rom").subarray(0x3d00);
function fontScreenLine(peek: (address: number) => number, row: number): string {
  let text = "";
  for (let col = 0; col < 32; col++) {
    const cell = Array.from({ length: 8 }, (_, line) =>
      peek(0x4000 | ((row & 0x18) << 8) | (line << 8) | ((row & 0x07) << 5) | col)
    );
    let ch = "?";
    for (let code = 32; code < 128; code++) {
      const glyph = FONT.subarray((code - 32) * 8, (code - 31) * 8);
      if (cell.every((b, i) => b === glyph[i])) {
        ch = String.fromCharCode(code);
        break;
      }
    }
    text += ch;
  }
  return text.replace(/\s+$/, "");
}

describe("the 128K target", () => {
  it("pages the 48K BASIC ROM in for Float and back out afterwards", async () => {
    const machine = await createTestSp128WasmMachine(rom("sp128-0.rom"), rom("sp128-1.rom"));
    machine.hardReset();
    const session = new Sp48TestSession(machine as never);
    session.runTo(SP128_MAIN_WAITING_LOOP, { maxFrames: 600 });
    const bankm = session.peek(0x5b5c);
    expect(bankm & 0x10, "ROM 0 is paged at the menu").toBe(0);

    const { generated } = await compileBasic("DIM f AS Float = 2\nPRINT AT 0, 0; SQR(f) * 1000; \" \"; STR$(PI)\n", { target: "zx128k" });
    expect(generated.emitted.text).toContain(".model Spectrum128");
    session.loadOutput(generated.output, { entry: generated.entryAddress });
    const entry = generated.entryAddress;
    const stub = 0xbf00;
    session.poke(stub, [0xcd, entry & 0xff, entry >> 8, 0x18, 0xfe]);
    machine.pc = stub;
    machine.sp = 0xbef0;
    session.pokeWord(0x5c68, 0x5c92);
    session.runTo(stub + 3, { maxFrames: 200 });

    // --- The rest of the row is the menu's own graphics
    expect(fontScreenLine((a) => session.peek(a), 0).slice(0, 19)).toBe("1414.2136 3.1415927");
    expect(session.peek(0x5b5c), "BANKM is as the program found it").toBe(bankm);
  });
  it("pages the ROM back out after VAL fails inside it", async () => {
    const machine = await createTestSp128WasmMachine(rom("sp128-0.rom"), rom("sp128-1.rom"));
    machine.hardReset();
    const session = new Sp48TestSession(machine as never);
    session.runTo(SP128_MAIN_WAITING_LOOP, { maxFrames: 600 });
    const bankm = session.peek(0x5b5c);

    // --- "1+" fails in the ROM's syntax check, "1/0" in its calculator, both with the ROM paged in
    const source = 'DIM s AS String = "1+"\nDIM f AS Float\nf = VAL(s)\nf = f + VAL("1/0")\nPRINT AT 0, 0; f; " "; PEEK 23610; " "; VAL("2*3")\n';
    const { generated } = await compileBasic(source, { target: "zx128k" });
    session.loadOutput(generated.output, { entry: generated.entryAddress });
    const entry = generated.entryAddress;
    const stub = 0xbf00;
    session.poke(stub, [0xcd, entry & 0xff, entry >> 8, 0x18, 0xfe]);
    machine.pc = stub;
    machine.sp = 0xbef0;
    session.pokeWord(0x5c68, 0x5c92);
    session.runTo(stub + 3, { maxFrames: 200 });

    expect(fontScreenLine((a) => session.peek(a), 0).slice(0, 5)).toBe("0 9 6");
    expect(session.peek(0x5b5c), "BANKM is as the program found it").toBe(bankm);
  });
});

/**
 * The 128K target on the Pentagon 128 (`.plans/PENTAGON_128_PLAN.md` Phase 5): the same ROMs, so
 * the same runtime; and a program whose result depends on the machine's timing proves the model
 * reached the core. Booted to the 128K menu (ROM 0 paged in), then called as above.
 */
async function runOn128(model: "sp128" | "pentagon", source: string) {
  const session = await createSp128Session(model);
  session.runTo(SP128_MAIN_WAITING_LOOP, { rom: 0, maxFrames: 600 });
  const bankm = session.peek(0x5b5c);
  const { generated } = await compileBasic(source, { target: "zx128k" });
  for (const s of generated.output.segments.filter((s) => s.emittedCode.length)) session.poke(s.startAddress, s.emittedCode);
  const entry = generated.entryAddress!;
  const stub = 0xbf00;
  session.poke(stub, [0xfb, 0xcd, entry & 0xff, entry >> 8, 0x18, 0xfe]); // --- EI / CALL entry / JR $
  session.machine.pc = stub;
  session.machine.sp = 0xbef0;
  session.poke(0x5c68, [0x92, 0x5c]);
  session.runTo(stub + 4, { maxFrames: 300 });
  return { line: fontScreenLine((a) => session.peek(a), 0), bankm, bankmAfter: session.peek(0x5b5c) };
}

describe("the 128K target on the Pentagon 128", () => {
  it("pages the 48K BASIC ROM in for Float and back out afterwards", async () => {
    const r = await runOn128("pentagon", FLOAT_PROGRAM_128);
    expect(r.line.slice(0, 19)).toBe("1414.2136 3.1415927");
    expect(r.bankmAfter, "BANKM is as the program found it").toBe(r.bankm);
  });

  it("counts more loops in a frame than the 128K: a longer frame and no contention", async () => {
    // --- Counts the loop passes between two FRAMES ticks; each pass reads contended memory five times
    const source = [
      "DIM f AS UByte",
      "DIM n AS UInteger",
      "DIM x AS UInteger",
      "f = PEEK 23672",
      "WHILE PEEK 23672 = f",
      "WEND",
      "f = PEEK 23672",
      "WHILE PEEK 23672 = f",
      "  n = n + 1",
      "  x = PEEK 16384 + PEEK 16385 + PEEK 16386 + PEEK 16387",
      "WEND",
      "PRINT AT 0, 0; n"
    ].join("\n") + "\n";
    const sp128 = Number((await runOn128("sp128", source)).line);
    const pentagon = Number((await runOn128("pentagon", source)).line);
    expect(sp128).toBeGreaterThan(100);
    // --- 71 680 / 70 908 T is 1.1% more on its own; without contention it is 2.8% (measured)
    expect(pentagon / sp128).toBeGreaterThan(1.02);
  });
});

const FLOAT_PROGRAM_128 = "DIM f AS Float = 2\nPRINT AT 0, 0; SQR(f) * 1000; \" \"; STR$(PI)\n";

/**
 * The +3 target on the +2A/+3's own Amstrad ROMs (`.plans/PLUS3_AMSTRAD_ROMS_PLAN.md` Phase 4), and
 * on the +3E's for comparison: booted through the IDE's `spp3e` flow into +3 BASIC, then called as
 * the 128K test above calls it. Its Float output needs the 48K BASIC ROM, which the runtime pages
 * in through BANKM ($7FFD) and BANK678 ($1FFD) and back out - so those system variables must mean
 * the same to the Amstrad ROMs as to the +3E's.
 *
 * Called with ROM 0 paged in, the runtime must page ROM 3 in for the calculator and put ROM 0 back,
 * and draw its characters from the 48K BASIC ROM's font, not from whatever ROM 0 holds at $3D00.
 * Called with ROM 3 paged in (where the +3E's editor idles), the same output must appear.
 */
const P3_TARGET_MODELS = ["plus3-fdd1", "plus3-v40-fdd1", "plus3-es-fdd1", "plus2a", "fdd1"] as const;

const FLOAT_PROGRAM = "DIM f AS Float = 2\nPRINT AT 0, 0; SQR(f) * 1000; \" \"; STR$(PI)\n";

async function startP3Program(model: (typeof P3_TARGET_MODELS)[number], rom: 0 | 3, source = FLOAT_PROGRAM) {
  const session = await createSp128Session(model);
  // --- The flow up to its Inject step: +3 BASIC's editor, reached and left to settle
  const flow = await session.machine.getCodeInjectionFlow("spp3e");
  session.runFlow([...flow.slice(0, flow.findIndex((step) => step.type === "Inject")), { type: "KeepPc" }], {
    checkRom: false
  });
  expect(session.cpu().pc).toBe(p3ModelRomSet(model).returnToEditor);
  session.runFrames(20);

  const { generated } = await compileBasic(source, { target: "zxplus3" });
  expect(generated.emitted.text).toContain(".model SpectrumP3");
  const segments = generated.output.segments.filter((s) => s.emittedCode.length);
  expect(segments.every((s) => s.bank === undefined)).toBe(true);
  for (const s of segments) {
    s.emittedCode.forEach((b, i) => session.machine.doWriteMemory(s.startAddress + i, b));
  }

  // --- Page the ROM in (BANKM bit 4 and BANK678 bit 2 select ROM 3), then CALL the program
  const entry = generated.entryAddress!;
  const bankm = rom === 3 ? 0x17 : 0x07;
  const bank678 = rom === 3 ? session.peek(0x5b67) | 0x04 : session.peek(0x5b67) & ~0x04;
  const stub = 0xbf00;
  const code = [
    0xf3, //                            DI
    0x3e, bankm, 0x32, 0x5c, 0x5b, //   LD A,bankm / LD (BANKM),A
    0x01, 0xfd, 0x7f, 0xed, 0x79, //    LD BC,$7FFD / OUT (C),A
    0x3e, bank678, 0x32, 0x67, 0x5b, // LD A,bank678 / LD (BANK678),A
    0x06, 0x1f, 0xed, 0x79, //          LD B,$1F / OUT (C),A
    0xfb, //                            EI
    0xcd, entry & 0xff, entry >> 8, //  CALL entry
    0x18, 0xfe //                       JR $
  ];
  code.forEach((b, i) => session.machine.doWriteMemory(stub + i, b));
  const back = stub + code.length - 2;
  session.machine.pc = stub;
  session.machine.sp = 0xbef0;
  session.machine.doWriteMemory(0x5c68, 0x92);
  session.machine.doWriteMemory(0x5c69, 0x5c);
  session.runTo(back - 3, { maxFrames: 5 });
  expect(session.paging().rom, `ROM ${rom} is paged in for the call`).toBe(rom);
  return { session, back, bankm, bank678 };
}

describe.each(P3_TARGET_MODELS)("the +3 target on %s", (model) => {
  it("pages ROM 3 in for the calculator and the font, and ROM 0 back afterwards", async () => {
    const { session, back, bankm, bank678 } = await startP3Program(model, 0);
    // --- The calculator's restart, reached with the 48K BASIC ROM paged in
    session.runTo(0x0028, { rom: 3, maxFrames: 100 });
    expect(session.peek(0x5b5c) & 0x10, "BANKM selects the high ROM").toBe(0x10);
    expect(session.peek(0x5b67) & 0x04, "BANK678 selects the high ROM pair").toBe(0x04);
    session.runTo(back, { maxFrames: 200 });
    expect(fontScreenLine((a) => session.peek(a), 0).slice(0, 19)).toBe("1414.2136 3.1415927");
    expect(session.peek(0x5b5c), "BANKM is as the program found it").toBe(bankm);
    expect(session.peek(0x5b67), "BANK678 is as the program found it").toBe(bank678);
    expect(session.paging().rom, "ROM 0 is back").toBe(0);
  }, 60_000);

  it("SCREEN$ and print42 read the font from the 48K BASIC ROM whichever ROM is paged in", async () => {
    // --- SCREEN$ reads back the printed "H" and prints it on row 4; print42 draws "Hi!" on row 2
    const source =
      "#include <screen.bas>\n#include <print42.bas>\n" +
      "PRINT AT 0, 0; \"H\"\nDIM c AS String = SCREEN$(0, 0)\nPRINT AT 4, 0; \"(\"; c; \")\"\nprintat42(2, 0)\nprint42(\"Hi!\")\n";
    const run = async (rom: 0 | 3) => {
      const { session, back } = await startP3Program(model, rom, source);
      session.runTo(back, { maxFrames: 200 });
      const row2 = Array.from({ length: 8 }, (_, line) =>
        Array.from({ length: 3 }, (_, col) => session.peek(0x4000 | (line << 8) | (2 << 5) | col))
      ).flat();
      return { screenLine4: fontScreenLine((a) => session.peek(a), 4), row2 };
    };
    const withRom0 = await run(0);
    const withRom3 = await run(3);
    expect(withRom0.screenLine4).toBe("(H)");
    expect(withRom0.row2.some((b) => b !== 0)).toBe(true);
    expect(withRom0).toEqual(withRom3);
  }, 60_000);

  it("prints Float results through the 48K BASIC ROM", async () => {
    const { session, back, bankm, bank678 } = await startP3Program(model, 3);
    session.runTo(back, { maxFrames: 200 });
    expect(fontScreenLine((a) => session.peek(a), 0).slice(0, 19)).toBe("1414.2136 3.1415927");
    expect(session.peek(0x5b5c)).toBe(bankm);
    expect(session.peek(0x5b67)).toBe(bank678);
    expect(session.paging().rom).toBe(3);
  }, 60_000);
});
