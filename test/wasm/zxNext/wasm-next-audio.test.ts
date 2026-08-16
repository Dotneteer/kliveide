import { describe, expect, it } from "vitest";

import {
  createTestZxNextWasmMachine,
  expectNormalizedSamples
} from "./wasm-next-test-helpers";

describe("ZX Spectrum Next WASM v2 audio", () => {
  it("resets DAC channels and audio-control diagnostics", async () => {
    const machine = await createTestZxNextWasmMachine();

    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      dacA: 0x80,
      dacB: 0x80,
      dacC: 0x80,
      dacD: 0x80,
      dacLeftLevel: 0x100,
      dacRightLevel: 0x100,
      audioBeepOnlyToInternalSpeaker: false,
      audioPsgMode: 0,
      audioEnableInternalSpeaker: true,
      audioEnable8BitDacs: true,
      audioEnableTurbosound: true
    });
  });

  it("owns DAC NextRegs and readback mirrors", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.writeNextReg(0x2c, 0x11);
    machine.writeNextReg(0x2d, 0x22);
    machine.writeNextReg(0x2e, 0x33);

    expect(machine.readNextReg(0x2c)).toBe(0x11);
    expect(machine.readNextReg(0x2d)).toBe(0x22);
    expect(machine.readNextReg(0x2e)).toBe(0x33);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      dacA: 0x22,
      dacB: 0x11,
      dacC: 0x33,
      dacD: 0x22,
      dacLeftLevel: 0x33,
      dacRightLevel: 0x55
    });
  });

  it("routes representative DAC port aliases through enabled port groups", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.writeNextReg(0x84, 0xff);
    machine.doWritePort(0x001f, 0x10);
    machine.doWritePort(0x000f, 0x20);
    machine.doWritePort(0x004f, 0x30);
    machine.doWritePort(0x005f, 0x40);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      dacA: 0x10,
      dacB: 0x20,
      dacC: 0x30,
      dacD: 0x40
    });

    machine.doWritePort(0x00df, 0x55);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      dacA: 0x55,
      dacD: 0x55
    });

    machine.doWritePort(0x00b3, 0x66);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      dacB: 0x66,
      dacC: 0x66
    });
  });

  it("honors DAC port-enable gating", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.writeNextReg(0x84, 0x00);
    machine.doWritePort(0x001f, 0x01);
    expect(machine.getWasmV2Diagnostics().dacA).toBe(0x80);

    machine.writeNextReg(0x84, 0x02);
    machine.doWritePort(0x001f, 0x7f);
    expect(machine.getWasmV2Diagnostics().dacA).toBe(0x7f);
  });

  it("owns representative TurboSound chip selection, AY data ports, and PSG mixer routing", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.writeNextReg(0x84, 0x01);
    machine.writeNextReg(0x08, 0x1a);
    machine.doWritePort(0xfffd, 0xde);
    machine.doWritePort(0xfffd, 0x08);
    machine.doWritePort(0xbffd, 0x0f);

    expect(machine.doReadPort(0xbffd)).toBe(0x0f);
    expect(machine.doReadPort(0xbff5)).toBe(0x88);
    expect(machine.wasmV2Runtime!.exports.zxnextGetPsgRegister(1, 8)).toBe(0x0f);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      psgSelectedChip: 1,
      psgSelectedRegister: 8,
      psgChip1Panning: 0x02,
      psgMixerLeft: 0xf000,
      psgMixerRight: 0x0000
    });

    const samples = machine.getAudioSamples();
    expectNormalizedSamples(samples);
    expect(samples[0].left).toBeGreaterThan(0.2);
    expect(samples[0].right).toBeLessThan(-0.2);
  });

  it("exposes normalized frame samples mixed from DAC and beeper state", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.writeNextReg(0x84, 0xff);
    machine.doWritePort(0x001f, 0xff);
    machine.doWritePort(0x000f, 0xff);
    const dacSamples = machine.getAudioSamples();

    expect(dacSamples).toHaveLength(960);
    expectNormalizedSamples(dacSamples);
    expect(dacSamples[0].left).toBeGreaterThan(0.15);
    expect(Math.abs(dacSamples[0].right)).toBeLessThan(0.01);

    machine.writeNextReg(0x2c, 0x80);
    machine.writeNextReg(0x2d, 0x80);
    machine.writeNextReg(0x2e, 0x80);
    machine.doWritePort(0x00fe, 0x10);
    const beeperSamples = machine.getAudioSamples();
    expectNormalizedSamples(beeperSamples);
    expect(beeperSamples[0].left).toBeGreaterThan(0.9);
    expect(beeperSamples[0].right).toBeGreaterThan(0.9);
  });

  it("applies audio NextReg gating for speaker-only beeper and DAC disable", async () => {
    const machine = await createTestZxNextWasmMachine();

    machine.writeNextReg(0x2d, 0xff);
    machine.writeNextReg(0x08, 0x12);
    expect(machine.getWasmV2Diagnostics()).toMatchObject({
      dacA: 0x80,
      dacD: 0x80,
      audioEnable8BitDacs: false
    });

    machine.doWritePort(0x00fe, 0x10);
    machine.writeNextReg(0x00, 0x40);
    const samples = machine.getAudioSamples();
    expectNormalizedSamples(samples);
    expect(Math.abs(samples[0].left)).toBeLessThan(0.01);
    expect(Math.abs(samples[0].right)).toBeLessThan(0.01);
  });
});
