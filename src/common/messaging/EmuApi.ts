import { MessengerBase } from "@messaging/MessengerBase";
import {
  EmuGetCallStackResponse,
  EmuGetNextMemoryMappingResponse,
  EmuGetNextRegDescriptorsResponse,
  EmuGetNextRegStateResponse,
} from "@messaging/main-to-emu";
import {
  MessageBase,
  RequestMessage,
  ResponseMessage,
  ValueResponse
} from "@messaging/messages-core";

/**
 * This interface defines the API exposed by the Emulator
 */
export interface EmuApi {
  getNextRegDescriptors(): Promise<EmuGetNextRegDescriptorsResponse>;
  getNextRegState(): Promise<EmuGetNextRegStateResponse>;
  getNextMemoryMapping(): Promise<EmuGetNextMemoryMappingResponse>;
  parsePartitionLabel(label: string): Promise<ValueResponse>;
  getPartitionLabels(): Promise<ValueResponse>;
  getCallStack(): Promise<EmuGetCallStackResponse>;
  setKeyStatus(key: number, isDown: boolean): Promise<void>;
}

class EmuApiImpl implements EmuApi {
  constructor(private readonly messenger: MessengerBase) {}

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

  /**
   * Gets the call stack
   */
  async getCallStack(): Promise<EmuGetCallStackResponse> {
    const response = await this.sendMessage({ type: "EmuGetCallStack" }, "EmuGetCallStackResponse");
    return response as EmuGetCallStackResponse;
  }

  /**
   * Sets the key status
   * @param key Key code
   * @param isDown Is the key down?
   */
  async setKeyStatus(key: number, isDown: boolean): Promise<void> {
    await this.sendMessage({ type: "EmuSetKeyState", key, isDown });
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
