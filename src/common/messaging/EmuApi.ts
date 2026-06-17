import { buildMessagingProxy } from "./MessageProxy";
import { MessengerBase } from "./MessengerBase";
import type { MachineCommand } from "../abstractions/MachineCommand";

const NO_PROXY_ERROR = "Method should be implemented by a proxy.";

export type EmuMachineCommand = MachineCommand;
export type EmuRecordingCommand =
  | "set-fps-native"
  | "set-fps-half"
  | "set-quality-lossless"
  | "set-quality-high"
  | "set-quality-good"
  | "set-format-mp4"
  | "set-format-webm"
  | "set-format-mkv"
  | "start-recording"
  | "disarm"
  | "pause-recording"
  | "resume-recording";

export type Z80CpuState = {
  af?: number;
  bc?: number;
  de?: number;
  hl?: number;
  ix?: number;
  iy?: number;
  pc?: number;
  sp?: number;
  af_?: number;
  bc_?: number;
  de_?: number;
  hl_?: number;
  i?: number;
  r?: number;
  wz?: number;
  lastMemoryRead?: number;
  lastMemoryWrite?: number;
  lastIoRead?: number;
  lastIoWrite?: number;
  im?: number;
  snoozed?: boolean;
  iff1?: boolean;
  iff2?: boolean;
  interruptBlocked?: boolean;
  halted?: boolean;
  tacts?: number;
  tactsInFrame?: number;
};

/**
 * This class defines the shape of the Emu process API that can be called from
 * the main and Ide processes. The methods are called through a JavaScript proxy.
 */
class EmuApiImpl {
  /**
   * Sets the machine type and optional model/configuration.
   * @param _machineId The machine type ID.
   * @param _modelId Optional model ID.
   * @param _config Optional configuration object.
   */
  async setMachineType(
    _machineId: string,
    _modelId?: string,
    _config?: Record<string, any>
  ): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Issues a command to the active emulator machine controller.
   * @param _command Machine command to issue.
   */
  async issueMachineCommand(_command: EmuMachineCommand): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Issues a recording command to the emulator renderer.
   * @param _command Recording command to issue.
   */
  async issueRecordingCommand(_command: EmuRecordingCommand): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Gets a serializable snapshot of the active Z80 CPU state.
   */
  async getCpuState(): Promise<Z80CpuState | null> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sets the emulator clock multiplier.
   * @param _value Clock multiplier value.
   */
  async setClockMultiplier(_value: number): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sets the emulator sound level.
   * @param _value Sound level multiplier.
   */
  async setSoundLevel(_value: number): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Sets the tape file for the emulator.
   * @param _file The tape file name.
   * @param _contents The tape file contents as Uint8Array.
   * @param _confirm Optional flag to show confirmation.
   * @param _suppressError Optional flag to suppress errors.
   */
  async setTapeFile(
    _file: string,
    _contents: Uint8Array,
    _confirm?: boolean,
    _suppressError?: boolean
  ): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }
}

export type EmuApi = EmuApiImpl;

export function createEmuApi(messenger: MessengerBase): EmuApiImpl {
  return buildMessagingProxy(new EmuApiImpl(), messenger, "emu");
}
