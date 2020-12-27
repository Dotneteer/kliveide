import * as vscode from "vscode";
import fetch, { RequestInit, Response } from "node-fetch";
import { KLIVEIDE, EMU_PORT, SAVE_FOLDER } from "../config/sections";
import { MachineState } from "../shared/machines/machine-state";
import { DiagViewFrame } from "../shared/machines/diag-info";
import { BreakpointDefinition } from "../shared/machines/api-data";

/**
 * This class is responsible for communicating with the Klive Emulator
 */
class Communicator {
  // --- Temporary timeout for the next call
  private _tempTimeout: number | null = null;

  /**
   * Gets the base URL used to communicate with Klive Emulator
   */
  url(): string {
    const config = vscode.workspace.getConfiguration(KLIVEIDE);
    const port = config.get(EMU_PORT);
    return `http://localhost:${port}`;
  }

  /**
   * Requests a hello message
   */
  async hello(): Promise<boolean> {
    let retryCount = 0;
    while (retryCount < 10) {
      // --- Get the hello response
      const hello = await this.getText("/hello");

      // --- The "KliveEmu" message signs that the emulator has been initialized.
      if (hello === "KliveEmu") {
        // --- The emulator started and initialized.
        return true;
      }

      // --- Let's wait while the emulator initializes itself
      await new Promise((r) => setTimeout(r, 200));
      retryCount++;
    }
    return false;
  }

  /**
   * Gets frame information from the virtual machine
   */
  async frameInfo(): Promise<DiagViewFrame> {
    return this.getJson<DiagViewFrame>("/frame-info");
  }

  /**
   * Gets the contents of the specified memory segment
   */
  async getMemory(): Promise<string> {
    return this.getText(`/memory`);
  }

  /**
   * Gets the contents of the specified memory segment
   * @param from Firts memory address
   * @param to Last memory address
   */
  async getMemoryPartition(partition: number): Promise<string> {
    return this.getText(`/memory-partition/${partition}`);
  }

  /**
   * Gets the diagnostics state of the virtual machine
   */
  async getMachineState(): Promise<MachineState> {
    return this.getJson<MachineState>("/machine-state");
  }

  /**
   * Gets the contents of the specified ROM page
   * @param page Page to get
   */
  async getRomPage(page: number): Promise<string> {
    return this.getText(`/rom/${page}`);
  }

  /**
   * Gets the contents of the specified BANK page
   * @param page Page to get
   */
  async getBankPage(page: number): Promise<string> {
    return this.getText(`/bank/${page}`);
  }

  /**
   * Sets the specified breakpoint
   * @param address Breakpoint address
   */
  async setBreakpoints(breakpoints: BreakpointDefinition[]): Promise<void> {
    await this.post("/breakpoints", { breakpoints });
  }

  /**
   * Sets the specified breakpoint
   * @param address Breakpoint address
   */
  async removeBreakpoint(address: number): Promise<void> {
    await this.post("/delete-breakpoints", { breakpoints: [address] });
  }

  /**
   * Notifies the emulator about IDE configuration changes
   * @param ideConfig IDE configuration
   */
  async signConfigurationChange(): Promise<void> {
    const folders = vscode.workspace.workspaceFolders;
    const projectFolder = folders ? folders[0].uri.fsPath : "";
    const kliveConfig = vscode.workspace.getConfiguration(KLIVEIDE);
    const ideConfig: IdeConfiguration = {
      projectFolder,
      saveFolder: kliveConfig.get(SAVE_FOLDER) ?? "",
    };
    await this.post("/ide-config", ideConfig);
  }

  /**
   * Sends a tape file to the emulator
   * @param filename File name to send to the emulator
   */
  async setTapeFile(filename: string): Promise<boolean> {
    const response = await this.post("/tape-contents", { tapeFile: filename });
    return response.ok;
  }

  /**
   * Sets the ZX Spectrum machine type
   * @param typeId Machine type ID
   */
  async setMachineType(typeId: string): Promise<void> {
    await this.post("/machine-type", { type: typeId });
  }

  /**
   * Sends code to the ZX Spectrum to inject
   * @param codeToInject
   */
  async injectCode(codeToInject: CodeToInject): Promise<string> {
    this._tempTimeout = 2000;
    const response = await this.post("/inject-code", codeToInject);
    if (response.ok) {
      return response.text();
    }
  }

  /**
   * Sends code to the ZX Spectrum to execute
   * @param codeToInject
   */
  async runCode(codeToInject: CodeToInject, debug: boolean): Promise<string> {
    this._tempTimeout = 10_000;
    const response = await this.post("/run-code", { codeToInject, debug });
    if (response.ok) {
      return response.text();
    }
  }

  /**
   * Invokes a GET command for a generic response
   * @param command Command string
   * @param requestInit Optional request initialization
   */
  private async get(
    command: string,
    requestInit?: RequestInit
  ): Promise<Response> {
    if (!requestInit) {
      requestInit = {
        method: "GET",
        timeout: this.timeoutValue,
      };
    }
    return await fetch(`${this.url()}${command}`, requestInit);
  }

  /**
   * Invokes a GET command for a text
   * @param command Command string
   * @param requestInit Optional request initialization
   */
  private async getText(
    command: string,
    requestInit?: RequestInit
  ): Promise<string> {
    const response = await this.get(command, requestInit);
    if (response.ok) {
      return response.text();
    }
    throw new Error(`Unexpected response for ${command}: ${response.status}`);
  }

  /**
   * Invokes a GET command for a JSON object
   * @param command Command string
   * @param requestInit Optional request initialization
   */
  private async getJson<T extends Object>(
    command: string,
    requestInit?: RequestInit
  ): Promise<T> {
    const response = await this.get(command, requestInit);
    if (response.ok) {
      return (await response.json()) as T;
    }
    throw new Error(`Unexpected response for ${command}: ${response.status}`);
  }

  /**
   * Invokes a GET command for a generic response
   * @param command Command string
   * @param requestInit Optional request initialization
   */
  private async post(
    command: string,
    body: object,
    requestInit?: RequestInit
  ): Promise<Response> {
    if (!requestInit) {
      requestInit = {
        method: "POST",
        timeout: this.timeoutValue,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      };
    }
    return await fetch(`${this.url()}${command}`, requestInit);
  }

  /** 
   * Gets the timeout value to use with a request
   */
  private get timeoutValue(): number {
    if (!this._tempTimeout) {
      return 1000;
    }
    const tmp = this._tempTimeout;
    this._tempTimeout = null;
    return tmp;
  }
}

/**
 * Represents the information about execution state change
 */
export interface ExecutionState {
  state: string;
  pc?: number;
  runsInDebug?: boolean;
}

/**
 * Represents the configuration data sent by the IDE
 */
export interface IdeConfiguration {
  /**
   * The absolute path of the current project folder
   */
  projectFolder: string;

  /**
   * The current SAVE folder
   */
  saveFolder: string;
}

/**
 * Information about current memory pages
 */
export interface MemoryPageInfo {
  /**
   * Selected ROM page
   */
  selectedRom: number;

  /**
   * Selected upper memory bank
   */
  selectedBank: number;
}

/**
 * A single segment of the code compilation
 */
export interface BinarySegment {
  startAddress: number;
  bank?: number;
  bankOffset: number;
  emittedCode: number[];
}

/**
 * The code to inject into the virtual machine
 */
export interface CodeToInject {
  model: string;
  entryAddress?: number;
  subroutine?: boolean;
  segments: BinarySegment[];
  options: { [key: string]: boolean };
}

/**
 * The singleton communicator instance
 */
export const communicatorInstance = new Communicator();
