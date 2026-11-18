import { MC_Z88_SLOT0 } from "@common/machines/constants";
import type { MachineConfigSet } from "@common/machines/info-types";
import { CardIds } from "@emu/machines/z88/CardIds";
import type { CardSlotState } from "@emu/machines/z88/CardSlotState";
import { Z88_BANK_SIZE, z88CardSpec } from "@emu/machines/z88/z88CardCatalog";
import type { UiReducer } from "@mvc/core/types";
import { cardTypes, type CardTypeData } from "../../../machines/z88Cards";

import { isSameZ88Environment, type Z88Environment } from "../Z88Ports";

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export const SLOT0 = 0;

// --- Slot 0 is the internal ROM socket. It is soldered in as far as the
// --- emulator is concerned: only these three sizes fit, and swapping it is a
// --- machine rebuild rather than a hot plug.
export const SLOT0_ACCEPTED_SIZES_KB = [128, 256, 512];

// --- The largest card a card slot takes: 1M, the whole slot.
export const CARD_SLOT_MAX_IMAGE_KB = 1024;

/**
 * The card a card image of a given size gets when nothing else decides it: the smallest one that
 * holds it, an EPROM up to 256K and an AMD flash card above (issue #1655). An image smaller than its
 * card goes at the top of the card, so a 16K application lands on a 32K EPROM.
 */
export const DEFAULT_CARD_FOR_IMAGE: { maxKb: number; type: CardIds }[] = [
  { maxKb: 32, type: CardIds.EPROMUV32 },
  { maxKb: 128, type: CardIds.EPROMUV128 },
  { maxKb: 256, type: CardIds.EPROMUV256 },
  { maxKb: 512, type: CardIds.AMDF29F040B },
  { maxKb: 1024, type: CardIds.AMDF29F080B }
];

export type Z88CardCheckResult = {
  content?: Uint8Array;
  message?: string;
};

// ─── State ───────────────────────────────────────────────────────────────────

export type Z88InsertCardState = {
  env: Z88Environment;
  slot: number;
  // --- The card id, not the record: the record is looked up from the catalogue
  // --- so state stays comparable by value.
  cardTypeId?: string;
  file?: string;
  // --- The chosen image's length in bytes, when the main process could read it.
  imageSize?: number;
  busy: boolean;
};

// ─── Events ──────────────────────────────────────────────────────────────────

export type Z88InsertCardEvent =
  | { type: "envReplaced"; env: Z88Environment }
  | { type: "cardTypeChanged"; cardTypeId?: string }
  | { type: "fileChanged"; file?: string; imageSize?: number }
  | { type: "insertStarted" }
  | { type: "insertSettled" };

// ─── Initial state ───────────────────────────────────────────────────────────

export function initialState(env: Z88Environment, slot: number): Z88InsertCardState {
  return { env, slot, cardTypeId: undefined, file: undefined, imageSize: undefined, busy: false };
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

export const reduce: UiReducer<Z88InsertCardState, Z88InsertCardEvent> = (state, event) => {
  switch (event.type) {
    case "envReplaced":
      return isSameZ88Environment(state.env, event.env) ? state : { ...state, env: event.env };

    case "cardTypeChanged":
      return event.cardTypeId === state.cardTypeId
        ? state
        : { ...state, cardTypeId: event.cardTypeId };

    case "fileChanged":
      return event.file === state.file && event.imageSize === state.imageSize
        ? state
        : { ...state, file: event.file, imageSize: event.imageSize };

    case "insertStarted":
      return state.busy ? state : { ...state, busy: true };

    case "insertSettled":
      return state.busy ? { ...state, busy: false } : state;

    default:
      return state;
  }
};

// ─── Card catalogue ──────────────────────────────────────────────────────────

export function cardTypeOf(cardTypeId: string | undefined): CardTypeData | undefined {
  return cardTypeId === undefined
    ? undefined
    : cardTypes.find((candidate) => candidate.value === cardTypeId);
}

// --- Slot 0 accepts only the cards marked for it; every slot hides the ones
// --- that exist for the emulator's own bookkeeping rather than for a user.
export function allowedCardTypesFor(slot: number): CardTypeData[] {
  return cardTypes.filter((card) => (card.allowInSlot0 || slot > SLOT0) && !card.noUi);
}

export function cardOptionsFor(slot: number): { value: string; label: string }[] {
  // --- The catalogue's labels mark the size with a "*" so the tool area can
  // --- lay them out in a column; here they are read as prose.
  return allowedCardTypesFor(slot).map((card) => ({
    value: card.value,
    label: card.label.replace("*", " ")
  }));
}

/**
 * How many bytes a card type holds. The catalogue's own `size` is what a slot configuration stores;
 * the chip decides (an AMD 29F080B is 1M whatever the configuration says), so ask the machine's
 * card catalogue.
 */
export function cardCapacityOf(cardTypeId: string | undefined): number | undefined {
  const cardType = cardTypeOf(cardTypeId);
  if (!cardType) return undefined;
  try {
    return z88CardSpec(cardType.value, cardType.size).sizeInBytes;
  } catch {
    return cardType.size * 1024;
  }
}

/**
 * Whether a card image of this length can go into the slot at all, whatever the card type.
 *
 * Slot 0 boots from its image, so the image must be a whole internal ROM. A card slot takes any
 * whole number of 16K banks up to 1M: a shorter image goes at the top of a larger card.
 */
export function isValidImageSize(slot: number, byteLength: number): boolean {
  if (slot === SLOT0) {
    return SLOT0_ACCEPTED_SIZES_KB.some((size) => size * 1024 === byteLength);
  }
  return (
    byteLength > 0 &&
    byteLength % Z88_BANK_SIZE === 0 &&
    byteLength <= CARD_SLOT_MAX_IMAGE_KB * 1024
  );
}

/**
 * Whether a card type can take an image of this length in the slot: slot 0 needs an exact fit, a
 * card slot a card at least as large as the image.
 */
export function imageFitsCard(
  cardTypeId: string | undefined,
  slot: number,
  byteLength: number
): boolean {
  const cardType = cardTypeOf(cardTypeId);
  if (!cardType?.getFile) return false;
  if (slot === SLOT0 && !cardType.allowInSlot0) return false;
  const capacity = cardCapacityOf(cardTypeId);
  return slot === SLOT0 ? capacity === byteLength : capacity >= byteLength;
}

/**
 * The card type an image of this length gets by default (`DEFAULT_CARD_FOR_IMAGE`), restricted to
 * the cards the slot takes.
 */
export function defaultCardTypeFor(slot: number, byteLength: number): string | undefined {
  const allowed = allowedCardTypesFor(slot).map((card) => card.value as string);
  return DEFAULT_CARD_FOR_IMAGE.find(
    (entry) =>
      entry.maxKb * 1024 >= byteLength &&
      allowed.includes(entry.type) &&
      imageFitsCard(entry.type, slot, byteLength)
  )?.type;
}

/**
 * The card type to select once an image's length is known.
 *
 * A type already chosen is treated as a family ("EPROM", "Intel flash"): the smallest member of it
 * that takes the image wins, so choosing "EPROM 128K" and then a 32K image gives "EPROM 32K". When
 * nothing is chosen, or the chosen family cannot take the image, the default for the image's size
 * is selected (`DEFAULT_CARD_FOR_IMAGE`).
 */
export function cardTypeForImage(
  cardTypeId: string | undefined,
  slot: number,
  byteLength: number | undefined
): string | undefined {
  // --- A check that came back with neither content nor a complaint leaves the
  // --- selection alone rather than guessing.
  if (byteLength === undefined) return cardTypeId;
  const family = cardTypeOf(cardTypeId)?.fallback ?? [];
  const familyFit = family
    .map((entry) => entry.type as string)
    .filter((type) => imageFitsCard(type, slot, byteLength))
    .sort((a, b) => cardCapacityOf(a) - cardCapacityOf(b))[0];
  return familyFit ?? defaultCardTypeFor(slot, byteLength) ?? cardTypeId;
}

// ─── Derived rules ───────────────────────────────────────────────────────────

export function needsFile(state: Z88InsertCardState): boolean {
  return cardTypeOf(state.cardTypeId)?.getFile === true;
}

/**
 * Whether the card-image row is shown: for a card backed by an image, and before any card type is
 * chosen, so the image can come first and pick the card type from its size.
 */
export function offersFile(state: Z88InsertCardState): boolean {
  return state.cardTypeId === undefined || needsFile(state);
}

/**
 * Whether the chosen image goes into the chosen card. Unknown when either is missing, which is not
 * a misfit.
 */
export function imageMisfits(state: Z88InsertCardState): boolean {
  return (
    needsFile(state) &&
    !!state.file &&
    state.imageSize !== undefined &&
    !imageFitsCard(state.cardTypeId, state.slot, state.imageSize)
  );
}

/** Whether the chosen image is shorter than its card, so it goes at the top of it. */
export function imageIsPadded(state: Z88InsertCardState): boolean {
  return (
    needsFile(state) &&
    !!state.file &&
    state.imageSize !== undefined &&
    !imageMisfits(state) &&
    state.imageSize < cardCapacityOf(state.cardTypeId)
  );
}

/**
 * Whether the dialog has enough to insert something.
 *
 * A card slot can take a blank card, so a type alone is enough there. Slot 0
 * cannot: the machine has to boot from something.
 */
export function canInsert(state: Z88InsertCardState): boolean {
  return (
    !!state.cardTypeId &&
    (state.slot > SLOT0 || (needsFile(state) && !!state.file)) &&
    !imageMisfits(state)
  );
}

export function slotStateOf(state: Z88InsertCardState): CardSlotState {
  const cardType = cardTypeOf(state.cardTypeId);
  const slotState: CardSlotState = {
    cardType: cardType?.value,
    size: cardType?.size,
    // --- An image chosen before switching to a card that takes none (RAM) is not loaded into it.
    file: needsFile(state) ? state.file : undefined
  };
  // --- A file-backed card inserted without a file is a blank one; the machine
  // --- needs to be told so it formats rather than reads.
  if (state.slot > SLOT0 && needsFile(state) && !state.file) {
    slotState.pristine = true;
  }
  return slotState;
}

export function requiresRestart(state: Z88InsertCardState): boolean {
  return state.slot === SLOT0;
}

export function configWithSlot0(
  config: MachineConfigSet,
  slotState: CardSlotState
): MachineConfigSet {
  return { ...config, [MC_Z88_SLOT0]: slotState };
}
