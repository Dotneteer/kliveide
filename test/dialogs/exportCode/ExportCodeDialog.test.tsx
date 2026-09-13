import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setExportDialogInfoAction } from "@common/state/actions";
import { ExportCodeDialog } from "@renderer/appIde/dialogs/exportCode/ExportCodeDialog";

import {
  createMockStore,
  fireEvent,
  renderWithProviders,
  screen,
  waitFor
} from "../../react-test-utils";

/**
 * Container-level tests assert wiring and nothing else: that the renderer
 * services reach the ports, that the saved settings reach the model, and that
 * the modal frame is what the old component put on screen. Every rule about
 * what the dialog *decides* is covered headlessly.
 */

const validationMock = vi.hoisted(() => ({
  isValidPath: vi.fn(),
  isValidFilename: vi.fn()
}));

const mainApiMock = vi.hoisted(() => ({
  saveProject: vi.fn(),
  showOpenFolderDialog: vi.fn(),
  showOpenFileDialog: vi.fn(),
  displayMessageBox: vi.fn()
}));

const servicesMock = vi.hoisted(() => ({
  executeCommand: vi.fn(),
  getOutputPaneBuffer: vi.fn()
}));

vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    validationService: {
      isValidPath: validationMock.isValidPath,
      isValidFilename: validationMock.isValidFilename
    },
    outputPaneService: { getOutputPaneBuffer: servicesMock.getOutputPaneBuffer },
    ideCommandsService: { executeCommand: servicesMock.executeCommand }
  })
}));

vi.mock("@renderer/core/MainApi", () => ({
  useMainApi: () => mainApiMock
}));

beforeEach(() => {
  validationMock.isValidPath.mockReturnValue(true);
  validationMock.isValidFilename.mockReturnValue(true);
  mainApiMock.saveProject.mockResolvedValue(undefined);
  mainApiMock.showOpenFolderDialog.mockResolvedValue("");
  mainApiMock.showOpenFileDialog.mockResolvedValue("");
  mainApiMock.displayMessageBox.mockResolvedValue(undefined);
  servicesMock.getOutputPaneBuffer.mockReturnValue({});
  servicesMock.executeCommand.mockResolvedValue({ success: true });
});

afterEach(() => {
  vi.clearAllMocks();
});

// --- The dialog seeds itself from the project's saved export settings.
function storeWithSettings(settings: Record<string, unknown>) {
  const store = createMockStore();
  store.dispatch(setExportDialogInfoAction(settings as never), "ide");
  return store;
}

const exportButton = () => screen.getByRole("button", { name: "Export" });

describe("ExportCodeDialog — wiring", () => {
  it("puts the dialog title on screen", () => {
    renderWithProviders(<ExportCodeDialog onClose={vi.fn()} />);

    expect(screen.getByText("Export Code")).toBeInTheDocument();
  });

  it("seeds the form from the project's saved settings", () => {
    renderWithProviders(<ExportCodeDialog onClose={vi.fn()} />, {
      store: storeWithSettings({ exportName: "game", exportFolder: "/out" })
    });

    const inputs = screen.getAllByRole("textbox");
    expect(inputs[0]).toHaveValue("/out");
    expect(inputs[1]).toHaveValue("game");
  });

  it("saves an edit back into the project", async () => {
    renderWithProviders(<ExportCodeDialog onClose={vi.fn()} />);

    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "game" } });

    await waitFor(() => expect(mainApiMock.saveProject).toHaveBeenCalled());
  });

  it("routes the export through the IDE command service", async () => {
    const onExport = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(<ExportCodeDialog onExport={onExport} onClose={onClose} />, {
      store: storeWithSettings({ exportName: "game" })
    });

    fireEvent.click(exportButton());

    await waitFor(() =>
      expect(servicesMock.executeCommand).toHaveBeenCalledWith(
        'expc "game.tzx" -n game -f tzx -as -c',
        expect.anything()
      )
    );
    expect(mainApiMock.displayMessageBox).toHaveBeenCalledWith(
      "info",
      "Exporting code",
      "Code successfully exported."
    );
    await waitFor(() =>
      expect(onExport).toHaveBeenCalledWith(
        expect.objectContaining({ exportName: "game", fullFilename: "game.tzx" })
      )
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("reports a failed export and stays open", async () => {
    servicesMock.executeCommand.mockResolvedValue({
      success: false,
      finalMessage: "Assembler not found"
    });
    const onClose = vi.fn();
    renderWithProviders(<ExportCodeDialog onClose={onClose} />, {
      store: storeWithSettings({ exportName: "game" })
    });

    fireEvent.click(exportButton());

    await waitFor(() =>
      expect(mainApiMock.displayMessageBox).toHaveBeenCalledWith(
        "error",
        "Exporting code",
        "Assembler not found"
      )
    );
    expect(onClose).not.toHaveBeenCalled();
  });

  it("routes the validation service into the field rules", async () => {
    validationMock.isValidFilename.mockReturnValue(false);
    renderWithProviders(<ExportCodeDialog onClose={vi.fn()} />);

    fireEvent.change(screen.getAllByRole("textbox")[1], { target: { value: "bad/name" } });

    await waitFor(() => expect(exportButton()).toBeDisabled());
  });

  it("routes the folder picker through MainApi", async () => {
    mainApiMock.showOpenFolderDialog.mockResolvedValue("/out");
    renderWithProviders(<ExportCodeDialog onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Select the root project folder" }));

    await waitFor(() => expect(screen.getAllByRole("textbox")[0]).toHaveValue("/out"));
    expect(mainApiMock.showOpenFolderDialog).toHaveBeenCalledWith("exportCodeFolder");
  });

  it("hides the loader options for Intel HEX", () => {
    renderWithProviders(<ExportCodeDialog onClose={vi.fn()} />, {
      store: storeWithSettings({ exportName: "game", formatId: "hex" })
    });

    expect(screen.queryByText("Create BASIC loader")).not.toBeInTheDocument();
    expect(screen.queryByText("Add CLEAR")).not.toBeInTheDocument();
  });

  it("cancels through the caller's onClose", () => {
    const onClose = vi.fn();
    renderWithProviders(<ExportCodeDialog onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("ExportCodeDialog under StrictMode", () => {
  it("still works after the effect teardown/setup cycle", async () => {
    const onExport = vi.fn();
    renderWithProviders(
      <StrictMode>
        <ExportCodeDialog onExport={onExport} onClose={vi.fn()} />
      </StrictMode>,
      { store: storeWithSettings({ exportName: "game" }) }
    );

    fireEvent.click(exportButton());

    await waitFor(() => expect(onExport).toHaveBeenCalled());
  });
});
