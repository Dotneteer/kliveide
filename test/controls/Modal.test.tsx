import { describe, it, expect, vi } from "vitest";
import React from "react";
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
