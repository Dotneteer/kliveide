import { BrowserWindow, dialog, screen } from "electron";
import { mainStore } from "@main/main-store";
import { getKliveHomeBase } from "@main/portable";
import { setWindowRecordingStateAction } from "@state/actions";
import { recordingQualityToCrf } from "@common/utils/recordingCrf";
import type { IRecordingBackend } from "../IRecordingBackend";
import { FfmpegRecordingBackend } from "../FfmpegRecordingBackend";
import { StubRecordingBackend } from "../StubRecordingBackend";
import { isFFmpegAvailable } from "../ffmpegAvailable";
import { resolveRecordingPath } from "../outputPath";
import type { MouseButton } from "./ClickTracker";
import type { FrameImage } from "./WindowFrameSource";
import type { RecordedWindow } from "./WindowRecordingSession";
import { WindowRecordingSession } from "./WindowRecordingSession";
import { READ_THEME_COLORS_SCRIPT, toComposerColors } from "./themeColors";

/**
 * Starts and stops the IDE + Emulator recording from the main process (plan §5).
 *
 * The session itself is Electron-free; this module adapts the two `BrowserWindow`s to it, reads the
 * encoding preferences from the store (the same ones the emulator screen recording uses), and keeps
 * `emulatorState.windowRecordingState` up to date for the menu.
 */

/** Frame rate for "native" fps; "half" uses half of it (plan §4.2) */
export const WINDOW_RECORDING_FPS = 30;

/** Appended to both window titles while recording (outside the captured page, so not in the video) */
export const RECORDING_TITLE_SUFFIX = " — ● REC";

let session: WindowRecordingSession | null = null;
let starting = false;
let unsubscribeStore: (() => void) | null = null;
let titledWindows: { window: BrowserWindow; title: string }[] = [];

/** True while an IDE + Emulator recording is running (or starting) */
export function isWindowRecordingActive(): boolean {
  return session !== null || starting;
}

/** Forwards emulator sound to the running recording */
export function appendWindowRecordingAudio(samples: Float32Array): void {
  session?.appendAudio(samples);
}

/** Starts or stops the recording */
export async function toggleWindowRecording(
  emuWindow: BrowserWindow,
  ideWindow: BrowserWindow
): Promise<void> {
  if (isWindowRecordingActive()) {
    await stopWindowRecording();
  } else {
    await startWindowRecording(emuWindow, ideWindow);
  }
}

export async function startWindowRecording(
  emuWindow: BrowserWindow,
  ideWindow: BrowserWindow
): Promise<void> {
  if (isWindowRecordingActive()) return;
  const emulatorState = mainStore.getState().emulatorState;
  // --- One recording at a time (D8)
  if (emulatorState?.screenRecordingState && emulatorState.screenRecordingState !== "idle") return;
  if (!emuWindow || emuWindow.isDestroyed() || !ideWindow || ideWindow.isDestroyed()) return;
  if (!ideWindow.isVisible()) {
    await showError(emuWindow, "The IDE window must be visible to record the IDE and the emulator.");
    return;
  }

  starting = true;
  try {
    const colors = toComposerColors(await readThemeColors(ideWindow));
    const format = emulatorState?.screenRecordingFormat ?? "mp4";
    const outputPath = resolveRecordingPath(getKliveHomeBase(), format);
    const backend: IRecordingBackend = isFFmpegAvailable()
      ? new FfmpegRecordingBackend()
      : new StubRecordingBackend();
    const pointer = emulatorState?.windowRecordingPointer ?? true;

    const next = new WindowRecordingSession(
      {
        outputPath,
        idePosition: emulatorState?.windowRecordingIdePosition ?? "left",
        pointer,
        clicks: pointer && (emulatorState?.windowRecordingClicks ?? true),
        hiDpi: emulatorState?.windowRecordingHiDpi ?? false,
        fps:
          emulatorState?.screenRecordingFps === "half"
            ? WINDOW_RECORDING_FPS / 2
            : WINDOW_RECORDING_FPS,
        crf: recordingQualityToCrf(emulatorState?.screenRecordingQuality),
        format,
        sampleRate: emulatorState?.audioSampleRate || 44100,
        colors
      },
      {
        backend,
        ide: recordedWindow(ideWindow),
        emu: recordedWindow(emuWindow),
        clock: {
          now: () => performance.now(),
          setTimeout: (callback, ms) => setTimeout(callback, ms),
          clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>)
        },
        cursor: () => screen.getCursorScreenPoint(),
        mouseCaptured: () => !!mainStore.getState().emulatorState?.mouseCaptured,
        onAborted: () => void stopWindowRecording()
      }
    );
    next.start();
    session = next;

    // --- A machine switch changes the sound's sample rate: end the recording there
    const machineId = emulatorState?.machineId;
    unsubscribeStore = mainStore.subscribe(() => {
      if (session && mainStore.getState().emulatorState?.machineId !== machineId) {
        queueMicrotask(() => void stopWindowRecording());
      }
    });

    setRecordingTitles([emuWindow, ideWindow]);
    mainStore.dispatch(setWindowRecordingStateAction("recording", outputPath));
  } catch (err) {
    session = null;
    await showError(emuWindow, `The recording could not be started.\n\n${(err as Error)?.message ?? err}`);
  } finally {
    starting = false;
  }
}

/** Stops the recording and finalises the file; returns its path ("" when nothing was written) */
export async function stopWindowRecording(): Promise<string> {
  const current = session;
  if (!current) return "";
  session = null;
  unsubscribeStore?.();
  unsubscribeStore = null;
  restoreTitles();
  mainStore.dispatch(setWindowRecordingStateAction("idle"));
  try {
    const filePath = await current.stop();
    if (current.repeatedFrames > 0) {
      console.log(
        `[WindowRecording] ${current.repeatedFrames} of ${current.framesWritten} frames were repeats (the encoder fell behind)`
      );
    }
    return filePath;
  } catch (err) {
    await showError(
      BrowserWindow.getFocusedWindow() ?? undefined,
      `The recording could not be saved.\n\n${(err as Error)?.message ?? err}`
    );
    return "";
  }
}

// -----------------------------------------------------------------------------

async function readThemeColors(ideWindow: BrowserWindow): Promise<Record<string, string> | undefined> {
  try {
    return await ideWindow.webContents.executeJavaScript(READ_THEME_COLORS_SCRIPT, true);
  } catch {
    return undefined;
  }
}

async function showError(window: BrowserWindow | undefined, message: string): Promise<void> {
  const options = { type: "error" as const, title: "IDE + Emulator recording", message };
  if (window && !window.isDestroyed()) {
    await dialog.showMessageBox(window, options);
  } else {
    await dialog.showMessageBox(options);
  }
}

function setRecordingTitles(windows: BrowserWindow[]): void {
  restoreTitles();
  for (const window of windows) {
    if (window.isDestroyed()) continue;
    const title = window.getTitle();
    titledWindows.push({ window, title });
    window.setTitle(title + RECORDING_TITLE_SUFFIX);
  }
}

function restoreTitles(): void {
  for (const { window, title } of titledWindows) {
    if (!window.isDestroyed()) window.setTitle(title);
  }
  titledWindows = [];
}

function toMouseButton(button: unknown): MouseButton {
  return button === "right" ? "right" : button === "middle" ? "middle" : "left";
}

/** Adapts a BrowserWindow to what the session needs */
function recordedWindow(window: BrowserWindow): RecordedWindow {
  const contents = window.webContents;
  const alive = () => !window.isDestroyed() && !contents.isDestroyed();
  const off = (fn: () => void) => () => {
    try {
      fn();
    } catch {
      // --- The window may already be gone
    }
  };
  return {
    capture: {
      beginFrameSubscription: (callback) =>
        contents.beginFrameSubscription(false, (image) => callback(image as unknown as FrameImage)),
      endFrameSubscription: () => {
        if (alive()) contents.endFrameSubscription();
      },
      invalidate: () => {
        if (alive()) contents.invalidate();
      }
    },
    getContentBounds: () =>
      alive() ? window.getContentBounds() : { x: 0, y: 0, width: 0, height: 0 },
    getScaleFactor: () =>
      alive() ? screen.getDisplayMatching(window.getBounds()).scaleFactor : 1,
    isFocused: () => alive() && window.isFocused(),
    isDestroyed: () => !alive(),
    onMouseButton: (callback) => {
      // --- Electron declares the argument as InputEvent; mouse events carry MouseInputEvent's
      // --- `button` at run time (plan §4.4.1). A missing button counts as the left one.
      const handler = (_event: Electron.Event, input: Electron.InputEvent) => {
        if (input.type === "mouseDown" || input.type === "mouseUp") {
          callback(toMouseButton((input as Electron.MouseInputEvent).button), input.type === "mouseDown");
        }
      };
      contents.on("input-event", handler);
      return off(() => contents.off("input-event", handler));
    },
    onBlur: (callback) => {
      window.on("blur", callback);
      return off(() => window.off("blur", callback));
    },
    onClosed: (callback) => {
      window.on("closed", callback);
      return off(() => window.off("closed", callback));
    }
  };
}
