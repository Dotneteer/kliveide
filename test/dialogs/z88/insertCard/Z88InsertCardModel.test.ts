import { describe, expect, it } from "vitest";

import {
  allowedCardTypesFor,
  canInsert,
  cardCapacityOf,
  cardOptionsFor,
  cardTypeForImage,
  configWithSlot0,
  defaultCardTypeFor,
  imageFitsCard,
  imageIsPadded,
  imageMisfits,
  initialState,
  isValidImageSize,
  needsFile,
  offersFile,
  reduce,
  requiresRestart,
  slotStateOf
} from "@renderer/appEmu/dialogs/z88/insertCard/Z88InsertCardModel";
import {
  invalidSizeMessage,
  titleOf
} from "@renderer/appEmu/dialogs/z88/insertCard/Z88InsertCardViewModel";

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

describe("Z88InsertCardModel — image sizes", () => {
  it("takes any whole number of 16K banks up to 1M in a card slot", () => {
    for (const kb of [16, 32, 48, 64, 128, 192, 256, 512, 1024]) {
      expect(isValidImageSize(1, kb * 1024)).toBe(true);
    }
  });

  it("refuses an empty, partial-bank or oversized image in a card slot", () => {
    expect(isValidImageSize(1, 0)).toBe(false);
    expect(isValidImageSize(1, 16 * 1024 - 1)).toBe(false);
    expect(isValidImageSize(1, 2048 * 1024)).toBe(false);
  });

  it("takes only a whole internal ROM in slot 0", () => {
    expect(isValidImageSize(0, 128 * 1024)).toBe(true);
    expect(isValidImageSize(0, 256 * 1024)).toBe(true);
    expect(isValidImageSize(0, 512 * 1024)).toBe(true);
    expect(isValidImageSize(0, 32 * 1024)).toBe(false);
    expect(isValidImageSize(0, 64 * 1024)).toBe(false);
  });

  it("measures a card by its chip, not by the configured size", () => {
    // --- The catalogue stores 512 for the AMD 29F080B; the chip is 1M.
    expect(cardCapacityOf(CardIds.AMDF29F080B)).toBe(1024 * 1024);
    expect(cardCapacityOf(CardIds.EPROMUV32)).toBe(32 * 1024);
    expect(cardCapacityOf(undefined)).toBeUndefined();
  });

  it("says how big the rejected card was, in both units", () => {
    expect(invalidSizeMessage(64 * 1024)).toBe(
      "The size of the selected card is 65536 bytes (64 KBytes), which is not allowed in this slot."
    );
  });
});

describe("Z88InsertCardModel — which card takes an image", () => {
  it("lets a card slot's card hold an image smaller than itself", () => {
    expect(imageFitsCard(CardIds.EPROMUV32, 1, 16 * 1024)).toBe(true);
    expect(imageFitsCard(CardIds.EPROMUV128, 1, 64 * 1024)).toBe(true);
    expect(imageFitsCard(CardIds.EPROMUV32, 1, 64 * 1024)).toBe(false);
  });

  it("needs an exact fit in slot 0", () => {
    expect(imageFitsCard(CardIds.EPROMUV128, 0, 128 * 1024)).toBe(true);
    expect(imageFitsCard(CardIds.EPROMUV256, 0, 128 * 1024)).toBe(false);
  });

  it("never puts an image on a card that takes none", () => {
    expect(imageFitsCard(CardIds.RAM512, 1, 32 * 1024)).toBe(false);
  });

  it("pre-selects a card by the image's size (issue #1655)", () => {
    expect(defaultCardTypeFor(1, 16 * 1024)).toBe(CardIds.EPROMUV32);
    expect(defaultCardTypeFor(1, 32 * 1024)).toBe(CardIds.EPROMUV32);
    expect(defaultCardTypeFor(1, 48 * 1024)).toBe(CardIds.EPROMUV128);
    expect(defaultCardTypeFor(1, 64 * 1024)).toBe(CardIds.EPROMUV128);
    expect(defaultCardTypeFor(1, 128 * 1024)).toBe(CardIds.EPROMUV128);
    expect(defaultCardTypeFor(1, 192 * 1024)).toBe(CardIds.EPROMUV256);
    expect(defaultCardTypeFor(1, 256 * 1024)).toBe(CardIds.EPROMUV256);
    expect(defaultCardTypeFor(1, 384 * 1024)).toBe(CardIds.AMDF29F040B);
    expect(defaultCardTypeFor(1, 512 * 1024)).toBe(CardIds.AMDF29F040B);
    expect(defaultCardTypeFor(1, 1024 * 1024)).toBe(CardIds.AMDF29F080B);
  });

  it("pre-selects only an exactly fitting slot-0 card", () => {
    expect(defaultCardTypeFor(0, 128 * 1024)).toBe(CardIds.EPROMUV128);
    expect(defaultCardTypeFor(0, 256 * 1024)).toBe(CardIds.EPROMUV256);
    expect(defaultCardTypeFor(0, 512 * 1024)).toBe(CardIds.AMDF29F040B);
  });

  it("selects the default card when nothing is chosen yet", () => {
    expect(cardTypeForImage(undefined, 1, 16 * 1024)).toBe(CardIds.EPROMUV32);
  });

  it("keeps to the chosen family when a member of it holds the image", () => {
    expect(cardTypeForImage(CardIds.EPROMUV128, 1, 32 * 1024)).toBe(CardIds.EPROMUV32);
    expect(cardTypeForImage(CardIds.EPROMUV32, 1, 256 * 1024)).toBe(CardIds.EPROMUV256);
    expect(cardTypeForImage(CardIds.IF28F004S5, 1, 1024 * 1024)).toBe(CardIds.IF28F008S5);
    // --- The smallest that holds it: a 64K image goes on a 128K EPROM.
    expect(cardTypeForImage(CardIds.EPROMUV256, 1, 64 * 1024)).toBe(CardIds.EPROMUV128);
  });

  it("leaves the family for the default when none of it holds the image", () => {
    expect(cardTypeForImage(CardIds.EPROMUV128, 1, 512 * 1024)).toBe(CardIds.AMDF29F040B);
    expect(cardTypeForImage(CardIds.RAM512, 1, 32 * 1024)).toBe(CardIds.EPROMUV32);
  });

  it("leaves the selection alone when the check returned no content", () => {
    // --- A check that produced neither an image nor a complaint has no length
    // --- to measure; the old component read `.length` off it and threw.
    expect(cardTypeForImage(CardIds.EPROMUV128, 1, undefined)).toBe(CardIds.EPROMUV128);
  });
});

describe("Z88InsertCardModel — the chosen image and the chosen card", () => {
  it("offers the image row before a type is chosen, and for an image-backed type", () => {
    expect(offersFile(aState())).toBe(true);
    expect(offersFile(aState({ cardTypeId: CardIds.EPROMUV32 }))).toBe(true);
    expect(offersFile(aState({ cardTypeId: CardIds.RAM512 }))).toBe(false);
  });

  it("puts a smaller image at the top of its card", () => {
    const state = aState({ cardTypeId: CardIds.EPROMUV32, file: "/a.epr", imageSize: 16 * 1024 });

    expect(imageIsPadded(state)).toBe(true);
    expect(imageMisfits(state)).toBe(false);
    expect(canInsert(state)).toBe(true);
  });

  it("refuses a card too small for the image", () => {
    const state = aState({ cardTypeId: CardIds.EPROMUV32, file: "/a.epr", imageSize: 128 * 1024 });

    expect(imageMisfits(state)).toBe(true);
    expect(canInsert(state)).toBe(false);
  });

  it("does not load an image into a card that takes none", () => {
    const state = aState({ cardTypeId: CardIds.RAM512, file: "/a.epr", imageSize: 32 * 1024 });

    expect(canInsert(state)).toBe(true);
    expect(slotStateOf(state).file).toBeUndefined();
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
