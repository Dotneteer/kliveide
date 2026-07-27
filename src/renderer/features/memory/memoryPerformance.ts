import type { DumpViewMode } from "./memoryViewModel";

export const MEMORY_PERFORMANCE_STORAGE_KEY = "klive.memory.performance";

export type MemoryPerformanceSample =
  | {
      type: "refresh";
      startedAt: number;
      durationMs: number;
      partition?: number;
    }
  | {
      type: "visible-row-render";
      renderedRows: number;
      renderedSections: number;
      memoryVersion: number;
      viewMode: DumpViewMode;
    };

type MemoryPerformanceGlobals = typeof globalThis & {
  __kliveMemoryPerformanceSamples?: MemoryPerformanceSample[];
};

type ReadableStorage = Pick<Storage, "getItem">;

function getStorage(): ReadableStorage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

function getNow(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function getSampleBucket(): MemoryPerformanceSample[] {
  const target = globalThis as MemoryPerformanceGlobals;
  target.__kliveMemoryPerformanceSamples ??= [];
  return target.__kliveMemoryPerformanceSamples;
}

export function getMemoryPerformanceSamples(): readonly MemoryPerformanceSample[] {
  return getSampleBucket();
}

export function clearMemoryPerformanceSamples(): void {
  getSampleBucket().length = 0;
}

export function isMemoryPerformanceTrackingEnabled(storage: ReadableStorage | undefined = getStorage()): boolean {
  try {
    return storage?.getItem(MEMORY_PERFORMANCE_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function recordMemoryPerformanceSample(
  sample: MemoryPerformanceSample,
  enabled = isMemoryPerformanceTrackingEnabled()
): void {
  if (!enabled) return;
  getSampleBucket().push(sample);
}

export async function measureMemoryRefresh<T>(
  partition: number | undefined,
  operation: () => Promise<T>,
  options: {
    enabled?: boolean;
    now?: () => number;
    report?: (sample: MemoryPerformanceSample) => void;
  } = {}
): Promise<T> {
  const enabled = options.enabled ?? isMemoryPerformanceTrackingEnabled();
  if (!enabled) {
    return operation();
  }

  const now = options.now ?? getNow;
  const report = options.report ?? ((sample: MemoryPerformanceSample) => recordMemoryPerformanceSample(sample, true));
  const startedAt = now();
  try {
    return await operation();
  } finally {
    report({
      type: "refresh",
      startedAt,
      durationMs: Math.max(0, now() - startedAt),
      partition
    });
  }
}

export function createVisibleMemoryRenderRecorder(
  options: {
    enabled?: boolean;
    report?: (sample: MemoryPerformanceSample) => void;
  } = {}
) {
  const enabled = options.enabled ?? isMemoryPerformanceTrackingEnabled();
  const report = options.report ?? ((sample: MemoryPerformanceSample) => recordMemoryPerformanceSample(sample, true));
  let renderedRows = 0;
  let renderedSections = 0;

  return {
    recordRow(sectionCount: number): void {
      if (!enabled) return;
      renderedRows++;
      renderedSections += sectionCount;
    },
    flush(memoryVersion: number, viewMode: DumpViewMode): void {
      if (!enabled || renderedRows === 0) return;
      report({
        type: "visible-row-render",
        renderedRows,
        renderedSections,
        memoryVersion,
        viewMode
      });
      renderedRows = 0;
      renderedSections = 0;
    }
  };
}
