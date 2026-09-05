import { describe, expect, it, vi } from "vitest";

import { Z88RemoveCardView } from "@renderer/appEmu/dialogs/z88/removeCard/Z88RemoveCardView";

import { renderWithProviders, screen } from "../../../react-test-utils";
import { aViewModel } from "./fakes";

describe("Z88RemoveCardView", () => {
  it("asks the question the view model carries", () => {
    renderWithProviders(
      <Z88RemoveCardView
        vm={aViewModel({ question: "Are you sure you want to remove card from Slot 3?" })}
        dispatch={vi.fn()}
      />
    );

    expect(screen.getByTestId("z88-remove-card-question")).toHaveTextContent(
      "Are you sure you want to remove card from Slot 3?"
    );
  });
});
