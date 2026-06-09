import { useCallback, useRef } from "react";
import { AudioRenderer, getBeeperContext, releaseBeeperContext } from "./AudioRenderer";

export function useEmulatorAudio() {
  const beeperRenderer = useRef<AudioRenderer | undefined>(undefined);

  const initAudio = useCallback(
    async (tactsInFrame: number, baseClockFrequency: number): Promise<number> => {
      await releaseBeeperContext();
      const audioInfo = await getBeeperContext(tactsInFrame, baseClockFrequency);
      beeperRenderer.current = new AudioRenderer(audioInfo);
      return audioInfo.sampleRate;
    },
    []
  );

  return { beeperRenderer, initAudio };
}
