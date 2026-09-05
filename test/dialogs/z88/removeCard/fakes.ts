import { vi, type Mock } from "vitest";

import { Z88RemoveCardController } from "@renderer/appEmu/dialogs/z88/removeCard/Z88RemoveCardController";
import type { Z88RemoveCardIntent } from "@renderer/appEmu/dialogs/z88/removeCard/Z88RemoveCardIntents";
import {
  initialState,
  type Z88RemoveCardEvent,
  type Z88RemoveCardState
} from "@renderer/appEmu/dialogs/z88/removeCard/Z88RemoveCardModel";
import type { Z88RemoveCardPorts } from "@renderer/appEmu/dialogs/z88/removeCard/Z88RemoveCardPorts";
import {
  selectViewModel,
  type Z88RemoveCardViewModel
} from "@renderer/appEmu/dialogs/z88/removeCard/Z88RemoveCardViewModel";
import type { Z88Environment } from "@renderer/appEmu/dialogs/z88/Z88Ports";

import { harnessFor, type ControllerHarness } from "../../../mvc/ControllerHarness";
import { deepMerge, type DeepPartial } from "../../../mvc/fixtures";
import { anEnv, fakeZ88MachinePort, type Z88FakeMachinePort } from "../fakes";

export * from "../fakes";

// --- Slot 1 by default: a plain card slot, where removal is a hot unplug.
export const aState = (
  over?: DeepPartial<Z88RemoveCardState>,
  env: Z88Environment = anEnv(),
  slot = 1
): Z88RemoveCardState => deepMerge(initialState(env, slot), over);

export const aViewModel = (
  over?: DeepPartial<Z88RemoveCardViewModel>,
  state: Z88RemoveCardState = aState()
): Z88RemoveCardViewModel => deepMerge(selectViewModel(state), over);

export type Z88RemoveCardFakePorts = {
  machine: Z88FakeMachinePort;
  close: { removed: Mock; dismissed: Mock };
};

export type Z88RemoveCardHarness = ControllerHarness<
  Z88RemoveCardState,
  Z88RemoveCardIntent,
  Z88RemoveCardEvent,
  Z88RemoveCardViewModel
> & {
  ports: Z88RemoveCardFakePorts;
  env: Z88Environment;
};

export function openRemoveCardDialog(
  over: {
    slot?: number;
    env?: DeepPartial<Z88Environment>;
    ports?: Partial<Z88RemoveCardFakePorts>;
  } = {}
): Z88RemoveCardHarness {
  const ports: Z88RemoveCardFakePorts = {
    machine: fakeZ88MachinePort(),
    close: { removed: vi.fn(), dismissed: vi.fn() },
    ...over.ports
  };
  const env = anEnv(over.env);
  const controller = new Z88RemoveCardController(
    ports as unknown as Z88RemoveCardPorts,
    env,
    over.slot ?? 1
  );
  return harnessFor(controller, { ports, env });
}
