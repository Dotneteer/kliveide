import { useEffect, useRef, useState } from "react";
import styles from "../WasmBitmapDisplay/WasmBitmapDisplay.module.scss";
import {
  Sp48FakeMachineController,
  type Sp48FrameCompletedEvent,
  type Sp48MachineCommand
} from "../../../emu/sp48/Sp48FakeMachineController";
import { loadWasmZxSpectrum48Machine } from "../../../emu/sp48/WasmZxSpectrum48Machine";
import { MachineControllerState } from "../../../common/abstractions/MachineControllerState";
import { setMachineStateAction, setSp48FrameInfoAction } from "../../../common/state/actions";
import { readBinaryFile, useDispatch, useSharedState } from "../../shared-store";
import {
  SP48_KEY_EVENT,
  dispatchSp48KeyStatus,
  mapPhysicalKeyToSp48Keys,
  type Sp48KeyEventDetail
} from "../../../emu/sp48/sp48-keyboard";

type KeyboardIndicator = {
  lines: number[];
  portFe: number;
  lastKey?: Sp48KeyEventDetail;
};

export const WasmSp48DisplayReact = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<Sp48FakeMachineController | null>(null);
  const lastCommandSequenceRef = useRef(0);
  const renderInstantScreenRef = useRef<(() => void) | null>(null);
  const [error, setError] = useState<string>();
  const [keyboardIndicator, setKeyboardIndicator] = useState<KeyboardIndicator>({
    lines: Array(8).fill(0),
    portFe: 0xff
  });
  const sharedState = useSharedState();
  const dispatch = useDispatch();
  const commandSequence = sharedState.emulatorState?.machineCommandSequence ?? 0;
  const lastMachineCommand = sharedState.emulatorState?.lastMachineCommand as Sp48MachineCommand | undefined;

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller || !lastMachineCommand || commandSequence === lastCommandSequenceRef.current) {
      return;
    }

    lastCommandSequenceRef.current = commandSequence;
    const machineState = controller.issueMachineCommand(lastMachineCommand);
    dispatch(setMachineStateAction(machineState, 0));
    renderInstantScreenRef.current?.();
  }, [commandSequence, dispatch, lastMachineCommand]);

  useEffect(() => {
    let disposed = false;
    let animationFrame = 0;
    const pressedPhysicalKeys = new Map<string, number[]>();

    async function run() {
      try {
        const machine = await loadWasmZxSpectrum48Machine();
        await machine.setup(readBinaryFile);
        machine.hardReset();
        machine.setAudioSampleRate(44_100);
        const controller = new Sp48FakeMachineController(machine);
        controllerRef.current = controller;

        if (disposed) {
          controller.release();
          return;
        }

        const canvas = canvasRef.current;
        const context = canvas?.getContext("2d");
        if (!canvas || !context) {
          return;
        }

        canvas.width = machine.screenWidthInPixels;
        canvas.height = machine.screenHeightInPixels;
        context.imageSmoothingEnabled = false;

        const updateKeyboardIndicator = (lastKey?: Sp48KeyEventDetail) => {
          setKeyboardIndicator({
            lines: Array.from(machine.getKeyboardLines()),
            portFe: machine.readPort(0x00fe),
            lastKey
          });
        };

        const setSp48KeyStatus = (key: number, down: boolean, source: Sp48KeyEventDetail["source"]) => {
          controller.setKeyStatus(key, down);
          updateKeyboardIndicator({ key, down, source });
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
          setSp48KeyStatus(detail.key, detail.down, detail.source);
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        window.addEventListener(SP48_KEY_EVENT, handleVirtualKey);

        const publishFrameCompleted = (event?: Sp48FrameCompletedEvent) => {
          if (!event) {
            return;
          }
          dispatch(setSp48FrameInfoAction({
            frames: event.frames,
            tacts: event.tacts,
            audioSampleCount: event.audioSampleCount
          }));
        };

        controller.frameCompleted.on(publishFrameCompleted);

        const paintStoppedScreen = () => {
          context.fillStyle = "#303030";
          context.fillRect(0, 0, machine.screenWidthInPixels, machine.screenHeightInPixels);
        };

        const paintPixels = () => {
          if (controller.machineState === MachineControllerState.Stopped) {
            paintStoppedScreen();
            return;
          }

          const pixels = machine.getPixelBufferBytes();
          const imagePixels = new Uint8ClampedArray(pixels.byteLength);
          imagePixels.set(pixels);
          context.putImageData(new ImageData(imagePixels, machine.screenWidthInPixels, machine.screenHeightInPixels), 0, 0);
        };

        renderInstantScreenRef.current = paintPixels;
        updateKeyboardIndicator();
        paintPixels();

        const render = () => {
          if (disposed) {
            return;
          }

          if (controller.tickFrame()) {
            paintPixels();
          }
          animationFrame = requestAnimationFrame(render);
        };

        animationFrame = requestAnimationFrame(render);

        return () => {
          window.removeEventListener("keydown", handleKeyDown);
          window.removeEventListener("keyup", handleKeyUp);
          window.removeEventListener(SP48_KEY_EVENT, handleVirtualKey);
          controller.frameCompleted.off(publishFrameCompleted);
          controller.release();
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
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  return (
    <div className={styles.host}>
      <canvas ref={canvasRef} className={styles.canvas} />
      <div className={styles.keyboardMatrix}>
        <span>KB</span>
        <span>{keyboardIndicator.lines.map(toHexByte).join(" ")}</span>
        <span>FE {toHexByte(keyboardIndicator.portFe)}</span>
        {keyboardIndicator.lastKey ? (
          <span>
            {keyboardIndicator.lastKey.down ? "DOWN" : "UP"} {keyboardIndicator.lastKey.key}
          </span>
        ) : null}
      </div>
      {error ? <div className={styles.error}>{error}</div> : null}
    </div>
  );
};

function toHexByte(value: number): string {
  return (value & 0xff).toString(16).padStart(2, "0").toUpperCase();
}
