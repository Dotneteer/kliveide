import { useState } from "react";
import { HistoryPresentBanner } from "../debugger/history/HistoryPresentBanner";
import { useEmuStateListener } from "../useStateRefresh";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useT } from "@common/i18n/useT";
import type { MessageKey } from "@common/i18n/keys.generated";
import { Bit8Value, FlagValue, SimpleValue } from "@renderer/controls/data/registers";
import { DataLabel, DataPanel, DataRow, DataSecondary, EmptyState, SectionHeader } from "@renderer/controls/data";
import regStyles from "@renderer/controls/data/Registers.module.scss";
import { toHexa2 } from "@renderer/appIde/services/ide-commands";
import type { SamAsicDebugState } from "@emu/machines/samcoupe/SamDebugState";
import styles from "./EpChipPanels.module.scss";

/** The token every value in this panel is drawn with, as in the other converted state panels */
const VALUE_FILL = "--color-state-value";

/** The contention region's names, by `samGetContentionMode` */
const CONTENTION: MessageKey[] = [
  "panels.side.samAsic.contentionMode1",
  "panels.side.samAsic.contentionMode234",
  "panels.side.samAsic.contentionOff"
];

/** An RGBA word (the core's palette) as a CSS colour: the swatch's colour is the data */
const rgbaCss = (rgba: number) => `rgb(${rgba & 0xff}, ${(rgba >>> 8) & 0xff}, ${(rgba >>> 16) & 0xff})`;

/** What a 16K section shows, from the paging registers (`sam-memory.c`) */
function sectionText(state: SamAsicDebugState, section: number): string {
  const ext = (state.hmpr & 0x80) !== 0;
  switch (section) {
    case 0:
      return state.lmpr & 0x20 ? `RAM ${state.lmpr & 0x1f}${state.lmpr & 0x80 ? " WP" : ""}` : "ROM0";
    case 1:
      return `RAM ${(state.lmpr + 1) & 0x1f}`;
    case 2:
      return ext ? `EXT ${toHexa2(state.lepr)}` : `RAM ${state.hmpr & 0x1f}`;
    default:
      if (ext) return `EXT ${toHexa2(state.hepr)}`;
      return state.lmpr & 0x40 ? "ROM1" : `RAM ${(state.hmpr + 1) & 0x1f}`;
  }
}

/**
 * The SAM Coupé's ASIC (`dev/plans/SAM_COUPE_PLAN.md` §11): the paging registers and what each section
 * shows, the screen (mode, page, border, SOFF, FLASH, ATTR), the 16 CLUT entries as swatches with their
 * 7-bit values, the line interrupt and STATUS, and the beam with the contention region there.
 */
export const SamAsicPanel = () => {
  const t = useT();
  const emuApi = useEmuApi();
  const [state, setState] = useState<SamAsicDebugState>(null);

  useEmuStateListener(emuApi, async () => setState(await emuApi.getSamAsicState()));

  if (!state) {
    return (
      <DataPanel autoHeight>
        <EmptyState message={t("panels.side.samAsic.notAvailable")} />
      </DataPanel>
    );
  }

  const status = state.status;
  const borderIndex = ((state.border & 0x20) >> 2) | (state.border & 0x07);

  return (
    <DataPanel autoHeight>
      <HistoryPresentBanner subject="samAsic" />
      <SectionHeader title={t("panels.side.samAsic.paging")} />
      <DataRow dense>
        <Bit8Value label="LMPR" value={state.lmpr} tooltip={t("panels.side.samAsic.lmpr")} valueXclass={regStyles.stateValue} />
      </DataRow>
      <DataRow dense>
        <Bit8Value label="HMPR" value={state.hmpr} tooltip={t("panels.side.samAsic.hmpr")} valueXclass={regStyles.stateValue} />
      </DataRow>
      <DataRow dense>
        <Bit8Value label="VMPR" value={state.vmpr} tooltip={t("panels.side.samAsic.vmpr")} valueXclass={regStyles.stateValue} />
      </DataRow>
      {state.extPages > 0 && (
        <DataRow dense>
          <SimpleValue label="LEPR" value={toHexa2(state.lepr)} tooltip={t("panels.side.samAsic.lepr")} valueXclass={regStyles.stateValue} />
          <SimpleValue label="HEPR" value={toHexa2(state.hepr)} tooltip={t("panels.side.samAsic.hepr")} valueXclass={regStyles.stateValue} />
        </DataRow>
      )}
      {["A", "B", "C", "D"].map((name, section) => {
        const tooltip = t("panels.side.samAsic.section", { name, address: `${toHexa2(section * 0x40)}00h` });
        return (
          <DataRow dense key={name}>
            <DataLabel text={name} title={tooltip} xclass={regStyles.regLabel} />
            <DataSecondary text={sectionText(state, section)} title={tooltip} />
          </DataRow>
        );
      })}

      <SectionHeader title={t("panels.side.samAsic.screen")} />
      <DataRow dense>
        <SimpleValue label="MODE" value={state.mode} tooltip={t("panels.side.samAsic.mode")} valueXclass={regStyles.stateValue} />
        <SimpleValue label="PAGE" value={state.screenPage} tooltip={t("panels.side.samAsic.screenPage")} valueXclass={regStyles.stateValue} />
      </DataRow>
      <DataRow dense>
        <Bit8Value label="BORD" value={state.border} tooltip={t("panels.side.samAsic.border")} valueXclass={regStyles.stateValue} />
      </DataRow>
      <DataRow dense>
        <FlagValue label="SOFF" value={state.screenOff} tooltip={t("panels.side.samAsic.soff")} iconFill={VALUE_FILL} />
        <SimpleValue label="ATTR" value={toHexa2(state.attr)} tooltip={t("panels.side.samAsic.attr")} valueXclass={regStyles.stateValue} />
      </DataRow>
      <DataRow dense>
        <SimpleValue label="FLSH" value={state.flashCounter} tooltip={t("panels.side.samAsic.flash")} valueXclass={regStyles.stateValue} />
        <SimpleValue label="M3" value={(state.hmpr >> 5) & 3} tooltip={t("panels.side.samAsic.mode3Colours")} valueXclass={regStyles.stateValue} />
      </DataRow>

      <SectionHeader title={t("panels.side.samAsic.clut")} />
      {[0, 8].map((first) => (
        <DataRow dense key={first}>
          <DataLabel text={`${first}-${first + 7}`} title={t("panels.side.samAsic.clutRow", { lo: first, hi: first + 7 })} xclass={styles.swatchLabel} />
          <span className={styles.swatches}>
            {state.clut.slice(first, first + 8).map((colour, i) => (
              <span
                key={i}
                className={styles.swatch}
                style={{ backgroundColor: rgbaCss(state.clutRgb[first + i]) }}
                title={t("panels.side.samAsic.clutEntry", {
                  index: first + i,
                  value: toHexa2(colour),
                  note: first + i === borderIndex ? t("panels.side.samAsic.isBorder") : ""
                })}
              />
            ))}
          </span>
        </DataRow>
      ))}

      <SectionHeader title={t("panels.side.samAsic.interrupts")} />
      <DataRow dense>
        <SimpleValue
          label="LINE"
          value={state.lineRegister < 192 ? state.lineRegister : t("panels.side.samAsic.lineOff")}
          tooltip={t("panels.side.samAsic.line")}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue label="FRM" value={(status & 0x08) === 0} tooltip={t("panels.side.samAsic.frameInt")} iconFill={VALUE_FILL} />
        <FlagValue label="LIN" value={(status & 0x01) === 0} tooltip={t("panels.side.samAsic.lineInt")} iconFill={VALUE_FILL} />
      </DataRow>
      <DataRow dense>
        <FlagValue label="MIDO" value={(status & 0x10) === 0} tooltip={t("panels.side.samAsic.midiOutInt")} iconFill={VALUE_FILL} />
      </DataRow>

      <SectionHeader title={t("panels.side.samAsic.beam")} />
      <DataRow dense>
        <SimpleValue label="HC" value={state.hc} tooltip={t("panels.side.samAsic.hc")} valueXclass={regStyles.stateValue} />
        <SimpleValue label="VC" value={state.vc} tooltip={t("panels.side.samAsic.vc")} valueXclass={regStyles.stateValue} />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="CONT"
          value={t(CONTENTION[state.contentionMode] ?? CONTENTION[0])}
          tooltip={t("panels.side.samAsic.contention")}
          valueXclass={regStyles.stateValue}
          fullWidth
        />
      </DataRow>
    </DataPanel>
  );
};
