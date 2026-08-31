import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NexRegionsDialog } from "@renderer/appIde/DocumentPanels/Next/NexRegionsDialog";

afterEach(() => {
  cleanup();
});

describe("NexRegionsDialog", () => {
  it("selects the active region by default and reports row actions", () => {
    const controls = createControls();

    render(
      <NexRegionsDialog
        activeOffset={5}
        bytes={[1, 2, 3, 4, 0, 0, 0, 0]}
        regions={[
          { start: 0, end: 3, type: "bytes" },
          { start: 4, end: 0x3fff, type: "disassemble" }
        ]}
        controls={controls}
      />
    );

    expect(screen.getByLabelText("Region preview")).toHaveTextContent(
      "$0004 Z80 disassembly"
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Go To" })[1]);

    expect(controls.close).toHaveBeenCalledWith({
      action: "go-to",
      region: { start: 4, end: 0x3fff, type: "disassemble" }
    });
  });

  it("filters regions by address and type", () => {
    const controls = createControls();

    render(
      <NexRegionsDialog
        activeOffset={0}
        bytes={[1, 2, 3, 4, 0, 0, 0, 0]}
        regions={[
          { start: 0, end: 3, type: "bytes" },
          { start: 4, end: 7, type: "words" },
          { start: 8, end: 0x3fff, type: "skip" }
        ]}
        controls={controls}
      />
    );

    fireEvent.change(screen.getByLabelText("Filter region type"), {
      target: { value: "words" }
    });

    expect(screen.getByText("words")).toBeInTheDocument();
    expect(screen.queryByText("bytes")).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search regions"), {
      target: { value: "$0008" }
    });
    fireEvent.change(screen.getByLabelText("Filter region type"), {
      target: { value: "all" }
    });

    expect(screen.getByText("skip")).toBeInTheDocument();
    expect(screen.queryByText("words")).not.toBeInTheDocument();
  });

  it("reports edit, split, revert, and add actions", () => {
    const controls = createControls();

    render(
      <NexRegionsDialog
        activeOffset={0}
        bytes={[1, 2, 3, 4]}
        regions={[{ start: 0, end: 3, type: "bytes" }]}
        controls={controls}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect(controls.close).toHaveBeenCalledWith({
      action: "edit",
      region: { start: 0, end: 3, type: "bytes" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Split" }));
    expect(controls.close).toHaveBeenCalledWith({
      action: "split",
      region: { start: 0, end: 3, type: "bytes" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Revert" }));
    expect(controls.close).toHaveBeenCalledWith({
      action: "revert",
      region: { start: 0, end: 3, type: "bytes" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Add Region" }));
    expect(controls.close).toHaveBeenCalledWith({ action: "add" });
  });
});

function createControls() {
  return {
    id: "regions-dialog",
    close: vi.fn(),
    cancel: vi.fn(),
    reject: vi.fn()
  };
}
