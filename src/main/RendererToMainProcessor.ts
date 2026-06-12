import { app, BrowserWindow, dialog } from "electron";
import fs from "node:fs";
import path from "node:path";
import { sendFromMainToEmu } from "../common/messaging/MainToEmuMessenger";
import { sendFromMainToIde } from "../common/messaging/MainToIdeMessenger";
import {
  defaultResponse,
  errorResponse,
  type RequestMessage,
  type ResponseMessage
} from "../common/messaging/messages-core";
import { mainStore } from "./main-store";
import { getMainPublicPath } from "./publicResources";
import {
  appSettings,
  getAllSettingValues,
  getSettingValue,
  saveAppSettings,
  setSettingValue
} from "./settings";
import { createGeneratedTapeSaveDefaultPath } from "./generated-tape-save";
import { TAPE_FILE_FOLDER } from "./tape-folders";
import { setTapeMediaAction } from "../common/state/actions";
import type { RecordingFormat } from "../common/state/AppState";
import { parseTapeFile } from "../emu/tape/tape-parser";
import type { IRecordingBackend } from "./recording/IRecordingBackend";
import { FfmpegRecordingBackend } from "./recording/FfmpegRecordingBackend";
import { isFFmpegAvailable } from "./recording/ffmpegAvailable";
import { resolveRecordingPath } from "./recording/outputPath";

let recordingBackend: IRecordingBackend | null = null;

class MainMessageProcessor {
  constructor(private readonly window: BrowserWindow) {}

  readTextFile(filePath: string, encoding?: string, resolveIn?: string): string {
    if (typeof filePath !== "string" || !filePath.trim()) {
      throw new Error("Invalid file path");
    }

    const fullPath = resolveMessagePath(filePath, resolveIn);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File does not exist: ${fullPath}`);
    }

    return fs.readFileSync(fullPath, {
      encoding: (encoding ?? "utf8") as BufferEncoding
    });
  }

  readBinaryFile(filePath: string, resolveIn?: string): Uint8Array {
    if (typeof filePath !== "string" || !filePath.trim()) {
      throw new Error("Invalid file path");
    }

    const fullPath = resolveMessagePath(filePath, resolveIn);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File does not exist: ${fullPath}`);
    }

    return new Uint8Array(fs.readFileSync(fullPath));
  }

  async saveGeneratedTapeFile(
    defaultName: string,
    contents: Uint8Array
  ): Promise<{ fileName?: string }> {
    if (!(contents instanceof Uint8Array)) {
      throw new Error("Invalid generated tape contents.");
    }

    const defaultPath = createGeneratedTapeSaveDefaultPath(
      defaultName,
      appSettings.folders?.[TAPE_FILE_FOLDER],
      app.getPath("home")
    );
    const dialogResult = await dialog.showSaveDialog(this.window, {
      title: "Save Generated Tape File",
      defaultPath,
      filters: [
        { name: "TZX Files", extensions: ["tzx"] },
        { name: "All Files", extensions: ["*"] }
      ]
    });

    if (dialogResult.canceled || !dialogResult.filePath) {
      return {};
    }

    const parsed = parseTapeFile(contents);
    fs.writeFileSync(dialogResult.filePath, Buffer.from(contents));
    mainStore.dispatch(
      setTapeMediaAction({
        fileName: dialogResult.filePath,
        displayName: path.basename(dialogResult.filePath),
        size: contents.byteLength,
        blockCount: parsed.blocks.length,
        currentBlockIndex: parsed.blocks.length > 0 ? 0 : undefined,
        mode: "passive",
        phase: "none",
        status: parsed.blocks.length > 0 ? "rewound" : undefined,
        sourceFormat: parsed.format,
        warnings: parsed.warnings
      }),
      "main"
    );
    appSettings.folders ??= {};
    appSettings.folders[TAPE_FILE_FOLDER] = path.dirname(dialogResult.filePath);
    saveAppSettings();
    return { fileName: dialogResult.filePath };
  }

  async startScreenRecording(
    width: number,
    height: number,
    fps: number,
    xRatio = 1,
    yRatio = 1,
    sampleRate = 44100,
    crf = 18,
    format: RecordingFormat = "mp4"
  ): Promise<string> {
    if (!Number.isFinite(width) || width <= 0) {
      throw new Error("Invalid recording width.");
    }
    if (!Number.isFinite(height) || height <= 0) {
      throw new Error("Invalid recording height.");
    }
    if (!Number.isFinite(fps) || fps <= 0) {
      throw new Error("Invalid recording FPS.");
    }

    if (recordingBackend) {
      await recordingBackend.finish();
      recordingBackend = null;
    }

    const ext = format === "webm" ? "webm" : format === "mkv" ? "mkv" : "mp4";
    const outputPath = resolveRecordingPath(app.getPath("home"), ext);
    if (!isFFmpegAvailable()) {
      throw new Error("FFmpeg is not available. Install FFmpeg to enable screen recording.");
    }
    recordingBackend = new FfmpegRecordingBackend();
    recordingBackend.start(outputPath, width, height, fps, xRatio, yRatio, sampleRate, crf, format);
    return outputPath;
  }

  async appendRecordingFrame(rgba: Uint8Array): Promise<void> {
    recordingBackend?.appendFrame(rgba);
  }

  async appendRecordingAudio(samples: Float32Array): Promise<void> {
    recordingBackend?.appendAudioSamples(samples);
  }

  async stopScreenRecording(): Promise<string> {
    if (!recordingBackend) {
      return "";
    }

    const filePath = await recordingBackend.finish();
    recordingBackend = null;
    return filePath;
  }

  getSettingValue(id: string): unknown {
    return getSettingValue(id);
  }

  setSettingValue(id: string, value: unknown): unknown {
    setSettingValue(id, value);
    return getSettingValue(id);
  }

  getAllSettingValues(): Record<string, unknown> {
    return getAllSettingValues();
  }
}

export async function processRendererToMainMessages(
  message: RequestMessage,
  window: BrowserWindow
): Promise<ResponseMessage> {
  if (message.type === "ForwardAction") {
    mainStore.dispatch(message.action, message.sourceId);
    return defaultResponse();
  }

  if (message.targetId === "emu") {
    const response = await sendFromMainToEmu<ResponseMessage>(message);
    return response ?? errorResponse("Emulator window is not ready.");
  }

  if (message.targetId === "ide") {
    const response = await sendFromMainToIde<ResponseMessage>(message);
    return response ?? errorResponse("IDE window is not ready.");
  }

  const mainMessageProcessor = new MainMessageProcessor(window);
  const processingMethod = mainMessageProcessor[message.method as keyof MainMessageProcessor];
  if (typeof processingMethod !== "function") {
    return errorResponse(`Unknown method ${message.method}`);
  }

  try {
    return {
      type: "ApiMethodResponse",
      result: await (processingMethod as (...args: unknown[]) => unknown).call(
        mainMessageProcessor,
        ...message.args
      )
    };
  } catch (err) {
    console.error(`Error processing message (${message.method}):`, err);
    return errorResponse(String(err));
  }
}

function resolveMessagePath(filePath: string, resolveIn?: string): string {
  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  if (resolveIn === "public") {
    return getMainPublicPath(filePath);
  }

  return path.resolve(process.cwd(), filePath);
}
