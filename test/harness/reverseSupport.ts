/*
 * Test support for reverse debugging (`.plans/REVERSE_DEBUGGING_PLAN.md`): wires a harness machine's
 * core to a position port, the contract-driven input journal (Phase 1), a keyframe store and a replay
 * engine. Shared by the journal-replay determinism test and the spike's measurements.
 */

import { InputJournal } from "@emu/machines/reverse/InputJournal";
import { installJournal, type JournalHandle } from "@emu/machines/reverse/JournalingExports";
import { KeyframeStore, type MemoryRange } from "@emu/machines/reverse/KeyframeStore";
import { ReplayEngine, type ReplayCore } from "@emu/machines/reverse/ReplayEngine";
import { HistoryPositionPort, type HistoryPositionExports } from "@emu/machines/reverse/timelinePosition";
import { readWasmLayout, type WasmLayout } from "@emu/machines/state/wasmLayout";
import { captureWasmImage } from "@emu/machines/state/wasmStateImage";

/** The cores a rig drives (the export contract's ids) */
export type SpikeCoreId = "sp48" | "zxnext" | "timex" | "sp128" | "spp3e" | "z88" | "zx8081";

/** What the rig needs of a machine: its WASM runtime */
type RuntimeOwner = {
  wasmV2Runtime?: { module: WebAssembly.Module; exports: object };
};

/** The prefix of a core's frame exports: the Timex runs the 48K's frame loop */
const FRAME_PREFIX: Record<SpikeCoreId, string> = {
  sp48: "sp48",
  timex: "sp48",
  zxnext: "zxnext",
  sp128: "sp128",
  spp3e: "spp3e",
  z88: "z88",
  zx8081: "zx8081"
};
const FRAME_EXPORT = (id: SpikeCoreId) => `${FRAME_PREFIX[id]}ExecuteFrame`;
const FRAME_COMPLETED_EXPORT = (id: SpikeCoreId) => `${FRAME_PREFIX[id]}GetFrameCompleted`;
const FRAMES_EXPORT = (id: SpikeCoreId) => `${FRAME_PREFIX[id]}GetFrames`;

export class ReverseRig {
  readonly port: HistoryPositionPort;
  readonly journal = new InputJournal();
  readonly layout: WasmLayout;
  readonly core: ReplayCore;
  private readonly handle: JournalHandle;
  private readonly runtime: { module: WebAssembly.Module; exports: object };

  constructor(
    readonly coreId: SpikeCoreId,
    owner: RuntimeOwner
  ) {
    const runtime = owner.wasmV2Runtime;
    if (!runtime) throw new Error("The machine has no WASM runtime");
    this.runtime = runtime;
    const layout = readWasmLayout(runtime.module);
    if (!layout) throw new Error("The core has no layout stamp");
    this.layout = layout;
    const raw = runtime.exports as unknown as HistoryPositionExports & Record<string, (...a: number[]) => number>;
    this.port = new HistoryPositionPort(raw);
    this.handle = installJournal(runtime, coreId, this.journal, this.port);
    const frame = raw[FRAME_EXPORT(coreId)];
    const handle = this.handle;
    this.core = {
      memory: raw.memory,
      port: this.port,
      executeFrame: () => frame(),
      apply: (entry) => handle.apply(entry)
    };
  }

  /** The unwrapped exports (reading through these journals nothing) */
  private get raw(): Record<string, (...a: number[]) => number> & { memory: WebAssembly.Memory } {
    return this.handle.raw as never;
  }

  get memory(): WebAssembly.Memory {
    return this.raw.memory;
  }

  /** The core's frame-completed flag: true at a frame boundary */
  get atFrameBoundary(): boolean {
    return this.raw[FRAME_COMPLETED_EXPORT(this.coreId)]() !== 0;
  }

  get frames(): number {
    return this.raw[FRAMES_EXPORT(this.coreId)]();
  }

  /**
   * The image a state file would hold (volatile statics zeroed): what replay must reproduce. With
   * `maskBusEvents`, the CPU's bus-event fields are zeroed too: only the debug loop writes them (T15)
   */
  image(maskBusEvents = false): Uint8Array {
    const image = captureWasmImage(this.coreId, this.runtime.module, this.memory.buffer).image;
    // --- The C shadow stack: stale frames of whatever the host last called
    const stack = this.layout.stack;
    if (stack) image.fill(0, stack.address, stack.address + stack.size);
    if (maskBusEvents) {
      const at = this.raw.z80HistoryBusEventFieldsPtr();
      image.fill(0, at, at + this.raw.z80HistoryBusEventFieldsSize());
    }
    return image;
  }

  /** The CPU's bus-event fields (T15) */
  get busEventFields(): MemoryRange {
    return { address: this.raw.z80HistoryBusEventFieldsPtr(), size: this.raw.z80HistoryBusEventFieldsSize() };
  }

  createStore(budgetBytes: number, scratch?: MemoryRange[]): KeyframeStore {
    return new KeyframeStore({ layout: this.layout, budgetBytes, scratch });
  }

  /** An engine that replays `store` and `journal` (possibly another rig's) on this rig's core */
  createEngine(store: KeyframeStore, journal: InputJournal = this.journal): ReplayEngine {
    return new ReplayEngine(this.core, store, journal);
  }

  dispose(): void {
    this.handle.dispose();
  }
}

/** A small seeded PRNG (mulberry32), so a failing run can be repeated */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
