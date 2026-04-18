/**
 * Phase 8 — Step 8.1: Modal component tests
 *
 * Tests: open/close lifecycle, primary/secondary/cancel triggers, button
 * enable/disable, keyboard escape, dim menu dispatch, dialog result.
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderWithProviders, screen, fireEvent, waitFor, act } from "../react-test-utils";
import { Modal, ModalApi } from "@controls/Modal";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderModal(overrides: Partial<Parameters<typeof Modal>[0]> = {}) {
  let api: ModalApi | undefined;
  const onClose = vi.fn();

  const result = renderWithProviders(
    <Modal
      isOpen={true}
      title="Test Modal"
      onClose={onClose}
      onApiLoaded={(a) => { api = a; }}
      {...overrides}
    >
      <div data-testid="modal-body">body content</div>
    </Modal>
  );

  return { ...result, api: api!, onClose };
}

// ---------------------------------------------------------------------------
// Open / close lifecycle
// ---------------------------------------------------------------------------

describe("Modal — open/close lifecycle", () => {
  it("renders children when isOpen=true", () => {
    renderModal();
    expect(screen.getByTestId("modal-body")).toBeInTheDocument();
  });

  it("does not render children when isOpen=false", () => {
    renderModal({ isOpen: false });
    expect(screen.queryByTestId("modal-body")).not.toBeInTheDocument();
  });

  it("renders the title", () => {
    renderModal({ title: "My Dialog" });
    expect(screen.getByText("My Dialog")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const { onClose } = renderModal();
    // The close button contains an Icon with 'close' — find the button element
    const closeBtn = document.querySelector('button[class*="closeButton"]') as HTMLElement;
    expect(closeBtn).not.toBeNull();

    await act(async () => {
      fireEvent.click(closeBtn);
    });

    expect(onClose).toHaveBeenCalled();
  });

  it("dispatches dimMenuAction(true) when opened", () => {
    const { store } = renderModal();
    expect(store.getState().dimMenu).toBe(true);
  });

  it("dispatches dimMenuAction(false) when isOpen becomes false", () => {
    const { store, rerender } = renderWithProviders(
      <Modal isOpen={true} title="T" onClose={vi.fn()}>
        <div />
      </Modal>
    );
    expect(store.getState().dimMenu).toBe(true);

    rerender(
      <Modal isOpen={false} title="T" onClose={vi.fn()}>
        <div />
      </Modal>
    );
    expect(store.getState().dimMenu).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Keyboard escape
// ---------------------------------------------------------------------------

describe("Modal — keyboard escape", () => {
  it("calls onClose when Escape is pressed", async () => {
    const { onClose } = renderModal();
    const dialog = screen.getByRole("dialog");

    await act(async () => {
      fireEvent.keyUp(dialog, { code: "Escape" });
    });

    expect(onClose).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Button triggers via API
// ---------------------------------------------------------------------------

describe("Modal — API triggers", () => {
  it("triggerPrimary calls onPrimaryClicked", async () => {
    const onPrimaryClicked = vi.fn().mockResolvedValue(false);
    const { api } = renderModal({ onPrimaryClicked });

    api.triggerPrimary("result-1");
    await waitFor(() => expect(onPrimaryClicked).toHaveBeenCalledWith("result-1"));
  });

  it("triggerSecondary calls onSecondaryClicked", async () => {
    const onSecondaryClicked = vi.fn().mockResolvedValue(false);
    const { api } = renderModal({ onSecondaryClicked });

    api.triggerSecondary("result-2");
    await waitFor(() => expect(onSecondaryClicked).toHaveBeenCalledWith("result-2"));
  });

  it("triggerCancel calls onCancelClicked", async () => {
    const onCancelClicked = vi.fn().mockResolvedValue(false);
    const { api } = renderModal({ onCancelClicked });

    api.triggerCancel("result-c");
    await waitFor(() => expect(onCancelClicked).toHaveBeenCalledWith("result-c"));
  });

  it("triggerClose calls onClose", () => {
    const { api, onClose } = renderModal();
    api.triggerClose();
    expect(onClose).toHaveBeenCalled();
  });

  it("triggerPrimary passes its argument to onPrimaryClicked", async () => {
    const onPrimaryClicked = vi.fn().mockResolvedValue(false);
    const { api } = renderModal({ onPrimaryClicked });

    api.triggerPrimary("stored-result");

    await waitFor(() => expect(onPrimaryClicked).toHaveBeenCalledWith("stored-result"));
  });
});

// ---------------------------------------------------------------------------
// Button enable/disable
// ---------------------------------------------------------------------------

describe("Modal — button enable/disable", () => {
  it("primary button respects primaryEnabled prop", () => {
    renderModal({ primaryEnabled: false });
    const okBtn = screen.getByRole("button", { name: /ok/i });
    expect(okBtn).toBeDisabled();
  });

  it("cancel button respects cancelEnabled prop", () => {
    renderModal({ cancelEnabled: false });
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    expect(cancelBtn).toBeDisabled();
  });

  it("enablePrimaryButton via API updates button state", async () => {
    const { api } = renderModal({ primaryEnabled: true });
    const okBtn = screen.getByRole("button", { name: /ok/i });
    expect(okBtn).not.toBeDisabled();

    await act(async () => {
      api.enablePrimaryButton(false);
    });
    expect(okBtn).toBeDisabled();
  });

  it("enableCancel via API updates cancel button state", async () => {
    const { api } = renderModal({ cancelEnabled: true });
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    expect(cancelBtn).not.toBeDisabled();

    await act(async () => {
      api.enableCancel(false);
    });
    expect(cancelBtn).toBeDisabled();
  });

  it("secondary button is visible only when secondaryVisible=true", () => {
    renderModal({ secondaryVisible: true, secondaryLabel: "Extra" });
    expect(screen.getByRole("button", { name: /extra/i })).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// Outside click closes
// ---------------------------------------------------------------------------

describe("Modal — outside click closes", () => {
  it("mousedown+mouseup on backdrop calls onClose", async () => {
    const { onClose } = renderModal();
    const backdrop = document.querySelector('[class*="modal"]') as HTMLElement;
    expect(backdrop).not.toBeNull();

    // Fire mouseDown and mouseUp in SEPARATE act calls so React flushes
    // the closeStarted state between them.
    await act(async () => {
      fireEvent.mouseDown(backdrop);
    });
    await act(async () => {
      fireEvent.mouseUp(backdrop);
    });

    expect(onClose).toHaveBeenCalled();
  });
});
