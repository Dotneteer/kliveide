import { useEffect, useRef, useState } from "react";
import type { KeyMapping, KeyMappingSet } from "../../../common/abstractions/KeyMapping";
import { MachineControllerState } from "../../../common/abstractions/MachineControllerState";
import { MC_MEM_SIZE, MC_SCREEN_FREQ } from "../../../common/machines/constants";
import {
  resolveMachineSelection,
  type MachineSelection
} from "../../../common/machines/machine-registry";
import {
  setMachineStateAction,
  setSp48FrameInfoAction,
  setTapeMediaAction
} from "../../../common/state/actions";
import {
  createSp48MachineController,
  Sp48MachineController,
  type Sp48FrameCompletedEvent,
  type Sp48MachineCommand
} from "../../../emu/sp48/Sp48MachineController";
import {
  Sp48TapeMode,
  Sp48TapePlayPhase,
  Sp48TapeSavePhase
} from "../../../emu/sp48/WasmZxSpectrum48Machine";
import {
  SP48_KEY_EVENT,
  dispatchSp48KeyStatus,
  mapPhysicalKeyToSp48Keys,
  spectrumKeyMappings,
  type Sp48KeyEventDetail
} from "../../../emu/sp48/sp48-keyboard";
import {
  getActiveSp48Controller,
  setActiveSp48Controller
} from "../../../emu/sp48/sp48-session";
import {
  getMainApi,
  readBinaryFile,
  saveGeneratedTapeFile,
  useDispatch,
  useSharedState
} from "../../shared-store";
import { EmulatorOverlay } from "./EmulatorOverlay";
import styles from "./EmulatorPanel.module.scss";
import { attachGeneratedTapeFile } from "./generatedTapeAttach";
import { createGeneratedTapeSaveQueue } from "./generatedTapeSave";
import { RecordingManager } from "../recording/RecordingManager";
import {
  getActiveRecordingManager,
  setActiveRecordingManager
} from "../recording/recording-session";
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
  const tapeStatusSignatureRef = useRef("");
  const disposedRef = useRef(false);
  const recordingManagerRef = useRef<RecordingManager | null>(null);
  const audioSampleRateRef = useRef(44100);
  const [overlay, setOverlay] = useState<string | null>("Loading machine...");
  const [showOverlay, setShowOverlay] = useState(true);
  const [error, setError] = useState<string>();
  const sharedState = useSharedState();
  const tapeMediaRef = useRef(sharedState.media?.tape);
  const keyMappingsRef = useRef(buildEffectiveKeyMappings(sharedState.keyMappings));
  const dispatch = useDispatch();
  const commandSequence = sharedState.emulatorState?.machineCommandSequence ?? 0;
  const lastMachineCommand = sharedState.emulatorState?.lastMachineCommand as Sp48MachineCommand | undefined;
  const soundLevel = sharedState.emulatorState?.soundLevel ?? 0.8;
  const clockMultiplier = sharedState.emulatorState?.clockMultiplier ?? 1;
  const recordingFps = sharedState.emulatorState?.screenRecordingFps ?? "native";
  const recordingQuality = sharedState.emulatorState?.screenRecordingQuality ?? "good";
  const recordingFormat = sharedState.emulatorState?.screenRecordingFormat ?? "mp4";
  const fastLoad = sharedState.globalSettings?.emuOptions?.fastLoad ?? true;
  const machineSelection = resolveMachineSelection(
    sharedState.emulatorState?.machineId,
    sharedState.emulatorState?.modelId,
    sharedState.emulatorState?.config
  );
  const machineKey = getMachineSelectionKey(machineSelection);
  const soundLevelRef = useRef(soundLevel);
  const clockMultiplierRef = useRef(clockMultiplier);
  const fastLoadRef = useRef(fastLoad);
  const generatedTapeSaveQueueRef = useRef(
    createGeneratedTapeSaveQueue(saveGeneratedTapeFile, (status) => {
      if (disposedRef.current) {
        return;
      }

      switch (status.kind) {
        case "saved":
          setError(undefined);
          break;
        case "cancelled":
          break;
        case "failed":
          setError(`Could not save generated tape file "${status.defaultName}". ${status.error}`);
          break;
      }
    }, (fileName, contents) => {
      attachGeneratedTapeFile(fileName, contents);
    })
  );
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
    void (async () => {
      const machineState = controller.issueMachineCommand(lastMachineCommand);
      await updateAudioForState(machineState);
      await updateRecordingForState(machineState);
      dispatch(setMachineStateAction(machineState, controller.machine.getCpuPc()));
      updateOverlayForState(machineState);
      renderInstantScreenRef.current?.();
    })();
  }, [commandSequence, dispatch, lastMachineCommand]);

  useEffect(() => {
    soundLevelRef.current = soundLevel;
  }, [soundLevel]);

  useEffect(() => {
    clockMultiplierRef.current = clockMultiplier;
    controllerRef.current?.setTargetClockMultiplier(clockMultiplier);
  }, [clockMultiplier]);

  useEffect(() => {
    tapeMediaRef.current = sharedState.media?.tape;
  }, [sharedState.media?.tape]);

  useEffect(() => {
    keyMappingsRef.current = buildEffectiveKeyMappings(sharedState.keyMappings);
  }, [sharedState.keyMappings]);

  useEffect(() => {
    fastLoadRef.current = fastLoad;
    controllerRef.current?.setTapeFastLoad(fastLoad);
  }, [fastLoad]);

  useEffect(() => {
    recordingManagerRef.current?.syncPreferences(recordingFps, recordingQuality, recordingFormat);
  }, [recordingFps, recordingFormat, recordingQuality]);

  useEffect(() => {
    let disposed = false;
    let machineLoopTimer = 0;
    const pressedPhysicalKeys = new Map<string, number[]>();
    disposedRef.current = false;
    const recordingManager = new RecordingManager(getMainApi(), dispatch);
    recordingManager.syncPreferences(recordingFps, recordingQuality, recordingFormat);
    recordingManagerRef.current = recordingManager;
    setActiveRecordingManager(recordingManager);

    async function run() {
      try {
        const { controller, created } = await getOrCreateController(machineSelection, machineKey);
        const { machine } = controller;
        const audioSampleRate = await initAudio(machine.tactsInFrame, machine.baseClockFrequency);
        audioSampleRateRef.current = audioSampleRate;
        machine.setAudioSampleRate(audioSampleRate);

        if (disposed) {
          return;
        }

        controllerRef.current = controller;
        controller.setTapeFastLoad(fastLoadRef.current);
        controller.setTargetClockMultiplier(clockMultiplierRef.current);
        setActiveSp48Controller(controller);

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
          const keys = mapPhysicalKeyToSp48Keys(event.code, keyMappingsRef.current);
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

        const publishFrameCompleted = async (event?: Sp48FrameCompletedEvent) => {
          if (!event) {
            return;
          }
          await recordingManagerRef.current?.submitFrame(createRecordingFrame(event, controller));
          if (beeperRenderer.current) {
            beeperRenderer.current.storeSamples(event.audioSamples, soundLevelRef.current);
            await beeperRenderer.current.play();
          }
          await recordingManagerRef.current?.submitAudioSamples(
            event.audioSamples,
            soundLevelRef.current
          );
          const lastFrameTimeInMs = event.executionTimeInMs;
          avgFrameTimeRef.current =
            avgFrameTimeRef.current === 0
              ? lastFrameTimeInMs
              : avgFrameTimeRef.current * 0.9 + lastFrameTimeInMs * 0.1;
          if (event.frames % 10 === 0) {
            dispatch(setSp48FrameInfoAction({
              frames: event.frames,
              tacts: event.tacts,
              audioSampleCount: event.audioSampleCount,
              lastFrameTimeInMs,
              avgFrameTimeInMs: avgFrameTimeRef.current,
              pc: controller.machine.getCpuPc(),
              baseClockFrequency: controller.machine.baseClockFrequency,
              clockMultiplier: event.clockMultiplier
            }));
            publishTapeStatus(controller);
          }
          if (event.savedTapeFileInfo) {
            void generatedTapeSaveQueueRef.current.enqueue(event.savedTapeFileInfo);
          }
        };

        controller.frameCompleted.on(publishFrameCompleted);

        renderInstantScreenRef.current = paintPixels;
        paintPixels();

        const frameDurationMs = (machine.tactsInFrame / machine.baseClockFrequency) * 1000;

        const delay = (milliseconds: number): Promise<void> =>
          new Promise<void>((resolve) => {
            machineLoopTimer = window.setTimeout(resolve, Math.max(0, milliseconds));
          });

        const machineLoop = async () => {
          let nextFrameTime = performance.now() + frameDurationMs;

          while (!disposed) {
            if (controller.machineState !== MachineControllerState.Running) {
              nextFrameTime = performance.now() + frameDurationMs;
              await delay(16);
              continue;
            }

            controller.setTargetClockMultiplier(clockMultiplierRef.current);
            if (controller.tickFrame()) {
              paintPixels();
            }

            const toWait = Math.floor(nextFrameTime - performance.now());
            await delay(toWait - 2);
            nextFrameTime += frameDurationMs;
          }
        };

        void machineLoop();

        return () => {
          window.removeEventListener("keydown", handleKeyDown);
          window.removeEventListener("keyup", handleKeyUp);
          window.removeEventListener(SP48_KEY_EVENT, handleVirtualKey);
          controller.frameCompleted.off(publishFrameCompleted);
          beeperRenderer.current?.suspend();
          renderInstantScreenRef.current = null;
          controllerRef.current = null;
          if (getActiveSp48Controller() === controller) {
            setActiveSp48Controller(null);
          }
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
      disposedRef.current = true;
      cleanup?.();
      if (getActiveRecordingManager() === recordingManager) {
        setActiveRecordingManager(null);
      }
      void recordingManager.onMachineStopped();
      if (recordingManagerRef.current === recordingManager) {
        recordingManagerRef.current = null;
      }
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

  async function updateAudioForState(machineState: MachineControllerState): Promise<void> {
    switch (machineState) {
      case MachineControllerState.Running:
        await beeperRenderer.current?.play();
        break;
      case MachineControllerState.Paused:
      case MachineControllerState.Stopped:
        await beeperRenderer.current?.suspend();
        break;
    }
  }

  async function updateRecordingForState(machineState: MachineControllerState): Promise<void> {
    const controller = controllerRef.current;
    const manager = recordingManagerRef.current;
    if (!controller || !manager) {
      return;
    }

    switch (machineState) {
      case MachineControllerState.Running: {
        const [xRatio, yRatio] = getMachineAspectRatio(controller);
        await manager.onMachineRunning(
          controller.machine.screenWidthInPixels,
          controller.machine.screenHeightInPixels,
          Math.max(1, Math.round(controller.machine.baseClockFrequency / controller.machine.tactsInFrame)),
          xRatio ?? 1,
          yRatio ?? 1,
          audioSampleRateRef.current
        );
        break;
      }
      case MachineControllerState.Paused:
        manager.onMachinePaused();
        break;
      case MachineControllerState.Stopped:
      case MachineControllerState.None:
        await manager.onMachineStopped();
        break;
    }
  }

  function publishTapeStatus(controller: Sp48MachineController): void {
    const tape = tapeMediaRef.current;
    const rawTapeMode = controller.machine.getTapeMode();
    const isSaving = rawTapeMode === Sp48TapeMode.Save;

    if (!tape?.displayName && !isSaving) {
      tapeStatusSignatureRef.current = "";
      return;
    }

    const currentTape = tape ?? {};
    const blockCount = currentTape.blockCount ?? 0;
    const rawBlockIndex = controller.machine.getTapeCurrentBlockIndex();
    const currentBlockIndex =
      blockCount > 0 ? Math.min(rawBlockIndex, blockCount - 1) : rawBlockIndex;
    const tapeMode = toTapeModeName(rawTapeMode);
    const tapePhase = toTapePhaseName(controller.machine.getTapePlayPhase());
    const savePhase = toTapeSavePhaseName(controller.machine.getTapeSavePhase());
    const savePilotPulseCount = controller.machine.getTapeSavePilotPulseCount();
    const savedBlockCount = controller.machine.getSavedTapeBlockCount();
    const savedDataLength = controller.machine.getSavedTapeDataLength();
    const status = controller.machine.isTapeEof()
      ? "eof"
      : rawTapeMode === Sp48TapeMode.Load
        ? "loading"
        : isSaving
          ? "saving"
        : currentBlockIndex === 0
          ? "rewound"
          : "ready";
    const signature =
      `${status}:${currentBlockIndex}:${blockCount}:${tapeMode}:${tapePhase}` +
      `:${savePhase}:${savePilotPulseCount}:${savedBlockCount}:${savedDataLength}`;
    if (signature === tapeStatusSignatureRef.current) {
      return;
    }

    tapeStatusSignatureRef.current = signature;
    dispatch(setTapeMediaAction({
      ...currentTape,
      currentBlockIndex,
      mode: tapeMode,
      phase: tapePhase,
      status,
      savePhase,
      savePilotPulseCount,
      savedBlockCount,
      savedDataLength
    }));
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

function getMachineAspectRatio(controller: Sp48MachineController): [number, number] {
  const machine = controller.machine;
  if ("getAspectRatio" in machine && typeof machine.getAspectRatio === "function") {
    return machine.getAspectRatio() as [number, number];
  }
  return [1, 1];
}

function createRecordingFrame(
  event: Sp48FrameCompletedEvent,
  controller: Sp48MachineController
): Uint8Array {
  const machine = controller.machine;
  const width = machine.screenWidthInPixels;
  const height = machine.screenHeightInPixels;
  const start = machine.getPixelBufferStartOffset();
  const end = start + width * height;
  const pixels = new Uint32Array(width * height);
  pixels.set(event.pixelBuffer.subarray(start, end));
  return new Uint8Array(pixels.buffer);
}

function toHexWord(value: number): string {
  return (value & 0xffff).toString(16).padStart(4, "0").toUpperCase();
}

function toCanvasSize(value: number): number {
  return Math.max(1, Math.round(value || 0));
}

function toTapeModeName(mode: number): "passive" | "load" | "save" {
  switch (mode) {
    case Sp48TapeMode.Load:
      return "load";
    case Sp48TapeMode.Save:
      return "save";
    default:
      return "passive";
  }
}

function toTapePhaseName(
  phase: number
): "none" | "pilot" | "sync" | "data" | "termSync" | "pause" | "completed" {
  switch (phase) {
    case Sp48TapePlayPhase.Pilot:
      return "pilot";
    case Sp48TapePlayPhase.Sync:
      return "sync";
    case Sp48TapePlayPhase.Data:
      return "data";
    case Sp48TapePlayPhase.TermSync:
      return "termSync";
    case Sp48TapePlayPhase.Pause:
      return "pause";
    case Sp48TapePlayPhase.Completed:
      return "completed";
    default:
      return "none";
  }
}

function toTapeSavePhaseName(
  phase: number
): "none" | "pilot" | "sync1" | "sync2" | "data" | "error" {
  switch (phase) {
    case Sp48TapeSavePhase.Pilot:
      return "pilot";
    case Sp48TapeSavePhase.Sync1:
      return "sync1";
    case Sp48TapeSavePhase.Sync2:
      return "sync2";
    case Sp48TapeSavePhase.Data:
      return "data";
    case Sp48TapeSavePhase.Error:
      return "error";
    default:
      return "none";
  }
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

function buildEffectiveKeyMappings(keyMappings: KeyMappingSet | undefined): KeyMapping {
  if (!keyMappings) {
    return spectrumKeyMappings;
  }

  return keyMappings.merge
    ? { ...spectrumKeyMappings, ...keyMappings.mapping }
    : keyMappings.mapping;
}
