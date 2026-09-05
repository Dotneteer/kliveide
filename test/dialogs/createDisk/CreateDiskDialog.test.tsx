import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CreateDiskDialog } from "@renderer/appEmu/dialogs/createDisk/CreateDiskDialog";

import { fireEvent, renderWithProviders, screen, waitFor } from "../../react-test-utils";

/**
 * Container-level tests assert wiring and nothing else: that the renderer
 * services reach the ports, that the environment reaches the model, and that
 * the modal frame is what the old component put on screen. Every rule about
 * *what the dialog decides* is covered headlessly in the model, view-model and
 * controller suites.
 */

const validationMock = vi.hoisted(() => ({
  isValidPath: vi.fn(),
  isValidFilename: vi.fn()
}));

const mainApiMock = vi.hoisted(() => ({
  createDiskFile: vi.fn(),
  displayMessageBox: vi.fn(),
  showOpenFolderDialog: vi.fn()
}));

vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    validationService: {
      isValidPath: validationMock.isValidPath,
      isValidFilename: validationMock.isValidFilename
    }
  })
}));

vi.mock("@renderer/core/MainApi", () => ({
  useMainApi: () => mainApiMock
}));

beforeEach(() => {
  validationMock.isValidPath.mockReturnValue(true);
  validationMock.isValidFilename.mockReturnValue(true);
  mainApiMock.createDiskFile.mockResolvedValue("/tmp/disk.dsk");
  mainApiMock.displayMessageBox.mockResolvedValue(undefined);
  mainApiMock.showOpenFolderDialog.mockResolvedValue("");
});

// --- `react-test-utils` already registers RTL cleanup; only the mocks are ours.
afterEach(() => {
  vi.clearAllMocks();
});

function fillAndSubmit(): void {
  const inputs = screen.getAllByRole("textbox");
  fireEvent.change(inputs[0], { target: { value: "/tmp" } });
  fireEvent.change(inputs[1], { target: { value: "disk.dsk" } });
  fireEvent.click(screen.getByRole("button", { name: "Create" }));
}

describe("CreateDiskDialog — wiring", () => {
  it("puts the dialog title on screen", () => {
    renderWithProviders(<CreateDiskDialog onClose={vi.fn()} />);

    expect(screen.getByText("Create a new disk file")).toBeInTheDocument();
  });

  it("routes a submission through MainApi and settles the dialog", async () => {
    const onCreate = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(<CreateDiskDialog onCreate={onCreate} onClose={onClose} />);

    fillAndSubmit();

    await waitFor(() => {
      expect(mainApiMock.createDiskFile).toHaveBeenCalledWith("/tmp", "disk.dsk", "ss");
    });
    expect(onCreate).toHaveBeenCalledWith({
      diskType: "ss",
      folder: "/tmp",
      filename: "disk.dsk",
      path: "/tmp/disk.dsk"
    });
    // --- The result goes to the caller and the dialog then asks to be
    // --- dismissed, exactly as the old component did.
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("routes the validation service into the field rules", async () => {
    validationMock.isValidFilename.mockImplementation((value: string) => value !== "bad/name");
    renderWithProviders(<CreateDiskDialog onClose={vi.fn()} />);

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "/tmp" } });
    fireEvent.change(inputs[1], { target: { value: "bad/name" } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    });
  });

  it("routes the folder picker through MainApi", async () => {
    mainApiMock.showOpenFolderDialog.mockResolvedValue("/picked");
    renderWithProviders(<CreateDiskDialog onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Select the root project folder" }));

    await waitFor(() => {
      expect(screen.getAllByRole("textbox")[0]).toHaveValue("/picked");
    });
    expect(mainApiMock.showOpenFolderDialog).toHaveBeenCalledWith("newDiskFolder");
  });

  it("reports a failed write through the message box and stays open", async () => {
    mainApiMock.createDiskFile.mockRejectedValue(new Error("Disk is full"));
    const onClose = vi.fn();
    renderWithProviders(<CreateDiskDialog onClose={onClose} />);

    fillAndSubmit();

    await waitFor(() => {
      expect(mainApiMock.displayMessageBox).toHaveBeenCalledWith(
        "error",
        "Create Disk File Error",
        "Disk is full"
      );
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it("cancels through the caller's onClose", () => {
    const onClose = vi.fn();
    renderWithProviders(<CreateDiskDialog onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("CreateDiskDialog under StrictMode", () => {
  it("still works after the effect teardown/setup cycle", async () => {
    // --- StrictMode tears every effect down and re-runs it once. A controller
    // --- that could only be disposed would leave the dialog frozen here, with
    // --- every control dead — and nothing else in the suite would catch it.
    const onCreate = vi.fn();
    renderWithProviders(
      <StrictMode>
        <CreateDiskDialog onCreate={onCreate} onClose={vi.fn()} />
      </StrictMode>
    );

    fillAndSubmit();

    await waitFor(() => expect(onCreate).toHaveBeenCalled());
  });
});
