import { Flag, Label, Separator, Value } from "@controls/Labels";
import {
  useRendererContext,
  useSelector
} from "@renderer/core/RendererProvider";
import {
  EmuGetBlinkStateResponse,
} from "@messaging/main-to-emu";
import { useState } from "react";
import { useStateRefresh } from "../useStateRefresh";
import styles from "./BlinkPanel.module.scss";
import { LabeledValue } from "@renderer/controls/LabeledValue";
import { LabeledFlag } from "@renderer/controls/LabeledFlag";

const FLAG_WIDTH = 16;
const LAB_WIDTH = 48;

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
      <LabeledValue label='COM' value={blinkState?.COM} toolTip='Frame Clock' />
      {/* <LabeledValue
        label='FRM'
        value={blinkState?.frm}
        toolTip='#of frames rendered'
      /> */}
      {/* <LabeledValue
        label='RAS'
        value={blinkState?.ras}
        toolTip='Current raster line'
      />
      <LabeledValue
        label='POS'
        value={blinkState?.pos}
        toolTip='Pixel in the current line'
      />
      <LabeledValue
        label='PIX'
        value={blinkState?.pix}
        toolTip='Pixel operation'
      /> */}
      {/* <LabeledValue
        label='BOR'
        value={blinkState?.bor}
        toolTip='Current border color'
      />
      <LabeledValue
        label='FLO'
        value={blinkState?.flo}
        toolTip='Floating bus value'
      />
      <Separator />
      <LabeledValue
        label='CON'
        value={blinkState?.con}
        toolTip='Accumulated contention tacts'
      /> */}
      {/* <LabeledValue
        label='LCO'
        value={blinkState?.con}
        toolTip='Accumulated contention tacts'
      />
      <LabeledFlag
        label='EAR'
        value={blinkState?.ear}
        toolTip='EAR bit value'
      /> */}
      {/* <LabeledFlag
        label='MIC'
        value={blinkState?.mic}
        toolTip='MIC bit value'
      />
      <Separator />
      <div className={styles.cols}>
        <Label text='KL0' width={LAB_WIDTH} tooltip='Keyboard line #0' />
        <KeyboardLine
          value={blinkState?.keyLines?.[0]}
          titles={["Caps Shift", "Z", "X", "C", "V"]}
        />
      </div> */}
      {/* <div className={styles.cols}>
        <Label text='KL1' width={LAB_WIDTH} tooltip='Keyboard line #1' />
        <KeyboardLine
          value={blinkState?.keyLines?.[1]}
          titles={["A", "S", "D", "F", "H"]}
        />
      </div> */}
      {/* <div className={styles.cols}>
        <Label text='KL2' width={LAB_WIDTH} tooltip='Keyboard line #2' />
        <KeyboardLine
          value={blinkState?.keyLines?.[2]}
          titles={["Q", "W", "E", "R", "T"]}
        />
      </div> */}
      {/* <div className={styles.cols}>
        <Label text='KL3' width={LAB_WIDTH} tooltip='Keyboard line #3' />
        <KeyboardLine
          value={blinkState?.keyLines?.[3]}
          titles={["1", "2", "3", "4", "5"]}
        />
      </div>
      <div className={styles.cols}>
        <Label text='KL4' width={LAB_WIDTH} tooltip='Keyboard line #4' />
        <KeyboardLine
          value={blinkState?.keyLines?.[4]}
          titles={["0", "9", "8", "7", "6"]}
        />
      </div>
      <div className={styles.cols}>
        <Label text='KL5' width={LAB_WIDTH} tooltip='Keyboard line #5' />
        <KeyboardLine
          value={blinkState?.keyLines?.[5]}
          titles={["P", "O", "I", "U", "Y"]}
        />
      </div> */}
      {/* <div className={styles.cols}>
        <Label text='KL6' width={LAB_WIDTH} tooltip='Keyboard line #6' />
        <KeyboardLine
          value={blinkState?.keyLines?.[6]}
          titles={["Enter", "L", "K", "J", "H"]}
        />
      </div>
      <div className={styles.cols}>
        <Label text='KL7' width={LAB_WIDTH} tooltip='Keyboard line #7' />
        <KeyboardLine
          value={blinkState?.keyLines?.[7]}
          titles={["Space", "Symbol Shift", "M", "N", "B"]}
        />
      </div> */}
    </div>
  );
};

type FlagLineProps = {
  value: number;
  titles?: string[];
};

const KeyboardLine = ({ value, titles }: FlagLineProps) => {
  const toFlag = (val: number | undefined, bitNo: number) =>
    val !== undefined ? !!(val & (1 << bitNo)) : undefined;
  return (
    <div className={styles.cols}>
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

export const blinkPanelRenderer = () => <BlinkPanel />;
