import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NexEndOfLineCommentDialog,
  formatEndOfLinePreview,
  normalizeEndOfLineComment
} from "@renderer/appIde/DocumentPanels/Next/NexEndOfLineCommentDialog";

afterEach(() => {
  cleanup();
});

describe("NexEndOfLineCommentDialog", () => {
  it("normalizes user comments to a single line", () => {
    expect(normalizeEndOfLineComment("  entry note  ")).toBe("entry note");
    expect(normalizeEndOfLineComment("first\n second\t")).toBe("first second");
    expect(normalizeEndOfLineComment("  \n\t")).toBeUndefined();
    expect(formatEndOfLinePreview("generated", "user note")).toBe("; generated | user note");
    expect(formatEndOfLinePreview(undefined, "user note")).toBe("; user note");
  });

  it("shows row details, previews comments, and saves normalized text", () => {
    const controls = createControls();

    render(
      <NexEndOfLineCommentDialog
        bank={5}
        bankOffset={0x0123}
        effectiveAddress={0x8123}
        instruction="call L1234"
        generatedHardComment="generated note"
        controls={controls}
      />
    );

    expect(screen.getByText("$0123 (291)")).toBeInTheDocument();
    expect(screen.getByText("$8123 (33059)")).toBeInTheDocument();
    expect(screen.getByText("call L1234")).toBeInTheDocument();
    expect(screen.getByText("generated note")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: " User note  \ncontinued " }
    });

    expect(screen.getByLabelText("End-of-line preview")).toHaveTextContent(
      "; generated note | User note continued"
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(controls.close).toHaveBeenCalledWith({
      comment: "User note continued"
    });
  });

  it("clears an existing user comment and supports cancel", () => {
    const controls = createControls();

    render(
      <NexEndOfLineCommentDialog
        bank={5}
        bankOffset={0}
        effectiveAddress={0x8000}
        instruction="nop"
        initialComment="Old note"
        controls={controls}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(controls.close).toHaveBeenCalledWith({ comment: undefined });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(controls.cancel).toHaveBeenCalledTimes(1);
  });
});

function createControls() {
  return {
    id: "end-of-line-dialog",
    close: vi.fn(),
    cancel: vi.fn(),
    reject: vi.fn()
  };
}
