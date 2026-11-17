import { describe, expect, it, vi } from "vitest";

import { setLanguage } from "@common/i18n/i18n";

import type {
  NextSdDownloadDialogData,
  NextSdDownloadStatus,
  NextSdImportResult
} from "@common/zxnext/nextSdDownload";
import { NextSdDownloadController } from "@renderer/appEmu/dialogs/nextSdDownload/NextSdDownloadController";
import { initialState, reduce } from "@renderer/appEmu/dialogs/nextSdDownload/NextSdDownloadModel";
import { megabytes, selectViewModel } from "@renderer/appEmu/dialogs/nextSdDownload/NextSdDownloadViewModel";

import { harnessFor } from "../../mvc/ControllerHarness";
import { deferred } from "../../mvc/deferred";

/*
 * The ZX Spectrum Next SD card download dialog (`dev/plans/NEXT_SD_CARDS_PLAN.md`, phase 4), driven
 * through its controller against fake ports: no React, no network.
 */

const DATA: NextSdDownloadDialogData = {
  modelId: "ks2-30204",
  modelName: "ZX Spectrum Next (KS2, core 3.02.04)",
  setId: "nextzxos-2.10",
  gzSize: 58_595_114,
  size: 96_010_240,
  url: "https://kliveide.net/next-sd/nextzxos-2.10.cim.gz"
};

type Options = {
  /** The statuses the main process reports, one per poll; the last one repeats */
  statuses?: NextSdDownloadStatus[];
  importResult?: NextSdImportResult | (() => Promise<NextSdImportResult>);
};

function openDialog(options: Options = {}) {
  const statuses = [...(options.statuses ?? [{ state: "done" }])];
  const service = {
    start: vi.fn(async () => undefined),
    status: vi.fn(async () => (statuses.length > 1 ? statuses.shift()! : statuses[0])),
    cancel: vi.fn(async () => undefined),
    importFile: vi.fn(
      typeof options.importResult === "function"
        ? options.importResult
        : async () => options.importResult ?? ({ kind: "imported" } as NextSdImportResult)
    )
  };
  const ports = {
    service,
    clipboard: { writeText: vi.fn(async () => undefined) },
    wait: vi.fn(async () => undefined),
    close: { close: vi.fn() }
  };
  const controller = new NextSdDownloadController(ports, DATA);
  return harnessFor(controller, { ports });
}

describe("the offer", () => {
  it("names the model and the sizes, and offers Download and Import", () => {
    const h = openDialog();
    expect(h.vm.intro).toBe(
      "The ZX Spectrum Next (KS2, core 3.02.04) boots NextZXOS from an SD card that is not on this computer yet. " +
        "Klive can download it from kliveide.net: 58.6\u00a0MB, 96.0\u00a0MB once unpacked."
    );
    expect(h.vm.primary).toEqual({ label: "Download", enabled: true });
    expect(h.vm.secondary).toEqual({ label: "Import a downloaded file...", enabled: true });
    expect(h.vm.cancel).toEqual({ label: "Cancel", enabled: true });
    expect(h.vm.progress).toEqual({ active: false, percent: 0, text: "Not downloading" });
    expect(h.vm.url.text).toBe(DATA.url);
  });

  it("closes as declined, starting nothing", async () => {
    const h = openDialog();
    await h.dispatch({ type: "closeRequested" });
    expect(h.ports.close.close).toHaveBeenCalledWith("declined");
    expect(h.ports.service.start).not.toHaveBeenCalled();
    expect(h.ports.service.cancel).not.toHaveBeenCalled();
  });

  it("copies the card's address", async () => {
    const h = openDialog();
    await h.dispatch({ type: "copyUrlRequested" });
    expect(h.ports.clipboard.writeText).toHaveBeenCalledWith(DATA.url);
    expect(h.vm.url.copyLabel).toBe("Copied");
  });
});

describe("downloading", () => {
  it("shows the progress, and closes as ready when the card is here", async () => {
    const h = openDialog({
      statuses: [
        { state: "running", received: 0, total: DATA.gzSize },
        { state: "running", received: 29_297_557, total: DATA.gzSize },
        { state: "done" }
      ]
    });
    const progress: Array<{ active: boolean; percent: number; text: string }> = [];
    h.controller.subscribe(() => progress.push(h.vm.progress));
    await h.dispatch({ type: "downloadRequested" });
    expect(h.ports.service.start).toHaveBeenCalledWith("nextzxos-2.10");
    expect(progress).toContainEqual({ active: true, percent: 50, text: "29.3 of 58.6 MB" });
    expect(h.ports.close.close).toHaveBeenCalledWith("ready");
  });

  it("disables Download and Import while it runs", async () => {
    const poll = deferred<NextSdDownloadStatus>();
    const h = openDialog();
    h.ports.service.status.mockImplementationOnce(() => poll.promise);
    void h.send({ type: "downloadRequested" });
    await vi.waitFor(() => expect(h.ports.service.status).toHaveBeenCalled());
    expect(h.vm.primary.enabled).toBe(false);
    expect(h.vm.secondary.enabled).toBe(false);
    expect(h.vm.cancel.enabled).toBe(true);
    // --- A second Download while the first runs starts nothing (not h.dispatch: it would wait for the first)
    await h.controller.dispatch({ type: "downloadRequested" });
    expect(h.ports.service.start).toHaveBeenCalledTimes(1);
    poll.resolve({ state: "done" });
    await h.settle();
  });

  it("is cancelled with the dialog: the main process stops it and the dialog closes as declined", async () => {
    const poll = deferred<NextSdDownloadStatus>();
    const h = openDialog();
    h.ports.service.status.mockImplementationOnce(() => poll.promise);
    void h.send({ type: "downloadRequested" });
    await vi.waitFor(() => expect(h.ports.service.status).toHaveBeenCalled());
    await h.controller.dispatch({ type: "closeRequested" });
    expect(h.ports.service.cancel).toHaveBeenCalledWith("nextzxos-2.10");
    expect(h.ports.close.close).toHaveBeenCalledWith("declined");
    // --- The poll answering late changes nothing
    poll.resolve({ state: "done" });
    await h.settle();
    expect(h.ports.close.close).toHaveBeenCalledTimes(1);
  });

  it("shows a failure in words and offers Retry", async () => {
    const h = openDialog({
      statuses: [{ state: "failed", error: { kind: "http", message: "https://kliveide.net/...: HTTP 404", detail: 404 } }]
    });
    await h.dispatch({ type: "downloadRequested" });
    expect(h.vm.error).toEqual({
      text: "The server answered with HTTP status 404.",
      detail: "https://kliveide.net/...: HTTP 404"
    });
    expect(h.vm.primary).toEqual({ label: "Retry", enabled: true });
    expect(h.vm.secondary.enabled).toBe(true);
    expect(h.ports.close.close).not.toHaveBeenCalled();
  });

  it("starts again on Retry, and the failure goes away", async () => {
    const h = openDialog({
      statuses: [{ state: "failed", error: { kind: "network", message: "ECONNREFUSED" } }]
    });
    await h.dispatch({ type: "downloadRequested" });
    expect(h.vm.error?.text).toContain("could not reach kliveide.net");
    h.ports.service.status.mockResolvedValue({ state: "done" });
    await h.dispatch({ type: "downloadRequested" });
    expect(h.ports.service.start).toHaveBeenCalledTimes(2);
    expect(h.ports.close.close).toHaveBeenCalledWith("ready");
  });

  it("words every failure kind", () => {
    const failed = (kind: Parameters<typeof reduce>[1] extends never ? never : any, during: "download" | "import") =>
      selectViewModel(
        reduce(initialState(DATA), {
          type: during === "download" ? "downloadFailed" : "importFailed",
          failure: { kind, message: "x", detail: 154_605_354 }
        })
      ).error!.text;
    expect(failed("redirected", "download")).toContain("only from kliveide.net");
    expect(failed("noSpace", "download")).toBe("There is not enough free disk space. The card needs 154.6 MB.");
    expect(failed("wrongCard", "download")).toContain("not the expected SD card");
    expect(failed("encoded", "download")).toContain("not the expected SD card");
    expect(failed("tooLarge", "download")).toContain("not the expected SD card");
    expect(failed("cancelled", "download")).toBe("The download was cancelled.");
    expect(failed("wrongCard", "import")).toBe("This file is not the SD card of the ZX Spectrum Next (KS2, core 3.02.04).");
    expect(failed("unreadable", "import")).toBe("The file could not be read.");
  });
});

describe("importing a file downloaded elsewhere", () => {
  it("closes as ready once the file is imported", async () => {
    const h = openDialog();
    await h.dispatch({ type: "importRequested" });
    expect(h.ports.service.importFile).toHaveBeenCalledWith("nextzxos-2.10");
    expect(h.ports.close.close).toHaveBeenCalledWith("ready");
  });

  it("goes back to the offer when the user closes the file picker", async () => {
    const h = openDialog({ importResult: { kind: "cancelled" } });
    await h.dispatch({ type: "importRequested" });
    expect(h.vm.primary).toEqual({ label: "Download", enabled: true });
    expect(h.vm.error).toBeUndefined();
    expect(h.ports.close.close).not.toHaveBeenCalled();
  });

  it("names a file that is not the card", async () => {
    const h = openDialog({ importResult: { kind: "failed", error: { kind: "wrongCard", message: "sha256 ..." } } });
    await h.dispatch({ type: "importRequested" });
    expect(h.vm.error?.text).toBe("This file is not the SD card of the ZX Spectrum Next (KS2, core 3.02.04).");
    // --- Nothing was downloaded: the main button still says Download
    expect(h.vm.primary.label).toBe("Download");
  });

  it("cannot be closed while the file is checked", async () => {
    const result = deferred<NextSdImportResult>();
    const h = openDialog({ importResult: () => result.promise });
    void h.send({ type: "importRequested" });
    expect(h.vm.progress.text).toBe("Checking the file...");
    expect(h.vm.cancel.enabled).toBe(false);
    await h.controller.dispatch({ type: "closeRequested" });
    expect(h.ports.close.close).not.toHaveBeenCalled();
    result.resolve({ kind: "imported" });
    await h.settle();
    expect(h.ports.close.close).toHaveBeenCalledWith("ready");
  });
});

describe("sizes", () => {
  it("are megabytes with one decimal", () => {
    expect(megabytes(23_791_074)).toBe("23.8");
    expect(megabytes(0)).toBe("0.0");
  });

  it("follow the display language's number format", () => {
    setLanguage("de");
    try {
      expect(megabytes(58_595_114)).toBe("58,6");
    } finally {
      setLanguage("en");
    }
  });
});
