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
import {
  SETTING_EMU_FAST_LOAD,
  SETTING_EMU_MOUSE_SHOW_POINTER,
  SETTING_EMU_SHOW_BEAM_POSITION,
  SETTING_EMU_SHOW_INSTANT_SCREEN
} from "@common/settings/setting-const";
import { useRecordingManager } from "@renderer/appEmu/recording/RecordingContext";
import { useEmulatorScreen } from "./useEmulatorScreen";
import type { EmuContentSizeHints } from "@common/utils/emu-window-size";
import { useEmulatorAudio } from "./useEmulatorAudio";
import { useEmulatorKeyboard } from "./useEmulatorKeyboard";
import { useEmulatorMouse } from "./useEmulatorMouse";
import { useEmulatorJoystick } from "./useEmulatorJoystick";
import { CapturedPointer } from "./CapturedPointer";
import { useNextLayerRegs, useNextLayerView } from "./useNextLayerView";
import { NextLayersScreenOverlay } from "./NextLayersScreenOverlay";
import { BeamPositionOverlay } from "./BeamPositionOverlay";
import { useBeamOverlay } from "./useBeamOverlay";
import { beamOverlayPill } from "./beamOverlayModel";
import { normalizeMousePointerDisplay } from "@common/settings/mouse-capture";
import { renderMachineAudioFrame } from "./audioFrameRendering";
import { MEDIA_DISK_A, MEDIA_DISK_B } from "@common/structs/project-const";
import { applySectorChangesToDiskContents } from "@emu/machines/disk/disk-changes";
import { mediaStore } from "@emu/machines/media/media-info";

type Props = {
  keyStatusSet?: (code: number, down: boolean) => void;
};

export const EmulatorPanel = ({ keyStatusSet }: Props) => {
  const store = useStore();
  const mainApi = useMainApi();

  const hostElement = useRef<HTMLDivElement>(null);

  /*
   * The box the screen is allowed to fill.
   *
   * This is deliberately *not* the panel root. The panel is a column that also carries the
   * machine-specific tool strip (the Z88 slot cards), so the room left for the canvas is the panel
   * minus that strip. Measuring the root would hand the canvas height the strip is already using
   * and push the strip back out of view.
   */
  const screenArea = useRef<HTMLDivElement>(null);

  /*
   * The tool strip's own box, so the screen can be sized around it.
   *
   * The strip sits in the same centred stack as the screen, which keeps the two adjacent and their
   * left edges flush. That also means its height is inside the area being measured, so the screen
   * hook has to hold that much back — see the `reservedElement` argument below.
   */
  const toolArea = useRef<HTMLDivElement>(null);

  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const audioSampleRate = useSelector((s) => s.emulatorState?.audioSampleRate);
  const emuViewVersion = useSelector((s) => s.emulatorState?.emuViewVersion);
  const isDebugging = useSelector((s) => s.emulatorState?.isDebugging ?? false);

  const fastLoad = useGlobalSetting(SETTING_EMU_FAST_LOAD);
  const showInstantScreen = useGlobalSetting(SETTING_EMU_SHOW_INSTANT_SCREEN);
  const showBeamPosition = !!useGlobalSetting(SETTING_EMU_SHOW_BEAM_POSITION);
  // --- Counts the stops, so the beam overlay redraws at each one, stepping included (T9)
  const [stopCount, setStopCount] = useState(0);

  const [overlay, setOverlay] = useState(null);
  const [showOverlay, setShowOverlay] = useState(true);

  const componentStateRef = useRef({
    machineStateHandlerQueue: [] as {
      oldState: MachineControllerState;
      newState: MachineControllerState;
    }[],
    machineStateProcessing: false,
    /*
     * The machine's own picture from just before Instant Screen replaced it while paused, put back
     * when Instant Screen is switched off again. Taken only then: restoring a saved picture at every
     * pause wrote the previous frame over the part of the buffer the raster had already drawn, inside
     * the machine (`.plans/BEAM_POSITION_OVERLAY_PLAN.md` T1).
     */
    instantSnapshot: null as Uint32Array | null,
    /** Instant Screen's value when the effect that applies it last ran */
    lastShowInstant: undefined as boolean | undefined
  });

  const controllerRef = useRef<IMachineController>(null);
  const [machineTools, setMachineTools] = useState<ReactNode>();
  // --- The setting that switches the strip on and off; none means always shown (the Z88 slots)
  const [machineToolsSetting, setMachineToolsSetting] = useState<string | undefined>();
  const machineToolsSettingValue = useGlobalSetting(machineToolsSetting ?? "");
  const showMachineTools = !!machineTools && (!machineToolsSetting || !!machineToolsSettingValue);
  const recordingManagerRef = useRecordingManager();

  // --- The window's minimum size, Fit Window to Screen and per-machine sizes (issue #1377)
  const onContentSizeHintsChanged = useCallback(
    (hints: EmuContentSizeHints) => {
      mainApi.setEmuContentSizeHints(hints).catch((err) => {
        reportMessagingError(`Sending the emulator window's size hints failed: ${err}.`);
      });
    },
    [mainApi]
  );

  // --- Extracted screen hook
  const {
    screenElement,
    displayElement,
    hasSurround,
    canvasWidth,
    canvasHeight,
    imageBuffer8,
    xRatio,
    yRatio,
    displayScreenData,
    calculateDimensions,
    updateScreenDimensions
  } = useEmulatorScreen(screenArea, controllerRef, toolArea, onContentSizeHintsChanged);

  // --- Extracted audio hook
  const { beeperRenderer, initAudio } = useEmulatorAudio();

  // --- Extracted mouse hook. It must be mounted *before* the keyboard hook: both listen for
  // --- `keydown` on `window`, and the mouse hook's Ctrl+M handler relies on running first so it
  // --- can stop the chord from also reaching the machine's M key.
  const capturedPointer = useRef<HTMLDivElement>(null);
  const { captured, captureRefused } = useEmulatorMouse(screenElement, {
    indicatorRef: capturedPointer,
    controllerRef
  });
  const showCapturedPointer =
    normalizeMousePointerDisplay(useGlobalSetting(SETTING_EMU_MOUSE_SHOW_POINTER)) !== "never";

  // --- Extracted joystick hook. Like the mouse hook it must come *before* the keyboard hook: it
  // --- claims the host keys bound to a connector, and stops those events reaching anything else.
  const { claimsKey } = useEmulatorJoystick(controllerRef);

  // --- Extracted keyboard hook
  const { setKeyData } = useEmulatorKeyboard(controllerRef, keyStatusSet, claimsKey);

  // --- Sends disk changes to the main process
  const saveDiskChanges = useCallback(async (diskIndex: number, changes: SectorChanges): Promise<void> => {
    const mediaId = diskIndex ? MEDIA_DISK_B : MEDIA_DISK_A;
    try {
      const mediaContents = mediaStore.getMedia(mediaId)?.mediaContents;
      if (mediaContents instanceof Uint8Array) {
        applySectorChangesToDiskContents(mediaContents, changes);
      }
      const machineContents = controllerRef.current?.machine?.getMachineProperty(mediaId);
      if (machineContents instanceof Uint8Array && machineContents !== mediaContents) {
        applySectorChangesToDiskContents(machineContents, changes);
      }
    } catch (err) {
      reportMessagingError(`Updating attached disk media failed: ${err.toString()}.`);
    }

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

    await initAudio(
      ctrl.machine.tactsInFrame,
      ctrl.machine.baseClockFrequency,
      audioSampleRate,
      ctrl.machine.uiFrameFrequency
    );

    updateScreenDimensions();

    setKeyData(ctrl.machine.getKeyCodeSet(), ctrl.machine.getDefaultKeyMapping());

    const toolInfo = machineEmuToolRegistry.find(
      (machine) => machine.machineId === ctrl.machine.machineId
    );
    setMachineTools(toolInfo ? toolInfo.toolFactory(ctrl.machine) : null);
    setMachineToolsSetting(toolInfo?.visibilitySetting);
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
            // --- The machine draws again: a picture kept at an earlier pause is no longer its own
            componentStateRef.current.instantSnapshot = null;
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
              audioSampleRate ?? 44100,
              // --- A picture with no border of its own is recorded in its surround (issue #1374)
              currentController.machine.getScreenSurroundColor
                ? () => controllerRef.current?.machine?.getScreenSurroundColor?.()
                : undefined
            );
            break;

          case MachineControllerState.Paused: {
            setPauseOverlay();
            setStopCount((n) => n + 1);
            await beeperRenderer?.current?.suspend();
            recordingManagerRef?.current?.onMachinePaused();
            const showInstantScreenOnPause = getGlobalSetting(
              store,
              SETTING_EMU_SHOW_INSTANT_SCREEN
            );
            if (showInstantScreenOnPause) {
              const shadow = currentController.machine.renderInstantScreen();
              // --- The first render of this pause keeps the machine's picture; the Instant Screen
              // --- effect may have rendered already, and then `shadow` is its render, not the machine's
              if (!componentStateRef.current.instantSnapshot) {
                componentStateRef.current.instantSnapshot = new Uint32Array(shadow);
              }
              displayScreenData();
            }
            break;
          }

          case MachineControllerState.Stopped:
            componentStateRef.current.instantSnapshot = null;
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
      const soundLevel = store.getState()?.emulatorState?.soundLevel ?? 0.0;
      const rendering = store.getState()?.emulatorState?.rzx?.mode === "rendering";
      await renderMachineAudioFrame(
        currentController.machine,
        beeperRenderer.current,
        soundLevel,
        recordingManagerRef?.current,
        rendering
      );
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

    // --- This handler runs on every completed frame (about 50 times a second), while the clock
    // --- multiplier changes only when the user changes it. Re-dispatching the value the store
    // --- already holds would notify every subscriber in this window 50 times a second for nothing.
    const currentMultiplier = store.getState()?.emulatorState?.clockMultiplier;
    if (args.clockMultiplier && args.clockMultiplier !== currentMultiplier) {
      store.dispatch(setClockMultiplierAction(args.clockMultiplier));
    }
  }, [beeperRenderer, displayScreenData, mainApi, recordingManagerRef, saveDiskChanges, store]);

  // --- Prepare the machine controller with event handlers
  const controller = useMachineController(
    machineControllerChanged,
    machineStateChanged,
    machineFrameCompleted
  );

  // --- The ZX Spectrum Next layer debug view (`.plans/LAYER_COMPOSITION_PLAN.md`): mask, capture, pill
  const layerView = useNextLayerView(controller, displayScreenData);
  const layerState = useNextLayerRegs(
    layerView.machine,
    !!layerView.view.showClips,
    machineState === MachineControllerState.Running
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

  /*
   * Refit once the machine's tool strip (the Z88 slot cards, the Spectrum media strip) is in the
   * DOM, and again whenever a switchable strip is shown or hidden.
   *
   * The strip mounts after the fit that `machineControllerChanged` runs, and the hook's resize
   * observer on it cannot attach in that same render (the ref is still empty when its dependency is
   * read). Until something else resized, the fit and the window's minimum size ignored the strip:
   * a Z88 window could be shrunk until the strip was pushed over the status bar (issue #1377).
   */
  useEffect(() => {
    calculateDimensions();
    displayScreenData();
  }, [showMachineTools, machineTools, calculateDimensions, displayScreenData]);

  // --- Respond to the FAST LOAD flag changes
  useEffect(() => {
    controller?.machine?.setMachineProperty(FAST_LOAD, fastLoad);
  }, [controller, fastLoad]);

  // --- Respond to shadow screen changes
  useEffect(() => {
    const state = componentStateRef.current;
    const wasInstant = state.lastShowInstant;
    state.lastShowInstant = !!showInstantScreen;
    if (machineState !== MachineControllerState.Paused) return;
    setPauseOverlay();
    if (showInstantScreen) {
      const shadow = controller?.machine?.renderInstantScreen();
      // --- The first render of this pause keeps the machine's picture to put back (the snapshot is
      // --- dropped whenever the machine runs, so one left over is always this pause's)
      if (shadow && !state.instantSnapshot) state.instantSnapshot = new Uint32Array(shadow);
      displayScreenData();
    } else if (wasInstant && state.instantSnapshot) {
      // --- Switched off while paused: the machine's own picture again
      controller?.machine?.renderInstantScreen(state.instantSnapshot);
      state.instantSnapshot = null;
      displayScreenData();
    }
  }, [controller?.machine, displayScreenData, machineState, setPauseOverlay, showInstantScreen]);

  /*
   * Keep "Debug mode" in step with a running machine switching modes without stopping.
   *
   * The overlay is otherwise set only on a state change, which reads the controller's debug flag as
   * the machine *enters* Running. The ZX Spectrum Next launch flow (`.nexload`, and `nex-run -e`
   * breaking at a NEX entry point) starts the machine normally so its keystrokes are not cut short,
   * then switches the still-running machine to debug mode in place. No state change follows, so
   * without this the overlay stayed blank for the whole debug run until the first pause.
   *
   * Only while Running: a paused or stopped machine shows its own overlay, which this must not
   * overwrite.
   */
  useEffect(() => {
    if (store.getState()?.emulatorState?.machineState !== MachineControllerState.Running) return;
    setOverlay(isDebugging ? "Debug mode" : "");
  }, [isDebugging, store]);

  useEffect(() => {
    const showInstantScreenSetting = getGlobalSetting(store, SETTING_EMU_SHOW_INSTANT_SCREEN);
    if (showInstantScreenSetting) {
      controller?.machine?.renderInstantScreen();
      displayScreenData();
    }
  }, [controller?.machine, displayScreenData, emuViewVersion, store]);

  // --- The beam position overlay (`.plans/BEAM_POSITION_OVERLAY_PLAN.md`). Declared after the
  // --- Instant Screen effects on purpose: effects run in order, and the picture it renders to the
  // --- beam must be drawn after theirs.
  const paused = machineState === MachineControllerState.Paused;
  const beamState = useBeamOverlay(controller?.machine, displayScreenData, {
    paused,
    enabled: showBeamPosition,
    instant: !!showInstantScreen,
    stopCount,
    viewVersion: emuViewVersion
  });

  return (
    <div className={styles.emulatorPanel} ref={hostElement} tabIndex={-1}>
      <div className={styles.screenArea} ref={screenArea}>
        <div className={styles.machineStack}>
          <div
            ref={displayElement}
            className={hasSurround ? `${styles.display} ${styles.surround}` : styles.display}
            style={{
              width: `${canvasWidth ?? 0}px`,
              height: `${canvasHeight ?? 0}px`
            }}
            /*
             * A click on the screen restores the overlay and nothing else.
             *
             * Capturing the mouse from here was tried and removed: clicking the picture is what
             * someone does to bring the status pill back or simply to focus the window, and losing
             * the cursor to the machine for it is startling. Capture is now always something asked
             * for explicitly - the toolbar button or Ctrl+M.
             */
            onClick={() => setShowOverlay(true)}
          >
            <EmulatorOverlay
              overlay={overlay}
              showOverlay={showOverlay}
              onDismiss={() => setShowOverlay(false)}
              mouseCaptured={captured}
              mouseCaptureRefused={captureRefused}
              layerDebugText={layerView.pillText}
              layerDebugApproximate={layerView.approximate}
              beamText={beamState ? beamOverlayPill(beamState) : undefined}
            />
            {captured && showCapturedPointer && <CapturedPointer ref={capturedPointer} />}
            <canvas ref={screenElement} width={canvasWidth} height={canvasHeight} />
            {beamState && (
              <BeamPositionOverlay
                state={beamState}
                screenWidth={controller?.machine?.screenWidthInPixels ?? 1}
                screenHeight={controller?.machine?.screenHeightInPixels ?? 1}
                aspectX={controller?.machine?.getAspectRatio?.()[0] ?? 1}
                // --- The probe and the captured mouse own the pointer; the readout steps aside
                hover={!captured && !(layerView.view.probe && layerView.paused)}
              />
            )}
            {layerView.machine && (
              <NextLayersScreenOverlay
                machine={layerView.machine}
                view={layerView.view}
                layerState={layerState}
                paused={layerView.paused}
                screenWidth={controller?.machine?.screenWidthInPixels ?? 720}
                screenHeight={controller?.machine?.screenHeightInPixels ?? 288}
              />
            )}
          </div>
          {showMachineTools && (
            <div className={styles.toolArea} ref={toolArea}>
              {machineTools}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
