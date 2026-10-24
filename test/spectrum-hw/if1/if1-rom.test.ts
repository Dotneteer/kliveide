import { describe, expect, it } from "vitest";

import type { CodeToInject } from "@abstractions/CodeToInject";
import { SP128_RETURN_TO_EDITOR } from "@emu/machines/ZxSpectrumBase";
import { createSp128Session } from "../../harness/sp128";
import { formattedMdr, runBasic, screenLines, sp48WithInterface1 } from "./if1TestSupport";

/*
 * The Interface 1 with the shipped v2 ROM, at the tape's real speed (`.plans/MICRODRIVE_PLAN.md`
 * Phases 1-2; the scripts are `_input/microdrive/test-material.md` §3). The ROM drives the drives
 * through the ports alone.
 */

const SLOT = 543;

describe("Interface 1 on the 48K (real v2 ROM)", () => {
  it("FORMAT writes 254 sectors, CAT finds 126K free", async () => {
    const s = (await sp48WithInterface1()).insertCartridge(0, { blank: 254 });
    runBasic(s, `10 FORMAT "m";1;"TEST"\n20 CAT 1`, 3000);

    // --- 126K: what ROM 2's FORMAT leaves on a perfect tape (its bad-sector rule costs sector 254)
    expect(screenLines(s)).toEqual(["TEST", "126", "0 OK, 20:1"]);
    const mdr = s.cartridge(0)!;
    const numbers = new Set<number>();
    for (let slot = 0; slot < 254; slot++) {
      expect(s.interface1Bridge.slotSignal(0, slot)).toBe(3);
      expect(String.fromCharCode(...mdr.subarray(slot * SLOT + 4, slot * SLOT + 8))).toBe("TEST");
      numbers.add(mdr[slot * SLOT + 1]);
    }
    expect(numbers.size).toBe(254);
    expect(s.interface1().paged).toBe(false);
    expect(s.interface1().select).toBe(0);
  }, 120_000);

  it("FORMAT on a 100-sector tape overwrites its first sectors, as on a real loop", async () => {
    const s = (await sp48WithInterface1()).insertCartridge(0, { blank: 100 });
    runBasic(s, `10 FORMAT "m";1;"SHORT"\n20 CAT 1`, 2500);
    const lines = screenLines(s);
    expect(lines[0]).toBe("SHORT");
    expect(lines.at(-1)).toBe("0 OK, 20:1");
    // --- The last 100 sectors written survive: 100 down to 1 (the record of the overwritten wrap point
    // --- included); ROM 2 then visits "highest + 3" headers
    const numbers = new Set(Array.from({ length: 100 }, (_, slot) => s.cartridge(0)![slot * SLOT + 1]));
    expect(Math.max(...numbers)).toBe(100);
    expect(numbers.size).toBe(100);
    expect(Number(lines[1])).toBe(RECORDED.shortTapeFreeK);
  }, 120_000);

  it("SAVE * and LOAD * a program", async () => {
    const s = (await sp48WithInterface1()).insertCartridge(0, { blank: 254 });
    runBasic(s, `10 FORMAT "m";1;"TEST"\n20 SAVE *"m";1;"prog" LINE 40\n30 STOP\n40 PRINT "HELLO"`, 3500);
    expect(screenLines(s).at(-1)).toBe("9 STOP statement, 30:1");

    // --- The file is on the tape: one record, EOF + SAVE type, named "prog"
    const mdr = s.cartridge(0)!;
    const records = Array.from({ length: 254 }, (_, slot) => slot * SLOT + 15).filter(
      (r) => String.fromCharCode(...mdr.subarray(r + 4, r + 8)) === "prog"
    );
    expect(records.length).toBe(1);
    expect(mdr[records[0]]).toBe(0x06);

    // --- NEW, then LOAD * runs it from line 40
    s.typeKeys([["A"], ["Enter"]]).runFrames(150);
    runBasic(s, `10 LOAD *"m";1;"prog"`, 800);
    expect(screenLines(s)).toContain("HELLO");
  }, 120_000);

  it("SAVE * to a write-protected cartridge reports it and changes nothing", async () => {
    const s = (await sp48WithInterface1()).insertCartridge(0, formattedMdr(), true);
    runBasic(s, `10 SAVE *"m";1;"prog"`, 300);
    expect(screenLines(s).at(-1)).toBe("Drive 'write' protected, 10:1");
    expect(s.cartridge(0)!.subarray(0, 254 * SLOT)).toEqual(formattedMdr().subarray(0, 254 * SLOT));
  }, 60_000);

  it("OUT 239,0 erases the running tape: CAT then finds no cartridge", async () => {
    const s = (await sp48WithInterface1()).insertCartridge(0, formattedMdr());
    // --- OUT 239,0: COMMS CLK falls with DATA 0 (drive 1 selected), erase on - for ten seconds
    runBasic(s, `10 OUT 239,0: PAUSE 500: OUT 239,238\n20 CAT 1`, 900);
    expect(screenLines(s).at(-1)).toBe("Microdrive not present, 20:1");
    expect(Array.from({ length: 254 }, (_, i) => s.interface1Bridge.slotSignal(0, i)).every((v) => v === 0)).toBe(true);
  }, 120_000);

  it("CAT on an empty drive and on a blank cartridge reports Microdrive not present", async () => {
    const empty = await sp48WithInterface1();
    runBasic(empty, `10 CAT 2`, 100);
    expect(screenLines(empty).at(-1)).toBe("Microdrive not present, 10:1");

    const blank = (await sp48WithInterface1()).insertCartridge(0, { blank: 254 });
    runBasic(blank, `10 CAT 1`, 100);
    expect(screenLines(blank).at(-1)).toBe("Microdrive not present, 10:1");
  }, 60_000);

  it("the first IF1 entry inserts its system variables; PEEK 23729 tells edition 2", async () => {
    const s = await sp48WithInterface1();
    expect(s.peekWord(23635)).toBe(23755);
    runBasic(s, `10 CLOSE #0: PRINT PEEK 23729`, 50);
    expect(screenLines(s)[0]).toBe("80");
    expect(s.peekWord(23635)).toBe(RECORDED.prog);
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
    s.connectInterface1().insertCartridge(0, { blank: 254 });
    s.typeText(`FORMAT "m";1;"T128"\n`).runFrames(3000);
    expect(s.screenText()).toContain("0 OK, 0:1");
    // --- The editor waits for a key after a report, then takes the next command
    s.typeText(`\n`).runFrames(50);
    s.typeText(`CAT 1\n`).runFrames(800);
    const text = s.screenText();
    expect(text).toContain("t128");
    expect(text).toContain("126");
    expect(s.interface1().paged).toBe(false);
  }, 180_000);
});

/** Values this test recorded from the real ROM (plan §9) */
const RECORDED = {
  prog: 23813,
  shortTapeFreeK: 49
};
