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

  const samples = sampleGetter.call(machine).slice();
  audioRenderer.storeSamples(samples, soundLevel);
  await audioRenderer.play();
  await recordingManager?.submitAudioSamples?.(samples);
  return samples;
}
