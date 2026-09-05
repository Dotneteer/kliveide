import { describe, expect, it, vi } from "vitest";

import type { Z88ChangeRamIntent } from "@renderer/appEmu/dialogs/z88/changeRam/Z88ChangeRamIntents";
import { RAM_CHANGE_WARNING } from "@renderer/appEmu/dialogs/z88/changeRam/Z88ChangeRamModel";
import { Z88ChangeRamView } from "@renderer/appEmu/dialogs/z88/changeRam/Z88ChangeRamView";
import type { Z88ChangeRamViewModel } from "@renderer/appEmu/dialogs/z88/changeRam/Z88ChangeRamViewModel";

import { renderWithProviders, screen } from "../../../react-test-utils";
import { aViewModel, type DeepPartial } from "./fakes";

/**
 * The view is a pure function of its view model. Whether the warning is earned
 * is the model's decision and is tested there; here we only check that a
 * view-model field reaches the markup.
 */
function renderView(
  over?: DeepPartial<Z88ChangeRamViewModel>
): (intent: Z88ChangeRamIntent) => void {
  const dispatch = vi.fn();
  renderWithProviders(<Z88ChangeRamView vm={aViewModel(over)} dispatch={dispatch} />);
  return dispatch;
}

describe("Z88ChangeRamView", () => {
  it("shows the selected RAM size", () => {
    renderView({ ramSize: { value: "128" } });

    expect(screen.getByText("128K")).toBeInTheDocument();
  });

  it("renders the restart warning the view model carries", () => {
    renderView({ warning: RAM_CHANGE_WARNING });

    expect(screen.getByTestId("z88-ram-warning")).toHaveTextContent(RAM_CHANGE_WARNING);
  });

  it("renders no warning row when the view model carries none", () => {
    renderView({ warning: undefined });

    expect(screen.queryByTestId("z88-ram-warning")).not.toBeInTheDocument();
  });
});
