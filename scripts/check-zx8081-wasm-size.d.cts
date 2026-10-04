export type Zx8081WasmSizeReport = {
  artifact: string;
  actualBytes: number;
  maxBytes: number;
  withinLimit: boolean;
};

export const DEFAULT_MAX_BYTES: number;
export function checkZx8081WasmSize(options?: {
  maxBytes?: number;
  build?: () => unknown;
  artifact?: string;
}): Zx8081WasmSizeReport;
export function parseMaxBytes(value?: string): number;
