import { Label } from "@renderer/controls/layout/Label";
import type { MessageKey } from "@common/i18n/keys.generated";
import { useT } from "@common/i18n/useT";
import { Separator } from "@renderer/controls/layout/Separator";
import { useState } from "react";
import { useEmuStateListener } from "../useStateRefresh";
import { useEmuApi } from "@renderer/core/EmuApi";
import { BlinkState } from "@common/messaging/EmuApi";
import { BitValue, FlagFieldRow } from "@renderer/controls/data/registers";
import { DataPanel, DataRow } from "@renderer/controls/data";
import { DataLabel, DataSecondary, HexValue } from "@renderer/controls/data";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import regStyles from "@renderer/controls/data/Registers.module.scss";
import {
  formatZ88Ext24,
  z88Pb0Address,
  z88Pb1Address,
  z88Pb2Address,
  z88Pb3Address,
  z88SbfAddress,
  z88SbfSize,
  type Z88ScreenPointer
} from "@common/z88/z88ScreenPointers";

// M2: a bare number reaches `DataLabel` as `ch`, but nothing said so at the call site. Spelled.
const LAB_WIDTH = "7ch";
const KEY_LAB_WIDTH = "8ch"; // 46px / 6.4 = 7.2

/*
 * The Blink panel takes the same colouring as the Z80 and ULA panels (Phase 20).
 *
 * Same §10.3 split as its siblings: the payload takes `--color-state-value`, labels stay on
 * `--data-label`. Before this the Z88 debug sidebar was the last one still entirely neutral.
 */
const VALUE_FILL = "--color-state-value";

/*
 * Every row's tooltip opens under the row, by its label and value, and wraps (`.rowTooltip`). The
 * descriptions are a sentence or two long; opened to the right of a full-width sidebar row they
 * started past the sidebar's edge, far from the value, and ran out of the window on one line.
 */

export const BlinkPanel = () => {
  const t = useT();
  const emuApi = useEmuApi();
  const [blinkState, setBlinkState] = useState<BlinkState>(null);

  useEmuStateListener(emuApi, async () => setBlinkState(await emuApi.getBlinkState()));

  return (
    <DataPanel autoHeight>
      <FlagFieldRow
        label="COM"
        tooltip={t("panels.side.blink.reg.com")}
        value={blinkState?.COM}
        flagDescriptions={COMDescription.map((key) => t(key))}
        iconFill={VALUE_FILL}
        tooltipBelow
      />
      <FlagFieldRow
        label="INT"
        tooltip={t("panels.side.blink.reg.int")}
        value={blinkState?.INT}
        flagDescriptions={INTDescription.map((key) => t(key))}
        iconFill={VALUE_FILL}
        tooltipBelow
      />
      <FlagFieldRow
        label="STA"
        tooltip={t("panels.side.blink.reg.sta")}
        value={blinkState?.STA}
        flagDescriptions={STADescription.map((key) => t(key))}
        iconFill={VALUE_FILL}
        tooltipBelow
      />
      <Separator />
      <ValueFieldRow
        label="SR0"
        tooltip={t("panels.side.blink.reg.sr0")}
        value={blinkState?.SR0}
      />
      <ValueFieldRow
        label="SR1"
        tooltip={t("panels.side.blink.reg.sr1")}
        value={blinkState?.SR1}
      />
      <ValueFieldRow
        label="SR2"
        tooltip={t("panels.side.blink.reg.sr2")}
        value={blinkState?.SR2}
      />
      <ValueFieldRow
        label="SR3"
        tooltip={t("panels.side.blink.reg.sr3")}
        value={blinkState?.SR3}
      />
      <Separator />
      <PointerFieldRow
        label="SBF"
        tooltip={t("panels.side.blink.reg.sbf", {
          size: z88SbfSize(blinkState?.SBF ?? 0) / 1024,
          rows: z88SbfSize(blinkState?.SBF ?? 0) / 256
        })}
        value={blinkState?.SBF}
        decode={z88SbfAddress}
      />
      <Separator />
      <PointerFieldRow
        label="PB0"
        tooltip={t("panels.side.blink.reg.pb0")}
        value={blinkState?.PB0}
        decode={z88Pb0Address}
      />
      <PointerFieldRow
        label="PB1"
        tooltip={t("panels.side.blink.reg.pb1")}
        value={blinkState?.PB1}
        decode={z88Pb1Address}
      />
      <PointerFieldRow
        label="PB2"
        tooltip={t("panels.side.blink.reg.pb2")}
        value={blinkState?.PB2}
        decode={z88Pb2Address}
      />
      <PointerFieldRow
        label="PB3"
        tooltip={t("panels.side.blink.reg.pb3")}
        value={blinkState?.PB3}
        decode={z88Pb3Address}
      />
      <Separator />
      <ValueFieldRow
        label="TIM0"
        tooltip={t("panels.side.blink.reg.tim0")}
        value={blinkState?.TIM0}
      />
      <ValueFieldRow
        label="TIM1"
        tooltip={t("panels.side.blink.reg.tim1")}
        value={blinkState?.TIM1}
      />
      <ValueFieldRow
        label="TIM2"
        tooltip={t("panels.side.blink.reg.tim2")}
        value={blinkState?.TIM2}
      />
      <ValueFieldRow
        label="TIM3"
        tooltip={t("panels.side.blink.reg.tim3")}
        value={blinkState?.TIM3}
      />
      <ValueFieldRow
        label="TIM4"
        tooltip={t("panels.side.blink.reg.tim4")}
        value={blinkState?.TIM4}
      />
      <FlagFieldRow
        label="TSTA"
        tooltip={t("panels.side.blink.reg.tsta")}
        value={blinkState?.TSTA}
        flagDescriptions={TSTADescription.map((key) => t(key))}
        iconFill={VALUE_FILL}
        tooltipBelow
      />
      <FlagFieldRow
        label="TMK"
        tooltip={t("panels.side.blink.reg.tmk")}
        value={blinkState?.TMK}
        flagDescriptions={TMKDescription.map((key) => t(key))}
        iconFill={VALUE_FILL}
        tooltipBelow
      />
      <Separator />
      <DataRow dense>
        <KeyboardLine
          text="A15#7"
          tooltip={t("panels.side.blink.keyboardLine", { line: "A15", index: 7 })}
          value={blinkState?.keyLines?.[7]}
          titles={["\u00a3", "/", ".", "CAPS LOCK", "INDEX", "ESC", "\u25fb", "SHIFT (right)"]}
        />
      </DataRow>
      <DataRow dense>
        <KeyboardLine
          text="A14#6"
          tooltip={t("panels.side.blink.keyboardLine", { line: "A14", index: 6 })}
          value={blinkState?.keyLines?.[6]}
          titles={["'", ";", ",", "MENU", "\u25c7", "TAB", "SHIFT (left)", "HELP"]}
        />
      </DataRow>
      <DataRow dense>
        <KeyboardLine
          text="A13#5"
          tooltip={t("panels.side.blink.keyboardLine", { line: "A13", index: 5 })}
          value={blinkState?.keyLines?.[5]}
          titles={["0", "L", "Z", "A", "Q", "1", "SPACE", "["]}
        />
      </DataRow>
      <DataRow dense>
        <KeyboardLine
          text="A12#4"
          tooltip={t("panels.side.blink.keyboardLine", { line: "A12", index: 4 })}
          value={blinkState?.keyLines?.[4]}
          titles={["P", "M", "X", "S", "W", "2", "⬅︎", "]"]}
        />
      </DataRow>
      <DataRow dense>
        <KeyboardLine
          text="A11#3"
          tooltip={t("panels.side.blink.keyboardLine", { line: "A11", index: 3 })}
          value={blinkState?.keyLines?.[3]}
          titles={["9", "K", "C", "D", "E", "3", "➡︎", "-"]}
        />
      </DataRow>
      <DataRow dense>
        <KeyboardLine
          text="A10#2"
          tooltip={t("panels.side.blink.keyboardLine", { line: "A10", index: 2 })}
          value={blinkState?.keyLines?.[2]}
          titles={["O", "J", "V", "F", "R", "4", "⬇︎", "="]}
        />
      </DataRow>
      <DataRow dense>
        <KeyboardLine
          text="A09#1"
          tooltip={t("panels.side.blink.keyboardLine", { line: "A9", index: 1 })}
          value={blinkState?.keyLines?.[1]}
          titles={["I", "U", "B", "G", "T", "5", "⬆︎", "\\"]}
        />
      </DataRow>
      <DataRow dense>
        <KeyboardLine
          text="A08#0"
          tooltip={t("panels.side.blink.keyboardLine", { line: "A8", index: 0 })}
          value={blinkState?.keyLines?.[0]}
          titles={["8", "7", "N", "H", "Y", "6", "ENTER", "DEL"]}
        />
      </DataRow>
    </DataPanel>
  );
};

type KeyboardLineProps = {
  text: string;
  tooltip: string;
  value: number;
  titles?: string[];
};

const KeyboardLine = ({ value, titles, text, tooltip }: KeyboardLineProps) => {
  const toFlag = (val: number | undefined, bitNo: number) =>
    val !== undefined ? !!(val & (1 << bitNo)) : undefined;
  return (
    <DataRow dense>
      <Label text={text} width={KEY_LAB_WIDTH} tooltip={tooltip} />
      <BitValue value={toFlag(value, 7)} tooltip={titles?.[7]} iconFill={VALUE_FILL} />
      <BitValue value={toFlag(value, 6)} tooltip={titles?.[6]} iconFill={VALUE_FILL} />
      <BitValue value={toFlag(value, 5)} tooltip={titles?.[5]} iconFill={VALUE_FILL} />
      <BitValue value={toFlag(value, 4)} tooltip={titles?.[4]} iconFill={VALUE_FILL} />
      <BitValue value={toFlag(value, 3)} tooltip={titles?.[3]} iconFill={VALUE_FILL} />
      <BitValue value={toFlag(value, 2)} tooltip={titles?.[2]} iconFill={VALUE_FILL} />
      <BitValue value={toFlag(value, 1)} tooltip={titles?.[1]} iconFill={VALUE_FILL} />
      <BitValue value={toFlag(value, 0)} tooltip={titles?.[0]} iconFill={VALUE_FILL} />
    </DataRow>
  );
};

type ValueFieldProps = {
  label: string;
  tooltip: string;
  value: number;
};

const ValueFieldRow = ({ label, tooltip, value }: ValueFieldProps) => {
  /*
   * One styled tooltip on the row, not a native `title` on the label.
   *
   * `title` is the browser's: unstyled, on its own clock, and positioned where the app has no say —
   * and it fired *alongside* the row tooltips its neighbours in this panel already had. §12.0 of
   * the modernization plan removed the same pattern from `SysVarsPanel`; this was the last panel
   * still carrying it.
   */
  const ref = useTooltipRef<HTMLDivElement>();

  return (
    <DataRow dense ref={ref}>
      <DataLabel text={label} width={LAB_WIDTH} />
      <HexValue
        value={value ?? 0}
        digits={2}
        decimal
        valueXclass={regStyles.stateValue}
      />
      {tooltip && (
        <TooltipFactory
          refElement={ref.current}
          placement="bottom-start"
          offsetX={2}
          offsetY={0}
          showDelay={100}
          content={tooltip}
          className={regStyles.rowTooltip}
        />
      )}
    </DataRow>
  );
};

type PointerFieldProps = {
  label: string;
  tooltip: string;
  value: number;
  decode: (value: number) => Z88ScreenPointer;
};

/*
 * An LCD pointer register (SBF, PB0-PB3): the raw 16-bit value, then - in OZvm's form, `(243800h)` -
 * the 24-bit bank and offset it points at, which a memory view can open directly (issue #1417).
 */
const PointerFieldRow = ({ label, tooltip, value, decode }: PointerFieldProps) => {
  const ref = useTooltipRef<HTMLDivElement>();
  const raw = value ?? 0;
  return (
    <DataRow dense ref={ref}>
      <DataLabel text={label} width={LAB_WIDTH} />
      <HexValue value={raw} digits={4} valueXclass={regStyles.stateValue} />
      <DataSecondary text={`(${formatZ88Ext24(decode(raw).ext24)})`} />
      {tooltip && (
        <TooltipFactory
          refElement={ref.current}
          placement="bottom-start"
          offsetX={2}
          offsetY={0}
          showDelay={100}
          content={tooltip}
          className={regStyles.rowTooltip}
        />
      )}
    </DataRow>
  );
};

const COMDescription: readonly MessageKey[] = [
  "panels.side.blink.bit.com0", // bit 0
  "panels.side.blink.bit.com1",
  "panels.side.blink.bit.com2",
  "panels.side.blink.bit.com3",
  "panels.side.blink.bit.com4",
  "panels.side.blink.bit.com5",
  "panels.side.blink.bit.com6",
  "panels.side.blink.bit.com7", // bit 7
];

const INTDescription: readonly MessageKey[] = [
  "panels.side.blink.bit.int0", // bit 0
  "panels.side.blink.bit.int1",
  "panels.side.blink.bit.int2",
  "panels.side.blink.bit.int3",
  "panels.side.blink.bit.int4",
  "panels.side.blink.bit.int5",
  "panels.side.blink.bit.int6",
  "panels.side.blink.bit.int7", // bit 7
];

const STADescription: readonly MessageKey[] = [
  "panels.side.blink.bit.sta0", // bit 0
  "panels.side.blink.bitNotUsed",
  "panels.side.blink.bit.sta2",
  "panels.side.blink.bit.sta3",
  "panels.side.blink.bit.sta4",
  "panels.side.blink.bit.sta5",
  "panels.side.blink.bit.sta6",
  "panels.side.blink.bit.sta7", // bit 7
];

const TSTADescription: readonly MessageKey[] = [
  "panels.side.blink.bit.tsta0", // bit 0
  "panels.side.blink.bit.tsta1",
  "panels.side.blink.bit.tsta2",
  "panels.side.blink.bitNotUsed",
  "panels.side.blink.bitNotUsed",
  "panels.side.blink.bitNotUsed",
  "panels.side.blink.bitNotUsed",
  "panels.side.blink.bitNotUsed", // bit 7
];

const TMKDescription: readonly MessageKey[] = [
  "panels.side.blink.bit.tmk0", // bit 0
  "panels.side.blink.bit.tmk1",
  "panels.side.blink.bit.tmk2",
  "panels.side.blink.bitNotUsed",
  "panels.side.blink.bitNotUsed",
  "panels.side.blink.bitNotUsed",
  "panels.side.blink.bitNotUsed",
  "panels.side.blink.bitNotUsed", // bit 7
];
