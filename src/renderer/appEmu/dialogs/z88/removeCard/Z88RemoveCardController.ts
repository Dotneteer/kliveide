import { LatestRun } from "@mvc/core/LatestRun";
import { UiController } from "@mvc/core/UiController";

import type { Z88Environment } from "../Z88Ports";
import type { Z88RemoveCardIntent } from "./Z88RemoveCardIntents";
import {
  configWithEmptySlot0,
  EMPTY_CARD_STATE,
  initialState,
  reduce,
  requiresRestart,
  type Z88RemoveCardEvent,
  type Z88RemoveCardState
} from "./Z88RemoveCardModel";
import type { Z88RemoveCardPorts } from "./Z88RemoveCardPorts";
import { selectViewModel, type Z88RemoveCardViewModel } from "./Z88RemoveCardViewModel";

/**
 * Orchestrates the Remove Card dialog. It is short, but the slot-0 branch is a
 * real decision — and it is the branch a DOM test could only reach by driving a
 * whole machine.
 */
export class Z88RemoveCardController extends UiController<
  Z88RemoveCardState,
  Z88RemoveCardIntent,
  Z88RemoveCardEvent,
  Z88RemoveCardViewModel
> {
  private readonly removeRun = new LatestRun();

  constructor(
    private readonly ports: Z88RemoveCardPorts,
    env: Z88Environment,
    slot: number
  ) {
    super(initialState(env, slot), reduce, selectViewModel);
  }

  protected async handle(intent: Z88RemoveCardIntent): Promise<void> {
    switch (intent.type) {
      case "environmentChanged":
        this.emit({ type: "envReplaced", env: intent.env });
        return;

      case "removeRequested":
        await this.remove();
        return;

      case "closeRequested":
        // --- The flap has to be shut whichever way the dialog ends, or the
        // --- machine keeps waiting for it.
        this.ports.machine.signalFlapClosed();
        this.ports.close.dismissed();
        return;
    }
  }

  private async remove(): Promise<void> {
    const state = this.state;
    if (state.busy) return;

    const token = this.removeRun.begin();
    this.emit({ type: "removeStarted" });
    try {
      await this.ports.machine.applyCardState(state.slot, EMPTY_CARD_STATE);
      if (!token.isCurrent()) return;

      if (requiresRestart(state)) {
        // --- Slot 0 is the internal ROM: the hot-plug above updates the running
        // --- machine, but the machine still has to be rebuilt without it.
        await this.ports.machine.setMachineConfig(configWithEmptySlot0(state.env.config));
        if (!token.isCurrent()) return;
      }

      // --- The flap is shut on the way out of every path, exactly as the old
      // --- component's Modal close handler did after a successful removal.
      this.ports.machine.signalFlapClosed();
      this.ports.close.removed({ slot: state.slot });
    } finally {
      this.emit({ type: "removeSettled" });
    }
  }

  dispose(): void {
    this.removeRun.cancelAll();
    super.dispose();
  }
}
