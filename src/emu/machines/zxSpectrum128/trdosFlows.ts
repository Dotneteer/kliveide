import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";
import { SP128_MAIN_WAITING_LOOP, SP48_MAIN_ENTRY, SP_KEY_WAIT } from "../ZxSpectrumBase";

/*
 * The Pentagon's Disk Loader (`.plans/BETA128_TRDOS_PLAN.md` Phase 4, Q5): after a reset, the 128K
 * menu's 48 BASIC, `RANDOMIZE USR 15616` to enter TR-DOS, then `RUN`, which boots the disk's BASIC
 * file `boot` (the Beta 128 user manual: "If you enter either LOAD or RUN without the filename,
 * TRDOS will load or run the BASIC program 'boot'").
 *
 * It waits on ROM addresses only in the 128K ROMs, which Klive ships. TR-DOS's own addresses are not
 * known (the ROM is the user's), so the flow gives TR-DOS time to start before it types `RUN`.
 */

const toHexa4 = (value: number) => value.toString(16).toUpperCase().padStart(4, "0");

/** How long TR-DOS gets to start (it restores the drive and reads the catalogue), in milliseconds */
export const TRDOS_START_WAIT = 2500;

const key = (primary: number, message: string, secondary?: number, wait = SP_KEY_WAIT) =>
  ({ type: "QueueKey" as const, primary, secondary, wait, message });

export function trdosDiskBootFlow(): CodeInjectionFlow {
  return [
    {
      type: "ReachExecPoint",
      rom: 0,
      execPoint: SP128_MAIN_WAITING_LOOP,
      message: `Start-up menu reached (ROM0/$${toHexa4(SP128_MAIN_WAITING_LOOP)})`
    },
    { type: "Start" },
    // --- The menu's fourth item: 48 BASIC
    key(SpectrumKeyCode.N6, "Arrow down", SpectrumKeyCode.CShift),
    key(SpectrumKeyCode.N6, "Arrow down", SpectrumKeyCode.CShift),
    key(SpectrumKeyCode.N6, "Arrow down", SpectrumKeyCode.CShift),
    key(SpectrumKeyCode.Enter, "48 BASIC", undefined, 0),
    {
      type: "ReachExecPoint",
      rom: 1,
      execPoint: SP48_MAIN_ENTRY,
      message: `48 BASIC reached (ROM1/$${toHexa4(SP48_MAIN_ENTRY)})`
    },
    { type: "KeepPc" },
    { type: "Start" },
    // --- K mode: T is RANDOMIZE; Caps + Symbol Shift gives E mode, where L is USR
    key(SpectrumKeyCode.T, "RANDOMIZE"),
    key(SpectrumKeyCode.CShift, "Extended mode", SpectrumKeyCode.SShift),
    key(SpectrumKeyCode.L, "USR"),
    key(SpectrumKeyCode.N1, "1"),
    key(SpectrumKeyCode.N5, "5"),
    key(SpectrumKeyCode.N6, "6"),
    key(SpectrumKeyCode.N1, "1"),
    key(SpectrumKeyCode.N6, "6"),
    key(SpectrumKeyCode.Enter, "Enter TR-DOS", undefined, TRDOS_START_WAIT),
    // --- At the TR-DOS prompt (K mode), R is RUN; without a name it runs `boot`
    key(SpectrumKeyCode.R, "RUN"),
    key(SpectrumKeyCode.Enter, "Boot the disk", undefined, 0)
  ];
}
