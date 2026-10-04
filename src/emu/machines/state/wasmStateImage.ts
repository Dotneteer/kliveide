/*
 * A WASM machine core's whole state as a memory image
 * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.5, D6).
 *
 * Every Klive core keeps its entire world - CPU, RAM, ROM, devices, inserted media - in its fixed
 * linear memory, and between exported calls the C shadow stack is unwound, so a copy of that memory
 * is a complete, replay-exact record of the core (the Next checkpoint relies on the same fact). The
 * image leaves out the core's *volatile* statics - debugging state and scratch buffers its build
 * script names (trap 10) - and a restore keeps the live core's bytes there.
 *
 * An image only fits a core with the same memory layout (D7): the build stamps a fingerprint into the
 * module (`wasmLayout.ts`), and a restore refuses any other.
 */

import { readWasmLayout, type WasmLayout } from "./wasmLayout";

/** The machine-independent part of a saved machine state */
export type MachineStateParts = {
  /** The core: "sp48", "sp128", "spp3e", "zxnext", "z88", "zx8081" */
  coreId: string;
  /** The core build's layout fingerprint */
  fingerprint: string;
  /** The linear memory size, in bytes */
  memorySize: number;
  /** The linear memory, with the volatile statics zeroed */
  image: Uint8Array;
  /** The wrapper's own fields (plain JSON data) */
  host: Record<string, unknown>;
};

/** Thrown when a state cannot go into this core */
export class MachineStateMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MachineStateMismatchError";
  }
}

/** The core's layout, or an error saying why there is none */
function requireLayout(module: WebAssembly.Module | undefined, coreId: string): WasmLayout {
  const layout = readWasmLayout(module);
  if (!layout) {
    throw new MachineStateMismatchError(
      `The ${coreId} core was built without a memory-layout stamp, so its state cannot be saved or restored`
    );
  }
  return layout;
}

/**
 * Why a state cannot be restored into a core, or undefined when it can
 * @param parts The saved state
 * @param coreId The live core
 * @param module The live core's module
 */
export function stateMismatch(
  parts: Pick<MachineStateParts, "coreId" | "fingerprint" | "memorySize">,
  coreId: string,
  module: WebAssembly.Module | undefined
): string | undefined {
  if (parts.coreId !== coreId) {
    return `The state belongs to the ${parts.coreId} core, not the ${coreId} core`;
  }
  const layout = readWasmLayout(module);
  if (!layout) {
    return `The ${coreId} core was built without a memory-layout stamp`;
  }
  if (parts.fingerprint !== layout.fingerprint || parts.memorySize !== layout.memorySize) {
    return `The state was saved by a ${coreId} core with another memory layout (this version of Klive has changed it)`;
  }
  return undefined;
}

/** The volatile ranges, sorted and clipped to the memory */
function volatileRanges(layout: WasmLayout, size: number): [number, number][] {
  return layout.volatile
    .map((v): [number, number] => [v.address, Math.min(size, v.address + v.size)])
    .filter(([start, end]) => start < end)
    .sort((a, b) => a[0] - b[0]);
}

/**
 * Captures a core's memory image
 * @param coreId The core
 * @param module The core's module (its layout stamp)
 * @param memory The core's linear memory
 */
export function captureWasmImage(
  coreId: string,
  module: WebAssembly.Module | undefined,
  memory: ArrayBuffer
): Omit<MachineStateParts, "host"> {
  const layout = requireLayout(module, coreId);
  const image = new Uint8Array(memory).slice();
  for (const [start, end] of volatileRanges(layout, image.length)) image.fill(0, start, end);
  return { coreId, fingerprint: layout.fingerprint, memorySize: image.length, image };
}

/**
 * Restores a core's memory image, leaving its volatile statics as they are
 * @throws MachineStateMismatchError when the state does not fit the core
 */
export function restoreWasmImage(
  parts: MachineStateParts,
  coreId: string,
  module: WebAssembly.Module | undefined,
  memory: ArrayBuffer
): void {
  const mismatch = stateMismatch(parts, coreId, module);
  if (mismatch) throw new MachineStateMismatchError(mismatch);
  const layout = requireLayout(module, coreId);
  const live = new Uint8Array(memory);
  if (parts.image.length !== live.length) {
    throw new MachineStateMismatchError(
      `The state's memory image is ${parts.image.length} bytes; the core has ${live.length}`
    );
  }
  let from = 0;
  for (const [start, end] of volatileRanges(layout, live.length)) {
    if (start > from) live.set(parts.image.subarray(from, start), from);
    from = Math.max(from, end);
  }
  if (from < live.length) live.set(parts.image.subarray(from), from);
}
