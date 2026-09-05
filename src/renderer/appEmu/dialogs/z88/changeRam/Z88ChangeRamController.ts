import { MC_Z88_INTRAM } from "@common/machines/constants";
import { LatestRun } from "@mvc/core/LatestRun";
import { UiController } from "@mvc/core/UiController";

import type { Z88Environment } from "../Z88Ports";
import type { Z88ChangeRamIntent } from "./Z88ChangeRamIntents";
import {
  initialState,
  ramMaskOf,
  reduce,
  willChange,
  type Z88ChangeRamEvent,
  type Z88ChangeRamState
} from "./Z88ChangeRamModel";
import type { Z88ChangeRamPorts } from "./Z88ChangeRamPorts";
import { selectViewModel, type Z88ChangeRamViewModel } from "./Z88ChangeRamViewModel";

/**
 * Orchestrates the Change RAM dialog: user intents in, port calls out, events
 * into the pure reducer. No React and no DOM.
 */
export class Z88ChangeRamController extends UiController<
  Z88ChangeRamState,
  Z88ChangeRamIntent,
  Z88ChangeRamEvent,
  Z88ChangeRamViewModel
> {
  // --- Rebuilding the machine is the one thing here that outlives a click.
  private readonly applyRun = new LatestRun();

  constructor(
    private readonly ports: Z88ChangeRamPorts,
    env: Z88Environment
  ) {
    super(initialState(env), reduce, selectViewModel);
  }

  protected async handle(intent: Z88ChangeRamIntent): Promise<void> {
    switch (intent.type) {
      case "environmentChanged":
        this.emit({ type: "envReplaced", env: intent.env });
        return;

      case "ramSizeSelected":
        this.emit({ type: "ramSizeChanged", size: intent.size });
        return;

      case "applyRequested":
        await this.apply();
        return;

      case "closeRequested":
        this.ports.close.dismissed();
        return;
    }
  }

  private async apply(): Promise<void> {
    const state = this.state;
    if (state.busy) return;

    const selectedSize = state.selectedSize;
    const ramMask = ramMaskOf(selectedSize);

    // --- Selecting the size the machine already has is an answer, not a change:
    // --- report it and leave the running machine alone. Same rule the warning
    // --- uses, so what the dialog says and what it does cannot disagree.
    if (!willChange(state)) {
      this.ports.close.settled({ selectedSize, ramMask, changed: false });
      return;
    }

    const token = this.applyRun.begin();
    this.emit({ type: "applyStarted" });
    try {
      await this.ports.machine.setMachineConfig({
        ...state.env.config,
        [MC_Z88_INTRAM]: ramMask
      });
      if (!token.isCurrent()) return;
      await this.ports.output.write(`Z88 internal RAM size changed to ${selectedSize}K`);
      if (!token.isCurrent()) return;
      this.ports.close.settled({ selectedSize, ramMask, changed: true });
    } finally {
      this.emit({ type: "applySettled" });
    }
  }

  dispose(): void {
    this.applyRun.cancelAll();
    super.dispose();
  }
}
