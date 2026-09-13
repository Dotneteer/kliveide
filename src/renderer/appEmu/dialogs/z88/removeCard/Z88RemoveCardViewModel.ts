import { confirmationOf, type Z88RemoveCardState } from "./Z88RemoveCardModel";

export type Z88RemoveCardViewModel = {
  question: string;
  removeEnabled: boolean;
};

export function selectViewModel(state: Z88RemoveCardState): Z88RemoveCardViewModel {
  return {
    question: confirmationOf(state),
    removeEnabled: !state.busy
  };
}
