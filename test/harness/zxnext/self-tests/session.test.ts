import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { ALL_CORES } from "../core/machines";
import { createSession, onEachCore } from "../script/session";

/*
 * The scripting layer on both cores. Every method a test may rely on is exercised here, so a method
 * that silently does nothing on one core fails in this file first.
 */

const VISUAL_CASES = resolve(__dirname, "../../../visual");

describe.each(ALL_CORES)("harness session - %s core", (core) => {
  it("loadCode + runTo + registers: runs assembled code to a label", async () => {
    const s = await createSession(core);
    const p = await s.loadCode(`
      .org $8000
    Start:
      ld a,$42
      ld hl,$1234
    Done:
      jr Done
    `);
    expect(p.entry).toBe(0x8000);
    s.runTo("Done");
    expect(s.registers()).toMatchObject({ pc: s.symbol("Done"), a: 0x42, hl: 0x1234 });
  });

  it("step executes exactly one instruction per count", async () => {
    const s = await createSession(core);
    await s.loadCode(`
      .org $8000
      ld a,1
      ld b,2
      ld c,3
      jr $
    `);
    s.step();
    expect(s.registers()).toMatchObject({ pc: 0x8002, a: 1 });
    s.step(2);
    expect(s.registers()).toMatchObject({ pc: 0x8006, bc: 0x0203 });
  });

  it("call runs a routine and returns", async () => {
    const s = await createSession(core);
    await s.loadCode(`
      .org $8000
    Idle:
      jr Idle
    Double:
      add a,a
      ret
    `);
    s.setRegisters({ a: 21 });
    s.call("Double");
    expect(s.registers()).toMatchObject({ a: 42, pc: s.symbol("Idle"), sp: 0xbff0 });
  });

  it("memory, ports and NextRegs go through the hardware paths", async () => {
    const s = await createSession(core);
    await s.loadCode(` .org $8000\n jr $`);
    s.poke(0xc000, [1, 2, 3]).pokeWord(0xc010, 0xbeef);
    expect(Array.from(s.peekBytes(0xc000, 3))).toEqual([1, 2, 3]);
    expect(s.peekWord(0xc010)).toBe(0xbeef);

    s.setNextReg(0x14, 0x5a); // global transparency: plain read/write register
    expect(s.readNextReg(0x14)).toBe(0x5a);
    expect(s.nextRegValue(0x14)).toBe(0x5a);

    s.setNextReg(0x56, 20); // MMU slot 6 -> page 20: $C000 now shows different RAM
    expect(s.peek(0xc000)).not.toBe(1);
    s.setNextReg(0x56, 0);
    expect(s.peek(0xc000)).toBe(1);
  });

  it("Z80 code writing a NextReg is visible, and runUntilReady waits for the marker", async () => {
    const s = await createSession(core);
    await s.loadCode(`
      .org $8000
      ld bc,$4000       ; ~26 T-states x 16384: a few frames at 3.5 MHz
    Delay:
      dec bc
      ld a,b
      or c
      jr nz,Delay
      nextreg $7F,$A5
      jr $
    `);
    s.runUntilReady({ maxFrames: 50 });
    expect(s.nextRegValue(0x7f)).toBe(0xa5);
    expect(s.frames).toBeGreaterThanOrEqual(3);
  });

  it("reset is a soft reset: PC back to 0, RAM kept", async () => {
    const s = await createSession(core);
    await s.loadCode(` .org $8000\n ld a,1\n jr $`);
    s.poke(0xc000, 0x5a).runFrames(1);
    s.reset();
    expect(s.registers().pc).toBe(0);
    s.setNextReg(0x56, 0); // --- reset re-pages slot 6; look at page 0 again
    expect(s.peek(0xc000)).toBe(0x5a);
  });

  it("runs fail with the PC instead of hanging", async () => {
    const s = await createSession(core);
    await s.loadCode(` .org $8000\n jr $`);
    expect(() => s.runUntilReady({ maxFrames: 3 })).toThrow(/Timed out after 3 frames.*PC=\$8000/);
    expect(() => s.runTo(0x9000, { maxFrames: 2 })).toThrow(/running to \$9000/);
  });

  it("loadProgramFile + screen probes: the T00 picture", async () => {
    const s = await createSession(core);
    await s.loadProgramFile(resolve(VISUAL_CASES, "copper/T00-static-ula/program.asm"));
    s.runUntilReady().runFrames(2);
    expect(s.pixel(0, 0)).toBe("#B60000"); // red border
    s.expectProbe({ kind: "rect", x: [96, 607], y: [48, 239], rgb: "ula:6" });
    expect(() => s.expectProbe({ kind: "pixel", x: 0, y: 0, rgb: "ula:1" })).toThrow(/expected #0000B6, is #B60000/);
  });

  it("audio: records the mixer's samples frame by frame", async () => {
    const s = await createSession(core, { audioSampleRate: 44_100 });
    await s.loadCode(` .org $8000\n jr $`);
    s.startAudio().runFrames(5);
    const n = s.audio().length;
    expect(n).toBeGreaterThan(4 * 800);
    expect(n).toBeLessThan(6 * 900);
  });
});

describe("harness session - parity", () => {
  it("onEachCore returns per-core results for comparison", async () => {
    const r = await onEachCore(async (s) => {
      await s.loadCode(` .org $8000\n ld a,7\n add a,a\n jr $`);
      s.step(2);
      return s.registers().a;
    });
    expect(r).toEqual({ ts: 14, wasm: 14 });
  });
});
