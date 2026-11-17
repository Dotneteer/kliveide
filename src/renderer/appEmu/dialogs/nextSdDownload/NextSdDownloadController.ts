import { LatestRun } from "@mvc/core/LatestRun";
import { UiController } from "@mvc/core/UiController";
import { messageOf } from "@mvc/core/errors";
import type { NextSdDownloadDialogData } from "@common/zxnext/nextSdDownload";

import type { NextSdDownloadIntent } from "./NextSdDownloadIntents";
import { initialState, reduce, type NextSdDownloadEvent, type NextSdDownloadState } from "./NextSdDownloadModel";
import { POLL_MS, type NextSdDownloadPorts } from "./NextSdDownloadPorts";
import { selectViewModel, type NextSdDownloadViewModel } from "./NextSdDownloadViewModel";

/**
 * Orchestrates the Next SD card download dialog: the main process downloads, the controller starts it,
 * polls its progress, and closes the dialog with "ready" once the card is here. No React, no DOM.
 */
export class NextSdDownloadController extends UiController<
  NextSdDownloadState,
  NextSdDownloadIntent,
  NextSdDownloadEvent,
  NextSdDownloadViewModel
> {
  private readonly pollRun = new LatestRun();

  constructor(private readonly ports: NextSdDownloadPorts, data: NextSdDownloadDialogData) {
    super(initialState(data), reduce, selectViewModel);
  }

  protected async handle(intent: NextSdDownloadIntent): Promise<void> {
    switch (intent.type) {
      case "downloadRequested":
        await this.download();
        return;
      case "importRequested":
        await this.importFile();
        return;
      case "copyUrlRequested":
        await this.ports.clipboard.writeText(this.state.data.url);
        this.emit({ type: "urlCopied" });
        return;
      case "closeRequested":
        await this.close();
        return;
    }
  }

  private async download(): Promise<void> {
    const { phase, data } = this.state;
    if (phase === "downloading" || phase === "importing") return;
    const run = this.pollRun.begin();
    this.emit({ type: "downloadStarted" });
    try {
      await this.ports.service.start(data.setId);
      while (run.isCurrent()) {
        await this.ports.wait(POLL_MS);
        if (!run.isCurrent()) return;
        const status = await this.ports.service.status(data.setId);
        if (!run.isCurrent()) return;
        switch (status.state) {
          case "running":
            this.emit({ type: "progressed", received: status.received });
            break;
          case "done":
            this.ports.close.close("ready");
            return;
          case "failed":
            this.emit({ type: "downloadFailed", failure: status.error });
            return;
          case "cancelled":
          case "idle":
            // --- Cancelled from elsewhere (the dialog's own cancel closed it already)
            this.emit({ type: "downloadFailed", failure: { kind: "cancelled", message: "" } });
            return;
        }
      }
    } catch (error) {
      if (run.isCurrent()) this.emit({ type: "downloadFailed", failure: { kind: "network", message: messageOf(error) } });
    }
  }

  private async importFile(): Promise<void> {
    const { phase, data } = this.state;
    if (phase === "downloading" || phase === "importing") return;
    this.emit({ type: "importStarted" });
    try {
      const result = await this.ports.service.importFile(data.setId);
      if (result.kind === "imported") {
        this.ports.close.close("ready");
      } else if (result.kind === "cancelled") {
        this.emit({ type: "importCancelled" });
      } else {
        this.emit({ type: "importFailed", failure: result.error });
      }
    } catch (error) {
      this.emit({ type: "importFailed", failure: { kind: "unreadable", message: messageOf(error) } });
    }
  }

  /** Cancel, the X and Escape: a running download is stopped (it leaves no file) */
  private async close(): Promise<void> {
    if (this.state.phase === "importing") return;
    if (this.state.phase === "downloading") {
      this.pollRun.cancelAll();
      try {
        await this.ports.service.cancel(this.state.data.setId);
      } catch {
        // --- The dialog closes either way; a download that could not be cancelled finishes on its own
      }
    }
    this.ports.close.close("declined");
  }

  dispose(): void {
    this.pollRun.cancelAll();
    super.dispose();
  }
}
