export type WasmCompilerRun = (
  command: string,
  args: string[],
  options: { cwd: string; stdio: "inherit" }
) => { status: number | null; error?: Error };

export type BuildZ88WasmOptions = {
  compiler?: string;
  mode?: string;
  optimization?: string;
  outputPath?: string;
  run?: WasmCompilerRun;
};

export type Z88WasmBuild = {
  compiler: string;
  args: string[];
  mode: string;
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
export const productionExports: string[];
export const productionOutput: string;
export const productionOutputRelative: string;
export const wasmDistDirectory: string;
export const wasmDistDirectoryRelative: string;
export const Z88_WASM_MEMORY_BYTES: number;
export function buildZ88Wasm(options?: BuildZ88WasmOptions): Z88WasmBuild;
export function buildAllZ88Wasm(options?: BuildZ88WasmOptions): Z88WasmBuild[];
export function waitForZ88WasmBuildLock(timeoutMs?: number): void;
