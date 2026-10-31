import { t } from "@common/i18n/i18n";

/*
 * Where injected or exported Enterprise code may go (`.plans/ENTERPRISE_PLAN.md` §12). One set of rules
 * for Run and Export, so what Run executes is what Export writes.
 *
 * The program is an EXOS `$$APP` (module type 5, STORAGE_FIRMWARE_SOFTWARE §3.7): a 16-byte header
 * (`00 05`, the body's length, twelve zeros) and the body, which EXOS loads at 0100h, pages in as user
 * RAM and starts at 0100h. Code must lie between 0100h and BFFFh: below is EXOS's page-zero area, and
 * from C000h up page 3 holds EXOS's system segment while the program runs.
 *
 * EXOS always starts at 0100h. When the build's entry is elsewhere and 0100h-0102h hold no code, the
 * program gets a `JP entry` there; otherwise the code must start at its entry.
 */

/** Where EXOS loads and starts a `$$APP` */
export const EP_CODE_START = 0x0100;
/** The highest address code may use: page 3 is EXOS's */
export const EP_CODE_END = 0xbfff;
/** The `$$APP` module type in an EXOS module header */
export const EP_APP_MODULE_TYPE = 0x05;
/** The file name Run gives the program in the FILE: device */
export const EP_RUN_FILE_NAME = "KLIVE.COM";

export type EpSegment = { startAddress: number; emittedCode: ArrayLike<number> };

/** Why code cannot go into an Enterprise, with its message's parameters */
export type EpPlacementProblem =
  | { code: "empty" }
  | { code: "tooLow"; address: number }
  | { code: "tooHigh"; address: number }
  | { code: "entry"; entry: number };

export type EpPlacement = {
  /** Where the code starts */
  entry: number;
  /** The first byte after the highest segment */
  end: number;
  /** The program's body from 0100h: the code where it was assembled, a `JP entry` if one is needed */
  body: Uint8Array;
};

/**
 * Checks where code goes on an Enterprise
 * @returns the placement, or the first problem
 */
export function placeEpCode(segments: readonly EpSegment[], entryAddress: number | undefined): EpPlacement | EpPlacementProblem {
  const withCode = [...segments].filter((s) => s.emittedCode.length > 0).sort((a, b) => a.startAddress - b.startAddress);
  if (!withCode.length) return { code: "empty" };
  let end = 0;
  for (const s of withCode) {
    if (s.startAddress < EP_CODE_START) return { code: "tooLow", address: s.startAddress };
    const last = s.startAddress + s.emittedCode.length - 1;
    if (last > EP_CODE_END) return { code: "tooHigh", address: Math.max(s.startAddress, EP_CODE_END + 1) };
    end = Math.max(end, last + 1);
  }
  const entry = entryAddress ?? withCode[0].startAddress;
  const body = new Uint8Array(end - EP_CODE_START);
  const used = new Uint8Array(body.length);
  for (const s of withCode) {
    body.set(Array.from(s.emittedCode), s.startAddress - EP_CODE_START);
    used.fill(1, s.startAddress - EP_CODE_START, s.startAddress - EP_CODE_START + s.emittedCode.length);
  }
  if (entry !== EP_CODE_START) {
    // --- EXOS starts at 0100h: a JP to the entry, when nothing else is there
    if (used[0] || used[1] || used[2]) return { code: "entry", entry };
    body[0] = 0xc3;
    body[1] = entry & 0xff;
    body[2] = entry >> 8;
  }
  return { entry, end, body };
}

/** Whether `placeEpCode` refused the code */
export function isEpPlacementProblem(value: EpPlacement | EpPlacementProblem): value is EpPlacementProblem {
  return "code" in value;
}

/** A placement problem as a sentence in the UI's language (the emulator's output and errors) */
export function describeEpPlacementProblem(problem: EpPlacementProblem): string {
  const hex = (n: number) => `$${n.toString(16).toUpperCase().padStart(4, "0")}`;
  switch (problem.code) {
    case "empty":
      return t("emu.ep.code.empty");
    case "tooLow":
      return t("emu.ep.code.tooLow", { address: hex(problem.address), lowest: hex(EP_CODE_START) });
    case "tooHigh":
      return t("emu.ep.code.tooHigh", { address: hex(problem.address), highest: hex(EP_CODE_END) });
    case "entry":
      return t("emu.ep.code.entry", { entry: hex(problem.entry), start: hex(EP_CODE_START) });
  }
}

/** The `.com` file of a placement: the EXOS module header and the body */
export function epComFile(placement: EpPlacement): Uint8Array {
  const file = new Uint8Array(16 + placement.body.length);
  file[1] = EP_APP_MODULE_TYPE;
  file[2] = placement.body.length & 0xff;
  file[3] = placement.body.length >> 8;
  file.set(placement.body, 16);
  return file;
}

/** What Run types at IS-BASIC's prompt: EXOS loads the program from the FILE: device and starts it */
export function epRunCommand(): string {
  return `LOAD "FILE:${EP_RUN_FILE_NAME}"\n`;
}
