import { hostFileName } from "@common/utils/nex-launch-paths";

/*
 * Which NEX file was launched in this session, and which banks it carries.
 *
 * The Memory Mapping panel shows a 16K bank number per slot and nothing about where that bank's
 * contents came from. This supplies the missing half: that bank `$20` is one of the banks of the NEX
 * you launched, so you know which pop-out to open.
 *
 * **What this deliberately does not claim.** RAM has no provenance: nothing in the machine records
 * that a bank was written by a NEX loader rather than by the program, a tape, or another NEX loaded
 * afterwards. So the wording is a fact about the *file* — "bank $20 is one of Game.nex's banks" —
 * and not about the bank's current contents, which the program is free to have overwritten. A label
 * that said "this slot holds bank $20 of Game.nex" would be unverifiable and sometimes false, and a
 * mark that is wrong but confident is worse than no mark (the same reason §11.4's PC spotlight only
 * shows while paused).
 *
 * A module singleton rather than app state: it is read on the Memory Mapping panel's existing
 * refresh tick, so nothing needs to re-render on the change, and both the launch command and the
 * panel live in the IDE renderer. `nexAnnotationSession` and `useNexBankBreakpoints` use the same
 * pattern for the same reason.
 *
 * See `.plans/NEX_DEBUGGING_PLAN.md` §11.5.
 */

/** The NEX launched in this session. */
export type NexLoadSession = {
  /** The host path it was launched from. */
  path: string;
  /** Its file name, which is what a tooltip should say. */
  fileName: string;
  /** The 16K banks its header declares. */
  banks: number[];
};

let session: NexLoadSession | undefined;

/**
 * Record that a NEX was launched.
 *
 * Replaces any previous one: two NEX files cannot both be the one that was launched, and leaving
 * the old record in place would attribute the new program's banks to the wrong file.
 */
export function recordNexLoad(path: string, banks: number[]): void {
  session = { path, fileName: hostFileName(path), banks: [...banks] };
}

/**
 * Forget the launched NEX.
 *
 * Called when a launch begins and its header cannot be read: the previous record must not survive
 * into a session running a different program, which is the one way this could state something
 * actively misleading.
 */
export function clearNexLoad(): void {
  session = undefined;
}

/** The NEX launched in this session, if any. */
export function getNexLoad(): NexLoadSession | undefined {
  return session;
}

/** Forget everything. For tests, which must not leak state between cases. */
export function resetNexLoadSessionForTests(): void {
  session = undefined;
}

/**
 * The provenance line for a 16K bank, or `undefined` when there is nothing to say.
 *
 * Pure, and separate from the registry above, so the wording and the matching can be tested without
 * a launch having happened.
 *
 * A negative or absent bank is a ROM or unpaged page and never has provenance; `0xff` is the
 * placeholder both machines use for "no 16K bank", so it is excluded rather than looked up — a NEX
 * cannot declare bank `$FF` anyway, since the format's banks stop at 111.
 */
export function describeNexBankProvenance(
  loaded: NexLoadSession | undefined,
  bank16k: number | null | undefined
): string | undefined {
  if (!loaded || bank16k === null || bank16k === undefined) return undefined;
  if (bank16k < 0 || bank16k === 0xff) return undefined;
  if (!loaded.banks.includes(bank16k)) return undefined;

  return (
    `This is one of ${loaded.fileName}'s banks, as launched — ` +
    "the program may have changed it since."
  );
}
