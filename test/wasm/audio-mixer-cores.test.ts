import { describe, expect, it } from "vitest";

import type { IAudioChannelMixer } from "@emu/abstractions/IAudioChannelMixer";
import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import { AUDIO_SAMPLE_RATE } from "@emu/machines/machine-props";
import { readWasmLayout } from "@emu/machines/state/wasmLayout";

import { createEpSession, type EpTestSession } from "../harness/enterprise";
import { createHtSession } from "../harness/ht1080z";
import { createTvcSession } from "../harness/tvc";
import { createZ88Session } from "../harness/z88";
import { bareMachine as bareEp } from "../ep-hw/bare";
import { bareMachine as bareTvc, ROM_CRTC } from "../tvc-hw/bare";

/*
 * The audio mixer on the Cambridge Z88, the HT-1080Z, the Videoton TVC and the Enterprise
 * (`dev/plans/AUDIO_MIXER_PLAN.md` §3.1, phase 3; `common/wasm/audio-channels.c`, and the Spectrum
 * family's module for the HT-1080Z). The gains change only what is heard - at unity not one bit,
 * muted to silence, and never a byte of the machine outside its volatile statics (which reverse
 * debugging's keyframes compare) - and the taps report each source before its gain.
 */

const RATE = 48_000;

/** What a test needs of a machine with a sound scene playing */
type Rig = {
  mixer: IAudioChannelMixer;
  /** Runs a frame and returns its samples (copied) */
  frame(): AudioSample[];
  /** The core's runtime, for the memory comparison */
  runtime: { module: WebAssembly.Module; memoryBuffer: ArrayBuffer };
};

type MachineCase = {
  name: string;
  ids: string[];
  /** The sources the scene plays, and the ones it leaves silent */
  playing: string[];
  silent: string[];
  /** A machine with its sound scene set up (`play` false: the same machine, silent) */
  create(play?: boolean): Promise<Rig>;
};

const copy = (samples: AudioSample[]) => samples.map(({ left, right }) => ({ left, right }));

// --- Z88: the Blink's 3200 Hz tone (COM.SRUN set, SBIT clear)
const COM_RAMS = 0x04;
const COM_SRUN = 0x80;
async function z88(play = true): Promise<Rig> {
  const s = await createZ88Session({ audioSampleRate: RATE });
  await s.loadCode(" .org $8000\nspin: jr spin");
  if (play) s.out(0xb0, COM_RAMS | COM_SRUN);
  return {
    mixer: s.machine.audioMixer,
    frame: () => copy(s.runFrames(1).machine.getAudioSamples()),
    runtime: s.machine.wasmV2Runtime!
  };
}

// --- HT-1080Z: the port-FF beeper toggling, and AY channels A and C
const HT_CODE = 0x6000;
const HT_LOOP = [0xf3, 0x3e, 0x01, 0xd3, 0xff, 0x06, 0x40, 0x10, 0xfe, 0x3e, 0x02, 0xd3, 0xff, 0x06, 0x40, 0x10, 0xfe, 0x18, 0xee];
async function ht(play = true): Promise<Rig> {
  const s = (await createHtSession({ model: "ht1080z-s2" })).bootToPrompt();
  s.machine.setMachineProperty(AUDIO_SAMPLE_RATE, RATE);
  const ay = (reg: number, value: number) => {
    s.machine.doWritePort(0x1f, reg);
    s.machine.doWritePort(0x1e, value);
  };
  if (play) {
    for (const [reg, value] of [[0, 0x80], [1, 0], [4, 0x30], [5, 1], [7, 0x3a], [8, 0x0f], [10, 0x0c]]) ay(reg, value);
    s.poke(HT_CODE, HT_LOOP);
  } else {
    s.poke(HT_CODE, [0xf3, 0x18, 0xfe]);
  }
  s.machine.pc = HT_CODE;
  return {
    mixer: s.machine.audioMixer,
    frame: () => copy((s.runFrames(1), s.machine.getAudioSamples())),
    runtime: s.machine.wasmV2Runtime!
  };
}

// --- TVC: the sound generator's square wave (port 05h bit 4), n = 3901
async function tvc(play = true): Promise<Rig> {
  const s = await createTvcSession();
  bareTvc(s, { halt: false, crtc: [...ROM_CRTC.slice(0, 10), 0x23, ...ROM_CRTC.slice(11)] });
  s.wasm.tvcWritePort(0x07, 0);
  s.wasm.tvcSetAudioSampleRate(RATE, Math.exp((-2 * Math.PI * 1.4) / RATE));
  if (play) {
    s.wasm.tvcWritePort(0x04, 3901 & 0xff);
    s.wasm.tvcWritePort(0x05, 0x10 | (3901 >> 8));
    s.wasm.tvcWritePort(0x06, 15 << 2);
  }
  return {
    mixer: s.machine.audioMixer,
    frame: () => copy((s.runFrames(1), s.machine.getAudioSamples())),
    runtime: s.machine.wasmV2Runtime!
  };
}

// --- Enterprise: tone 0 on the left, tone 1 on both sides, the noise on the right
const dave = (s: EpTestSession, register: number, value: number) => s.wasm.epWritePort(0xa0 + register, value);
async function ep(play = true, scene: (s: EpTestSession) => void = epScene): Promise<Rig> {
  const s = await createEpSession();
  bareEp(s, { bf: 0x0c });
  for (let r = 0; r < 16; r++) dave(s, r, 0);
  s.machine.setMachineProperty(AUDIO_SAMPLE_RATE, RATE);
  if (play) scene(s);
  return {
    mixer: s.machine.audioMixer,
    frame: () => copy((s.runFrames(1), s.machine.getAudioSamples())),
    runtime: s.machine.wasmV2Runtime!
  };
}
function epScene(s: EpTestSession): void {
  dave(s, 0, 124); // --- tone 0: 1 kHz
  dave(s, 2, 60); // --- tone 1
  dave(s, 6, 0x00); // --- noise from the 31.25 kHz clock
  dave(s, 8, 50); // --- left: tone 0
  dave(s, 9, 30); // --- left: tone 1
  dave(s, 13, 30); // --- right: tone 1
  dave(s, 15, 20); // --- right: the noise
}

const CASES: MachineCase[] = [
  { name: "Cambridge Z88", ids: ["speaker"], playing: ["speaker"], silent: [], create: z88 },
  {
    name: "HT-1080Z",
    ids: ["beeper", "ayA", "ayB", "ayC"],
    playing: ["beeper", "ayA", "ayC"],
    silent: ["ayB"],
    create: ht
  },
  { name: "Videoton TVC", ids: ["sound"], playing: ["sound"], silent: [], create: tvc },
  {
    name: "Enterprise",
    ids: ["tone0", "tone1", "tone2", "noise"],
    playing: ["tone0", "tone1", "noise"],
    silent: ["tone2"],
    create: ep
  }
];

function frames(rig: Rig, count: number): AudioSample[] {
  const all: AudioSample[] = [];
  for (let i = 0; i < count; i++) all.push(...rig.frame());
  return all;
}

function tapColumns(mixer: IAudioChannelMixer): Record<string, number[]> {
  const taps = mixer.getAudioChannelTaps();
  if (!taps) throw new Error("No taps");
  const columns: Record<string, number[]> = {};
  mixer.getAudioChannels().forEach((ch, c) => {
    columns[ch.id] = [];
    for (let i = 0; i < taps.sampleCount; i++) columns[ch.id].push(taps.samples[i * taps.channelCount + c]);
  });
  return columns;
}

/* Up to 8 addresses where two cores' memories differ, outside the volatile statics and the stack */
function memoryDifferences(a: Rig, b: Rig): number[] {
  const layout = readWasmLayout(a.runtime.module);
  if (!layout) throw new Error("The core has no layout stamp");
  const skip: [number, number][] = layout.volatile.map((v) => [v.address, v.address + v.size]);
  if (layout.stack) skip.push([layout.stack.address, layout.stack.address + layout.stack.size]);
  const x = new Uint8Array(a.runtime.memoryBuffer);
  const y = new Uint8Array(b.runtime.memoryBuffer);
  const out: number[] = [];
  for (let i = 0; i < x.length && out.length < 8; i++) {
    if (x[i] !== y[i] && !skip.some(([from, to]) => i >= from && i < to)) out.push(i);
  }
  return out;
}

const distinct = (values: number[]) => new Set(values).size;

describe("audio mixer: Z88, HT-1080Z, TVC, Enterprise", () => {
  for (const c of CASES) {
    describe(c.name, () => {
      it("lists its sound sources", async () => {
        const rig = await c.create();
        expect(rig.mixer.getAudioChannels().map((ch) => ch.id)).toEqual(c.ids);
      });

      it("plays the same audio, bit for bit, at unity gain with the taps on", async () => {
        const plain = await c.create();
        const touched = await c.create();
        for (const id of c.ids) touched.mixer.setAudioChannelGain(id, 0.5);
        for (const id of c.ids) touched.mixer.setAudioChannelGain(id, 1);
        touched.mixer.setAudioTapsEnabled(true);
        const expected = frames(plain, 4);
        expect(expected.some((x) => x.left !== 0)).toBe(true);
        expect(frames(touched, 4)).toEqual(expected);
      });

      it("is silent with every source muted", async () => {
        const rig = await c.create();
        for (const id of c.ids) rig.mixer.setAudioChannelGain(id, 0);
        // --- A machine that made sound before the mute (the HT-1080Z boots first: its silent AY sits
        // --- below zero) decays from there through the DC filter, about 0.11 s, with no step: let it
        // --- settle, then nothing is left
        frames(rig, 60);
        const samples = frames(rig, 2);
        expect(samples.length).toBeGreaterThan(0);
        expect(samples.every((x) => Math.abs(x.left) < 1e-4 && Math.abs(x.right) < 1e-4)).toBe(true);
      });

      it("keeps every non-volatile byte the same whatever the gains and the taps", async () => {
        const plain = await c.create();
        const mixed = await c.create();
        let heardPlain: AudioSample[] = [];
        let heardMixed: AudioSample[] = [];
        for (let frame = 0; frame < 6; frame++) {
          // --- Gains and the taps changing mid-run, as a user would between recording and a Step Back
          if (frame === 1) mixed.mixer.setAudioTapsEnabled(true);
          if (frame === 2) for (const id of c.ids) mixed.mixer.setAudioChannelGain(id, 0.25);
          if (frame === 4) mixed.mixer.setAudioChannelGain(c.playing[0], 0);
          heardPlain = plain.frame();
          heardMixed = mixed.frame();
        }
        expect(memoryDifferences(mixed, plain)).toEqual([]);
        // --- ... while what is heard does differ
        expect(heardMixed).not.toEqual(heardPlain);
      });

      it("taps each source before its gain", async () => {
        const unity = await c.create();
        const muted = await c.create();
        for (const id of c.ids) muted.mixer.setAudioChannelGain(id, 0);
        for (const rig of [unity, muted]) {
          rig.mixer.setAudioTapsEnabled(true);
          frames(rig, 2);
        }
        const taps = tapColumns(unity.mixer);
        expect(tapColumns(muted.mixer)).toEqual(taps);
        for (const id of c.playing) expect(distinct(taps[id]), id).toBeGreaterThan(1);
        for (const id of c.silent) expect(distinct(taps[id]), id).toBe(1);
      });
    });
  }

  it("Enterprise: a muted channel plays exactly as one at amplitude 0", async () => {
    const muted = await ep();
    muted.mixer.setAudioChannelGain("tone1", 0);
    const silent = await ep(true, (s) => {
      epScene(s);
      dave(s, 9, 0);
      dave(s, 13, 0);
    });
    expect(frames(muted, 4)).toEqual(frames(silent, 4));
  });
});
