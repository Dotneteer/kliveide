import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ExcludedItemsIntent } from "@renderer/appIde/dialogs/excludedItems/ExcludedItemsIntents";
import { ExcludedItemsView } from "@renderer/appIde/dialogs/excludedItems/ExcludedItemsView";
import type { ExcludedItemsViewModel } from "@renderer/appIde/dialogs/excludedItems/ExcludedItemsViewModel";

import { fireEvent, renderWithProviders, screen, within } from "../../react-test-utils";
import { aState, aViewModel, anEnv, anItem, type DeepPartial } from "./fakes";

/**
 * `VirtualizedList` measures its viewport with a `ResizeObserver` and renders
 * only what fits. Under jsdom every element is zero-high, so it renders nothing
 * at all — which would make this file test virtua's measuring rather than this
 * view's mapping from view model to rows.
 *
 * The stub renders every item through the same `renderItem` callback, so what
 * is under test is exactly what the view is responsible for: which row gets
 * which item, and which id it reports when dismissed. `VirtualizedList` has its
 * own tests; virtua has its own tests.
 */
vi.mock("@renderer/controls/VirtualizedList", () => ({
  VirtualizedList: ({
    items,
    renderItem
  }: {
    items?: unknown[];
    renderItem?: (index: number) => ReactNode;
  }) => <div>{(items ?? []).map((_, index) => <div key={index}>{renderItem?.(index)}</div>)}</div>
}));

/**
 * The view is a pure function of its view model: which items are removable is a
 * field it reads, not a rule it applies.
 */
function renderView(
  over?: DeepPartial<ExcludedItemsViewModel>,
  state = aState()
): (intent: ExcludedItemsIntent) => void {
  const dispatch = vi.fn();
  renderWithProviders(<ExcludedItemsView vm={aViewModel(over, state)} dispatch={dispatch} />);
  return dispatch;
}

const withItems = aState({ globalItems: [anItem("node_modules")] }, anEnv({ projectName: "Klive" }), [
  anItem("build"),
  anItem("temp")
]);

describe("ExcludedItemsView — rendering", () => {
  it("labels each list from the view model", () => {
    renderView(undefined, withItems);

    expect(screen.getByText("Klive Excludes:")).toBeInTheDocument();
    expect(screen.getByText("Global Excludes:")).toBeInTheDocument();
  });

  it("shows the project's items in its own list", () => {
    renderView(undefined, withItems);

    const list = within(screen.getByTestId("project-excludes"));
    expect(list.getByText("build")).toBeInTheDocument();
    expect(list.getByText("temp")).toBeInTheDocument();
  });

  it("shows the global items in the other list", () => {
    renderView(undefined, withItems);

    expect(
      within(screen.getByTestId("global-excludes")).getByText("node_modules")
    ).toBeInTheDocument();
  });

  it("renders an empty list without complaint", () => {
    renderView(undefined, aState());

    expect(within(screen.getByTestId("project-excludes")).queryAllByTestId("excluded-item"))
      .toHaveLength(0);
  });
});

describe("ExcludedItemsView — intents", () => {
  it("reports the item the user dismissed, by its id", () => {
    const dispatch = renderView(undefined, withItems);
    const row = within(screen.getByTestId("project-excludes")).getAllByTestId("excluded-item")[0];

    fireEvent.mouseEnter(row);
    fireEvent.click(within(row).getByTestId("excluded-item-remove"));

    expect(dispatch).toHaveBeenCalledWith({ type: "itemRemovalRequested", id: "build" });
  });

  it("offers no way to remove a global item", () => {
    const dispatch = renderView(undefined, withItems);
    const row = within(screen.getByTestId("global-excludes")).getAllByTestId("excluded-item")[0];

    fireEvent.mouseEnter(row);

    expect(within(row).queryByTestId("excluded-item-remove")).not.toBeInTheDocument();
    expect(dispatch).not.toHaveBeenCalled();
  });
});
