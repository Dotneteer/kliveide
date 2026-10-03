import type { BreakpointHitMode, BreakpointInfo } from "@abstractions/BreakpointInfo";
import type {
  ConditionAccessKind,
  ConditionDiagnostic,
  ConditionSymbols
} from "@common/utils/breakpoint-condition/condition-types";

import { getBreakpointDisplayKey } from "@common/utils/breakpoints";
import { isBankRelative, isNextRegBreakpoint } from "@common/utils/breakpoint-scope";
import {
  MAX_BREAKPOINT_HIT_COUNT,
  breakpointFiltersOf,
  effectiveHitMode,
  isValidBreakpointHitCount,
  withoutBreakpointRuntimeState
} from "@common/utils/breakpoint-filters";
import { compileCondition } from "@common/utils/breakpoint-condition/condition-checker";
import { compileLogTemplate } from "@common/utils/breakpoint-condition/logpoint-template";
import { conditionMachineFacts } from "@common/utils/breakpoint-condition/condition-machine";
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
 * **Binary breakpoints are authored; source breakpoints are only edited.** A `BreakpointInfo` is
 * address-bound (`address`, optionally `partition`), **bank-relative** (`bank` + `bankOffset`), or
 * source-bound (`resource` + `line`) — `getBreakpointDisplayKey` branches on exactly that. The
 * dialog authors the first two. Source-code breakpoints stay *placed* by the editor's glyph margin,
 * which tracks them as lines move and has its own undo/redo; the dialog's **source mode**
 * (`BreakpointFormState.source`) edits only their condition, hit rule and enabled state, and never
 * writes `resource`/`line` (`.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §4.4.2).
 *
 * The bank-relative kind is spelled into the **address field** — `05:+$0100` — rather than given
 * controls of its own. That is what `bp-set` accepts, so there is one spelling to learn and one
 * parser behind it; and it means the type selector, which already offers memory read and memory
 * write, is how a bank *watchpoint* gets made. A dedicated bank picker beside the partition picker
 * would have put two controls on screen that mean different things by "bank" — 16K banks and 8K
 * pages — which is the confusion §4.1 exists to have settled.
 */

/**
 * The six mutually exclusive breakpoint types.
 *
 * The first five are the `-r`/`-w`/`-i`/`-o` options (or none, for exec). `nextRegWrite` is the
 * ZX Spectrum Next's `nr:<register>` spec, and is the odd one out: the other five name a place to
 * watch, it names a machine event. That is why choosing it replaces the address field rather than
 * merely re-labelling it.
 *
 * This is the *form's* vocabulary. `BreakpointInfo` carries no `nextRegWrite` flag - a register in
 * `nextReg` is what makes a breakpoint one - so the two need not line up field for field.
 */
export type BreakpointKind =
  | "exec"
  | "memRead"
  | "memWrite"
  | "ioRead"
  | "ioWrite"
  | "nextRegWrite";

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
  /** Raw input, NextReg kind only: the register to watch, `$00`..`$FF`. */
  nextReg: string;
  /**
   * Whether the NextReg breakpoint filters on the written value.
   *
   * Explicit rather than derived from `nextRegValue` being non-empty, so that ticking the box
   * reveals an *empty* field the user must fill - which validation can then ask for. Deriving it
   * would force the box to author some default value the user never chose just to stay ticked.
   */
  filterValue: boolean;
  /** Raw input, NextReg kind only. Meaningful only while `filterValue` is set. */
  nextRegValue: string;
  /** Raw input, NextReg kind only. Empty means compare every bit. */
  nextRegMask: string;
  /** Also break when the copper writes the register, not only when the CPU does. */
  nextRegCopper: boolean;
  disabled: boolean;
  /**
   * "Remove after it stops" (`.plans/ASSERTIONS_WATCHPOINTS_ONE_SHOT_PLAN.md` §4.2): a one-shot,
   * session-owned and never saved (O2). Unticking it makes the breakpoint project-owned again.
   */
  oneShot: boolean;
  /** Raw input, memory kinds only: how many bytes the watchpoint covers (S10). Empty means one. */
  length: string;
  /**
   * The condition as typed (`.plans/CONDITIONAL_BREAKPOINTS_PLAN.md` §4.4.1). Empty means none.
   * Every kind carries one, source breakpoints included.
   */
  condition: string;
  /** The hit-count rule, or `"always"` for none. */
  hitMode: "always" | BreakpointHitMode;
  /** Raw input: the rule's N. Meaningful unless `hitMode` is `"always"`. */
  hitCount: string;
  /**
   * What the breakpoint does when its filters pass (`.plans/LOGPOINTS_PLAN.md` §4.5): stop the
   * machine, or log `logMessage` and continue - a logpoint.
   */
  action: "stop" | "log";
  /** The logpoint's template as typed (the Klive dialect). Meaningful when `action` is `"log"`. */
  logMessage: string;
  /**
   * **Source mode** (§4.4.2): the source breakpoint being edited. The editor places and tracks a
   * source breakpoint, so only its condition, hit rule and enabled state are editable here; its
   * location is shown, not authored. Absent for every other breakpoint.
   */
  source?: BreakpointInfo;
};

/** Messages that accept the form but deserve a note (unknown labels, shadowed names). */
export type FieldWarnings = Partial<Record<"condition" | "logMessage", string>>;

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
   * Whether `nr:<register>` means anything on this machine - the ZX Spectrum Next only.
   *
   * Enforced here and not merely in the UI, for the same reason as `supportsBankRelative`: a dialog
   * that authored what `bp-set` rejects would be bypassing the command layer's rule, not offering
   * a convenience.
   */
  supportsNextRegBreakpoints?: boolean;
  /**
   * `getBreakpointDisplayKey(bp, partitionLabels)` for every breakpoint currently set — **built with the
   * same `partitionLabels` map above**, or the duplicate check silently stops matching.
   */
  existingKeys: string[];
  /** The key being edited, exempt from the duplicate check. Absent when adding. */
  editingKey?: string;
  /**
   * The machine's id, for the condition checker's machine facts (§3.7 rules 3-5). Built with the
   * same helper the emulator arms with, from this id and `partitionLabels`.
   */
  machineId?: string;
  /**
   * The symbols condition labels resolve to - the last build's and the NEX sidecars'. A label
   * missing from it is a warning, not an error (§3.6). Absent: no label warnings.
   */
  conditionSymbols?: ConditionSymbols;
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
const BYTE_MAX = 0xff;

/** What the address field says when handed a `[file]:line` spec. */
export const SOURCE_SPEC_MESSAGE =
  "Set source-code breakpoints from the editor's left margin.";

const NUMBER_HINT = "for example $8000, 32768, or %1000000000000000";
const BYTE_HINT = "for example $07, 7, or %00000111";

/**
 * True for a breakpoint this dialog can author or edit.
 *
 * False only for source-bound breakpoints, which the editor's glyph margin owns: it places them by
 * clicking a line, tracks them as lines move, and has its own undo/redo. Every call site asks the
 * same question - may this breakpoint be opened in the dialog - so the name says that.
 *
 * It was `isBinaryBreakpoint` until NextReg breakpoints arrived. "Binary" meant "bound to an address
 * rather than to source", which already stopped being true when a bank-relative breakpoint qualified
 * and is plainly wrong for one bound to a register.
 */
export function isAuthorableBreakpoint(bp: BreakpointInfo | undefined): boolean {
  return (
    bp?.address !== undefined || isNextRegBreakpoint(bp ?? {}) || isBankRelative(bp ?? {})
  );
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
  return {
    kind: "exec",
    address: "",
    partition: undefined,
    ioMask: "",
    nextReg: "",
    filterValue: false,
    nextRegValue: "",
    nextRegMask: "",
    nextRegCopper: false,
    disabled: false,
    oneShot: false,
    length: "",
    condition: "",
    hitMode: "always",
    hitCount: "",
    action: "stop",
    logMessage: ""
  };
}

function isMemoryKind(kind: BreakpointKind): boolean {
  return kind === "memRead" || kind === "memWrite";
}

function isIoKind(kind: BreakpointKind): boolean {
  return kind === "ioRead" || kind === "ioWrite";
}

/** True for the one kind bound to a register rather than to a place. */
export function isNextRegKind(kind: BreakpointKind): boolean {
  return kind === "nextRegWrite";
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
  const nextReg = isNextRegKind(kind);
  return {
    ...form,
    kind,
    // --- A NextReg breakpoint has no address and no partition; the address field is not merely
    // --- re-labelled for it, it is replaced, so a value left here would be invisible *and*
    // --- unreachable.
    address: nextReg ? "" : form.address,
    partition: isIoKind(kind) || nextReg ? undefined : form.partition,
    ioMask: isIoKind(kind) ? form.ioMask : "",
    nextReg: nextReg ? form.nextReg : "",
    filterValue: nextReg ? form.filterValue : false,
    nextRegValue: nextReg ? form.nextRegValue : "",
    nextRegMask: nextReg ? form.nextRegMask : "",
    nextRegCopper: nextReg ? form.nextRegCopper : false,
    length: isMemoryKind(kind) ? form.length : ""
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
  const bp: BreakpointInfo = { ...formPlaceToBreakpointInfo(form), ...formFilters(form) };
  if (form.oneShot && form.action !== "log") {
    // --- A one-shot is session-owned and never saved (O2)
    bp.oneShot = true;
    bp.owner = { kind: "session" };
  } else if (bp.oneShot) {
    // --- "Keep after it stops": a regular, project-owned breakpoint again
    delete bp.oneShot;
    if (bp.owner?.kind === "session") delete bp.owner;
  }
  return bp;
}

/** The form's Length field as a byte count over 1, or `undefined` (one byte, or not a memory kind). */
function formLength(form: BreakpointFormState): number | undefined {
  if (!isMemoryKind(form.kind)) return undefined;
  const parsed = parseNumericInput(form.length);
  return parsed.ok && parsed.value > 1 ? parsed.value : undefined;
}

/**
 * The condition and hit rule the form describes, normalised like a stored breakpoint (a blank
 * condition or `"always"` says nothing). An unparseable count is dropped; validation refuses it.
 */
function formFilters(
  form: BreakpointFormState
): Pick<BreakpointInfo, "condition" | "hitMode" | "hitCount" | "logMessage" | "logDialect"> {
  const count = form.hitMode === "always" ? undefined : parseNumericInput(form.hitCount);
  return breakpointFiltersOf({
    condition: form.condition,
    ...(count?.ok ? { hitMode: form.hitMode as BreakpointHitMode, hitCount: count.value } : {}),
    // --- Stop leaves no template behind, so the action switch turns a logpoint back (L2)
    ...(form.action === "log" ? { logMessage: form.logMessage } : {})
  });
}

/** Where the breakpoint is and what it watches: everything but its filters. */
function formPlaceToBreakpointInfo(form: BreakpointFormState): BreakpointInfo {
  /*
   * Source mode: the editor's breakpoint, unchanged but for what the dialog edits. Its resolution
   * and owner come along, so saving does not disarm it until the next build. Its own filters and
   * any runtime state are dropped; `formFilters` supplies the edited ones.
   */
  if (form.source) {
    const {
      condition: _condition,
      hitMode: _hitMode,
      hitCount: _hitCount,
      logMessage: _logMessage,
      logDialect: _logDialect,
      ...place
    } = withoutBreakpointRuntimeState(form.source);
    return { ...place, disabled: form.disabled };
  }

  /*
   * A NextReg breakpoint, first and on its own branch.
   *
   * It shares no field with the other five: no address, no partition, no port mask. Emitting any of
   * them would build a breakpoint `DebugSupport` arms in two places at once - the register watch and
   * the address flags - so the branch returns rather than falling through.
   */
  if (isNextRegKind(form.kind)) {
    const reg = parseNumericInput(form.nextReg);
    const value = form.filterValue ? parseNumericInput(form.nextRegValue) : undefined;
    const mask = form.filterValue ? parseNumericInput(form.nextRegMask) : undefined;
    return {
      nextReg: reg.ok ? reg.value & BYTE_MAX : undefined,
      nextRegValue: value?.ok ? value.value & BYTE_MAX : undefined,
      // --- Only with a value: a mask alone masks nothing, and it is part of the key, so emitting
      // --- a stray one would name a breakpoint the user did not describe.
      nextRegMask: value?.ok && mask?.ok ? mask.value & BYTE_MAX : undefined,
      nextRegCopper: form.nextRegCopper,
      exec: false,
      memoryRead: false,
      memoryWrite: false,
      ioRead: false,
      ioWrite: false,
      disabled: form.disabled
    };
  }

  const mask = isIoKind(form.kind) ? parseNumericInput(form.ioMask) : undefined;

  // --- A bank-relative site instead of an address. Not for the I/O kinds, which watch a port and
  // --- have no bank at all — `validateBreakpointForm` refuses that combination, and emitting the
  // --- bank anyway would build a breakpoint the emulator's own guard rejects.
  const bankSite = isIoKind(form.kind) ? undefined : parseBankRelativeInput(form.address);
  if (bankSite?.ok) {
    const bankLength = formLength(form);
    return {
      bank: bankSite.bank,
      bankOffset: bankSite.bankOffset,
      exec: form.kind === "exec",
      memoryRead: form.kind === "memRead",
      memoryWrite: form.kind === "memWrite",
      ioRead: false,
      ioWrite: false,
      ...(bankLength !== undefined ? { length: bankLength } : {}),
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
    ...(formLength(form) !== undefined ? { length: formLength(form) } : {}),
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
  // --- The register is the binding, so it decides the kind before any flag is consulted - the
  // --- same order `buildBreakpointKey` uses, and for the same reason.
  const kind: BreakpointKind = isNextRegBreakpoint(bp)
    ? "nextRegWrite"
    : bp.memoryRead
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
    nextReg: bp.nextReg === undefined ? "" : `$${toHexa2(bp.nextReg)}`,
    filterValue: bp.nextRegValue !== undefined,
    nextRegValue: bp.nextRegValue === undefined ? "" : `$${toHexa2(bp.nextRegValue)}`,
    nextRegMask: bp.nextRegMask === undefined ? "" : `$${toHexa2(bp.nextRegMask)}`,
    nextRegCopper: bp.nextRegCopper ?? false,
    // --- The same spelling `getBreakpointDisplayKey` produces and `bp-set` accepts, so an edited
    // --- breakpoint round-trips through the field without changing its key.
    address: isBankRelative(bp)
      ? `${toHexa2(bp.bank).toUpperCase()}:+$${toHexa4(bp.bankOffset)}`
      : bp.address === undefined
        ? ""
        : `$${toHexa4(bp.address)}`,
    partition: bp.partition,
    ioMask: bp.ioMask === undefined ? "" : `$${toHexa4(bp.ioMask)}`,
    disabled: bp.disabled ?? false,
    oneShot: !!bp.oneShot,
    length: bp.length !== undefined && bp.length > 1 ? `${bp.length}` : "",
    condition: bp.condition ?? "",
    hitMode: effectiveHitMode(bp) ?? "always",
    hitCount: bp.hitCount === undefined ? "" : `${bp.hitCount}`,
    action: bp.logMessage ? "log" : "stop",
    logMessage: bp.logMessage ?? "",
    ...(bp.resource !== undefined ? { source: bp } : {})
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
  addFilterErrors(errors, form, env);

  // --- Source mode: the editor owns the place, so only the filters are judged (and there is no
  // --- key to collide - the breakpoint keeps its own)
  if (form.source) return errors;

  /*
   * The NextReg rules, on their own path.
   *
   * Not folded into the checks below with extra conditions: this kind has no address, no partition
   * and no port mask, so every one of those rules would have to be suppressed for it, and a rule
   * that is skipped is one more thing to get wrong than a rule that is not reached.
   */
  if (isNextRegKind(form.kind)) {
    if (!env.supportsNextRegBreakpoints) {
      errors.nextReg = "NextReg breakpoints are supported on the ZX Spectrum Next only.";
    } else {
      const reg = parseNumericInput(form.nextReg);
      if (!reg.ok) {
        errors.nextReg =
          reg.reason === "empty"
            ? "Enter a Next Register number."
            : `Enter a valid register, ${BYTE_HINT}.`;
      } else if (reg.value < 0 || reg.value > BYTE_MAX) {
        errors.nextReg = "A Next Register number is between $00 and $FF.";
      }
    }

    if (form.filterValue) {
      const value = parseNumericInput(form.nextRegValue);
      if (!value.ok) {
        errors.nextRegValue =
          value.reason === "empty"
            ? "Enter the value to break on."
            : `Enter a valid value, ${BYTE_HINT}.`;
      } else if (value.value < 0 || value.value > BYTE_MAX) {
        errors.nextRegValue = "A value is between $00 and $FF.";
      }

      const maskText = (form.nextRegMask ?? "").trim();
      if (maskText) {
        const mask = parseNumericInput(maskText);
        if (!mask.ok) {
          errors.nextRegMask = `Enter a valid mask, ${BYTE_HINT}.`;
        } else if (mask.value < 0 || mask.value > BYTE_MAX) {
          errors.nextRegMask = "A mask is between $00 and $FF.";
        }
      }
    } else if ((form.nextRegMask ?? "").trim()) {
      // --- Unreachable through the UI, which hides the field; checked because this module must be
      // --- correct against a hand-built state, as the header says.
      errors.nextRegMask = "A mask needs a value to mask.";
    }

    addDuplicateKeyError(errors, form, env);
    return errors;
  }

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

  // --- Length: optional, memory kinds only (S10)
  const lengthText = (form.length ?? "").trim();
  if (lengthText) {
    if (!isMemoryKind(form.kind)) {
      errors.length = "A length applies only to memory breakpoints.";
    } else {
      const parsed = parseNumericInput(lengthText);
      const start = parseNumericInput(addressText);
      if (!parsed.ok) {
        errors.length = "Enter a valid length, for example 5 or $10.";
      } else if (parsed.value < 1 || parsed.value > 0x1_0000) {
        errors.length = "The length must be between 1 and 65536.";
      } else if (start.ok && start.value + parsed.value > 0x1_0000) {
        errors.length = "A memory range cannot wrap past $FFFF.";
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

  addDuplicateKeyError(errors, form, env);

  return errors;
}

/** The condition and hit-count rules, the same for every kind and for source mode. */
function addFilterErrors(
  errors: FieldErrors,
  form: BreakpointFormState,
  env: BreakpointEnvironment
): void {
  const error = checkCondition(form, env).errors[0];
  if (error) errors.condition = formatConditionDiagnostic(error);

  if (form.action === "log") {
    if (!(form.logMessage ?? "").trim()) {
      errors.logMessage = "Enter the message to log.";
    } else {
      const logError = checkLogMessage(form, env).errors[0];
      if (logError) errors.logMessage = formatConditionDiagnostic(logError);
    }
  }

  if (form.hitMode !== "always") {
    const count = parseNumericInput(form.hitCount);
    if (!count.ok) {
      errors.hitCount =
        count.reason === "empty" ? "Enter the hit count." : "Enter a valid hit count, for example 10 or $0A.";
    } else if (!isValidBreakpointHitCount(count.value)) {
      errors.hitCount = `The hit count must be between 1 and ${MAX_BREAKPOINT_HIT_COUNT}.`;
    }
  }
}

/** The condition's diagnostics against this machine and these symbols; empty for no condition. */
function checkCondition(
  form: BreakpointFormState,
  env: BreakpointEnvironment
): { errors: ConditionDiagnostic[]; warnings: ConditionDiagnostic[] } {
  if (!(form.condition ?? "").trim()) return { errors: [], warnings: [] };
  const result = compileCondition(form.condition, {
    ...conditionMachineFacts(env.machineId, env.partitionLabels),
    accessKind: form.source ? "exec" : conditionAccessKindOf(form.kind),
    symbols: env.conditionSymbols
  });
  return { errors: result.errors, warnings: result.warnings };
}

/** The log template's diagnostics, compiled as the emulator will (the Klive dialect). */
function checkLogMessage(
  form: BreakpointFormState,
  env: BreakpointEnvironment
): { errors: ConditionDiagnostic[]; warnings: ConditionDiagnostic[] } {
  if (form.action !== "log" || !(form.logMessage ?? "").trim()) return { errors: [], warnings: [] };
  const result = compileLogTemplate(form.logMessage, "klive", {
    ...conditionMachineFacts(env.machineId, env.partitionLabels),
    accessKind: form.source ? "exec" : conditionAccessKindOf(form.kind),
    symbols: env.conditionSymbols
  });
  return { errors: result.errors, warnings: result.warnings };
}

/** The condition-language kind of a form's breakpoint type (`VAL`/`ADDR` depend on it). */
export function conditionAccessKindOf(kind: BreakpointKind): ConditionAccessKind {
  switch (kind) {
    case "memRead":
    case "memWrite":
      return "memory";
    case "ioRead":
    case "ioWrite":
      return "io";
    case "nextRegWrite":
      return "nextReg";
    default:
      return "exec";
  }
}

/** A condition message with its column, as the dialog shows it under the field. */
export function formatConditionDiagnostic(diagnostic: ConditionDiagnostic): string {
  return `Column ${diagnostic.start + 1}: ${diagnostic.message}`;
}

/**
 * The notes that accept the form anyway: labels missing from the symbol table (the breakpoint is
 * inactive until a build defines them, C14) and reserved names shadowing a label (R5).
 */
export function breakpointFormWarnings(
  form: BreakpointFormState,
  env: BreakpointEnvironment
): FieldWarnings {
  const result: FieldWarnings = {};
  const condition = checkCondition(form, env);
  if (!condition.errors.length && condition.warnings.length) {
    result.condition = condition.warnings.map(formatConditionDiagnostic).join("\n");
  }
  const log = checkLogMessage(form, env);
  if (!log.errors.length && log.warnings.length) {
    result.logMessage = log.warnings.map(formatConditionDiagnostic).join("\n");
  }
  return result;
}

/**
 * The one rule both validation paths share, applied only once every field the key is built from is
 * sound - a key derived from a field that did not parse names some other breakpoint.
 */
function addDuplicateKeyError(
  errors: FieldErrors,
  form: BreakpointFormState,
  env: BreakpointEnvironment
): void {
  if (Object.keys(errors).length > 0) return;
  const key = breakpointKeyOf(form, env);
  if (key !== undefined && key !== env.editingKey && env.existingKeys.includes(key)) {
    // --- `bp-set` silently merges onto an existing key, which reads as an update on the command
    // --- line but would look like a rename here. Refuse instead.
    errors.form = `A breakpoint already exists at ${key}.`;
  }
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
