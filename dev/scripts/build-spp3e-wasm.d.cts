export type WasmCompilerRun = (
  command: string,
  args: string[],
  options: { cwd: string; stdio: "inherit" }
) => { status: number | null; error?: Error };

export type BuildSpP3eWasmOptions = {
  compiler?: string;
  mode?: string;
  optimization?: string;
  outputPath?: string;
  run?: WasmCompilerRun;
};

export type SpP3eWasmBuild = {
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
export const packagedArtifactRelative: string;
export const packagedResourceDirectory: string;
export const productionExports: string[];
export const productionOutput: string;
export const productionOutputRelative: string;
export const wasmDistDirectory: string;
export const wasmDistDirectoryRelative: string;
export function buildSpP3eWasm(options?: BuildSpP3eWasmOptions): SpP3eWasmBuild;
export function buildAllSpP3eWasm(options?: BuildSpP3eWasmOptions): SpP3eWasmBuild[];
