import type { AudioSample } from "@emu/abstractions/IAudioDevice";
import type { AudioRenderer } from "./AudioRenderer";

type AudioFrameSource = {
  getAudioSamples?: () => AudioSample[];
};

type AudioFrameRecorder = {
  submitAudioSamples?: (samples: AudioSample[]) => Promise<void> | void;
};

/**
 * Copies the machine's current frame audio into the browser renderer and recorder.
 */
export async function renderMachineAudioFrame(
  machine: AudioFrameSource,
  audioRenderer: Pick<AudioRenderer, "storeSamples" | "play"> | undefined,
  soundLevel: number,
  recordingManager?: AudioFrameRecorder
): Promise<AudioSample[]> {
  const sampleGetter = machine.getAudioSamples;
  if (!audioRenderer || typeof sampleGetter !== "function") {
    return [];
  }

  /*
   * A snapshot of the *values*, taken before the first await.
   *
   * A machine may reuse its sample objects from frame to frame (the Cambridge Z88 does), and the
   * controller runs `uiFrameFrequency` frames back to back without yielding - eight on the Z88. The
   * speaker got each frame's samples synchronously, but the recorder got them after `play()`, by
   * which time every frame of the burst had been overwritten by the last one. A copy of the array
   * alone (`slice()`) kept those shared objects, so a recorded beep was one 5 ms slice repeated: a
   * thump instead of the tone (issue #1374).
   */
  const samples = sampleGetter.call(machine).map(({ left, right }) => ({ left, right }));
  audioRenderer.storeSamples(samples, soundLevel);
  await audioRenderer.play();
  await recordingManager?.submitAudioSamples?.(samples);
  return samples;
}
