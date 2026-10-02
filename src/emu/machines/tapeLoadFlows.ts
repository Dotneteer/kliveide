import type { CodeInjectionFlow } from "@emu/abstractions/CodeInjectionFlow";
import { SpectrumKeyCode } from "@emu/machines/zxSpectrum/SpectrumKeyCode";
import { SP48_MAIN_ENTRY, SP_KEY_WAIT } from "./ZxSpectrumBase";

/*
 * The keystrokes that start a tape loading after a reset - what "Load and run" on a tape does
 * (`.plans/TAPE_VIEWER_PLAN.md` §4.6). They run through `MachineController`'s code-injection flow
 * but inject nothing: the tape is already in the deck, and the machine's own ROM loads it, so
 * whatever loader the tape carries runs exactly as it would on the real machine.
 *
 * Fast loading still applies: the tape device traps the 48K ROM's LD-BYTES whichever way it was
 * reached, and on the 128K and +2/+3 the Tape Loader pages that ROM in.
 */

const toHexa4 = (value: number) => value.toString(16).toUpperCase().padStart(4, "0");

/** The 48K: reach the editor, then type `LOAD ""` and ENTER. */
export function sp48TapeLoadFlow(): CodeInjectionFlow {
  return [
    {
      type: "ReachExecPoint",
      rom: 0,
      execPoint: SP48_MAIN_ENTRY,
      message: `Main execution cycle point reached (ROM0/$${toHexa4(SP48_MAIN_ENTRY)})`
    },
    { type: "KeepPc" },
    { type: "Start" },
    // --- In K mode, J is the LOAD keyword
    { type: "QueueKey", primary: SpectrumKeyCode.J, wait: SP_KEY_WAIT, message: "LOAD" },
    // --- Symbol Shift + P is the quote
    {
      type: "QueueKey",
      primary: SpectrumKeyCode.P,
      secondary: SpectrumKeyCode.SShift,
      wait: SP_KEY_WAIT,
      message: '"'
    },
    {
      type: "QueueKey",
      primary: SpectrumKeyCode.P,
      secondary: SpectrumKeyCode.SShift,
      wait: SP_KEY_WAIT,
      message: '"'
    },
    { type: "QueueKey", primary: SpectrumKeyCode.Enter, wait: 0, message: "Enter" }
  ];
}

/**
 * The 128K and +2/+3: reach the start-up menu and choose its first item - Tape Loader on the 128K
 * and +2, Loader on the +2A/+3 (which boots a disk instead if one is in drive A).
 * @param waitingLoop The menu's waiting loop in ROM 0
 * @param itemName The first item's name, for the output
 */
export function menuTapeLoadFlow(waitingLoop: number, itemName: string): CodeInjectionFlow {
  return [
    {
      type: "ReachExecPoint",
      rom: 0,
      execPoint: waitingLoop,
      message: `Start-up menu reached (ROM0/$${toHexa4(waitingLoop)})`
    },
    { type: "KeepPc" },
    { type: "Start" },
    { type: "QueueKey", primary: SpectrumKeyCode.Enter, wait: 0, message: itemName }
  ];
}
