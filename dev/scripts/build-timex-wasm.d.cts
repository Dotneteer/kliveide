import type { WasmCompilerRun } from "./build-sp48-wasm.cjs";

export type BuildTimexWasmOptions = {
  compiler?: string;
  optimization?: string;
  outputPath?: string;
  run?: WasmCompilerRun;
};

export type TimexWasmBuild = {
  compiler: string;
  args: string[];
  optimization: string;
  exports: string[];
  source: string;
  sources: string[];
  output: string;
};

export const TIMEX_VOLATILE_SYMBOLS: string[];
export const source: string;
export const output: string;
export const outputRelative: string;
export const packagedArtifactRelative: string;
export const packagedResourceDirectory: string;
export const productionExports: string[];
export const timexOwnExports: string[];
export const productionOutput: string;
export const wasmDistDirectory: string;
export function buildTimexWasm(options?: BuildTimexWasmOptions): TimexWasmBuild;
