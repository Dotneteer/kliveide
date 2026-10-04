/*
 * Decides whether, and as what, Klive can load a parsed ZX Spectrum snapshot
 * (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` §4.3, decisions D2 and D3):
 *  - the snapshot's machine picks the Klive machine, never the current one;
 *  - near-misses (grey +2, Amstrad +2A/+3 ROMs, add-ons) load with a warning;
 *  - machines Klive has no core for are refused.
 *
 * Every problem is collected, so the viewer can list them all.
 */

import { MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_SPECTRUM_48 } from "@common/machines/constants";
import {
  snapshotMachineName,
  type SnapshotMachineKind,
  type SpectrumSnapshot
} from "./spectrumSnapshot";

/** How a snapshot maps to a Klive machine */
export type SpectrumSnapshotMapping = {
  /** The Klive machine id, when the snapshot's machine has one */
  machineId?: string;
  /**
   * The models of that machine the snapshot runs on, the preferred one first (`undefined` for the
   * 128K, which has no models)
   */
  modelIds: (string | undefined)[];
  /** The display name of the Klive machine it loads as */
  kliveName?: string;
  /** Why the snapshot cannot be loaded; empty when it can */
  errors: string[];
  /** What loads differently from how the original machine would run it */
  warnings: string[];
};

/** The machine and models of each snapshot machine */
const TARGETS: Record<
  SnapshotMachineKind,
  { machineId: string; modelIds: (string | undefined)[]; kliveName: string; warning?: string }
> = {
  "16k": {
    machineId: MI_SPECTRUM_48,
    modelIds: ["pal-16k", "pal", "ntsc"],
    kliveName: "ZX Spectrum 16K"
  },
  "48k": { machineId: MI_SPECTRUM_48, modelIds: ["pal", "ntsc"], kliveName: "ZX Spectrum 48K" },
  "48k-ntsc": {
    machineId: MI_SPECTRUM_48,
    modelIds: ["ntsc"],
    kliveName: "ZX Spectrum 48K (NTSC)"
  },
  "128k": { machineId: MI_SPECTRUM_128, modelIds: [undefined], kliveName: "ZX Spectrum 128K" },
  plus2: {
    machineId: MI_SPECTRUM_128,
    modelIds: [undefined],
    kliveName: "ZX Spectrum 128K",
    warning: "A ZX Spectrum +2 snapshot runs on Klive's 128K (the +2 ROM differs only in its menu)"
  },
  plus2a: {
    machineId: MI_SPECTRUM_3E,
    modelIds: ["nofdd", "fdd1", "fdd2"],
    kliveName: "ZX Spectrum +2E",
    warning:
      "A ZX Spectrum +2A snapshot runs on Klive's +2E, with the +E ROMs instead of the Amstrad ones"
  },
  plus3: {
    machineId: MI_SPECTRUM_3E,
    modelIds: ["fdd1", "fdd2"],
    kliveName: "ZX Spectrum +3E",
    warning:
      "A ZX Spectrum +3 snapshot runs on Klive's +3E, with the +E ROMs instead of the Amstrad ones"
  },
  plus3e: { machineId: MI_SPECTRUM_3E, modelIds: ["fdd1", "fdd2"], kliveName: "ZX Spectrum +3E" }
};

/** The display names of the models the mapping can pick */
const MODEL_NAMES: Record<string, string> = {
  "pal-16k": "ZX Spectrum 16K",
  pal: "ZX Spectrum 48K",
  ntsc: "ZX Spectrum 48K (NTSC)",
  nofdd: "ZX Spectrum +2E",
  fdd1: "ZX Spectrum +3E (1 FDD)",
  fdd2: "ZX Spectrum +3E (2 FDDs)"
};

/** The display name of a Klive machine and model */
export function kliveSpectrumName(machineId: string, modelId: string | undefined): string {
  if (modelId && MODEL_NAMES[modelId]) return MODEL_NAMES[modelId];
  if (machineId === MI_SPECTRUM_48) return "ZX Spectrum 48K";
  if (machineId === MI_SPECTRUM_128) return "ZX Spectrum 128K";
  if (machineId === MI_SPECTRUM_3E) return "ZX Spectrum +2E/+3E";
  return machineId;
}

/** Maps a parsed snapshot to the Klive machine it loads on */
export function mapSpectrumSnapshotToKlive(snapshot: SpectrumSnapshot): SpectrumSnapshotMapping {
  const errors: string[] = [];
  const warnings: string[] = [];
  const machine = snapshot.machine;
  if (typeof machine === "object") {
    return {
      modelIds: [],
      errors: [`Klive cannot emulate the ${machine.unsupported}`],
      warnings
    };
  }
  const target = TARGETS[machine];
  let modelIds = [...target.modelIds];
  if (target.warning) warnings.push(target.warning);

  const p = snapshot.peripherals;
  if (snapshot.ay?.on48k) {
    warnings.push("The snapshot uses an AY chip on a 48K, which Klive's 48K does not have");
  }
  if (p.interface1) warnings.push("Interface 1 is not emulated; its state is ignored");
  if (p.mgt) warnings.push("The M.G.T. (Disciple/Plus D) interface is not emulated");
  if (p.trdosPaged) warnings.push("The TR-DOS ROM was paged in; Klive has no Beta 128 interface");
  if (p.issue2) warnings.push("The snapshot asks for an Issue 2 keyboard, which Klive does not emulate");
  if (snapshot.ula.alternateTimings) {
    warnings.push("The snapshot uses the alternate (late) ULA timings; Klive uses the standard ones");
  }
  if (p.customRomSize) {
    warnings.push("The snapshot carries a custom ROM, which Klive does not install");
  }
  if (p.plus3) {
    if (p.plus3.drives >= 2 || p.plus3.disks.some((d) => d.drive === 1)) {
      // --- Two drives: prefer the two-drive model
      modelIds = ["fdd2", ...modelIds.filter((m) => m !== "fdd2")];
    }
  }
  if (snapshot.cpu.halted && snapshot.ram.size > 0) {
    const pc = snapshot.cpu.pc;
    const bank = pc >= 0x4000 ? bankAt(snapshot, pc) : undefined;
    if (bank !== undefined) {
      const bytes = snapshot.ram.get(bank);
      if (bytes && bytes[pc & 0x3fff] !== 0x76) {
        warnings.push("The CPU is halted, but PC does not point at a HALT instruction");
      }
    }
  }
  return {
    machineId: target.machineId,
    modelIds,
    kliveName: target.kliveName,
    errors,
    warnings
  };
}

/** The bank behind an address of $4000-$FFFF, as the snapshot pages it */
function bankAt(snapshot: SpectrumSnapshot, address: number): number | undefined {
  if (address < 0x4000) return undefined;
  if (address < 0x8000) return 5;
  if (address < 0xc000) return 2;
  if (snapshot.paging) {
    const special = snapshot.paging.port1ffd !== undefined && (snapshot.paging.port1ffd & 0x01) !== 0;
    if (special) return undefined;
    return snapshot.paging.port7ffd & 0x07;
  }
  return 0;
}

/** A short "what it is / what it loads as" line, for messages and the viewer */
export function describeSnapshotMapping(
  snapshot: SpectrumSnapshot,
  mapping: SpectrumSnapshotMapping
): string {
  const name = snapshotMachineName(snapshot.machine);
  return mapping.kliveName && mapping.kliveName.toLowerCase() !== name.toLowerCase()
    ? `${name}, loads as ${mapping.kliveName}`
    : name;
}
