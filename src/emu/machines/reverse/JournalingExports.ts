/*
 * The journaling wrapper over a core's exports (`.plans/REVERSE_DEBUGGING_PLAN.md` D7, D8, Phase 1).
 *
 * `installJournal` replaces `runtime.exports` with an object that passes `pure`, `debug` and
 * `execution` exports straight through and routes every `journaled` one (`exportContract.ts`)
 * through the journal: recorded with the current position while the journal records, dropped while
 * it is muted for a replay. It also attaches the hook that journals the host's direct memory writes
 * (`coreMemoryWrites.ts`). Replay applies entries through the unwrapped exports and memory.
 *
 * A WebAssembly exports object cannot be changed in place, which is why the wrapper replaces it; the
 * machines read `runtime.exports.<name>` at each call, so they go through it without knowing.
 */

import { setCoreWriteHook } from "./coreMemoryWrites";
import { classifyExport } from "./exportContract";
import type { InputJournal, JournalEntry } from "./InputJournal";
import type { HistoryPositionPort } from "./timelinePosition";

/** A core runtime: its exports (with `memory`) are what the journal wraps */
export type JournaledRuntime = { exports: object };

type ExportFn = (...args: number[]) => unknown;

export type JournalHandle = {
  /** The unwrapped exports */
  readonly raw: Record<string, ExportFn> & { memory: WebAssembly.Memory };
  /** Exports the contract does not classify, journaled to be safe (the contract test fails on them) */
  readonly unclassified: readonly string[];
  /** Applies one entry to the core, bypassing the journal (replay) */
  apply(entry: JournalEntry): void;
  /** Puts the original exports back and detaches the memory hook */
  dispose(): void;
};

/**
 * Installs a journal on a core runtime
 * @param coreId The core (`exportContract.ts`'s ids: "sp48", "zxnext", ...)
 */
export function installJournal(
  runtime: JournaledRuntime,
  coreId: string,
  journal: InputJournal,
  port: HistoryPositionPort
): JournalHandle {
  const original = runtime.exports as Record<string, unknown> & { memory: WebAssembly.Memory };
  const raw = original as Record<string, ExportFn> & { memory: WebAssembly.Memory };
  const wrapped: Record<string, unknown> = { ...original };
  const unclassified: string[] = [];
  for (const [name, value] of Object.entries(original)) {
    if (typeof value !== "function") continue;
    const cls = classifyExport(coreId, name);
    if (cls === undefined) unclassified.push(name);
    else if (cls !== "journaled") continue;
    const fn = value as ExportFn;
    wrapped[name] = (...args: number[]) => {
      if (journal.mode === "mute") {
        journal.dropped++;
        return 0;
      }
      journal.append({ kind: "call", position: port.position, exportName: name, args: args.map((a) => Number(a)) });
      return fn(...args);
    };
  }
  (runtime as { exports: object }).exports = wrapped;
  setCoreWriteHook(runtime, {
    beforeWrite: (address, length, bytes, fill) => {
      if (journal.mode === "mute") {
        journal.dropped++;
        return false;
      }
      journal.append({ kind: "write", position: port.position, address, length, bytes, fill });
      return true;
    }
  });
  return {
    raw,
    unclassified,
    apply: (entry) => {
      if (entry.kind === "call") {
        raw[entry.exportName](...entry.args);
        return;
      }
      const memory = new Uint8Array(raw.memory.buffer);
      if (entry.bytes) memory.set(entry.bytes, entry.address);
      else memory.fill(entry.fill ?? 0, entry.address, entry.address + entry.length);
    },
    dispose: () => {
      (runtime as { exports: object }).exports = original;
      setCoreWriteHook(runtime, undefined);
    }
  };
}
