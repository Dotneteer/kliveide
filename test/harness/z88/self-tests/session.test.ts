import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { createZ88Session, Z88_HARNESS_BACKENDS, Z88_FLAT_RAM_LAYOUT } from "../index";
import { REPO_ROOT } from "../core/machines";

/*
 * The Z88 harness's own tests: every session method, on every backend.
 */
describe.each(Z88_HARNESS_BACKENDS)("Z88 harness session (%s)", (backend) => {
  it("creates a blank machine: nothing in slot 0 but a blank ROM card", async () => {
    const s = await createZ88Session({ backend });
    expect(s.backend).toBe(backend);
    expect(s.physPeek(0x00_0000)).toBe(0x00);
    expect(s.registers().pc).toBe(0x0000);
    expect(s.lcdWidth).toBe(640);
    expect(s.lcdHeight).toBe(64);
  });

  it("with rom: 'model' loads the model's ROM into slot 0", async () => {
    const s = await createZ88Session({ backend, model: "OZ40", rom: "model" });
    const rom = readFileSync(join(REPO_ROOT, "src/public/roms/z88ukv40.rom"));
    for (const offset of [0x0000, 0x0001, 0x1234, 0x1_fffe]) {
      expect(s.physPeek(offset)).toBe(rom[offset]);
    }
  });

  it("loadCode maps flat internal RAM, places the code and sets PC/SP", async () => {
    const s = await createZ88Session({ backend });
    const p = await s.loadCode(`
      .org $8000
start:
      ld a,$42
      ld ($c000),a
done:
      jr done
    `);
    expect(p.entry).toBe(0x8000);
    expect(s.symbol("done")).toBe(0x8005);
    expect(s.registers()).toMatchObject({ pc: 0x8000, sp: 0xbff0, iff1: false });
    expect(s.blinkState()).toMatchObject({
      COM: Z88_FLAT_RAM_LAYOUT.COM,
      SR0: Z88_FLAT_RAM_LAYOUT.SR0,
      SR1: Z88_FLAT_RAM_LAYOUT.SR1,
      SR2: Z88_FLAT_RAM_LAYOUT.SR2,
      SR3: Z88_FLAT_RAM_LAYOUT.SR3
    });
    // --- $8000 is bank $22 (internal RAM, slot 0 + 512K)
    expect(s.physPeek(0x08_0000 + 2 * 0x4000)).toBe(0x3e);

    s.runTo("done");
    expect(s.registers().pc).toBe(0x8005);
    expect(s.peek(0xc000)).toBe(0x42);
    // --- $C000 is bank $23
    expect(s.physPeek(0x08_0000 + 3 * 0x4000)).toBe(0x42);
  });

  it("the flat layout makes $0000-$3FFF bank $20, writable", async () => {
    const s = await createZ88Session({ backend });
    s.mapFlatRam().poke(0x0038, 0xc9).poke(0x3fff, 0x77);
    expect(s.peek(0x0038)).toBe(0xc9);
    expect(s.physPeek(0x08_0000 + 0x0038)).toBe(0xc9);
    expect(s.physPeek(0x08_0000 + 0x3fff)).toBe(0x77);
  });

  it("step executes one instruction; runFrames counts 16384-tact frames", async () => {
    const s = await createZ88Session({ backend });
    await s.loadCode(`
      .org $8000
      nop
      ld a,$55
loop: jr loop
    `);
    s.step();
    expect(s.registers().pc).toBe(0x8001);
    s.step();
    expect(s.registers().pc).toBe(0x8003);
    expect(s.registers().af >> 8).toBe(0x55);

    const t0 = s.tacts;
    s.runFrames(3);
    expect(s.frames).toBe(3);
    expect(s.tacts - t0).toBeGreaterThanOrEqual(2 * 16384);
    expect(s.tacts - t0).toBeLessThanOrEqual(3 * 16384 + 12);
  });

  it("runUntil fails with the PC when the condition never holds", async () => {
    const s = await createZ88Session({ backend });
    await s.loadCode(`
      .org $8000
loop: jr loop
    `);
    expect(() => s.runUntil(() => false, "nothing", { maxFrames: 2 })).toThrow(/nothing \(PC=\$8000\)/);
  });

  it("setRegisters and peekWord/pokeWord round-trip", async () => {
    const s = await createZ88Session({ backend });
    s.mapFlatRam().pokeWord(0x9000, 0xbeef).setRegisters({ hl: 0x1234, sp: 0x9000 });
    expect(s.peekWord(0x9000)).toBe(0xbeef);
    expect(s.peekBytes(0x9000, 2)).toEqual(new Uint8Array([0xef, 0xbe]));
    expect(s.registers()).toMatchObject({ hl: 0x1234, sp: 0x9000 });
  });

  it("out/in go through the Blink ports", async () => {
    const s = await createZ88Session({ backend });
    s.out(0xd3, 0x40);
    expect(s.blinkState().SR3).toBe(0x40);
    expect(s.in(0xb0)).toBe(0x80); // MID: ZVM
  });

  it("keyDown/keyUp drive the key matrix", async () => {
    const s = await createZ88Session({ backend });
    s.keyDown("A", "ShiftR");
    // --- A is code 43 (line 5, bit 3); ShiftR is 63 (line 7, bit 7)
    expect(s.blinkState().keyLines[5]).toBe(0x08);
    expect(s.blinkState().keyLines[7]).toBe(0x80);
    s.keyUp("A");
    expect(s.blinkState().keyLines[5]).toBe(0x00);
    expect(() => s.keyDown("NoSuchKey" as any)).toThrow("Unknown Z88 key");
  });

  it("collects audio samples only after startAudio", async () => {
    const s = await createZ88Session({ backend, audioSampleRate: 48_000 });
    await s.loadCode(`
      .org $8000
loop: jr loop
    `);
    expect(() => s.audio()).toThrow("startAudio");
    s.startAudio().runFrames(10);
    // --- 10 frames of 5 ms at 48 kHz
    expect(s.audio().length).toBeGreaterThanOrEqual(2390);
    expect(s.audio().length).toBeLessThanOrEqual(2410);
  });
});
