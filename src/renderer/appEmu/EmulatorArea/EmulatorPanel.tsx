import styles from "./EmulatorPanel.module.scss";
import { useMachineController } from "@renderer/core/useMachineController";
import { SpectrumKeyCode } from "@renderer/abstractions/SpectrumKeyCode";
import {
  useRendererContext,
  useSelector,
  useStore
} from "@renderer/core/RendererProvider";
import { useResizeObserver } from "@renderer/core/useResizeObserver";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useEffect, useRef, useState } from "react";
import { ExecutionStateOverlay } from "./ExecutionStateOverlay";
import {
  AudioRenderer,
  getBeeperContext,
  releaseBeeperContext
} from "./AudioRenderer";
import { IZxSpectrumMachine } from "@renderer/abstractions/IZxSpectrumMachine";
import { FAST_LOAD } from "@emu/machines/machine-props";
import { MachineController } from "@emu/machines/MachineController";
import { spectrumKeyMappings } from "./key-mappings";
import {
  FrameCompletedArgs,
  IMachineController
} from "../../abstractions/IMachineController";
import { reportMessagingError } from "@renderer/reportError";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";

let machineStateHandlerQueue: {
  oldState: MachineControllerState;
  newState: MachineControllerState;
}[] = [];
let machineStateProcessing = false;

export const EmulatorPanel = () => {
  // --- Access state information
  const store = useStore();

  // --- Use application services
  const { messenger } = useRendererContext();

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
  const audioSampleRate = useSelector(s => s.emulatorState?.audioSampleRate);
  const fastLoad = useSelector(s => s.emulatorState?.fastLoad);
  const [overlay, setOverlay] = useState(null);
  const [showOverlay, setShowOverlay] = useState(true);

  // --- Variables for display management
  const imageBuffer = useRef<ArrayBuffer>();
  const imageBuffer8 = useRef<Uint8Array>();
  const pixelData = useRef<Uint32Array>();

  // --- Variables for key management
  const pressedKeys = useRef<Record<string, boolean>>({});
  const _handleKeyDown = (e: KeyboardEvent) => {
    handleKey(e, true);
  };
  const _handleKeyUp = (e: KeyboardEvent) => {
    handleKey(e, false);
  };

  // --- Variables for audio management
  const beeperRenderer = useRef<AudioRenderer>();

  // --- Prepare the machine controller with event handlers
  const controller = useMachineController(
    machineControllerChanged,
    machineStateChanged,
    machineFrameCompleted
  );
  const controllerRef = useRef<IMachineController>(controller);

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
  useEffect(() => {
    shadowCanvasWidth.current = controller?.machine?.screenWidthInPixels;
    shadowCanvasHeight.current = controller?.machine?.screenHeightInPixels;
    configureScreen();
    calculateDimensions();
  }, [
    controller?.machine?.screenWidthInPixels,
    controller?.machine?.screenHeightInPixels
  ]);

  // --- Respond to the FAST LOAD flag changes
  useEffect(() => {
    controller?.machine?.setMachineProperty(FAST_LOAD, fastLoad);
  }, [fastLoad]);

  // --- Respond to resizing the main container
  useResizeObserver(hostElement, () => calculateDimensions());

  return (
    <div className={styles.emulatorPanel} ref={hostElement} tabIndex={-1}>
      <div
        style={{
          width: `${canvasWidth ?? 0}px`,
          height: `${canvasHeight ?? 0}px`,
          backgroundColor: "#404040"
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
      </div>
    </div>
  );

  // --- Handles machine controller changes
  async function machineControllerChanged (
    ctrl: MachineController
  ): Promise<void> {
    // --- Let's store a ref
    controllerRef.current = controller;
    if (!controller) return;

    // --- Initial overlay message
    setOverlay(
      "Not yet started. Press F5 to start or Ctrl+F5 to debug machine."
    );

    // --- Prepare audio
    if (audioSampleRate) {
      const samplesPerFrame =
        (controller.machine.tactsInFrame * audioSampleRate) /
        controller.machine.baseClockFrequency /
        controller.machine.clockMultiplier;
      await releaseBeeperContext();
      beeperRenderer.current = new AudioRenderer(
        await getBeeperContext(samplesPerFrame)
      );
    }
  }

  // --- Handles machine state changes
  async function machineStateChanged (stateInfo: {
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
            setOverlay(`Paused (PC: $${toHexa4(controller.machine.pc)})`);
            await beeperRenderer?.current?.suspend();
            break;

          case MachineControllerState.Stopped:
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
  async function machineFrameCompleted (
    args: FrameCompletedArgs
  ): Promise<void> {
    // --- Update the screen
    displayScreenData();

    // --- Stop sound rendering when fast load has been invoked
    // --- Do we need to render sound samples?
    if (args.fullFrame && beeperRenderer.current) {
      const zxSpectrum = controller.machine as IZxSpectrumMachine;
      if (zxSpectrum?.beeperDevice) {
        const samples = zxSpectrum.getAudioSamples();
        const soundLevel = store.getState()?.emulatorState?.soundLevel ?? 0.0;
        beeperRenderer.current.storeSamples(samples.map(s => s * soundLevel));
        await beeperRenderer.current.play();
      }
    }

    // --- There's a saved file, store it
    if (args.savedFileInfo) {
      (async () => {
        const response = await messenger.sendMessage({
          type: "MainSaveBinaryFile",
          path: args.savedFileInfo.name,
          data: args.savedFileInfo.contents
        });
        if (response.type === "ErrorResponse") {
          reportMessagingError(
            `File saved with the SAVE ZX Spectrum command failed: ${response.message}.`
          );
        }
      })();
    }
  }

  // --- Calculate the dimensions so that the virtual machine display fits the screen
  function calculateDimensions (): void {
    if (!hostElement?.current || !screenElement?.current) {
      return;
    }

    hostRectangle.current = hostElement.current.getBoundingClientRect();
    screenRectangle.current = screenElement.current.getBoundingClientRect();
    const clientWidth = hostElement.current.offsetWidth;
    const clientHeight = hostElement.current.offsetHeight;
    const width = shadowCanvasWidth.current ?? 1;
    const height = shadowCanvasHeight.current ?? 1;
    let widthRatio = Math.floor((clientWidth - 8) / width);
    if (widthRatio < 1) widthRatio = 1;
    let heightRatio = Math.floor((clientHeight - 8) / height);
    if (heightRatio < 1) heightRatio = 1;
    const ratio = Math.min(widthRatio, heightRatio);
    setCanvasWidth(width * ratio);
    setCanvasHeight(height * ratio);
    if (shadowScreenElement.current) {
      shadowScreenElement.current.width = width;
      shadowScreenElement.current.height = height;
    }
  }

  // --- Setup the screen buffers
  function configureScreen (): void {
    const dataLen =
      (shadowCanvasWidth.current ?? 0) * (shadowCanvasHeight.current ?? 0) * 4;
    imageBuffer.current = new ArrayBuffer(dataLen);
    imageBuffer8.current = new Uint8Array(imageBuffer.current);
    pixelData.current = new Uint32Array(imageBuffer.current);
  }

  // --- Displays the screen
  function displayScreenData (): void {
    const screenEl = screenElement.current;
    const shadowScreenEl = shadowScreenElement.current;
    if (!screenEl || !shadowScreenEl) {
      return;
    }

    const shadowCtx = shadowScreenEl.getContext("2d", {
      willReadFrequently: true
    });
    if (!shadowCtx) return;

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
    const startIndex = shadowScreenEl.width;
    const endIndex = shadowScreenEl.width * shadowScreenEl.height + startIndex;
    for (let i = startIndex; i < endIndex; i++) {
      pixelData.current[j++] = screenData[i];
    }
    shadowImageData.data.set(imageBuffer8.current);
    shadowCtx.putImageData(shadowImageData, 0, 0);
    if (screenCtx) {
      screenCtx.imageSmoothingEnabled = false;
      screenCtx.drawImage(
        shadowScreenEl,
        0,
        0,
        screenEl.width,
        screenEl.height
      );
    }
  }

  // --- Hanldles key events
  function handleKey (e: KeyboardEvent, isDown: boolean): void {
    if (!e || controllerRef.current?.state !== MachineControllerState.Running)
      return;
    // --- Special key: both Shift released
    if (
      (e.code === "ShiftLeft" || e.code === "ShiftRight") &&
      e.shiftKey === false &&
      !isDown
    ) {
      handleMappedKey("ShiftLeft", false);
      handleMappedKey("ShiftRight", false);
    } else {
      handleMappedKey(e.code, isDown);
    }
    if (isDown) {
      pressedKeys.current[e.code.toString()] = true;
    } else {
      delete pressedKeys.current[e.code.toString()];
    }
  }

  // --- Maps physical keys to ZX Spectrum keys
  function handleMappedKey (code: string, isDown: boolean): void {
    const mapping = spectrumKeyMappings[code];
    if (!mapping) return;
    const machine = controllerRef.current?.machine;
    if (typeof mapping === "string") {
      machine?.setKeyStatus(SpectrumKeyCode[mapping], isDown);
    } else {
      if (mapping.length > 0) {
        machine?.setKeyStatus(
          SpectrumKeyCode[mapping[0]] as unknown as SpectrumKeyCode,
          isDown
        );
      }
      if (mapping.length > 1) {
        machine?.setKeyStatus(
          SpectrumKeyCode[mapping[1]] as unknown as SpectrumKeyCode,
          isDown
        );
      }
    }
  }
};
