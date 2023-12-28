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
        tooltip='Controls various diverse aspects of BLINK operations'
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
        tooltip='Segment Register 0'
        value={blinkState?.SR0}
      />
      <ValueFieldRow
        label='SR1'
        tooltip='Segment Register 1'
        value={blinkState?.SR1}
      />
      <ValueFieldRow
        label='SR2'
        tooltip='Segment Register 2'
        value={blinkState?.SR2}
      />
      <ValueFieldRow
        label='SR3'
        tooltip='Segment Register 3'
        value={blinkState?.SR3}
      />
      <Separator />
      <ValueFieldRow
        label='PB0'
        tooltip='LORES0'
        value={blinkState?.PB0}
        word={true}
      />
      <ValueFieldRow
        label='PB1'
        tooltip='LORES1'
        value={blinkState?.PB1}
        word={true}
      />
      <ValueFieldRow
        label='PB2'
        tooltip='HIRES0'
        value={blinkState?.PB2}
        word={true}
      />
      <ValueFieldRow
        label='PB3'
        tooltip='HIRES1'
        value={blinkState?.PB3}
        word={true}
      />
      <ValueFieldRow
        label='SBR'
        tooltip='SBR'
        value={blinkState?.SBR}
        word={true}
      />
      <Separator />
      <ValueFieldRow
        label='TIM0'
        tooltip='Timer register (5ms ticks)'
        value={blinkState?.TIM0}
      />
      <ValueFieldRow
        label='TIM1'
        tooltip='Timer register (1 second)'
        value={blinkState?.TIM1}
      />
      <ValueFieldRow
        label='TIM2'
        tooltip='Timer register (1 minute)'
        value={blinkState?.TIM2}
      />
      <ValueFieldRow
        label='TIM3'
        tooltip='Timer register (256 minutes)'
        value={blinkState?.TIM3}
      />
      <ValueFieldRow
        label='TIM4'
        tooltip='Timer register (64K minutes)'
        value={blinkState?.TIM4}
      />
      <FlagFieldRow
        label='TSTA'
        tooltip='Timer interrupt status'
        value={blinkState?.TSTA}
        flagDescriptions={TSTADescription}
      />
      <FlagFieldRow
        label='TMK'
        tooltip='Timer interrupt mask'
        value={blinkState?.TMK}
        flagDescriptions={TMKDescription}
      />
      <Separator />
      <div className={styles.cols}>
        <KeyboardLine
          text='KL0'
          tooltip='Keyboard line #0'
          value={blinkState?.keyLines?.[0]}
          titles={["8", "7", "N", "H", "Y", "6", "ENTER", "DEL"]}
        />
      </div>
      <div className={styles.cols}>
        <KeyboardLine
          text='KL1'
          tooltip='Keyboard line #1'
          value={blinkState?.keyLines?.[1]}
          titles={["I", "U", "B", "G", "T", "5", "⬆︎", "\\"]}
        />
      </div>
      <div className={styles.cols}>
        <KeyboardLine
          text='KL2'
          tooltip='Keyboard line #2'
          value={blinkState?.keyLines?.[2]}
          titles={["O", "J", "V", "F", "R", "4", "⬇︎", "="]}
        />
      </div>
      <div className={styles.cols}>
        <KeyboardLine
          text='KL3'
          tooltip='Keyboard line #3'
          value={blinkState?.keyLines?.[3]}
          titles={["9", "K", "C", "D", "E", "3", "➡︎", "-"]}
        />
      </div>
      <div className={styles.cols}>
        <KeyboardLine
          text='KL4'
          tooltip='Keyboard line #4'
          value={blinkState?.keyLines?.[4]}
          titles={["P", "M", "X", "S", "W", "2", "⬅︎", "]"]}
        />
      </div>
      <div className={styles.cols}>
        <KeyboardLine
          text='KL5'
          tooltip='Keyboard line #5'
          value={blinkState?.keyLines?.[5]}
          titles={["0", "L", "Z", "A", "Q", "1", "SPACE", "["]}
        />
      </div>
      <div className={styles.cols}>
        <KeyboardLine
          text='KL6'
          tooltip='Keyboard line #6'
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
          text='KL7'
          tooltip='Keyboard line #7'
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
  "LCDON - Set to turn LCD ON, clear to turn LCD OFF",
  "VPPON - Set to turn programming voltage ON",
  "RAMS - Binding of lower 8K of segment 0: 0=bank 0, 1=bank 20",
  "PROGRAM - Set to enable EPROM programming",
  "RESTIM - Set to reset the RTC, clear to continue",
  "OVERP - Set to overprogram EPROMs",
  "SBIT - SRUN=0: 0=low, 1=high; SRUN=1: 0=3200 Hz, 1=TxD",
  "SRUN - Speaker source (0=SBIT, 1=TxD or 3200 Hz)"
];

const INTDescription = [
  // TODO
];

const STADescription = [
  // TODO
];

const TSTADescription = [
  // TODO
];

const TMKDescription = [
  // TODO
];
