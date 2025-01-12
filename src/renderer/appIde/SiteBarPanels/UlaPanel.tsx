import { Flag, Label, Separator } from "@controls/Labels";
import { useSelector } from "@renderer/core/RendererProvider";
import { EmuGetUlaStateResponse } from "@messaging/main-to-emu";
import { useState } from "react";
import { useStateRefresh } from "../useStateRefresh";
import styles from "./UlaPanel.module.scss";
import { LabeledValue } from "@renderer/controls/LabeledValue";
import { LabeledFlag } from "@renderer/controls/LabeledFlag";
import { useEmuApi } from "@renderer/core/EmuApi";
import { useEmuApiAlt } from "@renderer/core/EmuApiAlt";
import { UlaState } from "@common/messaging/EmuApiAlt";

const FLAG_WIDTH = 16;
const LAB_WIDTH = 48;

const UlaPanel = () => {
  const emuApi = useEmuApi();
  const emuApiAlt = useEmuApiAlt();
  const [ulaState, setUlaState] = useState<UlaState>(null);
  const machineId = useSelector((s) => s.emulatorState?.machineId);

  useStateRefresh(250, async () => setUlaState(await emuApiAlt.getUlaState()));

  const keyClicked = async (lineNo: number, bitNo: number) => {
    const keyState = !!(ulaState?.keyLines?.[lineNo] & (1 << bitNo));
    const newUlaState = { ...ulaState, keyLines: [...ulaState?.keyLines] };
    newUlaState.keyLines[lineNo] = keyState
      ? newUlaState.keyLines[lineNo] & ~(1 << bitNo)
      : newUlaState.keyLines[lineNo] | (1 << bitNo);
    console.log("KeyState", keyState);
    await emuApi.setKeyStatus(5 * lineNo + bitNo, !keyState);
    setUlaState(newUlaState);
  }

  return (
    <div className={styles.ulaPanel}>
      <LabeledValue label="FCL" value={ulaState?.fcl} toolTip="Frame Clock" />
      <LabeledValue label="FRM" value={ulaState?.frm} toolTip="#of frames rendered" />
      <LabeledValue label="RAS" value={ulaState?.ras} toolTip="Current raster line" />
      <LabeledValue label="POS" value={ulaState?.pos} toolTip="Pixel in the current line" />
      <LabeledValue label="PIX" value={ulaState?.pix} toolTip="Pixel operation" />
      <LabeledValue label="BOR" value={ulaState?.bor} toolTip="Current border color" />
      <LabeledValue label="FLO" value={ulaState?.flo} toolTip="Floating bus value" />
      <Separator />
      <LabeledValue label="CON" value={ulaState?.con} toolTip="Accumulated contention tacts" />
      <LabeledValue label="LCO" value={ulaState?.con} toolTip="Accumulated contention tacts" />
      <LabeledFlag label="EAR" value={ulaState?.ear} toolTip="EAR bit value" />
      <LabeledFlag label="MIC" value={ulaState?.mic} toolTip="MIC bit value" />
      <Separator />
      <div className={styles.cols}>
        <Label text="KL0" width={LAB_WIDTH} tooltip="Keyboard line #0" />
        <KeyboardLine
          lineNo={0}
          value={ulaState?.keyLines?.[0]}
          titles={["Caps Shift", "Z", "X", "C", "V"]}
          clicked={keyClicked}
        />
      </div>
      <div className={styles.cols}>
        <Label text="KL1" width={LAB_WIDTH} tooltip="Keyboard line #1" />
        <KeyboardLine
          lineNo={1}
          value={ulaState?.keyLines?.[1]}
          titles={["A", "S", "D", "F", "H"]}
          clicked={keyClicked}
        />
      </div>
      <div className={styles.cols}>
        <Label text="KL2" width={LAB_WIDTH} tooltip="Keyboard line #2" />
        <KeyboardLine
          lineNo={2}
          value={ulaState?.keyLines?.[2]}
          titles={["Q", "W", "E", "R", "T"]}
          clicked={keyClicked}
        />
      </div>
      <div className={styles.cols}>
        <Label text="KL3" width={LAB_WIDTH} tooltip="Keyboard line #3" />
        <KeyboardLine
          lineNo={3}
          value={ulaState?.keyLines?.[3]}
          titles={["1", "2", "3", "4", "5"]}
          clicked={keyClicked}
        />
      </div>
      <div className={styles.cols}>
        <Label text="KL4" width={LAB_WIDTH} tooltip="Keyboard line #4" />
        <KeyboardLine
          lineNo={4}
          value={ulaState?.keyLines?.[4]}
          titles={["0", "9", "8", "7", "6"]}
          clicked={keyClicked}
        />
      </div>
      <div className={styles.cols}>
        <Label text="KL5" width={LAB_WIDTH} tooltip="Keyboard line #5" />
        <KeyboardLine
          lineNo={5}
          value={ulaState?.keyLines?.[5]}
          titles={["P", "O", "I", "U", "Y"]}
          clicked={keyClicked}
        />
      </div>
      <div className={styles.cols}>
        <Label text="KL6" width={LAB_WIDTH} tooltip="Keyboard line #6" />
        <KeyboardLine
          lineNo={6}
          value={ulaState?.keyLines?.[6]}
          titles={["Enter", "L", "K", "J", "H"]}
          clicked={keyClicked}
        />
      </div>
      <div className={styles.cols}>
        <Label text="KL7" width={LAB_WIDTH} tooltip="Keyboard line #7" />
        <KeyboardLine
          lineNo={7}
          value={ulaState?.keyLines?.[7]}
          titles={["Space", "Symbol Shift", "M", "N", "B"]}
          clicked={keyClicked}
        />
      </div>
      {machineId === "sp128" && (
        <>
          <Separator />
          <LabeledValue label="ROMP" value={ulaState?.romP} toolTip="Current ROM page" />
          <LabeledValue label="RAMB" value={ulaState?.ramB} toolTip="Current RAM bank" />
        </>
      )}
    </div>
  );
};

type FlagLineProps = {
  value: number;
  lineNo: number;
  titles?: string[];
  clicked?: (lineNo: number, bitNo: number) => void;
};

const KeyboardLine = ({ value, titles, lineNo, clicked }: FlagLineProps) => {
  const toFlag = (val: number | undefined, bitNo: number) =>
    val !== undefined ? !!(val & (1 << bitNo)) : undefined;
  const lineClicked = (bitNo: number) => clicked?.(lineNo, bitNo);
  return (
    <div className={styles.cols}>
      <Flag
        value={toFlag(value, 4)}
        adjustLeft={false}
        width={FLAG_WIDTH}
        tooltip={titles?.[4]}
        clicked={() => lineClicked(4)}
      />
      <Flag
        value={toFlag(value, 3)}
        adjustLeft={false}
        width={FLAG_WIDTH}
        tooltip={titles?.[3]}
        clicked={() => lineClicked(3)}
      />
      <Flag
        value={toFlag(value, 2)}
        adjustLeft={false}
        width={FLAG_WIDTH}
        tooltip={titles?.[2]}
        clicked={() => lineClicked(2)}
      />
      <Flag
        value={toFlag(value, 1)}
        adjustLeft={false}
        width={FLAG_WIDTH}
        tooltip={titles?.[1]}
        clicked={() => lineClicked(1)}
      />
      <Flag
        value={toFlag(value, 0)}
        adjustLeft={false}
        width={FLAG_WIDTH}
        tooltip={titles?.[0]}
        clicked={() => lineClicked(0)}
      />
    </div>
  );
};

export const ulaPanelRenderer = () => <UlaPanel />;
