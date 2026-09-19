import { describe, expect, it } from "vitest";

import { MC_SCREEN_SIZE } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import { AUDIO_SAMPLE_RATE } from "@emu/machines/machine-props";
import {
  createZ88Session,
  z88HarnessBackends,
  z88Model,
  type Z88Key,
  type Z88TestSession
} from "../../harness/z88";

/*
 * Parity of the WASM Cambridge Z88 with the TypeScript oracle, in lockstep: the same program on both
 * backends, compared through the public machine API - CPU registers, tacts and frames, the Blink state
 * the IDE shows, the snooze and sleep state, all 4 MB of physical memory, the LCD picture and the
 * current frame's audio samples.
 *
 * Covers what the core emulates so far (Steps 4-9 of `.plans/CAMBRIDGE_Z88_WASM_MIGRATION_PLAN.md`):
 * the memory map, the CPU and the frame loop, the Blink (ports, RTC, interrupts), the keyboard and
 * sleep, the LCD and the beeper. The samples are compared exactly: the core computes them in doubles
 * with the TypeScript beeper's arithmetic.
 */

const runsOnWasm = z88HarnessBackends("memory", "cpu", "blink", "keyboard", "lcd", "beeper").includes("wasm");

/** The app's usual rate; without one the TypeScript beeper emits a sample at every clock step */
const AUDIO_RATE = 44_100;

/** Compares the pictures; the message names the first differing pixel */
function expectSamePicture(ts: Z88TestSession, wasm: Z88TestSession, where: string): void {
  expect([wasm.lcdWidth, wasm.lcdHeight], `LCD size ${where}`).toEqual([ts.lcdWidth, ts.lcdHeight]);
  const a = ts.screen();
  const b = wasm.screen();
  const index = a.findIndex((v, i) => v !== b[i]);
  if (index >= 0) {
    const x = index % ts.lcdWidth;
    const y = Math.floor(index / ts.lcdWidth);
    throw new Error(
      `LCD differs ${where}: pixel (${x}, ${y}) (typescript $${a[index].toString(16)}, wasm $${b[index].toString(16)})`
    );
  }
}

/** Compares the samples of the last completed frame */
function expectSameAudio(ts: Z88TestSession, wasm: Z88TestSession, where: string): void {
  const a = ts.machine.getAudioSamples();
  const b = wasm.machine.getAudioSamples();
  expect(b.length, `sample count ${where}`).toBe(a.length);
  const index = a.findIndex((v, i) => v.left !== b[i].left || v.right !== b[i].right);
  if (index >= 0) {
    throw new Error(
      `Audio differs ${where}: sample ${index} (typescript ${JSON.stringify(a[index])}, wasm ${JSON.stringify(b[index])})`
    );
  }
}

/** Compares the two machines; the message names the first difference */
function expectSameState(
  ts: Z88TestSession,
  wasm: Z88TestSession,
  where: string,
  { audio = false }: { audio?: boolean } = {}
): void {
  expect(wasm.registers(), `registers ${where}`).toEqual(ts.registers());
  expect(wasm.tacts, `tacts ${where}`).toBe(ts.tacts);
  expect(wasm.machine.frames, `frames ${where}`).toBe(ts.machine.frames);
  expect(wasm.snoozed, `snoozed ${where}`).toBe(ts.snoozed);
  expect(wasm.sleeping, `sleep mode ${where}`).toBe(ts.sleeping);
  expect(wasm.blinkState(), `Blink ${where}`).toEqual(ts.blinkState());
  expectSamePicture(ts, wasm, where);
  if (audio) expectSameAudio(ts, wasm, where);
  for (let bank = 0; bank < 256; bank++) {
    const a = ts.machine.getMemoryPartition(bank);
    const b = wasm.machine.getMemoryPartition(bank);
    if (Buffer.compare(Buffer.from(a), Buffer.from(b)) !== 0) {
      const offset = a.findIndex((v, i) => v !== b[i]);
      throw new Error(
        `Memory differs ${where}: bank $${bank.toString(16)} offset $${offset.toString(16)} ` +
          `(typescript $${a[offset].toString(16)}, wasm $${b[offset].toString(16)})`
      );
    }
  }
}

describe.runIf(runsOnWasm)("Z88 parity: OZ boots identically on both backends", () => {
  const models = machineRegistry
    .find((m) => m.machineId === "z88")
    .models.filter((m) => m.menuGroup === undefined) // the originals, not the backend twins
    .map((m) => m.modelId);

  it.each(models)(
    "%s",
    async (model) => {
      const ts = await createZ88Session({ backend: "typescript", model, rom: "model", audioSampleRate: AUDIO_RATE });
      const wasm = await createZ88Session({ backend: "wasm", model, rom: "model", audioSampleRate: AUDIO_RATE });
      expectSameState(ts, wasm, "after the hard reset");
      for (const checkpoint of [1, 7, 8, 9, 50, 200, 600, 1700]) {
        ts.runFrames(checkpoint - ts.frames);
        wasm.runFrames(checkpoint - wasm.frames);
        expectSameState(ts, wasm, `at frame ${checkpoint}`, { audio: true });
      }
    },
    60_000
  );
});

/*
 * A program that keeps the CPU, the paging and the Blink busy: prefixed and block instructions, bank
 * switching through SR1-SR3, reads from an empty slot (the pseudo-random values), the RTC interrupt
 * with IM 1, HALT until the next interrupt, and the Blink's status ports.
 */
const MIXED = `
      .org $0038
      jp irq

      .org $8000
start:
      ld sp,$bff0
      im 1
      ld a,$03
      out ($b1),a          ; INT = TIME | GINT
      ld a,$01
      out ($b5),a          ; TMK = TICK
      ld a,$07
      out ($b4),a          ; TACK
      ei
loop:
      ; --- arithmetic and flags
      ld a,(counter)
      inc a
      ld (counter),a
      add a,$37
      daa
      rla
      sbc a,$12
      cpl
      neg
      ; --- block moves and searches (bank $22 to bank $23)
      ld hl,$8000
      ld de,$c100
      ld bc,$0040
      ldir
      ld hl,$c100
      ld bc,$0040
      ld a,$3e
      cpir
      ; --- IX/IY and bit operations
      ld ix,table
      ld iy,table+4
      ld a,(ix+1)
      add a,(iy+2)
      ld (ix+3),a
      set 3,(ix+0)
      bit 3,(ix+0)
      res 3,(iy-4)
      rlc (ix+2)
      srl b
      ; --- exchanges and the stack
      ex af,af'
      exx
      push hl
      pop de
      exx
      ex af,af'
      ; --- paging: bank $C5 (slot 3, empty) into segment 3, read the random values, bank $23 back
      ld a,$c5
      out ($d3),a
      ld hl,$c000
      ld b,(hl)
      ld c,(hl)
      ld a,$23
      out ($d3),a
      ; --- the Blink: status and timer ports
      in a,($b1)
      in a,($d0)
      in a,($b5)
      ; --- wait for the next RTC interrupt now and then
      ld a,(counter)
      and $07
      jr nz,loop
      halt
      jr loop

irq:
      push af
      ld a,$07
      out ($b4),a          ; TACK
      ld a,(ticks)
      inc a
      ld (ticks),a
      pop af
      ei
      reti

counter: .defb 0
ticks:   .defb 0
table:   .defb $11,$22,$33,$44,$55,$66,$77,$88
`;

describe.runIf(runsOnWasm)("Z88 parity: a mixed program, instruction by instruction", () => {
  it("30000 instructions: the same registers and tacts after each, the same machine at the end", async () => {
    const ts = await createZ88Session({ backend: "typescript" });
    const wasm = await createZ88Session({ backend: "wasm" });
    await ts.loadCode(MIXED, { entry: "start" });
    await wasm.loadCode(MIXED, { entry: "start" });

    // --- HALT waits for the next RTC tick (a 4-tact step each), so it takes this many to cross
    // --- several interrupts and frames
    for (let i = 0; i < 30000; i++) {
      ts.step();
      wasm.step();
      const where = `after instruction ${i + 1} (PC $${ts.registers().pc.toString(16)})`;
      expect(wasm.registers(), where).toEqual(ts.registers());
      expect(wasm.tacts, where).toBe(ts.tacts);
    }
    expectSameState(ts, wasm, "after 30000 instructions");
    // --- The program really went through interrupts and frames
    expect(ts.peek(ts.symbol("ticks"))).toBeGreaterThanOrEqual(3);
    expect(ts.machine.frames).toBeGreaterThanOrEqual(6);
  });

  it("the same program in whole frames reaches the same state", async () => {
    const ts = await createZ88Session({ backend: "typescript" });
    const wasm = await createZ88Session({ backend: "wasm" });
    await ts.loadCode(MIXED, { entry: "start" });
    await wasm.loadCode(MIXED, { entry: "start" });
    for (const frames of [1, 3, 20, 100]) {
      ts.runFrames(frames);
      wasm.runFrames(frames);
      expectSameState(ts, wasm, `after ${frames} more frames`);
    }
  });

  it("a frame stopped midway (runTo) finishes identically", async () => {
    const ts = await createZ88Session({ backend: "typescript" });
    const wasm = await createZ88Session({ backend: "wasm" });
    await ts.loadCode(MIXED, { entry: "start" });
    await wasm.loadCode(MIXED, { entry: "start" });
    for (let round = 0; round < 5; round++) {
      ts.runTo("irq");
      wasm.runTo("irq");
      expectSameState(ts, wasm, `at the interrupt handler, round ${round}`);
      ts.runFrames(1);
      wasm.runFrames(1);
      expectSameState(ts, wasm, `after finishing the frame, round ${round}`);
    }
  });
});

/*
 * OZ driven from the keyboard: the key interrupt, the KWAIT snooze and wake-up, the screens OZ draws
 * in response, and whatever it beeps - compared after every frame.
 */
describe.runIf(runsOnWasm)("Z88 parity: OZ at the keyboard", () => {
  // --- Each entry is held for a few frames, then released for a few; a chord is pressed together
  const SCRIPT: Z88Key[][] = [
    ["Index"],
    ["Down"],
    ["Down"],
    ["Menu"],
    ["Escape"],
    ["Diamond", "P"],
    ["H"],
    ["E"],
    ["L"],
    ["L"],
    ["O"],
    ["Enter"],
    ["ShiftL", "N1"],
    ["CapsLock"],
    ["Q"],
    ["Delete"],
    ["Left"],
    ["Help"],
    ["Escape"],
    ["Square", "Index"],
    ["Escape"],
    ["Index"]
  ];

  it.each(["OZ50", "OZ40"])(
    "%s: the same machine after every frame of a typing session",
    async (model) => {
      const ts = await createZ88Session({ backend: "typescript", model, rom: "model", audioSampleRate: AUDIO_RATE });
      const wasm = await createZ88Session({ backend: "wasm", model, rom: "model", audioSampleRate: AUDIO_RATE });
      ts.runFrames(1700);
      wasm.runFrames(1700);
      expectSameState(ts, wasm, "after booting");
      const bootPicture = ts.screen();

      let frame = 0;
      const both = (fn: (s: Z88TestSession) => void) => {
        fn(ts);
        fn(wasm);
      };
      for (const [index, keys] of SCRIPT.entries()) {
        both((s) => s.keyDown(...keys));
        for (let i = 0; i < 6; i++, frame++) {
          both((s) => s.runFrames(1));
          expectSameState(ts, wasm, `while holding ${keys.join("+")} (#${index}, frame ${frame})`, { audio: true });
        }
        both((s) => s.keyUp(...keys));
        for (let i = 0; i < 18; i++, frame++) {
          both((s) => s.runFrames(1));
          expectSameState(ts, wasm, `after releasing ${keys.join("+")} (#${index}, frame ${frame})`, {
            audio: true
          });
        }
      }
      // --- The keys really reached OZ: the picture is not the one it booted to
      expect(ts.screen()).not.toEqual(bootPicture);
    },
    120_000
  );
});

/*
 * The beeper from Z80 code: the 3200 Hz oscillator (COM.SRUN) gated by COM.SBIT, and the ear bit
 * (SBIT with SRUN clear) toggled at several periods, at several sample rates - each rate set as the app
 * sets it, before a reset.
 */
const BEEPER = `
      .org $8000
start:
      ld sp,$bff0
      di
      ld e,0               ; the pattern counter
next:
      ; --- the oscillator for a while, then gated off by SBIT
      ld a,$05             ; RAMS | LCDON
      or $80               ; SRUN
      out ($b0),a
      ld bc,$0300
osc:  dec bc
      ld a,b
      or c
      jr nz,osc
      ld a,$c5             ; SRUN | SBIT: silent
      out ($b0),a
      ld bc,$0100
gate: dec bc
      ld a,b
      or c
      jr nz,gate
      ; --- the ear bit: 64 toggles with a period that grows with the counter
      ld d,64
ear:  ld a,$45             ; SBIT
      out ($b0),a
      ld a,e
      and $1f
      inc a
      ld b,a
w1:   djnz w1
      ld a,$05             ; SBIT clear
      out ($b0),a
      ld a,e
      and $1f
      add a,3
      ld b,a
w2:   djnz w2
      dec d
      jr nz,ear
      inc e
      jr next
`;

describe.runIf(runsOnWasm)("Z88 parity: the beeper", () => {
  it.each([44_100, 48_000, 22_050, 11_025, 96_000])(
    "at %i Hz: the same samples in every frame",
    async (rate) => {
      const ts = await createZ88Session({ backend: "typescript", audioSampleRate: rate });
      const wasm = await createZ88Session({ backend: "wasm", audioSampleRate: rate });
      await ts.loadCode(BEEPER, { entry: "start" });
      await wasm.loadCode(BEEPER, { entry: "start" });
      let nonZero = 0;
      for (let frame = 0; frame < 120; frame++) {
        ts.runFrames(1);
        wasm.runFrames(1);
        expectSameAudio(ts, wasm, `in frame ${frame}`);
        nonZero += ts.machine.getAudioSamples().filter((sample) => sample.left !== 0).length;
      }
      expectSameState(ts, wasm, "after 120 frames", { audio: true });
      // --- The program really made sound
      expect(nonZero).toBeGreaterThan(1000);
    },
    60_000
  );

  it("a rate change (set, then a reset) takes effect the same way on both", async () => {
    const ts = await createZ88Session({ backend: "typescript", audioSampleRate: 44_100 });
    const wasm = await createZ88Session({ backend: "wasm", audioSampleRate: 44_100 });
    for (const rate of [44_100, 32_000, 8_000]) {
      for (const s of [ts, wasm]) {
        s.machine.setMachineProperty(AUDIO_SAMPLE_RATE, rate);
        s.reset();
      }
      await ts.loadCode(BEEPER, { entry: "start" });
      await wasm.loadCode(BEEPER, { entry: "start" });
      for (let frame = 0; frame < 30; frame++) {
        ts.runFrames(1);
        wasm.runFrames(1);
        expectSameAudio(ts, wasm, `at ${rate} Hz, frame ${frame}`);
      }
    }
  });
});

/*
 * The LCD from random screen memory: every cell kind (LORES, UDG, HIRES, cursor, null) and attribute
 * combination turns up in a 64K of random bytes, for all five LCD sizes, through the text flash and
 * cursor phases, and with the LCD switched off and on again.
 */
describe.runIf(runsOnWasm)("Z88 parity: the LCD from random screen memory", () => {
  /** A small deterministic generator, so a failure reproduces */
  function random(seed: number): () => number {
    let x = seed >>> 0 || 1;
    return () => {
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return (x >>> 0) & 0xff;
    };
  }

  /** Writes a 16-bit LCD register: B (the port's high byte) carries its high byte */
  function outWord(s: Z88TestSession, port: number, value: number): void {
    s.out(((value >> 8) << 8) | port, value & 0xff);
  }

  it.each([undefined, "640x320", "640x480", "800x320", "800x480"])(
    "LCD size %s",
    async (size) => {
      const model = z88Model();
      const config = size ? { ...model.config, [MC_SCREEN_SIZE]: size } : undefined;
      const ts = await createZ88Session({ backend: "typescript", config });
      const wasm = await createZ88Session({ backend: "wasm", config });
      const next = random(size ? size.length * 7919 + size.charCodeAt(4) : 88);
      const bytes = Array.from({ length: 0xf000 }, next);
      for (const s of [ts, wasm]) {
        await s.loadCode(`
      .org $f000
spin: jr spin
        `);
        s.poke(0x0000, bytes);
        // --- The screen map in bank $22, the fonts spread over banks $20-$23
        outWord(s, 0x70, (0x21 << 5) | (0x1200 >> 9)); // PB0: LORES0 (UDGs)
        outWord(s, 0x71, (0x23 << 2) | (0x1000 >> 12)); // PB1: LORES1
        outWord(s, 0x72, (0x20 << 1) | (0x2000 >> 13)); // PB2: HIRES0
        outWord(s, 0x73, (0x21 << 3) | (0x2800 >> 11)); // PB3: HIRES1
        outWord(s, 0x74, (0x22 << 3) | (0x0000 >> 11)); // SBR
        s.out(0xb0, 0x05); // RAMS | LCDON
      }
      // --- Past two text flash toggles (every 200 frames), through the cursor phases of TIM0
      for (let frame = 1; frame <= 480; frame++) {
        ts.runFrames(1);
        wasm.runFrames(1);
        if (frame % 8 === 1) expectSamePicture(ts, wasm, `after frame ${frame}`);
        if (frame === 240) {
          ts.out(0xb0, 0x04);
          wasm.out(0xb0, 0x04);
        }
        if (frame === 264) {
          ts.out(0xb0, 0x05);
          wasm.out(0xb0, 0x05);
        }
      }
      expectSameState(ts, wasm, "at the end");
    },
    60_000
  );
});
