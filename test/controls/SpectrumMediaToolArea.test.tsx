/**
 * The Spectrum media strip's insert/eject buttons: they hand the medium to the main process,
 * which runs the Machine menu's own insert (file dialog) and eject commands.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderWithProviders, screen, createMockStore, act, fireEvent } from "../react-test-utils";
import { SpectrumMediaToolArea } from "@renderer/appEmu/machines/SpectrumMediaToolArea";
import { setMachineConfigAction, setMediaAction } from "@state/actions";
import { MC_DISK_SUPPORT } from "@common/machines/constants";

const main = {
  selectMediaFile: vi.fn().mockResolvedValue(undefined),
  ejectMediaFile: vi.fn().mockResolvedValue(undefined)
};
vi.mock("@renderer/core/MainApi", () => ({ useMainApi: () => main }));
vi.mock("@renderer/controls/Icon", () => ({
  Icon: ({ iconName }: any) => <span data-icon={iconName} />
}));

describe("SpectrumMediaToolArea", () => {
  beforeEach(() => {
    main.selectMediaFile.mockClear();
    main.ejectMediaFile.mockClear();
  });

  it("offers only Insert while the deck is empty", async () => {
    const store = createMockStore();
    renderWithProviders(<SpectrumMediaToolArea />, { store });
    expect(screen.getByText("(no tape)")).toBeTruthy();
    // --- The medium is named by its icon, not by a "Tape:" caption
    expect(screen.queryByText(/Tape:/)).toBeNull();
    expect(screen.getByLabelText("Tape").querySelector('[data-icon="cassette-tape"]')).toBeTruthy();
    expect(screen.queryByLabelText("Eject tape (Tape)")).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Insert tape (Tape)"));
    });
    expect(main.selectMediaFile).toHaveBeenCalledWith("tape");
  });

  it("offers Change and Eject for an inserted tape and disk", async () => {
    const store = createMockStore();
    store.dispatch(setMachineConfigAction({ [MC_DISK_SUPPORT]: 2 }));
    store.dispatch(setMediaAction("tape", "/games/manic.tzx"));
    store.dispatch(setMediaAction("diskB", { diskFile: "/disks/b.dsk", writeProtected: true }));
    renderWithProviders(<SpectrumMediaToolArea />, { store });

    expect(screen.getByText("manic.tzx")).toBeTruthy();
    expect(screen.getByText("b.dsk")).toBeTruthy();
    expect(screen.getByTitle("Write-protected")).toBeTruthy();
    expect(screen.getByLabelText("Drive B").querySelector('[data-icon="floppy"]')).toBeTruthy();
    expect(screen.getByLabelText("Drive B").textContent).toBe("B");

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Eject tape (Tape)"));
      fireEvent.click(screen.getByLabelText("Change disk (Drive B)"));
      fireEvent.click(screen.getByLabelText("Insert disk (Drive A)"));
    });
    expect(main.ejectMediaFile).toHaveBeenCalledWith("tape");
    expect(main.selectMediaFile).toHaveBeenCalledWith("diskB");
    expect(main.selectMediaFile).toHaveBeenCalledWith("diskA");
  });
});
