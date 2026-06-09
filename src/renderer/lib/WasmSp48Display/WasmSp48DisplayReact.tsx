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

export const WasmSp48DisplayReact = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<Sp48FakeMachineController | null>(null);
  const lastCommandSequenceRef = useRef(0);
  const renderInstantScreenRef = useRef<(() => void) | null>(null);
  const [error, setError] = useState<string>();
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
    const pressedKeys = new Map<string, number>();

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

        const handleKeyDown = (event: KeyboardEvent) => {
          if (pressedKeys.has(event.code)) {
            return;
          }
          const key = getSkeletonKeyIndex(event.code);
          pressedKeys.set(event.code, key);
          controller.setKeyStatus(key, true);
        };

        const handleKeyUp = (event: KeyboardEvent) => {
          const key = pressedKeys.get(event.code);
          if (key === undefined) {
            return;
          }
          pressedKeys.delete(event.code);
          controller.setKeyStatus(key, false);
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

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
      {error ? <div className={styles.error}>{error}</div> : null}
    </div>
  );
};

function getSkeletonKeyIndex(code: string): number {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = (hash * 33 + code.charCodeAt(i)) & 0xff;
  }
  return hash & 0x3f;
}
