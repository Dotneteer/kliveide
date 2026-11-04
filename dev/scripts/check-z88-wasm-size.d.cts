export const DEFAULT_MAX_BYTES: number;
export function parseMaxBytes(value?: string): number;
export function checkZ88WasmSize(options?: {
  maxBytes?: number;
  build?: (options: { mode: string }) => unknown;
  artifact?: string;
}): { artifact: string; actualBytes: number; maxBytes: number; withinLimit: boolean };
