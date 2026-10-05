/*
 * Reads a WASM ZX Spectrum core's state into the snapshot model, the mirror image of
 * `spectrumSnapshotRestore.ts` (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.1, D4).
 *
 * It reads only through the cores' getters, so capturing never changes the machine. The caller
 * makes sure the machine is paused at an instruction boundary; the capture itself refuses a CPU that
 * stands between a DD/FD/CB/ED prefix and its opcode, a state no snapshot format can hold.
 *
 * Media file names are not the core's business: the caller passes them in.
 */

import { SP128_TIMINGS } from "@emu/machines/zxSpectrum128/sp128Timings";
import {
  P3_DEFAULT_ROM_SET,
  P3_ROM_SETS,
  p3SnapshotKind,
  type P3RomSet
} from "@emu/machines/zxSpectrumP3e/p3RomSets";
import {
  SPECTRUM_48K_BANKS,
  SPECTRUM_BANK_SIZE,
  type SnapshotBetaDisk,
  type SnapshotDisk,
  type SnapshotMachineKind,
  type SpectrumSnapshot
} from "@common/spectrum/snapshot/spectrumSnapshot";
import { SnapshotRefusedError } from "@common/spectrum/snapshot/snapshotBytes";

/** The core exports the capture uses, by their name without the prefix */
type CoreExports = Record<string, (...args: number[]) => number | void>;

/** What the capture needs to know about the machine */
export type SpectrumSnapshotCaptureCore = {
  /** The export prefix: "sp48", "sp128" or "spp3e" */
  prefix: "sp48" | "sp128" | "spp3e";
  /** The core's exports */
  exports: object;
  /**
   * The core's RAM: for the 48K, the flat 64K memory (RAM from $4000); for the others, the eight
   * 16K banks in order
   */
  ram: Uint8Array;
  /**
   * The 48K's model id ("pal", "ntsc", "pal-16k"); the 128K's timing (128K or Pentagon) and the
   * +2E/+3E's drives come from the core
   */
  modelId?: string;
  /**
   * The ROM set the +2A/+3/+2E/+3E boots (`p3RomSets.ts`; the +3E ROMs when omitted): with the
   * Amstrad ROMs the machine is saved as a +2A or a +3, not a "+3e"
   */
  romSet?: P3RomSet;
};

/** The media the machine has, as the media store knows them */
export type SpectrumSnapshotCaptureMedia = {
  /** The tape file in the deck */
  tapeFile?: string;
  /** The disk files in drives A and B */
  diskFiles?: (string | undefined)[];
};

/**
 * The snapshot machine a Klive machine and model are
 * @param prefix The core
 * @param modelId The 48K's or the 128K machine's model ("sp128", "pentagon")
 * @param romSet The +2A/+3/+2E/+3E's ROM set (the +3E ROMs when omitted)
 * @param drives The +2A/+3/+2E/+3E's enabled drives
 */
export function snapshotMachineOfKlive(
  prefix: SpectrumSnapshotCaptureCore["prefix"],
  modelId?: string,
  romSet: P3RomSet = P3_ROM_SETS[P3_DEFAULT_ROM_SET],
  drives = 0
): SnapshotMachineKind {
  switch (prefix) {
    case "sp48":
      return modelId === "pal-16k" ? "16k" : modelId === "ntsc" ? "48k-ntsc" : "48k";
    case "sp128":
      return modelId === "pentagon" ? "pentagon" : "128k";
    case "spp3e":
      return p3SnapshotKind(romSet, drives);
  }
}

/**
 * Captures a core's state as a snapshot model
 * @throws SnapshotRefusedError when the CPU stands inside a prefixed instruction
 */
export function captureSpectrumSnapshot(
  core: SpectrumSnapshotCaptureCore,
  media: SpectrumSnapshotCaptureMedia = {}
): SpectrumSnapshot {
  const all = core.exports as CoreExports;
  const call = (name: string, ...args: number[]): number => {
    const fn = all[core.prefix + name];
    if (typeof fn !== "function") {
      throw new Error(`The ${core.prefix} core has no ${core.prefix + name} export`);
    }
    return (fn(...args) as number) ?? 0;
  };
  // --- Disk drives, as the core has them enabled (a +2A/+2E has none)
  const drives = core.prefix === "spp3e" ? call("GetFdcEnabledDriveCount") : 0;
  // --- The 128K core runs the 128K's or the Pentagon's timing (`sp128Timings.ts`)
  const modelId =
    core.prefix === "sp128"
      ? call("GetTiming") === SP128_TIMINGS.pentagon.coreTiming
        ? "pentagon"
        : "sp128"
      : core.modelId;
  const machine = snapshotMachineOfKlive(core.prefix, modelId, core.romSet, drives);

  if (call("GetCpuPrefix") !== 0) {
    throw new SnapshotRefusedError(
      "The CPU stands between an instruction prefix and its opcode, which no snapshot format can hold; step once more and save again"
    );
  }

  // --- CPU
  const ir = call("GetCpuIr");
  const cpu: SpectrumSnapshot["cpu"] = {
    af: call("GetCpuAf"),
    bc: call("GetCpuBc"),
    de: call("GetCpuDe"),
    hl: call("GetCpuHl"),
    af_: call("GetCpuAfAlt"),
    bc_: call("GetCpuBcAlt"),
    de_: call("GetCpuDeAlt"),
    hl_: call("GetCpuHlAlt"),
    ix: call("GetCpuIx"),
    iy: call("GetCpuIy"),
    sp: call("GetCpuSp"),
    pc: call("GetCpuPc"),
    i: (ir >> 8) & 0xff,
    r: ir & 0xff,
    im: call("GetCpuInterruptMode") & 0x03,
    iff1: call("GetCpuIff1") !== 0,
    iff2: call("GetCpuIff2") !== 0,
    halted: call("GetCpuHalted") !== 0,
    // --- EI leaves a backlog of 2 at the instruction boundary; the next instruction brings it to 1,
    // --- after which an interrupt is accepted again
    suppressInterrupt: call("GetCpuEiBacklog") >= 2,
    memptr: call("GetCpuWz") & 0xffff
  };

  // --- ULA
  const ula: SpectrumSnapshot["ula"] = {
    border: call("GetBorderColor") & 0x07,
    lastFe: call("GetPortFeValue") & 0xff,
    frameTact: call("GetCurrentFrameTact")
  };

  // --- RAM, in 128K bank numbering
  const ram = new Map<number, Uint8Array>();
  if (core.prefix === "sp48") {
    SPECTRUM_48K_BANKS.forEach((bank, slot) => {
      if (machine === "16k" && slot > 0) return;
      const start = 0x4000 + slot * SPECTRUM_BANK_SIZE;
      ram.set(bank, core.ram.slice(start, start + SPECTRUM_BANK_SIZE));
    });
  } else {
    for (let bank = 0; bank < 8; bank++) {
      const start = bank * SPECTRUM_BANK_SIZE;
      ram.set(bank, core.ram.slice(start, start + SPECTRUM_BANK_SIZE));
    }
  }

  const snapshot: SpectrumSnapshot = {
    format: "szx",
    formatVersion: "Klive",
    machine,
    cpu,
    ula,
    ram,
    peripherals: {},
    header: [],
    warnings: []
  };

  // --- Paging and the AY (the 128K models)
  if (core.prefix !== "sp48") {
    snapshot.paging = { port7ffd: call("GetPort7ffd") & 0xff };
    if (core.prefix === "spp3e") snapshot.paging.port1ffd = call("GetPort1ffd") & 0xff;
    const regs = new Uint8Array(16);
    for (let reg = 0; reg < 16; reg++) regs[reg] = call("GetPsgRegisterValue", reg) & 0xff;
    snapshot.ay = { selected: call("GetPsgRegisterIndex") & 0x0f, regs };
  }

  if (drives > 0) {
    const disks: SnapshotDisk[] = [];
    for (let drive = 0; drive < drives; drive++) {
      const fileName = media.diskFiles?.[drive];
      if (fileName) disks.push({ drive, fileName });
    }
    snapshot.peripherals.plus3 = { drives, motorOn: call("GetDiskMotorOn") !== 0, disks };
  }

  // --- The Pentagon's Beta 128: its registers, the TR-DOS page and the disks linked to their files
  if (core.prefix === "sp128" && call("BetaGetEnabled") !== 0) {
    const disks: SnapshotBetaDisk[] = [];
    for (let drive = 0; drive < 2; drive++) {
      const fileName = media.diskFiles?.[drive];
      if (!fileName || call("BetaDiskGetPresent", drive) === 0) continue;
      disks.push({
        drive,
        cylinder: call("BetaGetDriveCylinder", drive),
        diskType: /\.scl$/i.test(fileName) ? 1 : 0,
        writeProtected: call("BetaDiskGetWriteProtected", drive) !== 0,
        fileName
      });
    }
    const paged = call("BetaGetPaged") !== 0;
    snapshot.peripherals.beta128 = {
      drives: 2,
      paged,
      system: call("BetaGetSystemRegister"),
      track: call("BetaGetFdcTrack"),
      sector: call("BetaGetFdcSector"),
      data: call("BetaGetFdcData"),
      status: call("BetaGetFdcStatus"),
      disks
    };
    if (paged) snapshot.peripherals.trdosPaged = true;
  }

  // --- The tape in the deck
  if (media.tapeFile && call("TapeGetLoaded") !== 0) {
    snapshot.peripherals.tape = {
      currentBlock: call("TapeGetCurrentBlockIndex"),
      fileName: media.tapeFile
    };
  }
  return snapshot;
}
