import { describe, it, expect, vi } from "vitest";
import React from "react";
import { useState } from "react";
import { renderWithProviders, screen, fireEvent, waitFor, act } from "../react-test-utils";
import { Modal, ModalApi } from "@controls/Modal";
import { dimMenuAction } from "@state/actions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Renders a Modal and captures the ModalApi via onApiLoaded.
 * Returns both the RTL result and the captured api reference.
 */
function renderModal(overrides: Partial<Parameters<typeof Modal>[0]> = {}) {
  let api: ModalApi | undefined;
  const onClose = vi.fn();
  const { children = <div data-testid="modal-body">body content</div>, ...modalProps } = overrides;

  const result = renderWithProviders(
    <Modal
      isOpen={true}
      title="Test Modal"
      onClose={onClose}
      onApiLoaded={(a) => { api = a; }}
      {...modalProps}
    >
      {children}
    </Modal>
  );

  return { ...result, api: api!, onClose };
}

// ---------------------------------------------------------------------------
// Step 1.1 — triggerSecondary and triggerCancel call the correct handlers
// ---------------------------------------------------------------------------

describe("Modal — Step 1.1: triggerSecondary / triggerCancel dispatch correct handlers", () => {
  it("triggerPrimary calls onPrimaryClicked", async () => {
    const onPrimaryClicked = vi.fn().mockResolvedValue(false);
    const { api } = renderModal({ onPrimaryClicked });

    api.triggerPrimary();

    await waitFor(() => expect(onPrimaryClicked).toHaveBeenCalledTimes(1));
  });

  it("triggerSecondary calls onSecondaryClicked, NOT onPrimaryClicked", async () => {
    const onPrimaryClicked = vi.fn().mockResolvedValue(false);
    const onSecondaryClicked = vi.fn().mockResolvedValue(false);
    const { api } = renderModal({ onPrimaryClicked, onSecondaryClicked });

    api.triggerSecondary();

    await waitFor(() => expect(onSecondaryClicked).toHaveBeenCalledTimes(1));
    expect(onPrimaryClicked).not.toHaveBeenCalled();
  });

  it("triggerCancel calls onCancelClicked, NOT onPrimaryClicked", async () => {
    const onPrimaryClicked = vi.fn().mockResolvedValue(false);
    const onCancelClicked = vi.fn().mockResolvedValue(false);
    const { api } = renderModal({ onPrimaryClicked, onCancelClicked });

    api.triggerCancel();

    await waitFor(() => expect(onCancelClicked).toHaveBeenCalledTimes(1));
    expect(onPrimaryClicked).not.toHaveBeenCalled();
  });

  it("triggerSecondary passes the result argument to onSecondaryClicked", async () => {
    const onSecondaryClicked = vi.fn().mockResolvedValue(false);
    const { api } = renderModal({ onSecondaryClicked });

    api.triggerSecondary("my-result");

    await waitFor(() =>
      expect(onSecondaryClicked).toHaveBeenCalledWith("my-result")
    );
  });

  it("triggerCancel passes the result argument to onCancelClicked", async () => {
    const onCancelClicked = vi.fn().mockResolvedValue(false);
    const { api } = renderModal({ onCancelClicked });

    api.triggerCancel("cancel-result");

    await waitFor(() =>
      expect(onCancelClicked).toHaveBeenCalledWith("cancel-result")
    );
  });

  it("triggerClose calls onClose directly", async () => {
    const onClose = vi.fn();
    const { api } = renderModal({ onClose });

    api.triggerClose();

    expect(onClose).toHaveBeenCalled();
  });

  it("API triggers use the latest handlers after rerender", async () => {
    let api: ModalApi | undefined;
    const firstPrimary = vi.fn().mockResolvedValue(false);
    const latestPrimary = vi.fn().mockResolvedValue(false);

    const { rerender } = renderWithProviders(
      <Modal
        isOpen={true}
        title="T"
        onClose={vi.fn()}
        onApiLoaded={(loadedApi) => { api = loadedApi; }}
        onPrimaryClicked={firstPrimary}
      >
        <div />
      </Modal>
    );

    rerender(
      <Modal
        isOpen={true}
        title="T"
        onClose={vi.fn()}
        onApiLoaded={(loadedApi) => { api = loadedApi; }}
        onPrimaryClicked={latestPrimary}
      >
        <div />
      </Modal>
    );

    api!.triggerPrimary("latest");

    await waitFor(() => expect(latestPrimary).toHaveBeenCalledWith("latest"));
    expect(firstPrimary).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Step 1.2 — dimMenuAction is dispatched only when isOpen changes
// ---------------------------------------------------------------------------

describe("Modal — Step 1.2: dimMenuAction dispatched only on isOpen change", () => {
  it("dispatches dimMenuAction(true) when isOpen is true", () => {
    const { store } = renderWithProviders(
      <Modal isOpen={true} title="T" onClose={vi.fn()}>
        <div />
      </Modal>
    );
    expect(store.getState().dimMenu).toBe(true);
  });

  it("dispatches dimMenuAction(false) when isOpen is false", () => {
    const { store } = renderWithProviders(
      <Modal isOpen={false} title="T" onClose={vi.fn()}>
        <div />
      </Modal>
    );
    expect(store.getState().dimMenu).toBe(false);
  });

  it("does not dispatch again on an unrelated re-render", () => {
    const dispatchSpy = vi.fn();
    const { store, rerender } = renderWithProviders(
      <Modal isOpen={true} title="T" onClose={vi.fn()}>
        <div />
      </Modal>
    );

    const originalDispatch = store.dispatch.bind(store);
    store.dispatch = (...args: Parameters<typeof store.dispatch>) => {
      dispatchSpy(...args);
      return originalDispatch(...args);
    };

    // Re-render with the same isOpen — dispatch should NOT be called again
    rerender(
      <Modal isOpen={true} title="T" onClose={vi.fn()}>
        <div />
      </Modal>
    );

    const dimCalls = dispatchSpy.mock.calls.filter(
      (c) => c[0]?.type === dimMenuAction(true).type
    );
    expect(dimCalls.length).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Step 1.3 — button state syncs from props, not from state
// ---------------------------------------------------------------------------

describe("Modal — Step 1.3: cancelEnabled prop drives cancel button state", () => {
  it("cancel button is enabled when cancelEnabled=true", () => {
    renderWithProviders(
      <Modal isOpen={true} title="T" onClose={vi.fn()} cancelEnabled={true}>
        <div />
      </Modal>
    );
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    expect(cancelBtn).not.toBeDisabled();
  });

  it("cancel button is disabled when cancelEnabled=false", () => {
    renderWithProviders(
      <Modal isOpen={true} title="T" onClose={vi.fn()} cancelEnabled={false}>
        <div />
      </Modal>
    );
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    expect(cancelBtn).toBeDisabled();
  });

  it("cancel button updates when cancelEnabled prop changes", () => {
    const { rerender } = renderWithProviders(
      <Modal isOpen={true} title="T" onClose={vi.fn()} cancelEnabled={false}>
        <div />
      </Modal>
    );
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    expect(cancelBtn).toBeDisabled();

    rerender(
      <Modal isOpen={true} title="T" onClose={vi.fn()} cancelEnabled={true}>
        <div />
      </Modal>
    );
    expect(cancelBtn).not.toBeDisabled();
  });
});

describe("Modal — overlay portal and accessibility baseline", () => {
  it("renders the dialog portal under the shared overlay root", async () => {
    renderModal();

    await waitFor(() => {
      const overlayRoot = document.getElementById("overlayRoot");
      const dialog = screen.getByRole("dialog");

      expect(overlayRoot).toBeInTheDocument();
      expect(overlayRoot).toContainElement(dialog);
    });
  });

  it("uses generated aria labels and aria-modal", () => {
    renderModal({ title: "Accessible Modal" });

    const dialog = screen.getByRole("dialog", { name: "Accessible Modal" });
    const labelId = dialog.getAttribute("aria-labelledby");

    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(labelId).toBeTruthy();
    expect(labelId).not.toBe("dialogTitle");
    expect(document.getElementById(labelId!)).toHaveTextContent("Accessible Modal");
    expect(dialog).not.toHaveAttribute("aria-describedby", "dialogDesc");
  });

  it("uses alertdialog semantics for dangerous primary actions by default", () => {
    renderModal({ primaryDanger: true });

    expect(screen.getByRole("alertdialog", { name: "Test Modal" })).toBeInTheDocument();
  });

  it("supports an explicit dialog role override", () => {
    renderModal({ dialogRole: "dialog", primaryDanger: true });

    expect(screen.getByRole("dialog", { name: "Test Modal" })).toBeInTheDocument();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("does not close on Escape when closeOnEscape is false", async () => {
    const { onClose } = renderModal({ closeOnEscape: false });

    await act(async () => {
      fireEvent.keyDown(document, { code: "Escape" });
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it("does not close on outside click when closeOnOutsideClick is false", async () => {
    const { onClose } = renderModal({ closeOnOutsideClick: false });
    const backdrop = document.querySelector('[class*="modal"]') as HTMLElement;
    expect(backdrop).not.toBeNull();

    await act(async () => {
      fireEvent.mouseDown(backdrop);
    });
    await act(async () => {
      fireEvent.mouseUp(backdrop);
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("Modal — focus management and stack keyboard behavior", () => {
  it("focuses the first focusable body element when initialFocus is none", async () => {
    renderModal({
      initialFocus: "none",
      children: <input aria-label="Name" />
    });

    await waitFor(() => {
      expect(screen.getByLabelText("Name")).toHaveFocus();
    });
  });

  it("focuses requested action buttons", async () => {
    renderModal({ initialFocus: "cancel" });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /cancel/i })).toHaveFocus();
    });
  });

  it("restores focus to the opener after close", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Open modal</button>
          {open && (
            <Modal isOpen={true} title="Focus Restore" onClose={() => setOpen(false)}>
              <button>Inside</button>
            </Modal>
          )}
        </>
      );
    }

    renderWithProviders(<Harness />);
    const opener = screen.getByRole("button", { name: "Open modal" });
    opener.focus();
    fireEvent.click(opener);

    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Focus Restore" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    await waitFor(() => {
      expect(opener).toHaveFocus();
    });
  });

  it("wraps Tab and Shift+Tab within the modal", async () => {
    renderModal({
      initialFocus: "none",
      children: (
        <>
          <button>First field</button>
          <button>Last field</button>
        </>
      )
    });

    const dialog = screen.getByRole("dialog");
    const close = document.querySelector('button[class*="closeButton"]') as HTMLElement;
    const first = screen.getByRole("button", { name: "First field" });
    const last = screen.getByRole("button", { name: /cancel/i });
    expect(close).not.toBeNull();

    await waitFor(() => expect(first).toHaveFocus());

    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
  });

  it("closes only the topmost modal on document Escape", async () => {
    const lowerClose = vi.fn();
    const topClose = vi.fn();

    renderWithProviders(
      <>
        <Modal isOpen={true} title="Lower" onClose={lowerClose}>
          <button>Lower body</button>
        </Modal>
        <Modal isOpen={true} title="Top" onClose={topClose}>
          <button>Top body</button>
        </Modal>
      </>
    );

    await act(async () => {
      fireEvent.keyDown(document, { code: "Escape" });
    });

    expect(topClose).toHaveBeenCalledTimes(1);
    expect(lowerClose).not.toHaveBeenCalled();
  });
});
