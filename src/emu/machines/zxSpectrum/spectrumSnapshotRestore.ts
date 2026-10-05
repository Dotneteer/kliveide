/*
 * Puts a parsed ZX Spectrum snapshot into a WASM core (`.plans/ZX_SPECTRUM_SNAPSHOT_PLAN.md` §4.4).
 * The 48K, 128K and +2E/+3E machines share this sequence; their export names differ only in their
 * prefix (`sp48`, `sp128`, `spp3e`), so the core is addressed through it.
 *
 * The order matters:
 *  1. RAM is written straight into the core's RAM, then the machine is reset (through the wrapper,
 *     which re-syncs the tape, audio and disk state the core reset clears). The reset keeps RAM, but
 *     unlocks paging, silences the AY and rebuilds the 128K cores' flat 64K view from the banks.
 *  2. Paging: $1FFD first (+3), then $7FFD, whose bit 5 locks every later $7FFD write (trap 5).
 *  3. The AY registers, then the selected one (writing R13 restarts the envelope; trap 14).
 *  4. The border through port $FE (border bits only, plus MIC/EAR when the file has them; trap 13).
 *  5. The frame position: after the reset the frame starts at tact 0, so the tact counter is it.
 *  6. The CPU, through the exports: the wrappers' IFF/IM setters only change the TypeScript mirror
 *     (trap 2). HALT and the EI delay come last.
 *  7. The whole screen is drawn from the loaded RAM, so a debug stop that runs no frame still shows
 *     the snapshot's picture (trap 8).
 *
 * The caller re-syncs its TypeScript mirror afterwards.
 */

import type { SpectrumSnapshot } from "@common/spectrum/snapshot/spectrumSnapshot";
import { SPECTRUM_BANK_SIZE, SPECTRUM_48K_BANKS } from "@common/spectrum/snapshot/spectrumSnapshot";

/** The core exports the restore uses, by their name without the prefix */
type CoreExports = Record<string, (...args: number[]) => number | void>;

/** What the restore needs to know about the machine */
export type SpectrumSnapshotCore = {
  /** The export prefix: "sp48", "sp128" or "spp3e" */
  prefix: "sp48" | "sp128" | "spp3e";
  /** The core's exports */
  exports: object;
  /**
   * The core's RAM: for the 48K, the flat 64K memory (RAM from $4000); for the others, the eight
   * 16K banks in order
   */
  ram: Uint8Array;
  /** The 48K core's model has 16K of RAM */
  is16k?: boolean;
  /** Resets the machine, keeping RAM (the wrapper's `reset()`) */
  reset: () => void;
};

/**
 * Writes a snapshot's state into a core
 * @returns The frame tact the machine stands at
 */
export function restoreSpectrumSnapshot(core: SpectrumSnapshotCore, snapshot: SpectrumSnapshot): number {
  const all = core.exports as CoreExports;
  const call = (name: string, ...args: number[]): number => {
    const fn = all[core.prefix + name];
    if (typeof fn !== "function") {
      throw new Error(`The ${core.prefix} core has no ${core.prefix + name} export`);
    }
    return (fn(...args) as number) ?? 0;
  };
  const paged = core.prefix !== "sp48";

  // --- 1. RAM, then a reset that keeps it
  if (paged) {
    core.ram.fill(0);
    for (const [bank, bytes] of snapshot.ram) {
      if (bank < 8) core.ram.set(bytes, bank * SPECTRUM_BANK_SIZE);
    }
  } else {
    core.ram.fill(0, 0x4000, 0x10000);
    SPECTRUM_48K_BANKS.forEach((bank, slot) => {
      const bytes = snapshot.ram.get(bank);
      if (!bytes || (core.is16k && slot > 0)) return;
      core.ram.set(bytes, 0x4000 + slot * SPECTRUM_BANK_SIZE);
    });
  }
  core.reset();

  // --- 2. Paging
  if (paged && snapshot.paging) {
    if (core.prefix === "spp3e" && snapshot.paging.port1ffd !== undefined) {
      call("WritePort", 0x1ffd, snapshot.paging.port1ffd & 0xff);
    }
    call("WritePort", 0x7ffd, snapshot.paging.port7ffd & 0xff);
  }

  // --- 3. The AY chip
  if (paged && snapshot.ay) {
    for (let reg = 0; reg < 16; reg++) {
      call("SetPsgRegisterIndex", reg);
      call("WritePsgRegisterValue", snapshot.ay.regs[reg] ?? 0);
    }
    call("SetPsgRegisterIndex", snapshot.ay.selected & 0x0f);
  }

  // --- 4. The border (and MIC/EAR when known)
  const fe = (snapshot.ula.border & 0x07) | ((snapshot.ula.lastFe ?? 0) & 0x18);
  call("WritePort", 0xfe, fe);

  // --- 5. The frame position
  const tactsInFrame = call("GetTactsInFrame");
  const wanted = snapshot.ula.frameTact ?? 0;
  const frameTact = tactsInFrame > 0 && wanted < tactsInFrame ? wanted : 0;
  call("SetTacts", frameTact);

  // --- 6. The CPU
  const cpu = snapshot.cpu;
  call("SetCpuAf", cpu.af);
  call("SetCpuBc", cpu.bc);
  call("SetCpuDe", cpu.de);
  call("SetCpuHl", cpu.hl);
  call("SetCpuAfAlt", cpu.af_);
  call("SetCpuBcAlt", cpu.bc_);
  call("SetCpuDeAlt", cpu.de_);
  call("SetCpuHlAlt", cpu.hl_);
  call("SetCpuIx", cpu.ix);
  call("SetCpuIy", cpu.iy);
  call("SetCpuIr", ((cpu.i & 0xff) << 8) | (cpu.r & 0xff));
  call("SetCpuWz", cpu.memptr ?? 0);
  call("SetCpuIff1", cpu.iff1 ? 1 : 0);
  call("SetCpuIff2", cpu.iff2 ? 1 : 0);
  call("SetCpuInterruptMode", cpu.im);
  call("SetCpuSp", cpu.sp);
  call("SetCpuPc", cpu.pc);
  call("SetCpuHalted", cpu.halted ? 1 : 0);
  // --- EI sets a backlog of 2: no interrupt is accepted before the next instruction completes
  call("SetCpuEiBacklog", cpu.suppressInterrupt ? 2 : 0);

  // --- 7. The Pentagon's Beta 128: its registers and the TR-DOS page (`.szx` B128, the `.sna` byte).
  // --- The disks themselves arrive through the media store before the restore.
  const beta = snapshot.peripherals.beta128;
  if (core.prefix === "sp128" && call("BetaGetEnabled") !== 0 && (beta || snapshot.peripherals.trdosPaged)) {
    if (beta) {
      call("BetaSetSystemRegister", beta.system);
      call("BetaSetFdcRegisters", beta.track, beta.sector, beta.data, 0x03);
      for (const disk of beta.disks) call("BetaSetDriveCylinder", disk.drive, disk.cylinder);
    }
    call("BetaSetPaged", snapshot.peripherals.trdosPaged || beta?.paged ? 1 : 0);
  }

  // --- 8. The picture
  call("RenderInstantScreen");
  return frameTact;
}
