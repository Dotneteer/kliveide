export type WasmCompilerRun = (
  command: string,
  args: string[],
  options: { cwd: string; stdio: "inherit" }
) => { status: number | null; error?: Error };

export type BuildSp48WasmOptions = {
  compiler?: string;
  run?: WasmCompilerRun;
};

export type Sp48WasmBuild = {
  compiler: string;
  args: string[];
  source: string;
  output: string;
};

export const source: string;
export const z80Source: string;
export const output: string;
export function buildSp48Wasm(options?: BuildSp48WasmOptions): Sp48WasmBuild;
