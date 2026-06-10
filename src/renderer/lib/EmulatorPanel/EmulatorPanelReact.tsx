import { useEffect, useRef, useState } from "react";
import { MachineControllerState } from "../../../common/abstractions/MachineControllerState";
import { MC_MEM_SIZE, MC_SCREEN_FREQ } from "../../../common/machines/constants";
import {
  resolveMachineSelection,
  type MachineSelection
} from "../../../common/machines/machine-registry";
import { setMachineStateAction, setSp48FrameInfoAction } from "../../../common/state/actions";
import {
  createSp48MachineController,
  Sp48MachineController,
  type Sp48FrameCompletedEvent,
  type Sp48MachineCommand
} from "../../../emu/sp48/Sp48MachineController";
import {
  SP48_KEY_EVENT,
  dispatchSp48KeyStatus,
  mapPhysicalKeyToSp48Keys,
  type Sp48KeyEventDetail
} from "../../../emu/sp48/sp48-keyboard";
import { readBinaryFile, useDispatch, useSharedState } from "../../shared-store";
import { EmulatorOverlay } from "./EmulatorOverlay";
import styles from "./EmulatorPanel.module.scss";
import { useEmulatorAudio } from "./useEmulatorAudio";
import { useEmulatorScreen } from "./useEmulatorScreen";

let cachedController: Sp48MachineController | null = null;
let cachedControllerKey = "";
let cachedControllerPromise: Promise<ControllerSetup> | null = null;

type ControllerSetup = {
  controller: Sp48MachineController;
  created: boolean;
};

export const EmulatorPanelReact = () => {
  const hostElement = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<Sp48MachineController | null>(null);
  const lastCommandSequenceRef = useRef(0);
  const renderInstantScreenRef = useRef<(() => void) | null>(null);
  const avgFrameTimeRef = useRef(0);
  const [overlay, setOverlay] = useState<string | null>("Loading machine...");
  const [showOverlay, setShowOverlay] = useState(true);
  const [error, setError] = useState<string>();
  const sharedState = useSharedState();
  const dispatch = useDispatch();
  const commandSequence = sharedState.emulatorState?.machineCommandSequence ?? 0;
  const lastMachineCommand = sharedState.emulatorState?.lastMachineCommand as Sp48MachineCommand | undefined;
  const soundLevel = sharedState.emulatorState?.soundLevel ?? 0.8;
  const machineSelection = resolveMachineSelection(
    sharedState.emulatorState?.machineId,
    sharedState.emulatorState?.modelId,
    sharedState.emulatorState?.config
  );
  const machineKey = getMachineSelectionKey(machineSelection);
  const soundLevelRef = useRef(soundLevel);
  const { beeperRenderer, initAudio } = useEmulatorAudio();

  const {
    screenElement,
    canvasWidth,
    canvasHeight,
    displayScreenData,
    paintStoppedScreen,
    updateScreenDimensions
  } = useEmulatorScreen(hostElement, controllerRef);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !lastMachineCommand || commandSequence === lastCommandSequenceRef.current) {
      return;
    }

    lastCommandSequenceRef.current = commandSequence;
    const machineState = controller.issueMachineCommand(lastMachineCommand);
    dispatch(setMachineStateAction(machineState, controller.machine.getCpuPc()));
    updateOverlayForState(machineState);
    updateAudioForState(machineState);
    renderInstantScreenRef.current?.();
  }, [commandSequence, dispatch, lastMachineCommand]);

  useEffect(() => {
    soundLevelRef.current = soundLevel;
  }, [soundLevel]);

  useEffect(() => {
    let disposed = false;
    let machineLoopTimer = 0;
    const pressedPhysicalKeys = new Map<string, number[]>();

    async function run() {
      try {
        const { controller, created } = await getOrCreateController(machineSelection, machineKey);
        const { machine } = controller;
        const audioSampleRate = await initAudio(machine.tactsInFrame, machine.baseClockFrequency);
        machine.setAudioSampleRate(audioSampleRate);
        controllerRef.current = controller;

        if (disposed) {
          return;
        }

        updateScreenDimensions();
        if (created) {
          lastCommandSequenceRef.current = commandSequence;
          dispatch(setMachineStateAction(MachineControllerState.None, machine.getCpuPc()));
          setOverlay("Not yet started. Press F5 to start machine.");
          paintStoppedScreen();
          window.requestAnimationFrame(() => paintStoppedScreen());
        } else {
          updateOverlayForState(controller.machineState);
          paintPixels();
        }

        const setSp48KeyStatus = (key: number, down: boolean) => {
          controller.setKeyStatus(key, down);
          renderInstantScreenRef.current?.();
        };

        const handleKeyDown = (event: KeyboardEvent) => {
          if (pressedPhysicalKeys.has(event.code)) {
            return;
          }
          const keys = mapPhysicalKeyToSp48Keys(event.code);
          if (keys.length === 0) {
            return;
          }
          event.preventDefault();
          pressedPhysicalKeys.set(event.code, keys);
          for (const key of keys) {
            dispatchSp48KeyStatus(key, true, "physical");
          }
        };

        const handleKeyUp = (event: KeyboardEvent) => {
          const keys = pressedPhysicalKeys.get(event.code);
          if (!keys) {
            return;
          }
          event.preventDefault();
          pressedPhysicalKeys.delete(event.code);
          for (const key of keys) {
            dispatchSp48KeyStatus(key, false, "physical");
          }
        };

        const handleVirtualKey = (event: Event) => {
          const detail = (event as CustomEvent<Sp48KeyEventDetail>).detail;
          if (!detail) {
            return;
          }
          setSp48KeyStatus(detail.key, detail.down);
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        window.addEventListener(SP48_KEY_EVENT, handleVirtualKey);

        const publishFrameCompleted = (event?: Sp48FrameCompletedEvent) => {
          if (!event) {
            return;
          }
          const lastFrameTimeInMs = event.executionTimeInMs;
          avgFrameTimeRef.current =
            avgFrameTimeRef.current === 0
              ? lastFrameTimeInMs
              : avgFrameTimeRef.current * 0.9 + lastFrameTimeInMs * 0.1;
          dispatch(setSp48FrameInfoAction({
            frames: event.frames,
            tacts: event.tacts,
            audioSampleCount: event.audioSampleCount,
            lastFrameTimeInMs,
            avgFrameTimeInMs: avgFrameTimeRef.current,
            pc: controller.machine.getCpuPc(),
            baseClockFrequency: controller.machine.baseClockFrequency
          }));
          beeperRenderer.current?.storeSamples(event.audioSamples, soundLevelRef.current);
          beeperRenderer.current?.play();
        };

        controller.frameCompleted.on(publishFrameCompleted);

        renderInstantScreenRef.current = paintPixels;
        paintPixels();

        const frameDurationMs = (machine.tactsInFrame / machine.baseClockFrequency) * 1000;
        let nextFrameTime = performance.now() + frameDurationMs;

        const machineLoop = () => {
          if (disposed) {
            return;
          }

          if (controller.machineState !== MachineControllerState.Running) {
            nextFrameTime = performance.now() + frameDurationMs;
            machineLoopTimer = window.setTimeout(machineLoop, 16);
            return;
          }

          if (controller.tickFrame()) {
            paintPixels();
          }

          const toWait = Math.floor(nextFrameTime - performance.now());
          nextFrameTime += frameDurationMs;
          machineLoopTimer = window.setTimeout(machineLoop, Math.max(0, toWait - 2));
        };

        machineLoopTimer = window.setTimeout(machineLoop, 0);

        return () => {
          window.removeEventListener("keydown", handleKeyDown);
          window.removeEventListener("keyup", handleKeyUp);
          window.removeEventListener(SP48_KEY_EVENT, handleVirtualKey);
          controller.frameCompleted.off(publishFrameCompleted);
          beeperRenderer.current?.suspend();
          renderInstantScreenRef.current = null;
          controllerRef.current = null;
        };
      } catch (ex) {
        if (!disposed) {
          setError(ex instanceof Error ? ex.message : String(ex));
        }
      }
      return undefined;
    }

    let cleanup: (() => void) | undefined;
    run().then((result) => {
      cleanup = result;
    });

    return () => {
      disposed = true;
      cleanup?.();
      window.clearTimeout(machineLoopTimer);
    };
  }, [machineKey]);

  function paintPixels(): void {
    const controller = controllerRef.current;
    if (!controller) {
      return;
    }

    if (
      controller.machineState === MachineControllerState.Stopped ||
      controller.machineState === MachineControllerState.None
    ) {
      paintStoppedScreen();
    } else {
      displayScreenData();
    }
  }

  function updateOverlayForState(machineState: MachineControllerState): void {
    const pc = controllerRef.current?.machine.getCpuPc() ?? 0;
    switch (machineState) {
      case MachineControllerState.Running:
        setOverlay("");
        break;
      case MachineControllerState.Paused:
        setOverlay(`Paused (PC: $${toHexWord(pc)})`);
        break;
      case MachineControllerState.Stopped:
        setOverlay(`Stopped (PC: $${toHexWord(pc)})`);
        break;
      default:
        setOverlay("Not yet started. Press F5 to start machine.");
        break;
    }
  }

  function updateAudioForState(machineState: MachineControllerState): void {
    switch (machineState) {
      case MachineControllerState.Running:
        beeperRenderer.current?.play();
        break;
      case MachineControllerState.Paused:
      case MachineControllerState.Stopped:
        beeperRenderer.current?.suspend();
        break;
    }
  }

  return (
    <div className={styles.emulatorPanel} ref={hostElement} tabIndex={-1}>
      <div
        className={styles.display}
        style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
        onClick={() => setShowOverlay(true)}
      >
        <EmulatorOverlay
          overlay={overlay}
          showOverlay={showOverlay}
          onDismiss={() => setShowOverlay(false)}
        />
        <canvas
          ref={screenElement}
          className={styles.screen}
          width={toCanvasSize(canvasWidth)}
          height={toCanvasSize(canvasHeight)}
          style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
        />
      </div>
      {error ? <div className={styles.error}>{error}</div> : null}
    </div>
  );
};

function toHexWord(value: number): string {
  return (value & 0xffff).toString(16).padStart(4, "0").toUpperCase();
}

function toCanvasSize(value: number): number {
  return Math.max(1, Math.round(value || 0));
}

async function getOrCreateController(
  selection: MachineSelection,
  machineKey: string
): Promise<ControllerSetup> {
  if (cachedController && cachedControllerKey === machineKey) {
    return { controller: cachedController, created: false };
  }

  if (cachedControllerPromise && cachedControllerKey === machineKey) {
    return cachedControllerPromise;
  }

  if (cachedController?.machineState === MachineControllerState.Running) {
    cachedController.issueMachineCommand("stop");
  }
  cachedController?.release();
  cachedController = null;
  cachedControllerKey = machineKey;
  cachedControllerPromise = createSp48MachineController(readBinaryFile, {
    is16k: selection.config[MC_MEM_SIZE] === 16,
    isNtsc: selection.config[MC_SCREEN_FREQ] === "ntsc"
  }).then((controller) => {
    if (cachedControllerKey === machineKey) {
      cachedController = controller;
      cachedControllerPromise = null;
    } else {
      controller.release();
    }
    return { controller, created: true };
  }).catch((err) => {
    if (cachedControllerKey === machineKey) {
      cachedControllerPromise = null;
      cachedControllerKey = "";
    }
    throw err;
  });

  return cachedControllerPromise;
}

function getMachineSelectionKey(selection: MachineSelection): string {
  return stableJson({
    machineId: selection.machineId,
    modelId: selection.modelId,
    config: selection.config
  });
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }

  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => `${JSON.stringify(key)}:${stableJson(child)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}
