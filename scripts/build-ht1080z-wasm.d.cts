export type WasmCompilerRun = (
  command: string,
  args: string[],
  options: { cwd: string; stdio: "inherit" }
) => { status: number | null; error?: Error };

export type BuildHt1080zWasmOptions = {
  compiler?: string;
  optimization?: string;
  outputPath?: string;
  run?: WasmCompilerRun;
};

export type Ht1080zWasmBuild = {
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
export const HT1080Z_WASM_MEMORY_BYTES: number;

export function buildHt1080zWasm(options?: BuildHt1080zWasmOptions): Ht1080zWasmBuild;
export function waitForHt1080zWasmBuildLock(timeoutMs?: number): void;
