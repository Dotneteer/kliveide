import { BreakpointInfo } from "@abstractions/BreakpointInfo";
import { CodeToInject } from "@abstractions/CodeToInject";
import { ResolvedBreakpoint } from "@emu/abstractions/ResolvedBreakpoint";
import { MessengerBase } from "@messaging/MessengerBase";
import {
  EmuGetBlinkStateResponse,
  EmuGetCpuStateResponse,
  EmuGetMemoryResponse,
  EmuGetNecUpd765Response,
  EmuGetNextMemoryMappingResponse,
  EmuGetNextRegDescriptorsResponse,
  EmuGetNextRegStateResponse,
  EmuGetPsgStateResponse,
  EmuGetSysVarsResponse,
  EmuGetUlaStateResponse,
  EmuListBreakpointsResponse,
  MachineCommand
} from "@messaging/main-to-emu";
import {
  FlagResponse,
  MessageBase,
  RequestMessage,
  ResponseMessage,
  ValueResponse
} from "@messaging/messages-core";

/**
 * This interface defines the API exposed by the Emulator
 */
export interface EmuApi {
  setMachineType(machineId: string, modelId?: string, config?: Record<string, any>): Promise<void>;
  issueMachineCommand(command: MachineCommand, customCommand?: string): Promise<void>;
  setTapeFile(
    file: string,
    contents: Uint8Array,
    confirm?: boolean,
    suppressError?: boolean
  ): Promise<void>;
  setDiskFile(
    diskIndex: number,
    file?: string,
    contents?: Uint8Array,
    confirm?: boolean,
    suppressError?: boolean
  ): Promise<void>;
  setDiskWriteProtection(index: number, protect: boolean): Promise<void>;
  getCpuState(): Promise<EmuGetCpuStateResponse>;
  getUlaState(): Promise<EmuGetUlaStateResponse>;
  getPsgState(): Promise<EmuGetPsgStateResponse>;
  getBlinkState(): Promise<EmuGetBlinkStateResponse>;
  eraseAllBreakpoints(): Promise<void>;
  setBreakpoint(breakpoint: BreakpointInfo): Promise<FlagResponse>;
  removeBreakpoint(breakpoint: BreakpointInfo): Promise<FlagResponse>;
  listBreakpoints(): Promise<EmuListBreakpointsResponse>;
  enableBreakpoint(breakpoint: BreakpointInfo, enable: boolean): Promise<FlagResponse>;
  getMemoryContents(partition?: number): Promise<EmuGetMemoryResponse>;
  getSysVars(): Promise<EmuGetSysVarsResponse>;
  injectCodeCommand(codeToInject: CodeToInject): Promise<void>;
  runCodeCommand(codeToInject: CodeToInject, debug: boolean): Promise<void>;
  resolveBreakpoints(breakpoints: ResolvedBreakpoint[]): Promise<void>;
  scrollBreakpoints(addr: BreakpointInfo, shift: number): Promise<void>;
  normalizeBreakpoints(resource: string, lineCount: number): Promise<void>;
  getNecUpd765State(): Promise<EmuGetNecUpd765Response>;
  startScript(id: number, scriptFile: string, contents: string): Promise<void>;
  stopScript(id: number): Promise<void>;
  getNextRegDescriptors(): Promise<EmuGetNextRegDescriptorsResponse>;
  getNextRegState(): Promise<EmuGetNextRegStateResponse>;
  getNextMemoryMapping(): Promise<EmuGetNextMemoryMappingResponse>;
  parsePartitionLabel(label: string): Promise<ValueResponse>;
  getPartitionLabels(): Promise<ValueResponse>;
}

class EmuApiImpl implements EmuApi {
  constructor(private readonly messenger: MessengerBase) {}

  /**
   * Sets the machine type to use
   * @param machineId ID of the machine type
   * @param modelId ID of the machine model
   * @param config Optional machine configuration
   */
  async setMachineType(
    machineId: string,
    modelId?: string,
    config?: Record<string, any>
  ): Promise<void> {
    await this.sendMessage({ type: "EmuSetMachineType", machineId, modelId, config });
  }

  /**
   * Issue a machine command
   * @param command Command to issue
   * @param customCommand Optional custom command
   */
  async issueMachineCommand(command: MachineCommand, customCommand?: string): Promise<void> {
    await this.sendMessage({ type: "EmuMachineCommand", command, customCommand });
  }

  /**
   * Sets the tape file to use with the machine
   * @param file Tape file
   * @param contents Tape contents
   * @param confirm Should the operation be confirmed?
   * @param suppressError Should errors be suppressed?
   */
  async setTapeFile(
    file: string,
    contents: Uint8Array,
    confirm?: boolean,
    suppressError?: boolean
  ): Promise<void> {
    await this.sendMessage({ type: "EmuSetTapeFile", file, contents, confirm, suppressError });
  }

  /**
   * Sets the disk file to use with the machine
   * @param diskIndex Disk index
   * @param file Disk file
   * @param contents Disk contents
   * @param confirm Should the operation be confirmed?
   * @param suppressError Should errors be suppressed?
   */
  async setDiskFile(
    diskIndex: number,
    file?: string,
    contents?: Uint8Array,
    confirm?: boolean,
    suppressError?: boolean
  ): Promise<void> {
    await this.sendMessage({
      type: "EmuSetDiskFile",
      diskIndex,
      file,
      contents,
      confirm,
      suppressError
    });
  }

  /**
   * Sets the disk write protection state
   * @param index Disk index
   * @param protect Should the disk be protected?
   */
  async setDiskWriteProtection(index: number, protect: boolean): Promise<void> {
    await this.sendMessage({ type: "EmuSetDiskWriteProtection", diskIndex: index, protect });
  }

  /**
   * Gets the current CPU state
   */
  async getCpuState(): Promise<EmuGetCpuStateResponse> {
    const response = await this.sendMessage({ type: "EmuGetCpuState" }, "EmuGetCpuStateResponse");
    return response as EmuGetCpuStateResponse;
  }

  /**
   * Gets the current PSG state
   */
  async getPsgState(): Promise<EmuGetPsgStateResponse> {
    const response = await this.sendMessage({ type: "EmuGetPsgState" }, "EmuGetPsgStateResponse");
    return response as EmuGetPsgStateResponse;
  }

  /**
   * Gets the current ULA state
   */
  async getUlaState(): Promise<EmuGetUlaStateResponse> {
    const response = await this.sendMessage({ type: "EmuGetUlaState" }, "EmuGetUlaStateResponse");
    return response as EmuGetUlaStateResponse;
  }

  /**
   * Gets the current BLINK state
   */
  async getBlinkState(): Promise<EmuGetBlinkStateResponse> {
    const response = await this.sendMessage(
      { type: "EmuGetBlinkState" },
      "EmuGetBlinkStateResponse"
    );
    return response as EmuGetBlinkStateResponse;
  }

  /**
   * Erases all breakpoints
   */
  async eraseAllBreakpoints(): Promise<void> {
    await this.sendMessage({ type: "EmuEraseAllBreakpoints" });
  }

  /**
   * Sets a breakpoint
   * @param breakpoint Breakpoint to set
   */
  async setBreakpoint(breakpoint: BreakpointInfo): Promise<FlagResponse> {
    const response = await this.sendMessage(
      { type: "EmuSetBreakpoint", breakpoint },
      "FlagResponse"
    );
    return response as FlagResponse;
  }

  /**
   * Removes a breakpoint
   * @param breakpoint Breakpoint to remove
   */
  async removeBreakpoint(breakpoint: BreakpointInfo): Promise<FlagResponse> {
    const response = await this.sendMessage(
      { type: "EmuRemoveBreakpoint", breakpoint },
      "FlagResponse"
    );
    return response as FlagResponse;
  }

  /**
   * Lists all breakpoints
   */
  async listBreakpoints(): Promise<EmuListBreakpointsResponse> {
    const response = await this.sendMessage(
      { type: "EmuListBreakpoints" },
      "EmuListBreakpointsResponse"
    );
    return response as EmuListBreakpointsResponse;
  }

  /**
   * Enables or disables a breakpoint
   * @param breakpoint Breakpoint to enable or disable
   * @param enable Should the breakpoint be enabled?
   */
  async enableBreakpoint(breakpoint: BreakpointInfo, enable: boolean): Promise<FlagResponse> {
    const response = await this.sendMessage(
      { type: "EmuEnableBreakpoint", breakpoint, enable },
      "FlagResponse"
    );
    return response as FlagResponse;
  }

  /**
   * Gets the memory contents
   * @param partition Memory partition
   */
  async getMemoryContents(partition?: number): Promise<EmuGetMemoryResponse> {
    const response = await this.sendMessage(
      { type: "EmuGetMemory", partition },
      "EmuGetMemoryResponse"
    );
    return response as EmuGetMemoryResponse;
  }

  /**
   * Gets the system variables
   */
  async getSysVars(): Promise<EmuGetSysVarsResponse> {
    const response = await this.sendMessage({ type: "EmuGetSysVars" }, "EmuGetSysVarsResponse");
    return response as EmuGetSysVarsResponse;
  }

  /**
   * Injects code into the emulator
   * @param codeToInject Code to inject
   */
  async injectCodeCommand(codeToInject: CodeToInject): Promise<void> {
    await this.sendMessage({ type: "EmuInjectCode", codeToInject });
  }

  /**
   * Runs code in the emulator
   * @param codeToInject Code to inject
   * @param debug Should the code be run in debug mode?
   */
  async runCodeCommand(codeToInject: CodeToInject, debug: boolean): Promise<void> {
    await this.sendMessage({ type: "EmuRunCode", codeToInject, debug });
  }

  /**
   * Resolves the specified breakpoints
   * @param breakpoints Breakpoints to resolve
   */
  async resolveBreakpoints(breakpoints: ResolvedBreakpoint[]): Promise<void> {
    await this.sendMessage({ type: "EmuResolveBreakpoints", breakpoints });
  }

  /**
   * Scrolls the specified breakpoint
   * @param addr Breakpoint address
   * @param shift Shift value
   */
  async scrollBreakpoints(addr: BreakpointInfo, shift: number): Promise<void> {
    await this.sendMessage({ type: "EmuScrollBreakpoints", addr, shift });
  }

  /**
   * Normalizes the breakpoints in the specified resource
   * @param resource Resource name
   * @param lineCount Number of lines
   */
  async normalizeBreakpoints(resource: string, lineCount: number): Promise<void> {
    await this.sendMessage({ type: "EmuNormalizeBreakpoints", resource, lineCount });
  }

  /**
   * Gets the NEC UPD765 state
   */
  async getNecUpd765State(): Promise<EmuGetNecUpd765Response> {
    const response = await this.sendMessage(
      { type: "EmuGetNecUpd765State" },
      "EmuGetNecUpd765StateResponse"
    );
    return response as EmuGetNecUpd765Response;
  }

  /**
   * Starts the specified script
   * @param id Script ID
   * @param scriptFile Script file
   * @param contents Script contents
   */
  async startScript(id: number, scriptFile: string, contents: string): Promise<void> {
    await this.sendMessage({ type: "EmuStartScript", id, scriptFile, contents });
  }

  /**
   * Stops the specified script
   * @param id Script ID
   */
  async stopScript(id: number): Promise<void> {
    await this.sendMessage({ type: "EmuStopScript", id });
  }

  /**
   * Gets the Next register descriptors
   */
  async getNextRegDescriptors(): Promise<EmuGetNextRegDescriptorsResponse> {
    const response = await this.sendMessage(
      { type: "EmuGetNextRegDescriptors" },
      "EmuGetNextRegDescriptorsResponse"
    );
    return response as EmuGetNextRegDescriptorsResponse;
  }

  /**
   * Gets the Next register device state
   */
  async getNextRegState(): Promise<EmuGetNextRegStateResponse> {
    const response = await this.sendMessage(
      { type: "EmuGetNextRegState" },
      "EmuGetNextRegStateResponse"
    );
    return response as EmuGetNextRegStateResponse;
  }

  /**
   * Gets the Next memory mapping data
   */
  async getNextMemoryMapping(): Promise<EmuGetNextMemoryMappingResponse> {
    const response = await this.sendMessage(
      { type: "EmuGetNextMemoryMapping" },
      "EmuGetNextMemoryMappingResponse"
    );
    return response as EmuGetNextMemoryMappingResponse;
  }

  /**
   * Parses the specified partition label
   * @param label Partition label
   */
  async parsePartitionLabel(label: string): Promise<ValueResponse> {
    const response = await this.sendMessage(
      { type: "EmuParsePartitionLabel", label },
      "ValueResponse"
    );
    return response as ValueResponse;
  }

  /**
   * Gets the partition labels
   */
  async getPartitionLabels(): Promise<ValueResponse> {
    const response = await this.sendMessage({ type: "EmuGetPartitionLabels" }, "ValueResponse");
    return response as ValueResponse;
  }

  private async sendMessage(
    message: RequestMessage,
    msgType?: ResponseMessage["type"]
  ): Promise<MessageBase> {
    const response = await this.messenger.sendMessage(message);
    if (response.type === "ErrorResponse") {
      console.log(`Error while sending IPC message: ${response.message}`);
    } else if (msgType && response.type !== msgType) {
      console.log(`Unexpected response type for request type '${message.type}': ${response.type}`);
    }
    return response;
  }
}

export function createEmulatorApi(messenger: MessengerBase): EmuApi {
  return new EmuApiImpl(messenger);
}
