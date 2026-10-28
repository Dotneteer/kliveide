import { Separator } from "@renderer/controls/layout/Separator";
import { useState } from "react";
import { useEmuStateListener } from "../useStateRefresh";
import { useEmuApi } from "@renderer/core/EmuApi";
import type { TvcVideoState } from "@common/messaging/EmuApi";
import type { MessageKey } from "@common/i18n/keys.generated";
import { Bit16Value, Bit8Value, FlagValue, SimpleValue } from "@renderer/controls/data/registers";
import { DataPanel, DataRow } from "@renderer/controls/data";
import regStyles from "@renderer/controls/data/Registers.module.scss";
import { HistoryPresentBanner } from "../debugger/history/HistoryPresentBanner";
import { useT } from "@common/i18n/useT";

/**
 * The token every value in this panel is drawn with, as in the other converted state panels: labels
 * stay on `--data-label` (`theming/tokens/componentAliases.ts`, `--color-state-value`).
 */
const VALUE_FILL = "--color-state-value";

/** The tooltips of R0-R17 */
const REGISTER_TOOLTIPS: MessageKey[] = [
  "panels.side.tvcVideo.r0",
  "panels.side.tvcVideo.r1",
  "panels.side.tvcVideo.r2",
  "panels.side.tvcVideo.r3",
  "panels.side.tvcVideo.r4",
  "panels.side.tvcVideo.r5",
  "panels.side.tvcVideo.r6",
  "panels.side.tvcVideo.r7",
  "panels.side.tvcVideo.r8",
  "panels.side.tvcVideo.r9",
  "panels.side.tvcVideo.r10",
  "panels.side.tvcVideo.r11",
  "panels.side.tvcVideo.r12",
  "panels.side.tvcVideo.r13",
  "panels.side.tvcVideo.r14",
  "panels.side.tvcVideo.r15",
  "panels.side.tvcVideo.r16",
  "panels.side.tvcVideo.r17"
];

/** The colours a video mode shows (port 06h bits 1-0) */
const MODE_COLOURS = [2, 4, 16, 16];

/**
 * The Videoton TVC's video circuit (`.plans/VIDEOTON_TVC_PLAN.md` §11): the 6845's registers and
 * counters, the mode, palette and border, the vertical blank latch and the interrupt line, and the
 * paging ports with the 64K+'s video banks.
 */
export const TvcVideoPanel = () => {
  const t = useT();
  const emuApi = useEmuApi();
  const [state, setState] = useState<TvcVideoState>(null);

  useEmuStateListener(emuApi, async () => setState(await emuApi.getTvcVideoState()));

  const register = (i: number) => (
    <Bit8Value
      key={i}
      label={`R${i}`}
      value={state?.crtc?.[i]}
      tooltip={t(REGISTER_TOOLTIPS[i])}
      valueXclass={regStyles.stateValue}
    />
  );
  const registerRows: number[][] = [];
  for (let i = 0; i < 18; i += 2) registerRows.push([i, i + 1]);

  return (
    <DataPanel autoHeight>
      <HistoryPresentBanner subject="tvcVideo" />
      {registerRows.map(([a, b]) => (
        <DataRow dense key={a}>
          {register(a)}
          {register(b)}
        </DataRow>
      ))}
      <DataRow dense>
        <Bit8Value
          label="AR"
          value={state?.crtcAddress}
          tooltip={t("panels.side.tvcVideo.crtcAddress")}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue label="CH" value={state?.h} tooltip={t("panels.side.tvcVideo.h")} valueXclass={regStyles.stateValue} />
        <SimpleValue
          label="RA"
          value={state?.raster}
          tooltip={t("panels.side.tvcVideo.raster")}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue label="ROW" value={state?.row} tooltip={t("panels.side.tvcVideo.row")} valueXclass={regStyles.stateValue} />
        <FlagValue label="ADJ" value={state?.inAdjust} tooltip={t("panels.side.tvcVideo.inAdjust")} iconFill={VALUE_FILL} />
      </DataRow>
      <DataRow dense>
        <Bit16Value label="MA" value={state?.ma} tooltip={t("panels.side.tvcVideo.ma")} valueXclass={regStyles.stateValue} />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="MODE"
          value={state ? MODE_COLOURS[state.mode & 3] : undefined}
          tooltip={t("panels.side.tvcVideo.mode")}
          valueXclass={regStyles.stateValue}
        />
        <Bit8Value
          label="BOR"
          value={state?.border}
          tooltip={t("panels.side.tvcVideo.border")}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      {[0, 2].map((i) => (
        <DataRow dense key={i}>
          {[i, i + 1].map((p) => (
            <Bit8Value
              key={p}
              label={`P${p}`}
              value={state?.palette?.[p]}
              tooltip={t("panels.side.tvcVideo.palette", { index: p })}
              valueXclass={regStyles.stateValue}
            />
          ))}
        </DataRow>
      ))}
      <DataRow dense>
        <FlagValue
          label="VBL"
          value={state?.verticalBlank}
          tooltip={t("panels.side.tvcVideo.verticalBlank")}
          iconFill={VALUE_FILL}
        />
        <FlagValue label="IT" value={state?.itPending} tooltip={t("panels.side.tvcVideo.itPending")} iconFill={VALUE_FILL} />
      </DataRow>
      <Separator />
      <DataRow dense>
        <Bit8Value
          label="P02"
          value={state?.port02}
          tooltip={t("panels.side.tvcVideo.port02")}
          valueXclass={regStyles.stateValue}
        />
        {state?.plus && (
          <Bit8Value
            label="P0C"
            value={state?.port0c}
            tooltip={t("panels.side.tvcVideo.port0c")}
            valueXclass={regStyles.stateValue}
          />
        )}
      </DataRow>
      {state?.plus && (
        <DataRow dense>
          <SimpleValue
            label="VB"
            value={state?.displayBank}
            tooltip={t("panels.side.tvcVideo.displayBank")}
            valueXclass={regStyles.stateValue}
          />
        </DataRow>
      )}
    </DataPanel>
  );
};
