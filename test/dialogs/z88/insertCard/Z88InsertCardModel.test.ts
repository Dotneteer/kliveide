import { describe, expect, it } from "vitest";

import {
  SLOT0_ACCEPTED_SIZES_KB,
  acceptedSizesOf,
  allowedCardTypesFor,
  canInsert,
  cardOptionsFor,
  configWithSlot0,
  fallbackTypeFor,
  initialState,
  invalidSizeMessage,
  isAcceptedSize,
  needsFile,
  pickerSizesOf,
  reduce,
  requiresRestart,
  slotStateOf,
  titleOf
} from "@renderer/appEmu/dialogs/z88/insertCard/Z88InsertCardModel";

import { CardIds, MC_Z88_SLOT0, aState, anEnv } from "./fakes";

describe("Z88InsertCardModel — the card catalogue", () => {
  it("hides the emulator's own bookkeeping cards from every slot", () => {
    // --- The plain "ROM" entry exists so the tool area can describe a slot; it
    // --- is not something a user inserts.
    for (const slot of [0, 1, 2, 3]) {
      expect(allowedCardTypesFor(slot).map((card) => card.value)).not.toContain(CardIds.ANYROM);
    }
  });

  it("offers only slot-0 cards for the internal ROM socket", () => {
    const slot0 = allowedCardTypesFor(0).map((card) => card.value);

    expect(slot0).toContain(CardIds.EPROMUV128);
    // --- RAM in the ROM socket would leave the machine nothing to boot from.
    expect(slot0).not.toContain(CardIds.RAM512);
  });

  it("offers RAM as well in a card slot", () => {
    expect(allowedCardTypesFor(1).map((card) => card.value)).toContain(CardIds.RAM512);
  });

  it("reads the catalogue's size marker as prose", () => {
    // --- The catalogue writes "RAM*512K" so the tool area can split it into a
    // --- column; a dropdown wants one readable line.
    const option = cardOptionsFor(1).find((entry) => entry.value === CardIds.RAM512);

    expect(option?.label).toBe("RAM 512K");
  });
});

describe("Z88InsertCardModel — accepted sizes", () => {
  it("has no accepted sizes until a card type is chosen", () => {
    expect(acceptedSizesOf(aState())).toEqual([]);
  });

  it("takes the accepted sizes from the chosen card's fallbacks", () => {
    const state = aState({ cardTypeId: CardIds.EPROMUV128 });

    expect(acceptedSizesOf(state)).toEqual([32, 128, 256]);
  });

  it("narrows the picker further for the internal ROM socket", () => {
    // --- A 32K EPROM is a legal card but not a legal internal ROM.
    const state = aState({ cardTypeId: CardIds.EPROMUV128 }, anEnv(), 0);

    expect(pickerSizesOf(state)).toEqual([128, 256]);
    expect(pickerSizesOf(state).every((size) => SLOT0_ACCEPTED_SIZES_KB.includes(size))).toBe(
      true
    );
  });

  it("keeps every fallback size for a card slot", () => {
    const state = aState({ cardTypeId: CardIds.EPROMUV128 }, anEnv(), 2);

    expect(pickerSizesOf(state)).toEqual([32, 128, 256]);
  });

  it("measures an image against the accepted sizes in kilobytes", () => {
    expect(isAcceptedSize([128], 128 * 1024)).toBe(true);
    expect(isAcceptedSize([128], 128 * 1024 - 1)).toBe(false);
    expect(isAcceptedSize([], 128 * 1024)).toBe(false);
  });

  it("says how big the rejected card was, in both units", () => {
    expect(invalidSizeMessage(64 * 1024)).toBe(
      "The size of the selected card is 65536 bytes (64 KBytes), which is not allowed in this slot."
    );
  });
});

describe("Z88InsertCardModel — size-implied card type", () => {
  it("resolves a card family to the chip the image's size implies", () => {
    expect(fallbackTypeFor(CardIds.EPROMUV128, 32 * 1024)).toBe(CardIds.EPROMUV32);
    expect(fallbackTypeFor(CardIds.EPROMUV32, 256 * 1024)).toBe(CardIds.EPROMUV256);
  });

  it("leaves a card with no fallback table alone", () => {
    expect(fallbackTypeFor(CardIds.RAM512, 512 * 1024)).toBeUndefined();
  });

  it("leaves the selection alone when the size matches no fallback", () => {
    expect(fallbackTypeFor(CardIds.EPROMUV128, 64 * 1024)).toBeUndefined();
  });

  it("leaves the selection alone when the check returned no content", () => {
    // --- A check that produced neither an image nor a complaint has no length
    // --- to measure; the old component read `.length` off it and threw.
    expect(fallbackTypeFor(CardIds.EPROMUV128, undefined)).toBeUndefined();
  });
});

describe("Z88InsertCardModel — what can be inserted", () => {
  it("needs nothing but a type for a RAM card", () => {
    expect(needsFile(aState({ cardTypeId: CardIds.RAM512 }))).toBe(false);
    expect(canInsert(aState({ cardTypeId: CardIds.RAM512 }))).toBe(true);
  });

  it("accepts a blank file-backed card in a card slot", () => {
    // --- An EPROM with no image is a blank one, which is a legitimate choice.
    expect(canInsert(aState({ cardTypeId: CardIds.EPROMUV128 }, anEnv(), 1))).toBe(true);
  });

  it("refuses a blank internal ROM", () => {
    // --- The machine has to boot from something.
    expect(canInsert(aState({ cardTypeId: CardIds.EPROMUV128 }, anEnv(), 0))).toBe(false);
  });

  it("accepts an internal ROM once a file is chosen", () => {
    const state = aState({ cardTypeId: CardIds.EPROMUV128, file: "/roms/z88.rom" }, anEnv(), 0);

    expect(canInsert(state)).toBe(true);
  });

  it("refuses with no card type at all", () => {
    expect(canInsert(aState({ file: "/roms/z88.rom" }))).toBe(false);
  });
});

describe("Z88InsertCardModel — the slot state written to the machine", () => {
  it("carries the card's id, size and file", () => {
    const state = aState({ cardTypeId: CardIds.EPROMUV128, file: "/cards/a.epr" });

    expect(slotStateOf(state)).toEqual({
      cardType: CardIds.EPROMUV128,
      size: 128,
      file: "/cards/a.epr"
    });
  });

  it("marks a file-backed card with no file as pristine", () => {
    // --- So the machine formats a blank card rather than trying to read one.
    expect(slotStateOf(aState({ cardTypeId: CardIds.EPROMUV128 }, anEnv(), 1))).toMatchObject({
      pristine: true
    });
  });

  it("does not mark a RAM card as pristine", () => {
    expect(slotStateOf(aState({ cardTypeId: CardIds.RAM512 })).pristine).toBeUndefined();
  });

  it("does not mark slot 0 as pristine", () => {
    // --- Slot 0 cannot be blank at all, so the flag would be meaningless.
    const state = aState({ cardTypeId: CardIds.EPROMUV128 }, anEnv(), 0);

    expect(slotStateOf(state).pristine).toBeUndefined();
  });
});

describe("Z88InsertCardModel — slot 0", () => {
  it("treats slot 0 as a rebuild and card slots as hot plugs", () => {
    expect(requiresRestart(aState({}, anEnv(), 0))).toBe(true);
    expect(requiresRestart(aState({}, anEnv(), 1))).toBe(false);
  });

  it("writes the slot into the configuration without disturbing the rest", () => {
    const slotState = { cardType: CardIds.EPROMUV128, size: 128 };

    expect(configWithSlot0({ other: "kept" }, slotState)).toEqual({
      other: "kept",
      [MC_Z88_SLOT0]: slotState
    });
  });

  it("says Replace for slot 0 and Insert for a card slot", () => {
    // --- Slot 0 always holds something, so its card is replaced, never inserted.
    expect(titleOf(aState({}, anEnv(), 0))).toBe("Replace Z88 Card - Slot 0");
    expect(titleOf(aState({}, anEnv(), 3))).toBe("Insert Z88 Card - Slot 3");
  });
});

describe("Z88InsertCardModel — reducer identity", () => {
  it("starts empty", () => {
    const state = initialState(anEnv(), 1);

    expect(state.cardTypeId).toBeUndefined();
    expect(state.file).toBeUndefined();
    expect(state.busy).toBe(false);
  });

  it("returns the same state for a redundant change", () => {
    const state = aState({ cardTypeId: CardIds.RAM512, file: "/a.epr" });

    expect(reduce(state, { type: "cardTypeChanged", cardTypeId: CardIds.RAM512 })).toBe(state);
    expect(reduce(state, { type: "fileChanged", file: "/a.epr" })).toBe(state);
  });

  it("clears the file when told to", () => {
    const state = aState({ file: "/a.epr" });

    expect(reduce(state, { type: "fileChanged", file: undefined }).file).toBeUndefined();
  });

  it("returns the same state for a redundant busy transition", () => {
    const idle = aState();
    const started = reduce(idle, { type: "insertStarted" });

    expect(reduce(started, { type: "insertStarted" })).toBe(started);
    expect(reduce(idle, { type: "insertSettled" })).toBe(idle);
  });
});
