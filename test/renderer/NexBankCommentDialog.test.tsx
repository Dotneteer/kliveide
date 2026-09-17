import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NexBankCommentDialog } from "@renderer/appIde/DocumentPanels/Next/NexBankCommentDialog";
import { NEX_BANK_COMMENT_SOFT_LIMIT } from "@renderer/appIde/DocumentPanels/Next/nexAnnotations";

afterEach(() => {
  cleanup();
});

function createControls() {
  return {
    id: "bank-comment-dialog",
    close: vi.fn(),
    cancel: vi.fn(),
    reject: vi.fn()
  };
}

describe("NexBankCommentDialog", () => {
  it("shows the bank and saves the normalized comment", () => {
    const controls = createControls();
    render(<NexBankCommentDialog bank={5} controls={controls} />);

    expect(screen.getByText("$05 (5)")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Music player  \r\n\r\nIM2 handler\t" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(controls.close).toHaveBeenCalledWith({ comment: "Music player\n\nIM2 handler" });
  });

  it("previews the comment as the one line the heading will show", () => {
    render(<NexBankCommentDialog bank={10} controls={createControls()} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "First\n\n Second " } });

    const preview = screen.getByLabelText("Heading preview");
    expect(preview).toHaveTextContent("Bank $0A");
    expect(preview).toHaveTextContent("First · Second");
  });

  it("keeps Enter for new lines and saves on Ctrl+Enter or Cmd+Enter", () => {
    const controls = createControls();
    render(<NexBankCommentDialog bank={5} initialComment="Note" controls={controls} />);
    const textbox = screen.getByRole("textbox");

    fireEvent.keyDown(textbox, { key: "Enter" });
    expect(controls.close).not.toHaveBeenCalled();

    fireEvent.keyDown(textbox, { key: "Enter", ctrlKey: true });
    fireEvent.keyDown(textbox, { key: "Enter", metaKey: true });
    expect(controls.close).toHaveBeenCalledTimes(2);
    expect(controls.close).toHaveBeenCalledWith({ comment: "Note" });
  });

  it("saves an emptied comment as a clear", () => {
    const controls = createControls();
    render(<NexBankCommentDialog bank={5} initialComment="Note" controls={controls} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  \n " } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(controls.close).toHaveBeenCalledWith({ comment: undefined });
  });

  it("offers Clear only for an existing comment, and supports Cancel", () => {
    const controls = createControls();
    const { rerender } = render(<NexBankCommentDialog bank={5} controls={controls} />);
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull();

    rerender(<NexBankCommentDialog bank={5} initialComment="Old" controls={controls} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(controls.close).toHaveBeenCalledWith({ comment: undefined });

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(controls.cancel).toHaveBeenCalledTimes(1);
  });

  it("counts characters against the soft limit", () => {
    render(<NexBankCommentDialog bank={5} initialComment="abc" controls={createControls()} />);
    expect(screen.getByText(`3 / ${NEX_BANK_COMMENT_SOFT_LIMIT}`)).toBeInTheDocument();
  });
});
