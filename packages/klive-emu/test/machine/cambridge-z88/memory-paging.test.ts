import "mocha";
import * as expect from "expect";
import { CambridgeZ88Core } from "../../../src/renderer/machines/cz88/CambridgeZ88Core";
import { DefaultCambridgeZ88StateManager, loadWaModule, SilentAudioRenderer } from "../helpers";
import { setEngineDependencies } from "../../../src/renderer/machines/vm-engine-dependencies";

let machine: CambridgeZ88Core;

// --- Set up the virual machine engine service with the 
setEngineDependencies({
  waModuleLoader: (n) => loadWaModule(n),
  sampleRateGetter: () => 48000,
  audioRendererFactory: () => new SilentAudioRenderer(),
  cz88StateManager: new DefaultCambridgeZ88StateManager(),
})

describe("Cambridge Z88 - Memory paging", function () {
  before(async () => {
    machine = new CambridgeZ88Core({
      baseClockFrequency: 3_276_800,
      tactsInFrame: 16384,
      firmware: [new Uint8Array(32768)]
    });
    await machine.setupMachine();
  });

  beforeEach(async () => {
    await machine.setupMachine();
  });

  it("SR register after init", async () => {
    await machine.setupMachine();
    machine.api.setZ88ChipMask(0, 0x1f); // Slot 0 ROM 512K
    machine.api.setZ88ChipMask(1, 0x1f); // Slot 1 RAM 512K
    machine.api.setZ88ChipMask(2, 0x3f); // Slot 2 RAM 1M
    machine.api.setZ88ChipMask(3, 0x3f); // Slot 3 RAM 1M
    machine.api.setZ88ChipMask(4, 0x3f); // Slot 4 RAM 1M

    const s = machine.getMachineState();

    expect(s.chipMask0).toBe(0x1f);
    expect(s.chipMask1).toBe(0x1f);
    expect(s.chipMask2).toBe(0x3f);
    expect(s.chipMask3).toBe(0x3f);
    expect(s.chipMask4).toBe(0x3f);

    expect(s.s0OffsetL).toBe(0x00_0000);
    expect(s.s0FlagL).toBe(1);
    expect(s.s0OffsetH).toBe(0x00_0000);
    expect(s.s0FlagH).toBe(1);
    expect(s.s1OffsetL).toBe(0x00_0000);
    expect(s.s1FlagL).toBe(1);
    expect(s.s1OffsetH).toBe(0x00_2000);
    expect(s.s1FlagH).toBe(1);
    expect(s.s2OffsetL).toBe(0x00_0000);
    expect(s.s2FlagL).toBe(1);
    expect(s.s2OffsetH).toBe(0x00_2000);
    expect(s.s2FlagH).toBe(1);
    expect(s.s3OffsetL).toBe(0x00_0000);
    expect(s.s3FlagL).toBe(1);
    expect(s.s3OffsetH).toBe(0x00_2000);
    expect(s.s3FlagH).toBe(1);
  });

  const memConfigPatterns = [
    // (128K, 512K, 1M, 1M, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (256K, 512K, 1M, 1M, 1M: RAM)
    { c0: 0x0f, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (512K, 512K, 1M, 1M, 1M: RAM)
    { c0: 0x1f, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (128K, 32K, 1M, 1M, 1M: RAM)
    { c0: 0x07, c1: 0x01, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (128K, 64K, 1M, 1M, 1M: RAM)
    { c0: 0x07, c1: 0x03, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (128K, 128K, 1M, 1M, 1M: RAM)
    { c0: 0x07, c1: 0x07, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (128K, 256K, 1M, 1M, 1M: RAM)
    { c0: 0x07, c1: 0x0f, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (512K, 32K, 1M, 1M, 1M: RAM)
    { c0: 0x1f, c1: 0x01, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (512K, 64K, 1M, 1M, 1M: RAM)
    { c0: 0x1f, c1: 0x03, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (512K, 128K, 1M, 1M, 1M: RAM)
    { c0: 0x1f, c1: 0x07, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (512K, 256K, 1M, 1M, 1M: RAM)
    { c0: 0x1f, c1: 0x0f, c2: 0x3f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 32K, 1M, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x01, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 64K, 1M, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x03, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 128K, 1M, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x07, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 256K, 1M, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x0f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 512K, 1M, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x1f, c3: 0x3f, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 1M, 32K, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x01, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 1M, 64K, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x03, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 1M, 128K, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x07, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 1M, 256K, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x0f, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 1M, 512K, 1M: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x1f, c4: 0x3f, c3Rom: false },

    // (128K, 512K, 1M, 1M, 32K: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x01, c3Rom: false },

    // (128K, 512K, 1M, 1M, 64K: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x03, c3Rom: false },

    // (128K, 512K, 1M, 1M, 128K: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x07, c3Rom: false },

    // (128K, 512K, 1M, 1M, 256K: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x0f, c3Rom: false },

    // (128K, 512K, 1M, 1M, 512K: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x1f, c3Rom: false },

    // (128K, 512K, 1M, 1M, 32K: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x01, c3Rom: true },

    // (128K, 512K, 1M, 1M, 64K: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x03, c3Rom: true },

    // (128K, 512K, 1M, 1M, 128K: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x07, c3Rom: true },

    // (128K, 512K, 1M, 1M, 256K: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x0f, c3Rom: true },

    // (128K, 512K, 1M, 1M, 512K: RAM)
    { c0: 0x07, c1: 0x1f, c2: 0x3f, c3: 0x3f, c4: 0x1f, c3Rom: true },
  ];

  memConfigPatterns.forEach((pat) => {
    it(`Set SR0 (${pat.c0}/${pat.c1}/${pat.c2}/${pat.c3}/${pat.c4}) ${
      pat.c3Rom ? "c3: ROM" : ""
    }`, () => {
      machine.reset();
      machine.api.setZ88ChipMask(0, pat.c0); // Chip 0 ROM 128K
      machine.api.setZ88ChipMask(1, pat.c1); // Chip 1 RAM 512K
      machine.api.setZ88ChipMask(2, pat.c2); // Chip 2 RAM 1M
      machine.api.setZ88ChipMask(3, pat.c3); // Chip 3 RAM 1M
      machine.api.setZ88ChipMask(4, pat.c4); // Chip 4 RAM 1M
      machine.api.setZ88Card3Rom(pat.c3Rom); // Is Chip 4 ROM?

      const s = machine.getMachineState();

      expect(s.chipMask0).toBe(pat.c0);
      expect(s.chipMask1).toBe(pat.c1);
      expect(s.chipMask2).toBe(pat.c2);
      expect(s.chipMask3).toBe(pat.c3);
      expect(s.chipMask4).toBe(pat.c4);

      for (let bank = 0x00; bank < 0x20; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & pat.c0);
        machine.api.writePortCz88(0xd0, bank);

        const s = machine.getMachineState();
        expect(s.s0OffsetL).toBe(0x00_0000);
        expect(s.s0FlagL).toBe(1);
        expect(s.s0OffsetH).toBe(
          (maskedBank & 0xfe) * 0x4000 + (maskedBank & 0x01 ? 0x2000 : 0x0000)
        );
        expect(s.s0FlagH).toBe(1);
        expect(s.s1OffsetL).toBe(0x00_0000);
        expect(s.s1FlagL).toBe(1);
        expect(s.s1OffsetH).toBe(0x00_2000);
        expect(s.s1FlagH).toBe(1);
        expect(s.s2OffsetL).toBe(0x00_0000);
        expect(s.s2FlagL).toBe(1);
        expect(s.s2OffsetH).toBe(0x00_2000);
        expect(s.s2FlagH).toBe(1);
        expect(s.s3OffsetL).toBe(0x00_0000);
        expect(s.s3FlagL).toBe(1);
        expect(s.s3OffsetH).toBe(0x00_2000);
        expect(s.s3FlagH).toBe(1);
      }

      for (let bank = 0x20; bank < 0x40; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & pat.c1);
        machine.api.writePortCz88(0xd0, bank);

        const s = machine.getMachineState();

        expect(s.s0OffsetL).toBe(0x00_0000);
        expect(s.s0FlagL).toBe(1);
        expect(s.s0OffsetH).toBe(
          (maskedBank & 0xfe) * 0x4000 + (maskedBank & 0x01 ? 0x2000 : 0x0000)
        );
        expect(s.s0FlagH).toBe(0);
        expect(s.s1OffsetL).toBe(0x00_0000);
        expect(s.s1FlagL).toBe(1);
        expect(s.s1OffsetH).toBe(0x00_2000);
        expect(s.s1FlagH).toBe(1);
        expect(s.s2OffsetL).toBe(0x00_0000);
        expect(s.s2FlagL).toBe(1);
        expect(s.s2OffsetH).toBe(0x00_2000);
        expect(s.s2FlagH).toBe(1);
        expect(s.s3OffsetL).toBe(0x00_0000);
        expect(s.s3FlagL).toBe(1);
        expect(s.s3OffsetH).toBe(0x00_2000);
        expect(s.s3FlagH).toBe(1);
      }

      for (let bank = 0x40; bank < 0x80; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c2);
        machine.api.writePortCz88(0xd0, bank);

        const s = machine.getMachineState();

        expect(s.s0OffsetL).toBe(0x00_0000);
        expect(s.s0FlagL).toBe(1);
        expect(s.s0OffsetH).toBe(
          (maskedBank & 0xfe) * 0x4000 + (maskedBank & 0x01 ? 0x2000 : 0x0000)
        );
        expect(s.s0FlagH).toBe(0);
        expect(s.s1OffsetL).toBe(0x00_0000);
        expect(s.s1FlagL).toBe(1);
        expect(s.s1OffsetH).toBe(0x00_2000);
        expect(s.s1FlagH).toBe(1);
        expect(s.s2OffsetL).toBe(0x00_0000);
        expect(s.s2FlagL).toBe(1);
        expect(s.s2OffsetH).toBe(0x00_2000);
        expect(s.s2FlagH).toBe(1);
        expect(s.s3OffsetL).toBe(0x00_0000);
        expect(s.s3FlagL).toBe(1);
        expect(s.s3OffsetH).toBe(0x00_2000);
        expect(s.s3FlagH).toBe(1);
      }

      for (let bank = 0x80; bank < 0xc0; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c3);
        machine.api.writePortCz88(0xd0, bank);

        const s = machine.getMachineState();

        expect(s.s0OffsetL).toBe(0x00_0000);
        expect(s.s0FlagL).toBe(1);
        expect(s.s0OffsetH).toBe(
          (maskedBank & 0xfe) * 0x4000 + (maskedBank & 0x01 ? 0x2000 : 0x0000)
        );
        expect(s.s0FlagH).toBe(0);
        expect(s.s1OffsetL).toBe(0x00_0000);
        expect(s.s1FlagL).toBe(1);
        expect(s.s1OffsetH).toBe(0x00_2000);
        expect(s.s1FlagH).toBe(1);
        expect(s.s2OffsetL).toBe(0x00_0000);
        expect(s.s2FlagL).toBe(1);
        expect(s.s2OffsetH).toBe(0x00_2000);
        expect(s.s2FlagH).toBe(1);
        expect(s.s3OffsetL).toBe(0x00_0000);
        expect(s.s3FlagL).toBe(1);
        expect(s.s3OffsetH).toBe(0x00_2000);
        expect(s.s3FlagH).toBe(1);
      }

      for (let bank = 0xc0; bank < 0x100; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c4);
        machine.api.writePortCz88(0xd0, bank);

        const s = machine.getMachineState();

        expect(s.s0OffsetL).toBe(0x00_0000);
        expect(s.s0FlagL).toBe(1);
        expect(s.s0OffsetH).toBe(
          (maskedBank & 0xfe) * 0x4000 + (maskedBank & 0x01 ? 0x2000 : 0x0000)
        );
        expect(s.s0FlagH).toBe(pat.c3Rom ? 1 : 0);
        expect(s.s1OffsetL).toBe(0x00_0000);
        expect(s.s1FlagL).toBe(1);
        expect(s.s1OffsetH).toBe(0x00_2000);
        expect(s.s1FlagH).toBe(1);
        expect(s.s2OffsetL).toBe(0x00_0000);
        expect(s.s2FlagL).toBe(1);
        expect(s.s2OffsetH).toBe(0x00_2000);
        expect(s.s2FlagH).toBe(1);
        expect(s.s3OffsetL).toBe(0x00_0000);
        expect(s.s3FlagL).toBe(1);
        expect(s.s3OffsetH).toBe(0x00_2000);
        expect(s.s3FlagH).toBe(1);
      }
    });
  });

  memConfigPatterns.forEach((pat) => {
    it(`Set SR1 (${pat.c0}/${pat.c1}/${pat.c2}/${pat.c3}/${pat.c4}) ${
      pat.c3Rom ? "c3: ROM" : ""
    }`, () => {
      machine.reset();
      machine.api.setZ88ChipMask(0, pat.c0); // Chip 0 ROM 128K
      machine.api.setZ88ChipMask(1, pat.c1); // Chip 1 RAM 512K
      machine.api.setZ88ChipMask(2, pat.c2); // Chip 2 RAM 1M
      machine.api.setZ88ChipMask(3, pat.c3); // Chip 3 RAM 1M
      machine.api.setZ88ChipMask(4, pat.c4); // Chip 4 RAM 1M
      machine.api.setZ88Card3Rom(pat.c3Rom); // Is Chip 4 ROM?

      const s = machine.getMachineState();

      expect(s.chipMask0).toBe(pat.c0);
      expect(s.chipMask1).toBe(pat.c1);
      expect(s.chipMask2).toBe(pat.c2);
      expect(s.chipMask3).toBe(pat.c3);
      expect(s.chipMask4).toBe(pat.c4);

      for (let bank = 0x00; bank < 0x20; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & pat.c0);
        machine.api.writePortCz88(0xd1, bank);

        const s = machine.getMachineState();
        expect(s.s0OffsetL).toBe(0x00_0000);
        expect(s.s0FlagL).toBe(1);
        expect(s.s0OffsetH).toBe(0x00_0000);
        expect(s.s0FlagH).toBe(1);
        expect(s.s1OffsetL).toBe(maskedBank * 0x4000);
        expect(s.s1FlagL).toBe(1);
        expect(s.s1OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(s.s1FlagH).toBe(1);
        expect(s.s2OffsetL).toBe(0x00_0000);
        expect(s.s2FlagL).toBe(1);
        expect(s.s2OffsetH).toBe(0x00_2000);
        expect(s.s2FlagH).toBe(1);
        expect(s.s3OffsetL).toBe(0x00_0000);
        expect(s.s3FlagL).toBe(1);
        expect(s.s3OffsetH).toBe(0x00_2000);
        expect(s.s3FlagH).toBe(1);
      }

      for (let bank = 0x20; bank < 0x40; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & pat.c1);
        machine.api.writePortCz88(0xd1, bank);

        const s = machine.getMachineState();

        expect(s.s0OffsetL).toBe(0x00_0000);
        expect(s.s0FlagL).toBe(1);
        expect(s.s0OffsetH).toBe(0x00_0000);
        expect(s.s0FlagH).toBe(1);
        expect(s.s1OffsetL).toBe(maskedBank * 0x4000);
        expect(s.s1FlagL).toBe(0);
        expect(s.s1OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(s.s1FlagH).toBe(0);
        expect(s.s2OffsetL).toBe(0x00_0000);
        expect(s.s2FlagL).toBe(1);
        expect(s.s2OffsetH).toBe(0x00_2000);
        expect(s.s2FlagH).toBe(1);
        expect(s.s3OffsetL).toBe(0x00_0000);
        expect(s.s3FlagL).toBe(1);
        expect(s.s3OffsetH).toBe(0x00_2000);
        expect(s.s3FlagH).toBe(1);
      }

      for (let bank = 0x40; bank < 0x80; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c2);
        machine.api.writePortCz88(0xd1, bank);

        const s = machine.getMachineState();

        expect(s.s0OffsetL).toBe(0x00_0000);
        expect(s.s0FlagL).toBe(1);
        expect(s.s0OffsetH).toBe(0x00_0000);
        expect(s.s0FlagH).toBe(1);
        expect(s.s1OffsetL).toBe(maskedBank * 0x4000);
        expect(s.s1FlagL).toBe(0);
        expect(s.s1OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(s.s1FlagH).toBe(0);
        expect(s.s2OffsetL).toBe(0x00_0000);
        expect(s.s2FlagL).toBe(1);
        expect(s.s2OffsetH).toBe(0x00_2000);
        expect(s.s2FlagH).toBe(1);
        expect(s.s3OffsetL).toBe(0x00_0000);
        expect(s.s3FlagL).toBe(1);
        expect(s.s3OffsetH).toBe(0x00_2000);
        expect(s.s3FlagH).toBe(1);
      }

      for (let bank = 0x80; bank < 0xc0; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c3);
        machine.api.writePortCz88(0xd1, bank);

        const s = machine.getMachineState();

        expect(s.s0OffsetL).toBe(0x00_0000);
        expect(s.s0FlagL).toBe(1);
        expect(s.s0OffsetH).toBe(0x00_0000);
        expect(s.s0FlagH).toBe(1);
        expect(s.s1OffsetL).toBe(maskedBank * 0x4000);
        expect(s.s1FlagL).toBe(0);
        expect(s.s1OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(s.s1FlagH).toBe(0);
        expect(s.s2OffsetL).toBe(0x00_0000);
        expect(s.s2FlagL).toBe(1);
        expect(s.s2OffsetH).toBe(0x00_2000);
        expect(s.s2FlagH).toBe(1);
        expect(s.s3OffsetL).toBe(0x00_0000);
        expect(s.s3FlagL).toBe(1);
        expect(s.s3OffsetH).toBe(0x00_2000);
        expect(s.s3FlagH).toBe(1);
      }

      for (let bank = 0xc0; bank < 0x100; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c4);
        machine.api.writePortCz88(0xd1, bank);

        const s = machine.getMachineState();

        expect(s.s0OffsetL).toBe(0x00_0000);
        expect(s.s0FlagL).toBe(1);
        expect(s.s0OffsetH).toBe(0x00_0000);
        expect(s.s0FlagH).toBe(1);
        expect(s.s1OffsetL).toBe(maskedBank * 0x4000);
        expect(s.s1FlagL).toBe(pat.c3Rom ? 1 : 0);
        expect(s.s1OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(s.s1FlagH).toBe(pat.c3Rom ? 1 : 0);
        expect(s.s2OffsetL).toBe(0x00_0000);
        expect(s.s2FlagL).toBe(1);
        expect(s.s2OffsetH).toBe(0x00_2000);
        expect(s.s2FlagH).toBe(1);
        expect(s.s3OffsetL).toBe(0x00_0000);
        expect(s.s3FlagL).toBe(1);
        expect(s.s3OffsetH).toBe(0x00_2000);
        expect(s.s3FlagH).toBe(1);
      }
    });
  });

  memConfigPatterns.forEach((pat) => {
    it(`Set SR2 (${pat.c0}/${pat.c1}/${pat.c2}/${pat.c3}/${pat.c4}) ${
      pat.c3Rom ? "c3: ROM" : ""
    }`, () => {
      machine.reset();
      machine.api.setZ88ChipMask(0, pat.c0); // Chip 0 ROM 128K
      machine.api.setZ88ChipMask(1, pat.c1); // Chip 1 RAM 512K
      machine.api.setZ88ChipMask(2, pat.c2); // Chip 2 RAM 1M
      machine.api.setZ88ChipMask(3, pat.c3); // Chip 3 RAM 1M
      machine.api.setZ88ChipMask(4, pat.c4); // Chip 4 RAM 1M
      machine.api.setZ88Card3Rom(pat.c3Rom); // Is Chip 4 ROM?

      const s = machine.getMachineState();

      expect(s.chipMask0).toBe(pat.c0);
      expect(s.chipMask1).toBe(pat.c1);
      expect(s.chipMask2).toBe(pat.c2);
      expect(s.chipMask3).toBe(pat.c3);
      expect(s.chipMask4).toBe(pat.c4);

      for (let bank = 0x00; bank < 0x20; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & pat.c0);
        machine.api.writePortCz88(0xd2, bank);

        const s = machine.getMachineState();
        expect(s.s0OffsetL).toBe(0x00_0000);
        expect(s.s0FlagL).toBe(1);
        expect(s.s0OffsetH).toBe(0x00_0000);
        expect(s.s0FlagH).toBe(1);
        expect(s.s1OffsetL).toBe(0x00_0000);
        expect(s.s1FlagL).toBe(1);
        expect(s.s1OffsetH).toBe(0x00_2000);
        expect(s.s1FlagH).toBe(1);
        expect(s.s2OffsetL).toBe(maskedBank * 0x4000);
        expect(s.s2FlagL).toBe(1);
        expect(s.s2OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(s.s2FlagH).toBe(1);
        expect(s.s3OffsetL).toBe(0x00_0000);
        expect(s.s3FlagL).toBe(1);
        expect(s.s3OffsetH).toBe(0x00_2000);
        expect(s.s3FlagH).toBe(1);
      }

      for (let bank = 0x20; bank < 0x40; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & pat.c1);
        machine.api.writePortCz88(0xd2, bank);

        const s = machine.getMachineState();

        expect(s.s0OffsetL).toBe(0x00_0000);
        expect(s.s0FlagL).toBe(1);
        expect(s.s0OffsetH).toBe(0x00_0000);
        expect(s.s0FlagH).toBe(1);
        expect(s.s1OffsetL).toBe(0x00_0000);
        expect(s.s1FlagL).toBe(1);
        expect(s.s1OffsetH).toBe(0x00_2000);
        expect(s.s1FlagH).toBe(1);
        expect(s.s2OffsetL).toBe(maskedBank * 0x4000);
        expect(s.s2FlagL).toBe(0);
        expect(s.s2OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(s.s2FlagH).toBe(0);
        expect(s.s3OffsetL).toBe(0x00_0000);
        expect(s.s3FlagL).toBe(1);
        expect(s.s3OffsetH).toBe(0x00_2000);
        expect(s.s3FlagH).toBe(1);
      }

      for (let bank = 0x40; bank < 0x80; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c2);
        machine.api.writePortCz88(0xd2, bank);

        const s = machine.getMachineState();

        expect(s.s0OffsetL).toBe(0x00_0000);
        expect(s.s0FlagL).toBe(1);
        expect(s.s0OffsetH).toBe(0x00_0000);
        expect(s.s0FlagH).toBe(1);
        expect(s.s1OffsetL).toBe(0x00_0000);
        expect(s.s1FlagL).toBe(1);
        expect(s.s1OffsetH).toBe(0x00_2000);
        expect(s.s1FlagH).toBe(1);
        expect(s.s2OffsetL).toBe(maskedBank * 0x4000);
        expect(s.s2FlagL).toBe(0);
        expect(s.s2OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(s.s2FlagH).toBe(0);
        expect(s.s3OffsetL).toBe(0x00_0000);
        expect(s.s3FlagL).toBe(1);
        expect(s.s3OffsetH).toBe(0x00_2000);
        expect(s.s3FlagH).toBe(1);
      }

      for (let bank = 0x80; bank < 0xc0; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c3);
        machine.api.writePortCz88(0xd2, bank);

        const s = machine.getMachineState();

        expect(s.s0OffsetL).toBe(0x00_0000);
        expect(s.s0FlagL).toBe(1);
        expect(s.s0OffsetH).toBe(0x00_0000);
        expect(s.s0FlagH).toBe(1);
        expect(s.s1OffsetL).toBe(0x00_0000);
        expect(s.s1FlagL).toBe(1);
        expect(s.s1OffsetH).toBe(0x00_2000);
        expect(s.s1FlagH).toBe(1);
        expect(s.s2OffsetL).toBe(maskedBank * 0x4000);
        expect(s.s2FlagL).toBe(0);
        expect(s.s2OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(s.s2FlagH).toBe(0);
        expect(s.s3OffsetL).toBe(0x00_0000);
        expect(s.s3FlagL).toBe(1);
        expect(s.s3OffsetH).toBe(0x00_2000);
        expect(s.s3FlagH).toBe(1);
      }

      for (let bank = 0xc0; bank < 0x100; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c4);
        machine.api.writePortCz88(0xd2, bank);

        const s = machine.getMachineState();

        expect(s.s0OffsetL).toBe(0x00_0000);
        expect(s.s0FlagL).toBe(1);
        expect(s.s0OffsetH).toBe(0x00_0000);
        expect(s.s0FlagH).toBe(1);
        expect(s.s1OffsetL).toBe(0x00_0000);
        expect(s.s1FlagL).toBe(1);
        expect(s.s1OffsetH).toBe(0x00_2000);
        expect(s.s1FlagH).toBe(1);
        expect(s.s2OffsetL).toBe(maskedBank * 0x4000);
        expect(s.s2FlagL).toBe(pat.c3Rom ? 1 : 0);
        expect(s.s2OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(s.s2FlagH).toBe(pat.c3Rom ? 1 : 0);
        expect(s.s3OffsetL).toBe(0x00_0000);
        expect(s.s3FlagL).toBe(1);
        expect(s.s3OffsetH).toBe(0x00_2000);
        expect(s.s3FlagH).toBe(1);
      }
    });
  });

  memConfigPatterns.forEach((pat) => {
    it(`Set SR3 (${pat.c0}/${pat.c1}/${pat.c2}/${pat.c3}/${pat.c4}) ${
      pat.c3Rom ? "c3: ROM" : ""
    }`, () => {
      machine.reset();
      machine.api.setZ88ChipMask(0, pat.c0); // Chip 0 ROM 128K
      machine.api.setZ88ChipMask(1, pat.c1); // Chip 1 RAM 512K
      machine.api.setZ88ChipMask(2, pat.c2); // Chip 2 RAM 1M
      machine.api.setZ88ChipMask(3, pat.c3); // Chip 3 RAM 1M
      machine.api.setZ88ChipMask(4, pat.c4); // Chip 4 RAM 1M
      machine.api.setZ88Card3Rom(pat.c3Rom); // Is Chip 4 ROM?

      const s = machine.getMachineState();

      expect(s.chipMask0).toBe(pat.c0);
      expect(s.chipMask1).toBe(pat.c1);
      expect(s.chipMask2).toBe(pat.c2);
      expect(s.chipMask3).toBe(pat.c3);
      expect(s.chipMask4).toBe(pat.c4);

      for (let bank = 0x00; bank < 0x20; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & pat.c0);
        machine.api.writePortCz88(0xd3, bank);

        const s = machine.getMachineState();
        expect(s.s0OffsetL).toBe(0x00_0000);
        expect(s.s0FlagL).toBe(1);
        expect(s.s0OffsetH).toBe(0x00_0000);
        expect(s.s0FlagH).toBe(1);
        expect(s.s1OffsetL).toBe(0x00_0000);
        expect(s.s1FlagL).toBe(1);
        expect(s.s1OffsetH).toBe(0x00_2000);
        expect(s.s1FlagH).toBe(1);
        expect(s.s2OffsetL).toBe(0x00_0000);
        expect(s.s2FlagL).toBe(1);
        expect(s.s2OffsetH).toBe(0x00_2000);
        expect(s.s2FlagH).toBe(1);
        expect(s.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(s.s3FlagL).toBe(1);
        expect(s.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(s.s3FlagH).toBe(1);
      }

      for (let bank = 0x20; bank < 0x40; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & pat.c1);
        machine.api.writePortCz88(0xd3, bank);

        const s = machine.getMachineState();

        expect(s.s0OffsetL).toBe(0x00_0000);
        expect(s.s0FlagL).toBe(1);
        expect(s.s0OffsetH).toBe(0x00_0000);
        expect(s.s0FlagH).toBe(1);
        expect(s.s1OffsetL).toBe(0x00_0000);
        expect(s.s1FlagL).toBe(1);
        expect(s.s1OffsetH).toBe(0x00_2000);
        expect(s.s1FlagH).toBe(1);
        expect(s.s2OffsetL).toBe(0x00_0000);
        expect(s.s2FlagL).toBe(1);
        expect(s.s2OffsetH).toBe(0x00_2000);
        expect(s.s2FlagH).toBe(1);
        expect(s.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(s.s3FlagL).toBe(0);
        expect(s.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(s.s3FlagH).toBe(0);
      }

      for (let bank = 0x40; bank < 0x80; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c2);
        machine.api.writePortCz88(0xd3, bank);

        const s = machine.getMachineState();

        expect(s.s0OffsetL).toBe(0x00_0000);
        expect(s.s0FlagL).toBe(1);
        expect(s.s0OffsetH).toBe(0x00_0000);
        expect(s.s0FlagH).toBe(1);
        expect(s.s1OffsetL).toBe(0x00_0000);
        expect(s.s1FlagL).toBe(1);
        expect(s.s1OffsetH).toBe(0x00_2000);
        expect(s.s1FlagH).toBe(1);
        expect(s.s2OffsetL).toBe(0x00_0000);
        expect(s.s2FlagL).toBe(1);
        expect(s.s2OffsetH).toBe(0x00_2000);
        expect(s.s2FlagH).toBe(1);
        expect(s.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(s.s3FlagL).toBe(0);
        expect(s.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(s.s3FlagH).toBe(0);
      }

      for (let bank = 0x80; bank < 0xc0; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c3);
        machine.api.writePortCz88(0xd3, bank);

        const s = machine.getMachineState();

        expect(s.s0OffsetL).toBe(0x00_0000);
        expect(s.s0FlagL).toBe(1);
        expect(s.s0OffsetH).toBe(0x00_0000);
        expect(s.s0FlagH).toBe(1);
        expect(s.s1OffsetL).toBe(0x00_0000);
        expect(s.s1FlagL).toBe(1);
        expect(s.s1OffsetH).toBe(0x00_2000);
        expect(s.s1FlagH).toBe(1);
        expect(s.s2OffsetL).toBe(0x00_0000);
        expect(s.s2FlagL).toBe(1);
        expect(s.s2OffsetH).toBe(0x00_2000);
        expect(s.s2FlagH).toBe(1);
        expect(s.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(s.s3FlagL).toBe(0);
        expect(s.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(s.s3FlagH).toBe(0);
      }

      for (let bank = 0xc0; bank < 0x100; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c4);
        machine.api.writePortCz88(0xd3, bank);

        const s = machine.getMachineState();

        expect(s.s0OffsetL).toBe(0x00_0000);
        expect(s.s0FlagL).toBe(1);
        expect(s.s0OffsetH).toBe(0x00_0000);
        expect(s.s0FlagH).toBe(1);
        expect(s.s1OffsetL).toBe(0x00_0000);
        expect(s.s1FlagL).toBe(1);
        expect(s.s1OffsetH).toBe(0x00_2000);
        expect(s.s1FlagH).toBe(1);
        expect(s.s2OffsetL).toBe(0x00_0000);
        expect(s.s2FlagL).toBe(1);
        expect(s.s2OffsetH).toBe(0x00_2000);
        expect(s.s2FlagH).toBe(1);
        expect(s.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(s.s3FlagL).toBe(pat.c3Rom ? 1 : 0);
        expect(s.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(s.s3FlagH).toBe(pat.c3Rom ? 1 : 0);
      }
    });
  });

  memConfigPatterns.forEach((pat) => {
    it(`Set SR3 with RAMS (${pat.c0}/${pat.c1}/${pat.c2}/${pat.c3}/${pat.c4}) ${
      pat.c3Rom ? "c3: ROM" : ""
    }`, () => {
      machine.reset();
      machine.api.setZ88ChipMask(0, pat.c0); // Chip 0 ROM 128K
      machine.api.setZ88ChipMask(1, pat.c1); // Chip 1 RAM 512K
      machine.api.setZ88ChipMask(2, pat.c2); // Chip 2 RAM 1M
      machine.api.setZ88ChipMask(3, pat.c3); // Chip 3 RAM 1M
      machine.api.setZ88ChipMask(4, pat.c4); // Chip 4 RAM 1M
      machine.api.setZ88Card3Rom(pat.c3Rom); // Is Chip 4 ROM?
      machine.api.writePortCz88(0xb0, 0x04); // Set COM.RAMS

      const s = machine.getMachineState();

      expect(s.chipMask0).toBe(pat.c0);
      expect(s.chipMask1).toBe(pat.c1);
      expect(s.chipMask2).toBe(pat.c2);
      expect(s.chipMask3).toBe(pat.c3);
      expect(s.chipMask4).toBe(pat.c4);

      for (let bank = 0x00; bank < 0x20; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & pat.c0);
        machine.api.writePortCz88(0xd3, bank);

        const s = machine.getMachineState();
        expect(s.s0OffsetL).toBe(0x08_0000);
        expect(s.s0FlagL).toBe(0);
        expect(s.s0OffsetH).toBe(0x00_0000);
        expect(s.s0FlagH).toBe(1);
        expect(s.s1OffsetL).toBe(0x00_0000);
        expect(s.s1FlagL).toBe(1);
        expect(s.s1OffsetH).toBe(0x00_2000);
        expect(s.s1FlagH).toBe(1);
        expect(s.s2OffsetL).toBe(0x00_0000);
        expect(s.s2FlagL).toBe(1);
        expect(s.s2OffsetH).toBe(0x00_2000);
        expect(s.s2FlagH).toBe(1);
        expect(s.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(s.s3FlagL).toBe(1);
        expect(s.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(s.s3FlagH).toBe(1);
      }

      for (let bank = 0x20; bank < 0x40; bank++) {
        const maskedBank = (bank & 0xe0) | (bank & pat.c1);
        machine.api.writePortCz88(0xd3, bank);

        const s = machine.getMachineState();

        expect(s.s0OffsetL).toBe(0x08_0000);
        expect(s.s0FlagL).toBe(0);
        expect(s.s0OffsetH).toBe(0x00_0000);
        expect(s.s0FlagH).toBe(1);
        expect(s.s1OffsetL).toBe(0x00_0000);
        expect(s.s1FlagL).toBe(1);
        expect(s.s1OffsetH).toBe(0x00_2000);
        expect(s.s1FlagH).toBe(1);
        expect(s.s2OffsetL).toBe(0x00_0000);
        expect(s.s2FlagL).toBe(1);
        expect(s.s2OffsetH).toBe(0x00_2000);
        expect(s.s2FlagH).toBe(1);
        expect(s.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(s.s3FlagL).toBe(0);
        expect(s.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(s.s3FlagH).toBe(0);
      }

      for (let bank = 0x40; bank < 0x80; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c2);
        machine.api.writePortCz88(0xd3, bank);

        const s = machine.getMachineState();

        expect(s.s0OffsetL).toBe(0x08_0000);
        expect(s.s0FlagL).toBe(0);
        expect(s.s0OffsetH).toBe(0x00_0000);
        expect(s.s0FlagH).toBe(1);
        expect(s.s1OffsetL).toBe(0x00_0000);
        expect(s.s1FlagL).toBe(1);
        expect(s.s1OffsetH).toBe(0x00_2000);
        expect(s.s1FlagH).toBe(1);
        expect(s.s2OffsetL).toBe(0x00_0000);
        expect(s.s2FlagL).toBe(1);
        expect(s.s2OffsetH).toBe(0x00_2000);
        expect(s.s2FlagH).toBe(1);
        expect(s.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(s.s3FlagL).toBe(0);
        expect(s.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(s.s3FlagH).toBe(0);
      }

      for (let bank = 0x80; bank < 0xc0; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c3);
        machine.api.writePortCz88(0xd3, bank);

        const s = machine.getMachineState();

        expect(s.s0OffsetL).toBe(0x08_0000);
        expect(s.s0FlagL).toBe(0);
        expect(s.s0OffsetH).toBe(0x00_0000);
        expect(s.s0FlagH).toBe(1);
        expect(s.s1OffsetL).toBe(0x00_0000);
        expect(s.s1FlagL).toBe(1);
        expect(s.s1OffsetH).toBe(0x00_2000);
        expect(s.s1FlagH).toBe(1);
        expect(s.s2OffsetL).toBe(0x00_0000);
        expect(s.s2FlagL).toBe(1);
        expect(s.s2OffsetH).toBe(0x00_2000);
        expect(s.s2FlagH).toBe(1);
        expect(s.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(s.s3FlagL).toBe(0);
        expect(s.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(s.s3FlagH).toBe(0);
      }

      for (let bank = 0xc0; bank < 0x100; bank++) {
        const maskedBank = (bank & 0xc0) | (bank & pat.c4);
        machine.api.writePortCz88(0xd3, bank);

        const s = machine.getMachineState();

        expect(s.s0OffsetL).toBe(0x08_0000);
        expect(s.s0FlagL).toBe(0);
        expect(s.s0OffsetH).toBe(0x00_0000);
        expect(s.s0FlagH).toBe(1);
        expect(s.s1OffsetL).toBe(0x00_0000);
        expect(s.s1FlagL).toBe(1);
        expect(s.s1OffsetH).toBe(0x00_2000);
        expect(s.s1FlagH).toBe(1);
        expect(s.s2OffsetL).toBe(0x00_0000);
        expect(s.s2FlagL).toBe(1);
        expect(s.s2OffsetH).toBe(0x00_2000);
        expect(s.s2FlagH).toBe(1);
        expect(s.s3OffsetL).toBe(maskedBank * 0x4000);
        expect(s.s3FlagL).toBe(pat.c3Rom ? 1 : 0);
        expect(s.s3OffsetH).toBe(maskedBank * 0x4000 + 0x2000);
        expect(s.s3FlagH).toBe(pat.c3Rom ? 1 : 0);
      }
    });
  });
});
