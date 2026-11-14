import { expect, it } from "vitest";

import { createSession, forEachProfile, type AudioSample, type NextTestSession } from "../../harness/zxnext";
import type { NextProfileId } from "@emu/machines/zxNext/nextProfiles";
import { ay } from "./_audio-helpers";

/*
 * The audio mixer on the ZX Spectrum Next (`dev/plans/AUDIO_MIXER_PLAN.md` §3.1, phase 2;
 * `zxnext-audio-channels.c`): 17 sources - the beeper, the MIC line (with the tape), TurboSound's nine
 * channels, the four DACs and the Pi I2S input. The gains change only what is heard: at unity not one
 * bit, muted to silence on every output, a muted source exactly as if it were silent, and never a byte
 * of the machine outside its volatile statics (which reverse debugging's keyframes compare). The taps
 * report each source before its gain.
 */

const RATE = 48_000;
const NR08 = 0x10 | 0x08 | 0x02; // --- internal speaker, DACs, TurboSound; ABC stereo
const TONE_ONLY = [0x3e, 0x3d, 0x3b];
/** Select value %1pp111cc for chip 0/1/2, both sides */
const select = (chip: number) => 0x9c | (3 << 5) | [3, 2, 1][chip];

const ALL_IDS = [
  "beeper",
  "mic",
  "ay1A",
  "ay1B",
  "ay1C",
  "ay2A",
  "ay2B",
  "ay2C",
  "ay3A",
  "ay3B",
  "ay3C",
  "dacA",
  "dacB",
  "dacC",
  "dacD",
  "piLeft",
  "piRight"
];

/* The beeper toggling EAR and MIC with DI, forever */
const BEEPER_LOOP = ` .org $8000
 di
Loop: ld a,$18
 out ($fe),a
 ld b,$30
D1: djnz D1
 ld a,$10
 out ($fe),a
 ld b,$20
D2: djnz D2
 xor a
 out ($fe),a
 ld b,$40
D3: djnz D3
 jr Loop`;

async function session(profile: NextProfileId) {
  const s = await createSession({ profile, audioSampleRate: RATE });
  await s.loadCode(BEEPER_LOOP);
  return s.setNextReg(0x06, 0x00).setNextReg(0x08, NR08);
}

function tone(s: NextTestSession, chip: number, channel: number, period: number, volume = 0x0f): NextTestSession {
  s.out(0xfffd, select(chip));
  ay(s, 2 * channel, period & 0xff);
  ay(s, 2 * channel + 1, period >> 8);
  ay(s, 8 + channel, volume);
  return ay(s, 7, TONE_ONLY[channel]);
}

/* Every kind of source at once: the beeper (running), a tone on each chip, DAC A and D */
function scene(s: NextTestSession): NextTestSession {
  tone(s, 0, 0, 0x120);
  tone(s, 1, 1, 0x0b0);
  tone(s, 2, 2, 0x300);
  return s.out(0x1f, 0xc0).out(0x5f, 0x30);
}

const record = (s: NextTestSession, frames = 3): AudioSample[] => s.startAudio().runFrames(frames).audio();

function tapColumns(s: NextTestSession): Record<string, number[]> {
  const m = s.audioMixer;
  const taps = m.getAudioChannelTaps();
  if (!taps) throw new Error("No taps");
  const columns: Record<string, number[]> = {};
  m.getAudioChannels().forEach((ch, c) => {
    columns[ch.id] = [];
    for (let i = 0; i < taps.sampleCount; i++) columns[ch.id].push(taps.samples[i * taps.channelCount + c]);
  });
  return columns;
}

const distinct = (values: number[]) => new Set(values).size;

forEachProfile(undefined, (profile) => {
  it("lists every sound source", async () => {
    const s = await session(profile);
    expect(s.audioMixer.getAudioChannels().map((c) => c.id)).toEqual(ALL_IDS);
  });

  it("plays the same audio, bit for bit, at unity gain with the taps on", async () => {
    const plain = scene(await session(profile));
    const touched = scene(await session(profile));
    for (const id of ALL_IDS) touched.audioMixer.setAudioChannelGain(id, 0.5);
    for (const id of ALL_IDS) touched.audioMixer.setAudioChannelGain(id, 1);
    touched.audioMixer.setAudioTapsEnabled(true);
    expect(record(touched)).toEqual(record(plain));
  });

  for (const output of ["jack", "speaker", "hdmi"] as const) {
    it(`is silent on the ${output} output with every source muted`, async () => {
      const s = scene(await session(profile)).audioOutput(output);
      for (const id of ALL_IDS) s.audioMixer.setAudioChannelGain(id, 0);
      const samples = record(s);
      expect(samples.length).toBeGreaterThan(0);
      expect(samples.every((x) => x.left === 0 && x.right === 0)).toBe(true);
    });
  }

  it("is silent on the speaker with the beeper diverted to it and muted", async () => {
    const s = scene(await session(profile)).audioOutput("speaker");
    s.setNextReg(0x06, 0x40);
    expect(record(s).some((x) => x.left !== 0)).toBe(true);
    s.audioMixer.setAudioChannelGain("beeper", 0);
    s.audioMixer.setAudioChannelGain("mic", 0);
    // --- The DC filter's tail of the last frame's beeper is gone after a frame
    expect(record(s, 2).slice(-200).every((x) => x.left === 0)).toBe(true);
  });

  it("plays a muted TurboSound channel exactly as a silent one", async () => {
    const muted = await session(profile);
    tone(muted, 0, 0, 0x120);
    tone(muted, 1, 0, 0x0b0);
    muted.audioMixer.setAudioChannelGain("ay1A", 0);
    const silent = await session(profile);
    tone(silent, 0, 0, 0x120, 0x00);
    tone(silent, 1, 0, 0x0b0);
    expect(record(muted)).toEqual(record(silent));
  });

  it("plays a muted DAC channel exactly as one at its centre", async () => {
    const muted = (await session(profile)).out(0x1f, 0xff).out(0x5f, 0x40);
    muted.audioMixer.setAudioChannelGain("dacA", 0);
    const centred = (await session(profile)).out(0x1f, 0x80).out(0x5f, 0x40);
    expect(record(muted)).toEqual(record(centred));
  });

  it("keeps every non-volatile byte the same whatever the gains and the taps", async () => {
    const plain = scene(await session(profile));
    const mixed = scene(await session(profile));
    plain.startAudio();
    mixed.startAudio();
    for (let frame = 0; frame < 6; frame++) {
      // --- Gains and the taps changing mid-run, as a user would between recording and a Step Back
      if (frame === 1) mixed.audioMixer.setAudioTapsEnabled(true);
      if (frame === 2) for (const id of ALL_IDS) mixed.audioMixer.setAudioChannelGain(id, 0.25);
      if (frame === 4) mixed.audioMixer.setAudioChannelGain("ay2B", 0);
      plain.runFrames(1);
      mixed.runFrames(1);
    }
    expect(mixed.memoryDifferences(plain)).toEqual([]);
    // --- ... while what is heard does differ
    expect(mixed.audio()).not.toEqual(plain.audio());
  });

  it("taps each source before its gain", async () => {
    const unity = scene(await session(profile));
    const muted = scene(await session(profile));
    for (const id of ALL_IDS) muted.audioMixer.setAudioChannelGain(id, 0);
    for (const s of [unity, muted]) {
      s.audioMixer.setAudioTapsEnabled(true);
      s.runFrames(2);
    }
    const taps = tapColumns(unity);
    expect(tapColumns(muted)).toEqual(taps);
    // --- The sources the scene plays move; the ones it leaves alone do not
    for (const id of ["beeper", "mic", "ay1A", "ay2B", "ay3C"]) expect(distinct(taps[id]), id).toBeGreaterThan(2);
    for (const id of ["ay1B", "ay2A", "ay3A", "dacB", "dacC", "piLeft", "piRight"]) {
      expect(distinct(taps[id]), id).toBe(1);
    }
    // --- A DAC tap is its level about the centre, in the jack's scale: ($C0 - $80) x 4 units
    expect(taps.dacA[0]).toBeCloseTo((Math.trunc(0x40 * 4 * 12.8)) / 32768, 4);
    expect(taps.dacD[0]).toBeCloseTo((Math.trunc((0x30 - 0x80) * 4 * 12.8)) / 32768, 4);
  });
});
