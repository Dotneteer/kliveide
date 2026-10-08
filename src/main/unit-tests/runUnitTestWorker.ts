import { Worker } from "worker_threads";
import fs from "fs";
import path from "path";

import type { UnitTestEvent, UnitTestSummary } from "@common/unit-tests/unitTestTypes";
import type { UnitTestWorkerData } from "./unitTestWorkerTypes";

/*
 * Starts the unit-test worker and streams its events (`.plans/Z80_UNIT_TESTS_PLAN.md` D6): the
 * `compiler-integration/runWorker.ts` pattern. One run at a time; `cancel` terminates the worker,
 * which is safe because the worker owns nothing but its machine.
 */

export const UNIT_TEST_WORKER_FILE = "unitTestWorker";

/** A run in progress */
export type UnitTestWorkerRun = {
  /** Resolves with the summary when the worker finishes, is cancelled or fails */
  done: Promise<UnitTestSummary>;
  cancel(): void;
};

/**
 * Starts a run
 * @param data What the worker runs
 * @param onEvent Receives every event the worker posts
 * @param workerFile The worker script; resolved next to this bundle when absent
 */
export function startUnitTestWorker(
  data: UnitTestWorkerData,
  onEvent: (event: UnitTestEvent) => void,
  workerFile = resolveWorkerPath()
): UnitTestWorkerRun {
  const worker = new Worker(workerFile, { workerData: data });
  let summary: UnitTestSummary | undefined;
  let cancelled = false;
  const done = new Promise<UnitTestSummary>((resolve) => {
    let ended = false;
    const finish = (problem?: string) => {
      if (ended) return;
      ended = true;
      if (problem) onEvent({ kind: "problem", message: problem });
      const final = summary ?? { total: 0, passed: 0, failed: 0, errors: 0 };
      if (cancelled) final.cancelled = true;
      if (!summary) onEvent({ kind: "finished", summary: final });
      resolve(final);
    };
    worker.on("message", (event: UnitTestEvent) => {
      onEvent(event);
      if (event.kind === "finished") {
        summary = event.summary;
        void worker.terminate();
      }
    });
    worker.on("error", (err) => finish(`The unit-test runner failed: ${err.message}`));
    worker.on("exit", () => finish());
  });
  return {
    done,
    cancel() {
      cancelled = true;
      void worker.terminate();
    }
  };
}

function resolveWorkerPath(): string {
  for (const ext of ["js", "ts"]) {
    const candidate = path.resolve(__dirname, `${UNIT_TEST_WORKER_FILE}.${ext}`);
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error(`Worker script not found: ${path.resolve(__dirname, `${UNIT_TEST_WORKER_FILE}.js`)}`);
}
