export type WasmCompilerRun = (
  command: string,
  args: string[],
  options: { cwd: string; stdio: "inherit" }
) => { status: number | null; error?: Error };

export type BuildZxNextWasmOptions = {
  compiler?: string;
  mode?: string;
  optimization?: string;
  outputPath?: string;
  run?: WasmCompilerRun;
};

export type ZxNextWasmBuild = {
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
export function buildZxNextWasm(options?: BuildZxNextWasmOptions): ZxNextWasmBuild;
export function buildAllZxNextWasm(options?: BuildZxNextWasmOptions): ZxNextWasmBuild[];
export function waitForZxNextWasmBuildLock(timeoutMs?: number): void;
