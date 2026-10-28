import { t } from "@common/i18n/i18n";

/*
 * Where injected or exported Videoton TVC code may go (`.plans/VIDEOTON_TVC_PLAN.md` §11). One set
 * of rules for Run, Inject and Export, so what Run executes is what Export writes. The layout is the
 * one TVC machine-code programs are distributed in (rtvc's `BASIC_START`): a one-line BASIC program
 * at 19EFh that calls the code with `USR`, and the code from 1A30h.
 *
 * At BASIC's prompt the CPU sees U0-U2 at 0000h-BFFFh and the system ROM at C000h-FFFFh on both
 * models. The code must lie between 1A30h and BBFFh:
 *
 * - below 1A30h are the ROM's work area (0000h-19EEh) and the launcher line;
 * - from C000h up is ROM, and BASIC needs at least 1K below its top of memory (HIMEM, BFFFh) for its
 *   program, variables and stack.
 *
 * Run moves BASIC's program space above the code (`LOMEM`), so nothing BASIC does reaches it.
 */

/** Where BASIC's program starts (the TEXT system variable's value after a boot) */
export const TVC_PROGRAM_START = 0x19ef;
/** The lowest address code may start at: after the launcher line */
export const TVC_CODE_START = 0x1a30;
/** BASIC's top of memory on both models (HIMEM, 0B19h) */
export const TVC_HIMEM = 0xbfff;
/** Room BASIC needs below HIMEM: its program, variables, strings and stack */
export const TVC_BASIC_MIN_ROOM = 0x400;
/** The highest address code may end at */
export const TVC_CODE_END = TVC_HIMEM - TVC_BASIC_MIN_ROOM;

export type TvcSegment = { startAddress: number; emittedCode: ArrayLike<number> };

/** Why code cannot go into a TVC, with its message's parameters */
export type TvcPlacementProblem =
  | { code: "empty" }
  | { code: "tooLow"; address: number }
  | { code: "tooHigh"; address: number };

export type TvcPlacement = {
  /** Where the code starts: `.ent`, else the build's entry, else the lowest segment */
  entry: number;
  /** The lowest byte with code */
  start: number;
  /** The first byte after the highest segment: BASIC's program space starts here after Run */
  end: number;
  /** The segments with code, in address order */
  segments: TvcSegment[];
};

/**
 * Checks where code goes on a TVC
 * @returns the placement, or the first problem
 */
export function placeTvcCode(
  segments: readonly TvcSegment[],
  entryAddress: number | undefined
): TvcPlacement | TvcPlacementProblem {
  const withCode = [...segments].filter((s) => s.emittedCode.length > 0).sort((a, b) => a.startAddress - b.startAddress);
  if (!withCode.length) return { code: "empty" };
  let end = 0;
  for (const s of withCode) {
    if (s.startAddress < TVC_CODE_START) return { code: "tooLow", address: s.startAddress };
    const last = s.startAddress + s.emittedCode.length - 1;
    if (last > TVC_CODE_END) return { code: "tooHigh", address: Math.max(s.startAddress, TVC_CODE_END + 1) };
    end = Math.max(end, last + 1);
  }
  return {
    entry: entryAddress ?? withCode[0].startAddress,
    start: withCode[0].startAddress,
    end,
    segments: withCode
  };
}

/** Whether `placeTvcCode` refused the code */
export function isTvcPlacementProblem(value: TvcPlacement | TvcPlacementProblem): value is TvcPlacementProblem {
  return "code" in value;
}

/** A placement problem as a sentence in the UI's language (the emulator's output and errors) */
export function describeTvcPlacementProblem(problem: TvcPlacementProblem): string {
  const hex = (n: number) => `$${n.toString(16).toUpperCase().padStart(4, "0")}`;
  switch (problem.code) {
    case "empty":
      return t("emu.tvc.code.empty");
    case "tooLow":
      return t("emu.tvc.code.tooLow", { address: hex(problem.address), lowest: hex(TVC_CODE_START) });
    case "tooHigh":
      return t("emu.tvc.code.tooHigh", { address: hex(problem.address), highest: hex(TVC_CODE_END) });
  }
}

/**
 * The BASIC commands Run types after the code is in place: `LOMEM` moves BASIC's program space above
 * the code, and `USR` calls the entry, so a `RET` from the code goes back to BASIC's prompt.
 */
export function tvcRunCommands(placement: TvcPlacement): string {
  return `LOMEM ${placement.end}\nC=USR(${placement.entry})\n`;
}

/**
 * The one BASIC line that starts the code: `10 C=USR(entry)`, tokenized (`basicTokens.ts`: = is 9Ah,
 * ( 96h, ) 95h), with its length and the FFh that ends it
 */
export function tvcLauncherLine(entry: number): Uint8Array {
  const text = [0x43, 0x9a, ...[..."USR"].map((c) => c.charCodeAt(0)), 0x96, ...[...String(entry)].map((c) => c.charCodeAt(0)), 0x95];
  const line = [0, 10, 0x00, ...text, 0xff];
  line[0] = line.length;
  return new Uint8Array(line);
}

/**
 * A program file's payload, loaded at 19EFh: the launcher line, the end of the program (00h), zeros
 * up to the code, and the code where it was assembled
 */
export function tvcProgramPayload(placement: TvcPlacement): Uint8Array {
  const payload = new Uint8Array(placement.end - TVC_PROGRAM_START);
  payload.set(tvcLauncherLine(placement.entry), 0);
  for (const s of placement.segments) payload.set(Array.from(s.emittedCode), s.startAddress - TVC_PROGRAM_START);
  return payload;
}
