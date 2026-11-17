import { describe, expect, it } from "vitest";

import { NextSdDownloads, type NextSdDownloadRunner } from "@main/next-sd/nextSdDownloads";
import { NextSdCardError } from "@main/next-sd/downloadNextSdCard";

/*
 * The bookkeeping behind the Next SD card download dialog (`dev/plans/NEXT_SD_CARDS_PLAN.md`, phase 4):
 * one download per set, a status to poll, and cancel.
 */

const SET = "nextzxos-2.10" as const;

/** A runner the test steps by hand */
function steppedRunner() {
  const calls: Array<{
    progress: (received: number, total: number) => void;
    signal: AbortSignal;
    finish: () => void;
    fail: (err: unknown) => void;
  }> = [];
  const run: NextSdDownloadRunner = (_setId, { onProgress, signal }) =>
    new Promise((resolve, reject) => {
      calls.push({ progress: onProgress, signal, finish: () => resolve(undefined), fail: reject });
      signal.addEventListener("abort", () => reject(new NextSdCardError("cancelled", "cancelled")));
    });
  return { run, calls };
}

describe("the download session", () => {
  it("is idle until started, reports progress, and ends as done", async () => {
    const { run, calls } = steppedRunner();
    const downloads = new NextSdDownloads(run);
    expect(downloads.status(SET)).toEqual({ state: "idle" });
    const finished = downloads.start(SET);
    calls[0].progress(10, 100);
    expect(downloads.status(SET)).toEqual({ state: "running", received: 10, total: 100 });
    calls[0].finish();
    await finished;
    expect(downloads.status(SET)).toEqual({ state: "done" });
  });

  it("does not start a second download of a set that is downloading", async () => {
    const { run, calls } = steppedRunner();
    const downloads = new NextSdDownloads(run);
    void downloads.start(SET);
    await downloads.start(SET);
    expect(calls).toHaveLength(1);
  });

  it("reports a failure with its kind, and starts again after one", async () => {
    const { run, calls } = steppedRunner();
    const downloads = new NextSdDownloads(run);
    const first = downloads.start(SET);
    calls[0].fail(new NextSdCardError("http", "HTTP 404", 404));
    await first;
    expect(downloads.status(SET)).toEqual({ state: "failed", error: { kind: "http", message: "HTTP 404", detail: 404 } });
    void downloads.start(SET);
    expect(calls).toHaveLength(2);
    expect(downloads.status(SET)).toMatchObject({ state: "running" });
  });

  it("is cancelled through cancel", async () => {
    const { run, calls } = steppedRunner();
    const downloads = new NextSdDownloads(run);
    const finished = downloads.start(SET);
    downloads.cancel(SET);
    expect(calls[0].signal.aborted).toBe(true);
    await finished;
    expect(downloads.status(SET)).toEqual({ state: "cancelled" });
  });
});
