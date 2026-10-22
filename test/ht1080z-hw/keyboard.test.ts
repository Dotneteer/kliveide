import { describe, expect, it } from "vitest";

import { createHtSession, type Ht1080zTestSession } from "../harness/ht1080z";
import { Ht1080zKeyCode as K } from "@emu/machines/ht1080z/Ht1080zKeyCode";
import { ht1080zKeyMappings } from "@emu/machines/ht1080z/Ht1080zKeyMappings";
import { ht1080zStrokesForText } from "@emu/machines/ht1080z/Ht1080zTyper";

/*
 * The Phase 4 keyboard tests (`.plans/HT1080Z_PLAN.md` §7, §13): the typer against the real ROMs,
 * the accents of Series II and the /64 (the extension ROM's), the RESET key and PAGE.
 */

async function booted(model = "ht1080z-s2"): Promise<Ht1080zTestSession> {
  return (await createHtSession({ model })).bootToPrompt();
}

describe("HT-1080Z keyboard: typing", () => {
  it("PRINT 1+1 prints 2 on every model", async () => {
    for (const model of ["ht1080z-s1", "ht1080z-s2", "ht1080z-64"]) {
      const s = await booted(model);
      s.typeKeys("PRINT 1+1\n");
      expect(s.lastLines(4), model).toEqual([">PRINT 1+1", " 2", "READY", ">_"]);
    }
  });

  it("types repeated keys: hold 3 frames and release 3 is twice what the ROM needs", async () => {
    const s = await booted();
    s.typeKeys("AABB1110");
    expect(s.lastLines()).toEqual([">AABB1110_"]);
  });

  it("types every TRS-80 symbol", async () => {
    const s = await booted();
    s.typeKeys("!#$%&'()*+,-./:;<=>?@[");
    // --- @ is stored as 00h on Series II (the ROM's fold) and drawn as 40h; [ is the up arrow's
    expect(s.lastLines()).toEqual([">!#$%&'()*+,-./:;<=>?@[_"]);
  });

  it("types lowercase once the extension is on", async () => {
    const s = await booted("ht1080z-s1");
    s.extensionOn();
    expect(s.lastLines(3)[0]).toBe("NEW KEYBOARD ROUTINE ENABLE");
    s.typeKeys("aBc");
    expect(s.lineCodes(0, 4)).toEqual([0x3e, 0x61, 0x42, 0x63]);
  });

  it("refuses a character the model's keyboard cannot type", () => {
    expect(() => ht1080zStrokesForText("Á", "s1")).toThrow(/cannot type 'Á'/);
    expect(() => ht1080zStrokesForText("ő", "s2")).toThrow(/cannot type 'ő'/);
    expect(() => ht1080zStrokesForText("£", "s64")).toThrow();
  });
});

describe("HT-1080Z keyboard: accents", () => {
  it("Series II: CLEAR (and SHIFT) held, then A E U O", async () => {
    const s = await booted("ht1080z-s2");
    s.extensionOn();
    // --- Twice over: a long run of CLEAR strokes is what showed the typer's frame jitter
    s.typeKeys("ÁÉÜÖáéüöÁÉÜÖáéüö");
    // --- The Series II character ROM's accent positions (HS ROM page): Á 5Dh, É 40h, Ü 5Eh, Ö 5Ch
    const accents = [0x5d, 0x40, 0x5e, 0x5c, 0x7d, 0x60, 0x7e, 0x7c];
    expect(s.lineCodes(0, 17)).toEqual([0x3e, ...accents, ...accents]);
  });

  it("the /64: ` then a key, with the special set on (PRINT CHR$(21))", async () => {
    const s = await booted("ht1080z-64");
    s.extensionOn();
    s.typeKeys("PRINT CHR$(21)\n");
    s.typeKeys("ÁÉÍÓÖŐÚÜŰáéíóöőúüű");
    // --- The /64 character ROM's codes 0-8 and 16-24 (HS ROM page)
    expect(s.lineCodes(0, 19)).toEqual([0x3e, 0, 1, 2, 3, 4, 5, 6, 7, 8, 16, 17, 18, 19, 20, 21, 22, 23, 24]);
  });

  it("the /64: the mathematical and Greek characters", async () => {
    const s = await booted("ht1080z-64");
    s.extensionOn();
    s.typeKeys("PRINT CHR$(21)\n");
    s.typeKeys("■λ∞πΣΨΩ√μαγ∫βω");
    // --- The codes are the /64 character ROM's, read off its glyphs; the HS page's code column is
    // --- wrong for these (its keys are right) - `.plans/HT1080Z_PLAN.md` §17, Phase 4
    expect(s.lineCodes(0, 15)).toEqual([0x3e, 9, 10, 11, 12, 13, 14, 15, 25, 26, 27, 28, 29, 30, 31]);
  });
});

describe("HT-1080Z keyboard: RESET and PAGE", () => {
  it("the machine menu's RESET key returns BASIC to READY with the program kept", async () => {
    const s = await booted();
    s.typeKeys("10 PRINT 7\n");
    // --- A program that never ends, then the RESET key
    s.typeKeys("20 GOTO 20\nRUN\n");
    s.runFrames(20);
    expect(s.lastLines()).not.toEqual([">_"]);
    await s.machine.executeCustomCommand("reset_key");
    s.runUntil(() => s.lastLines()[0] === ">_", { maxFrames: 200 }, "the > prompt after RESET");
    s.typeKeys("LIST\n", { settle: 20 });
    expect(s.lastLines(4)).toEqual(["10 PRINT 7", "20 GOTO 20", "READY", ">_"]);
  });

  it("PAGE latches: each press flips the 32-column page, holding it does not", async () => {
    const s = await booted();
    const page = () => s.wasm.ht1080zGetVideoPage();
    expect(page()).toBe(0);
    s.machine.setKeyStatus(K.Page, true);
    expect(page()).toBe(1);
    // --- Host key repeats send more presses while it is held
    s.machine.setKeyStatus(K.Page, true);
    s.machine.setKeyStatus(K.Page, true);
    expect(page()).toBe(1);
    s.machine.setKeyStatus(K.Page, false);
    s.machine.setKeyStatus(K.Page, true);
    s.machine.setKeyStatus(K.Page, false);
    expect(page()).toBe(0);
    // --- PAGE is outside the matrix: no row reads it
    expect(s.wasm.ht1080zReadMemory(0x38ff)).toBe(0);
  });

  it("maps Page Up and Page Down to PAGE, and Home to CLEAR, Escape to BREAK", () => {
    expect([ht1080zKeyMappings.PageUp, ht1080zKeyMappings.PageDown]).toEqual(["Page", "Page"]);
    expect([ht1080zKeyMappings.Home, ht1080zKeyMappings.Escape]).toEqual(["Clear", "Break"]);
  });
});
