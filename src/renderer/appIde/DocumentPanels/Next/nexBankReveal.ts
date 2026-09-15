import type { MemoryPageInfo } from "@emu/machines/zxNext/MemoryDevice";

import { bank16kAtAddress } from "./nextBankLocation";
import { getNexLoad } from "./nexLoadSession";
import { loadNexFileContents } from "./nexFileLoader";
import { getNexAnnotationPath } from "./nexAnnotations";

/*
 * Follow the program counter into whichever NEX bank it is in, on every pause.
 *
 * This replaced a one-shot "reveal the entry point's bank" record armed by `nex-run -e`. That was
 * wrong twice over. It fired on the **first** pause after arming, and the injection flow pauses the
 * machine itself — `ReachExecPoint` pauses before it runs — so the bank appeared long before the
 * entry point was reached. And it answered only the first question: once stopped, stepping on into
 * another bank left the wrong document open.
 *
 * Driving it from the program counter fixes both. The entry-point stop is no longer special — it is
 * simply the first pause whose PC is inside a bank of the file — and a jump from bank 5 to `$A624`
 * brings bank 2 forward on the next stop. It also stays quiet during the launch by construction: the
 * flow's own pauses happen with the PC in the ROM, where there is no RAM bank to name.
 *
 * The live MMU decides which bank is at the PC, not the NEX header's start-up mapping: a program is
 * free to page something else in, and after it has, the header is a statement about a moment that
 * has passed.
 *
 * Written against injected operations rather than `useEmuApi`/`useDocumentHubService` so the decision
 * — which bank, based at what, scrolled where, and when to do nothing — is testable without a
 * machine, an IDE, or a React tree.
 *
 * See `.plans/CSPECT_DIFFERENTIAL_DEBUGGING_PLAN.md` §15.17.
 */

export type NexBankRevealDeps = {
  /** The program counter at the pause being responded to. */
  getPc: () => Promise<number>;
  /** The live 8K page map, which says what is actually visible where. */
  getPageInfo: () => Promise<MemoryPageInfo[] | undefined>;
  /** Reads the NEX file back, to get the bank's bytes. */
  readFile: (path: string) => Promise<Uint8Array>;
  /** Opens (or focuses, and re-points) the bank's document. */
  openBank: (request: NexBankRevealRequest) => Promise<void>;
};

export type NexBankRevealRequest = {
  /** Host path of the NEX the bank belongs to. */
  path: string;
  bank: number;
  /** The bank's 16,384 bytes, as they are in the file. */
  contents: Uint8Array;
  /** Where the bank's byte 0 is seen right now — what the listing is based on. */
  disassOffset: number;
  /** The program counter, to scroll to. */
  topAddress: number;
  /**
   * The annotation *sidecar* for the file — `<name>.nex.dis`, not the NEX itself.
   *
   * Derived here rather than at the call site because getting it wrong is silent and confusing:
   * handing the annotation session the `.nex` made it read a binary as its JSON and report
   * "Annotation file contains validation errors" the moment a bank was revealed.
   */
  annotationPath: string;
};

/**
 * Why a reveal did nothing, or that it happened.
 *
 * Returned rather than logged: every one of these is a legitimate outcome that a test should be able
 * to assert, and "nothing happened" has four quite different causes worth telling apart.
 */
export type NexBankRevealOutcome =
  | "no-nex-session"
  | "not-in-ram"
  | "not-a-bank-of-this-nex"
  | "bank-not-in-file"
  | "revealed";

/*
 * The parsed file, kept for as long as the same NEX is the one that was launched.
 *
 * Without this every pause — every single step — would re-read and re-parse the whole file, which
 * for a NEX carrying tens of banks is megabytes. Keyed by path so a different launch cannot be
 * served a previous program's banks.
 */
let cachedPath: string | undefined;
let cachedBanks: Map<number, Uint8Array> | undefined;

/** Forget the parsed file. For tests, and for anything that invalidates it. */
export function resetNexBankRevealCacheForTests(): void {
  cachedPath = undefined;
  cachedBanks = undefined;
}

async function bankBytesFor(
  path: string,
  bank: number,
  readFile: NexBankRevealDeps["readFile"]
): Promise<Uint8Array | undefined> {
  if (cachedPath !== path || !cachedBanks) {
    const loaded = loadNexFileContents(await readFile(path));
    if (!loaded.fileInfo) return undefined;
    cachedBanks = new Map(loaded.fileInfo.bankData);
    cachedPath = path;
  }
  return cachedBanks.get(bank);
}

/**
 * Reveal the bank the program counter is in, if there is one worth revealing.
 *
 * Silent about failures on purpose: this is a convenience layered on a stop that has already
 * happened and been reported, and an error because a file moved would be worse than not scrolling.
 */
export async function revealNexBankAtPc(
  deps: NexBankRevealDeps
): Promise<NexBankRevealOutcome> {
  const session = getNexLoad();
  if (!session) return "no-nex-session";

  const pc = await deps.getPc();
  const located = bank16kAtAddress(await deps.getPageInfo(), pc);
  // --- ROM, or a slot the MMU says nothing usable about. During the launch flow this is the
  // --- answer every time, which is what keeps this quiet until the program itself is running.
  if (!located) return "not-in-ram";

  // --- A bank the running program paged in that this file never carried is not ours to show.
  if (!session.banks.includes(located.bank)) return "not-a-bank-of-this-nex";

  const contents = await bankBytesFor(session.path, located.bank, deps.readFile);
  if (!contents) return "bank-not-in-file";

  await deps.openBank({
    path: session.path,
    bank: located.bank,
    contents,
    disassOffset: located.baseAddress,
    topAddress: pc,
    annotationPath: getNexAnnotationPath(session.path)
  });
  return "revealed";
}
