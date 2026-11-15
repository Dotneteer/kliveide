import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import { createPortal } from "react-dom";
import classnames from "classnames";

import { isChannelAudible } from "@common/audio/audioMixerModel";
import { SOUND_LEVELS } from "@common/machines/emulator-levels";
import { useT } from "@common/i18n/useT";
import { useOverlayRoot } from "@renderer/controls/overlay/useOverlayRoot";
import { useMainApi } from "@renderer/core/MainApi";
import { useSelector } from "@renderer/core/RendererProvider";
import { audioMixerMonitor } from "@renderer/features/emulator/audioMixerMonitor";
import { MixerCanvas, MuteSoloButtons, usePeakHold } from "./AudioMixerControls";
import { drawMeter, groupChannels, levelDb } from "./audioMixerView";
import { useAudioMixerFrame, useAudioMixerSettings } from "./useAudioMixer";
import styles from "./SoundPopover.module.scss";

/*
 * The emulator's sound popover (`dev/plans/AUDIO_MIXER_PLAN.md` §3.4, option C), from the chevron of
 * the toolbar's sound button: the sound level, then each source of the machine with mute, solo and a
 * level meter, and a way to the IDE's Audio Mixer document for the spectra. It reads the monitor in
 * this window directly; the settings are the shared global setting, so the document and the popover
 * show the same mutes.
 *
 * The frame takes the dropdown-menu aliases, the header and footer the dialog chrome idiom ("A
 * Menu-Like List With A Header" in `dev/ai/ui-theming-intent-and-lessons.md`).
 */

type Props = {
  /** The element the popover hangs from */
  anchor: HTMLElement | null;
  /** The emulator's sound level now */
  soundLevel: number | undefined;
  onSoundLevel: (value: number) => void;
  onClose: () => void;
};

export const SoundPopover = ({ anchor, soundLevel, onSoundLevel, onClose }: Props) => {
  const t = useT();
  const mainApi = useMainApi();
  const overlayRoot = useOverlayRoot();
  const boxRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number }>();
  const frame = useAudioMixerFrame(async () => audioMixerMonitor.requestFrame() ?? null);
  const holds = usePeakHold(frame);
  const mixer = useAudioMixerSettings();
  useSelector((s) => s.emulatorState?.machineId);

  useLayoutEffect(() => {
    const bounds = anchor?.getBoundingClientRect();
    setPosition(bounds ? { top: bounds.bottom + 4, left: Math.max(8, bounds.left - 160) } : { top: 48, left: 8 });
  }, [anchor]);

  // --- Close on a press outside the popover or its anchor (the chevron toggles it itself)
  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (boxRef.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    };
    document.addEventListener("mousedown", onPointerDown, true);
    return () => document.removeEventListener("mousedown", onPointerDown, true);
  }, [anchor, onClose]);

  // --- The popover takes the focus itself (so Escape closes it), not a button: a focus ring on the
  // --- first level would read as the chosen one
  useEffect(() => {
    if (position) boxRef.current?.focus();
  }, [position]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    onClose();
    anchor?.querySelector<HTMLButtonElement>("button")?.focus();
  };

  if (!position) return null;
  const ids = frame?.channels.map((c) => c.id) ?? [];

  const box = (
    <div
      ref={boxRef}
      className={styles.popover}
      style={{ top: position.top, left: position.left }}
      role="dialog"
      tabIndex={-1}
      aria-label={t("emu.soundPopover.title")}
      data-testid="sound-popover"
      onKeyDown={onKeyDown}
    >
      <div className={styles.header}>
        <span className={styles.title}>{t("emu.soundPopover.title")}</span>
      </div>
      <div className={styles.levels} role="group" aria-label={t("emu.soundPopover.volume")}>
        <span className={styles.levelsLabel}>{t("emu.soundPopover.volume")}</span>
        {SOUND_LEVELS.map((level) => (
          <button
            key={level.value}
            type="button"
            className={classnames(styles.level, level.value === soundLevel && styles.levelOn)}
            aria-pressed={level.value === soundLevel}
            onClick={() => onSoundLevel(level.value)}
          >
            {level.label}
          </button>
        ))}
      </div>
      <div className={styles.body}>
        {frame &&
          groupChannels(frame.channels).map((g) => (
            <div key={g.group}>
              <div className={styles.group}>
                <span className={styles.chip} style={{ background: `var(${g.hue})` }} />
                {t(g.channels[0].groupLabelKey)}
              </div>
              {g.channels.map((ch) => {
                const s = mixer.settings[ch.id] ?? {};
                const audible = isChannelAudible(ch.id, mixer.settings, ids);
                const name = t("panels.audioMixer.channelName", { group: t(ch.groupLabelKey), channel: t(ch.labelKey) });
                const db = levelDb(ch.peak);
                return (
                  <div key={ch.id} className={styles.row} data-testid={`sound-popover-row-${ch.id}`}>
                    <MuteSoloButtons
                      name={name}
                      mute={!!s.mute}
                      solo={!!s.solo}
                      onMute={() => void mixer.setChannel(ch.id, { mute: !s.mute })}
                      onSolo={() => void mixer.setChannel(ch.id, { solo: !s.solo })}
                    />
                    <span className={classnames(styles.name, !audible && styles.dim)} title={name}>
                      {t(ch.labelKey)}
                    </span>
                    <MixerCanvas
                      className={styles.meter}
                      draw={(c) => drawMeter(c, ch, holds[ch.id] ?? 0, { vertical: false, hue: g.hue, dim: !audible })}
                    />
                    <span className={styles.db}>
                      {Number.isFinite(db)
                        ? t("panels.audioMixer.db", { value: db.toFixed(0) })
                        : t("panels.audioMixer.dbSilent")}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
      </div>
      <div className={styles.footer}>
        <button type="button" className={styles.link} onClick={() => void mixer.unmuteAll()}>
          {t("emu.soundPopover.unmuteAll")}
        </button>
        <span className={styles.spacer} />
        <button
          type="button"
          className={styles.link}
          onClick={() => {
            onClose();
            void mainApi.runUiAction("open:audio-mixer");
          }}
        >
          {t("emu.soundPopover.openMixer")}
        </button>
      </div>
    </div>
  );

  return createPortal(box, overlayRoot ?? document.body);
};
