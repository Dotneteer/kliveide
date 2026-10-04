/*
 * Reads the memory-layout stamp a core's build put into its `.wasm`
 * (`.plans/SNAPSHOT_SAVING_AND_STATE_FILES_PLAN.md` §4.6, D7; written by `scripts/wasm-layout.cjs`).
 *
 * A Klive state file's memory image is valid only for a core whose layout fingerprint is the same.
 */

/** A static a state file leaves out */
export type WasmVolatileSymbol = { symbol: string; address: number; size: number };

/** The `klive.layout` custom section */
export type WasmLayout = {
  version: 1;
  /** The layout fingerprint (hex) */
  fingerprint: string;
  /** The fixed linear memory size, in bytes */
  memorySize: number;
  /** Statics the image leaves out */
  volatile: WasmVolatileSymbol[];
};

/** The custom section's name */
export const WASM_LAYOUT_SECTION = "klive.layout";

/**
 * Reads a module's layout stamp
 * @returns The layout, or undefined for a module built without one (or a test double)
 */
export function readWasmLayout(module: WebAssembly.Module | undefined): WasmLayout | undefined {
  if (!module) return undefined;
  try {
    const sections = WebAssembly.Module.customSections(module, WASM_LAYOUT_SECTION);
    if (!sections.length) return undefined;
    const layout = JSON.parse(new TextDecoder().decode(sections[0])) as WasmLayout;
    if (layout?.version !== 1 || typeof layout.fingerprint !== "string") return undefined;
    return { ...layout, volatile: Array.isArray(layout.volatile) ? layout.volatile : [] };
  } catch {
    return undefined;
  }
}
