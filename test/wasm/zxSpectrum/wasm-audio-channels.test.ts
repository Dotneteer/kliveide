import { describe, expect, it } from "vitest";

import { AUDIO_SAMPLE_RATE } from "@emu/machines/machine-props";
import type { IAudioChannelMixer } from "@emu/abstractions/IAudioChannelMixer";
import { readWasmLayout } from "@emu/machines/state/wasmLayout";

import { createSp48Session } from "../../harness/sp48";
import { createTimexSession } from "../../harness/timex";
import {
  createTestSp128WasmMachine,
  createTestSp48WasmMachine,
  createTestSpp3eWasmMachine,
  testRom,
  type TestSp128WasmMachine,
  type TestSp48WasmMachine,
  type TestSpp3eWasmMachine
} from "./wasm-test-helpers";

/*
 * The audio mixer's gains and taps in the Spectrum family's cores (`dev/plans/AUDIO_MIXER_PLAN.md`
 * §3.1, phase 1; `zx-spectrum-audio-channels.c`). The gains change only what is heard - at unity
 * not one bit, muted to exact silence, and never the machine: not even a byte of its memory outside
 * the volatile statics, which reverse debugging's keyframes compare - and the taps report each
 * source before its gain.
 */

type Prefix = "sp48" | "sp128" | "spp3e";
type WasmMachine = TestSp48WasmMachine | TestSp128WasmMachine | TestSpp3eWasmMachine;

type MixerCase = {
  name: string;
  prefix: Prefix;
  hasAy: boolean;
  create: (rom: Uint8Array) => Promise<WasmMachine>;
};

const CASES: MixerCase[] = [
  {
    name: "ZX Spectrum 48K",
    prefix: "sp48",
    hasAy: false,
    create: (rom) => createTestSp48WasmMachine(rom)
  },
  {
    name: "ZX Spectrum 128K",
    prefix: "sp128",
    hasAy: true,
    create: (rom) => createTestSp128WasmMachine(rom, testRom([]))
  },
  {
    name: "ZX Spectrum +3E",
    prefix: "spp3e",
    hasAy: true,
    create: (rom) => createTestSpp3eWasmMachine([rom, testRom([]), testRom([]), testRom([])])
  }
];

/*
 * DI, then a loop through all four EAR/MIC states, each held for a different time:
 * EAR+MIC, EAR, MIC, neither
 */
const BEEPER_LOOP = testRom([
  0xf3,
  0x3e, 0x18, 0xd3, 0xfe, 0x06, 0x30, 0x10, 0xfe,
  0x3e, 0x10, 0xd3, 0xfe, 0x06, 0x20, 0x10, 0xfe,
  0x3e, 0x08, 0xd3, 0xfe, 0x06, 0x40, 0x10, 0xfe,
  0x3e, 0x00, 0xd3, 0xfe, 0x06, 0x18, 0x10, 0xfe,
  0x18, 0xde
]);

/* DI, then JR $ */
const IDLE = testRom([0xf3, 0x18, 0xfe]);

const ALL_IDS = ["beeper", "mic", "tape", "ayA", "ayB", "ayC"];

describe("Spectrum audio mixer: gains and taps", () => {
  for (const c of CASES) {
    const idsOf = () => (c.hasAy ? ALL_IDS : ALL_IDS.slice(0, 3));

    it(`${c.name} lists its sound sources`, async () => {
      const m = await c.create(BEEPER_LOOP);
      const channels = mixer(m).getAudioChannels();
      expect(channels.map((ch) => ch.id)).toEqual(idsOf());
      expect(new Set(channels.map((ch) => ch.group))).toEqual(new Set(c.hasAy ? ["ula", "tape", "ay"] : ["ula", "tape"]));
    });

    it(`${c.name} leaves the output unchanged, bit for bit, at unity gain and with taps on`, async () => {
      const plain = await c.create(BEEPER_LOOP);
      const touched = await c.create(BEEPER_LOOP);
      for (const id of idsOf()) mixer(touched).setAudioChannelGain(id, 0.5);
      for (const id of idsOf()) mixer(touched).setAudioChannelGain(id, 1);
      mixer(touched).setAudioTapsEnabled(true);
      for (const m of [plain, touched]) startTone(m, c);

      for (let frame = 0; frame < 5; frame++) {
        expect(frameSamples(touched, c.prefix), `frame ${frame}`).toEqual(frameSamples(plain, c.prefix));
      }
    });

    it(`${c.name} is silent with every channel muted`, async () => {
      const m = await c.create(BEEPER_LOOP);
      for (const id of idsOf()) mixer(m).setAudioChannelGain(id, 0);
      startTone(m, c);
      for (let frame = 0; frame < 3; frame++) {
        const samples = frameSamples(m, c.prefix);
        expect(samples.length).toBeGreaterThan(0);
        expect(samples.every((s) => s === 0)).toBe(true);
      }
    });

    it(`${c.name} runs the machine the same whatever the gains`, async () => {
      const plain = await c.create(BEEPER_LOOP);
      const muted = await c.create(BEEPER_LOOP);
      for (const id of idsOf()) mixer(muted).setAudioChannelGain(id, 0);
      mixer(muted).setAudioTapsEnabled(true);
      for (const m of [plain, muted]) startTone(m, c);
      for (let frame = 0; frame < 5; frame++) {
        plain.executeMachineFrame();
        muted.executeMachineFrame();
      }
      expect(muted.pc).toBe(plain.pc);
      expect(muted.tacts).toBe(plain.tacts);
      expect(muted.b).toBe(plain.b);
    });

    it(`${c.name} keeps every non-volatile byte the same whatever the gains and the taps`, async () => {
      const plain = await c.create(BEEPER_LOOP);
      const mixed = await c.create(BEEPER_LOOP);
      for (const m of [plain, mixed]) startTone(m, c);
      for (let frame = 0; frame < 6; frame++) {
        // --- Gains and the taps changing mid-run, as a user would between recording and a Step Back
        if (frame === 1) mixer(mixed).setAudioTapsEnabled(true);
        if (frame === 2) for (const id of idsOf()) mixer(mixed).setAudioChannelGain(id, 0.25);
        if (frame === 4) mixer(mixed).setAudioChannelGain("beeper", 0);
        plain.executeMachineFrame();
        mixed.executeMachineFrame();
      }
      expect(differingBytes(mixed, plain)).toEqual([]);
      // --- ... while what is heard does differ
      expect(frameSamples(mixed, c.prefix, false)).not.toEqual(frameSamples(plain, c.prefix, false));
    });

    it(`${c.name} taps each source before its gain`, async () => {
      const unity = await c.create(BEEPER_LOOP);
      const muted = await c.create(BEEPER_LOOP);
      mixer(unity).setAudioTapsEnabled(true);
      mixer(muted).setAudioTapsEnabled(true);
      for (const id of idsOf()) mixer(muted).setAudioChannelGain(id, 0);
      for (const m of [unity, muted]) {
        m.setMachineProperty(AUDIO_SAMPLE_RATE, 44100);
        m.executeMachineFrame();
      }
      const unityTaps = tapColumns(mixer(unity));
      const mutedTaps = tapColumns(mixer(muted));
      expect(mutedTaps).toEqual(unityTaps);
      // --- The program moves the beeper and MIC; nothing loads, so the tape channel is silent
      expect(distinct(unityTaps.beeper)).toBeGreaterThan(2);
      expect(distinct(unityTaps.mic)).toBeGreaterThan(2);
      expect(unityTaps.tape.every((v) => v === 0)).toBe(true);
      // --- EAR is two thirds of the beeper level, MIC one third (each core scales the whole output)
      expect(Math.max(...unityTaps.beeper)).toBeGreaterThan(0.45);
      expect(Math.max(...unityTaps.mic) / Math.max(...unityTaps.beeper)).toBeCloseTo(0.5, 2);
    });

    it(`${c.name} reports no taps while they are off`, async () => {
      const m = await c.create(BEEPER_LOOP);
      m.executeMachineFrame();
      expect(mixer(m).getAudioTapsEnabled()).toBe(false);
      expect(mixer(m).getAudioChannelTaps()).toBeUndefined();
    });

    it(`${c.name} clamps a gain to 0..4 and ignores unknown channels`, async () => {
      const m = await c.create(IDLE);
      mixer(m).setAudioChannelGain("beeper", 9);
      expect(mixer(m).getAudioChannelGain("beeper")).toBe(4);
      mixer(m).setAudioChannelGain("beeper", -1);
      expect(mixer(m).getAudioChannelGain("beeper")).toBe(0);
      mixer(m).setAudioChannelGain("nope", 0);
      expect(mixer(m).getAudioChannelGain("nope")).toBe(1);
      if (!c.hasAy) {
        mixer(m).setAudioChannelGain("ayA", 0);
        expect(mixer(m).getAudioChannelGain("ayA")).toBe(1);
      }
    });

    if (c.hasAy) {
      it(`${c.name} AY channel A's gain scales channel A alone`, async () => {
        const full = await c.create(IDLE);
        const half = await c.create(IDLE);
        mixer(full).setAudioTapsEnabled(true);
        mixer(half).setAudioChannelGain("ayA", 0.5);
        for (const m of [full, half]) {
          m.setMachineProperty(AUDIO_SAMPLE_RATE, 44100);
          toneA(m, 0x40);
          for (let frame = 0; frame < 10; frame++) m.executeMachineFrame();
        }
        const taps = tapColumns(mixer(full));
        expect(distinct(taps.ayA)).toBeGreaterThan(2);
        expect(distinct(taps.ayB)).toBe(1);
        expect(distinct(taps.ayC)).toBe(1);

        const ratio = energy(frameSamples(half, c.prefix, false)) / energy(frameSamples(full, c.prefix, false));
        expect(ratio).toBeGreaterThan(0.45);
        expect(ratio).toBeLessThan(0.55);
      });
    }
  }
});

describe("Spectrum audio mixer: Timex models", () => {
  it("the TC2048 has no AY in its mixer", async () => {
    const s = await createTimexSession({ model: "tc2048" });
    expect(s.timex.audioMixer.getAudioChannels().map((ch) => ch.id)).toEqual(["beeper", "mic", "tape"]);
  });

  it("the TS2068's AY joins the mixer and its taps", async () => {
    const s = await createTimexSession({ model: "ts2068" });
    s.bootToBasic();
    const m = s.timex.audioMixer;
    expect(m.getAudioChannels().map((ch) => ch.id)).toEqual(ALL_IDS);
    m.setAudioTapsEnabled(true);
    s.out(0x00f5, 0).out(0x00f6, 0x40);
    s.out(0x00f5, 1).out(0x00f6, 0x00);
    s.out(0x00f5, 7).out(0x00f6, 0x3e);
    s.out(0x00f5, 8).out(0x00f6, 0x0f);
    s.runFrames(2);
    const taps = tapColumns(m);
    expect(distinct(taps.ayA)).toBeGreaterThan(2);
    expect(distinct(taps.ayB)).toBe(1);
  });
});

describe("Spectrum audio mixer: tape", () => {
  it("routes the loading signal to the tape channel, not the beeper's", async () => {
    const s = await createSp48Session();
    s.loadTap("test/testfiles/floatspy.tap", { fastLoad: false });
    const m = s.machine.audioMixer;
    m.setAudioTapsEnabled(true);
    s.runFrames(20);
    const taps = tapColumns(m);
    expect(distinct(taps.tape)).toBeGreaterThan(1);
    expect(taps.beeper.every((v) => v === 0)).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------
// Helpers

function mixer(m: WasmMachine): IAudioChannelMixer {
  return m.audioMixer;
}

/* A square on AY channel A (the 128K's and +3E's AY), the others silent */
function toneA(m: WasmMachine, period: number): void {
  for (const [reg, value] of [[0, period & 0xff], [1, (period >> 8) & 0x0f], [7, 0x3e], [8, 0x0f]]) {
    m.writeTestPort(0xfffd, reg);
    m.writeTestPort(0xbffd, value);
  }
}

/* The sample rate, and on a machine with an AY a tone on channel A */
function startTone(m: WasmMachine, c: MixerCase): void {
  m.setMachineProperty(AUDIO_SAMPLE_RATE, 44100);
  if (c.hasAy) toneA(m, 0x60);
}

/* Runs a frame (unless told not to) and returns its raw interleaved sample words */
function frameSamples(m: WasmMachine, prefix: Prefix, run = true): number[] {
  if (run) m.executeMachineFrame();
  const fn = (m.wasmV2Runtime!.exports as unknown as Record<string, () => number>)[`${prefix}GetAudioSampleCount`];
  return Array.from(m.wasmV2Runtime!.audioSamples.slice(0, fn() * 2));
}

function tapColumns(m: IAudioChannelMixer): Record<string, number[]> {
  const taps = m.getAudioChannelTaps();
  if (!taps) throw new Error("No taps");
  const ids = m.getAudioChannels().map((ch) => ch.id);
  const columns: Record<string, number[]> = {};
  ids.forEach((id, c) => {
    columns[id] = [];
    for (let s = 0; s < taps.sampleCount; s++) columns[id].push(taps.samples[s * taps.channelCount + c]);
  });
  return columns;
}

/* The addresses (up to 8) where two cores' memories differ, outside the volatile statics and the stack */
function differingBytes(a: WasmMachine, b: WasmMachine): number[] {
  const layout = readWasmLayout(a.wasmV2Runtime!.module);
  if (!layout) throw new Error("The core has no layout stamp");
  const skip: [number, number][] = layout.volatile.map((v) => [v.address, v.address + v.size]);
  if (layout.stack) skip.push([layout.stack.address, layout.stack.address + layout.stack.size]);
  const x = new Uint8Array(a.wasmV2Runtime!.memoryBuffer);
  const y = new Uint8Array(b.wasmV2Runtime!.memoryBuffer);
  const out: number[] = [];
  for (let i = 0; i < x.length && out.length < 8; i++) {
    if (x[i] !== y[i] && !skip.some(([from, to]) => i >= from && i < to)) out.push(i);
  }
  return out;
}

function distinct(values: number[]): number {
  return new Set(values).size;
}

function energy(samples: number[]): number {
  return samples.reduce((sum, v) => sum + Math.abs(v), 0);
}
