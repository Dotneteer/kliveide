import { describe, expect, it } from "vitest";

import {
  cardFileRequiredHint,
  chooseImageHint,
  pristineCardHint,
  selectViewModel
} from "@renderer/appEmu/dialogs/z88/insertCard/Z88InsertCardViewModel";

import { CardIds, aState, anEnv } from "./fakes";

describe("Z88InsertCardViewModel — card type", () => {
  it("offers the options the slot allows and marks the selection", () => {
    const vm = selectViewModel(aState({ cardTypeId: CardIds.RAM512 }));

    expect(vm.cardType.value).toBe(CardIds.RAM512);
    expect(vm.cardType.options.map((option) => option.value)).toContain(CardIds.RAM512);
  });

  it("titles itself for the slot", () => {
    expect(selectViewModel(aState({}, anEnv(), 0)).title).toBe("Replace Z88 Card - Slot 0");
  });
});

describe("Z88InsertCardViewModel — the file row", () => {
  it("invites an image before a card type is chosen, so its size can choose one", () => {
    expect(selectViewModel(aState()).file).toMatchObject({
      kind: "shown",
      text: chooseImageHint(),
      warning: false
    });
  });

  it("says a smaller image goes at the top of the card", () => {
    const state = aState({
      cardTypeId: CardIds.EPROMUV32,
      file: "cards/app.epr",
      imageSize: 16 * 1024
    });

    expect(selectViewModel(state).file).toMatchObject({
      note: { text: "The 16K image goes at the top of the 32K card.", warning: false }
    });
  });

  it("warns when the chosen card cannot take the image", () => {
    const state = aState({
      cardTypeId: CardIds.EPROMUV32,
      file: "cards/big.epr",
      imageSize: 128 * 1024
    });
    const vm = selectViewModel(state);

    expect(vm.file).toMatchObject({
      note: {
        text: "The 128K image does not fit a 32K card. Choose another card type.",
        warning: true
      }
    });
    expect(vm.insertEnabled).toBe(false);
  });

  it("adds no note when the image fills its card", () => {
    const state = aState({
      cardTypeId: CardIds.EPROMUV128,
      file: "cards/a.epr",
      imageSize: 128 * 1024
    });

    expect(selectViewModel(state).file).toMatchObject({ note: undefined });
  });

  it("hides the row for a card that has no image", () => {
    expect(selectViewModel(aState({ cardTypeId: CardIds.RAM512 })).file.kind).toBe("hidden");
  });

  it("invites a file, or a blank card, in a card slot", () => {
    const file = selectViewModel(aState({ cardTypeId: CardIds.EPROMUV128 }, anEnv(), 1)).file;

    expect(file).toMatchObject({
      kind: "shown",
      text: pristineCardHint(),
      selected: false,
      warning: false,
      clearable: false
    });
  });

  it("insists on a file for the internal ROM socket", () => {
    const file = selectViewModel(aState({ cardTypeId: CardIds.EPROMUV128 }, anEnv(), 0)).file;

    expect(file).toMatchObject({
      kind: "shown",
      text: cardFileRequiredHint(),
      // --- Red, because slot 0 with no file is not a choice the user can make.
      warning: true
    });
  });

  it("shows a chosen file as a value that can be taken back off", () => {
    const state = aState({ cardTypeId: CardIds.EPROMUV128, file: "cards/a.epr" });

    expect(selectViewModel(state).file).toMatchObject({
      kind: "shown",
      text: "cards/a.epr",
      selected: true,
      warning: false,
      clearable: true
    });
  });

  it("drops a leading separator from the displayed path", () => {
    // --- The row is rendered right-to-left so a long path keeps its file name
    // --- visible; a leading "/" would be dragged to the wrong end of it.
    const state = aState({ cardTypeId: CardIds.EPROMUV128, file: "/cards/a.epr" });

    expect(selectViewModel(state).file).toMatchObject({ text: "cards/a.epr" });
  });
});

describe("Z88InsertCardViewModel — insertion", () => {
  it("refuses until a card type is chosen", () => {
    expect(selectViewModel(aState()).insertEnabled).toBe(false);
  });

  it("allows a blank card in a card slot", () => {
    const state = aState({ cardTypeId: CardIds.EPROMUV128 }, anEnv(), 2);

    expect(selectViewModel(state).insertEnabled).toBe(true);
  });

  it("refuses a blank internal ROM", () => {
    const state = aState({ cardTypeId: CardIds.EPROMUV128 }, anEnv(), 0);

    expect(selectViewModel(state).insertEnabled).toBe(false);
  });

  it("refuses while an insertion is already running", () => {
    const state = aState({ cardTypeId: CardIds.RAM512, busy: true });

    expect(selectViewModel(state).insertEnabled).toBe(false);
  });
});
