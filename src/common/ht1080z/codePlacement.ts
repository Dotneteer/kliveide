import { t } from "@common/i18n/i18n";

/*
 * Where injected or exported HT-1080Z code may go (`.plans/HT1080Z_CODE_INJECTION_PLAN.md` D2-D6).
 * One set of rules for Run, Inject and Export, so what Run executes is what Export writes.
 *
 * - Below 3C00h is ROM, the extension ROM and the keyboard: nothing can be written there.
 * - 3C00h-42E8h is video RAM and the ROM's work area: written (a picture is a fair use), but it is not
 *   protected from BASIC.
 * - From 42E9h up is RAM, to 7FFFh on a 16K model and FFFFh on a 48K one. The lowest segment there is
 *   the answer to the power-on question, so BASIC keeps below it (D3, D-Q2); it must leave BASIC at
 *   least 1K for its program and stack.
 */

/** The first byte of BASIC's program area */
export const HT1080Z_PROGRAM_START = 0x42e9;
/** The first byte that can be written: the video RAM */
export const HT1080Z_VIDEO_RAM = 0x3c00;
/** Room BASIC needs below the code: its program, variables, strings and stack */
export const HT1080Z_BASIC_MIN_ROOM = 0x400;
/** The lowest address code in RAM may start at, with D3's room left to BASIC */
export const HT1080Z_LOWEST_PROTECTED_CODE = HT1080Z_PROGRAM_START + HT1080Z_BASIC_MIN_ROOM;
/** Where `RET` from a started program lands: BASIC's `READY` (§3) */
export const HT1080Z_RETURN_TO_BASIC = 0x06cc;
/** The address `X=USR(0)` calls (Level II's USR vector) */
export const HT1080Z_USR_VECTOR = 0x408e;

export type Ht1080zSegment = { startAddress: number; emittedCode: ArrayLike<number> };

/** Why code cannot go into an HT-1080Z, with its message's parameters */
export type Ht1080zPlacementProblem =
  | { code: "empty" }
  | { code: "rom"; address: number }
  | { code: "beyondRam"; address: number; ramKb: number }
  | { code: "tooLow"; address: number };

export type Ht1080zPlacement = {
  /** Where the code starts: `.ent`, else the build's entry, else the first segment */
  entry: number;
  /**
   * The answer to the power-on question: the lowest segment from 42E9h up, or undefined when every
   * segment is below (the code is in video RAM only) and BASIC may have all the memory
   */
  memoryTop?: number;
  /** The segments with code, in address order */
  segments: Ht1080zSegment[];
};

/**
 * Checks where code goes on an HT-1080Z with `ramKb` of RAM
 * @returns the placement, or the first problem
 */
export function placeHt1080zCode(
  segments: readonly Ht1080zSegment[],
  entryAddress: number | undefined,
  ramKb: number
): Ht1080zPlacement | Ht1080zPlacementProblem {
  const withCode = segments.filter((s) => s.emittedCode.length > 0);
  if (!withCode.length) return { code: "empty" };
  const ramEnd = ramKb >= 48 ? 0xffff : 0x7fff;
  for (const s of withCode) {
    if (s.startAddress < HT1080Z_VIDEO_RAM) return { code: "rom", address: s.startAddress };
    const last = s.startAddress + s.emittedCode.length - 1;
    if (last > ramEnd) return { code: "beyondRam", address: Math.max(s.startAddress, ramEnd + 1), ramKb };
  }
  const inRam = withCode.filter((s) => s.startAddress >= HT1080Z_PROGRAM_START).map((s) => s.startAddress);
  const memoryTop = inRam.length ? Math.min(...inRam) : undefined;
  if (memoryTop !== undefined && memoryTop < HT1080Z_LOWEST_PROTECTED_CODE) {
    return { code: "tooLow", address: memoryTop };
  }
  return {
    entry: entryAddress ?? withCode[0].startAddress,
    memoryTop,
    segments: [...withCode].sort((a, b) => a.startAddress - b.startAddress)
  };
}

/** Whether `placeHt1080zCode` refused the code */
export function isHt1080zPlacementProblem(
  value: Ht1080zPlacement | Ht1080zPlacementProblem
): value is Ht1080zPlacementProblem {
  return "code" in value;
}

/** A placement problem as a sentence in the UI's language (the emulator's output and errors) */
export function describeHt1080zPlacementProblem(problem: Ht1080zPlacementProblem): string {
  const hex = (n: number) => `$${n.toString(16).toUpperCase().padStart(4, "0")}`;
  switch (problem.code) {
    case "empty":
      return t("emu.ht1080z.code.empty");
    case "rom":
      return t("emu.ht1080z.code.rom", { address: hex(problem.address) });
    case "beyondRam":
      return t("emu.ht1080z.code.beyondRam", { address: hex(problem.address), ramKb: problem.ramKb });
    case "tooLow":
      return t("emu.ht1080z.code.tooLow", {
        address: hex(problem.address),
        lowest: hex(HT1080Z_LOWEST_PROTECTED_CODE)
      });
  }
}
