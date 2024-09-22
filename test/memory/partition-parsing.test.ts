import { describe, it, expect } from "vitest";
import { ZxSpectrum48Machine } from "@emu/machines/zxSpectrum48/ZxSpectrum48Machine";
import { ZxSpectrum128Machine } from "@emu/machines/zxSpectrum128/ZxSpectrum128Machine";
import { ZxSpectrumP3EMachine } from "@emu/machines/zxSpectrumP3e/ZxSpectrumP3eMachine";
import { ZxNextMachine } from "@emu/machines/zxNext/ZxNextMachine";

describe("Memory partitions", () => {
  it("ZX Spectrum 48 works #1", () => {
    const machine = new ZxSpectrum48Machine();
    const partition = machine.parsePartitionLabel("R0");
    expect(partition).toEqual(undefined);
  });

  it("ZX Spectrum 48 works #2", () => {
    const machine = new ZxSpectrum48Machine();
    const partition = machine.parsePartitionLabel("R1");
    expect(partition).toEqual(undefined);
  });

  it("ZX Spectrum 48 works #3", () => {
    const machine = new ZxSpectrum48Machine();
    const partition = machine.parsePartitionLabel("0");
    expect(partition).toEqual(undefined);
  });

  const sp128Cases = [
    { l: "R0", p: -1 },
    { l: "R1", p: -2 },
    { l: "R2", p: undefined },
    { l: "R3", p: undefined },
    { l: "0", p: 0 },
    { l: "1", p: 1 },
    { l: "2", p: 2 },
    { l: "3", p: 3 },
    { l: "4", p: 4 },
    { l: "5", p: 5 },
    { l: "6", p: 6 },
    { l: "7", p: 7 },
    { l: "8", p: undefined }
  ];

  sp128Cases.forEach((c) => {
    it(`ZX Spectrum 128 works #1 (${c.l})`, () => {
      const machine = new ZxSpectrum128Machine();
      const partition = machine.parsePartitionLabel(c.l);
      expect(partition).toEqual(c.p);
    });
  });

  const spp3Cases = [
    { l: "R0", p: -1 },
    { l: "R1", p: -2 },
    { l: "R2", p: -3 },
    { l: "R3", p: -4 },
    { l: "R4", p: undefined },
    { l: "0", p: 0 },
    { l: "1", p: 1 },
    { l: "2", p: 2 },
    { l: "3", p: 3 },
    { l: "4", p: 4 },
    { l: "5", p: 5 },
    { l: "6", p: 6 },
    { l: "7", p: 7 },
    { l: "8", p: undefined }
  ];

  spp3Cases.forEach((c) => {
    it(`ZX Spectrum +2/+3 works #1 (${c.l})`, () => {
      const machine = new ZxSpectrumP3EMachine({
        modelId: "nofdd",
        displayName: "ZX Spectrum +2E",
        config: {}
      });
      const partition = machine.parsePartitionLabel(c.l);
      expect(partition).toEqual(c.p);
    });
  });

  const spNextCases = [
    { l: "UN", p: undefined },
    { l: "R0", p: -1 },
    { l: "R1", p: -2 },
    { l: "R2", p: -3 },
    { l: "R3", p: -4 },
    { l: "R4", p: undefined },
    { l: "A0", p: -5 },
    { l: "A1", p: -6 },
    { l: "A2", p: undefined },
    { l: "DM", p: -7 },
    { l: "0", p: 0 },
    { l: "1", p: 1 },
    { l: "2", p: 2 },
    { l: "3", p: 3 },
    { l: "4", p: 4 },
    { l: "5", p: 5 },
    { l: "6", p: 6 },
    { l: "7", p: 7 },
    { l: "8", p: 8 },
    { l: "223", p: 223 },
    { l: "224", p: undefined }
  ];

  spNextCases.forEach((c) => {
    it(`ZX Spectrum Next works #1 (${c.l})`, () => {
      const machine = new ZxNextMachine();
      const partition = machine.parsePartitionLabel(c.l);
      expect(partition).toEqual(c.p);
    });
  });
});
