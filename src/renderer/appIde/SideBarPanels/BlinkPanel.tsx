import { Label } from "@renderer/controls/layout/Label";
import { Separator } from "@renderer/controls/layout/Separator";
import { useState } from "react";
import { useEmuStateListener } from "../useStateRefresh";
import { useEmuApi } from "@renderer/core/EmuApi";
import { BlinkState } from "@common/messaging/EmuApi";
import { BitValue, FlagFieldRow } from "@renderer/controls/data/registers";
import { DataPanel, DataRow } from "@renderer/controls/data";
import { DataLabel, HexValue } from "@renderer/controls/data";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import regStyles from "@renderer/controls/data/Registers.module.scss";

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

export const BlinkPanel = () => {
  const emuApi = useEmuApi();
  const [blinkState, setBlinkState] = useState<BlinkState>(null);

  useEmuStateListener(emuApi, async () => setBlinkState(await emuApi.getBlinkState()));

  return (
    <DataPanel autoHeight>
      <FlagFieldRow
        label="COM"
        tooltip="Command Register handles LCD, Beeper, Clock ticking, UV Eprom in slot 3 and if lower 8K of S0 in slot 0 is ROM or RAM"
        value={blinkState?.COM}
        flagDescriptions={COMDescription}
        iconFill={VALUE_FILL}
      />
      <FlagFieldRow
        label="INT"
        tooltip="Controls which interrupts are enabled"
        value={blinkState?.INT}
        flagDescriptions={INTDescription}
        iconFill={VALUE_FILL}
      />
      <FlagFieldRow
        label="STA"
        tooltip="Provides information about which interrupt has actually occurred"
        value={blinkState?.STA}
        flagDescriptions={STADescription}
        iconFill={VALUE_FILL}
      />
      <Separator />
      <ValueFieldRow
        label="SR0"
        tooltip="Segment Register 0 (Upper/lower 8K of Bank bound into 2000-3FFF"
        value={blinkState?.SR0}
      />
      <ValueFieldRow
        label="SR1"
        tooltip="Segment Register 1 (16K Bank bound into 4000-7FFF)"
        value={blinkState?.SR1}
      />
      <ValueFieldRow
        label="SR2"
        tooltip="Segment Register 2 (16K Bank bound into 8000-BFFF)"
        value={blinkState?.SR2}
      />
      <ValueFieldRow
        label="SR3"
        tooltip="Segment Register 3 (16K Bank bound into C000-FFFF)"
        value={blinkState?.SR3}
      />
      <Separator />
      <ValueFieldRow
        label="SBR"
        tooltip="Screen Base Register  - Point to Screen Base File of characters and attributes (typically) in RAM"
        value={blinkState?.SBR}
        word={true}
      />
      <Separator />
      <ValueFieldRow
        label="PB0"
        tooltip="Pixel Base 0 - Point to LORES0 (64 characters, 6 by 8 pixel) user defined font bitmap (typically) in RAM"
        value={blinkState?.PB0}
        word={true}
      />
      <ValueFieldRow
        label="PB1"
        tooltip="Pixel Base 1 - Point to LORES1 (448 characters, 6 by 8 pixel) font bitmap (typically) in ROM"
        value={blinkState?.PB1}
        word={true}
      />
      <ValueFieldRow
        label="PB2"
        tooltip='Pixel Base 2 - Point to HIRES0 (768 characters, 8 by 8 pixel) "PipeDream" map (typically) in RAM'
        value={blinkState?.PB2}
        word={true}
      />
      <ValueFieldRow
        label="PB3"
        tooltip='Pixel Base 3 - Point to HIRES1 (256 characters, 8 by 8 pixel) "OZ" font bitmap (typically) in ROM'
        value={blinkState?.PB3}
        word={true}
      />
      <Separator />
      <ValueFieldRow
        label="TIM0"
        tooltip="5ms period counter register (0-199)"
        value={blinkState?.TIM0}
      />
      <ValueFieldRow
        label="TIM1"
        tooltip="1sec period counter register (0-59)"
        value={blinkState?.TIM1}
      />
      <ValueFieldRow
        label="TIM2"
        tooltip="1min period counter register (0-255)"
        value={blinkState?.TIM2}
      />
      <ValueFieldRow
        label="TIM3"
        tooltip="256min period counter register (0-255)"
        value={blinkState?.TIM3}
      />
      <ValueFieldRow
        label="TIM4"
        tooltip="64Kmin period counter register (0-31)"
        value={blinkState?.TIM4}
      />
      <FlagFieldRow
        label="TSTA"
        tooltip="Timer Interrupt Status"
        value={blinkState?.TSTA}
        flagDescriptions={TSTADescription}
        iconFill={VALUE_FILL}
      />
      <FlagFieldRow
        label="TMK"
        tooltip="Timer Interrupt Mask"
        value={blinkState?.TMK}
        flagDescriptions={TMKDescription}
        iconFill={VALUE_FILL}
      />
      <Separator />
      <DataRow dense>
        <KeyboardLine
          text="A15#7"
          tooltip="Keyboard address line A15 (#7) from KBD register"
          value={blinkState?.keyLines?.[7]}
          titles={["\u00a3", "/", ".", "CAPS LOCK", "INDEX", "ESC", "\u25fb", "SHIFT (right)"]}
        />
      </DataRow>
      <DataRow dense>
        <KeyboardLine
          text="A14#6"
          tooltip="Keyboard address line A14 (#6) from KBD register"
          value={blinkState?.keyLines?.[6]}
          titles={["'", ";", ",", "MENU", "\u25c7", "TAB", "SHIFT (left)", "HELP"]}
        />
      </DataRow>
      <DataRow dense>
        <KeyboardLine
          text="A13#5"
          tooltip="Keyboard address line A13 (#5) from KBD register"
          value={blinkState?.keyLines?.[5]}
          titles={["0", "L", "Z", "A", "Q", "1", "SPACE", "["]}
        />
      </DataRow>
      <DataRow dense>
        <KeyboardLine
          text="A12#4"
          tooltip="Keyboard address line A12 (#4) from KBD register"
          value={blinkState?.keyLines?.[4]}
          titles={["P", "M", "X", "S", "W", "2", "⬅︎", "]"]}
        />
      </DataRow>
      <DataRow dense>
        <KeyboardLine
          text="A11#3"
          tooltip="Keyboard address line A11 (#3) from KBD register"
          value={blinkState?.keyLines?.[3]}
          titles={["9", "K", "C", "D", "E", "3", "➡︎", "-"]}
        />
      </DataRow>
      <DataRow dense>
        <KeyboardLine
          text="A10#2"
          tooltip="Keyboard address line A10 (#2) from KBD register"
          value={blinkState?.keyLines?.[2]}
          titles={["O", "J", "V", "F", "R", "4", "⬇︎", "="]}
        />
      </DataRow>
      <DataRow dense>
        <KeyboardLine
          text="A09#1"
          tooltip="Keyboard address line A9 (#1) from KBD register"
          value={blinkState?.keyLines?.[1]}
          titles={["I", "U", "B", "G", "T", "5", "⬆︎", "\\"]}
        />
      </DataRow>
      <DataRow dense>
        <KeyboardLine
          text="A08#0"
          tooltip="Keyboard address line A8 (#0) from KBD register"
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
  word?: boolean;
};

const ValueFieldRow = ({ label, tooltip, value, word }: ValueFieldProps) => {
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
        digits={word ? 4 : 2}
        decimal
        valueXclass={regStyles.stateValue}
      />
      {tooltip && (
        <TooltipFactory
          refElement={ref.current}
          placement="right"
          offsetX={0}
          offsetY={0}
          showDelay={100}
          content={tooltip}
        />
      )}
    </DataRow>
  );
};

const COMDescription = [
  "LCDON - Set to turn LCD ON, clear to turn LCD OFF", // bit 0
  "VPPON - Set to turn programming voltage ON",
  "RAMS - Binding of lower 8K of segment 0: 0=bank 0, 1=bank 20",
  "PROGRAM - Set to enable EPROM programming",
  "RESTIM - Set to reset the RTC, clear to continue",
  "OVERP - Set to overprogram EPROMs",
  "SBIT - SRUN=0: 0=low, 1=high; SRUN=1: 0=3200 Hz, 1=TxD",
  "SRUN - Speaker source (0=SBIT, 1=TxD or 3200 Hz)" // bit 7
];

const INTDescription = [
  "GINT - If clear (0), no interrupts get out of Blink", // bit 0
  "TIME - If set (1), Real Time Clock interrupts are enabled",
  "KEY - If set (1), keyboard interrupts (Snooze or Coma) are enabled",
  "BTL - If set (1), battery low interrupts are enabled",
  "UART - If set (1), UART interrupts are enabled",
  "FLAP - If set (1), flap interrupts are enabled",
  "A19 - If set (1), an active high on A19 will exit Coma",
  "KWAIT - If set (1), reading the keyboard will Snooze CPU" // bit 7
];

const STADescription = [
  "TIME - If set (1), an enabled TIME interrupt is active", // bit 0
  "Not Used",
  "KEY - If set (1), a column has gone low in snooze (or coma)",
  "BTL - If set (1), battery low pin is active",
  "UART - If set (1), an enabled UART interrupt is active",
  "FLAP - If set (1), positive edge has occurred on FLAPOPEN",
  "A19 - If set (1), high level on A19 occurred during coma",
  "FLAPOPEN - If set (1), flap open else flap closed" // bit 7
];

const TSTADescription = [
  "TICK - If set (1), a tick interrupt has occurred", // bit 0
  "SEC - If Set (1), a second interrupt has occurred",
  "MIN - If set (1), a minute interrupt has occurred",
  "Not Used",
  "Not Used",
  "Not Used",
  "Not Used",
  "Not Used" // bit 7
];

const TMKDescription = [
  "TICK - If set (1), enable tick interrupts", // bit 0
  "SEC - If Set (1), enable second interrupts",
  "MIN - If set (1), enable minute interrupts",
  "Not Used",
  "Not Used",
  "Not Used",
  "Not Used",
  "Not Used" // bit 7
];
