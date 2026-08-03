export type WasmCompilerRun = (
  command: string,
  args: string[],
  options: { cwd: string; stdio: "inherit" }
) => { status: number | null; error?: Error };

export type BuildSp48WasmOptions = {
  compiler?: string;
  mode?: string;
  optimization?: string;
  outputPath?: string;
  run?: WasmCompilerRun;
};

export type Sp48WasmBuild = {
  compiler: string;
  args: string[];
  mode: string;
  optimization: string;
  source: string;
  sources: string[];
  output: string;
};

export const layoutOutput: string;
export const layoutValueIds: Record<string, number>;
export const layoutValues: Record<string, number>;
export const source: string;
export const z80StateSource: string;
export const z80TestBusStorageSource: string;
export const fastZ80Sp48Source: string;
export const output: string;
export const outputRelative: string;
export const packagedArtifactRelative: string;
export const packagedResourceDirectory: string;
export const productionExports: string[];
export const testExports: string[];
export const fastZ80ReferenceExports: string[];
export const fastZ80ReferenceOutput: string;
export const fastZ80ReferenceSource: string;
export const fastZ80TestOutput: string;
export const standaloneZ80TestExports: string[];
export const wasmDistDirectory: string;
export const wasmDistDirectoryRelative: string;
export function buildSp48Wasm(options?: BuildSp48WasmOptions): Sp48WasmBuild;
