import { useEffect, useRef, useState } from "react";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import type { NextLayerState } from "@common/messaging/EmuApi";
import { SETTING_EMU_SHOW_NEXT_LAYERS } from "@common/settings/setting-const";
import { describeLayerDebug, type NextLayerViewState } from "@common/zxnext/layers/layerMix";
import { EMPTY_LAYER_VIEW, wantsLayerCapture } from "@common/zxnext/layers/layerView";
import { isZxNextIdeMachine, type IZxNextIdeMachine } from "@emu/machines/zxNext/IZxNextIdeMachine";
import type { IMachineController } from "@renderer/abstractions/IMachineController";
import { useGlobalSetting, useSelector } from "@renderer/core/RendererProvider";

export type NextLayerView = {
  /** The Next machine, when the running machine is one */
  machine?: IZxNextIdeMachine;
  view: NextLayerViewState;
  paused: boolean;
  /** The D3 pill's text, when the debug view changes the picture */
  pillText?: string;
  /** The paused picture was recomposed without an exact capture */
  approximate: boolean;
};

/**
 * Applies the ZX Spectrum Next layer debug view (`.plans/LAYER_COMPOSITION_PLAN.md`) from the app
 * state to the machine the emulator window owns: the mask, and the capture while something needs it
 * (T6). While paused, a change recomposes the picture into the preview and redraws it (D6). The view
 * itself lives in the app state, so the strip, the Machine menu and the `layers` command stay one (D4).
 */
export function useNextLayerView(
  controller: IMachineController | undefined,
  displayScreenData: () => void
): NextLayerView {
  const view = useSelector((s) => s.emulatorState?.nextLayers) ?? EMPTY_LAYER_VIEW;
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const stripShown = !!useGlobalSetting(SETTING_EMU_SHOW_NEXT_LAYERS);
  const candidate = controller?.machine;
  const machine = isZxNextIdeMachine(candidate) ? candidate : undefined;
  const paused = machineState === MachineControllerState.Paused;
  const [approximate, setApproximate] = useState(false);
  const applied = useRef<{ machine?: IZxNextIdeMachine; key?: string }>({});

  const { hidden, solo, showTransparent } = view;
  const wantsCapture = wantsLayerCapture(view, stripShown);
  useEffect(() => {
    if (!machine) return;
    const key = `${hidden}/${solo}/${showTransparent}`;
    const last = applied.current;
    const changed = last.machine === machine && last.key !== undefined && last.key !== key;
    applied.current = { machine, key };
    machine.setLayerDebug({ hidden, solo, showTransparent });
    machine.setLayerCapture(wantsCapture);
    if (paused && changed) {
      // --- Paused: the machine will not draw again, so show the view now (D6)
      const status = machine.recomposeForDebug();
      setApproximate(!status.exact);
      displayScreenData();
    } else if (!paused) {
      setApproximate(false);
    }
  }, [machine, hidden, solo, showTransparent, wantsCapture, paused, displayScreenData]);

  return {
    machine,
    view,
    paused,
    pillText: machine ? describeLayerDebug(view) : undefined,
    approximate: paused && approximate
  };
}

/**
 * The mixer registers the strip and the clip outlines show, read from the machine: every 250 ms while
 * it runs (a Copper program or the CPU can change `$15` at any time), once when it stops. Reading them
 * never changes the machine.
 */
export function useNextLayerRegs(
  machine: IZxNextIdeMachine | undefined,
  active: boolean,
  running: boolean
): NextLayerState | undefined {
  const [state, setState] = useState<NextLayerState | undefined>();
  useEffect(() => {
    if (!machine || !active) return undefined;
    const read = () => {
      try {
        setState(machine.getNextLayerState());
      } catch {
        // --- The core is not loaded yet
      }
    };
    read();
    if (!running) return undefined;
    const timer = setInterval(read, 250);
    return () => clearInterval(timer);
  }, [machine, active, running]);
  return state;
}
