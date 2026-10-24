import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";
import { SP128_MAIN_WAITING_LOOP, SP128_RETURN_TO_EDITOR, SP48_MAIN_ENTRY, SP_KEY_WAIT } from "../../ZxSpectrumBase";

/*
 * The Microdrive Loader (`.plans/MICRODRIVE_PLAN.md` Phase 4.3): after a reset, `RUN` with no
 * program, which makes the Interface 1 load the program "run" from Microdrive 1 and run it (its first
 * entry after NEW sees RUN in the edit line: `interface1-rom-behaviour.md` §1). The 128K types it in
 * 128 BASIC, where the same report reaches the Interface 1 (`if1-128k.test.ts`, T9).
 */

const toHexa4 = (value: number) => value.toString(16).toUpperCase().padStart(4, "0");

const key = (primary: number, message: string, secondary?: number, wait = SP_KEY_WAIT) =>
  ({ type: "QueueKey" as const, primary, secondary, wait, message });

/** The 48K: in K mode, R is RUN */
export function sp48MicrodriveBootFlow(): CodeInjectionFlow {
  return [
    {
      type: "ReachExecPoint",
      rom: 0,
      execPoint: SP48_MAIN_ENTRY,
      message: `Main execution cycle point reached (ROM0/$${toHexa4(SP48_MAIN_ENTRY)})`
    },
    { type: "KeepPc" },
    { type: "Start" },
    key(SpectrumKeyCode.R, "RUN"),
    key(SpectrumKeyCode.Enter, "Load run from Microdrive 1", undefined, 0)
  ];
}

/** The 128K: the menu's 128 BASIC, then `run` typed letter by letter */
export function sp128MicrodriveBootFlow(): CodeInjectionFlow {
  return [
    {
      type: "ReachExecPoint",
      rom: 0,
      execPoint: SP128_MAIN_WAITING_LOOP,
      message: `Start-up menu reached (ROM0/$${toHexa4(SP128_MAIN_WAITING_LOOP)})`
    },
    { type: "Start" },
    key(SpectrumKeyCode.N6, "Arrow down", SpectrumKeyCode.CShift),
    key(SpectrumKeyCode.Enter, "128 BASIC", undefined, 0),
    {
      type: "ReachExecPoint",
      rom: 0,
      execPoint: SP128_RETURN_TO_EDITOR,
      message: `128 BASIC reached (ROM0/$${toHexa4(SP128_RETURN_TO_EDITOR)})`
    },
    { type: "KeepPc" },
    { type: "Start" },
    // --- The editor draws its screen before it reads the keyboard: the first letter waits for it
    { ...key(SpectrumKeyCode.R, "r"), delayFrames: 25 },
    key(SpectrumKeyCode.U, "u"),
    key(SpectrumKeyCode.N, "n"),
    key(SpectrumKeyCode.Enter, "Load run from Microdrive 1", undefined, 0)
  ];
}
