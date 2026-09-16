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
  });

  /*
   * The preview has to make the same choice the listing does.
   *
   * A user comment replaces the disassembler's own in the row (see `decorateAnnotatedItems`), so a
   * preview that joined them would be a small lie about the thing it is previewing.
   */
  describe("the preview", () => {
    it("shows the user's comment alone when there is one", () => {
      expect(formatEndOfLinePreview("generated", "user note")).toBe("; user note");
      expect(formatEndOfLinePreview(undefined, "user note")).toBe("; user note");
    });

    it("falls back to the generated comment when the user's is empty", () => {
      // --- Which is also how it previews what the Clear button will leave behind.
      expect(formatEndOfLinePreview("generated", "")).toBe("; generated");
      expect(formatEndOfLinePreview("generated", "   ")).toBe("; generated");
      expect(formatEndOfLinePreview("generated", undefined)).toBe("; generated");
    });

    it("is empty when there is nothing to show", () => {
      expect(formatEndOfLinePreview(undefined, undefined)).toBe("");
      expect(formatEndOfLinePreview(undefined, "  ")).toBe("");
    });
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
      "; User note continued"
    );
    // --- The note being replaced stays on show in its own row while you type.
    expect(screen.getByText("generated note")).toBeInTheDocument();
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
