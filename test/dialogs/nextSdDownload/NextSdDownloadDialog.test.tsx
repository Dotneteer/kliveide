import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NextSdDownloadDialog } from "@renderer/appEmu/dialogs/nextSdDownload/NextSdDownloadDialog";

import { fireEvent, renderWithProviders, screen, waitFor } from "../../react-test-utils";

/**
 * The container's seams only: MainApi reaching the ports, the Modal's buttons reaching the
 * controller, and StrictMode's setup -> cleanup -> setup leaving a live dialog (MVC trap 1).
 * The decisions are covered without a DOM in NextSdDownloadController.test.ts.
 */

const mainApiMock = vi.hoisted(() => ({
  startNextSdCardDownload: vi.fn(),
  getNextSdCardDownloadStatus: vi.fn(),
  cancelNextSdCardDownload: vi.fn(),
  importNextSdCardFile: vi.fn()
}));

vi.mock("@renderer/core/MainApi", () => ({
  useMainApi: () => mainApiMock
}));

const DATA = {
  modelId: "ks2-30204",
  modelName: "ZX Spectrum Next (KS2, core 3.02.04)",
  setId: "nextzxos-2.10" as const,
  gzSize: 58_595_114,
  size: 96_010_240,
  url: "https://kliveide.net/next-sd/nextzxos-2.10.cim.gz"
};

describe("NextSdDownloadDialog wiring", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mainApiMock.startNextSdCardDownload.mockResolvedValue(undefined);
    mainApiMock.getNextSdCardDownloadStatus.mockResolvedValue({ state: "done" });
    mainApiMock.importNextSdCardFile.mockResolvedValue({ kind: "imported" });
  });

  it("downloads through MainApi from the primary button and closes as ready, under StrictMode", async () => {
    const onClose = vi.fn();
    renderWithProviders(
      <StrictMode>
        <NextSdDownloadDialog data={DATA} onClose={onClose} />
      </StrictMode>
    );
    expect(screen.getByTestId("next-sd-intro")).toHaveTextContent("58.6 MB, 96.0 MB once unpacked");
    expect(screen.getByTestId("next-sd-url")).toHaveTextContent(DATA.url);
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith("ready"));
    expect(mainApiMock.startNextSdCardDownload).toHaveBeenCalledWith("nextzxos-2.10");
  });

  it("imports from the secondary button", async () => {
    const onClose = vi.fn();
    renderWithProviders(<NextSdDownloadDialog data={DATA} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Import a downloaded file..." }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith("ready"));
    expect(mainApiMock.importNextSdCardFile).toHaveBeenCalledWith("nextzxos-2.10");
  });

  it("closes as declined from Cancel", async () => {
    const onClose = vi.fn();
    renderWithProviders(<NextSdDownloadDialog data={DATA} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith("declined"));
  });
});
