import { describe, expect, it, vi } from "vitest";

import { MachineSelectDialog } from "@renderer/appIde/dialogs/machineSelect/MachineSelectDialog";

import { fireEvent, renderWithProviders, screen, waitFor } from "../../react-test-utils";

/*
 * Wiring only: the dialog's decisions are covered headlessly in `machine-select.test.ts`. This checks
 * that the view renders the accordion and the sheet, and that the footer buttons and gestures
 * deliver the right result.
 */

const data = {
  favorites: [{ machineId: "sp48", modelId: "pal" }, { machineId: "sp128" }],
  current: { machineId: "spp3e", modelId: "fdd1" }
};

describe("MachineSelectDialog — wiring", () => {
  it("opens on the running model's hardware sheet with its section expanded", () => {
    renderWithProviders(<MachineSelectDialog data={data} onResult={vi.fn()} onClose={vi.fn()} />);

    expect(screen.getByText("Select Machine")).toBeInTheDocument();
    expect(screen.getByTestId("hardware-sheet")).toHaveTextContent("ZX Spectrum +3E (1 FDD)");
    expect(screen.getByTestId("hardware-sheet")).toHaveTextContent("3,546,900 Hz");
    expect(screen.getByTestId("machine-row-spp3e/nofdd")).toBeInTheDocument();
    expect(screen.getByTestId("favorite-row-sp128")).toBeInTheDocument();
    expect(screen.queryByTestId("machine-row-z88/OZ50")).toBeNull();
  });

  it("lists the Amstrad +2A/+3 models under the +2A/+3/+2E/+3E section and switches to one", async () => {
    const onResult = vi.fn();
    renderWithProviders(<MachineSelectDialog data={data} onResult={onResult} onClose={vi.fn()} />);

    for (const id of ["plus2a", "plus2a-es", "plus3-fdd1", "plus3-fdd2", "plus3-v40-fdd1", "plus3-es-fdd2"]) {
      expect(screen.getByTestId(`machine-row-spp3e/${id}`)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByTestId("machine-row-spp3e/plus3-es-fdd1"));
    expect(screen.getByTestId("hardware-sheet")).toHaveTextContent("ZX Spectrum +3 (Spanish, 1 FDD)");
    expect(screen.getByTestId("hardware-sheet")).toHaveTextContent("spp3-41es-0");
    fireEvent.click(screen.getByRole("button", { name: "Switch to ZX Spectrum +3 (Spanish, 1 FDD)" }));
    await waitFor(() =>
      expect(onResult).toHaveBeenCalledWith({ switchTo: { machineId: "spp3e", modelId: "plus3-es-fdd1" } })
    );
  });

  it("opens a section, selects a model and switches to it", async () => {
    const onResult = vi.fn();
    renderWithProviders(<MachineSelectDialog data={data} onResult={onResult} onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId("section-z88"));
    fireEvent.click(screen.getByTestId("machine-row-z88/OZ47"));
    expect(screen.getByTestId("hardware-sheet")).toHaveTextContent("Cambridge Z88 (OZ v4.7 Int.)");

    fireEvent.click(screen.getByRole("button", { name: "Switch to Cambridge Z88 (OZ v4.7 Int.)" }));
    await waitFor(() =>
      expect(onResult).toHaveBeenCalledWith({ switchTo: { machineId: "z88", modelId: "OZ47" } })
    );
  });

  it("stars a model from the sheet and saves the favourites", async () => {
    const onResult = vi.fn();
    renderWithProviders(<MachineSelectDialog data={data} onResult={onResult} onClose={vi.fn()} />);

    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByTestId("sheet-favorite"));
    expect(screen.getByTestId("favorite-row-spp3e/fdd1")).toBeInTheDocument();
    fireEvent.click(save);
    await waitFor(() =>
      expect(onResult).toHaveBeenCalledWith({
        favorites: [
          { machineId: "sp48", modelId: "pal" },
          { machineId: "sp128" },
          { machineId: "spp3e", modelId: "fdd1" }
        ]
      })
    );
  });

  it("switches on double-click", () => {
    const onResult = vi.fn();
    renderWithProviders(<MachineSelectDialog data={data} onResult={onResult} onClose={vi.fn()} />);

    fireEvent.doubleClick(screen.getByTestId("machine-row-sp128"));
    expect(onResult).toHaveBeenCalledWith({ switchTo: { machineId: "sp128" } });
  });

  it("restores the default favourites", () => {
    renderWithProviders(<MachineSelectDialog data={data} onResult={vi.fn()} onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId("restore-default-favorites"));
    expect(screen.getByTestId("favorite-row-zxnext/standard")).toBeInTheDocument();
    expect(screen.getByText("Unsaved menu changes")).toBeInTheDocument();
  });

  it("walks the accordion with the keyboard and stars with Space", () => {
    renderWithProviders(<MachineSelectDialog data={data} onResult={vi.fn()} onClose={vi.fn()} />);

    const row = screen.getByTestId("machine-row-spp3e/fdd1");
    row.focus();
    fireEvent.keyDown(row, { key: "ArrowDown" });
    expect(screen.getByTestId("hardware-sheet")).toHaveTextContent("ZX Spectrum +3E (2 FDDs)");
    fireEvent.keyDown(screen.getByTestId("machine-row-spp3e/fdd2"), { key: " " });
    expect(screen.getByTestId("favorite-row-spp3e/fdd2")).toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId("favorite-row-spp3e/fdd2"), { key: "ArrowUp", altKey: true });
    const order = screen.getAllByTestId(/^favorite-row-/).map((el) => el.dataset.testid);
    expect(order).toEqual(["favorite-row-sp48/pal", "favorite-row-spp3e/fdd2", "favorite-row-sp128"]);
  });
});
