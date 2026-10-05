import { describe, expect, it } from "vitest";

import { mapRzxToKlive, RZX_E_ROM_WARNING } from "@common/spectrum/rzx/rzxMapping";
import { RzxError, type RzxFile } from "@common/spectrum/rzx/rzxModel";
import { MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_SPECTRUM_48 } from "@common/machines/constants";
import { buildSzx, state128, state48 } from "../snapshot/builders";

/* Which machine plays a recording (`.plans/RZX_PLAN.md` trap 6) */

function fileWith(snapshot: Uint8Array, extension = "szx"): RzxFile {
  return {
    major: 0,
    minor: 13,
    flags: 0,
    blocks: [
      { kind: "snapshot", extension, bytes: snapshot, compressed: false },
      { kind: "input", tstates: 0, frames: [{ fetchCount: 100, ins: new Uint8Array(0) }], compressed: false }
    ],
    notes: []
  };
}

describe("RZX machine mapping", () => {
  it("maps a 48K recording to the 48K", () => {
    const { mapping } = mapRzxToKlive(fileWith(buildSzx(state48(), { machineId: 1 })));
    expect(mapping.machineId).toBe(MI_SPECTRUM_48);
    expect(mapping.warnings).toEqual([]);
  });

  it("plays a grey +2 recording on the 128K, with the snapshot's warning only", () => {
    const { mapping } = mapRzxToKlive(fileWith(buildSzx(state128(), { machineId: 3 })));
    expect(mapping.machineId).toBe(MI_SPECTRUM_128);
    expect(mapping.warnings.some((w) => w.includes("+2"))).toBe(true);
    expect(mapping.warnings).not.toContain(RZX_E_ROM_WARNING);
  });

  it("prefers the Amstrad models for +2A and +3 recordings, so the ROM matches", () => {
    for (const machineId of [4, 5]) {
      const { mapping } = mapRzxToKlive(fileWith(buildSzx(state128(), { machineId })));
      expect(mapping.machineId).toBe(MI_SPECTRUM_3E);
      expect(mapping.modelIds[0]).toMatch(/^plus/);
      expect(mapping.eRomWarning).toBeUndefined();
      expect(mapping.warnings.some((w) => w.includes("+E ROMs"))).toBe(false);
    }
  });

  it("refuses a snapshot it cannot read", () => {
    expect(() => mapRzxToKlive(fileWith(new Uint8Array(10), "szx"))).toThrow(RzxError);
  });
});
