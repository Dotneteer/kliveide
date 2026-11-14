import { useEffect, useRef } from "react";
import classnames from "classnames";

import type { AudioMixerFrame } from "@common/audio/audioMixerModel";
import { useT } from "@common/i18n/useT";
import styles from "./AudioMixerControls.module.scss";

/*
 * The audio mixer views' shared controls (`dev/plans/AUDIO_MIXER_PLAN.md` §3.4): a canvas redrawn at
 * every render, the mute/solo pair, and the meters' peak hold.
 */

/** A canvas that `draw` paints after every render (its size comes from its CSS box) */
export const MixerCanvas = ({
  draw,
  className,
  testId
}: {
  draw: (canvas: HTMLCanvasElement) => void;
  className?: string;
  testId?: string;
}) => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) draw(ref.current);
  });
  return <canvas ref={ref} className={className} data-testid={testId} />;
};

/** A source's mute and solo buttons */
export const MuteSoloButtons = ({
  name,
  mute,
  solo,
  onMute,
  onSolo
}: {
  name: string;
  mute: boolean;
  solo: boolean;
  onMute: () => void;
  onSolo: () => void;
}) => {
  const t = useT();
  return (
    <span className={styles.muteSolo} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className={classnames(styles.mute, mute && styles.on)}
        aria-pressed={mute}
        title={t("panels.audioMixer.muteTitle", { channel: name })}
        aria-label={t("panels.audioMixer.muteTitle", { channel: name })}
        onClick={onMute}
      >
        {t("panels.audioMixer.mute")}
      </button>
      <button
        type="button"
        className={classnames(styles.solo, solo && styles.on)}
        aria-pressed={solo}
        title={t("panels.audioMixer.soloTitle", { channel: name })}
        aria-label={t("panels.audioMixer.soloTitle", { channel: name })}
        onClick={onSolo}
      >
        {t("panels.audioMixer.solo")}
      </button>
    </span>
  );
};

/** Each channel's held peak (and the output's, as "*"): it falls about 6 dB a second */
export function usePeakHold(frame: AudioMixerFrame | null | undefined): Record<string, number> {
  const holds = useRef<Record<string, number>>({});
  const last = useRef(performance.now());
  const now = performance.now();
  const decay = Math.pow(0.5, (now - last.current) / 1000);
  last.current = now;
  if (frame) {
    const next: Record<string, number> = {};
    for (const ch of frame.channels) next[ch.id] = Math.max(ch.peak, (holds.current[ch.id] ?? 0) * decay);
    next["*"] = Math.max(frame.output.peak, (holds.current["*"] ?? 0) * decay);
    holds.current = next;
  }
  return holds.current;
}
