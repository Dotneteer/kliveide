import styles from "./EmulatorPanel.module.scss";
import { useController } from "@/core/useController";
import { spectrumKeyMappings } from "@/emu/abstractions/keymappings";
import { SpectrumKeyCode } from "@/emu/abstractions/SpectrumKeyCode";
import { useSelector, useStore } from "@/core/StoreProvider";
import { useResizeObserver } from "@/core/useResizeObserver";
import { MachineControllerState } from "@state/MachineControllerState";
import { useEffect, useRef, useState } from "react";
import { ExecutionStateOverlay } from "./ExecutionStateOverlay";
import { AudioRenderer } from "./AudioRenderer";
import { IZxSpectrumMachine } from "@/emu/abstractions/IZxSpectrumMachine";
import { FAST_LOAD } from "@/emu/machines/machine-props";

export const EmulatorPanel = () => {
    // --- Access screen information
    const store = useStore();
    const controller = useController();
    const controllerRef = useRef(controller);

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
    const machineState = useSelector(s => s.ideView?.machineState);
    const audioSampleRate = useSelector(s => s.ideView?.audioSampleRate);
    const fastLoad = useSelector(s => s.ideView?.fastLoad);
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
    }
    const _handleKeyUp = (e: KeyboardEvent) => {
        handleKey(e, false);
    }

    // --- Variables for audio management
    const beeperRenderer = useRef<AudioRenderer>();

    // --- Set up keyboard handling
    useEffect(() => {
        // --- Take care that keys reach the engine
        window.addEventListener("keydown", _handleKeyDown);
        window.addEventListener("keyup", _handleKeyUp);

        return () => {
            window.removeEventListener("keydown", _handleKeyDown);
            window.removeEventListener("keyup", _handleKeyUp);
        }
    }, [hostElement.current])

    // --- Reflect controller changes
    useEffect(() => {
        // --- We pass the controller instance to the window key handler;
        controllerRef.current = controller;

        // --- Set up the controller to repfresh the screen
        if (controller) {
            // --- Respond to machine frame completion
            controller.frameCompleted.on((completed) => {
                displayScreenData();
                if (completed && beeperRenderer.current) {
                    const zxSpectrum = controller.machine as IZxSpectrumMachine;
                    if (zxSpectrum?.beeperDevice) {
                        const samples = zxSpectrum.beeperDevice.getAudioSamples();
                        const soundLevel = store.getState()?.ideView?.soundLevel ?? 0.0;
                        beeperRenderer.current.storeSamples(samples.map(s => s * soundLevel));
                    }
                }
            })

            // --- Prepare audio
            if (audioSampleRate) {
                const samplesPerFrame = controller.machine.tactsInFrame * audioSampleRate / 
                    controller.machine.baseClockFrequency / controller.machine.clockMultiplier;
                beeperRenderer.current = new AudioRenderer(samplesPerFrame);
            }
        }
    }, [controller]);

    // --- Respond to screen dimension changes
    useEffect(() => {
        shadowCanvasWidth.current = controller?.machine?.screenWidthInPixels;
        shadowCanvasHeight.current = controller?.machine?.screenHeightInPixels;
        configureScreen();
        calculateDimensions();
    }, 
    [
        controller?.machine?.screenWidthInPixels, 
        controller?.machine?.screenHeightInPixels
    ]);

    // --- Respond to execution state changes
    useEffect(() => {
        let overlay = "";
        switch (machineState) {
          case MachineControllerState.None:
            overlay =
              "Not yet started. Press F5 to start or Ctrl+F5 to debug machine.";
            break;

          case MachineControllerState.Running:
            overlay = controller?.isDebugging ? "Debug mode" : "";
            beeperRenderer?.current?.play();
            break;

          case MachineControllerState.Paused:
            overlay = "Paused";
            beeperRenderer?.current?.pause();
            break;

          case MachineControllerState.Stopped:
            overlay = "Stopped";
            beeperRenderer?.current?.closeAudio();
            break;

          default:
            overlay = "";
            break;
        }
        setOverlay(overlay);
    }, [machineState])

    // --- Respond to the FAST LOAD flag changes
    useEffect(() => {
        controller?.machine?.setMachineProperty(FAST_LOAD, fastLoad);
    }, [fastLoad])

    // --- Respond to resizing the main container
    useResizeObserver(hostElement, () => calculateDimensions());

    return (
        <div 
            className={styles.component} 
            ref={hostElement} 
            tabIndex={-1}>
                <div
                    style={{
                        width: `${canvasWidth ?? 0}px`,
                        height: `${canvasHeight ?? 0}px`,
                        backgroundColor: "#404040",
                    }}
                    onClick={() => setShowOverlay(true)} >
                    {showOverlay && (
                        <ExecutionStateOverlay
                            text={overlay}
                            clicked={() => {
                            setShowOverlay(false);
                            }} />
                    )}
                    <canvas ref={screenElement} width={canvasWidth} height={canvasHeight} />
                    <canvas
                        ref={shadowScreenElement}
                        style={{ display: "none" }}
                        width={shadowCanvasWidth.current}
                        height={shadowCanvasHeight.current} />
                </div>
            </div>
    );

    // --- Calculate the dimensions so that the virtual machine display fits the screen
    function calculateDimensions(): void {
        if (
            !hostElement?.current ||
            !screenElement?.current
        ) {
            return;
        }
        
        hostRectangle.current = hostElement.current.getBoundingClientRect();
        screenRectangle.current = screenElement.current.getBoundingClientRect();
        const clientWidth = hostElement.current.offsetWidth;
        const clientHeight = hostElement.current.offsetHeight;
        if (shadowCanvasWidth === undefined || shadowCanvasHeight === undefined) {
            console.log("undef canvas size");
        }
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
    function configureScreen(): void {
        const dataLen = (shadowCanvasWidth.current ?? 0) * 
            (shadowCanvasHeight.current ?? 0) * 4;
        imageBuffer.current = new ArrayBuffer(dataLen);
        imageBuffer8.current = new Uint8Array(imageBuffer.current);
        pixelData.current = new Uint32Array(imageBuffer.current);
    }

    // --- Displays the screen
    function displayScreenData(): void {
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
            shadowScreenEl.height,
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
            screenCtx.drawImage(shadowScreenEl, 0, 0, screenEl.width, screenEl.height);
        }
    }

    function handleKey(e: KeyboardEvent, isDown: boolean): void {
        if (!e || controllerRef.current?.state !== MachineControllerState.Running) return;
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
    
    function handleMappedKey(code: string, isDown: boolean): void {
        const mapping = spectrumKeyMappings[code];
        if (!mapping) return;
        const machine = controllerRef.current?.machine;
        if (typeof mapping === "string") {
            machine?.setKeyStatus(SpectrumKeyCode[mapping], isDown);
        } else {
            if (mapping.length > 0) {
                machine?.setKeyStatus(SpectrumKeyCode[mapping[0]], isDown);
            }
            if (mapping.length > 1) {
                machine?.setKeyStatus(SpectrumKeyCode[mapping[1]], isDown);
            }
        }
    }
}
