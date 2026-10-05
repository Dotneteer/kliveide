/*
 * Decides whether, and as what, Klive can load a parsed ZX Spectrum snapshot
 * (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` §4.3, decisions D2 and D3):
 *  - the snapshot's machine picks the Klive machine, never the current one;
 *  - near-misses (grey +2, a +2A/+3 opened on the +E ROMs, add-ons) load with a warning;
 *  - machines Klive has no core for are refused.
 *
 * Every problem is collected, so the viewer can list them all.
 */

import { MI_SPECTRUM_128, MI_SPECTRUM_3E, MI_SPECTRUM_48, MI_TIMEX } from "@common/machines/constants";
import { TIMEX_MODELS } from "@emu/machines/timex/timexModels";
import { P3_MODELS } from "@emu/machines/zxSpectrumP3e/p3RomSets";
import { SP128_MODELS } from "@emu/machines/zxSpectrum128/sp128Timings";
import {
  snapshotMachineName,
  type SnapshotMachineKind,
  type SpectrumSnapshot
} from "./spectrumSnapshot";

/** How a snapshot maps to a Klive machine */
export type SpectrumSnapshotMapping = {
  /** The Klive machine id, when the snapshot's machine has one */
  machineId?: string;
  /** The models of that machine the snapshot runs on, the preferred one first */
  modelIds: (string | undefined)[];
  /** The display name of the Klive machine it loads as */
  kliveName?: string;
  /** Why the snapshot cannot be loaded; empty when it can */
  errors: string[];
  /** What loads differently from how the original machine would run it */
  warnings: string[];
  /**
   * The warning (also in `warnings`) that a +2A/+3 snapshot runs with the +3E ROMs. It holds only
   * while the snapshot opens on a +E model; the loader drops it when the snapshot stays on one of
   * the Amstrad models.
   */
  eRomWarning?: string;
};

/** The machine and models of each snapshot machine */
const TARGETS: Record<
  SnapshotMachineKind,
  {
    machineId: string;
    modelIds: (string | undefined)[];
    kliveName: string;
    warning?: string;
    /** The warning is about the +E ROMs, and does not hold on an Amstrad model */
    eRoms?: boolean;
  }
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
  // --- The 128K model first; the Pentagon runs a 128K snapshot too, so a project already on it keeps
  // --- it (`fitSpectrumMachine`). A 128K `.sna` cannot say which of the two it came from.
  "128k": { machineId: MI_SPECTRUM_128, modelIds: ["sp128", "pentagon"], kliveName: "ZX Spectrum 128K" },
  plus2: {
    machineId: MI_SPECTRUM_128,
    modelIds: ["sp128", "pentagon"],
    kliveName: "ZX Spectrum 128K",
    warning: "A ZX Spectrum +2 snapshot runs on Klive's 128K (the +2 ROM differs only in its menu)"
  },
  // --- The +E models come first, so a snapshot opens on them by default (plan Q4); a project
  // --- already on an Amstrad model keeps it (`fitSpectrumMachine`)
  plus2a: {
    machineId: MI_SPECTRUM_3E,
    modelIds: ["nofdd", "fdd1", "fdd2", "plus2a", "plus2a-es"],
    kliveName: "ZX Spectrum +2E",
    warning:
      "A ZX Spectrum +2A snapshot runs on Klive's +2E, with the +E ROMs instead of the Amstrad ones",
    eRoms: true
  },
  plus3: {
    machineId: MI_SPECTRUM_3E,
    modelIds: [
      "fdd1",
      "fdd2",
      "plus3-fdd1",
      "plus3-fdd2",
      "plus3-v40-fdd1",
      "plus3-v40-fdd2",
      "plus3-es-fdd1",
      "plus3-es-fdd2"
    ],
    kliveName: "ZX Spectrum +3E",
    warning:
      "A ZX Spectrum +3 snapshot runs on Klive's +3E, with the +E ROMs instead of the Amstrad ones",
    eRoms: true
  },
  plus3e: { machineId: MI_SPECTRUM_3E, modelIds: ["fdd1", "fdd2"], kliveName: "ZX Spectrum +3E" },
  pentagon: { machineId: MI_SPECTRUM_128, modelIds: ["pentagon"], kliveName: "Pentagon 128" },
  tc2048: { machineId: MI_TIMEX, modelIds: ["tc2048"], kliveName: "Timex Computer 2048" }
};

/** The display names of the models the mapping can pick */
const MODEL_NAMES: Record<string, string> = {
  "pal-16k": "ZX Spectrum 16K",
  pal: "ZX Spectrum 48K",
  ntsc: "ZX Spectrum 48K (NTSC)",
  ...Object.fromEntries(SP128_MODELS.map((m) => [m.modelId, m.displayName])),
  ...Object.fromEntries(P3_MODELS.map((m) => [m.modelId, m.displayName])),
  ...Object.fromEntries(TIMEX_MODELS.map((m) => [m.modelId, m.displayName]))
};

/** The display name of a Klive machine and model */
export function kliveSpectrumName(machineId: string, modelId: string | undefined): string {
  if (modelId && MODEL_NAMES[modelId]) return MODEL_NAMES[modelId];
  if (machineId === MI_SPECTRUM_48) return "ZX Spectrum 48K";
  if (machineId === MI_SPECTRUM_128) return "ZX Spectrum 128K";
  if (machineId === MI_SPECTRUM_3E) return "ZX Spectrum +2A/+3/+2E/+3E";
  if (machineId === MI_TIMEX) return "Timex Computer 2048";
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
  const eRomWarning = target.eRoms ? target.warning : undefined;

  const p = snapshot.peripherals;
  if (snapshot.ay?.on48k) {
    warnings.push("The snapshot uses an AY chip on a 48K, which Klive's 48K does not have");
  }
  if (p.interface1) warnings.push("Interface 1 is not emulated; its state is ignored");
  if (p.mgt) warnings.push("The M.G.T. (Disciple/Plus D) interface is not emulated");
  // --- The Beta 128 (TR-DOS) is the Pentagon's: such a snapshot opens on it
  if (p.trdosPaged || p.beta128) {
    if (target.machineId === MI_SPECTRUM_128) {
      modelIds = ["pentagon", ...modelIds.filter((m) => m !== "pentagon")];
    } else {
      warnings.push("The snapshot uses the Beta 128 (TR-DOS), which only Klive's Pentagon 128 has");
    }
  }
  if (p.issue2) warnings.push("The snapshot asks for an Issue 2 keyboard, which Klive does not emulate");
  if (snapshot.ula.alternateTimings) {
    warnings.push("The snapshot uses the alternate (late) ULA timings; Klive uses the standard ones");
  }
  if (p.customRomSize) {
    warnings.push("The snapshot carries a custom ROM, which Klive does not install");
  }
  if (machine === "plus3e" && snapshot.format === "szx" && !p.plus3) {
    // --- A +3e zx-state without a +3 block has no drives: Klive writes its +2E that way
    // --- (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.1)
    modelIds = ["nofdd", ...modelIds];
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
    warnings,
    eRomWarning
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
