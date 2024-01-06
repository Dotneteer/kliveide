import {
  Flag,
  FlagRow,
  Label,
  LabelSeparator,
  Secondary,
  Separator,
  Value
} from "@controls/Labels";
import {
  useRendererContext,
  useSelector
} from "@renderer/core/RendererProvider";
import { EmuGetBlinkStateResponse } from "@messaging/main-to-emu";
import { useState } from "react";
import { useStateRefresh } from "../useStateRefresh";
import styles from "./BlinkPanel.module.scss";
import { toHexa2, toHexa4 } from "../services/ide-commands";

const FLAG_WIDTH = 12;
const LAB_WIDTH = 40;
const VALUE_WIDTH = 40;
const KEY_LAB_WIDTH = 38;

const BlinkPanel = () => {
  const { messenger } = useRendererContext();
  const [blinkState, setBlinkState] = useState<EmuGetBlinkStateResponse>(null);
  const machineId = useSelector(s => s.emulatorState?.machineId);

  useStateRefresh(250, async () => {
    setBlinkState(
      (await messenger.sendMessage({
        type: "EmuGetBlinkState"
      })) as EmuGetBlinkStateResponse
    );
  });

  return (
    <div className={styles.blinkPanel}>
      <FlagFieldRow
        label='COM'
        tooltip='Command Register handles LCD, Beeper, Clock ticking, UV Eprom in slot 3 and if lower 8K of S0 in slot 0 is ROM or RAM'
        value={blinkState?.COM}
        flagDescriptions={COMDescription}
      />
      <FlagFieldRow
        label='INT'
        tooltip='Controls which interrupts are enabled'
        value={blinkState?.INT}
        flagDescriptions={INTDescription}
      />
      <FlagFieldRow
        label='STA'
        tooltip='Provides information about which interrupt has actually occurred'
        value={blinkState?.STA}
        flagDescriptions={STADescription}
      />
      <Separator />
      <ValueFieldRow
        label='SR0'
        tooltip='Segment Register 0 (Upper/lower 8K of Bank bound into 2000-3FFF'
        value={blinkState?.SR0}
      />
      <ValueFieldRow
        label='SR1'
        tooltip='Segment Register 1 (16K Bank bound into 4000-7FFF)'
        value={blinkState?.SR1}
      />
      <ValueFieldRow
        label='SR2'
        tooltip='Segment Register 2 (16K Bank bound into 8000-BFFF)'
        value={blinkState?.SR2}
      />
      <ValueFieldRow
        label='SR3'
        tooltip='Segment Register 3 (16K Bank bound into C000-FFFF)'
        value={blinkState?.SR3}
      />
      <Separator />
      <ValueFieldRow
        label='SBR'
        tooltip='Screen Base Register  - Point to Screen Base File of characters and attributes (typically) in RAM'
        value={blinkState?.SBR}
        word={true}
      />
      <Separator />
      <ValueFieldRow
        label='PB0'
        tooltip='Pixel Base 0 - Point to LORES0 (64 characters, 6 by 8 pixel) user defined font bitmap (typically) in RAM'
        value={blinkState?.PB0}
        word={true}
      />
      <ValueFieldRow
        label='PB1'
        tooltip='Pixel Base 1 - Point to LORES1 (448 characters, 6 by 8 pixel) font bitmap (typically) in ROM'
        value={blinkState?.PB1}
        word={true}
      />
      <ValueFieldRow
        label='PB2'
        tooltip='Pixel Base 2 - Point to HIRES0 (768 characters, 8 by 8 pixel) "PipeDream" map (typically) in RAM'
        value={blinkState?.PB2}
        word={true}
      />
      <ValueFieldRow
        label='PB3'
        tooltip='Pixel Base 3 - Point to HIRES1 (256 characters, 8 by 8 pixel) "OZ" font bitmap (typically) in ROM'
        value={blinkState?.PB3}
        word={true}
      />
      <Separator />
      <ValueFieldRow
        label='TIM0'
        tooltip='5ms period counter register (0-199)'
        value={blinkState?.TIM0}
      />
      <ValueFieldRow
        label='TIM1'
        tooltip='1sec period counter register (0-59)'
        value={blinkState?.TIM1}
      />
      <ValueFieldRow
        label='TIM2'
        tooltip='1min period counter register (0-255)'
        value={blinkState?.TIM2}
      />
      <ValueFieldRow
        label='TIM3'
        tooltip='256min period counter register (0-255)'
        value={blinkState?.TIM3}
      />
      <ValueFieldRow
        label='TIM4'
        tooltip='64Kmin period counter register (0-31)'
        value={blinkState?.TIM4}
      />
      <FlagFieldRow
        label='TSTA'
        tooltip='Timer Interrupt Status'
        value={blinkState?.TSTA}
        flagDescriptions={TSTADescription}
      />
      <FlagFieldRow
        label='TMK'
        tooltip='Timer Interrupt Mask'
        value={blinkState?.TMK}
        flagDescriptions={TMKDescription}
      />
      <Separator />
      <div className={styles.cols}>
        <KeyboardLine
          text='A15#7'
          tooltip='Keyboard address line A15 (#7) from KBD register'
          value={blinkState?.keyLines?.[7]}
          titles={[
            "\u00a3",
            "/",
            ".",
            "CAPS LOCK",
            "INDEX",
            "ESC",
            "\u25fb",
            "SHIFT (right)"
          ]}
        />
      </div>
      <div className={styles.cols}>
        <KeyboardLine
          text='A14#6'
          tooltip='Keyboard address line A14 (#6) from KBD register'
          value={blinkState?.keyLines?.[6]}
          titles={[
            "'",
            ";",
            ",",
            "MENU",
            "\u25c7",
            "TAB",
            "SHIFT (left)",
            "HELP"
          ]}
        />
      </div>
      <div className={styles.cols}>
        <KeyboardLine
          text='A13#5'
          tooltip='Keyboard address line A13 (#5) from KBD register'
          value={blinkState?.keyLines?.[5]}
          titles={["0", "L", "Z", "A", "Q", "1", "SPACE", "["]}
        />
      </div>
      <div className={styles.cols}>
        <KeyboardLine
          text='A12#4'
          tooltip='Keyboard address line A12 (#4) from KBD register'
          value={blinkState?.keyLines?.[4]}
          titles={["P", "M", "X", "S", "W", "2", "⬅︎", "]"]}
        />
      </div>
      <div className={styles.cols}>
        <KeyboardLine
          text='A11#3'
          tooltip='Keyboard address line A11 (#3) from KBD register'
          value={blinkState?.keyLines?.[3]}
          titles={["9", "K", "C", "D", "E", "3", "➡︎", "-"]}
        />
      </div>
      <div className={styles.cols}>
        <KeyboardLine
          text='A10#2'
          tooltip='Keyboard address line A10 (#2) from KBD register'
          value={blinkState?.keyLines?.[2]}
          titles={["O", "J", "V", "F", "R", "4", "⬇︎", "="]}
        />
      </div>
      <div className={styles.cols}>
        <KeyboardLine
          text='A09#1'
          tooltip='Keyboard address line A9 (#1) from KBD register'
          value={blinkState?.keyLines?.[1]}
          titles={["I", "U", "B", "G", "T", "5", "⬆︎", "\\"]}
        />
      </div>
      <div className={styles.cols}>
        <KeyboardLine
          text='A08#0'
          tooltip='Keyboard address line A8 (#0) from KBD register'
          value={blinkState?.keyLines?.[0]}
          titles={["8", "7", "N", "H", "Y", "6", "ENTER", "DEL"]}
        />
      </div>

    </div>
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
    <div className={styles.fieldRow}>
      <Label text={text} width={KEY_LAB_WIDTH} tooltip={tooltip} />
      <Flag
        value={toFlag(value, 7)}
        adjustLeft={false}
        width={FLAG_WIDTH}
        tooltip={titles?.[7]}
      />
      <Flag
        value={toFlag(value, 6)}
        adjustLeft={false}
        width={FLAG_WIDTH}
        tooltip={titles?.[6]}
      />
      <Flag
        value={toFlag(value, 5)}
        adjustLeft={false}
        width={FLAG_WIDTH}
        tooltip={titles?.[5]}
      />
      <Flag
        value={toFlag(value, 4)}
        adjustLeft={false}
        width={FLAG_WIDTH}
        tooltip={titles?.[4]}
      />
      <Flag
        value={toFlag(value, 3)}
        adjustLeft={false}
        width={FLAG_WIDTH}
        tooltip={titles?.[3]}
      />
      <Flag
        value={toFlag(value, 2)}
        adjustLeft={false}
        width={FLAG_WIDTH}
        tooltip={titles?.[2]}
      />
      <Flag
        value={toFlag(value, 1)}
        adjustLeft={false}
        width={FLAG_WIDTH}
        tooltip={titles?.[1]}
      />
      <Flag
        value={toFlag(value, 0)}
        adjustLeft={false}
        width={FLAG_WIDTH}
        tooltip={titles?.[0]}
      />
    </div>
  );
};

type FlagFieldRowProps = {
  label: string;
  tooltip: string;
  value: number;
  flagDescriptions: string[];
};

const FlagFieldRow = ({
  label,
  tooltip,
  value,
  flagDescriptions
}: FlagFieldRowProps) => {
  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldValue}>
        <Label text={label} width={LAB_WIDTH} tooltip={tooltip} />
        <FlagRow value={value} flagDescriptions={flagDescriptions} />
      </div>
    </div>
  );
};

type ValueFieldProps = {
  label: string;
  tooltip: string;
  value: number;
  word?: boolean;
};

const ValueFieldRow = ({ label, tooltip, value, word }: ValueFieldProps) => {
  return (
    <div className={styles.fieldRow}>
      <div className={styles.fieldValue}>
        <Label text={label} width={LAB_WIDTH} tooltip={tooltip} />
        <LabelSeparator width={2} />
        <Value
          text={word ? toHexa4(value ?? 0) : toHexa2(value ?? 0)}
          width={VALUE_WIDTH}
        />
        <Secondary text={`(${value})`} />
      </div>
    </div>
  );
};

export const blinkPanelRenderer = () => <BlinkPanel />;

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
  "Not Used", // bit 7
];

const TMKDescription = [
  "TICK - If set (1), enable tick interrupts", // bit 0
  "SEC - If Set (1), enable second interrupts",
  "MIN - If set (1), enable minute interrupts",
  "Not Used",
  "Not Used",
  "Not Used",
  "Not Used",
  "Not Used", // bit 7
];
