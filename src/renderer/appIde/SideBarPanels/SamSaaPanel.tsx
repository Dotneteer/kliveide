import { useState } from "react";
import { HistoryPresentBanner } from "../debugger/history/HistoryPresentBanner";
import { useEmuStateListener } from "../useStateRefresh";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useT } from "@common/i18n/useT";
import type { MessageKey } from "@common/i18n/keys.generated";
import { FlagValue, SimpleValue } from "@renderer/controls/data/registers";
import { DataPanel, DataRow, EmptyState, SectionHeader } from "@renderer/controls/data";
import regStyles from "@renderer/controls/data/Registers.module.scss";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import type { SamSaaDebugState } from "@emu/machines/samcoupe/SamDebugState";

/** The token every value in this panel is drawn with, as in the other converted state panels */
const VALUE_FILL = "--color-state-value";

/** The noise generators' clock sources, by register 16h's field */
const NOISE_SOURCES: MessageKey[] = [
  "panels.side.samSaa.noise31k",
  "panels.side.samSaa.noise15k",
  "panels.side.samSaa.noise7k",
  "panels.side.samSaa.noiseTone"
];

/** The envelope shapes, by bits 3-1 of 18h/19h */
const SHAPES: MessageKey[] = [
  "panels.side.samSaa.shapeZero",
  "panels.side.samSaa.shapeMax",
  "panels.side.samSaa.shapeDecay",
  "panels.side.samSaa.shapeRepeatDecay",
  "panels.side.samSaa.shapeTriangle",
  "panels.side.samSaa.shapeRepeatTriangle",
  "panels.side.samSaa.shapeAttack",
  "panels.side.samSaa.shapeRepeatAttack"
];

/** A frequency with one decimal */
const formatHz = (value: number) => (Math.round(value * 10) / 10).toString();

/**
 * The SAM Coupé's SAA 1099 (`dev/plans/SAM_COUPE_PLAN.md` §11): sound enable and sync, each of the six
 * channels decoded (frequency, octave and offset, amplitudes, tone and noise enables), the noise
 * generators' sources and the two envelopes.
 */
export const SamSaaPanel = () => {
  const t = useT();
  const emuApi = useEmuApi();
  const [state, setState] = useState<SamSaaDebugState>(null);

  useEmuStateListener(emuApi, async () => setState(await emuApi.getSamSaaState()));

  if (!state) {
    return (
      <DataPanel autoHeight>
        <EmptyState message={t("panels.side.samSaa.notAvailable")} />
      </DataPanel>
    );
  }

  return (
    <DataPanel autoHeight>
      <HistoryPresentBanner subject="samSaa" />
      <SectionHeader title={t("panels.side.samSaa.control")} />
      <DataRow dense>
        <FlagValue label="SE" value={state.soundEnabled} tooltip={t("panels.side.samSaa.soundEnable")} iconFill={VALUE_FILL} />
        <FlagValue label="SYNC" value={state.sync} tooltip={t("panels.side.samSaa.sync")} iconFill={VALUE_FILL} />
      </DataRow>
      <DataRow dense>
        <SimpleValue label="ADDR" value={toHexa2(state.address)} tooltip={t("panels.side.samSaa.address")} valueXclass={regStyles.stateValue} />
      </DataRow>

      {state.channels.map((ch, index) => (
        <div key={index}>
          <SectionHeader title={t("panels.side.samSaa.channel", { index })} />
          <DataRow dense>
            <SimpleValue
              label="FREQ"
              value={t("panels.side.samSaa.hz", { value: formatHz(ch.frequency) })}
              tooltip={t("panels.side.samSaa.frequency")}
              valueXclass={regStyles.stateValue}
              fullWidth
            />
          </DataRow>
          <DataRow dense>
            <SimpleValue label="OCT" value={ch.octave} tooltip={t("panels.side.samSaa.octave")} valueXclass={regStyles.stateValue} />
            <SimpleValue label="OFS" value={ch.offset} tooltip={t("panels.side.samSaa.offset")} valueXclass={regStyles.stateValue} />
          </DataRow>
          <DataRow dense>
            <SimpleValue label="L" value={ch.amplitudeLeft} tooltip={t("panels.side.samSaa.left")} valueXclass={regStyles.stateValue} />
            <SimpleValue label="R" value={ch.amplitudeRight} tooltip={t("panels.side.samSaa.right")} valueXclass={regStyles.stateValue} />
          </DataRow>
          <DataRow dense>
            <FlagValue label="TONE" value={ch.toneEnabled} tooltip={t("panels.side.samSaa.toneEnable")} iconFill={VALUE_FILL} />
            <FlagValue label="NOIS" value={ch.noiseEnabled} tooltip={t("panels.side.samSaa.noiseEnable")} iconFill={VALUE_FILL} />
          </DataRow>
        </div>
      ))}

      <SectionHeader title={t("panels.side.samSaa.noise")} />
      {state.noiseSources.map((source, gen) => (
        <DataRow dense key={gen}>
          <SimpleValue
            label={`N${gen}`}
            value={t(NOISE_SOURCES[source], { index: gen === 0 ? 0 : 3 })}
            tooltip={t("panels.side.samSaa.noiseSource", { index: gen })}
            valueXclass={regStyles.stateValue}
            fullWidth
          />
        </DataRow>
      ))}

      {state.envelopes.map((env, g) => (
        <div key={g}>
          <SectionHeader title={t("panels.side.samSaa.envelope", { index: g, channel: g === 0 ? 2 : 5 })} />
          <DataRow dense>
            <FlagValue label="EN" value={env.enabled} tooltip={t("panels.side.samSaa.envEnable")} iconFill={VALUE_FILL} />
            <SimpleValue label="LVL" value={env.level} tooltip={t("panels.side.samSaa.envLevel")} valueXclass={regStyles.stateValue} />
          </DataRow>
          <DataRow dense>
            <SimpleValue
              label="SHP"
              value={t(SHAPES[env.shape])}
              tooltip={t("panels.side.samSaa.envShape")}
              valueXclass={regStyles.stateValue}
              fullWidth
            />
          </DataRow>
          <DataRow dense>
            <FlagValue label="3BIT" value={env.threeBit} tooltip={t("panels.side.samSaa.envResolution")} iconFill={VALUE_FILL} />
            <FlagValue label="EXT" value={env.externalClock} tooltip={t("panels.side.samSaa.envClock")} iconFill={VALUE_FILL} />
          </DataRow>
          <DataRow dense>
            <FlagValue label="MIR" value={env.mirrored} tooltip={t("panels.side.samSaa.envMirror")} iconFill={VALUE_FILL} />
            <SimpleValue label="POS" value={env.position} tooltip={t("panels.side.samSaa.envPosition")} valueXclass={regStyles.stateValue} />
          </DataRow>
        </div>
      ))}
    </DataPanel>
  );
};
