import { useCallback, useRef } from "react";
import { AudioRenderer, getBeeperContext, releaseBeeperContext } from "./AudioRenderer";

export function useEmulatorAudio() {
  const beeperRenderer = useRef<AudioRenderer>();

  /**
   * Sets up the audio output for a machine.
   *
   * @param framesPerBurst The machine's `uiFrameFrequency`: how many frames the controller runs back
   * to back before it sleeps. Their samples reach the worklet together, so the worklet sizes its
   * buffer in these bursts, not in frames. A Cambridge Z88 frame is 5 ms and it runs eight at a time;
   * a buffer sized in frames held under half of each 40 ms burst and dropped the rest, which is what
   * made its sound choppy (issue #1374). With one frame per burst, as on every other machine, the
   * two are the same.
   */
  const initAudio = useCallback(
    async (
      tactsInFrame: number,
      baseClockFrequency: number,
      audioSampleRate: number,
      framesPerBurst = 1
    ) => {
      if (!audioSampleRate) return;
      const samplesPerBurst =
        ((tactsInFrame * audioSampleRate) / baseClockFrequency) * Math.max(1, framesPerBurst);
      await releaseBeeperContext();
      beeperRenderer.current = new AudioRenderer(await getBeeperContext(samplesPerBurst));
    },
    []
  );

  return { beeperRenderer, initAudio };
}
