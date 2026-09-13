import { vi, type Mock } from "vitest";

import { Z88ChangeRamController } from "@renderer/appEmu/dialogs/z88/changeRam/Z88ChangeRamController";
import type { Z88ChangeRamIntent } from "@renderer/appEmu/dialogs/z88/changeRam/Z88ChangeRamIntents";
import {
  initialState,
  type Z88ChangeRamEvent,
  type Z88ChangeRamState
} from "@renderer/appEmu/dialogs/z88/changeRam/Z88ChangeRamModel";
import type { Z88ChangeRamPorts } from "@renderer/appEmu/dialogs/z88/changeRam/Z88ChangeRamPorts";
import {
  selectViewModel,
  type Z88ChangeRamViewModel
} from "@renderer/appEmu/dialogs/z88/changeRam/Z88ChangeRamViewModel";
import type { Z88Environment } from "@renderer/appEmu/dialogs/z88/Z88Ports";

import { harnessFor, type ControllerHarness } from "../../../mvc/ControllerHarness";
import { deepMerge, type DeepPartial } from "../../../mvc/fixtures";
import { anEnv, fakeZ88MachinePort, type Z88FakeMachinePort } from "../fakes";

export * from "../fakes";

export const aState = (
  over?: DeepPartial<Z88ChangeRamState>,
  env: Z88Environment = anEnv()
): Z88ChangeRamState => deepMerge(initialState(env), over);

// --- Derived from a real state, so a field the model gains cannot be missed.
export const aViewModel = (
  over?: DeepPartial<Z88ChangeRamViewModel>,
  state: Z88ChangeRamState = aState()
): Z88ChangeRamViewModel => deepMerge(selectViewModel(state), over);

export type Z88ChangeRamFakePorts = {
  machine: Z88FakeMachinePort;
  output: { write: Mock };
  close: { settled: Mock; dismissed: Mock };
};

export type Z88ChangeRamHarness = ControllerHarness<
  Z88ChangeRamState,
  Z88ChangeRamIntent,
  Z88ChangeRamEvent,
  Z88ChangeRamViewModel
> & {
  ports: Z88ChangeRamFakePorts;
  env: Z88Environment;
};

export function openChangeRamDialog(
  over: { env?: DeepPartial<Z88Environment>; ports?: Partial<Z88ChangeRamFakePorts> } = {}
): Z88ChangeRamHarness {
  const ports: Z88ChangeRamFakePorts = {
    machine: fakeZ88MachinePort(),
    output: { write: vi.fn(async () => undefined) },
    close: { settled: vi.fn(), dismissed: vi.fn() },
    ...over.ports
  };
  const env = anEnv(over.env);
  const controller = new Z88ChangeRamController(ports as unknown as Z88ChangeRamPorts, env);
  // --- Never spread the harness: `state`, `vm` and `events` are live getters.
  return harnessFor(controller, { ports, env });
}
