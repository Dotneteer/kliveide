import { describe, expect, it, vi } from "vitest";

import type { Z88InsertCardIntent } from "@renderer/appEmu/dialogs/z88/insertCard/Z88InsertCardIntents";
import { Z88InsertCardView } from "@renderer/appEmu/dialogs/z88/insertCard/Z88InsertCardView";
import type { Z88InsertCardViewModel } from "@renderer/appEmu/dialogs/z88/insertCard/Z88InsertCardViewModel";

import { fireEvent, renderWithProviders, screen } from "../../../react-test-utils";
import { aViewModel, type DeepPartial } from "./fakes";

/**
 * The view is a pure function of its view model: it never decides whether the
 * file row appears, what it says, or whether it is a warning. Those rules are
 * covered in the view-model suite; here we check that each field reaches the
 * markup and that a click reports the right intent.
 */
function renderView(
  over?: DeepPartial<Z88InsertCardViewModel>
): (intent: Z88InsertCardIntent) => void {
  const dispatch = vi.fn();
  renderWithProviders(<Z88InsertCardView vm={aViewModel(over)} dispatch={dispatch} />);
  return dispatch;
}

describe("Z88InsertCardView — the file row", () => {
  it("renders no file row when the view model hides it", () => {
    renderView({ file: { kind: "hidden" } });

    expect(screen.queryByTestId("z88-card-file")).not.toBeInTheDocument();
  });

  it("renders the text the view model carries", () => {
    renderView({ file: { kind: "shown", text: "cards/a.epr" } });

    expect(screen.getByTestId("z88-card-file")).toHaveTextContent("cards/a.epr");
  });

  it("offers a way to take a chosen file back off", () => {
    renderView({ file: { kind: "shown", text: "cards/a.epr", clearable: true } });

    expect(screen.getByTestId("z88-card-file-clear")).toBeInTheDocument();
  });

  it("offers no clear control when there is nothing to clear", () => {
    renderView({ file: { kind: "shown", text: "Use pristine card", clearable: false } });

    expect(screen.queryByTestId("z88-card-file-clear")).not.toBeInTheDocument();
  });
});

describe("Z88InsertCardView — intents", () => {
  it("reports a request to browse from the button", () => {
    const dispatch = renderView({ file: { kind: "shown", text: "Use pristine card" } });

    fireEvent.click(screen.getByTestId("z88-card-file-browse"));

    expect(dispatch).toHaveBeenCalledWith({ type: "selectCardFileRequested" });
  });

  it("reports a request to browse from the file name itself", () => {
    // --- The whole row is clickable, which is how the "click here" hint reads.
    const dispatch = renderView({ file: { kind: "shown", text: "click here" } });

    fireEvent.click(screen.getByTestId("z88-card-file"));

    expect(dispatch).toHaveBeenCalledWith({ type: "selectCardFileRequested" });
  });

  it("reports a request to clear the file", () => {
    const dispatch = renderView({
      file: { kind: "shown", text: "cards/a.epr", clearable: true }
    });

    fireEvent.click(screen.getByTestId("z88-card-file-clear"));

    expect(dispatch).toHaveBeenCalledWith({ type: "clearCardFileRequested" });
  });
});
