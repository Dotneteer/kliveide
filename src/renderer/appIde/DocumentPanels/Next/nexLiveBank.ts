import { MachineControllerState } from "@abstractions/MachineControllerState";

import { NEX_BANK_SIZE } from "./nexAnnotations";

/**
 * Whether there is a machine whose memory means anything yet.
 *
 * The distinction matters because a machine that has been *created* answers questions long before it
 * has been *started*: `getNextMemoryMapping` returns a default mapping and every partition reads back
 * as zeros. Nothing errors, so a "can the machine answer?" test passes and the answers are all claims
 * about a machine that has never executed an instruction — a popped-out bank would drop the file's
 * bytes and show 16K of `nop`, which looks exactly like a successfully decoded program.
 *
 * `None` and `Stopped` are the two states that mean "off", matching `ExecutionControls`' own
 * `isStopped` — including the `null` case, which is what the selector gives before any machine
 * exists.
 */
export function machineHasRun(state: MachineControllerState | undefined): boolean {
  return (
    state != null &&
    state !== MachineControllerState.None &&
    state !== MachineControllerState.Stopped
  );
}

/*
 * A NEX bank's bytes as they are in the machine *now*, against the bytes the file holds.
 *
 * The popped-out bank has always shown the file. That is the right default — it is a file viewer —
 * but it means the one thing a debugger most wants to see is invisible: what the program did to the
 * bank after it was loaded. Self-modifying code, a decompressed payload written over its own
 * compressed source, a bank corrupted by a stray write; all of it looks identical to a clean load.
 *
 * The diff is nearly free because both arrays are already in hand, which is why §11.3 of
 * `.plans/NEX_DEBUGGING_PLAN.md` calls this the only item in Phase 6 that shows something currently
 * undiscoverable.
 */

/**
 * The two 8K partition indices holding a 16K bank, low half first.
 *
 * The emulator reads memory one **partition** at a time and a Next partition is 8K
 * (`getMemoryPartition` returns `0x2000` bytes for any non-negative index), so a 16K bank is two
 * reads. The pairing is Q9's: 16K bank *B* is 8K pages `2B` and `2B+1` — the same derivation
 * `bankRelativePartition` uses to place a bank-relative breakpoint, and deliberately the same
 * function-free arithmetic rather than a second opinion about it.
 */
export function bankPartitions(bank: number): [number, number] {
  return [bank * 2, bank * 2 + 1];
}

/**
 * Join a bank's two 8K halves into its 16K image.
 *
 * `undefined` when either half is missing or the wrong size, rather than a short or zero-padded
 * array: a partial bank compared against the file would report every byte past the join as changed,
 * which is a screen full of false positives rather than a missing feature.
 */
export function joinBankHalves(
  low: Uint8Array | undefined,
  high: Uint8Array | undefined
): Uint8Array | undefined {
  const half = NEX_BANK_SIZE / 2;
  if (!low || !high || low.length !== half || high.length !== half) return undefined;

  const joined = new Uint8Array(NEX_BANK_SIZE);
  joined.set(low, 0);
  joined.set(high, half);
  return joined;
}

/**
 * Are these two reads of a bank the same bytes?
 *
 * The live view refetches on every tick, so it produces a fresh `Uint8Array` whether or not the
 * machine wrote anything. Left alone, that new array identity is a *change* to every consumer that
 * keys off it — and since the disassembly is now rebuilt from the live bytes, a bank nobody is
 * writing to would re-disassemble a few times a second and hand the listing a new array each time.
 *
 * Comparing 16K is a few microseconds and turns "the bytes arrived again" into "the bytes are
 * different", which is the question every consumer actually has. `useNexLiveBankBytes` uses it to
 * keep the previous array identity when nothing moved, so React bails out of the re-render.
 */
export function sameBankBytes(
  a: Uint8Array | undefined,
  b: Uint8Array | undefined
): boolean {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/** Which bytes of the bank differ from the file, and how many. */
export type BankDiff = {
  /** One entry per byte: `1` where the live value differs from the file's. */
  mask: Uint8Array;
  changed: number;
};

/**
 * Compare the live bank against the file's.
 *
 * `undefined` when there is nothing to compare, or when the two are not the same length — a diff
 * between arrays of different sizes has no meaning here, and guessing an alignment would mark bytes
 * that were never compared.
 */
export function diffBankBytes(
  fileBytes: Uint8Array | undefined,
  liveBytes: Uint8Array | undefined
): BankDiff | undefined {
  if (!fileBytes || !liveBytes || fileBytes.length !== liveBytes.length) return undefined;

  const mask = new Uint8Array(fileBytes.length);
  let changed = 0;
  for (let i = 0; i < fileBytes.length; i++) {
    if (fileBytes[i] !== liveBytes[i]) {
      mask[i] = 1;
      changed++;
    }
  }
  return { mask, changed };
}

/**
 * What the header says about the diff.
 *
 * `undefined` when the bank is untouched: the absence of the readout says "same as the file" more
 * clearly than a `0 changed` would, and it keeps a crowded toolbar quiet in the ordinary case.
 */
export function formatBankDiff(
  diff: BankDiff | undefined
): { text: string; title: string } | undefined {
  if (!diff || diff.changed === 0) return undefined;

  const total = diff.mask.length;
  const percent = Math.round((diff.changed / total) * 100);
  return {
    text: `${diff.changed} changed`,
    title:
      `${diff.changed} of ${total} bytes in this bank differ from the file ` +
      `(${percent === 0 ? "<1" : percent}%). ` +
      "The program has written to the bank since it was loaded — or the loader decompressed into " +
      "it. Changed bytes are marked in the memory dump."
  };
}

/**
 * The changed-byte flags for one dump row, or `undefined` when nothing in it changed.
 *
 * `undefined` rather than an array of `false`s, for two reasons that point the same way: a row with
 * no marks should allocate nothing and render no overlays, and an unmodified bank is the ordinary
 * case — a 16K bank is 2048 rows and almost all of them are usually untouched.
 *
 * A plain `boolean[]` rather than a `Uint8Array` view: the consumer is a React prop compared
 * element-wise by a memo comparator, and a subarray view would alias the mask, so a later diff
 * would mutate flags a row is still rendering.
 */
export function changedFlagsIn(
  diff: BankDiff | undefined,
  start: number,
  length: number
): boolean[] | undefined {
  if (!diff) return undefined;

  let any = false;
  const flags: boolean[] = new Array(length);
  for (let i = 0; i < length; i++) {
    const changed = diff.mask[start + i] === 1;
    flags[i] = changed;
    if (changed) any = true;
  }
  return any ? flags : undefined;
}
