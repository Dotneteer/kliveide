import { vi, type Mock } from "vitest";

import { CardIds } from "@emu/machines/z88/memory/CardIds";
import { Z88InsertCardController } from "@renderer/appEmu/dialogs/z88/insertCard/Z88InsertCardController";
import type { Z88InsertCardIntent } from "@renderer/appEmu/dialogs/z88/insertCard/Z88InsertCardIntents";
import {
  initialState,
  type Z88CardCheckResult,
  type Z88InsertCardEvent,
  type Z88InsertCardState
} from "@renderer/appEmu/dialogs/z88/insertCard/Z88InsertCardModel";
import type { Z88InsertCardPorts } from "@renderer/appEmu/dialogs/z88/insertCard/Z88InsertCardPorts";
import {
  selectViewModel,
  type Z88InsertCardViewModel
} from "@renderer/appEmu/dialogs/z88/insertCard/Z88InsertCardViewModel";
import type { Z88Environment } from "@renderer/appEmu/dialogs/z88/Z88Ports";

import { harnessFor, type ControllerHarness } from "../../../mvc/ControllerHarness";
import { deepMerge, type DeepPartial } from "../../../mvc/fixtures";
import { anEnv, fakeZ88MachinePort, type Z88FakeMachinePort } from "../fakes";

export * from "../fakes";
export { CardIds };

// --- A card image of a given size in KB, which is all the model reads of it.
export const cardImage = (sizeKb: number): Uint8Array => new Uint8Array(sizeKb * 1024);

export const aState = (
  over?: DeepPartial<Z88InsertCardState>,
  env: Z88Environment = anEnv(),
  slot = 1
): Z88InsertCardState => deepMerge(initialState(env, slot), over);

export const aViewModel = (
  over?: DeepPartial<Z88InsertCardViewModel>,
  state: Z88InsertCardState = aState()
): Z88InsertCardViewModel => deepMerge(selectViewModel(state), over);

export type Z88InsertCardFakePorts = {
  machine: Z88FakeMachinePort;
  cardFile: { pickCardFile: Mock; checkCard: Mock; notify: Mock };
  close: { inserted: Mock; dismissed: Mock };
};

export type Z88InsertCardHarness = ControllerHarness<
  Z88InsertCardState,
  Z88InsertCardIntent,
  Z88InsertCardEvent,
  Z88InsertCardViewModel
> & {
  ports: Z88InsertCardFakePorts;
  env: Z88Environment;
};

export type Z88InsertCardHarnessOptions = {
  slot?: number;
  env?: DeepPartial<Z88Environment>;
  // --- What the picker returns; undefined means the user dismissed it.
  pickCardFile?: string;
  // --- What the main process makes of the chosen file.
  checkCard?: Z88CardCheckResult | (() => Promise<Z88CardCheckResult>);
  ports?: Partial<Z88InsertCardFakePorts>;
};

export function openInsertCardDialog(
  over: Z88InsertCardHarnessOptions = {}
): Z88InsertCardHarness {
  const check = over.checkCard;
  const ports: Z88InsertCardFakePorts = {
    machine: fakeZ88MachinePort(),
    cardFile: {
      pickCardFile: vi.fn(async () => over.pickCardFile),
      // --- The default describes a healthy 128K image, the size every EPROM
      // --- family in the catalogue can fall back to.
      checkCard: vi.fn(
        typeof check === "function"
          ? check
          : async () => check ?? { content: cardImage(128) }
      ),
      notify: vi.fn(async () => undefined)
    },
    close: { inserted: vi.fn(), dismissed: vi.fn() },
    ...over.ports
  };
  const env = anEnv(over.env);
  const controller = new Z88InsertCardController(
    ports as unknown as Z88InsertCardPorts,
    env,
    over.slot ?? 1
  );
  return harnessFor(controller, { ports, env });
}
