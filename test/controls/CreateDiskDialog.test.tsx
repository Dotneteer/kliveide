import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../react-test-utils";
import { CreateDiskDialog } from "@renderer/appEmu/dialogs/CreateDiskDialog";

const serviceMock = vi.hoisted(() => ({
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
      isValidPath: serviceMock.isValidPath,
      isValidFilename: serviceMock.isValidFilename
    }
  })
}));

vi.mock("@renderer/core/MainApi", () => ({
  useMainApi: () => mainApiMock
}));

afterEach(() => {
  cleanup();
  serviceMock.isValidPath.mockReset();
  serviceMock.isValidFilename.mockReset();
  mainApiMock.createDiskFile.mockReset();
  mainApiMock.displayMessageBox.mockReset();
  mainApiMock.showOpenFolderDialog.mockReset();
});

describe("CreateDiskDialog", () => {
  it("creates a disk and resolves its result", async () => {
    serviceMock.isValidPath.mockReturnValue(true);
    serviceMock.isValidFilename.mockReturnValue(true);
    mainApiMock.createDiskFile.mockResolvedValue("/tmp/disk.dsk");
    mainApiMock.displayMessageBox.mockResolvedValue(undefined);
    const onCreate = vi.fn();

    renderWithProviders(<CreateDiskDialog onCreate={onCreate} onClose={vi.fn()} />);

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "/tmp" } });
    fireEvent.change(inputs[1], { target: { value: "disk.dsk" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(mainApiMock.createDiskFile).toHaveBeenCalledWith("/tmp", "disk.dsk", "ss");
    });
    expect(onCreate).toHaveBeenCalledWith({
      diskType: "ss",
      folder: "/tmp",
      filename: "disk.dsk",
      path: "/tmp/disk.dsk"
    });
  });

  it("disables create when validation rejects the filename", async () => {
    serviceMock.isValidPath.mockReturnValue(true);
    serviceMock.isValidFilename.mockImplementation((value: string) => value !== "bad/name");

    renderWithProviders(<CreateDiskDialog onClose={vi.fn()} />);

    const inputs = screen.getAllByRole("textbox");
    fireEvent.change(inputs[0], { target: { value: "/tmp" } });
    fireEvent.change(inputs[1], { target: { value: "bad/name" } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
    });
  });
});
