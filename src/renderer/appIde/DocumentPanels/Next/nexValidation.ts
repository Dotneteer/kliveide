import type { NexHeader } from "./nexFileLoader";

import { toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import {
  NEX_SLOT_1_BANK,
  NEX_SLOT_1_START,
  NEX_SLOT_2_BANK,
  NEX_SLOT_2_START,
  getMappedBankForAddress
} from "./nexEntryState";

/*
 * What is wrong with this NEX before you try to run it.
 *
 * Every one of these turns a silent, baffling failure into a sentence. A NEX whose entry bank it
 * does not contain hands control to whatever happened to be at `$C000`; one whose entry point is in
 * ROM never reaches its own code; one that needs a newer core may fail in ways that look like
 * emulator bugs. All of it is decidable from the 512-byte header the viewer has already parsed.
 *
 * Pure, and table-driven in its tests, per `.plans/NEX_DEBUGGING_PLAN.md` §12. The machine's side of
 * each comparison arrives in `NexValidationContext` rather than being read here, so nothing in this
 * module knows about the emulator.
 */

export type NexIssueSeverity = "error" | "warning";

export type NexIssue = {
  /** Stable identifier, so a test names a rule rather than matching its prose. */
  id: string;
  severity: NexIssueSeverity;
  /** One line, for the banner. */
  message: string;
};

/** What the machine brings to the comparison. */
export type NexValidationContext = {
  /**
   * The emulated core's version, as `[major, minor, subMinor]`.
   *
   * `undefined` when it is not known — then the core check is skipped rather than guessed at.
   */
  coreVersion?: [number, number, number];
  /**
   * How many 16K banks the machine has.
   *
   * `undefined` skips the RAM check. Note that on the ZX Spectrum Next as emulated today this is
   * always 112 (224 8K pages, and the memory array is allocated unconditionally), so the check
   * below cannot fire — it is here because the machine's capability, not the file's demand, is the
   * thing that could change.
   */
  bankCount?: number;
};

/** 16K banks needed for the format's "full RAM" flag: 1792K. */
const FULL_RAM_BANKS = 112;

/** The 16K banks a header declares, from its 112 flags. */
export function declaredBanks(header: NexHeader): number[] {
  const banks: number[] = [];
  header.bankFlags?.forEach((present, bank) => {
    if (present) banks.push(bank);
  });
  return banks;
}

/** True when the file contains the given 16K bank. */
function hasBank(header: NexHeader, bank: number): boolean {
  return !!header.bankFlags?.[bank];
}

/** `major.minor.subMinor` as one comparable number. */
function versionValue(major: number, minor: number, subMinor: number): number {
  return (major << 16) | (minor << 8) | subMinor;
}

/**
 * Everything wrong with this header, worst first.
 *
 * An empty array means the header is consistent with itself and with the machine — not that the
 * program will run, which no amount of header reading can promise.
 */
export function validateNexHeader(
  header: NexHeader | undefined,
  context: NexValidationContext = {}
): NexIssue[] {
  if (!header) return [];

  const issues: NexIssue[] = [];

  /*
   * The entry bank must be in the file.
   *
   * NextZXOS pages the entry bank at `$C000` and jumps to the program's entry point. If the file
   * does not contain that bank, whatever was in that RAM bank beforehand is what runs — which is
   * the single most confusing way a NEX can fail, because the loader reports success.
   */
  if (!hasBank(header, header.entryBank)) {
    issues.push({
      id: "entry-bank-missing",
      severity: "error",
      message:
        `The entry bank $${toHexa2(header.entryBank)} is not one of the banks this file ` +
        "contains, so the program would be handed control of memory it never loaded."
    });
  }

  /*
   * ...and so must the bank the entry point actually lands in.
   *
   * A separate rule from the one above: an entry point at `$4000` or `$8000` runs from bank 5 or
   * bank 2 rather than from the entry bank, so a file can name a perfectly good entry bank and
   * still start executing in a bank it does not carry.
   */
  const pcBank = getMappedBankForAddress(header, header.programCounter);
  if (header.programCounter < NEX_SLOT_1_START) {
    issues.push({
      id: "entry-point-in-rom",
      severity: "error",
      message:
        `The entry point $${toHexa4(header.programCounter)} is below $4000, which is ROM when the ` +
        "program starts — the program's own code is never reached."
    });
  } else if (pcBank !== undefined && pcBank !== header.entryBank && !hasBank(header, pcBank)) {
    const slot =
      header.programCounter < NEX_SLOT_2_START
        ? `$${toHexa4(NEX_SLOT_1_START)} (bank $${toHexa2(NEX_SLOT_1_BANK)})`
        : `$${toHexa4(NEX_SLOT_2_START)} (bank $${toHexa2(NEX_SLOT_2_BANK)})`;
    issues.push({
      id: "entry-point-bank-missing",
      severity: "error",
      message:
        `The entry point $${toHexa4(header.programCounter)} runs from the bank paged at ${slot}, ` +
        "which this file does not contain."
    });
  }

  /*
   * The stack pointer must point at RAM.
   *
   * Below `$4000` is ROM at hand-over, so every `PUSH` — including the one the first `CALL` makes —
   * writes nothing and the matching `RET` reads whatever the ROM holds. The program crashes
   * somewhere unrelated to the mistake.
   */
  if (header.stackPointer < NEX_SLOT_1_START) {
    issues.push({
      id: "stack-in-rom",
      severity: "error",
      message:
        `The stack pointer $${toHexa4(header.stackPointer)} is below $4000, which is ROM when the ` +
        "program starts — pushes would be discarded."
    });
  }

  /*
   * A newer core than the emulator provides.
   *
   * Zero means "no requirement", which is what most files carry, so it is not a version to compare.
   */
  const required = versionValue(
    header.requiredCoreVersionMajor,
    header.requiredCoreVersionMinor,
    header.requiredCoreVersionSubMinor
  );
  if (required > 0 && context.coreVersion) {
    const [major, minor, subMinor] = context.coreVersion;
    if (required > versionValue(major, minor, subMinor)) {
      issues.push({
        id: "core-too-old",
        severity: "warning",
        message:
          `This file asks for core ${header.requiredCoreVersionMajor}.` +
          `${header.requiredCoreVersionMinor}.${header.requiredCoreVersionSubMinor}; ` +
          `the emulated core is ${major}.${minor}.${subMinor}. It may not run correctly.`
      });
    }
  }

  // --- More RAM than the machine has. See `bankCount`: this cannot fire on the Next as emulated.
  if (header.fullRamRequired && context.bankCount !== undefined) {
    if (context.bankCount < FULL_RAM_BANKS) {
      issues.push({
        id: "not-enough-ram",
        severity: "error",
        message:
          `This file needs the full 1792K of RAM; the machine has ${context.bankCount * 16}K.`
      });
    }
  }

  /*
   * The bank count in the header against the flags beside it.
   *
   * Only a warning: the loader reads banks by their flags, so a wrong count does not break
   * anything by itself. It does mean the file was written by something that disagrees with its own
   * header, which is worth knowing before trusting anything else in it.
   */
  const declared = declaredBanks(header).length;
  if (header.numOf16KBanks !== declared) {
    issues.push({
      id: "bank-count-mismatch",
      severity: "warning",
      message:
        `The header says ${header.numOf16KBanks} banks but marks ${declared}. The file may have ` +
        "been written incorrectly."
    });
  }

  // --- Errors first: a banner shows a limited number of lines, and an error is what stops the
  // --- program running at all.
  return [
    ...issues.filter((issue) => issue.severity === "error"),
    ...issues.filter((issue) => issue.severity === "warning")
  ];
}

/** The banner's summary line, or `undefined` when there is nothing wrong. */
export function summarizeNexIssues(issues: NexIssue[]): string | undefined {
  if (!issues.length) return undefined;

  const errors = issues.filter((issue) => issue.severity === "error").length;
  const warnings = issues.length - errors;
  const parts: string[] = [];
  if (errors) parts.push(`${errors} problem${errors === 1 ? "" : "s"}`);
  if (warnings) parts.push(`${warnings} warning${warnings === 1 ? "" : "s"}`);
  return `This NEX file has ${parts.join(" and ")}.`;
}
