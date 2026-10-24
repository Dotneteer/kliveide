import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import type { CodeToInject } from "@abstractions/CodeToInject";
import { tokenizeBasicProgram } from "@common/basic/spectrumBasicTokenizer";
import { SP128_RETURN_TO_EDITOR } from "@emu/machines/ZxSpectrumBase";
import { createSp48Session } from "../../harness/sp48";
import { createSp128Session } from "../../harness/sp128";

/*
 * The Interface 1 device on the real cores with the shipped v2 ROM (`.plans/MICRODRIVE_PLAN.md`
 * Phase 1): the ROM drives the drives through the ports alone, at the tape's real speed. Phase 2's
 * harness methods (`connectInterface1`, `insertCartridge`) will replace the raw exports used here.
 */

const IF1_ROM = new Uint8Array(readFileSync(join(__dirname, "../../../src/public/roms/if1-2.rom")));
const SLOT = 543;
const SLOTS = 254;

type Exports = Record<string, (...args: number[]) => number> & { memory: WebAssembly.Memory };

/** Connects the Interface 1 with the shipped ROM and puts a blank (unformatted) cartridge in drive 1 */
function connect(x: Exports, prefix: "sp48" | "sp128"): Uint8Array {
  new Uint8Array(x.memory.buffer, x[`${prefix}If1RomPtr`](), 0x2000).set(IF1_ROM);
  x[`${prefix}If1RomUploaded`]();
  x[`${prefix}If1SetPresent`](1);
  const image = new Uint8Array(x.memory.buffer, x[`${prefix}If1DriveImagePtr`](0), SLOTS * SLOT);
  image.fill(0xff);
  x[`${prefix}If1Insert`](0, SLOTS, 0);
  return image;
}

/** A BASIC program put where LOAD would put it, as if typed */
function installProgram(s: Awaited<ReturnType<typeof createSp48Session>>, source: string): void {
  const program = tokenizeBasicProgram(source);
  const prog = s.peekWord(23635);
  for (let i = 0; i < program.length; i++) s.poke(prog + i, program[i]);
  const vars = prog + program.length;
  s.poke(vars, 0x80);
  const eLine = vars + 1;
  s.poke(eLine, 0x0d);
  s.poke(eLine + 1, 0x80);
  s.pokeWord(23627, vars);
  s.pokeWord(23641, eLine);
  s.pokeWord(23643, eLine);
  s.pokeWord(23649, eLine + 2);
  s.pokeWord(23651, eLine + 2);
  s.pokeWord(23653, eLine + 2);
}

async function sp48WithInterface1() {
  const s = await createSp48Session();
  s.bootToBasic();
  const x = (s as unknown as { machine: { wasmV2Runtime: { exports: Exports } } }).machine.wasmV2Runtime.exports;
  const image = connect(x, "sp48");
  const screen = () => Array.from({ length: 24 }, (_, row) => s.screenLine(row).trimEnd()).filter((l) => l.length > 0);
  return { s, x, image, screen };
}

describe("Interface 1 on the 48K (real v2 ROM)", () => {
  it("FORMAT writes 254 sectors, CAT finds 126K free", async () => {
    const { s, x, image, screen } = await sp48WithInterface1();
    installProgram(s, `10 FORMAT "m";1;"TEST"\n20 CAT 1`);
    s.typeKeys([["R"], ["Enter"]]);
    s.runFrames(3000);

    // --- 126K: the value derived from ROM 2's FORMAT (plan §9; its v2 bad-sector rule costs sector 254)
    expect(screen()).toEqual(["TEST", "126", "0 OK, 20:1"]);
    const numbers = new Set<number>();
    for (let slot = 0; slot < SLOTS; slot++) {
      expect(x.sp48If1GetSlotSignal(0, slot)).toBe(3);
      expect(image[slot * SLOT + 4]).toBe("T".charCodeAt(0));
      numbers.add(image[slot * SLOT + 1]);
    }
    expect(numbers.size).toBe(SLOTS);
    expect(x.sp48If1GetPaged()).toBe(0);
    expect(x.sp48If1GetSelect()).toBe(0);
  }, 120_000);

  it("SAVE * and LOAD * a program", async () => {
    const { s, image, screen } = await sp48WithInterface1();
    installProgram(s, `10 FORMAT "m";1;"TEST"\n20 SAVE *"m";1;"prog" LINE 40\n30 STOP\n40 PRINT "HELLO"`);
    s.typeKeys([["R"], ["Enter"]]);
    s.runFrames(3500);
    expect(screen().at(-1)).toBe("9 STOP statement, 30:1");

    // --- The file is on the tape: one record, EOF + SAVE type, named "prog"
    const records = [];
    for (let slot = 0; slot < SLOTS; slot++) {
      const r = slot * SLOT + 15;
      if (String.fromCharCode(...image.subarray(r + 4, r + 8)) === "prog") records.push(r);
    }
    expect(records.length).toBe(1);
    expect(image[records[0]]).toBe(0x06);

    // --- NEW, then LOAD * runs it from line 40
    s.typeKeys([["A"], ["Enter"]]).runFrames(150);
    installProgram(s, `10 LOAD *"m";1;"prog"`);
    s.typeKeys([["R"], ["Enter"]]);
    s.runFrames(800);
    expect(screen()).toContain("HELLO");
  }, 120_000);

  it("CAT on an empty drive reports Microdrive not present", async () => {
    const { s, screen } = await sp48WithInterface1();
    installProgram(s, `10 CAT 2`);
    s.typeKeys([["R"], ["Enter"]]);
    s.runFrames(100);
    expect(screen().at(-1)).toBe("Microdrive not present, 10:1");
  }, 60_000);

  it("CAT on a blank cartridge reports Microdrive not present", async () => {
    const { s, screen } = await sp48WithInterface1();
    installProgram(s, `10 CAT 1`);
    s.typeKeys([["R"], ["Enter"]]);
    s.runFrames(100);
    expect(screen().at(-1)).toBe("Microdrive not present, 10:1");
  }, 60_000);
});

describe("Interface 1 on the 128K (real v2 ROM)", () => {
  it("FORMAT and CAT from 128 BASIC", async () => {
    const s = await createSp128Session("sp128");
    const empty: CodeToInject = {
      model: "sp128",
      subroutine: true,
      entryAddress: 0x8000,
      segments: [{ startAddress: 0x8000, bankOffset: 0, emittedCode: [0xc9] }],
      options: { noCls: true }
    };
    s.runFlow(await s.machine.getCodeInjectionFlow("sp128"), { code: empty });
    s.runTo(SP128_RETURN_TO_EDITOR, { rom: 0, maxFrames: 5 });
    s.runFrames(30);
    const x = s.machine.wasmV2Runtime!.exports as unknown as Exports;
    connect(x, "sp128");
    s.typeText(`FORMAT "m";1;"T128"\n`).runFrames(3000);
    expect(s.screenText()).toContain("0 OK, 0:1");
    // --- The editor waits for a key after a report, then takes the next command
    s.typeText(`\n`).runFrames(50);
    s.typeText(`CAT 1\n`).runFrames(800);
    const text = s.screenText();
    expect(text).toContain("t128");
    expect(text).toContain("126");
    expect(x.sp128If1GetPaged()).toBe(0);
  }, 180_000);
});
