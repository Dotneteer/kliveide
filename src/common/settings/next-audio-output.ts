/**
 * Which of the ZX Spectrum Next's sound outputs Klive plays.
 *
 * The Next makes one stereo sum and sends it out three ways at once, each built differently: the
 * audio jack (the sum's low 12 bits, so a very loud mix wraps around), the internal speaker (one mono
 * mix, switched by NextReg `$08` bit 4, or only the beeper with NextReg `$06` bit 6) and HDMI (the
 * whole sum, 48,000 samples a second, silenced by NextReg `$09` bit 2). Klive has one stream for the
 * host's sound card, so it plays the one chosen here, the jack unless asked otherwise. The core does
 * the work (`zxnext-audio-mixer.c`); the Machine menu and the Settings dialog both read this table.
 */
import { withLabels } from "@common/i18n/labels";
import type { MessageKey } from "@common/i18n/keys.generated";

export type NextAudioOutput = "jack" | "speaker" | "hdmi";

export type NextAudioOutputOption = {
  /** Label in the Machine menu and the Settings dialog; translated each time it is read */
  readonly label: string;
  readonly labelKey: MessageKey;
  value: NextAudioOutput;
};

export const NEXT_AUDIO_OUTPUTS: NextAudioOutputOption[] = withLabels<{ labelKey: MessageKey; value: NextAudioOutput }>([
  { labelKey: "common.nextAudioOutput.jack", value: "jack" },
  { labelKey: "common.nextAudioOutput.speaker", value: "speaker" },
  { labelKey: "common.nextAudioOutput.hdmi", value: "hdmi" }
]);

export const DEFAULT_NEXT_AUDIO_OUTPUT: NextAudioOutput = "jack";

/** A stored value as a known output; anything else is the default */
export function normalizeNextAudioOutput(value: unknown): NextAudioOutput {
  return value === "speaker" || value === "hdmi" ? value : DEFAULT_NEXT_AUDIO_OUTPUT;
}

/** The core's number for an output (`ZXNEXT_AUDIO_OUT_*` in `zxnext-audio-mixer.h`) */
export function nextAudioOutputIndex(value: unknown): number {
  const output = normalizeNextAudioOutput(value);
  return output === "speaker" ? 1 : output === "hdmi" ? 2 : 0;
}
