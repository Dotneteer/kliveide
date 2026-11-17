import type { NextSdDownloadStatus } from "@common/zxnext/nextSdDownload";
import type { NextRomSetId } from "@common/zxnext/romSets";
import { nextSdCardFailureOf } from "./downloadNextSdCard";

/*
 * The downloads the main process runs for the Next's SD card download dialog
 * (`dev/plans/NEXT_SD_CARDS_PLAN.md`, phase 4). The dialog starts one, polls its status for the
 * progress bar and may cancel it; the download itself is `downloadNextSdCard`, passed in, so the
 * bookkeeping is tested without a network.
 */

export type NextSdDownloadRunner = (
  setId: NextRomSetId,
  options: { onProgress: (received: number, total: number) => void; signal: AbortSignal }
) => Promise<unknown>;

type Entry = { status: NextSdDownloadStatus; abort?: AbortController };

export class NextSdDownloads {
  private readonly entries = new Map<NextRomSetId, Entry>();

  constructor(private readonly run: NextSdDownloadRunner) {}

  /**
   * Starts downloading a set's card; a download of the same set already running keeps running. The
   * returned promise settles when the download does (the dialog does not wait on it).
   */
  start(setId: NextRomSetId): Promise<void> {
    const current = this.entries.get(setId);
    if (current?.status.state === "running") return Promise.resolve();
    const abort = new AbortController();
    const entry: Entry = { status: { state: "running", received: 0, total: 0 }, abort };
    this.entries.set(setId, entry);
    return this.run(setId, {
      signal: abort.signal,
      onProgress: (received, total) => {
        if (entry.status.state === "running") entry.status = { state: "running", received, total };
      }
    }).then(
      () => {
        entry.status = abort.signal.aborted ? { state: "cancelled" } : { state: "done" };
        entry.abort = undefined;
      },
      (err: unknown) => {
        entry.status = abort.signal.aborted ? { state: "cancelled" } : { state: "failed", error: nextSdCardFailureOf(err) };
        entry.abort = undefined;
      }
    );
  }

  status(setId: NextRomSetId): NextSdDownloadStatus {
    return this.entries.get(setId)?.status ?? { state: "idle" };
  }

  /** Cancels a running download; it ends as "cancelled" and leaves no file */
  cancel(setId: NextRomSetId): void {
    this.entries.get(setId)?.abort?.abort();
  }
}
