import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "../react-test-utils";
import { SetMemoryDialog } from "@renderer/appIde/dialogs/SetMemoryDialog";

const appServicesMock = vi.hoisted(() => ({
  executeCommand: vi.fn()
}));

vi.mock("@renderer/appIde/services/AppServicesProvider", () => ({
  useAppServices: () => ({
    ideCommandsService: {
      executeCommand: appServicesMock.executeCommand
    }
  })
}));

afterEach(() => {
  cleanup();
  appServicesMock.executeCommand.mockReset();
  vi.restoreAllMocks();
});

describe("SetMemoryDialog", () => {
  it("resolves RAM edits with value, size option, and endian flag", async () => {
    appServicesMock.executeCommand.mockResolvedValue({ success: true });
    const onSetMemory = vi.fn();

    renderWithProviders(
      <SetMemoryDialog
        address={0x4000}
        currentValue={0x12}
        decimal={false}
        onSetMemory={onSetMemory}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Set" }));

    await waitFor(() => {
      expect(onSetMemory).toHaveBeenCalledWith({
        value: "$12",
        sizeOption: "-b8",
        bigEndian: false
      });
    });
    expect(appServicesMock.executeCommand).toHaveBeenCalledWith("num $12");
  });

  it("keeps the dialog open and displays an error when submit validation rejects a value", async () => {
    appServicesMock.executeCommand.mockImplementation((command: string) =>
      Promise.resolve({ success: command !== "num nope" })
    );

    renderWithProviders(
      <SetMemoryDialog
        address={0x4000}
        currentValue={0x12}
        decimal={false}
        onSetMemory={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "nope" } });
    fireEvent.click(screen.getByRole("button", { name: "Set" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Enter a valid numeric value.");
    });
    expect(appServicesMock.executeCommand).toHaveBeenCalledWith("num nope");
  });

  it("hides the primary action and closes in ROM mode", async () => {
    appServicesMock.executeCommand.mockResolvedValue({ success: true });
    const onClose = vi.fn();

    renderWithProviders(
      <SetMemoryDialog
        address={0x0000}
        currentValue={0xff}
        decimal={false}
        isRom={true}
        onSetMemory={vi.fn()}
        onClose={onClose}
      />
    );

    expect(screen.queryByRole("button", { name: "Set" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
