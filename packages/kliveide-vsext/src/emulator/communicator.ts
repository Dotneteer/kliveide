import * as vscode from "vscode";
import fetch, { RequestInit, Response } from "node-fetch";
import { KLIVEIDE, EMU_PORT } from "../config/sections";

/**
 * This class is responsible for communicating with the Klive Emulator
 */
class Communicator {
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
  async hello(): Promise<string> {
    return this.getText("/hello");
  }

  /**
   * Gets frame information from the virtual machine
   */
  async frameInfo(): Promise<FrameInfo> {
    return this.getJson<FrameInfo>("/frame-info");
  }

  /**
   * Gets Z80 register information from the virtual machine
   */
  async getRegisters(): Promise<RegisterData> {
    return this.getJson<RegisterData>("/z80-regs");
  }

  /**
   * Gets the contents of the specified memory segment
   * @param from Firts memory address
   * @param to Last memory address
   */
  async getMemory(from: number, to: number): Promise<string> {
    return this.getText(`/mem/${from}/${to}`);
  }

  /**
   * Sets the specified breakpoint
   * @param address Breakpoint address
   */
  async setBreakpoint(address: number): Promise<void> {
    await this.post("/set-breakpoints", { breakpoints: [ address ]});
  }

  /**
   * Sets the specified breakpoint
   * @param address Breakpoint address
   */
  async removeBreakpoint(address: number): Promise<void> {
    await this.post("/delete-breakpoints", { breakpoints: [ address ]});
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
        timeout: 1000,
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
        timeout: 1000,
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify(body)
      };
    }
    return await fetch(`${this.url()}${command}`, requestInit);
  }
}

/**
 * Defines the response for a frameInfo request
 */
export interface FrameInfo {
  startCount?: number;
  frameCount?: number;
  executionState?: number;
  breakpoints?: number[];
  pc?: number;
}

/**
 * Represents the information about execution state change
 */
export interface ExecutionState {
  state: string,
  pc?: number
}

/**
 * Represents Z80 Registers data
 */
export interface RegisterData {
  af: number;
  bc: number;
  de: number;
  hl: number;
  af_: number;
  bc_: number;
  de_: number;
  hl_: number;
  pc: number;
  sp: number;
  ix: number;
  iy: number;
  i: number;
  r: number;
  wz: number;
}

/**
 * The singleton communicator instance
 */
export const communicatorInstance = new Communicator();
