import { LatestRun } from "@mvc/core/LatestRun";
import { UiController } from "@mvc/core/UiController";

import type { Z88Environment } from "../Z88Ports";
import type { Z88InsertCardIntent } from "./Z88InsertCardIntents";
import {
  INVALID_CARD_TITLE,
  canInsert,
  configWithSlot0,
  fallbackTypeFor,
  initialState,
  invalidSizeMessage,
  isAcceptedSize,
  pickerSizesOf,
  reduce,
  requiresRestart,
  slotStateOf,
  type Z88InsertCardEvent,
  type Z88InsertCardState
} from "./Z88InsertCardModel";
import type { Z88InsertCardPorts } from "./Z88InsertCardPorts";
import { selectViewModel, type Z88InsertCardViewModel } from "./Z88InsertCardViewModel";

/**
 * Orchestrates the Insert Card dialog: pick a file, judge it, maybe substitute
 * the card type its size implies, then insert — hot into a card slot, or by
 * rebuilding the machine for slot 0.
 */
export class Z88InsertCardController extends UiController<
  Z88InsertCardState,
  Z88InsertCardIntent,
  Z88InsertCardEvent,
  Z88InsertCardViewModel
> {
  // --- Separate generations: choosing a file and inserting the card are
  // --- independent streams, and a slow file check must not cancel an insert.
  private readonly pickRun = new LatestRun();
  private readonly insertRun = new LatestRun();

  constructor(
    private readonly ports: Z88InsertCardPorts,
    env: Z88Environment,
    slot: number
  ) {
    super(initialState(env, slot), reduce, selectViewModel);
  }

  protected async handle(intent: Z88InsertCardIntent): Promise<void> {
    switch (intent.type) {
      case "environmentChanged":
        this.emit({ type: "envReplaced", env: intent.env });
        return;

      case "cardTypeSelected":
        this.emit({ type: "cardTypeChanged", cardTypeId: intent.cardTypeId });
        return;

      case "selectCardFileRequested":
        await this.selectCardFile();
        return;

      case "clearCardFileRequested":
        this.emit({ type: "fileChanged", file: undefined });
        return;

      case "insertRequested":
        await this.insert();
        return;

      case "closeRequested":
        this.ports.machine.signalFlapClosed();
        this.ports.close.dismissed();
        return;
    }
  }

  /**
   * Chooses a card image and accepts it only if its size fits the slot.
   *
   * Every rejection clears the field rather than leaving the previous file in
   * place — otherwise a rejected pick would look as though it had been taken.
   */
  private async selectCardFile(): Promise<void> {
    const state = this.state;
    const acceptedSizes = pickerSizesOf(state);
    const token = this.pickRun.begin();

    const path = await this.ports.cardFile.pickCardFile(state.slot);
    if (!token.isCurrent()) return;
    if (!path) {
      this.emit({ type: "fileChanged", file: undefined });
      return;
    }

    const check = await this.ports.cardFile.checkCard(path);
    if (!token.isCurrent()) return;

    if (check.content) {
      const byteLength = check.content.length;
      if (!isAcceptedSize(acceptedSizes, byteLength)) {
        this.emit({ type: "fileChanged", file: undefined });
        await this.ports.cardFile.notify(
          "error",
          INVALID_CARD_TITLE,
          invalidSizeMessage(byteLength)
        );
        return;
      }
    } else if (check.message) {
      this.emit({ type: "fileChanged", file: undefined });
      await this.ports.cardFile.notify("error", INVALID_CARD_TITLE, check.message);
      return;
    }

    this.emit({ type: "fileChanged", file: path });

    // --- A family choice such as "EPROM" resolves to the actual chip once the
    // --- image's size is known.
    const fallback = fallbackTypeFor(this.state.cardTypeId, check.content?.length);
    if (fallback) this.emit({ type: "cardTypeChanged", cardTypeId: fallback });
  }

  private async insert(): Promise<void> {
    const state = this.state;
    // --- The modal disables Ok, but the guard belongs here too: an intent can
    // --- arrive from a handler that outlived the disabled state.
    if (state.busy || !canInsert(state)) return;

    const slotState = slotStateOf(state);
    const token = this.insertRun.begin();
    this.emit({ type: "insertStarted" });

    try {
      if (requiresRestart(state)) {
        // --- Slot 0 is the internal ROM: it only exists from boot, so the
        // --- machine is rebuilt rather than reconfigured in place.
        await this.ports.machine.setMachineConfig(configWithSlot0(state.env.config, slotState));
      } else {
        await this.ports.machine.applyCardState(state.slot, slotState);
      }
      if (!token.isCurrent()) return;

      this.ports.machine.signalFlapClosed();
      this.ports.close.inserted({ slot: state.slot, slotState });
    } finally {
      this.emit({ type: "insertSettled" });
    }
  }

  dispose(): void {
    this.pickRun.cancelAll();
    this.insertRun.cancelAll();
    super.dispose();
  }
}
