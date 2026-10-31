import { useState } from "react";
import { HistoryPresentBanner } from "../debugger/history/HistoryPresentBanner";
import classnames from "classnames";
import { Separator } from "@renderer/controls/layout/Separator";
import { useEmuStateListener } from "../useStateRefresh";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useT } from "@common/i18n/useT";
import { Bit16Value, Bit8Value, FlagValue, SimpleValue } from "@renderer/controls/data/registers";
import { DataLabel, DataPanel, DataRow, DataValue, EmptyState, SectionHeader } from "@renderer/controls/data";
import regStyles from "@renderer/controls/data/Registers.module.scss";
import { toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import {
  EP_NICK_COLOUR_COUNTS,
  EP_NICK_MODE_NAMES,
  epColourCss,
  type EpLpb,
  type EpNickDebugState
} from "@emu/machines/enterprise/EpDebugState";
import styles from "./EpChipPanels.module.scss";

/** The token every value in this panel is drawn with, as in the other converted state panels */
const VALUE_FILL = "--color-state-value";

/** One colour NICK outputs, as a swatch with its colour byte in the tooltip */
const Swatch = ({ rgb, colour }: { rgb: readonly number[]; colour: number }) => {
  const t = useT();
  return (
    <span
      className={styles.swatch}
      style={{ backgroundColor: epColourCss(rgb, colour) }}
      title={t("panels.side.epNick.colour", { value: `$${toHexa2(colour)}` })}
    />
  );
};

/** A labelled row of swatches */
const SwatchRow = ({
  label,
  title,
  colours,
  rgb
}: {
  label: string;
  title: string;
  colours: readonly number[];
  rgb: readonly number[];
}) => (
  <DataRow dense>
    <DataLabel text={label} title={title} xclass={styles.swatchLabel} />
    <span className={styles.swatches} title={title}>
      {colours.map((c, i) => (
        <Swatch key={i} rgb={rgb} colour={c} />
      ))}
    </span>
  </DataRow>
);

/** The V (VRES), I (VINT) and R (RELOAD) letters of a block */
const flagLetters = (b: EpLpb) => `${b.vres ? "V" : "-"}${b.vint ? "I" : "-"}${b.reload ? "R" : "-"}`;

/**
 * The Enterprise 64/128's NICK (`.plans/ENTERPRISE_PLAN.md` §11): the ports as written, the LPT
 * pointer and the beam, the live line data pointers, FIXBIAS and the border, the current Line
 * Parameter Block decoded, and the LPT from its base to the RELOAD block.
 */
export const EpNickPanel = () => {
  const t = useT();
  const emuApi = useEmuApi();
  const [state, setState] = useState<EpNickDebugState>(null);

  useEmuStateListener(emuApi, async () => setState(await emuApi.getEpNickState()));

  if (!state) {
    return (
      <DataPanel autoHeight>
        <EmptyState message={t("panels.side.epNick.notAvailable")} />
      </DataPanel>
    );
  }

  const current = state.current;
  const port = (i: number) => (
    <Bit8Value
      label={`P8${i}`}
      value={state.ports[i]}
      tooltip={t(
        (["panels.side.epNick.port80", "panels.side.epNick.port81", "panels.side.epNick.port82", "panels.side.epNick.port83"] as const)[i]
      )}
      valueXclass={regStyles.stateValue}
    />
  );

  return (
    <DataPanel autoHeight>
      <HistoryPresentBanner subject="epNick" />
      <DataRow dense>
        {port(0)}
        {port(1)}
      </DataRow>
      <DataRow dense>
        {port(2)}
        {port(3)}
      </DataRow>
      <DataRow dense>
        <Bit16Value label="LPT" value={state.lptBase} tooltip={t("panels.side.epNick.lptBase")} valueXclass={regStyles.stateValue} />
        <Bit16Value
          label="LPB"
          value={state.lptAddress}
          tooltip={t("panels.side.epNick.lptAddress")}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue label="LINE" value={state.line} tooltip={t("panels.side.epNick.line")} valueXclass={regStyles.stateValue} />
        <SimpleValue label="SLOT" value={state.slot} tooltip={t("panels.side.epNick.slot")} valueXclass={regStyles.stateValue} />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="LEFT"
          value={state.linesLeft}
          tooltip={t("panels.side.epNick.linesLeft")}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="MODE"
          value={EP_NICK_MODE_NAMES[state.mode & 7]}
          tooltip={t("panels.side.epNick.mode")}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue label="DISP" value={state.displayOn} tooltip={t("panels.side.epNick.displayOn")} iconFill={VALUE_FILL} />
        <FlagValue label="VSYN" value={state.vsyncOn} tooltip={t("panels.side.epNick.vsyncOn")} iconFill={VALUE_FILL} />
      </DataRow>
      <DataRow dense>
        <Bit16Value label="LD1" value={state.ld1} tooltip={t("panels.side.epNick.ld1Live")} valueXclass={regStyles.stateValue} />
        <Bit16Value label="LD2" value={state.ld2} tooltip={t("panels.side.epNick.ld2Live")} valueXclass={regStyles.stateValue} />
      </DataRow>
      <DataRow dense>
        <Bit8Value label="BUS" value={state.dataBus} tooltip={t("panels.side.epNick.dataBus")} valueXclass={regStyles.stateValue} />
      </DataRow>
      <SwatchRow
        label="FIXBIAS"
        title={t("panels.side.epNick.fixBiasColours")}
        colours={Array.from({ length: 8 }, (_, i) => (state.fixBias << 3) | i)}
        rgb={state.rgb}
      />
      <SwatchRow label="BORDER" title={t("panels.side.epNick.borderColour")} colours={[state.border]} rgb={state.rgb} />

      <SectionHeader title={t("panels.side.epNick.currentLpb", { address: `$${toHexa4(current.address)}` })} />
      <DataRow dense>
        <SimpleValue label="LINES" value={current.lines} tooltip={t("panels.side.epNick.lines")} valueXclass={regStyles.stateValue} />
        <SimpleValue
          label="MODE"
          value={EP_NICK_MODE_NAMES[current.mode]}
          tooltip={t("panels.side.epNick.lpbMode")}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="COLS"
          value={EP_NICK_COLOUR_COUNTS[current.colours]}
          tooltip={t("panels.side.epNick.colours")}
          valueXclass={regStyles.stateValue}
        />
        <FlagValue label="VRES" value={current.vres} tooltip={t("panels.side.epNick.vres")} iconFill={VALUE_FILL} />
      </DataRow>
      <DataRow dense>
        <FlagValue label="VINT" value={current.vint} tooltip={t("panels.side.epNick.vint")} iconFill={VALUE_FILL} />
        <FlagValue label="RELOAD" value={current.reload} tooltip={t("panels.side.epNick.reload")} iconFill={VALUE_FILL} />
      </DataRow>
      <DataRow dense>
        <SimpleValue label="LM" value={current.lm} tooltip={t("panels.side.epNick.lm")} valueXclass={regStyles.stateValue} />
        <SimpleValue label="RM" value={current.rm} tooltip={t("panels.side.epNick.rm")} valueXclass={regStyles.stateValue} />
      </DataRow>
      <DataRow dense>
        <FlagValue label="MSBALT" value={current.msbAlt} tooltip={t("panels.side.epNick.msbAlt")} iconFill={VALUE_FILL} />
        <FlagValue label="LSBALT" value={current.lsbAlt} tooltip={t("panels.side.epNick.lsbAlt")} iconFill={VALUE_FILL} />
      </DataRow>
      <DataRow dense>
        <FlagValue label="ALTIND0" value={current.altInd0} tooltip={t("panels.side.epNick.altInd0")} iconFill={VALUE_FILL} />
        <FlagValue label="ALTIND1" value={current.altInd1} tooltip={t("panels.side.epNick.altInd1")} iconFill={VALUE_FILL} />
      </DataRow>
      <DataRow dense>
        <Bit16Value label="LD1" value={current.ld1} tooltip={t("panels.side.epNick.ld1")} valueXclass={regStyles.stateValue} />
        <Bit16Value label="LD2" value={current.ld2} tooltip={t("panels.side.epNick.ld2")} valueXclass={regStyles.stateValue} />
      </DataRow>
      <SwatchRow label="COL0-7" title={t("panels.side.epNick.palette")} colours={current.palette} rgb={state.rgb} />

      <SectionHeader title={t("panels.side.epNick.lpt", { count: state.lpt.length })} />
      <div className={styles.lptList}>
        <DataRow dense>
          <span className={styles.marker} />
          <DataLabel text={t("panels.side.epNick.lptHeader.address")} xclass={styles.colAddress} />
          <DataLabel text={t("panels.side.epNick.lptHeader.lines")} xclass={styles.colLines} />
          <DataLabel text={t("panels.side.epNick.lptHeader.mode")} xclass={styles.colMode} />
          <DataLabel text={t("panels.side.epNick.lptHeader.flags")} xclass={styles.colFlags} />
          <DataLabel text={t("panels.side.epNick.lptHeader.palette")} />
        </DataRow>
        {state.lpt.map((block, i) => {
          const isCurrent = i === state.currentIndex;
          const title = t("panels.side.epNick.lptRow", {
            address: `$${toHexa4(block.address)}`,
            lines: block.lines,
            mode: EP_NICK_MODE_NAMES[block.mode],
            colours: EP_NICK_COLOUR_COUNTS[block.colours],
            lm: block.lm,
            rm: block.rm,
            ld1: `$${toHexa4(block.ld1)}`,
            ld2: `$${toHexa4(block.ld2)}`
          });
          return (
            <div key={i} title={title}>
              <DataRow dense index={i} xclass={styles.lptRow}>
                <span className={styles.marker} title={isCurrent ? t("panels.side.epNick.current") : undefined}>
                  {isCurrent ? "▶" : ""}
                </span>
                <DataValue text={toHexa4(block.address)} xclass={classnames(styles.colAddress, regStyles.stateValue)} />
                <DataValue text={String(block.lines)} xclass={styles.colLines} />
                <DataValue text={EP_NICK_MODE_NAMES[block.mode]} xclass={styles.colMode} />
                <DataValue text={flagLetters(block)} xclass={styles.colFlags} />
                <span className={styles.swatches}>
                  {block.palette.map((c, j) => (
                    <Swatch key={j} rgb={state.rgb} colour={c} />
                  ))}
                </span>
              </DataRow>
            </div>
          );
        })}
      </div>
    </DataPanel>
  );
};
