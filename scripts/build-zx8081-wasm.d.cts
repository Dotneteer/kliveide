export type WasmCompilerRun = (
  command: string,
  args: string[],
  options: { cwd: string; stdio: "inherit" }
) => { status: number | null; error?: Error };

export type BuildZx8081WasmOptions = {
  compiler?: string;
  optimization?: string;
  outputPath?: string;
  run?: WasmCompilerRun;
};

export type Zx8081WasmBuild = {
  compiler: string;
  args: string[];
  optimization: string;
  exports: string[];
  source: string;
  sources: string[];
  output: string;
};

export const source: string;
export const output: string;
export const outputRelative: string;
export const buildLockPath: string;
export const packagedArtifactRelative: string;
export const packagedResourceDirectory: string;
export const productionOutput: string;
export const productionOutputRelative: string;
export const productionExports: string[];
export const wasmDistDirectory: string;
export const wasmDistDirectoryRelative: string;
export const ZX8081_WASM_MEMORY_BYTES: number;

export function buildZx8081Wasm(options?: BuildZx8081WasmOptions): Zx8081WasmBuild;
export function waitForZx8081WasmBuildLock(timeoutMs?: number): void;
