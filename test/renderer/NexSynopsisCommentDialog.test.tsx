import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NexSynopsisCommentDialog,
  formatSynopsisPreview,
  normalizeSynopsisComment
} from "@renderer/appIde/DocumentPanels/Next/NexSynopsisCommentDialog";

afterEach(() => {
  cleanup();
});

describe("NexSynopsisCommentDialog", () => {
  it("normalizes trailing whitespace while preserving intentional blank lines", () => {
    expect(normalizeSynopsisComment(" First  \n\t\nSecond\t")).toBe(" First\n\nSecond");
    expect(normalizeSynopsisComment("  \n\t")).toBeUndefined();
    expect(formatSynopsisPreview("First\n\nSecond")).toBe("; First\n; \n; Second");
  });

  it("shows location, previews entered comments, and saves normalized text", () => {
    const controls = createControls();

    render(
      <NexSynopsisCommentDialog
        bank={5}
        bankOffset={0x0123}
        effectiveAddress={0x8123}
        controls={controls}
      />
    );

    expect(screen.getByText("$0123 (291)")).toBeInTheDocument();
    expect(screen.getByText("$8123 (33059)")).toBeInTheDocument();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Entry point  \n\nCalls setup\t" }
    });

    expect(screen.getByLabelText("Synopsis preview")).toHaveTextContent("; Entry point");
    expect(formatSynopsisPreview("Entry point  \n\nCalls setup\t")).toBe(
      "; Entry point\n; \n; Calls setup"
    );
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(controls.close).toHaveBeenCalledWith({
      synopsis: "Entry point\n\nCalls setup"
    });
  });

  it("clears an existing synopsis and supports cancel", () => {
    const controls = createControls();

    render(
      <NexSynopsisCommentDialog
        bank={5}
        bankOffset={0}
        effectiveAddress={0x8000}
        initialSynopsis="Old note"
        controls={controls}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(controls.close).toHaveBeenCalledWith({ synopsis: undefined });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(controls.cancel).toHaveBeenCalledTimes(1);
  });
});

function createControls() {
  return {
    id: "synopsis-dialog",
    close: vi.fn(),
    cancel: vi.fn(),
    reject: vi.fn()
  };
}
