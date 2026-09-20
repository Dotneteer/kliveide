export type Z88BenchmarkOptions = {
  frames: number;
  runs: number;
  warmup: number;
  json: boolean;
  scenario: string | null;
  help?: boolean;
};
export type Z88BenchmarkMetric = { median: number; min: number; max: number };
export type Z88BenchmarkResult = {
  id: string;
  label: string;
  typescript: Z88BenchmarkMetric;
  wasm: Z88BenchmarkMetric;
  speedup: number;
};
export const SCENARIOS: readonly { id: string; label: string }[];
export function parseArgs(argv: string[]): Z88BenchmarkOptions;
export function benchmarkZ88(
  options: Z88BenchmarkOptions,
  harness?: unknown
): Promise<{ options: Z88BenchmarkOptions; artifactBytes: number | null; results: Z88BenchmarkResult[] }>;
