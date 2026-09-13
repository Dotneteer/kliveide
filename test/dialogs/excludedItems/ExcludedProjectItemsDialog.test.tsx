import { StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExcludedProjectItemsDialog } from "@renderer/appIde/dialogs/excludedItems/ExcludedProjectItemsDialog";

import {
  createMockStore,
  fireEvent,
  renderWithProviders,
  screen,
  waitFor,
  within
} from "../../react-test-utils";

/**
 * Container-level tests assert wiring and nothing else: that the messenger and
 * the store reach the ports, and that the modal frame is what the old component
 * put on screen. Every rule about what the dialog *decides* is covered
 * headlessly in the model, view-model and controller suites.
 */

const utilsMock = vi.hoisted(() => ({
  getExcludedProjectItemsFromGlobalSettings: vi.fn(),
  excludedItemsFromProject: vi.fn()
}));

const saveProjectMock = vi.hoisted(() => vi.fn());

vi.mock("@renderer/appIde/utils/excluded-items-utils", () => ({
  getExcludedProjectItemsFromGlobalSettings:
    utilsMock.getExcludedProjectItemsFromGlobalSettings,
  excludedItemsFromProject: utilsMock.excludedItemsFromProject
}));

vi.mock("@renderer/appIde/utils/save-project", () => ({
  saveProject: saveProjectMock
}));

// --- See the view suite: the virtualized list renders nothing under jsdom, so
// --- the rows are stubbed in to keep this file about the container's wiring.
vi.mock("@renderer/controls/VirtualizedList", () => ({
  VirtualizedList: ({
    items,
    renderItem
  }: {
    items?: unknown[];
    renderItem?: (index: number) => ReactNode;
  }) => <div>{(items ?? []).map((_, index) => <div key={index}>{renderItem?.(index)}</div>)}</div>
}));

beforeEach(() => {
  utilsMock.getExcludedProjectItemsFromGlobalSettings.mockResolvedValue([
    { id: "node_modules", value: "node_modules" }
  ]);
  utilsMock.excludedItemsFromProject.mockReturnValue([
    { id: "build", value: "build" },
    { id: "temp", value: "temp" }
  ]);
  saveProjectMock.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.clearAllMocks();
});

const okButton = () => screen.getByRole("button", { name: "OK" });

describe("ExcludedProjectItemsDialog — wiring", () => {
  it("puts the dialog title on screen", () => {
    renderWithProviders(<ExcludedProjectItemsDialog onClose={vi.fn()} />);

    expect(screen.getByText("Excluded Items")).toBeInTheDocument();
  });

  it("seeds the project list from the store's project", () => {
    renderWithProviders(<ExcludedProjectItemsDialog onClose={vi.fn()} />);

    const list = within(screen.getByTestId("project-excludes"));
    expect(list.getByText("build")).toBeInTheDocument();
    expect(list.getByText("temp")).toBeInTheDocument();
  });

  it("loads the global list through the messenger", async () => {
    renderWithProviders(<ExcludedProjectItemsDialog onClose={vi.fn()} />);

    await waitFor(() =>
      expect(
        within(screen.getByTestId("global-excludes")).getByText("node_modules")
      ).toBeInTheDocument()
    );
  });

  it("labels the project list from the store's folder path", () => {
    const store = createMockStore();
    renderWithProviders(<ExcludedProjectItemsDialog onClose={vi.fn()} />, { store });

    // --- No project open, so the dialog falls back to the placeholder name.
    expect(screen.getByText("Unnamed Excludes:")).toBeInTheDocument();
  });

  it("saves the pruned list and settles the dialog", async () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(
      <ExcludedProjectItemsDialog onApply={onApply} onClose={onClose} />
    );

    const row = within(screen.getByTestId("project-excludes")).getAllByTestId(
      "excluded-item"
    )[0];
    fireEvent.mouseEnter(row);
    fireEvent.click(within(row).getByTestId("excluded-item-remove"));
    fireEvent.click(okButton());

    await waitFor(() => expect(saveProjectMock).toHaveBeenCalled());
    expect(onApply).toHaveBeenCalledWith({ excludedItemIds: ["temp"] });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("cancels without saving", async () => {
    const onClose = vi.fn();
    renderWithProviders(<ExcludedProjectItemsDialog onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(saveProjectMock).not.toHaveBeenCalled();
  });
});

describe("ExcludedProjectItemsDialog under StrictMode", () => {
  it("still works after the effect teardown/setup cycle", async () => {
    const onApply = vi.fn();
    renderWithProviders(
      <StrictMode>
        <ExcludedProjectItemsDialog onApply={onApply} onClose={vi.fn()} />
      </StrictMode>
    );

    fireEvent.click(okButton());

    await waitFor(() =>
      expect(onApply).toHaveBeenCalledWith({ excludedItemIds: ["build", "temp"] })
    );
  });
});
