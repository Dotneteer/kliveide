import { MC_Z88_SLOT0 } from "@common/machines/constants";
import type { MachineConfigSet } from "@common/machines/info-types";
import type { CardSlotState } from "@emu/machines/z88/memory/CardSlotState";
import type { UiReducer } from "@mvc/core/types";
import { cardTypes, type CardTypeData } from "../../../machines/z88Cards";

import { isSameZ88Environment, type Z88Environment } from "../Z88Ports";

// ─── Vocabulary ──────────────────────────────────────────────────────────────

export const SLOT0 = 0;

// --- Slot 0 is the internal ROM socket. It is soldered in as far as the
// --- emulator is concerned: only these three sizes fit, and swapping it is a
// --- machine rebuild rather than a hot plug.
export const SLOT0_ACCEPTED_SIZES_KB = [128, 256, 512];

export const PRISTINE_CARD_HINT = "Use pristine card (or click to select a file)";
export const CARD_FILE_REQUIRED_HINT = "You must select a card file - click here";

export const INVALID_CARD_TITLE = "Invalid Z88 Card";

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
  busy: boolean;
};

// ─── Events ──────────────────────────────────────────────────────────────────

export type Z88InsertCardEvent =
  | { type: "envReplaced"; env: Z88Environment }
  | { type: "cardTypeChanged"; cardTypeId?: string }
  | { type: "fileChanged"; file?: string }
  | { type: "insertStarted" }
  | { type: "insertSettled" };

// ─── Initial state ───────────────────────────────────────────────────────────

export function initialState(env: Z88Environment, slot: number): Z88InsertCardState {
  return { env, slot, cardTypeId: undefined, file: undefined, busy: false };
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
      return event.file === state.file ? state : { ...state, file: event.file };

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
 * The card sizes the selected type can fall back to.
 *
 * Derived from the selection rather than stored, so picking a size-substituted
 * fallback also updates what the next file dialog will accept — the old
 * component kept a copy and left it stale.
 */
export function acceptedSizesOf(state: Z88InsertCardState): number[] {
  return cardTypeOf(state.cardTypeId)?.fallback?.map((entry) => entry.size) ?? [];
}

// --- Slot 0 narrows the accepted set further: an EPROM size that is legal in a
// --- card slot is not a legal internal ROM.
export function pickerSizesOf(state: Z88InsertCardState): number[] {
  const sizes = acceptedSizesOf(state);
  return state.slot > SLOT0
    ? sizes
    : sizes.filter((size) => SLOT0_ACCEPTED_SIZES_KB.includes(size));
}

export function isAcceptedSize(acceptedSizesKb: number[], byteLength: number): boolean {
  return acceptedSizesKb.some((size) => size * 1024 === byteLength);
}

export function invalidSizeMessage(byteLength: number): string {
  return (
    `The size of the selected card is ${byteLength} bytes ` +
    `(${Math.floor(byteLength / 1024)} KBytes), which is not allowed in this slot.`
  );
}

/**
 * The card type a file's own size implies.
 *
 * A "RAM" or "EPROM" choice is really a family; the actual chip is decided by
 * how big the image turned out to be.
 */
export function fallbackTypeFor(
  cardTypeId: string | undefined,
  byteLength: number | undefined
): string | undefined {
  const cardType = cardTypeOf(cardTypeId);
  // --- A check that came back with neither content nor a complaint leaves the
  // --- selection alone rather than throwing on a missing length.
  if (!cardType?.fallback || byteLength === undefined) return undefined;
  const lengthKb = Math.floor(byteLength / 1024);
  return cardType.fallback.find((entry) => entry.size === lengthKb)?.type;
}

// ─── Derived rules ───────────────────────────────────────────────────────────

export function needsFile(state: Z88InsertCardState): boolean {
  return cardTypeOf(state.cardTypeId)?.getFile === true;
}

/**
 * Whether the dialog has enough to insert something.
 *
 * A card slot can take a blank card, so a type alone is enough there. Slot 0
 * cannot: the machine has to boot from something.
 */
export function canInsert(state: Z88InsertCardState): boolean {
  return !!state.cardTypeId && (state.slot > SLOT0 || !!state.file);
}

export function slotStateOf(state: Z88InsertCardState): CardSlotState {
  const cardType = cardTypeOf(state.cardTypeId);
  const slotState: CardSlotState = {
    cardType: cardType?.value,
    size: cardType?.size,
    file: state.file
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

export function titleOf(state: Z88InsertCardState): string {
  // --- Slot 0 always holds something, so its card is replaced, never inserted.
  return `${state.slot > SLOT0 ? "Insert" : "Replace"} Z88 Card - Slot ${state.slot}`;
}
