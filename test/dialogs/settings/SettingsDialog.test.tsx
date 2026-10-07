import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";

import { SettingsDialog } from "@renderer/appIde/dialogs/settings/SettingsDialog";
import { SETTING_IDE_SIDEBAR_TO_RIGHT } from "@common/settings/setting-const";

import { fireEvent, renderWithProviders, screen, waitFor } from "../../react-test-utils";

/*
 * Wiring only: the dialog's decisions are covered headlessly in `settings-controller.test.ts`. This
 * checks that the view renders the pages and rows, and that gestures reach the main process.
 */

const mainApiMock = vi.hoisted(() => ({
  setGlobalSettingsValue: vi.fn(() => Promise.resolve()),
  runUiAction: vi.fn(() => Promise.resolve(undefined))
}));

vi.mock("@renderer/core/MainApi", () => ({ useMainApi: () => mainApiMock }));

describe("SettingsDialog — wiring", () => {
  it("opens on the page it was asked for", () => {
    renderWithProviders(<SettingsDialog data={{ page: "editor" }} onClose={vi.fn()} />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByTestId("settings-page-editor")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("settings-row-tabSize")).toBeInTheDocument();
  });

  it("switches pages", () => {
    renderWithProviders(<SettingsDialog onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId("settings-page-appearance"));
    expect(screen.getByTestId("settings-row-sidebarToRight")).toBeInTheDocument();
  });

  it("writes a switch through the main process", async () => {
    renderWithProviders(<SettingsDialog data={{ page: "appearance" }} onClose={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Sidebar on the right"));
    await waitFor(() =>
      expect(mainApiMock.setGlobalSettingsValue).toHaveBeenCalledWith(SETTING_IDE_SIDEBAR_TO_RIGHT, true)
    );
  });

  it("picks an accent", async () => {
    renderWithProviders(<SettingsDialog data={{ page: "appearance" }} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("radio", { name: "Ember" }));
    await waitFor(() => expect(mainApiMock.runUiAction).toHaveBeenCalledWith("set:accent", "ember"));
  });

  it("closes from the footer", () => {
    const onClose = vi.fn();
    renderWithProviders(<SettingsDialog onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    return waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});

describe("SettingsDialog under StrictMode", () => {
  it("still writes after the effect teardown/setup cycle", async () => {
    mainApiMock.runUiAction.mockClear();
    renderWithProviders(
      <StrictMode>
        <SettingsDialog data={{ page: "integrations" }} onClose={vi.fn()} />
      </StrictMode>
    );
    fireEvent.click(screen.getByRole("button", { name: "Configure..." }));
    await waitFor(() => expect(mainApiMock.runUiAction).toHaveBeenCalledWith("dialog:sjasmplus", undefined));
  });
});
