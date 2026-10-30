import { useCallback, useRef } from "react";
import { AudioRenderer, getBeeperContext, releaseBeeperContext } from "./AudioRenderer";

/**
 * The samples in one burst of a machine's audio: a frame's time, `tactsInFrame` divided by the frame's
 * tact multiplier, at the base clock, times the sample rate, times the frames in a burst. The ZX Spectrum
 * Next counts its frame in 28 MHz clocks, eight to its 3.5 MHz base clock (`frameTactMultiplier` 8);
 * without the division its burst came out eight times too large, and so did the worklet's hold-back,
 * which delayed its sound by about half a second.
 */
export function audioSamplesPerBurst(
  tactsInFrame: number,
  baseClockFrequency: number,
  audioSampleRate: number,
  framesPerBurst = 1,
  frameTactMultiplier = 1
): number {
  const frameSeconds = tactsInFrame / Math.max(1, frameTactMultiplier) / baseClockFrequency;
  return frameSeconds * audioSampleRate * Math.max(1, framesPerBurst);
}

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
   * @param frameTactMultiplier The machine's `frameTactMultiplier`: `tactsInFrame` counts that many
   * ticks per base-clock tact (8 on the ZX Spectrum Next, whose frame is in 28 MHz clocks).
   */
  const initAudio = useCallback(
    async (
      tactsInFrame: number,
      baseClockFrequency: number,
      audioSampleRate: number,
      framesPerBurst = 1,
      frameTactMultiplier = 1
    ) => {
      if (!audioSampleRate) return;
      const samplesPerBurst = audioSamplesPerBurst(
        tactsInFrame,
        baseClockFrequency,
        audioSampleRate,
        framesPerBurst,
        frameTactMultiplier
      );
      // --- Drop the renderer before its context closes: a machine started while the new context is
      // --- still being built (a `.z88` snapshot runs straight after the machine it needed is set up)
      // --- must find no renderer, not one whose context is closed ("Cannot resume a closed
      // --- AudioContext"). Every full frame calls `play()`, so the new renderer starts by itself.
      beeperRenderer.current = undefined;
      await releaseBeeperContext();
      beeperRenderer.current = new AudioRenderer(await getBeeperContext(samplesPerBurst));
    },
    []
  );

  return { beeperRenderer, initAudio };
}
