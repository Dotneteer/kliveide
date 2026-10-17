import { t } from "@common/i18n/i18n";
import type { Z88RemoveCardState } from "./Z88RemoveCardModel";

export type Z88RemoveCardViewModel = {
  question: string;
  removeEnabled: boolean;
};

export function confirmationOf(state: Z88RemoveCardState): string {
  return t("dialog.z88.removeCard.question", { slot: state.slot });
}

export function selectViewModel(state: Z88RemoveCardState): Z88RemoveCardViewModel {
  return {
    question: confirmationOf(state),
    removeEnabled: !state.busy
  };
}
