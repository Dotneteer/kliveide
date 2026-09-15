import { describe, expect, it, vi } from "vitest";
import React, { useEffect, useState } from "react";
import { renderWithProviders, screen, fireEvent, waitFor, act } from "../react-test-utils";
import {
  DialogComponentProps,
  useDialogs
} from "@renderer/controls/overlay/DialogProvider";
import { NexSynopsisCommentDialog } from "@renderer/appIde/DocumentPanels/Next/NexSynopsisCommentDialog";

type SampleDialogProps = DialogComponentProps<string> & {
  label: string;
};

function SampleDialog({ controls, label }: SampleDialogProps) {
  return (
    <div>
      <button onClick={() => controls.close(label)}>Resolve dialog</button>
      <button onClick={() => controls.cancel()}>Cancel dialog</button>
      <button onClick={() => controls.reject(new Error("dialog failed"))}>Reject dialog</button>
    </div>
  );
}

describe("DialogProvider", () => {
  it("opens a dialog and resolves with the component result", async () => {
    function Harness() {
      const dialogs = useDialogs();
      const [result, setResult] = useState("");

      return (
        <>
          <button
            onClick={async () => {
              const value = await dialogs.open(SampleDialog, { label: "done" }, {
                title: "Service Dialog"
              });
              setResult(value ?? "cancelled");
            }}
          >
            Open
          </button>
          <div data-testid="result">{result}</div>
        </>
      );
    }

    renderWithProviders(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    expect(await screen.findByRole("dialog", { name: "Service Dialog" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resolve dialog" }));

    await waitFor(() => {
      expect(screen.getByTestId("result")).toHaveTextContent("done");
    });
  });

  it("opens a managed dialog without requiring options", async () => {
    function Harness() {
      const dialogs = useDialogs();
      const [result, setResult] = useState("");

      return (
        <>
          <button
            onClick={async () => {
              const value = await dialogs.open(SampleDialog, { label: "no-options" });
              setResult(value ?? "cancelled");
            }}
          >
            Open
          </button>
          <div data-testid="result">{result}</div>
        </>
      );
    }

    renderWithProviders(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));

    fireEvent.click(await screen.findByRole("button", { name: "Resolve dialog" }));

    await waitFor(() => {
      expect(screen.getByTestId("result")).toHaveTextContent("no-options");
    });
  });

  it("cancelTop resolves the top dialog with undefined", async () => {
    function Harness() {
      const dialogs = useDialogs();
      const [result, setResult] = useState("");

      return (
        <>
          <button
            onClick={async () => {
              const value = await dialogs.open(SampleDialog, { label: "ignored" }, {
                title: "Cancelable Dialog"
              });
              setResult(value ?? "cancelled");
            }}
          >
            Open
          </button>
          <button onClick={() => dialogs.cancelTop()}>Cancel top</button>
          <div data-testid="result">{result}</div>
        </>
      );
    }

    renderWithProviders(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("dialog", { name: "Cancelable Dialog" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Cancel top" }));

    await waitFor(() => {
      expect(screen.getByTestId("result")).toHaveTextContent("cancelled");
    });
  });

  it("closeById closes the intended dialog", async () => {
    function Harness() {
      const dialogs = useDialogs();
      const [result, setResult] = useState("");

      return (
        <>
          <button
            onClick={async () => {
              const value = await dialogs.open(SampleDialog, { label: "ignored" }, {
                id: "target-dialog",
                title: "Target Dialog"
              });
              setResult(value ?? "cancelled");
            }}
          >
            Open
          </button>
          <button onClick={() => dialogs.closeById("target-dialog", "closed")}>Close target</button>
          <div data-testid="result">{result}</div>
        </>
      );
    }

    renderWithProviders(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("dialog", { name: "Target Dialog" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Close target" }));

    await waitFor(() => {
      expect(screen.getByTestId("result")).toHaveTextContent("closed");
    });
  });

  it("opens a custom renderer without wrapping it in a managed modal", async () => {
    function Harness() {
      const dialogs = useDialogs();
      const [result, setResult] = useState("");

      return (
        <>
          <button
            onClick={async () => {
              const value = await dialogs.open<string>((controls) => (
                <button onClick={() => controls.close("custom-result")}>Custom close</button>
              ));
              setResult(value ?? "cancelled");
            }}
          >
            Open custom
          </button>
          <div data-testid="result">{result}</div>
        </>
      );
    }

    renderWithProviders(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open custom" }));

    fireEvent.click(await screen.findByRole("button", { name: "Custom close" }));

    await waitFor(() => {
      expect(screen.getByTestId("result")).toHaveTextContent("custom-result");
    });
  });

  it("rejects when dialog controls reject", async () => {
    const onRejected = vi.fn();

    function Harness() {
      const dialogs = useDialogs();
      return (
        <button
          onClick={() => {
            dialogs
              .open(SampleDialog, { label: "ignored" }, { title: "Rejectable Dialog" })
              .catch(onRejected);
          }}
        >
          Open
        </button>
      );
    }

    renderWithProviders(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByRole("dialog", { name: "Rejectable Dialog" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reject dialog" }));

    await waitFor(() => {
      expect(onRejected).toHaveBeenCalledWith(new Error("dialog failed"));
    });
  });

  /*
   * A keyboard-driven panel has to get focus back, or its shortcuts die after the first dialog.
   *
   * The NEX listing reaches every annotation action from a bare letter, and a bare letter only
   * arrives while the listing is focused. This is the path that reported as "pressing C stops
   * working until I click a row again": the dialog autofocuses its textarea, and a modal that
   * recorded its opener from an effect recorded *that* rather than the listing. Driven through the
   * real dialog here, not a stand-in, because the autofocus is the whole point.
   */
  it("gives focus back to the keyboard opener after a dialog with an autofocused field", async () => {
    function Harness() {
      const dialogs = useDialogs();
      return (
        <div
          tabIndex={0}
          data-testid="listing"
          onKeyDown={(event) => {
            if (event.key !== "c") return;
            event.preventDefault();
            dialogs.open(
              NexSynopsisCommentDialog,
              { bank: 5, bankOffset: 0, effectiveAddress: 0x8000 },
              { title: "Synopsis comment" }
            );
          }}
        >
          listing
        </div>
      );
    }

    renderWithProviders(<Harness />);
    const listing = screen.getByTestId("listing");
    listing.focus();

    fireEvent.keyDown(listing, { key: "c" });
    await waitFor(() => expect(screen.getByLabelText("Synopsis preview")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() =>
      expect(screen.queryByLabelText("Synopsis preview")).not.toBeInTheDocument()
    );

    // --- Focus back on the listing, so the very next keystroke is heard. Landing on <body> is
    // --- what made the shortcut appear to stop working.
    expect(listing).toHaveFocus();

    fireEvent.keyDown(listing, { key: "c" });
    await waitFor(() => expect(screen.getByLabelText("Synopsis preview")).toBeInTheDocument());
  });

  it("settles pending dialogs on provider unmount", async () => {
    const onSettled = vi.fn();

    function Harness() {
      const dialogs = useDialogs();
      useEffect(() => {
        dialogs
          .open(SampleDialog, { label: "ignored" }, { title: "Pending Dialog" })
          .then(onSettled);
      }, [dialogs]);
      return null;
    }

    const { unmount } = renderWithProviders(<Harness />);
    expect(await screen.findByRole("dialog", { name: "Pending Dialog" })).toBeInTheDocument();

    await act(async () => {
      unmount();
    });

    await waitFor(() => {
      expect(onSettled).toHaveBeenCalledWith(undefined);
    });
  });
});
