import { describe, expect, it } from "vitest";

import { createBareSam } from "./bare";

/*
 * The ASIC's interrupts and STATUS (plan §7.4; ASIC_VIDEO_MEMORY_TIMING.md §5): live pulses, not latches.
 */

const STATUS = 0x00f9;
const FRAME_BIT = 0x08;
const LINE_BIT = 0x01;
const MIDI_OUT_BIT = 0x10;

describe("SAM interrupts", () => {
  it("the frame interrupt is STATUS bit 3 low for the first 128 T of the frame", async () => {
    const s = await createBareSam();
    s.wasm.samSetFrameTact(10);
    expect(s.in(STATUS) & FRAME_BIT).toBe(0);
    s.wasm.samSetFrameTact(127);
    expect(s.in(STATUS) & FRAME_BIT).toBe(0);
    s.wasm.samSetFrameTact(128);
    expect(s.in(STATUS) & FRAME_BIT).toBe(FRAME_BIT);
    s.wasm.samSetFrameTact(50_000);
    expect(s.in(STATUS) & 0x1f).toBe(0x1f);
  });

  it("LINE = N pulses at vc N, hc 0 (frame line N + 68) for 128 T; 192 and above never", async () => {
    for (const line of [0, 1, 100, 191]) {
      const s = await createBareSam();
      s.out(STATUS, line);
      const start = (line + 68) * 384;
      s.wasm.samSetFrameTact(start - 1);
      expect(s.in(STATUS) & LINE_BIT).toBe(LINE_BIT);
      s.wasm.samSetFrameTact(start);
      expect(s.in(STATUS) & LINE_BIT).toBe(0);
      s.wasm.samSetFrameTact(start + 127);
      expect(s.in(STATUS) & LINE_BIT).toBe(0);
      s.wasm.samSetFrameTact(start + 128);
      expect(s.in(STATUS) & LINE_BIT).toBe(LINE_BIT);
    }
    const off = await createBareSam();
    off.out(STATUS, 200);
    for (let t = 0; t < 119_808; t += 64) {
      off.wasm.samSetFrameTact(t);
      expect(off.in(STATUS) & LINE_BIT).toBe(LINE_BIT);
    }
  });

  it("a LINE write during the pulse ends it", async () => {
    const s = await createBareSam();
    s.out(STATUS, 50);
    s.wasm.samSetFrameTact((50 + 68) * 384 + 10);
    expect(s.in(STATUS) & LINE_BIT).toBe(0);
    s.out(STATUS, 50);
    expect(s.in(STATUS) & LINE_BIT).toBe(LINE_BIT);
  });

  it("STATUS bits 5-7 are keyboard rows' extra keys; the line reads 1 with the high byte FFh", async () => {
    const s = await createBareSam();
    s.wasm.samSetFrameTact(50_000);
    s.machine.setKeyStatus(5, true); // F1: row 0, bit 5
    expect(s.in(0xfef9) & 0xe0).toBe(0xc0);
    expect(s.in(0xfdf9) & 0xe0).toBe(0xe0);
    expect(s.in(0xfff9) & 0xe0).toBe(0xe0);
  });

  it("an IM 1 CPU takes the frame interrupt; DI for the whole pulse loses it", async () => {
    const s = await createBareSam();
    // --- 0000h: EI; HALT (page 4 in section A); 0038h: the handler
    s.poke(0x0000, [0xfb, 0x76]);
    s.poke(0x0038, [0x3e, 0x42, 0xfb, 0xc9]);
    s.wasm.samSetCpuInterruptMode(1);
    s.wasm.samSetFrameTact(119_000);
    s.wasm.samSetCpuPc(0x0000);
    for (let i = 0; i < 400 && s.wasm.samGetCpuPc() !== 0x0038; i++) s.step(1);
    expect(s.wasm.samGetCpuPc()).toBe(0x0038);
    expect(s.wasm.samGetFrameTacts()).toBeLessThan(128);
    // --- DI across the whole pulse: no interrupt
    const t = await createBareSam();
    t.poke(0x0000, [0xf3, 0x00, 0x00, 0x00]);
    for (let i = 0; i < 60; i++) t.poke(0x0004 + i, 0x00);
    t.poke(0x0040, [0xfb, 0x00, 0x00, 0x18, 0xfe]);
    t.wasm.samSetCpuInterruptMode(1);
    t.wasm.samSetFrameTact(0);
    t.wasm.samSetCpuPc(0x0000);
    t.step(70);
    expect(t.wasm.samGetFrameTacts()).toBeGreaterThan(128);
    t.step(10);
    expect(t.wasm.samGetCpuPc()).not.toBe(0x0038);
    expect(t.wasm.samGetCpuSp()).toBe(0x7ff0);
  });

  it("MIDI OUT: TXFMST (LPEN bit 1) while the byte is sent, the MIDIOUT pulse at its end", async () => {
    const s = await createBareSam();
    s.wasm.samSetFrameTact(30_000);
    s.out(0x00fd, 0x90);
    expect(s.in(0x00f8) & 0x02).toBe(0x02);
    expect(s.in(STATUS) & MIDI_OUT_BIT).toBe(MIDI_OUT_BIT);
    // --- 1920 T after the write (NOPs from page 4)
    for (let i = 0; i < 0x1000; i++) s.poke(i, 0x00);
    s.wasm.samSetCpuPc(0);
    const t0 = s.wasm.samGetTacts();
    while (((s.wasm.samGetTacts() - t0) >>> 0) < 1925) s.step(1);
    expect((s.wasm.samGetTacts() - t0) >>> 0).toBeLessThan(2000);
    expect(s.in(STATUS) & MIDI_OUT_BIT).toBe(0);
    expect(s.in(0x00f8) & 0x02).toBe(0);
  });
});
