import type { ExecutionHistoryInfo } from "@common/history/historyTypes";
import type { HistoryRecord } from "@common/history/historyRecord";

/*
 * The Execution History document's model (`.plans/EXECUTION_HISTORY_VIEWER_PLAN.md` §4.6, §6.3):
 * which records are loaded, which one is selected, the filter and the empty states. Pure - no React,
 * no Emu API - so the decisions are tested without rendering (`.ai/ui-mvc-guide.md`).
 *
 * Rows are identified by sequence number, never by position: the ring overwrites its oldest record
 * on every instruction, so "row 12" means something else after each stop, while sequence 4711 is the
 * same record until it leaves the ring. The selection is a sequence for the same reason, and it is
 * what G4.3's history cursor binds to (§4.6.4).
 */

/** Records per page: what one read fetches (§4.6.3) */
export const HISTORY_PAGE_SIZE = 512;

/** The page a sequence number is on. Pages are aligned to sequences, so they survive new records. */
export function historyPageOf(sequence: number): number {
  return Math.floor(sequence / HISTORY_PAGE_SIZE);
}

export type HistoryViewState = {
  info?: ExecutionHistoryInfo;
  /** Loaded pages by page index (`historyPageOf`) */
  pages: ReadonlyMap<number, readonly HistoryRecord[]>;
  /** The selected record's sequence number */
  selected?: number;
  /** Keep the newest record in view after every stop */
  followNewest: boolean;
  filter: string;
};

export type HistoryEvent =
  | { type: "infoLoaded"; info: ExecutionHistoryInfo | undefined }
  | { type: "pageLoaded"; generation: number; firstSequence: number; records: readonly HistoryRecord[] }
  | { type: "selected"; sequence: number | undefined }
  | { type: "followChanged"; follow: boolean }
  | { type: "filterChanged"; filter: string };

export const initialHistoryViewState: HistoryViewState = {
  pages: new Map(),
  followNewest: true,
  filter: ""
};

export function reduceHistoryView(state: HistoryViewState, event: HistoryEvent): HistoryViewState {
  switch (event.type) {
    case "infoLoaded": {
      const previous = state.info;
      const info = event.info;
      if (!info) return previous ? { ...state, info: undefined, pages: new Map(), selected: undefined } : state;
      if (!previous || previous.generation !== info.generation || previous.machineId !== info.machineId) {
        // --- Cleared (or another machine): every cached record is stale
        return { ...state, info, pages: new Map(), selected: undefined };
      }
      if (
        previous.newestSequence === info.newestSequence &&
        previous.count === info.count &&
        previous.enabled === info.enabled
      ) {
        return state;
      }
      // --- The previous newest record may have grown since (HALT and DMA holds coalesce into it), and
      // --- the pages that fell out of the ring are of no use
      const stalePage = historyPageOf(previous.newestSequence);
      const pages = new Map<number, readonly HistoryRecord[]>();
      for (const [page, records] of state.pages) {
        if (page >= stalePage) continue;
        if ((page + 1) * HISTORY_PAGE_SIZE - 1 < info.oldestSequence) continue;
        pages.set(page, records);
      }
      const selected =
        state.selected !== undefined && state.selected >= info.oldestSequence && info.count > 0 ? state.selected : undefined;
      return { ...state, info, pages, selected };
    }
    case "pageLoaded": {
      if (!state.info || state.info.generation !== event.generation || !event.records.length) return state;
      const pages = new Map(state.pages);
      // --- A read may span pages; file each record under its own page
      let i = 0;
      while (i < event.records.length) {
        const sequence = event.firstSequence + i;
        const page = historyPageOf(sequence);
        const pageStart = page * HISTORY_PAGE_SIZE;
        const take = Math.min(event.records.length - i, pageStart + HISTORY_PAGE_SIZE - sequence);
        const existing = pages.get(page);
        const merged = mergePage(existing, pageStart, sequence, event.records.slice(i, i + take));
        pages.set(page, merged);
        i += take;
      }
      return { ...state, pages };
    }
    case "selected":
      if (state.selected === event.sequence) return state;
      return { ...state, selected: event.sequence, followNewest: event.sequence === undefined ? state.followNewest : false };
    case "followChanged":
      return state.followNewest === event.follow ? state : { ...state, followNewest: event.follow };
    case "filterChanged":
      return state.filter === event.filter ? state : { ...state, filter: event.filter };
  }
}

/** A page's records with a run filed in, kept dense from the page's first held sequence */
function mergePage(
  existing: readonly HistoryRecord[] | undefined,
  pageStart: number,
  from: number,
  run: readonly HistoryRecord[]
): readonly HistoryRecord[] {
  const slots: (HistoryRecord | undefined)[] = [];
  for (const r of existing ?? []) slots[r.sequence - pageStart] = r;
  run.forEach((r, i) => (slots[from - pageStart + i] = r));
  return slots.filter((r): r is HistoryRecord => r !== undefined);
}

// ------------------------------------------------------------------------------------------------
// Selectors

/** Rows in the unfiltered list: one per held record, oldest first */
export function historyRowCount(state: HistoryViewState): number {
  return state.info?.count ?? 0;
}

/** The sequence number of an unfiltered row */
export function historySequenceAt(state: HistoryViewState, row: number): number | undefined {
  const info = state.info;
  if (!info || row < 0 || row >= info.count) return undefined;
  return info.oldestSequence + row;
}

/** The unfiltered row of a sequence number, or -1 when it is not held */
export function historyRowOf(state: HistoryViewState, sequence: number): number {
  const info = state.info;
  if (!info || sequence < info.oldestSequence || sequence > info.newestSequence) return -1;
  return sequence - info.oldestSequence;
}

/** A loaded record */
export function historyRecordAt(state: HistoryViewState, sequence: number): HistoryRecord | undefined {
  const records = state.pages.get(historyPageOf(sequence));
  if (!records?.length) return undefined;
  const r = records[sequence - records[0].sequence];
  return r?.sequence === sequence ? r : records.find((x) => x.sequence === sequence);
}

/** −1 for the newest record, −2 for the one before (G4.3's step numbering) */
export function historyStepOf(state: HistoryViewState, sequence: number): number {
  return sequence - (state.info?.newestSequence ?? sequence) - 1;
}

/**
 * The page reads a range of sequences still needs, each as `[fromSequence, count]`, clipped to what
 * the ring holds
 */
export function missingHistoryPages(state: HistoryViewState, from: number, to: number): [number, number][] {
  const info = state.info;
  if (!info || info.count === 0) return [];
  const lo = Math.max(from, info.oldestSequence);
  const hi = Math.min(to, info.newestSequence);
  const reads: [number, number][] = [];
  for (let page = historyPageOf(lo); page <= historyPageOf(hi); page++) {
    const start = Math.max(page * HISTORY_PAGE_SIZE, info.oldestSequence);
    const end = Math.min((page + 1) * HISTORY_PAGE_SIZE - 1, info.newestSequence);
    const have = state.pages.get(page);
    if (have && have.length === end - start + 1 && have[0].sequence === start) continue;
    reads.push([start, end - start + 1]);
  }
  return reads;
}

// ------------------------------------------------------------------------------------------------
// Empty states (§4.6.1)

export type HistoryEnvironment = {
  /** The machine records history (`MF_EXEC_HISTORY`) */
  supported: boolean;
  /** The machine is running (not paused or stopped) */
  running: boolean;
  /** The current or last run is a debug session */
  debugging: boolean;
};

/** The message the document shows instead of rows, or undefined when it has rows to show */
export function historyEmptyMessage(env: HistoryEnvironment, info: ExecutionHistoryInfo | undefined): string | undefined {
  if (!env.supported) return "This machine does not record execution history";
  if (env.running) return "Running — history updates at the next stop";
  if (!info || info.count === 0) {
    return env.debugging || info?.enabled
      ? "No history yet"
      : "History is recorded only when the machine is started with debugging";
  }
  return undefined;
}

/** The header's "12,345 of 131,072 recorded" */
export function historyCountText(info: ExecutionHistoryInfo | undefined): string {
  if (!info) return "";
  return `${info.count.toLocaleString("en-US")} of ${info.capacity.toLocaleString("en-US")} recorded`;
}

// ------------------------------------------------------------------------------------------------
// The filter (§4.6.2): an address, a range, a label, or free text over the instruction

export type HistoryFilter =
  | { kind: "none" }
  | { kind: "address"; from: number; to: number }
  | { kind: "text"; text: string };

const NUMBER = /^(?:\$([0-9a-f]{1,4})|0x([0-9a-f]{1,4})|#([0-9a-f]{1,4})|([0-9a-f]{1,4})h|(\d{1,5}))$/i;

function parseAddress(text: string, symbols: Record<string, number>): number | undefined {
  const t = text.trim();
  const m = NUMBER.exec(t);
  if (m) {
    const value = m[5] !== undefined ? parseInt(m[5], 10) : parseInt(m[1] ?? m[2] ?? m[3] ?? m[4], 16);
    return value <= 0xffff ? value : undefined;
  }
  const symbol = symbols[t.toLowerCase()];
  return symbol !== undefined && symbol >= 0 && symbol <= 0xffff ? symbol : undefined;
}

/**
 * Parses the filter field
 * @param text What the user typed
 * @param symbols The compilation's integer symbols, lower-cased (`integerSymbolsOf`)
 */
export function parseHistoryFilter(text: string, symbols: Record<string, number> = {}): HistoryFilter {
  const t = text.trim();
  if (!t) return { kind: "none" };
  const range = /^(.+?)\s*(?:-|\.\.)\s*(.+)$/.exec(t);
  if (range) {
    const from = parseAddress(range[1], symbols);
    const to = parseAddress(range[2], symbols);
    if (from !== undefined && to !== undefined) return { kind: "address", from: Math.min(from, to), to: Math.max(from, to) };
  }
  const address = parseAddress(t, symbols);
  if (address !== undefined) return { kind: "address", from: address, to: address };
  return { kind: "text", text: t.toLowerCase() };
}

/** Whether a row passes the filter; `instruction` is its disassembly (needed for a text filter) */
export function historyRowMatches(filter: HistoryFilter, record: HistoryRecord, instruction?: string): boolean {
  switch (filter.kind) {
    case "none":
      return true;
    case "address":
      return record.regs.pc >= filter.from && record.regs.pc <= filter.to;
    case "text":
      return (instruction ?? "").toLowerCase().includes(filter.text);
  }
}
