import type { KeyMapping } from "@abstractions/KeyMapping";

import styles from "./EmulatorPanel.module.scss";
import { useMachineController } from "@renderer/core/useMachineController";
import { getGlobalSetting, useGlobalSetting, useSelector, useStore } from "@renderer/core/RendererProvider";
import { useResizeObserver } from "@renderer/core/useResizeObserver";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { ReactNode, useEffect, useRef, useState } from "react";
import { ExecutionStateOverlay } from "./ExecutionStateOverlay";
import { AudioRenderer, getBeeperContext, releaseBeeperContext } from "./AudioRenderer";
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
import { SETTING_EMU_FAST_LOAD, SETTING_EMU_SHOW_INSTANT_SCREEN, SETTING_EMU_SCANLINE_EFFECT } from "@common/settings/setting-const";

let machineStateHandlerQueue: {
  oldState: MachineControllerState;
  newState: MachineControllerState;
}[] = [];
let machineStateProcessing = false;
let currentDialogId = 0;
let savedPixelBuffer: Uint32Array | null = null;

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
  const screenElement = useRef<HTMLCanvasElement>();
  const shadowScreenElement = useRef<HTMLCanvasElement>();
  const hostRectangle = useRef<DOMRect>();
  const screenRectangle = useRef<DOMRect>();

  // --- State variables
  const [canvasWidth, setCanvasWidth] = useState(0);
  const [canvasHeight, setCanvasHeight] = useState(0);
  const shadowCanvasWidth = useRef(0);
  const shadowCanvasHeight = useRef(0);
  const xRatio = useRef(1);
  const yRatio = useRef(1);
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const audioSampleRate = useSelector((s) => s.emulatorState?.audioSampleRate);
  const fastLoad = useGlobalSetting(SETTING_EMU_FAST_LOAD);
  const scanlineEffect = useGlobalSetting(SETTING_EMU_SCANLINE_EFFECT);
  const dialogToDisplay = useSelector((s) => s.ideView?.dialogToDisplay);
  const showInstantScreen = useGlobalSetting(SETTING_EMU_SHOW_INSTANT_SCREEN);
  const emuViewVersion = useSelector((s) => s.emulatorState?.emuViewVersion);
  const [overlay, setOverlay] = useState(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const keyMappings = useSelector((s) => s.keyMappings);
  const defaultKeyMappings = useRef<KeyMapping>();
  const currentKeyMappings = useRef<KeyMapping>();
  const keyCodeSet = useRef<KeyCodeSet>();

  // --- Variables for display management
  const imageBuffer = useRef<ArrayBuffer>();
  const imageBuffer8 = useRef<Uint8Array>();
  const pixelData = useRef<Uint32Array>();
  const currentScanlineEffect = useRef<string>("off");

  // --- Variables for key management
  const pressedKeys = useRef<Record<string, boolean>>({});
  const _handleKeyDown = (e: KeyboardEvent) => {
    handleKey(e, currentKeyMappings.current, currentDialogId, true);
  };
  const _handleKeyUp = (e: KeyboardEvent) => {
    handleKey(e, currentKeyMappings.current, currentDialogId, false);
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

  // --- Sets the overlay for paused mode
  const setPauseOverlay = () => {
    const showInstantScreen = getGlobalSetting(store, SETTING_EMU_SHOW_INSTANT_SCREEN);
    setOverlay(
      `Paused (PC: $${toHexa4(controller.machine.pc)})${showInstantScreen ? " - Instant screen" : ""}`
    );
  };

  useEffect(() => {
    console.log("Scanline effect changed to:", scanlineEffect);
  }, [scanlineEffect]);

  // --- Prepare the key mappings
  useEffect(() => {
    updateKeyMappings();
  }, [keyMappings]);

  // --- Let the key handler know about the current dialog
  useEffect(() => {
    currentDialogId = dialogToDisplay ?? 0;
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
    shadowCanvasWidth.current = controller?.machine?.screenWidthInPixels;
    shadowCanvasHeight.current = controller?.machine?.screenHeightInPixels;
    if (controller?.machine?.getAspectRatio) {
      const [ratX, ratY] = controller?.machine?.getAspectRatio();
      xRatio.current = ratX ?? 1;
      yRatio.current = ratY ?? 1;
    } else {
      xRatio.current = 1;
      yRatio.current = 1;
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
        const shadow = renderInstantScreen();
        if (!savedPixelBuffer) {
          savedPixelBuffer = new Uint32Array(shadow);
        }
        displayScreenData();
      }
    } else {
      if (machineState === MachineControllerState.Paused) {
        setPauseOverlay();
        renderInstantScreen(savedPixelBuffer);
        displayScreenData();
      }
    }
  }, [showInstantScreen]);

  // --- Respond to scanline effect setting changes
  useEffect(() => {
    currentScanlineEffect.current = scanlineEffect as string;
    displayScreenData();
  }, [scanlineEffect]);

  // --- Respond to resizing the main container
  useResizeObserver(hostElement, () => {
    calculateDimensions();
    displayScreenData();
  });

  useEffect(() => {
    const showInstantScreen = getGlobalSetting(store, SETTING_EMU_SHOW_INSTANT_SCREEN);
    if (showInstantScreen) {
      renderInstantScreen();
      displayScreenData();
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
        <canvas ref={screenElement} width={canvasWidth} height={canvasHeight} />
        <canvas
          ref={shadowScreenElement}
          style={{ display: "none" }}
          width={shadowCanvasWidth.current}
          height={shadowCanvasHeight.current}
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
    machineStateHandlerQueue.push(stateInfo);
    if (machineStateProcessing) return;
    machineStateProcessing = true;
    try {
      while (machineStateHandlerQueue.length > 0) {
        const toProcess = machineStateHandlerQueue.shift();
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
              const shadow = renderInstantScreen();
              if (!savedPixelBuffer) {
                savedPixelBuffer = new Uint32Array(shadow);
              }
              displayScreenData();
            }
            break;

          case MachineControllerState.Stopped:
            savedPixelBuffer = null;
            setOverlay(`Stopped (PC: $${toHexa4(controller.machine.pc)})`);
            await beeperRenderer?.current?.suspend();
            machineStateHandlerQueue.length = 0;
            break;

          default:
            setOverlay("");
            break;
        }
      }
    } finally {
      machineStateProcessing = false;
    }
  }

  // --- Handles machine frame completion events
  async function machineFrameCompleted(args: FrameCompletedArgs): Promise<void> {
    // --- Update the screen
    if (controller.machine.frames % controller.machine.uiFrameFrequency === 0) {
      displayScreenData();
    }

    if (args.fullFrame) {
      savedPixelBuffer = renderInstantScreen();
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
    const width = shadowCanvasWidth.current ?? 1;
    const height = shadowCanvasHeight.current ?? 1;
    let widthRatio = Math.floor((1 * (clientWidth - 8)) / width) / 1 / xRatio.current;
    if (widthRatio < 1) widthRatio = 1;
    let heightRatio = Math.floor((1 * (clientHeight - 8)) / height) / 1 / yRatio.current;
    if (heightRatio < 1) heightRatio = 1;
    const ratio = Math.min(widthRatio, heightRatio);
    setCanvasWidth(width * ratio * xRatio.current);
    setCanvasHeight(height * ratio * yRatio.current);
    if (shadowScreenElement.current) {
      shadowScreenElement.current.width = width;
      shadowScreenElement.current.height = height;
    }
  }

  // --- Setup the screen buffers
  function configureScreen(): void {
    const dataLen = (shadowCanvasWidth.current ?? 0) * (shadowCanvasHeight.current ?? 0) * 4;
    imageBuffer.current = new ArrayBuffer(dataLen);
    imageBuffer8.current = new Uint8Array(imageBuffer.current);
    pixelData.current = new Uint32Array(imageBuffer.current);
  }

  // --- Applies scanline effect based on zoom factor and intensity setting
  function applyScanlineEffect(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    sourceCanvas: HTMLCanvasElement,
    scanlineIntensity: string = "off"
  ): void {
    const sourceHeight = sourceCanvas.height;
    const targetWidth = canvas.width;
    const targetHeight = canvas.height;

    // Determine scanline darkening intensity from setting
    let scanlineDarkening = 0.0; // Default: off (0% darkening)
    switch (scanlineIntensity) {
      case "50%":
        scanlineDarkening = 0.75;
        break;
      case "25%":
        scanlineDarkening = 0.5;
        break;
      case "12.5%":
        scanlineDarkening = 0.25;
        break;
      case "off":
      default:
        scanlineDarkening = 0.0;
    }

    // If scanline effect is off, just draw the image
    if (scanlineDarkening === 0.0) {
      ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);
      return;
    }

    // Calculate zoom factor (approximate)
    const zoomFactorY = targetHeight / sourceHeight;

    // Draw source image normally first
    ctx.drawImage(sourceCanvas, 0, 0, targetWidth, targetHeight);

    // Get image data to apply scanline effect
    const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
    const data = imageData.data;

    // Apply scanline effect based on zoom factor
    for (let bufferLineIdx = 0; bufferLineIdx < sourceHeight; bufferLineIdx++) {
      const startCanvasLine = Math.floor(bufferLineIdx * zoomFactorY);
      const endCanvasLine = Math.floor((bufferLineIdx + 1) * zoomFactorY);
      const numCanvasLines = endCanvasLine - startCanvasLine;

      for (
        let canvasLineInBuffer = 0;
        canvasLineInBuffer < numCanvasLines;
        canvasLineInBuffer++
      ) {
        const canvasLineIdx = startCanvasLine + canvasLineInBuffer;
        let opacity = 1.0; // Default: no scanline effect

        // Determine opacity based on position within the buffer line
        if (numCanvasLines === 1) {
          // Single line per buffer line - no effect
          opacity = 1.0;
        } else if (numCanvasLines === 2) {
          // Zoom 2: First normal, second with scanline darkening
          opacity = canvasLineInBuffer === 0 ? 1.0 : 1.0 - scanlineDarkening;
        } else if (numCanvasLines === 3) {
          // Zoom 3: First normal, second antialiasing, third scanline
          if (canvasLineInBuffer === 0) {
            opacity = 1.0; // First line: normal
          } else if (canvasLineInBuffer === 1) {
            opacity = 1.0 - scanlineDarkening * 0.5; // Second line: half scanline darkening
          } else {
            opacity = 1.0 - scanlineDarkening; // Third line: full scanline effect
          }
        } else if (numCanvasLines >= 4) {
          // Zoom 4+: Pattern - normal, antialiasing (multiple), scanline
          // First line is always normal, last line is scanline, middle are antialiasing
          if (canvasLineInBuffer === 0) {
            opacity = 1.0; // First line: normal
          } else if (canvasLineInBuffer === numCanvasLines - 1) {
            opacity = 1.0 - scanlineDarkening; // Last line: scanline effect
          } else {
            // Middle lines: gradient antialiasing from 1.0 to (1.0 - scanlineDarkening)
            const middleCount = numCanvasLines - 2;
            const middleIdx = canvasLineInBuffer - 1;
            opacity = 1.0 - (scanlineDarkening * middleIdx) / middleCount;
          }
        }

        // Apply opacity to this line
        if (opacity < 1.0) {
          const lineStartIdx = canvasLineIdx * targetWidth * 4;
          const lineEndIdx = lineStartIdx + targetWidth * 4;
          for (let pixelIdx = lineStartIdx; pixelIdx < lineEndIdx; pixelIdx += 4) {
            // Apply opacity by reducing alpha channel
            data[pixelIdx + 3] = Math.round(data[pixelIdx + 3] * opacity);
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  }

  // --- Displays the screen
  function displayScreenData(): void {
    if (!pixelData.current) {
      return;
    }
    const screenEl = screenElement.current;
    const shadowScreenEl = shadowScreenElement.current;
    if (!screenEl || !shadowScreenEl) {
      return;
    }

    const shadowCtx = shadowScreenEl.getContext("2d", {
      willReadFrequently: true
    });
    if (!shadowCtx) {
      return;}

    shadowCtx.imageSmoothingEnabled = false;
    const shadowImageData = shadowCtx.getImageData(
      0,
      0,
      shadowScreenEl.width,
      shadowScreenEl.height
    );

    const screenCtx = screenEl.getContext("2d", {
      willReadFrequently: true
    });
    let j = 0;

    const screenData = controller?.machine?.getPixelBuffer();
    if (!screenData) {
      return;
    }
    const startIndex = controller?.machine?.getBufferStartOffset() ?? 0;
    const endIndex = shadowScreenEl.width * shadowScreenEl.height + startIndex;
    for (let i = startIndex; i < endIndex; i++) {
      pixelData.current[j++] = screenData[i];
    }
    shadowImageData.data.set(imageBuffer8.current);
    shadowCtx.putImageData(shadowImageData, 0, 0);
    if (screenCtx) {
      screenCtx.imageSmoothingEnabled = false;
      applyScanlineEffect(screenCtx, screenEl, shadowScreenEl, currentScanlineEffect.current);
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
