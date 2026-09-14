import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { getBreakpointDisplayKey } from "@common/utils/breakpoints";
import { isBankRelative } from "@common/utils/breakpoint-scope";
import { parseCommand } from "@renderer/appIde/services/command-parser";
import { getNumericTokenValue, toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
// --- The Next's bank limits, from the module that owns the NEX bank facts. `BreakpointCommands`
// --- imports them from the same place for the same grammar, which is the point: one definition of
// --- what a legal bank and offset are, not one per parser.
import {
  NEX_BANK_LAST_OFFSET,
  NEX_MAX_BANK
} from "@renderer/appIde/DocumentPanels/Next/nexAnnotations";

/**
 * The decision logic behind the breakpoint dialog, with no React and no I/O in it.
 *
 * This module owns every rule the dialog enforces, so the rules can be tested in the fast `node`
 * project instead of through a mounted form. See `.plans/BREAKPOINT_MANAGEMENT_UI_PLAN.md` §5.1.
 *
 * **Binary breakpoints only.** A `BreakpointInfo` is address-bound (`address`, optionally
 * `partition`), **bank-relative** (`bank` + `bankOffset`), or source-bound (`resource` + `line`) —
 * `getBreakpointDisplayKey` branches on exactly that. The dialog authors the first two;
 * source-code breakpoints stay owned by the editor's glyph margin, which places them by clicking a
 * line, tracks them as lines move, and has its own undo/redo. Nothing here ever reads or writes
 * `resource`/`line`.
 *
 * The bank-relative kind is spelled into the **address field** — `05:+$0100` — rather than given
 * controls of its own. That is what `bp-set` accepts, so there is one spelling to learn and one
 * parser behind it; and it means the type selector, which already offers memory read and memory
 * write, is how a bank *watchpoint* gets made. A dedicated bank picker beside the partition picker
 * would have put two controls on screen that mean different things by "bank" — 16K banks and 8K
 * pages — which is the confusion §4.1 exists to have settled.
 */

/** The five mutually exclusive breakpoint types, one per `-r`/`-w`/`-i`/`-o` (or none, for exec). */
export type BreakpointKind = "exec" | "memRead" | "memWrite" | "ioRead" | "ioWrite";

/**
 * The dialog's fields, as the user typed them.
 *
 * Text stays text: `address` and `ioMask` are raw input so the form can show what was entered next
 * to the error explaining why it will not parse.
 */
export type BreakpointFormState = {
  kind: BreakpointKind;
  /** Raw input: `$32ac`, `12972`, `%0011...`. For I/O kinds this is the port. */
  address: string;
  /**
   * The partition index, or `undefined` for none.
   *
   * A number rather than a label, because that is what the picker deals in and what
   * `BreakpointInfo` stores. ZX Next indexes ROMs and DivMMC pages negatively (`-23..-1`) and RAM
   * banks from `0`, so this is signed.
   */
  partition?: number;
  /** Raw input, I/O kinds only. Empty means no mask. */
  ioMask: string;
  disabled: boolean;
};

/**
 * Everything the rules need to know about the world, resolved by the caller before the dialog opens.
 *
 * This is data, not a service: no layer below the opener knows `EmuApi` or Redux exists, and a test
 * writes one as a literal.
 */
export type BreakpointEnvironment = {
  /** From `emuApi.getPartitionLabels()`. Empty when the machine has no partitions. */
  partitionLabels: Record<number, string>;
  /** Whether the machine declares `MF_ROM` or `MF_BANK`. */
  supportsPartitions: boolean;
  /**
   * Whether `<bank>:+<offset>` means anything on this machine — the ZX Spectrum Next only.
   *
   * Explicit rather than inferred from the partition count, and enforced here rather than left to
   * the UI: `bp-set` refuses a bank-relative breakpoint on any other machine, so a dialog that
   * authored one would be creating a breakpoint the command layer rejects, through a code path that
   * bypasses that rejection.
   */
  supportsBankRelative?: boolean;
  /**
   * `getBreakpointDisplayKey(bp, partitionLabels)` for every breakpoint currently set — **built with the
   * same `partitionLabels` map above**, or the duplicate check silently stops matching.
   */
  existingKeys: string[];
  /** The key being edited, exempt from the duplicate check. Absent when adding. */
  editingKey?: string;
};

/** Per-field messages, plus `form` for a rule that belongs to no single field. */
export type FieldErrors = Partial<Record<keyof BreakpointFormState, string>> & {
  form?: string;
};

/**
 * The outcome of parsing a numeric field. `reason` says *why* it failed, leaving the caller — which
 * knows whether the field is an address, a port or a mask — to phrase the message.
 *
 * Optional members rather than a discriminated union on `ok`: the project compiles with
 * `strictNullChecks: false`, under which TypeScript will not narrow a union by a boolean literal.
 * This is also the shape `getNumericTokenValue` and friends already use.
 */
export type NumericParseResult = {
  ok: boolean;
  /** Present when `ok`. */
  value?: number;
  /** Present when not `ok`. */
  reason?: "empty" | "invalid";
};

const ADDRESS_MAX = 0xffff;

/** What the address field says when handed a `[file]:line` spec. */
export const SOURCE_SPEC_MESSAGE =
  "Set source-code breakpoints from the editor's left margin.";

const NUMBER_HINT = "for example $8000, 32768, or %1000000000000000";

/** True for a breakpoint this dialog can edit. Source-bound breakpoints must not reach it. */
export function isBinaryBreakpoint(bp: BreakpointInfo | undefined): boolean {
  return bp?.address !== undefined || isBankRelative(bp ?? {});
}

/** The `<bank>:+<offset>` separator. `+` cannot begin an address literal, which is why it works. */
const BANK_RELATIVE_MARKER = ":+";

/** True when the text is *spelled* as a bank-relative site, whether or not the parts are valid. */
export function isBankRelativeInput(text: string | undefined): boolean {
  return (text ?? "").includes(BANK_RELATIVE_MARKER);
}

/**
 * Parse `05:+$0100` into a bank and an offset within it.
 *
 * `reason` distinguishes which half is wrong, so the message can say so: "that is not a bank" and
 * "that is not an offset in a bank" are different corrections, and a single "invalid address" would
 * leave the user guessing which end to fix.
 *
 * The bank is plain hexadecimal and deliberately does **not** go through the partition label map:
 * it is a 16K bank, and the map describes 8K pages. See `.plans/NEX_DEBUGGING_PLAN.md` §4.1.
 */
export function parseBankRelativeInput(text: string | undefined): {
  ok: boolean;
  bank?: number;
  bankOffset?: number;
  reason?: "notBankRelative" | "bank" | "offset";
} {
  const trimmed = (text ?? "").trim();
  const marker = trimmed.indexOf(BANK_RELATIVE_MARKER);
  if (marker < 0) return { ok: false, reason: "notBankRelative" };

  const bankText = trimmed.substring(0, marker).trim();
  const offsetText = trimmed.substring(marker + BANK_RELATIVE_MARKER.length).trim();

  // --- Hexadecimal without a `$`, matching the command grammar. `parseInt` would accept `5xyz`, so
  // --- the shape is checked before the value.
  if (!/^[0-9a-fA-F]{1,2}$/.test(bankText)) return { ok: false, reason: "bank" };
  const bank = parseInt(bankText, 16);
  if (bank < 0 || bank > NEX_MAX_BANK) return { ok: false, reason: "bank" };

  const offset = parseNumericInput(offsetText);
  if (!offset.ok) return { ok: false, reason: "offset" };
  if (offset.value < 0 || offset.value > NEX_BANK_LAST_OFFSET) {
    return { ok: false, reason: "offset" };
  }

  return { ok: true, bank, bankOffset: offset.value };
}

/** The blank form the Add flow starts from. */
export function createEmptyForm(): BreakpointFormState {
  return { kind: "exec", address: "", partition: undefined, ioMask: "", disabled: false };
}

function isIoKind(kind: BreakpointKind): boolean {
  return kind === "ioRead" || kind === "ioWrite";
}

/**
 * Switch the breakpoint type, dropping whatever the new type cannot carry.
 *
 * Without this the form keeps values its own UI has stopped showing: a partition left behind when
 * the type became I/O (the control is disabled, but the value is still in state), or a port mask
 * left behind when it stopped being I/O (the field is gone entirely). Either would fail validation
 * against a field the user can no longer see, let alone correct — a dead end with no way out but
 * Cancel.
 */
export function applyKindChange(
  form: BreakpointFormState,
  kind: BreakpointKind
): BreakpointFormState {
  return {
    ...form,
    kind,
    partition: isIoKind(kind) ? undefined : form.partition,
    ioMask: isIoKind(kind) ? form.ioMask : ""
  };
}

/**
 * Parse a numeric field exactly the way the `bp-*` commands parse an address.
 *
 * It delegates to the command tokenizer rather than running its own regex, because two parsers that
 * are meant to accept the same literals will not keep doing so. `breakpoint-form.test.ts` asserts
 * the two agree over a shared table.
 */
export function parseNumericInput(text: string | undefined): NumericParseResult {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return { ok: false, reason: "empty" };

  const tokens = parseCommand(trimmed);
  if (tokens.length !== 1) return { ok: false, reason: "invalid" };

  // --- `getNumericTokenValue` returns `null` — not an error object — for a token that is not a
  // --- numeric literal at all. `BreakpointCommands` only survives that by wrapping the call in a
  // --- try/catch that turns the resulting TypeError into "Invalid numeric value"; check for it.
  const parsed = getNumericTokenValue(tokens[0]);
  if (!parsed || parsed.messages || parsed.value === undefined || Number.isNaN(parsed.value)) {
    return { ok: false, reason: "invalid" };
  }
  return { ok: true, value: parsed.value };
}

/** True when the machine actually has a partition with this index. */
export function isKnownPartition(partition: number, env: BreakpointEnvironment): boolean {
  return env.partitionLabels?.[partition] !== undefined;
}

/**
 * Turn a valid form into the breakpoint it describes.
 *
 * Only meaningful for a form `validateBreakpointForm` accepts; an unparseable address becomes
 * `undefined`, which `getBreakpointDisplayKey` would reject. Never emits `resource`/`line`.
 */
export function formToBreakpointInfo(form: BreakpointFormState): BreakpointInfo {
  const mask = isIoKind(form.kind) ? parseNumericInput(form.ioMask) : undefined;

  // --- A bank-relative site instead of an address. Not for the I/O kinds, which watch a port and
  // --- have no bank at all — `validateBreakpointForm` refuses that combination, and emitting the
  // --- bank anyway would build a breakpoint the emulator's own guard rejects.
  const bankSite = isIoKind(form.kind) ? undefined : parseBankRelativeInput(form.address);
  if (bankSite?.ok) {
    return {
      bank: bankSite.bank,
      bankOffset: bankSite.bankOffset,
      exec: form.kind === "exec",
      memoryRead: form.kind === "memRead",
      memoryWrite: form.kind === "memWrite",
      ioRead: false,
      ioWrite: false,
      // --- No partition: a bank-relative breakpoint derives its own from the bank and offset, and
      // --- carrying a second, independent one would arm it somewhere the bank is not.
      disabled: form.disabled
    };
  }

  const address = parseNumericInput(form.address);

  return {
    address: address.ok ? address.value & ADDRESS_MAX : undefined,
    // --- A partition is meaningless on an I/O breakpoint, and the command rejects the combination
    // --- outright. Dropping it here keeps a stale value from surviving a kind switch.
    partition: isIoKind(form.kind) ? undefined : form.partition,
    exec: form.kind === "exec",
    memoryRead: form.kind === "memRead",
    memoryWrite: form.kind === "memWrite",
    ioRead: form.kind === "ioRead",
    ioWrite: form.kind === "ioWrite",
    ioMask: mask?.ok ? mask.value & ADDRESS_MAX : undefined,
    disabled: form.disabled
  };
}

/**
 * The inverse of `formToBreakpointInfo`, for the Edit flow. Addresses come back as `$xxxx`.
 *
 * Takes no environment: now that a partition is an index rather than a label, neither direction
 * needs the label map to translate.
 */
export function breakpointToForm(bp: BreakpointInfo): BreakpointFormState {
  const kind: BreakpointKind = bp.memoryRead
    ? "memRead"
    : bp.memoryWrite
      ? "memWrite"
      : bp.ioRead
        ? "ioRead"
        : bp.ioWrite
          ? "ioWrite"
          : "exec";

  return {
    kind,
    // --- The same spelling `getBreakpointDisplayKey` produces and `bp-set` accepts, so an edited
    // --- breakpoint round-trips through the field without changing its key.
    address: isBankRelative(bp)
      ? `${toHexa2(bp.bank).toUpperCase()}:+$${toHexa4(bp.bankOffset)}`
      : bp.address === undefined
        ? ""
        : `$${toHexa4(bp.address)}`,
    partition: bp.partition,
    ioMask: bp.ioMask === undefined ? "" : `$${toHexa4(bp.ioMask)}`,
    disabled: bp.disabled ?? false
  };
}

/**
 * Every rule the dialog enforces, per field.
 *
 * Three of the command's rules are absent because the form makes them unrepresentable: only one
 * kind can be chosen (a radio group), `ioMask` only exists for I/O kinds (the field is hidden
 * otherwise), and a partition control is not rendered at all without partition support. They are
 * still checked here, so the module is correct against a hand-built state and a view bug cannot
 * smuggle one past.
 */
export function validateBreakpointForm(
  form: BreakpointFormState,
  env: BreakpointEnvironment
): FieldErrors {
  const errors: FieldErrors = {};
  const addressLabel = isIoKind(form.kind) ? "port" : "address";

  // --- Address (a port, for I/O kinds; or a bank-relative site)
  const addressText = (form.address ?? "").trim();
  if (addressText.startsWith("[")) {
    errors.address = SOURCE_SPEC_MESSAGE;
  } else if (isBankRelativeInput(addressText)) {
    // --- Judged as what it is *spelled* as. Falling through to the numeric parser instead would
    // --- report "enter a valid address" for a bank-relative site with one digit wrong, which says
    // --- nothing about the mistake.
    if (!env.supportsBankRelative) {
      errors.address = "Bank-relative breakpoints are supported on the ZX Spectrum Next only.";
    } else if (isIoKind(form.kind)) {
      errors.address = "An I/O breakpoint watches a port, which is not in a bank.";
    } else {
      const site = parseBankRelativeInput(addressText);
      if (!site.ok) {
        errors.address =
          site.reason === "bank"
            ? `Enter a 16K bank in hexadecimal, $00 to $${toHexa2(NEX_MAX_BANK).toUpperCase()}.`
            : `Enter an offset within the bank, $0000 to $${toHexa4(NEX_BANK_LAST_OFFSET)}.`;
      }
    }
  } else {
    const parsed = parseNumericInput(addressText);
    if (!parsed.ok) {
      errors.address =
        parsed.reason === "empty"
          ? `Enter ${isIoKind(form.kind) ? "a port" : "an address"}.`
          : `Enter a valid ${addressLabel}, ${NUMBER_HINT}.`;
    } else if (parsed.value < 0 || parsed.value > ADDRESS_MAX) {
      errors.address = `The ${addressLabel} must be between $0000 and $FFFF.`;
    }
  }

  // --- Port mask: optional, I/O kinds only
  const maskText = (form.ioMask ?? "").trim();
  if (maskText) {
    if (!isIoKind(form.kind)) {
      errors.ioMask = "A port mask applies only to I/O breakpoints.";
    } else {
      const parsed = parseNumericInput(maskText);
      if (!parsed.ok) {
        errors.ioMask = `Enter a valid port mask, ${NUMBER_HINT}.`;
      } else if (parsed.value < 0 || parsed.value > ADDRESS_MAX) {
        errors.ioMask = "The port mask must be between $0000 and $FFFF.";
      }
    }
  }

  // --- Partition
  if (form.partition !== undefined) {
    if (!env.supportsPartitions) {
      errors.partition = "This machine does not support partitions.";
    } else if (isIoKind(form.kind)) {
      errors.partition = "I/O breakpoints cannot use a partition.";
    } else if (isBankRelativeInput(addressText)) {
      // --- A bank-relative breakpoint resolves its own partition from the bank and the offset. A
      // --- second one chosen here would contradict it, and silently dropping it would leave the
      // --- dialog showing a partition the breakpoint does not have.
      errors.partition = "A bank-relative breakpoint already names its bank.";
    } else if (!isKnownPartition(form.partition, env)) {
      errors.partition = "This machine has no such partition.";
    }
  }

  // --- Duplicate key. Only checkable once the parts the key is built from are sound.
  if (!errors.address && !errors.partition && !errors.ioMask) {
    const key = breakpointKeyOf(form, env);
    if (key !== undefined && key !== env.editingKey && env.existingKeys.includes(key)) {
      // --- `bp-set` silently merges onto an existing key, which reads as an update on the command
      // --- line but would look like a rename here. Refuse instead.
      errors.form = `A breakpoint already exists at ${key}.`;
    }
  }

  return errors;
}

/** The key this form would produce, or `undefined` if it does not describe a breakpoint yet. */
export function breakpointKeyOf(
  form: BreakpointFormState,
  env: BreakpointEnvironment
): string | undefined {
  try {
    return getBreakpointDisplayKey(formToBreakpointInfo(form), env.partitionLabels);
  } catch {
    // --- `getBreakpointDisplayKey` throws when neither an address nor a resource is present.
    return undefined;
  }
}

/** True when nothing is wrong. */
export function isFormValid(errors: FieldErrors): boolean {
  return Object.keys(errors).length === 0;
}
