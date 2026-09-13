import { DialogRow } from "@renderer/controls/DialogRow";

import type { Z88RemoveCardIntent } from "./Z88RemoveCardIntents";
import type { Z88RemoveCardViewModel } from "./Z88RemoveCardViewModel";

export type Z88RemoveCardViewProps = {
  vm: Z88RemoveCardViewModel;
  dispatch: (intent: Z88RemoveCardIntent) => void;
};

/**
 * The Remove Card dialog body: one question. The buttons live in the modal
 * frame, so the view takes `dispatch` only to keep every view in this family
 * the same shape.
 */
export const Z88RemoveCardView = ({ vm }: Z88RemoveCardViewProps) => (
  <DialogRow>
    <div data-testid="z88-remove-card-question">{vm.question}</div>
  </DialogRow>
);
