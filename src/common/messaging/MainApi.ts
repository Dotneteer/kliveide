import { buildMessagingProxy } from "./MessageProxy";
import { MessengerBase } from "./MessengerBase";
import type { RecordingFormat } from "../state/AppState";

const NO_PROXY_ERROR = "Method should be implemented by a proxy.";

export type MessageBoxType = "none" | "info" | "error" | "question" | "warning";

/**
 * This class defines the shape of the main process API that can be called from
 * the Emu and Ide processes. The methods are called through a JavaScript proxy.
 */
class MainApiImpl {
  /**
   * Reads a text file from disk and returns its contents as a string.
   * @param _path The file path to read.
   * @param _encoding The text encoding to use (default: utf8).
   * @param _resolveIn Optional base path context.
   */
  async readTextFile(_path: string, _encoding?: string, _resolveIn?: string): Promise<string> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Reads a binary file from disk and returns its contents as a byte array.
   * @param _path The file path to read.
   * @param _resolveIn Optional base path context.
   */
  async readBinaryFile(_path: string, _resolveIn?: string): Promise<Uint8Array> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  async saveGeneratedTapeFile(
    _defaultName: string,
    _contents: Uint8Array
  ): Promise<{ fileName?: string }> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Starts a new screen recording session.
   * @param _width Frame width in pixels.
   * @param _height Frame height in pixels.
   * @param _fps Target recording FPS.
   * @param _xRatio Horizontal pixel aspect-ratio factor.
   * @param _yRatio Vertical pixel aspect-ratio factor.
   * @param _sampleRate Audio sample rate.
   * @param _crf Encoder quality value.
   * @param _format Output container/codec family.
   */
  async startScreenRecording(
    _width: number,
    _height: number,
    _fps: number,
    _xRatio = 1,
    _yRatio = 1,
    _sampleRate = 44100,
    _crf = 18,
    _format: RecordingFormat = "mp4"
  ): Promise<string> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Appends one raw RGBA frame to the active recording.
   * @param _rgba Raw RGBA pixel data.
   */
  async appendRecordingFrame(_rgba: Uint8Array): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Appends interleaved stereo audio samples to the active recording.
   * @param _samples Interleaved stereo f32 samples.
   */
  async appendRecordingAudio(_samples: Float32Array): Promise<void> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  /**
   * Finalizes the active recording.
   * @returns The completed output file path.
   */
  async stopScreenRecording(): Promise<string> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  async getSettingValue(_id: string): Promise<unknown> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  async setSettingValue(_id: string, _value: unknown): Promise<unknown> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }

  async getAllSettingValues(): Promise<Record<string, unknown>> {
    return Promise.reject(new Error(NO_PROXY_ERROR));
  }
}

export type MainApi = MainApiImpl;

export function createMainApi(messenger: MessengerBase): MainApiImpl {
  return buildMessagingProxy(new MainApiImpl(), messenger, "main");
}
