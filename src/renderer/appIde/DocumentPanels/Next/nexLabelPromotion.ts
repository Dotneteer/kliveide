import type { NexBankAnnotation, NexFileAnnotations } from "./nexAnnotations";

import {
  DEFAULT_REGION,
  NEX_BANK_LAST_OFFSET,
  NEX_LABEL_MAX_LENGTH,
  NEX_MAX_BANK,
  getBankAnnotation,
  isValidNexLabelName
} from "./nexAnnotations";
import { withLabelChange } from "./nexAnnotationEdits";

/*
 * Turning a discovery into an annotation.
 *
 * The reverse-engineering loop has been one-way: the NEX viewer's labels flow *out* into the
 * listing and, since §13.1, into the live disassembly — but the moment you actually learn what a
 * routine is, you are paused in the debugger and the only place to write it down is a different
 * document. This closes it: name the address you are stopped at, from where you are stopped.
 *
 * A **local** label, always. The address is only meaningful as "offset X in bank B" — the same
 * routine is at a different Z80 address the next time the bank is paged somewhere else, which is
 * precisely what a local label expresses and a global one does not.
 *
 * Pure: the promotion is a function of the annotations, a bank site and a name, so what it does is
 * decided and tested without a machine or a file. See `.plans/NEX_DEBUGGING_PLAN.md` §13.3.
 */

/** Where the label goes: an offset inside one of the NEX's 16K banks. */
export type NexLabelTarget = { bank: number; bankOffset: number };

/**
 * The outcome of a promotion.
 *
 * Optional members rather than a union discriminated on `ok`: the project compiles with
 * `strictNullChecks: false`, under which TypeScript will not narrow a union by a boolean literal —
 * so `if (!result.ok) return result.error` fails to compile. This is the same shape
 * `NumericParseResult` in `breakpoint-form.ts` uses, for the same reason.
 */
export type NexLabelPromotion = {
  ok: boolean;
  /** Present when `ok`. */
  annotations?: NexFileAnnotations;
  /** Present when `ok` and the offset already carried another name. */
  replaced?: string;
  /** Present when not `ok`. */
  error?: string;
};

/**
 * Add a local label at a bank offset, returning the updated annotations.
 *
 * Refuses rather than overwrites when the name is already used in that bank: a name means one place,
 * and silently moving an existing label would lose whatever it was pointing at. Naming an offset
 * that *already* has a label is allowed and reported — two names for one address is unusual but the
 * model permits it, and a routine with both a technical and a descriptive name is a real thing.
 */
export function promoteLabelAt(
  annotations: NexFileAnnotations | undefined,
  target: NexLabelTarget,
  name: string
): NexLabelPromotion {
  if (!annotations) {
    return { ok: false, error: "This NEX file has no annotations to add a label to." };
  }

  const trimmed = name.trim();
  if (!isValidNexLabelName(trimmed)) {
    return {
      ok: false,
      error: `Use an identifier name of up to ${NEX_LABEL_MAX_LENGTH} characters.`
    };
  }
  if (!Number.isInteger(target.bank) || target.bank < 0 || target.bank > NEX_MAX_BANK) {
    return { ok: false, error: "That address is not in one of this file's banks." };
  }
  if (
    !Number.isInteger(target.bankOffset) ||
    target.bankOffset < 0 ||
    target.bankOffset > NEX_BANK_LAST_OFFSET
  ) {
    return { ok: false, error: "Local label values must be in $0000..$3FFF." };
  }

  const existing = getBankAnnotation(annotations, target.bank);
  if (existing?.localLabels?.some((label) => label.name === trimmed)) {
    return {
      ok: false,
      error: `Bank $${target.bank.toString(16).toUpperCase().padStart(2, "0")} already has a label named ${trimmed}.`
    };
  }

  /*
   * The bank may have no annotation yet, and `withLabelChange` declines for a bank it cannot find.
   *
   * A NEX's banks are all described when a sidecar is created, so this is the case where the label
   * is going into a bank added to the file afterwards — or into a sidecar written by hand. Creating
   * the entry with the same default a new sidecar uses is the only answer that does not lose the
   * label, and it is what the viewer would have shown for that bank anyway.
   */
  const withBank: NexFileAnnotations = existing
    ? annotations
    : {
        ...annotations,
        banks: {
          ...annotations.banks,
          [String(target.bank)]: {
            offsetIndex: 0,
            regions: [{ ...DEFAULT_REGION }]
          } as NexBankAnnotation
        }
      };

  const updated = withLabelChange(withBank, target.bank, {
    action: "save",
    scope: "local",
    name: trimmed,
    value: target.bankOffset
  });
  if (!updated) {
    return { ok: false, error: "The label could not be added to this bank." };
  }

  // --- Reported, not refused: a second name for an address the user already named.
  const alsoNamed = existing?.localLabels?.find((label) => label.value === target.bankOffset)?.name;
  return alsoNamed ? { ok: true, annotations: updated, replaced: alsoNamed } : {
    ok: true,
    annotations: updated
  };
}
