import { useEffect, useRef, useState } from "react";
import { MachineControllerState } from "../../../common/abstractions/MachineControllerState";
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

type MachineDiagnostics = {
  lines: number[];
  portFe: number;
  portFeOut: number;
  border: number;
  ear: boolean;
  mic: boolean;
  beeperLevel: number;
  frameTact: number;
  nextFrameStartTact: number;
  frameCompleted: boolean;
  interruptsRaised: number;
  interruptLineActive: boolean;
  renderingPhase: number;
  contention: number;
  contentionDelay: number;
  cpuPc: number;
  cpuAf: number;
  cpuInstructions: number;
  cpuFrameSliceInstructions: number;
  lastKey?: Sp48KeyEventDetail;
};

const initialDiagnostics: MachineDiagnostics = {
  lines: Array(8).fill(0),
  portFe: 0xff,
  portFeOut: 0,
  border: 7,
  ear: false,
  mic: false,
  beeperLevel: 0,
  frameTact: 0,
  nextFrameStartTact: 0,
  frameCompleted: false,
  interruptsRaised: 0,
  interruptLineActive: false,
  renderingPhase: 0,
  contention: 0,
  contentionDelay: 0,
  cpuPc: 0,
  cpuAf: 0xffff,
  cpuInstructions: 0,
  cpuFrameSliceInstructions: 0
};

export const EmulatorPanelReact = () => {
  const hostElement = useRef<HTMLDivElement | null>(null);
  const controllerRef = useRef<Sp48MachineController | null>(null);
  const lastCommandSequenceRef = useRef(0);
  const renderInstantScreenRef = useRef<(() => void) | null>(null);
  const [overlay, setOverlay] = useState<string | null>("Loading machine...");
  const [showOverlay, setShowOverlay] = useState(true);
  const [error, setError] = useState<string>();
  const [diagnostics, setDiagnostics] = useState<MachineDiagnostics>(initialDiagnostics);
  const sharedState = useSharedState();
  const dispatch = useDispatch();
  const commandSequence = sharedState.emulatorState?.machineCommandSequence ?? 0;
  const lastMachineCommand = sharedState.emulatorState?.lastMachineCommand as Sp48MachineCommand | undefined;
  const soundLevel = sharedState.emulatorState?.soundLevel ?? 0.8;
  const soundLevelRef = useRef(soundLevel);
  const { beeperRenderer, initAudio } = useEmulatorAudio();

  const {
    screenElement,
    canvasWidth,
    canvasHeight,
    nativeCanvasWidth,
    nativeCanvasHeight,
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
    updateDiagnostics();
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
        const controller = await createSp48MachineController(readBinaryFile);
        const { machine } = controller;
        const audioSampleRate = await initAudio(machine.tactsInFrame, machine.baseClockFrequency);
        machine.setAudioSampleRate(audioSampleRate);
        controllerRef.current = controller;

        if (disposed) {
          controller.release();
          return;
        }

        updateScreenDimensions();
        updateDiagnostics();
        displayScreenData();
        setOverlay("Not yet started. Press F5 to start machine.");

        const setSp48KeyStatus = (
          key: number,
          down: boolean,
          source: Sp48KeyEventDetail["source"]
        ) => {
          controller.setKeyStatus(key, down);
          updateDiagnostics({ key, down, source });
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
            updateDiagnostics();
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
      window.clearTimeout(machineLoopTimer);
    };
  }, []);

  function paintPixels(): void {
    const controller = controllerRef.current;
    if (!controller) {
      return;
    }

    if (controller.machineState === MachineControllerState.Stopped) {
      paintStoppedScreen();
    } else {
      displayScreenData();
    }
  }

  function updateDiagnostics(lastKey?: Sp48KeyEventDetail): void {
    const machine = controllerRef.current?.machine;
    if (!machine) {
      return;
    }

    const frameTact = machine.getCurrentFrameTact();
    setDiagnostics({
      lines: Array.from(machine.getKeyboardLines()),
      portFe: machine.readPort(0x00fe),
      portFeOut: machine.getPortFeValue(),
      border: machine.getBorderColor(),
      ear: machine.getEarBit(),
      mic: machine.getMicBit(),
      beeperLevel: machine.getBeeperLevel(),
      frameTact,
      nextFrameStartTact: machine.getNextFrameStartTact(),
      frameCompleted: machine.getFrameCompleted(),
      interruptsRaised: machine.getInterruptsRaised(),
      interruptLineActive: machine.getInterruptLineActive(),
      renderingPhase: machine.getRenderingPhase(frameTact),
      contention: machine.getContentionValue(frameTact),
      contentionDelay: machine.getTotalContentionDelaySinceStart(),
      cpuPc: machine.getCpuPc(),
      cpuAf: machine.getCpuAf(),
      cpuInstructions: machine.getCpuInstructionsExecuted(),
      cpuFrameSliceInstructions: machine.getCpuFrameSliceInstructions(),
      lastKey
    });
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
          width={nativeCanvasWidth}
          height={nativeCanvasHeight}
          style={{ width: `${canvasWidth}px`, height: `${canvasHeight}px` }}
        />
        <div className={styles.diagnostics}>
          <span>KB</span>
          <span>{diagnostics.lines.map(toHexByte).join(" ")}</span>
          <span>IN {toHexByte(diagnostics.portFe)}</span>
          <span>OUT {toHexByte(diagnostics.portFeOut)}</span>
          <span>B{diagnostics.border}</span>
          <span>E{diagnostics.ear ? 1 : 0}</span>
          <span>M{diagnostics.mic ? 1 : 0}</span>
          <span>L{diagnostics.beeperLevel}</span>
          <span>T{diagnostics.frameTact}</span>
          <span>N{diagnostics.nextFrameStartTact}</span>
          <span>F{diagnostics.frameCompleted ? 1 : 0}</span>
          <span>IRQ{diagnostics.interruptsRaised}</span>
          <span>I{diagnostics.interruptLineActive ? 1 : 0}</span>
          <span>PH{diagnostics.renderingPhase}</span>
          <span>C{diagnostics.contention}</span>
          <span>CD{diagnostics.contentionDelay}</span>
          <span>PC {toHexWord(diagnostics.cpuPc)}</span>
          <span>A {toHexByte(diagnostics.cpuAf >> 8)}</span>
          <span>CPU {diagnostics.cpuInstructions}</span>
          <span>SL {diagnostics.cpuFrameSliceInstructions}</span>
          {diagnostics.lastKey ? (
            <span>
              {diagnostics.lastKey.down ? "DOWN" : "UP"} {diagnostics.lastKey.key}
            </span>
          ) : null}
        </div>
      </div>
      {error ? <div className={styles.error}>{error}</div> : null}
    </div>
  );
};

function toHexByte(value: number): string {
  return (value & 0xff).toString(16).padStart(2, "0").toUpperCase();
}

function toHexWord(value: number): string {
  return (value & 0xffff).toString(16).padStart(4, "0").toUpperCase();
}
