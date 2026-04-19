/**
 * React Testing Library utilities for Klive component tests.
 *
 * Usage:
 *   import { renderWithProviders, createMockStore } from "../react-test-utils";
 */

import React, { ReactElement, ReactNode } from "react";
import { render, RenderOptions, RenderResult, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Ensure DOM is cleaned up after every test regardless of environment setup
afterEach(() => { cleanup(); });
import createAppStore from "@state/store";
import { Store } from "@state/redux-light";
import { AppState } from "@state/AppState";
import { MessengerBase } from "@messaging/MessengerBase";
import { Channel, RequestMessage } from "@messaging/messages-core";
import RendererProvider from "@renderer/core/RendererProvider";
import ThemeProvider from "@renderer/theming/ThemeProvider";

// ─── Mock Messenger ──────────────────────────────────────────────────────────

/**
 * No-op messenger for use in unit tests. Swallows all outgoing messages and
 * never resolves pending `sendMessage` promises (which is fine for unit tests
 * that do not exercise cross-process IPC).
 */
export class MockMessenger extends MessengerBase {
  protected send(_message: RequestMessage): void {
    // no-op — no Electron IPC in tests
  }

  get requestChannel(): Channel {
    return "MainToEmu";
  }
}

// ─── Store Factory ────────────────────────────────────────────────────────────

/**
 * Creates a fresh AppState store suitable for use in tests.
 * Uses the "test" message source so no IPC forwarding is attempted.
 */
export function createMockStore(): Store<AppState> {
  return createAppStore("test");
}

// ─── Provider Wrapper ────────────────────────────────────────────────────────

type ProvidersProps = {
  store?: Store<AppState>;
  messenger?: MockMessenger;
  children: ReactNode;
};

/**
 * Wraps children with the minimum set of React providers that most Klive
 * components require:
 *   - RendererProvider  (store, messenger, messageSource)
 *   - ThemeProvider     (theme CSS variables, useTheme() hook)
 *
 * AppServicesProvider is intentionally excluded because it instantiates
 * machine services that depend on Electron IPC. Inject it explicitly in
 * tests that need it.
 */
function AllProviders({ store, messenger, children }: ProvidersProps) {
  return (
    <RendererProvider
      store={store ?? createMockStore()}
      messenger={messenger ?? new MockMessenger()}
      messageSource="ide"
    >
      <ThemeProvider>{children}</ThemeProvider>
    </RendererProvider>
  );
}

// ─── renderWithProviders ─────────────────────────────────────────────────────

type RenderWithProvidersOptions = Omit<RenderOptions, "wrapper"> & {
  /** Pre-configured store. Defaults to a fresh mock store. */
  store?: Store<AppState>;
  /** Pre-configured messenger. Defaults to a MockMessenger. */
  messenger?: MockMessenger;
};

/**
 * Renders a React element inside the standard provider tree.
 *
 * @example
 * const { getByText } = renderWithProviders(<MyComponent />);
 *
 * @example
 * const store = createMockStore();
 * store.dispatch(someAction());
 * const { getByRole } = renderWithProviders(<MyComponent />, { store });
 */
export function renderWithProviders(
  ui: ReactElement,
  { store, messenger, ...renderOptions }: RenderWithProvidersOptions = {}
): RenderResult & { store: Store<AppState> } {
  const resolvedStore = store ?? createMockStore();
  const resolvedMessenger = messenger ?? new MockMessenger();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <AllProviders store={resolvedStore} messenger={resolvedMessenger}>
        {children}
      </AllProviders>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...renderOptions }),
    store: resolvedStore
  };
}

// ─── Re-exports ───────────────────────────────────────────────────────────────

export { screen, fireEvent, waitFor, act } from "@testing-library/react";
export { default as userEvent } from "@testing-library/user-event";
