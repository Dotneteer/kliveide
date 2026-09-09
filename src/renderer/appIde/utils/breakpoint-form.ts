import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { getBreakpointKey } from "@common/utils/breakpoints";
import { parseCommand } from "@renderer/appIde/services/command-parser";
import { getNumericTokenValue, toHexa4 } from "@renderer/appIde/services/ide-commands";

/**
 * The decision logic behind the breakpoint dialog, with no React and no I/O in it.
 *
 * This module owns every rule the dialog enforces, so the rules can be tested in the fast `node`
 * project instead of through a mounted form. See `.plans/BREAKPOINT_MANAGEMENT_UI_PLAN.md` §5.1.
 *
 * **Binary breakpoints only.** A `BreakpointInfo` is either address-bound (`address`, optionally
 * `partition`) or source-bound (`resource` + `line`) — `getBreakpointKey` branches on exactly that.
 * The dialog authors the first kind; source-code breakpoints stay owned by the editor's glyph
 * margin, which places them by clicking a line, tracks them as lines move, and has its own
 * undo/redo. Nothing here ever reads or writes `resource`/`line`.
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
   * `getBreakpointKey(bp, partitionLabels)` for every breakpoint currently set — **built with the
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
  return bp?.address !== undefined;
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
 * `undefined`, which `getBreakpointKey` would reject. Never emits `resource`/`line`.
 */
export function formToBreakpointInfo(form: BreakpointFormState): BreakpointInfo {
  const address = parseNumericInput(form.address);
  const mask = isIoKind(form.kind) ? parseNumericInput(form.ioMask) : undefined;

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
    address: bp.address === undefined ? "" : `$${toHexa4(bp.address)}`,
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

  // --- Address (a port, for I/O kinds)
  const addressText = (form.address ?? "").trim();
  if (addressText.startsWith("[")) {
    errors.address = SOURCE_SPEC_MESSAGE;
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
    return getBreakpointKey(formToBreakpointInfo(form), env.partitionLabels);
  } catch {
    // --- `getBreakpointKey` throws when neither an address nor a resource is present.
    return undefined;
  }
}

/** True when nothing is wrong. */
export function isFormValid(errors: FieldErrors): boolean {
  return Object.keys(errors).length === 0;
}
