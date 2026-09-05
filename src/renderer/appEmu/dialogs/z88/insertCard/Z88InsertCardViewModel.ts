import {
  CARD_FILE_REQUIRED_HINT,
  PRISTINE_CARD_HINT,
  SLOT0,
  canInsert,
  cardOptionsFor,
  needsFile,
  titleOf,
  type Z88InsertCardState
} from "./Z88InsertCardModel";

// ─── View model shape ────────────────────────────────────────────────────────

export type CardOptionViewModel = { value: string; label: string };

// --- A string discriminant, not a boolean: this project compiles with
// --- `strictNullChecks: false`, under which TypeScript does not narrow a union
// --- on a boolean-literal discriminant.
export type CardFileViewModel =
  | { kind: "hidden" }
  | {
      kind: "shown";
      // --- What to put on the row: the chosen file, or the hint that stands in
      // --- for one.
      text: string;
      // --- A file is chosen, so the row reads as a value rather than a prompt.
      selected: boolean;
      // --- Slot 0 with no file is not a valid choice; the row says so in red.
      warning: boolean;
      // --- Only a chosen file can be taken back off.
      clearable: boolean;
    };

export type Z88InsertCardViewModel = {
  title: string;
  cardType: {
    options: CardOptionViewModel[];
    value?: string;
  };
  file: CardFileViewModel;
  insertEnabled: boolean;
};

// ─── Selector ────────────────────────────────────────────────────────────────

export function selectViewModel(state: Z88InsertCardState): Z88InsertCardViewModel {
  return {
    title: titleOf(state),
    cardType: {
      options: cardOptionsFor(state.slot),
      value: state.cardTypeId
    },
    file: selectFile(state),
    insertEnabled: canInsert(state) && !state.busy
  };
}

function selectFile(state: Z88InsertCardState): CardFileViewModel {
  // --- Only a card that is backed by an image has a file row at all.
  if (!needsFile(state)) return { kind: "hidden" };

  if (state.file) {
    return {
      kind: "shown",
      // --- The row is rendered right-to-left so the file name stays visible
      // --- when the path is too long; a leading separator would be dragged to
      // --- the wrong end of it.
      text: state.file.startsWith("/") ? state.file.substring(1) : state.file,
      selected: true,
      warning: false,
      clearable: true
    };
  }

  const isCardSlot = state.slot > SLOT0;
  return {
    kind: "shown",
    text: isCardSlot ? PRISTINE_CARD_HINT : CARD_FILE_REQUIRED_HINT,
    selected: false,
    warning: !isCardSlot,
    clearable: false
  };
}
