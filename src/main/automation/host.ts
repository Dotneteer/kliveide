import type { AppState } from "@state/AppState";
import type { CapturedCommandResult } from "@common/messaging/IdeApi";
import type { EmuApi } from "@common/messaging/EmuApi";
import type { ProjectStructure } from "@main/ksx-runner/ProjectStructure";

/*
 * What the automation server needs of Klive (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` §4.1): the
 * shared store, the emulator and IDE APIs it is a thin layer over, and opening a folder. The real
 * host (`automation-controller.ts`) wires these to `mainStore`, `getEmuApi()` and `getIdeApi()`; the
 * protocol tests pass fakes, so the whole protocol runs in-process without Electron.
 */

/** The emulator methods the server calls */
export type AutomationEmuApi = Pick<
  EmuApi,
  | "issueMachineCommand"
  | "getCpuState"
  | "setRegisterValue"
  | "getMemoryContents"
  | "setMemoryBytes"
  | "getPartitionLabels"
  | "parsePartitionLabel"
  | "listBreakpoints"
  | "getScreenImage"
  | "getStopInfo"
>;

/** The IDE methods the server calls */
export type AutomationIdeApi = {
  /**
   * Runs an IDE command into a fresh buffer, mirrored to the Build pane (D9). With `automation`,
   * a command marked `automation: "deny"` is refused instead of run (T5).
   */
  executeCommandCaptured(
    commandText: string,
    options?: { automation?: boolean }
  ): Promise<CapturedCommandResult>;
  getProjectStructure(): Promise<ProjectStructure>;
};

export interface AutomationHost {
  /** Klive's version */
  readonly version: string;
  /** The shared store's state */
  getState(): AppState;
  /** Calls the listener after every store change; returns the unsubscribe function */
  subscribe(listener: () => void): () => void;
  /** Both windows exist and the machine is set up (T2) */
  isReady(): boolean;
  readonly emu: AutomationEmuApi;
  readonly ide: AutomationIdeApi;
  /** Opens a project folder; an error message, or null when it opened */
  openFolder(folder: string): Promise<string | null>;
}
