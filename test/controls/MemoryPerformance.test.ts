import { describe, expect, it, vi, afterEach } from "vitest";
import {
  clearMemoryPerformanceSamples,
  createVisibleMemoryRenderRecorder,
  getMemoryPerformanceSamples,
  isMemoryPerformanceTrackingEnabled,
  MEMORY_PERFORMANCE_STORAGE_KEY,
  measureMemoryRefresh,
  recordMemoryPerformanceSample
} from "@renderer/features/memory/memoryPerformance";

afterEach(() => {
  clearMemoryPerformanceSamples();
  vi.restoreAllMocks();
});

describe("memory performance helpers", () => {
  it("uses an explicit opt-in flag", () => {
    expect(isMemoryPerformanceTrackingEnabled({ getItem: () => null })).toBe(false);
    expect(isMemoryPerformanceTrackingEnabled({ getItem: (key) => key === MEMORY_PERFORMANCE_STORAGE_KEY ? "1" : null })).toBe(true);
  });

  it("measures refresh latency only when enabled", async () => {
    const report = vi.fn();
    let now = 10;

    const value = await measureMemoryRefresh(
      3,
      () => {
        now = 18;
        return Promise.resolve("done");
      },
      {
        enabled: true,
        now: () => now,
        report
      }
    );

    expect(value).toBe("done");
    expect(report).toHaveBeenCalledWith({
      type: "refresh",
      startedAt: 10,
      durationMs: 8,
      partition: 3
    });

    await measureMemoryRefresh(undefined, () => Promise.resolve("silent"), {
      enabled: false,
      report
    });
    expect(report).toHaveBeenCalledTimes(1);
  });

  it("aggregates visible memory row renders until flushed", () => {
    const report = vi.fn();
    const recorder = createVisibleMemoryRenderRecorder({
      enabled: true,
      report
    });

    recorder.recordRow(2);
    recorder.recordRow(2);
    recorder.flush(5, "8x2");
    recorder.flush(5, "8x2");

    expect(report).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledWith({
      type: "visible-row-render",
      renderedRows: 2,
      renderedSections: 4,
      memoryVersion: 5,
      viewMode: "8x2"
    });
  });

  it("stores enabled samples in a global bucket for ad hoc inspection", () => {
    recordMemoryPerformanceSample({
      type: "visible-row-render",
      renderedRows: 1,
      renderedSections: 2,
      memoryVersion: 1,
      viewMode: "8x2"
    }, true);

    expect(getMemoryPerformanceSamples()).toHaveLength(1);
  });
});
