/*
 * Plays an RZX recording in the emulator, and renders one to video (`.plans/RZX_PLAN.md` §4.5, §4.7).
 *
 * Play:
 *  1. parse the file;
 *  2. map the (chosen) segment's snapshot to a machine, with the snapshot load's fitting (warnings
 *     included; trap 6's ROM choice is `mapRzxToKlive`'s);
 *  3. restore through `IMachineController.restoreState`: the player loads the snapshot;
 *  4. attach the player to the machine;
 *  5. run, or debug stopping at the snapshot's PC (`zx-rzx -d`).
 *
 * Render to video (D17-D20): the same, then arm the existing screen recorder with its stored fps,
 * quality and format, hold the first frame until the recorder has opened its file, run unthrottled
 * if asked (D18; the emulator panel mutes live audio while `rzx.mode` is "rendering"), and stop the
 * video when the recording ends or desyncs. The video gets one frame per picture (D19): a playback
 * frame of 4 fetches or fewer completes none.
 */

import type { IMachineController } from "@renderer/abstractions/IMachineController";
import type { MachineConfigSet } from "@common/machines/info-types";
import type {
  RzxPlayMode,
  RzxPlayOptions,
  RzxPlayResult,
  RzxVideoOptions
} from "@common/spectrum/rzx/rzxCommandTypes";
import type { ScreenRecordingState } from "@common/state/AppState";
import type { RzxStop } from "@emu/machines/zxSpectrum/rzx/rzxSession";

import { MachineControllerState } from "@abstractions/MachineControllerState";
import { parseRzxFile } from "@common/spectrum/rzx/rzxFile";
import { mapRzxToKlive } from "@common/spectrum/rzx/rzxMapping";
import { rzxCreatorText } from "@common/spectrum/rzx/rzxModel";
import { rzxSegments } from "@common/spectrum/rzx/rzxSegments";
import { kliveSpectrumName } from "@common/spectrum/snapshot/spectrumSnapshotMapping";
import { RzxPlayer } from "@emu/machines/zxSpectrum/rzx/RzxPlayer";
import { isRzxMachine } from "@emu/machines/zxSpectrum/rzx/rzxSession";
import { fitSpectrumMachine } from "./spectrumSnapshotLoad";

/** The services playback uses */
export type RzxPlaybackPorts = {
  getMachineController(): IMachineController | undefined;
  getEmulatorState(): { machineId?: string; modelId?: string; config?: MachineConfigSet };
  /** Rebuilds the machine; false when a later machine change superseded it */
  setMachineType(machineId: string, modelId: string | undefined, config: MachineConfigSet): Promise<boolean>;
};

/** The part of the screen recorder render to video drives (`RecordingManager`) */
export type RzxVideoRecorder = {
  readonly state: ScreenRecordingState;
  arm(fps?: undefined, startNow?: boolean): void;
  disarm(): Promise<void>;
};

export type RzxVideoPorts = RzxPlaybackPorts & {
  /** The screen recorder; undefined when the emulator has none */
  getRecorder(): RzxVideoRecorder | undefined;
  /** The file the screen recorder writes */
  getVideoFile(): string | undefined;
};

type PlaybackSetup = { controller: IMachineController; result: RzxPlayResult };

/**
 * Loads a recording, attached to the machine as a paused playback
 * @param mode "playing" or "rendering", for the RZX state
 */
async function setUpPlayback(
  ports: RzxPlaybackPorts,
  fileName: string,
  bytes: Uint8Array,
  options: RzxPlayOptions,
  mode: "playing" | "rendering"
): Promise<PlaybackSetup> {
  // --- 1. Parse; 2. map and fit
  const file = parseRzxFile(bytes);
  const segment = options.segment ?? 0;
  const { snapshot, mapping } = mapRzxToKlive(file, segment);
  const fit = fitSpectrumMachine(ports.getEmulatorState(), mapping, snapshot, !!options.keepModel);
  const warnings = [...file.notes, ...snapshot.warnings, ...mapping.warnings, ...fit.warnings];
  if (fit.rebuild) {
    const live = await ports.setMachineType(fit.machineId, fit.modelId, fit.config);
    if (!live) throw new Error("The machine change was superseded by another one; the recording was not played");
  }
  const controller = ports.getMachineController();
  const machine = controller?.machine;
  if (!controller || !isRzxMachine(machine)) {
    throw new Error(`The emulator is not running a ${kliveSpectrumName(fit.machineId, fit.modelId)}`);
  }

  // --- 3. The player loads the snapshot inside the restore (which also ends any running session)
  const player = new RzxPlayer(machine, file, { segment, fileName: baseName(fileName) });
  await controller.restoreState(() => player.start(), `RZX recording ${baseName(fileName)} loaded`);

  // --- 4. Attach it
  controller.attachRzxSession(player, { mode, file: fileName });
  return {
    controller,
    result: {
      machineId: fit.machineId,
      modelId: fit.modelId,
      machineName: kliveSpectrumName(fit.machineId, fit.modelId),
      rebuilt: fit.rebuild,
      frames: player.frames,
      segments: rzxSegments(file).length,
      creator: rzxCreatorText(file.creator),
      pc: controller.machine.pc,
      warnings
    }
  };
}

/**
 * Plays a recording
 * @throws When the file is not a recording Klive can play, or the machine change was superseded
 */
export async function playRzxRecording(
  ports: RzxPlaybackPorts,
  fileName: string,
  bytes: Uint8Array,
  mode: RzxPlayMode,
  options: RzxPlayOptions = {}
): Promise<RzxPlayResult> {
  const { controller, result } = await setUpPlayback(ports, fileName, bytes, options, "playing");
  // --- 5. Run, or debug from the first instruction
  if (mode === "run") {
    await controller.start();
  } else {
    controller.debugSupport?.addBreakpoint({
      address: result.pc,
      exec: true,
      oneShot: true,
      runTo: true,
      owner: { kind: "session" }
    });
    await controller.startDebug();
  }
  return result;
}

/** How long render to video waits for the screen recorder to open its file */
const RECORDER_START_TIMEOUT_MS = 10_000;

/**
 * Renders a recording to video with the screen recorder. Returns once rendering has started; the
 * video stops by itself when the recording ends or desyncs.
 * @param onFinished Called with the stop and the video file once the video is closed
 */
export async function renderRzxToVideo(
  ports: RzxVideoPorts,
  fileName: string,
  bytes: Uint8Array,
  options: RzxVideoOptions = {},
  onFinished?: (stop: RzxStop | undefined, videoFile: string | undefined) => void
): Promise<RzxPlayResult> {
  const recorder = ports.getRecorder();
  if (!recorder) throw new Error("The emulator has no screen recorder");
  if (recorder.state !== "idle") {
    throw new Error("A screen recording is already armed or running; stop it first");
  }
  const { controller, result } = await setUpPlayback(ports, fileName, bytes, options, "rendering");

  // --- Hold frames back until the recorder runs; give up if it does not start
  const started = Date.now();
  controller.frameGate = () => {
    if (recorder.state === "recording") return undefined;
    if (Date.now() - started > RECORDER_START_TIMEOUT_MS) {
      return controller.interruptRzx("the screen recorder did not start");
    }
    return new Promise<void>((resolve) => setTimeout(resolve, 10));
  };
  controller.unthrottled = options.unthrottled ?? true;

  const finished = async (stop?: RzxStop) => {
    controller.rzxStopped.off(finished);
    controller.unthrottled = false;
    controller.frameGate = undefined;
    const videoFile = ports.getVideoFile();
    await recorder.disarm();
    if (controller.state === MachineControllerState.Running) {
      await controller.pause();
    }
    controller.detachRzxSession(stop?.message);
    onFinished?.(stop, videoFile);
  };
  controller.rzxStopped.on(finished);

  // --- The recorder starts recording when the machine runs
  recorder.arm(undefined, false);
  await controller.start();
  return result;
}

function baseName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] ?? path;
}
