import type { KeyMapping } from "@abstractions/KeyMapping";

import styles from "./EmulatorPanel.module.scss";
import { useMachineController } from "@renderer/core/useMachineController";
import { getGlobalSetting, useGlobalSetting, useSelector, useStore } from "@renderer/core/RendererProvider";
import { useResizeObserver } from "@renderer/core/useResizeObserver";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { ReactNode, useEffect, useRef, useState } from "react";
import { ExecutionStateOverlay } from "./ExecutionStateOverlay";
import { AudioRenderer, getBeeperContext, releaseBeeperContext } from "./AudioRenderer";
import { useDisplayRenderer } from "./useDisplayRenderer";
import { FAST_LOAD } from "@emu/machines/machine-props";
import { FrameCompletedArgs, IMachineController } from "../../abstractions/IMachineController";
import { reportMessagingError } from "@renderer/reportError";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import { KeyCodeSet } from "@emu/abstractions/IGenericKeyboardDevice";
import { SectorChanges } from "@emu/abstractions/IFloppyDiskDrive";
import { EMU_DIALOG_BASE } from "@common/messaging/dialog-ids";
import { machineEmuToolRegistry } from "../tool-registry";
import { setClockMultiplierAction } from "@common/state/actions";
import { useMainApi } from "@renderer/core/MainApi";
import { SETTING_EMU_FAST_LOAD, SETTING_EMU_SHOW_INSTANT_SCREEN } from "@common/settings/setting-const";

type Props = {
  keyStatusSet?: (code: number, down: boolean) => void;
};

export const EmulatorPanel = ({ keyStatusSet }: Props) => {
  // --- Refresh when requested
  const [version, setVersion] = useState(1);

  // --- Access state information
  const store = useStore();

  // --- Use application services
  const mainApi = useMainApi();

  // --- Element references
  const hostElement = useRef<HTMLDivElement>();
  const hostRectangle = useRef<DOMRect>();
  const screenRectangle = useRef<DOMRect>();

  // --- Display renderer (encapsulated display state management)
  const display = useDisplayRenderer();
  const {
    screenElement,
    canvasWidth: nativeCanvasWidth,
    canvasHeight: nativeCanvasHeight,
    displayScaleX,
    displayScaleY,
    screenContext,
    imageBuffer,
    imageBuffer8,
    pixelData,
    screenImageData,
    previousPixelData,
    rafId,
    pendingDisplayUpdate,
    lastMachineHash,
  } = display;

  // --- State variables
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const audioSampleRate = useSelector((s) => s.emulatorState?.audioSampleRate);
  const fastLoad = useGlobalSetting(SETTING_EMU_FAST_LOAD);
  const dialogToDisplay = useSelector((s) => s.ideView?.dialogToDisplay);
  const showInstantScreen = useGlobalSetting(SETTING_EMU_SHOW_INSTANT_SCREEN);
  const emuViewVersion = useSelector((s) => s.emulatorState?.emuViewVersion);
  const [overlay, setOverlay] = useState(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const keyMappings = useSelector((s) => s.keyMappings);
  const defaultKeyMappings = useRef<KeyMapping>();
  const currentKeyMappings = useRef<KeyMapping>();
  const keyCodeSet = useRef<KeyCodeSet>();

  // --- Variables for machine state management (moved from global scope)
  const machineStateHandlerQueue = useRef<Array<{
    oldState: MachineControllerState;
    newState: MachineControllerState;
  }>>([]);
  const machineStateProcessing = useRef(false);
  const currentDialogId = useRef(0);
  const savedPixelBuffer = useRef<Uint32Array | null>(null);

  // --- Variables for key management
  const pressedKeys = useRef<Record<string, boolean>>({});
  const _handleKeyDown = (e: KeyboardEvent) => {
    handleKey(e, currentKeyMappings.current, currentDialogId.current, true);
  };
  const _handleKeyUp = (e: KeyboardEvent) => {
    handleKey(e, currentKeyMappings.current, currentDialogId.current, false);
  };

  // --- Variables for audio management
  const beeperRenderer = useRef<AudioRenderer>();

  // --- Tools
  const machineTools = useRef<ReactNode>();

  // --- Prepare the machine controller with event handlers
  const controller = useMachineController(
    machineControllerChanged,
    machineStateChanged,
    machineFrameCompleted
  );
  const controllerRef = useRef<IMachineController>(controller);

  // --- Update key mappings
  const updateKeyMappings = () => {
    if (!keyMappings) {
      currentKeyMappings.current = defaultKeyMappings.current;
    } else {
      currentKeyMappings.current = keyMappings.merge
        ? { ...defaultKeyMappings.current, ...keyMappings.mapping }
        : keyMappings.mapping;
    }
  };

  // --- Render shadow screen according to the current state
  const renderInstantScreen = (savedPixelBuffer?: Uint32Array) => {
    return controller?.machine?.renderInstantScreen(savedPixelBuffer);
  };

  // --- Helper: Render instant screen and schedule display update
  const renderAndScheduleUpdate = (force = false) => {
    if (force || !savedPixelBuffer.current) {
      savedPixelBuffer.current = new Uint32Array(renderInstantScreen());
    }
    scheduleDisplayUpdate();
  };

  // --- Sets the overlay for paused mode
  const setPauseOverlay = () => {
    const showInstantScreen = getGlobalSetting(store, SETTING_EMU_SHOW_INSTANT_SCREEN);
    setOverlay(
      `Paused (PC: $${toHexa4(controller.machine.pc)})${showInstantScreen ? " - Instant screen" : ""}`
    );
  };

  // --- Prepare the key mappings
  useEffect(() => {
    updateKeyMappings();
  }, [keyMappings]);

  // --- Let the key handler know about the current dialog
  useEffect(() => {
    currentDialogId.current = dialogToDisplay ?? 0;
  }, [dialogToDisplay]);

  // --- Set up keyboard handling
  useEffect(() => {
    // --- Take care that keys reach the engine
    window.addEventListener("keydown", _handleKeyDown);
    window.addEventListener("keyup", _handleKeyUp);

    return () => {
      window.removeEventListener("keydown", _handleKeyDown);
      window.removeEventListener("keyup", _handleKeyUp);
    };
  }, [hostElement.current]);

  // --- Respond to screen dimension changes
  const updateScreenDimensions = () => {
    nativeCanvasWidth.current = controller?.machine?.screenWidthInPixels;
    nativeCanvasHeight.current = controller?.machine?.screenHeightInPixels;
    if (controller?.machine?.getAspectRatio) {
      const [ratX, ratY] = controller?.machine?.getAspectRatio();
      displayScaleX.current = ratX ?? 1;
      displayScaleY.current = ratY ?? 1;
    } else {
      displayScaleX.current = 1;
      displayScaleY.current = 1;
    }
    configureScreen();
    calculateDimensions();
  };

  // --- Update screen dimensions
  useEffect(() => {
    updateScreenDimensions();
  }, [
    controller?.machine?.screenWidthInPixels,
    controller?.machine?.screenHeightInPixels,
    controller?.machine?.getAspectRatio
  ]);

  // --- Respond to the FAST LOAD flag changes
  useEffect(() => {
    controller?.machine?.setMachineProperty(FAST_LOAD, fastLoad);
  }, [fastLoad]);

  // --- Respond to shadow screen changes
  useEffect(() => {
    if (showInstantScreen) {
      if (machineState === MachineControllerState.Paused) {
        setPauseOverlay();
        renderAndScheduleUpdate();
      }
    } else {
      if (machineState === MachineControllerState.Paused) {
        setPauseOverlay();
        renderInstantScreen(savedPixelBuffer.current ?? undefined);
        scheduleDisplayUpdate();
      }
    }
  }, [showInstantScreen]);

  // --- Respond to resizing the main container
  useResizeObserver(hostElement, () => {
    calculateDimensions();
    scheduleDisplayUpdate();
  });

  // --- Cleanup cached contexts and ImageData on unmount
  useEffect(() => {
    return () => {
      // --- Cancel any pending RAF
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      screenContext.current = null;
      screenImageData.current = null;
      previousPixelData.current = null;
      savedPixelBuffer.current = null;
      machineStateHandlerQueue.current = [];
    };
  }, []);

  useEffect(() => {
    const showInstantScreen = getGlobalSetting(store, SETTING_EMU_SHOW_INSTANT_SCREEN);
    if (showInstantScreen) {
      renderAndScheduleUpdate(true);
    }
  }, [emuViewVersion]);

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
        {showOverlay && (
          <ExecutionStateOverlay
            text={overlay}
            clicked={() => {
              setShowOverlay(false);
            }}
          />
        )}
        <canvas 
          ref={screenElement} 
          width={nativeCanvasWidth.current} 
          height={nativeCanvasHeight.current}
          style={{
            width: `${canvasWidth ?? 0}px`,
            height: `${canvasHeight ?? 0}px`,
            imageRendering: "pixelated"
          }}
        />
        {machineTools.current}
      </div>
    </div>
  );

  // --- Handles machine controller changes
  async function machineControllerChanged(ctrl: IMachineController): Promise<void> {
    // --- Let's store a ref
    controllerRef.current = ctrl;
    if (!ctrl) return;

    // --- Initial overlay message
    setOverlay("Not yet started. Press F5 to start or Ctrl+F5 to debug machine.");

    // --- Prepare audio
    if (audioSampleRate) {
      const samplesPerFrame =
        (ctrl.machine.tactsInFrame * audioSampleRate) / ctrl.machine.baseClockFrequency;
      await releaseBeeperContext();
      beeperRenderer.current = new AudioRenderer(await getBeeperContext(samplesPerFrame));
    }

    // --- Preapre screen
    updateScreenDimensions();

    // --- Reset display state for new machine to ensure screen renders
    lastMachineHash.current = 0;
    previousPixelData.current = null;
    savedPixelBuffer.current = null;

    // --- Prepare key codes
    keyCodeSet.current = ctrl.machine.getKeyCodeSet();
    defaultKeyMappings.current = ctrl.machine.getDefaultKeyMapping();
    updateKeyMappings();

    // --- Obtain machine tools
    const toolInfo = machineEmuToolRegistry.find(
      (machine) => machine.machineId === ctrl.machine.machineId
    );
    if (toolInfo) {
      machineTools.current = toolInfo.toolFactory(ctrl.machine);
    } else {
      machineTools.current = null;
    }
    setVersion(version + 1);
  }

  // --- Handles machine state changes
  async function machineStateChanged(stateInfo: {
    oldState: MachineControllerState;
    newState: MachineControllerState;
  }): Promise<void> {
    // --- Because event triggering does not await async methods, we have to queue
    // --- change events and serialize their processing
    machineStateHandlerQueue.current.push(stateInfo);
    if (machineStateProcessing.current) return;
    machineStateProcessing.current = true;
    try {
      while (machineStateHandlerQueue.current.length > 0) {
        const toProcess = machineStateHandlerQueue.current.shift();
        switch (toProcess.newState) {
          case MachineControllerState.Running:
            setOverlay(controller?.isDebugging ? "Debug mode" : "");
            await beeperRenderer?.current?.play();
            break;

          case MachineControllerState.Paused:
            setPauseOverlay();
            await beeperRenderer?.current?.suspend();
            const showInstantScreen = getGlobalSetting(store, SETTING_EMU_SHOW_INSTANT_SCREEN);
            if (showInstantScreen) {
              renderAndScheduleUpdate();
            }
            break;

          case MachineControllerState.Stopped:
            savedPixelBuffer.current = null;
            setOverlay(`Stopped (PC: $${toHexa4(controller.machine.pc)})`);
            await beeperRenderer?.current?.suspend();
            machineStateHandlerQueue.current.length = 0;
            break;

          default:
            setOverlay("");
            break;
        }
      }
    } finally {
      machineStateProcessing.current = false;
    }
  }

  // --- Handles machine frame completion events
  async function machineFrameCompleted(args: FrameCompletedArgs): Promise<void> {
    // --- Update the screen
    if (controller.machine.frames % controller.machine.uiFrameFrequency === 0) {
      scheduleDisplayUpdate();
    }

    if (args.fullFrame) {
      savedPixelBuffer.current = renderInstantScreen();
    }

    // --- Stop sound rendering when fast load has been invoked
    // --- Do we need to render sound samples?
    if (args.fullFrame && beeperRenderer.current) {
      const sampleGetter = (controller.machine as any).getAudioSamples;
      if (typeof sampleGetter === "function") {
        const samples = sampleGetter.call(controller.machine) as number[];
        const soundLevel = store.getState()?.emulatorState?.soundLevel ?? 0.0;
        beeperRenderer.current.storeSamples(samples.map((s) => s * soundLevel));
        await beeperRenderer.current.play();
      }
    }

    // --- There's a saved file, store it
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

    // --- There is a change in Disk A
    if (args.diskAChanges) {
      saveDiskChanges(0, args.diskAChanges);
    }

    // --- There is a change in Disk B
    if (args.diskBChanges) {
      saveDiskChanges(1, args.diskBChanges);
    }

    if (args.clockMultiplier) {
      store.dispatch(setClockMultiplierAction(args.clockMultiplier));
    }

    // --- Sends disk changes to the main process
    async function saveDiskChanges(diskIndex: number, changes: SectorChanges): Promise<void> {
      try {
        await mainApi.saveDiskChanges(diskIndex, changes);
      } catch (err) {
        reportMessagingError(`Saving disk changes failed: ${err.toString()}.`);
      }
    }
  }

  // --- Calculate the dimensions so that the virtual machine display fits the screen
  function calculateDimensions(): void {
    if (!hostElement?.current || !screenElement?.current) {
      return;
    }

    hostRectangle.current = hostElement.current.getBoundingClientRect();
    screenRectangle.current = screenElement.current.getBoundingClientRect();
    const clientWidth = hostElement.current.offsetWidth;
    const clientHeight = hostElement.current.offsetHeight;
    const width = nativeCanvasWidth.current ?? 1;
    const height = nativeCanvasHeight.current ?? 1;
    
    // --- Calculate display scale to fit window
    let widthRatio = (clientWidth - 8) / width / displayScaleX.current;
    if (widthRatio < 1) widthRatio = 1;
    let heightRatio = (clientHeight - 8) / height / displayScaleY.current;
    if (heightRatio < 1) heightRatio = 1;
    let ratio = Math.min(widthRatio, heightRatio);
    
    // --- Snap to integer multipliers for pixel-perfect rendering
    ratio = Math.floor(ratio);
    if (ratio < 1) ratio = 1;
    
    // --- Store display dimensions (CSS will scale the canvas with integer multiplier)
    const displayWidth = width * ratio * displayScaleX.current;
    const displayHeight = height * ratio * displayScaleY.current;
    setCanvasWidth(displayWidth);
    setCanvasHeight(displayHeight);
  }

  // --- Setup the screen buffers
  function configureScreen(): void {
    const dataLen = (nativeCanvasWidth.current ?? 0) * (nativeCanvasHeight.current ?? 0) * 4;
    imageBuffer.current = new ArrayBuffer(dataLen);
    imageBuffer8.current = new Uint8Array(imageBuffer.current);
    pixelData.current = new Uint32Array(imageBuffer.current);
    
    // --- Cache canvas context
    if (screenElement.current) {
      screenContext.current = screenElement.current.getContext("2d", {
        willReadFrequently: true
      });
      // --- Pre-create ImageData object to reuse across frames (only if canvas has valid dimensions)
      const width = screenElement.current.width;
      const height = screenElement.current.height;
      if (width > 0 && height > 0 && screenContext.current) {
        screenImageData.current = screenContext.current.createImageData(width, height);
      }
    }
  }

  // --- Schedule display update synchronized with browser refresh rate
  function scheduleDisplayUpdate(): void {
    if (pendingDisplayUpdate.current) {
      return; // Already scheduled
    }
    pendingDisplayUpdate.current = true;
    
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      pendingDisplayUpdate.current = false;
      displayScreenData();
    });
  }

  // --- Displays the screen
  function displayScreenData(): void {
    if (!pixelData.current || !controller?.machine) {
      return;
    }

    // --- Machine change detection: Create a simple hash of machine state
    // --- to skip rendering if nothing changed
    const currentMachineHash = (controller.machine.pc ^ controller.machine.frames) >>> 0;
    if (lastMachineHash.current === currentMachineHash && previousPixelData.current) {
      // --- Machine state hasn't changed and we have previous pixel data
      return; // Skip rendering
    }
    lastMachineHash.current = currentMachineHash;

    const screenEl = screenElement.current;
    if (!screenEl) {
      return;
    }

    const screenCtx = screenContext.current;
    if (!screenCtx) {
      return;
    }

    screenCtx.imageSmoothingEnabled = false;
    let cachedImageData = screenImageData.current;
    
    // --- Create ImageData on first render if it wasn't created during setup
    if (!cachedImageData && screenEl.width > 0 && screenEl.height > 0) {
      cachedImageData = screenCtx.createImageData(screenEl.width, screenEl.height);
      screenImageData.current = cachedImageData;
    }
    
    if (!cachedImageData) {
      return;
    }

    const screenData = controller?.machine?.getPixelBuffer();
    if (!screenData) {
      return;
    }
    const startIndex = controller?.machine?.getBufferStartOffset() ?? 0;
    const endIndex = screenEl.width * screenEl.height + startIndex;
    
    // --- Optimized pixel buffer transfer using TypedArray.set() for faster memory copy
    pixelData.current.set(screenData.subarray(startIndex, endIndex));
    
    // --- Selective canvas update: only redraw if pixel data changed
    let hasChanges = false;
    if (!previousPixelData.current) {
      // --- First render, always update
      hasChanges = true;
      previousPixelData.current = new Uint32Array(pixelData.current);
    } else {
      // --- Compare current and previous pixel data using native typed array comparison
      const current = pixelData.current;
      const previous = previousPixelData.current;
      
      // --- Use every() for early exit on first difference
      hasChanges = !current.every((val, idx) => val === previous[idx]);
      
      // --- Update the snapshot if there were changes
      if (hasChanges) {
        previous.set(current);
      }
    }
    
    // --- Only update canvas if there are actual changes
    if (hasChanges) {
      cachedImageData.data.set(imageBuffer8.current);
      screenCtx.putImageData(cachedImageData, 0, 0);
    }
  }

  // --- Hanldles key events
  function handleKey(
    e: KeyboardEvent,
    mapping: KeyMapping,
    dialogToDisplay: number,
    isDown: boolean
  ): void {
    if (
      !e ||
      controllerRef.current?.state !== MachineControllerState.Running ||
      dialogToDisplay > EMU_DIALOG_BASE
    )
      return;
    // --- Special key: both Shift released
    if ((e.code === "ShiftLeft" || e.code === "ShiftRight") && e.shiftKey === false && !isDown) {
      handleMappedKey("ShiftLeft", mapping, false);
      handleMappedKey("ShiftRight", mapping, false);
    } else {
      handleMappedKey(e.code, mapping, isDown);
    }
    if (isDown) {
      pressedKeys.current[e.code.toString()] = true;
    } else {
      delete pressedKeys.current[e.code.toString()];
    }
  }

  // --- Maps physical keys to ZX Spectrum keys
  function handleMappedKey(code: string, keyMapping: KeyMapping, isDown: boolean): void {
    const mapping = keyMapping[code];
    if (!mapping) return;
    const machine = controllerRef.current?.machine;
    if (typeof mapping === "string") {
      machine?.setKeyStatus(keyCodeSet.current[mapping], isDown);
      keyStatusSet?.(keyCodeSet.current[mapping], isDown);
    } else {
      if (mapping.length > 0) {
        machine?.setKeyStatus(keyCodeSet.current[mapping[0]], isDown);
        keyStatusSet?.(keyCodeSet.current[mapping[0]], isDown);
      }
      if (mapping.length > 1) {
        machine?.setKeyStatus(keyCodeSet.current[mapping[1]], isDown);
        keyStatusSet?.(keyCodeSet.current[mapping[1]], isDown);
      }
      if (mapping.length > 2) {
        machine?.setKeyStatus(keyCodeSet.current[mapping[2]], isDown);
        keyStatusSet?.(keyCodeSet.current[mapping[2]], isDown);
      }
    }
  }
};
