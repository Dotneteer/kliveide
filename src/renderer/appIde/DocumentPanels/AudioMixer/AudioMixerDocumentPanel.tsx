import { useState } from "react";
import classnames from "classnames";

import type { AudioMixerChannelFrame, AudioMixerSettings } from "@common/audio/audioMixerModel";
import { isChannelAudible, MAX_CHANNEL_LEVEL } from "@common/audio/audioMixerModel";
import { useT } from "@common/i18n/useT";
import type { MessageKey } from "@common/i18n/keys.generated";
import { EmptyState } from "@renderer/controls/data";
import { FullPanel } from "@renderer/controls/layout/Panels";
import ScrollViewer from "@renderer/controls/ScrollViewer";
import { useEmuApi } from "@renderer/core/EmuApi";
import type { DocumentProps } from "@renderer/features/documents/DocumentsContainer";
import { MixerCanvas, MuteSoloButtons, usePeakHold } from "@renderer/features/audioMixer/AudioMixerControls";
import {
  drawMeter,
  drawScope,
  drawSpectrogramColumn,
  drawSpectrum,
  groupChannels,
  levelDb,
  strongestHz
} from "@renderer/features/audioMixer/audioMixerView";
import { useAudioMixerFrame, useAudioMixerSettings } from "@renderer/features/audioMixer/useAudioMixer";
import styles from "./AudioMixerDocument.module.scss";

/*
 * The Audio Mixer document (`dev/plans/AUDIO_MIXER_PLAN.md` §3.4, option B): one strip per sound source
 * of the machine, grouped by chip - its name, a small spectrum, a level meter beside its fader, its
 * level in dB, mute and solo - then the Output strip (what is heard), and below an analyser for the
 * selected source: its spectrum, waveform or spectrogram, and its facts.
 *
 * The measures come from the emulator (`getAudioMixerFrame`, about 30 times a second while the
 * document is open); the mute, solo and fader settings are the machine type's, in a global setting
 * that the emulator turns into the machine's gains.
 */

type AnalyserMode = "spectrum" | "scope" | "spectrogram";
const MODES: AnalyserMode[] = ["spectrum", "scope", "spectrogram"];
const MODE_KEYS: Record<AnalyserMode, MessageKey> = {
  spectrum: "panels.audioMixer.mode.spectrum",
  scope: "panels.audioMixer.mode.scope",
  spectrogram: "panels.audioMixer.mode.spectrogram"
};

const AudioMixerDocumentPanel = (_props: DocumentProps) => {
  const t = useT();
  const emuApi = useEmuApi();
  const frame = useAudioMixerFrame(() => emuApi.getAudioMixerFrame());
  const holds = usePeakHold(frame);
  const mixer = useAudioMixerSettings();
  const [selected, setSelected] = useState<string>();
  const [mode, setMode] = useState<AnalyserMode>("spectrum");

  if (!mixer.machineId || frame === null || frame === undefined) {
    const message = !mixer.machineId
      ? t("panels.audioMixer.noMachine")
      : frame === null
        ? t("panels.audioMixer.noSound")
        : t("panels.audioMixer.waiting");
    return (
      <FullPanel>
        <EmptyState message={message} />
      </FullPanel>
    );
  }

  const ids = frame.channels.map((c) => c.id);
  const groups = groupChannels(frame.channels);
  const hueOf = (id: string) => groups.find((g) => g.channels.some((c) => c.id === id))?.hue ?? "--accent-solid";
  const nameOf = (ch: AudioMixerChannelFrame) =>
    t("panels.audioMixer.channelName", { group: t(ch.groupLabelKey), channel: t(ch.labelKey) });
  const current = frame.channels.find((c) => c.id === selected) ?? frame.channels[0];

  return (
    <FullPanel>
      <div className={styles.document} data-testid="audio-mixer-document">
        <div className={styles.toolbar}>
          <span className={styles.spacer} />
          <button type="button" className={styles.link} onClick={() => void mixer.unmuteAll()}>
            {t("panels.audioMixer.unmuteAll")}
          </button>
          <button
            type="button"
            className={styles.link}
            title={t("panels.audioMixer.resetTitle")}
            onClick={() => void mixer.reset()}
          >
            {t("panels.audioMixer.reset")}
          </button>
        </div>

        {/* --- The strips scroll sideways when the document is narrow (the Next has twenty) */}
        <ScrollViewer allowVertical={false} thinScrollBar={true} className={styles.stripsScroller}>
          <div className={styles.strips}>
            {groups.map((g) => (
              <div key={g.group} className={styles.group}>
                <div className={styles.groupLabel} style={{ borderColor: `var(${g.hue})` }}>
                  {t(g.channels[0].groupLabelKey)}
                </div>
                <div className={styles.groupStrips}>
                  {g.channels.map((ch) => (
                    <ChannelStrip
                      key={ch.id}
                      channel={ch}
                      hue={g.hue}
                      name={nameOf(ch)}
                      hold={holds[ch.id] ?? 0}
                      selected={ch.id === current?.id}
                      audible={isChannelAudible(ch.id, mixer.settings, ids)}
                      settings={mixer.settings}
                      onSelect={() => setSelected(ch.id)}
                      onChange={(change) => void mixer.setChannel(ch.id, change)}
                    />
                  ))}
                </div>
              </div>
            ))}
            <div className={styles.group}>
              <div className={styles.groupLabel} style={{ borderColor: "var(--accent-solid)" }}>
                {t("panels.audioMixer.output")}
              </div>
              <div className={styles.groupStrips}>
                <div className={classnames(styles.strip, styles.output)} title={t("panels.audioMixer.outputTitle")}>
                  <span className={styles.stripName}>{t("panels.audioMixer.output")}</span>
                  <MixerCanvas
                    className={styles.miniSpectrum}
                    draw={(c) => drawSpectrum(c, frame.output.spectrum, { hue: "--accent-solid", dim: false })}
                  />
                  <div className={styles.meterRow}>
                    <MixerCanvas
                      className={styles.meter}
                      testId="audio-mixer-output-meter"
                      draw={(c) =>
                        drawMeter(c, frame.output, holds["*"] ?? 0, { vertical: true, hue: "--accent-solid", dim: false })
                      }
                    />
                  </div>
                  <span className={styles.db}>{formatDb(t, frame.output.peak)}</span>
                </div>
              </div>
            </div>
          </div>
        </ScrollViewer>

        {current && (
          <div className={styles.analyser}>
            <div className={styles.analyserMain}>
              <div className={styles.analyserHeader}>
                <span className={styles.analyserTitle}>{nameOf(current)}</span>
                <span className={styles.modes} role="group">
                  {MODES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      className={classnames(styles.mode, m === mode && styles.modeOn)}
                      aria-pressed={m === mode}
                      onClick={() => setMode(m)}
                    >
                      {t(MODE_KEYS[m])}
                    </button>
                  ))}
                </span>
              </div>
              <MixerCanvas
                key={`${current.id}-${mode}`}
                className={styles.analyserCanvas}
                testId="audio-mixer-analyser"
                draw={(c) => {
                  const hue = hueOf(current.id);
                  if (mode === "spectrum") {
                    drawSpectrum(c, current.spectrum, { hue, dim: false, grid: { sampleRate: frame.sampleRate } });
                  } else if (mode === "scope") {
                    drawScope(c, current.scope, { hue });
                  } else {
                    drawSpectrogramColumn(c, current.spectrum, { hue });
                  }
                }}
              />
            </div>
            <dl className={styles.facts}>
              <dt>{t("panels.audioMixer.info.channel")}</dt>
              <dd>{nameOf(current)}</dd>
              <dt>{t("panels.audioMixer.info.state")}</dt>
              <dd>{stateText(t, current.id, mixer.settings, ids)}</dd>
              <dt>{t("panels.audioMixer.info.peak")}</dt>
              <dd className={styles.value}>{formatDb(t, current.peak)}</dd>
              <dt>{t("panels.audioMixer.info.rms")}</dt>
              <dd className={styles.value}>{formatDb(t, current.rms)}</dd>
              <dt>{t("panels.audioMixer.info.strongest")}</dt>
              <dd className={styles.value}>{formatHz(t, strongestHz(current, frame.sampleRate))}</dd>
              <dt>{t("panels.audioMixer.info.gain")}</dt>
              <dd className={styles.value}>
                {t("panels.audioMixer.percent", { value: Math.round(current.gain * 100) })}
              </dd>
            </dl>
          </div>
        )}
      </div>
    </FullPanel>
  );
};

type Translate = ReturnType<typeof useT>;

const ChannelStrip = ({
  channel,
  hue,
  name,
  hold,
  selected,
  audible,
  settings,
  onSelect,
  onChange
}: {
  channel: AudioMixerChannelFrame;
  hue: string;
  name: string;
  hold: number;
  selected: boolean;
  audible: boolean;
  settings: AudioMixerSettings;
  onSelect: () => void;
  onChange: (change: { mute?: boolean; solo?: boolean; level?: number }) => void;
}) => {
  const t = useT();
  const s = settings[channel.id] ?? {};
  const level = s.level ?? 1;
  return (
    <div
      className={classnames(styles.strip, selected && styles.selected)}
      data-testid={`audio-mixer-strip-${channel.id}`}
      onClick={onSelect}
    >
      <span className={classnames(styles.stripName, !audible && styles.dim)} title={name}>
        {t(channel.labelKey)}
      </span>
      <MixerCanvas
        className={styles.miniSpectrum}
        draw={(c) => drawSpectrum(c, channel.spectrum, { hue, dim: !audible })}
      />
      <div className={styles.meterRow}>
        <MixerCanvas
          className={styles.meter}
          draw={(c) => drawMeter(c, channel, hold, { vertical: true, hue, dim: !audible })}
        />
        <input
          type="range"
          className={styles.fader}
          min={0}
          max={MAX_CHANNEL_LEVEL * 100}
          step={1}
          value={Math.round(level * 100)}
          title={t("panels.audioMixer.faderTitle", { channel: name })}
          aria-label={t("panels.audioMixer.faderTitle", { channel: name })}
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => onChange({ level: Number(e.target.value) / 100 })}
        />
      </div>
      <span className={styles.db}>{formatDb(t, channel.peak)}</span>
      <MuteSoloButtons
        name={name}
        mute={!!s.mute}
        solo={!!s.solo}
        onMute={() => onChange({ mute: !s.mute })}
        onSolo={() => onChange({ solo: !s.solo })}
      />
    </div>
  );
};

function formatDb(t: Translate, level: number): string {
  const db = levelDb(level);
  return Number.isFinite(db) ? t("panels.audioMixer.db", { value: db.toFixed(1) }) : t("panels.audioMixer.dbSilent");
}

function formatHz(t: Translate, hz: number | undefined): string {
  return hz === undefined ? t("panels.audioMixer.none") : t("panels.audioMixer.hz", { value: hz });
}

function stateText(t: Translate, id: string, settings: AudioMixerSettings, ids: string[]): string {
  const s = settings[id];
  if (s?.solo) return t("panels.audioMixer.state.soloed");
  if (!isChannelAudible(id, settings, ids)) {
    return s?.mute ? t("panels.audioMixer.state.muted") : t("panels.audioMixer.state.soloedOut");
  }
  return t("panels.audioMixer.state.playing");
}

export const createAudioMixerDocumentPanel = ({ document, viewState }: DocumentProps) => (
  <AudioMixerDocumentPanel document={document} viewState={viewState} />
);
