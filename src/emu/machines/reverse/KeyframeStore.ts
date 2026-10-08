/*
 * Page-shared keyframes (`.plans/REVERSE_DEBUGGING_PLAN.md` D5, D6, T5).
 *
 * A keyframe is a full page table over a pool of immutable, reference-counted 4 KiB pages. A page
 * equal to the same page of the previous keyframe is shared, so a keyframe costs only the pages that
 * changed; there is no base keyframe to rebase, and evicting one only drops references.
 *
 * What a keyframe leaves out:
 * - the core's *volatile* statics (the layout stamp's list, as in a state file) and the C shadow
 *   stack (T20): a restore keeps the live bytes there;
 * - unless it is *complete*, the *frame-boundary scratch* (T5): buffers a core rewrites before it reads
 *   them - the picture, layer and audio buffers - which a keyframe taken at a frame boundary need not
 *   store. Only ranges `test/wasm/reverse/scratch-buffers.test.ts` proves go here. A keyframe taken
 *   mid-frame (a transient one) must be complete.
 *
 * Keyframes are kept in position order. *Transient* keyframes (§4.3) are dropped every few thousand
 * instructions near a navigation target, so the next Step Back replays only from there; they sit
 * between the others, stay outside the budget and are kept in a small least-recently-used set.
 */

import type { WasmLayout } from "../state/wasmLayout";
import type { PositionSeed, TimelinePosition } from "./timelinePosition";
import { comparePositions } from "./timelinePosition";

export const KEYFRAME_PAGE_SIZE = 4096;
const PAGE_WORDS = KEYFRAME_PAGE_SIZE / 4;

/** A byte range of linear memory */
export type MemoryRange = { address: number; size: number };

/** One keyframe */
export type Keyframe = {
  readonly id: number;
  /** Where in the instruction stream it was taken */
  readonly seed: PositionSeed;
  /** The machine frame counter when it was taken (diagnostics) */
  readonly frame: number;
  /** The journal entries before this index are already in the image */
  readonly journalIndex: number;
  /** Page index -> pool page, or -1 for a page the keyframe leaves out entirely */
  readonly pages: Int32Array;
  /** The pages this keyframe added to the pool */
  readonly newPages: number;
  /** Capture time, in ms */
  readonly captureMs: number;
  /** What the owner keeps with it: the machine's host fields, the breakpoint state (T7, D16) */
  readonly meta?: unknown;
  /** It holds the frame-boundary scratch too (taken mid-frame, or by request) */
  readonly complete: boolean;
  /** A transient keyframe (§4.3): outside the budget, least recently used goes first */
  readonly transient: boolean;
};

/** How to take a keyframe */
export type CaptureOptions = {
  /** Keep the frame-boundary scratch too: required for a keyframe that is not at a frame boundary */
  complete?: boolean;
  /** A transient keyframe (§4.3) */
  transient?: boolean;
};

/** D6's default budget: the smaller of 512 MB and a sixteenth of the computer's memory */
export function defaultReverseDebugBudgetMb(physicalMemoryBytes?: number): number {
  if (!physicalMemoryBytes || physicalMemoryBytes <= 0) return 512;
  return Math.max(64, Math.min(512, Math.floor(physicalMemoryBytes / 16 / 1048576)));
}

/** A budget setting in MB as bytes: 0 is the default, anything else is clamped to 64-2048 MB (D6) */
export function reverseDebugBudgetBytes(settingMb: number | undefined, physicalMemoryBytes?: number): number {
  const mb = !settingMb ? defaultReverseDebugBudgetMb(physicalMemoryBytes) : Math.max(64, Math.min(2048, settingMb));
  return mb * 1048576;
}

/** How each page of the image is treated */
const PAGE_FULL = 0;
const PAGE_SKIPPED = 1;
const PAGE_PARTIAL = 2;

type PagePlan = {
  kind: Uint8Array;
  /** For partial pages: the byte spans (page-relative) the keyframe stores */
  spans: Map<number, [number, number][]>;
};

/** Sorted, merged ranges clipped to [0, size) */
function normalize(ranges: MemoryRange[], size: number): [number, number][] {
  const sorted = ranges
    .map((r): [number, number] => [Math.max(0, r.address), Math.min(size, r.address + r.size)])
    .filter(([a, b]) => a < b)
    .sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else out.push([r[0], r[1]]);
  }
  return out;
}

function planPages(memorySize: number, excluded: [number, number][]): PagePlan {
  const pageCount = Math.ceil(memorySize / KEYFRAME_PAGE_SIZE);
  const kind = new Uint8Array(pageCount);
  const spans = new Map<number, [number, number][]>();
  for (let p = 0; p < pageCount; p++) {
    const start = p * KEYFRAME_PAGE_SIZE;
    const end = Math.min(memorySize, start + KEYFRAME_PAGE_SIZE);
    // --- The parts of [start, end) no excluded range covers
    const kept: [number, number][] = [];
    let from = start;
    for (const [a, b] of excluded) {
      if (b <= from) continue;
      if (a >= end) break;
      if (a > from) kept.push([from - start, a - start]);
      from = Math.max(from, b);
      if (from >= end) break;
    }
    if (from < end) kept.push([from - start, end - start]);
    if (kept.length === 0) kind[p] = PAGE_SKIPPED;
    else if (kept.length === 1 && kept[0][0] === 0 && kept[0][1] === KEYFRAME_PAGE_SIZE) kind[p] = PAGE_FULL;
    else {
      kind[p] = PAGE_PARTIAL;
      spans.set(p, kept);
    }
  }
  return { kind, spans };
}

/** Pool statistics */
export type KeyframeStoreStats = {
  /** Keyframes, transient ones included */
  keyframes: number;
  transientKeyframes: number;
  poolPages: number;
  poolBytes: number;
  /** Pages a lean keyframe of the image covers (excluding skipped pages) */
  storedPagesPerKeyframe: number;
  evicted: number;
};

export type KeyframeStoreOptions = {
  /** The core's layout: its memory size, volatile statics, stack and frame-boundary scratch */
  layout: Pick<WasmLayout, "memorySize" | "volatile" | "stack" | "scratch">;
  /** The pool's budget, in bytes (D6); the oldest keyframes go when it is exceeded */
  budgetBytes: number;
  /**
   * The frame-boundary scratch a lean keyframe leaves out (T5): `"layout"` takes the layout stamp's
   * list, a list of ranges names them, and none (the default) makes every keyframe complete
   */
  scratch?: "layout" | MemoryRange[];
  /** The transient keyframes kept at most (§4.3) */
  maxTransient?: number;
};

/** The keyframe store */
export class KeyframeStore {
  /** The plan of a complete keyframe (volatile statics and the stack out) and of a lean one (scratch out too) */
  private readonly completePlan: PagePlan;
  private readonly leanPlan: PagePlan;
  private readonly pageCount: number;
  private readonly pool: (Uint8Array | undefined)[] = [];
  private readonly refs: number[] = [];
  private readonly freeSlots: number[] = [];
  /** In position order */
  private readonly frames: Keyframe[] = [];
  /** Transient keyframes, least recently used first */
  private readonly transientOrder: Keyframe[] = [];
  private nextId = 0;
  private poolPageCount = 0;
  /** Pool pages added by transient keyframes (they do not count against the budget) */
  private transientPageCount = 0;
  private evictedCount = 0;
  private readonly maxTransient: number;
  readonly budgetBytes: number;

  constructor(options: KeyframeStoreOptions) {
    const size = options.layout.memorySize;
    this.pageCount = Math.ceil(size / KEYFRAME_PAGE_SIZE);
    const always = [
      ...options.layout.volatile.map((v) => ({ address: v.address, size: v.size })),
      // --- The C shadow stack holds stale frames between calls, not machine state
      ...(options.layout.stack ? [options.layout.stack] : [])
    ];
    const scratch =
      options.scratch === "layout"
        ? (options.layout.scratch ?? []).map((v) => ({ address: v.address, size: v.size }))
        : (options.scratch ?? []);
    this.completePlan = planPages(size, normalize(always, size));
    this.leanPlan = scratch.length ? planPages(size, normalize([...always, ...scratch], size)) : this.completePlan;
    this.budgetBytes = options.budgetBytes;
    this.maxTransient = options.maxTransient ?? 24;
  }

  /** The keyframes in position order, transient ones included */
  get keyframes(): readonly Keyframe[] {
    return this.frames;
  }

  /** Whether lean keyframes leave anything out that complete ones keep */
  get hasScratch(): boolean {
    return this.leanPlan !== this.completePlan;
  }

  get stats(): KeyframeStoreStats {
    let stored = 0;
    for (let p = 0; p < this.pageCount; p++) if (this.leanPlan.kind[p] !== PAGE_SKIPPED) stored++;
    return {
      keyframes: this.frames.length,
      transientKeyframes: this.transientOrder.length,
      poolPages: this.poolPageCount,
      poolBytes: this.poolPageCount * KEYFRAME_PAGE_SIZE,
      storedPagesPerKeyframe: stored,
      evicted: this.evictedCount
    };
  }

  private planOf(keyframe: { complete: boolean }): PagePlan {
    return keyframe.complete ? this.completePlan : this.leanPlan;
  }

  /**
   * Takes a keyframe of the live memory
   * @param memory The core's linear memory
   * @param seed The recorder's position (`HistoryPositionPort.captureSeed`)
   */
  capture(
    memory: ArrayBuffer,
    seed: PositionSeed,
    frame: number,
    journalIndex: number,
    meta?: unknown,
    options: CaptureOptions = {}
  ): Keyframe {
    const started = performance.now();
    const complete = !!options.complete || !this.hasScratch;
    const transient = !!options.transient;
    const plan = complete ? this.completePlan : this.leanPlan;
    const live8 = new Uint8Array(memory);
    const live32 = new Uint32Array(memory, 0, Math.floor(memory.byteLength / 4));
    // --- Pages are shared with the keyframe just before it in position order
    const at = this.insertionIndex(seed.position);
    const previous = at > 0 ? this.frames[at - 1] : undefined;
    const pages = new Int32Array(this.pageCount);
    let added = 0;
    for (let p = 0; p < this.pageCount; p++) {
      const kind = plan.kind[p];
      if (kind === PAGE_SKIPPED) {
        pages[p] = -1;
        continue;
      }
      const base = p * KEYFRAME_PAGE_SIZE;
      const prevRef = previous ? previous.pages[p] : -1;
      if (kind === PAGE_FULL) {
        if (prevRef >= 0 && this.sameFull(this.pool[prevRef]!, live32, base >> 2)) {
          pages[p] = this.addRef(prevRef);
          continue;
        }
        pages[p] = this.allocate(live8.slice(base, base + KEYFRAME_PAGE_SIZE));
        added++;
        continue;
      }
      // --- A partial page: store its kept spans, zero elsewhere
      const copy = new Uint8Array(KEYFRAME_PAGE_SIZE);
      for (const [a, b] of plan.spans.get(p)!) copy.set(live8.subarray(base + a, base + b), a);
      if (prevRef >= 0 && this.sameBytes(this.pool[prevRef]!, copy)) {
        pages[p] = this.addRef(prevRef);
        continue;
      }
      pages[p] = this.allocate(copy);
      added++;
    }
    const keyframe: Keyframe = {
      id: this.nextId++,
      seed,
      frame,
      journalIndex,
      pages,
      newPages: added,
      captureMs: performance.now() - started,
      meta,
      complete,
      transient
    };
    this.frames.splice(at, 0, keyframe);
    if (transient) {
      this.transientPageCount += added;
      this.transientOrder.push(keyframe);
      while (this.transientOrder.length > this.maxTransient) this.remove(this.transientOrder[0]);
    } else {
      this.enforceBudget();
    }
    return keyframe;
  }

  /** Writes a keyframe back into the live memory, leaving excluded bytes as they are */
  restore(keyframe: Keyframe, memory: ArrayBuffer): void {
    const live8 = new Uint8Array(memory);
    const plan = this.planOf(keyframe);
    for (let p = 0; p < this.pageCount; p++) {
      const ref = keyframe.pages[p];
      if (ref < 0) continue;
      const page = this.pool[ref]!;
      const base = p * KEYFRAME_PAGE_SIZE;
      if (plan.kind[p] === PAGE_FULL) {
        live8.set(page, base);
      } else {
        for (const [a, b] of plan.spans.get(p)!) live8.set(page.subarray(a, b), base + a);
      }
    }
    // --- A transient one just used is the last to go
    if (keyframe.transient) {
      const i = this.transientOrder.indexOf(keyframe);
      if (i >= 0) this.transientOrder.push(...this.transientOrder.splice(i, 1));
    }
  }

  /**
   * The pages where the live memory differs from a keyframe (D9's verification): empty when a
   * replay that passed the keyframe's position agrees with it
   * @param ignore Byte ranges left out of the comparison (T15's bus-event fields)
   */
  diffPages(keyframe: Keyframe, memory: ArrayBuffer, ignore: MemoryRange[] = []): number[] {
    const live8 = new Uint8Array(memory);
    const live32 = new Uint32Array(memory, 0, Math.floor(memory.byteLength / 4));
    const plan = this.planOf(keyframe);
    const skip = normalize(ignore, live8.length);
    const ignored = (address: number) => skip.some(([a, b]) => address >= a && address < b);
    const out: number[] = [];
    for (let p = 0; p < this.pageCount; p++) {
      const ref = keyframe.pages[p];
      if (ref < 0) continue;
      const page = this.pool[ref]!;
      const base = p * KEYFRAME_PAGE_SIZE;
      const touched = skip.some(([a, b]) => a < base + KEYFRAME_PAGE_SIZE && b > base);
      if (plan.kind[p] === PAGE_FULL && !touched) {
        if (!this.sameFull(page, live32, base >> 2)) out.push(p);
        continue;
      }
      const spans = plan.kind[p] === PAGE_FULL ? [[0, KEYFRAME_PAGE_SIZE] as [number, number]] : plan.spans.get(p)!;
      let same = true;
      for (const [a, b] of spans) {
        for (let i = a; i < b && same; i++) {
          if (page[i] !== live8[base + i] && !ignored(base + i)) same = false;
        }
      }
      if (!same) out.push(p);
    }
    return out;
  }

  /** The newest keyframe at or before a position (transient ones included) */
  keyframeAtOrBefore(position: TimelinePosition): Keyframe | undefined {
    for (let i = this.frames.length - 1; i >= 0; i--) {
      if (comparePositions(this.frames[i].seed.position, position) <= 0) return this.frames[i];
    }
    return undefined;
  }

  /** The keyframe before another in position order */
  keyframeBefore(keyframe: Keyframe): Keyframe | undefined {
    const i = this.frames.indexOf(keyframe);
    return i > 0 ? this.frames[i - 1] : undefined;
  }

  /** The oldest keyframe after a position */
  keyframeAfter(position: TimelinePosition): Keyframe | undefined {
    return this.frames.find((k) => comparePositions(k.seed.position, position) > 0);
  }

  /** Drops the keyframes taken after a position (a fork discards the future, D12) */
  dropAfter(position: TimelinePosition): number {
    let dropped = 0;
    for (const k of [...this.frames]) {
      if (this.frames.length > 1 && comparePositions(k.seed.position, position) > 0) {
        this.remove(k);
        dropped++;
      }
    }
    return dropped;
  }

  /** Drops the transient keyframes */
  dropTransient(): void {
    for (const k of [...this.transientOrder]) this.remove(k);
  }

  /**
   * The pool pages a set of keyframes refers to, each once, and their page tables renumbered into
   * that list (`.plans/DEBUG_SESSION_RECORDING_PLAN.md` §4.2, D6). Pages are immutable once pooled,
   * so the arrays are shared, not copied: a save can write them after the machine runs on (T10).
   */
  exportKeyframes(keyframes: readonly Keyframe[]): { pages: Uint8Array[]; tables: Int32Array[] } {
    const index = new Map<number, number>();
    const pages: Uint8Array[] = [];
    const tables = keyframes.map((k) => {
      const table = new Int32Array(this.pageCount);
      for (let p = 0; p < this.pageCount; p++) {
        const slot = k.pages[p];
        if (slot < 0) {
          table[p] = -1;
          continue;
        }
        let at = index.get(slot);
        if (at === undefined) {
          at = pages.length;
          index.set(slot, at);
          pages.push(this.pool[slot]!);
        }
        table[p] = at;
      }
      return table;
    });
    return { pages, tables };
  }

  /**
   * Puts saved keyframes into an empty store: their pages into the pool, each referenced by every
   * keyframe that uses it (a loaded debug recording, §4.2). The budget is not enforced here: the
   * recording's past is what the user opened; new keyframes evict the oldest as usual.
   * @param pages The saved pages
   * @param keyframes In position order; `pages` index the saved pages
   */
  importKeyframes(
    pages: readonly Uint8Array[],
    keyframes: readonly {
      seed: PositionSeed;
      frame: number;
      journalIndex: number;
      complete: boolean;
      pages: Int32Array;
      meta?: unknown;
    }[]
  ): Keyframe[] {
    if (this.frames.length) throw new Error("Keyframes can only be imported into an empty store");
    const slots = pages.map((page) => {
      if (page.length !== KEYFRAME_PAGE_SIZE) throw new Error("A saved page has the wrong size");
      const slot = this.freeSlots.pop() ?? this.pool.length;
      this.pool[slot] = page;
      this.refs[slot] = 0;
      this.poolPageCount++;
      return slot;
    });
    const seen = new Set<number>();
    for (const k of keyframes) {
      if (k.pages.length !== this.pageCount) throw new Error("A saved keyframe does not cover this core's memory");
      if (k.complete === false && !this.hasScratch) throw new Error("A saved keyframe leaves out scratch this core does not have");
      const table = new Int32Array(this.pageCount);
      let added = 0;
      for (let p = 0; p < this.pageCount; p++) {
        const ref = k.pages[p];
        if (ref < 0) {
          table[p] = -1;
          continue;
        }
        const slot = slots[ref];
        if (slot === undefined) throw new Error("A saved keyframe refers to a page that was not saved");
        this.refs[slot]++;
        table[p] = slot;
        if (!seen.has(ref)) {
          seen.add(ref);
          added++;
        }
      }
      this.frames.push({
        id: this.nextId++,
        seed: k.seed,
        frame: k.frame,
        journalIndex: k.journalIndex,
        pages: table,
        newPages: added,
        captureMs: 0,
        meta: k.meta,
        complete: k.complete,
        transient: false
      });
    }
    for (let i = 1; i < this.frames.length; i++) {
      if (comparePositions(this.frames[i - 1].seed.position, this.frames[i].seed.position) > 0) {
        throw new Error("Saved keyframes are not in position order");
      }
    }
    // --- A page no keyframe uses would never be freed
    for (const slot of slots) {
      if (this.refs[slot] > 0) continue;
      this.refs[slot] = 1;
      this.release(slot);
    }
    return this.frames.slice();
  }

  /** Drops every keyframe */
  clear(): void {
    for (const k of [...this.frames]) this.remove(k);
  }

  private insertionIndex(position: TimelinePosition): number {
    let i = this.frames.length;
    while (i > 0 && comparePositions(this.frames[i - 1].seed.position, position) > 0) i--;
    return i;
  }

  private remove(keyframe: Keyframe): void {
    const i = this.frames.indexOf(keyframe);
    if (i < 0) return;
    this.frames.splice(i, 1);
    if (keyframe.transient) {
      const t = this.transientOrder.indexOf(keyframe);
      if (t >= 0) this.transientOrder.splice(t, 1);
      this.transientPageCount = Math.max(0, this.transientPageCount - keyframe.newPages);
    }
    for (let p = 0; p < this.pageCount; p++) if (keyframe.pages[p] >= 0) this.release(keyframe.pages[p]);
  }

  private sameFull(page: Uint8Array, live32: Uint32Array, wordBase: number): boolean {
    const p32 = new Uint32Array(page.buffer, page.byteOffset, PAGE_WORDS);
    for (let i = 0; i < PAGE_WORDS; i++) if (p32[i] !== live32[wordBase + i]) return false;
    return true;
  }

  private sameBytes(a: Uint8Array, b: Uint8Array): boolean {
    for (let i = 0; i < KEYFRAME_PAGE_SIZE; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  private addRef(slot: number): number {
    this.refs[slot]++;
    return slot;
  }

  private allocate(bytes: Uint8Array): number {
    const slot = this.freeSlots.pop() ?? this.pool.length;
    this.pool[slot] = bytes;
    this.refs[slot] = 1;
    this.poolPageCount++;
    return slot;
  }

  private release(slot: number): void {
    if (--this.refs[slot] > 0) return;
    this.pool[slot] = undefined;
    this.freeSlots.push(slot);
    this.poolPageCount--;
  }

  /**
   * Drops the oldest keyframes until the pool, transient pages aside, fits the budget; the newest
   * non-transient keyframe always stays
   */
  private enforceBudget(): void {
    const budgetPages = this.budgetBytes / KEYFRAME_PAGE_SIZE;
    while (this.poolPageCount - this.transientPageCount > budgetPages) {
      const lasting = this.frames.filter((k) => !k.transient);
      if (lasting.length <= 1) break;
      // --- Transient keyframes before the new start go with it: nothing reaches them any more
      const oldest = lasting[0];
      for (const k of this.frames.filter((f) => f.transient && comparePositions(f.seed.position, lasting[1].seed.position) < 0)) {
        this.remove(k);
      }
      this.remove(oldest);
      this.evictedCount++;
    }
  }
}
