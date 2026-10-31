import { useState } from "react";
import { HistoryPresentBanner } from "../debugger/history/HistoryPresentBanner";
import { useEmuStateListener } from "../useStateRefresh";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useT } from "@common/i18n/useT";
import type { MessageKey } from "@common/i18n/keys.generated";
import { Bit8Value, BitValue, FlagValue, SimpleValue } from "@renderer/controls/data/registers";
import { DataLabel, DataPanel, DataRow, DataSecondary, DataValue, EmptyState, SectionHeader } from "@renderer/controls/data";
import regStyles from "@renderer/controls/data/Registers.module.scss";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import type { EpDaveDebugState } from "@emu/machines/enterprise/EpDebugState";
import styles from "./EpChipPanels.module.scss";

/** The token every value in this panel is drawn with, as in the other converted state panels */
const VALUE_FILL = "--color-state-value";

/** The selectable interrupt source's names, by A7h bits 6-5 */
const INT_SOURCES: MessageKey[] = [
  "panels.side.epDave.intSource.k1",
  "panels.side.epDave.intSource.hz50",
  "panels.side.epDave.intSource.tone0",
  "panels.side.epDave.intSource.tone1"
];

/** The wait modes, by BFh bits 3-2 */
const WAIT_MODES: MessageKey[] = [
  "panels.side.epDave.waitAll",
  "panels.side.epDave.waitM1",
  "panels.side.epDave.waitNone",
  "panels.side.epDave.waitNone"
];

/** The interrupt rows: their names (hardware names) and tooltips */
const INT_ROWS: { name: string; tooltip: MessageKey }[] = [
  { name: "SEL", tooltip: "panels.side.epDave.intSelectable" },
  { name: "1HZ", tooltip: "panels.side.epDave.int1Hz" },
  { name: "INT1", tooltip: "panels.side.epDave.intInt1" },
  { name: "INT2", tooltip: "panels.side.epDave.intInt2" }
];

/** A frequency with at most `digits` decimals */
const formatNumber = (value: number, digits = 1) => {
  const scale = 10 ** digits;
  return (Math.round(value * scale) / scale).toString();
};

/** A port's name, e.g. `A7h` */
const portName = (port: number) => `${toHexa2(port)}h`;

/**
 * The Enterprise 64/128's DAVE (`.plans/ENTERPRISE_PLAN.md` §11): the page registers with their
 * segments, the interrupt sources (B4h), BFh decoded, the three tone channels and the noise channel
 * decoded, the D/A bits and the sound registers as written.
 */
export const EpDavePanel = () => {
  const t = useT();
  const emuApi = useEmuApi();
  const [state, setState] = useState<EpDaveDebugState>(null);

  useEmuStateListener(emuApi, async () => setState(await emuApi.getEpDaveState()));

  if (!state) {
    return (
      <DataPanel autoHeight>
        <EmptyState message={t("panels.side.epDave.notAvailable")} />
      </DataPanel>
    );
  }

  const hz = (value: number) => t("panels.side.epDave.hz", { value: formatNumber(value) });
  const poly = (distortion: number) => {
    if (distortion === 0) return t("panels.side.epDave.distNone");
    const bits = distortion === 1 ? 4 : distortion === 2 ? 5 : state.noise.swapPolys ? state.noise.polyBits : 7;
    return t("panels.side.epDave.distPoly", { bits });
  };

  return (
    <DataPanel autoHeight>
      <HistoryPresentBanner subject="epDave" />
      <SectionHeader title={t("panels.side.epDave.paging")} />
      {state.pages.map((segment, page) => {
        const start = page * 0x4000;
        const tooltip = t("panels.side.epDave.page", {
          page,
          port: portName(0xb0 + page),
          range: `${toHexa2(start >> 8)}00h-${toHexa2((start + 0x3fff) >> 8)}FFh`
        });
        const label = state.pageLabels[page];
        return (
          <DataRow dense key={page}>
            <DataLabel text={`B${page}`} title={tooltip} xclass={regStyles.regLabel} />
            <DataValue text={toHexa2(segment)} title={tooltip} xclass={regStyles.stateValue} />
            {label && label !== toHexa2(segment) && <DataSecondary text={label} title={tooltip} />}
          </DataRow>
        );
      })}

      <SectionHeader title={t("panels.side.epDave.interrupts")} />
      <DataRow dense>
        <span className={styles.intName} />
        <DataLabel text="EN" title={t("panels.side.epDave.enabled")} xclass={styles.intFlag} />
        <DataLabel text="LAT" title={t("panels.side.epDave.latched")} xclass={styles.intFlag} />
        <DataLabel text="PIN" title={t("panels.side.epDave.level")} xclass={styles.intFlag} />
      </DataRow>
      {INT_ROWS.map((row, i) => {
        const source = state.interrupts[i];
        const tooltip =
          i === 0 ? t(row.tooltip, { source: t(INT_SOURCES[state.intSelect]) }) : t(row.tooltip);
        return (
          <DataRow dense key={row.name}>
            <DataLabel text={row.name} title={tooltip} xclass={styles.intName} />
            <BitValue value={source.enabled} tooltip={t("panels.side.epDave.enabled")} iconFill={VALUE_FILL} xclass={styles.intFlag} />
            <BitValue value={source.latched} tooltip={t("panels.side.epDave.latched")} iconFill={VALUE_FILL} xclass={styles.intFlag} />
            <BitValue value={source.level} tooltip={t("panels.side.epDave.level")} iconFill={VALUE_FILL} xclass={styles.intFlag} />
          </DataRow>
        );
      })}
      <DataRow dense>
        <SimpleValue
          label="SRC"
          value={t(INT_SOURCES[state.intSelect])}
          tooltip={t("panels.side.epDave.intSourceLabel")}
          valueXclass={regStyles.stateValue}
          fullWidth
        />
      </DataRow>
      <DataRow dense>
        <Bit8Value label="B4" value={state.b4} tooltip={t("panels.side.epDave.b4")} valueXclass={regStyles.stateValue} />
      </DataRow>

      <SectionHeader title={t("panels.side.epDave.system")} />
      <DataRow dense>
        <Bit8Value label="BF" value={state.bf} tooltip={t("panels.side.epDave.bf")} valueXclass={regStyles.stateValue} />
        <SimpleValue
          label="RAM"
          value={state.ram16K ? "16K" : "64K"}
          tooltip={t("panels.side.epDave.ram")}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="WAIT"
          value={t(WAIT_MODES[state.waitMode])}
          tooltip={t("panels.side.epDave.wait")}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="CLK"
          value={t("panels.side.epDave.mhz", { value: state.clock12MHz ? 12 : 8 })}
          tooltip={t("panels.side.epDave.clock")}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="TICK"
          value={hz(state.tickHz)}
          tooltip={t("panels.side.epDave.tick")}
          valueXclass={regStyles.stateValue}
          fullWidth
        />
      </DataRow>

      {state.tones.map((tone, ch) => (
        <div key={ch}>
          <SectionHeader title={t("panels.side.epDave.channel", { index: ch })} />
          <DataRow dense>
            <SimpleValue
              label="CODE"
              value={tone.code.toString(16).toUpperCase().padStart(3, "0")}
              tooltip={t("panels.side.epDave.code", { low: portName(0xa0 + 2 * ch), high: portName(0xa1 + 2 * ch) })}
              valueXclass={regStyles.stateValue}
            />
            <SimpleValue
              label="FREQ"
              value={hz(tone.frequency)}
              tooltip={t("panels.side.epDave.frequency")}
              valueXclass={regStyles.stateValue}
            />
          </DataRow>
          <DataRow dense>
            <SimpleValue
              label="DIST"
              value={poly(tone.distortion)}
              tooltip={t("panels.side.epDave.distortion")}
              valueXclass={regStyles.stateValue}
            />
            <FlagValue label="SYNC" value={tone.sync} tooltip={t("panels.side.epDave.sync")} iconFill={VALUE_FILL} />
          </DataRow>
          <DataRow dense>
            <FlagValue label="HP" value={tone.highPass} tooltip={t("panels.side.epDave.highPass")} iconFill={VALUE_FILL} />
            <FlagValue label="RING" value={tone.ring} tooltip={t("panels.side.epDave.ring")} iconFill={VALUE_FILL} />
          </DataRow>
          <DataRow dense>
            <SimpleValue label="L" value={tone.left} tooltip={t("panels.side.epDave.left")} valueXclass={regStyles.stateValue} />
            <SimpleValue label="R" value={tone.right} tooltip={t("panels.side.epDave.right")} valueXclass={regStyles.stateValue} />
          </DataRow>
        </div>
      ))}

      <SectionHeader title={t("panels.side.epDave.noise")} />
      <DataRow dense>
        <SimpleValue
          label="CLK"
          value={
            state.noise.clock === 0
              ? t("panels.side.epDave.khz", { value: formatNumber(state.tickHz / 8000, 2) })
              : t("panels.side.epDave.noiseClockChannel", { index: state.noise.clock - 1 })
          }
          tooltip={t("panels.side.epDave.noiseClock")}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="POLY"
          value={t("panels.side.epDave.bits", { bits: state.noise.polyBits })}
          tooltip={t("panels.side.epDave.polyBits")}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue label="SWAP" value={state.noise.swapPolys} tooltip={t("panels.side.epDave.swap")} iconFill={VALUE_FILL} />
        <FlagValue label="LP" value={state.noise.lowPass} tooltip={t("panels.side.epDave.lowPass")} iconFill={VALUE_FILL} />
      </DataRow>
      <DataRow dense>
        <FlagValue label="HP" value={state.noise.highPass} tooltip={t("panels.side.epDave.noiseHighPass")} iconFill={VALUE_FILL} />
        <FlagValue label="RING" value={state.noise.ring} tooltip={t("panels.side.epDave.noiseRing")} iconFill={VALUE_FILL} />
      </DataRow>
      <DataRow dense>
        <SimpleValue label="L" value={state.noise.left} tooltip={t("panels.side.epDave.left")} valueXclass={regStyles.stateValue} />
        <SimpleValue label="R" value={state.noise.right} tooltip={t("panels.side.epDave.right")} valueXclass={regStyles.stateValue} />
      </DataRow>

      <SectionHeader title={t("panels.side.epDave.dac")} />
      <DataRow dense>
        <FlagValue label="DAL" value={state.dacLeft} tooltip={t("panels.side.epDave.dacLeft")} iconFill={VALUE_FILL} />
        <FlagValue label="DAR" value={state.dacRight} tooltip={t("panels.side.epDave.dacRight")} iconFill={VALUE_FILL} />
      </DataRow>
      {[0, 2, 4, 6, 8, 10, 12, 14].map((i) => (
        <DataRow dense key={i}>
          {[i, i + 1].map((r) => (
            <Bit8Value
              key={r}
              label={`A${r.toString(16).toUpperCase()}`}
              value={state.registers[r]}
              tooltip={t("panels.side.epDave.register", { port: portName(0xa0 + r) })}
              valueXclass={regStyles.stateValue}
            />
          ))}
        </DataRow>
      ))}
    </DataPanel>
  );
};
