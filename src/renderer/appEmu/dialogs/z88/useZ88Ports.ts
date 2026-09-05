import { useMemo } from "react";

import { PANE_ID_EMU } from "@common/integration/constants";
import type { IZ88Machine } from "@renderer/abstractions/IZ88Machine";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { useIdeApi } from "@renderer/core/IdeApi";
import { useRendererContext, useSelector } from "@renderer/core/RendererProvider";

import { applyCardStateChange, type Z88SlotKey } from "../../machines/z88Cards";
import {
  readZ88Environment,
  type Z88Environment,
  type Z88MachinePort,
  type Z88OutputPort
} from "./Z88Ports";

/**
 * The adapters binding the Z88 dialog ports to the real renderer services.
 *
 * This is the only module in the Z88 dialogs that knows a port is answered by
 * `useAppServices()`, the Redux store or `useIdeApi()`; the controllers and
 * their tests see interfaces.
 */

export function useZ88MachinePort(): Z88MachinePort {
  const { store } = useRendererContext();
  const { machineService } = useAppServices();

  return useMemo<Z88MachinePort>(
    () => ({
      applyCardState: async (slot, cardState) => {
        await applyCardStateChange(
          store,
          machineService.getMachineController(),
          `slot${slot}` as Z88SlotKey,
          cardState
        );
      },
      setMachineConfig: async (config) => {
        // --- Read at the moment of the rebuild, not at render: the dialog may
        // --- have been open across a machine change.
        const emulatorState = store.getState()?.emulatorState;
        await machineService.setMachineType(
          emulatorState?.machineId,
          emulatorState?.modelId,
          config
        );
      },
      signalFlapClosed: () => {
        const machine = machineService.getMachineController()?.machine as IZ88Machine;
        machine?.signalFlapClosed();
      }
    }),
    [machineService, store]
  );
}

export function useZ88OutputPort(): Z88OutputPort {
  const ideApi = useIdeApi();
  return useMemo<Z88OutputPort>(
    () => ({
      write: async (text) => {
        await ideApi.displayOutput({
          pane: PANE_ID_EMU,
          text,
          foreground: "bright-cyan",
          writeLine: true
        });
      }
    }),
    [ideApi]
  );
}

/**
 * The Redux slice the Z88 dialogs read, as a memoized plain object.
 *
 * Selected as separate primitives so the shallow-equal selector can do its job;
 * the environment object itself is memoized from them, and each reducer then
 * compares the value so an equivalent one changes no state.
 */
export function useZ88Environment(): Z88Environment {
  const { config, machineState } = useSelector((state) => ({
    config: state.emulatorState?.config,
    machineState: state.emulatorState?.machineState
  }));
  return useMemo(() => readZ88Environment({ config, machineState }), [config, machineState]);
}
