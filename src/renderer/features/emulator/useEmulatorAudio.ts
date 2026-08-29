import { useCallback, useRef } from "react";
import { AudioRenderer, getBeeperContext, releaseBeeperContext } from "./AudioRenderer";

export function useEmulatorAudio() {
  const beeperRenderer = useRef<AudioRenderer>();

  const initAudio = useCallback(
    async (tactsInFrame: number, baseClockFrequency: number, audioSampleRate: number) => {
      if (!audioSampleRate) return;
      const samplesPerFrame = (tactsInFrame * audioSampleRate) / baseClockFrequency;
      await releaseBeeperContext();
      beeperRenderer.current = new AudioRenderer(await getBeeperContext(samplesPerFrame));
    },
    []
  );

  return { beeperRenderer, initAudio };
}
