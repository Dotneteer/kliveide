import type { AudioSample } from "@emu/abstractions/IAudioDevice";

import styles from "./EmulatorPanel.module.scss";
import { useMachineController } from "@renderer/core/useMachineController";
import { getGlobalSetting, useGlobalSetting, useSelector, useStore } from "@renderer/core/RendererProvider";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { EmulatorOverlay } from "./EmulatorOverlay";
import { FAST_LOAD } from "@emu/machines/machine-props";
import { FrameCompletedArgs, IMachineController } from "../../abstractions/IMachineController";
import { reportMessagingError } from "@renderer/reportError";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";
import { machineEmuToolRegistry } from "@renderer/appEmu/tool-registry";
import { setClockMultiplierAction } from "@common/state/actions";
import { useMainApi } from "@renderer/core/MainApi";
import { SETTING_EMU_FAST_LOAD, SETTING_EMU_SHOW_INSTANT_SCREEN } from "@common/settings/setting-const";
import { useRecordingManager } from "@renderer/appEmu/recording/RecordingContext";
import { useEmulatorScreen } from "./useEmulatorScreen";
import { useEmulatorAudio } from "./useEmulatorAudio";
import { useEmulatorKeyboard } from "./useEmulatorKeyboard";

type Props = {
  keyStatusSet?: (code: number, down: boolean) => void;
};

export const EmulatorPanel = ({ keyStatusSet }: Props) => {
  const store = useStore();
  const mainApi = useMainApi();

  const hostElement = useRef<HTMLDivElement>(null);

  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const audioSampleRate = useSelector((s) => s.emulatorState?.audioSampleRate);
  const emuViewVersion = useSelector((s) => s.emulatorState?.emuViewVersion);

  const fastLoad = useGlobalSetting(SETTING_EMU_FAST_LOAD);
  const showInstantScreen = useGlobalSetting(SETTING_EMU_SHOW_INSTANT_SCREEN);

  const [overlay, setOverlay] = useState(null);
  const [showOverlay, setShowOverlay] = useState(true);

  const componentStateRef = useRef({
    machineStateHandlerQueue: [] as {
      oldState: MachineControllerState;
      newState: MachineControllerState;
    }[],
    machineStateProcessing: false,
    savedPixelBuffer: null as Uint32Array | null
  });

  const controllerRef = useRef<IMachineController>(null);
  const [machineTools, setMachineTools] = useState<ReactNode>();
  const recordingManagerRef = useRecordingManager();

  // --- Extracted screen hook
  const {
    screenElement,
    canvasWidth,
    canvasHeight,
    imageBuffer8,
    xRatio,
    yRatio,
    displayScreenData,
    updateScreenDimensions
  } = useEmulatorScreen(hostElement, controllerRef);

  // --- Extracted audio hook
  const { beeperRenderer, initAudio } = useEmulatorAudio();

  // --- Extracted keyboard hook
  const { setKeyData } = useEmulatorKeyboard(controllerRef, keyStatusSet);

  // --- Sends disk changes to the main process
  const saveDiskChanges = useCallback(async (diskIndex: number, changes: SectorChanges): Promise<void> => {
    try {
      await mainApi.saveDiskChanges(diskIndex, changes);
    } catch (err) {
      reportMessagingError(`Saving disk changes failed: ${err.toString()}.`);
    }
  }, [mainApi]);

  // --- Sets the overlay for paused mode
  const setPauseOverlay = useCallback((): void => {
    const showInstant = getGlobalSetting(store, SETTING_EMU_SHOW_INSTANT_SCREEN);
    setOverlay(
      `Paused (PC: $${toHexa4(controllerRef.current?.machine?.pc)})${showInstant ? " - Instant screen" : ""}`
    );
  }, [store]);

  // --- Handles machine controller changes
  const machineControllerChanged = useCallback(async (ctrl: IMachineController): Promise<void> => {
    controllerRef.current = ctrl;
    if (!ctrl) return;

    setOverlay("Not yet started. Press F5 to start or Ctrl+F5 to debug machine.");

    await initAudio(ctrl.machine.tactsInFrame, ctrl.machine.baseClockFrequency, audioSampleRate);

    updateScreenDimensions();

    setKeyData(ctrl.machine.getKeyCodeSet(), ctrl.machine.getDefaultKeyMapping());

    const toolInfo = machineEmuToolRegistry.find(
      (machine) => machine.machineId === ctrl.machine.machineId
    );
    setMachineTools(toolInfo ? toolInfo.toolFactory(ctrl.machine) : null);
  }, [audioSampleRate, initAudio, setKeyData, updateScreenDimensions]);

  // --- Handles machine state changes
  const machineStateChanged = useCallback(async (stateInfo: {
    oldState: MachineControllerState;
    newState: MachineControllerState;
  }): Promise<void> => {
    componentStateRef.current.machineStateHandlerQueue.push(stateInfo);
    if (componentStateRef.current.machineStateProcessing) return;
    componentStateRef.current.machineStateProcessing = true;
    try {
      while (componentStateRef.current.machineStateHandlerQueue.length > 0) {
        const toProcess = componentStateRef.current.machineStateHandlerQueue.shift();
        const currentController = controllerRef.current;
        if (!currentController) continue;

        switch (toProcess.newState) {
          case MachineControllerState.Running:
            setOverlay(currentController.isDebugging ? "Debug mode" : "");
            await beeperRenderer?.current?.play();
            await recordingManagerRef?.current?.onMachineRunning(
              currentController.machine.screenWidthInPixels,
              currentController.machine.screenHeightInPixels,
              Math.round(
                (currentController.machine.baseClockFrequency *
                  currentController.machine.frameTactMultiplier) /
                  currentController.machine.tactsInFrame /
                  currentController.machine.uiFrameFrequency
              ),
              xRatio.current,
              yRatio.current,
              audioSampleRate ?? 44100
            );
            break;

          case MachineControllerState.Paused: {
            setPauseOverlay();
            await beeperRenderer?.current?.suspend();
            recordingManagerRef?.current?.onMachinePaused();
            const showInstantScreenOnPause = getGlobalSetting(
              store,
              SETTING_EMU_SHOW_INSTANT_SCREEN
            );
            if (showInstantScreenOnPause) {
              const shadow = currentController.machine.renderInstantScreen();
              if (!componentStateRef.current.savedPixelBuffer) {
                componentStateRef.current.savedPixelBuffer = new Uint32Array(shadow);
              }
              displayScreenData();
            }
            break;
          }

          case MachineControllerState.Stopped:
            componentStateRef.current.savedPixelBuffer = null;
            setOverlay(`Stopped (PC: $${toHexa4(currentController.machine.pc)})`);
            await beeperRenderer?.current?.suspend();
            await recordingManagerRef?.current?.onMachineStopped();
            componentStateRef.current.machineStateHandlerQueue.length = 0;
            break;

          default:
            setOverlay("");
            break;
        }
      }
    } finally {
      componentStateRef.current.machineStateProcessing = false;
    }
  }, [
    audioSampleRate,
    beeperRenderer,
    displayScreenData,
    recordingManagerRef,
    setPauseOverlay,
    store,
    xRatio,
    yRatio
  ]);

  // --- Handles machine frame completion events
  const machineFrameCompleted = useCallback(async (args: FrameCompletedArgs): Promise<void> => {
    const currentController = controllerRef.current;
    if (!currentController) return;

    if (currentController.machine.frames % currentController.machine.uiFrameFrequency === 0) {
      displayScreenData();
    }

    if (args.fullFrame) {
      componentStateRef.current.savedPixelBuffer = currentController.machine.renderInstantScreen();
    }

    if (args.fullFrame && beeperRenderer.current) {
      const sampleGetter = (currentController.machine as any).getAudioSamples;
      if (typeof sampleGetter === "function") {
        const samples = (sampleGetter.call(currentController.machine) as AudioSample[]).slice();
        const soundLevel = store.getState()?.emulatorState?.soundLevel ?? 0.0;
        beeperRenderer.current.storeSamples(samples, soundLevel);
        await beeperRenderer.current.play();
        await recordingManagerRef?.current?.submitAudioSamples(samples);
      }
    }

    if (args.savedFileInfo) {
      (async () => {
        try {
          await mainApi.saveBinaryFile(
            args.savedFileInfo.name,
            args.savedFileInfo.contents,
            "saveFolder"
          );
        } catch (err) {
          reportMessagingError(`Saving file failed: ${err.toString()}.`);
        }
      })();
    }

    if (args.diskAChanges) {
      saveDiskChanges(0, args.diskAChanges);
    }

    if (args.diskBChanges) {
      saveDiskChanges(1, args.diskBChanges);
    }

    if (args.clockMultiplier) {
      store.dispatch(setClockMultiplierAction(args.clockMultiplier));
    }
  }, [beeperRenderer, displayScreenData, mainApi, recordingManagerRef, saveDiskChanges, store]);

  // --- Prepare the machine controller with event handlers
  const controller = useMachineController(
    machineControllerChanged,
    machineStateChanged,
    machineFrameCompleted
  );

  // --- Keep controllerRef in sync with the latest controller value
  useEffect(() => {
    controllerRef.current = controller;
  }, [controller]);

  // --- Wire the pre-delay recording hook whenever the controller changes
  useEffect(() => {
    if (!controller) return undefined;
    controller.beforeFrameDelay = async () => {
      if (imageBuffer8.current) {
        await recordingManagerRef?.current?.submitFrame(imageBuffer8.current);
      }
    };
    return () => {
      controller.beforeFrameDelay = undefined;
    };
  }, [controller, imageBuffer8, recordingManagerRef]);

  // --- Update screen dimensions when machine screen size changes
  useEffect(() => {
    updateScreenDimensions();
  }, [
    controller?.machine?.screenWidthInPixels,
    controller?.machine?.screenHeightInPixels,
    controller?.machine?.getAspectRatio,
    updateScreenDimensions
  ]);

  // --- Respond to the FAST LOAD flag changes
  useEffect(() => {
    controller?.machine?.setMachineProperty(FAST_LOAD, fastLoad);
  }, [controller, fastLoad]);

  // --- Respond to shadow screen changes
  useEffect(() => {
    if (showInstantScreen) {
      if (machineState === MachineControllerState.Paused) {
        setPauseOverlay();
        const shadow = controller?.machine?.renderInstantScreen();
        if (!componentStateRef.current.savedPixelBuffer) {
          componentStateRef.current.savedPixelBuffer = new Uint32Array(shadow);
        }
        displayScreenData();
      }
    } else {
      if (machineState === MachineControllerState.Paused) {
        setPauseOverlay();
        controller?.machine?.renderInstantScreen(componentStateRef.current.savedPixelBuffer);
        displayScreenData();
      }
    }
  }, [controller?.machine, displayScreenData, machineState, setPauseOverlay, showInstantScreen]);

  useEffect(() => {
    const showInstantScreenSetting = getGlobalSetting(store, SETTING_EMU_SHOW_INSTANT_SCREEN);
    if (showInstantScreenSetting) {
      controller?.machine?.renderInstantScreen();
      displayScreenData();
    }
  }, [controller?.machine, displayScreenData, emuViewVersion, store]);

  return (
    <div className={styles.emulatorPanel} ref={hostElement} tabIndex={-1}>
      <div
        className={styles.display}
        style={{
          width: `${canvasWidth ?? 0}px`,
          height: `${canvasHeight ?? 0}px`
        }}
        onClick={() => setShowOverlay(true)}
      >
        <EmulatorOverlay
          overlay={overlay}
          showOverlay={showOverlay}
          onDismiss={() => setShowOverlay(false)}
        />
        <canvas ref={screenElement} width={canvasWidth} height={canvasHeight} />
        {machineTools}
      </div>
    </div>
  );
};
