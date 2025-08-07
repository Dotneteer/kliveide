import { Label, Separator } from "@controls/Labels";
import { useSelector } from "@renderer/core/RendererProvider";
import { useState } from "react";
import { useEmuStateListener } from "../useStateRefresh";
import { useEmuApi } from "@renderer/core/EmuApi";
import { UlaState } from "@common/messaging/EmuApi";
import { BitValue, FlagValue, SimpleValue } from "@renderer/controls/valuedisplay/Values";
import { Col, SidePanel } from "@renderer/controls/valuedisplay/Layout";

const LAB_WIDTH = 48;

const UlaPanel = () => {
  const emuApi = useEmuApi();
  const [ulaState, setUlaState] = useState<UlaState>(null);
  const machineId = useSelector((s) => s.emulatorState?.machineId);

  useEmuStateListener(emuApi, async () => setUlaState(await emuApi.getUlaState()));

  const keyClicked = async (lineNo: number, bitNo: number) => {
    const keyState = !!(ulaState?.keyLines?.[lineNo] & (1 << bitNo));
    const newUlaState = { ...ulaState, keyLines: [...ulaState?.keyLines] };
    newUlaState.keyLines[lineNo] = keyState
      ? newUlaState.keyLines[lineNo] & ~(1 << bitNo)
      : newUlaState.keyLines[lineNo] | (1 << bitNo);
    await emuApi.setKeyStatus(5 * lineNo + bitNo, !keyState);
    setUlaState(newUlaState);
  };

  return (
    <SidePanel>
      <Col>
        <SimpleValue label="FCL" value={ulaState?.fcl} tooltip="FrameClock" />
        <SimpleValue label="FRM" value={ulaState?.frm} tooltip="#of frames rendered" />
      </Col>
      <Col>
        <SimpleValue label="RAS" value={ulaState?.ras} tooltip="Current raster line" />
        <SimpleValue label="POS" value={ulaState?.pos} tooltip="Pixel in the current line" />
      </Col>
      <Col>
        <SimpleValue label="PIX" value={ulaState?.pix} tooltip="Pixel operation" />
        <SimpleValue label="BOR" value={ulaState?.bor} tooltip="Current border color" />
      </Col>
      <Col>
        <SimpleValue label="FLO" value={ulaState?.flo} tooltip="Floating bus value" />
      </Col>
      <Separator />
      <Col>
        <SimpleValue label="CON" value={ulaState?.con} tooltip="Contention tacts" fullWidth />
        <SimpleValue
          label="LCO"
          value={ulaState?.lco}
          tooltip="Contention tacts since last pause"
          fullWidth
        />
      </Col>
      <Col>
        <FlagValue label="EAR" value={ulaState?.ear} tooltip="EAR bit value" />
        <FlagValue label="MIC" value={ulaState?.mic} tooltip="MIC bit value" />
      </Col>
      <Separator />
      <Col>
        <Label text="KL0" width={LAB_WIDTH} tooltip="Keyboard line #0" />
        <KeyboardLine
          lineNo={0}
          value={ulaState?.keyLines?.[0]}
          titles={["Caps Shift", "Z", "X", "C", "V"]}
          clicked={keyClicked}
        />
      </Col>
      <Col>
        <Label text="KL1" width={LAB_WIDTH} tooltip="Keyboard line #1" />
        <KeyboardLine
          lineNo={1}
          value={ulaState?.keyLines?.[1]}
          titles={["A", "S", "D", "F", "G"]}
          clicked={keyClicked}
        />
      </Col>
      <Col>
        <Label text="KL2" width={LAB_WIDTH} tooltip="Keyboard line #2" />
        <KeyboardLine
          lineNo={2}
          value={ulaState?.keyLines?.[2]}
          titles={["Q", "W", "E", "R", "T"]}
          clicked={keyClicked}
        />
      </Col>
      <Col>
        <Label text="KL3" width={LAB_WIDTH} tooltip="Keyboard line #3" />
        <KeyboardLine
          lineNo={3}
          value={ulaState?.keyLines?.[3]}
          titles={["1", "2", "3", "4", "5"]}
          clicked={keyClicked}
        />
      </Col>
      <Col>
        <Label text="KL4" width={LAB_WIDTH} tooltip="Keyboard line #4" />
        <KeyboardLine
          lineNo={4}
          value={ulaState?.keyLines?.[4]}
          titles={["0", "9", "8", "7", "6"]}
          clicked={keyClicked}
        />
      </Col>
      <Col>
        <Label text="KL5" width={LAB_WIDTH} tooltip="Keyboard line #5" />
        <KeyboardLine
          lineNo={5}
          value={ulaState?.keyLines?.[5]}
          titles={["P", "O", "I", "U", "Y"]}
          clicked={keyClicked}
        />
      </Col>
      <Col>
        <Label text="KL6" width={LAB_WIDTH} tooltip="Keyboard line #6" />
        <KeyboardLine
          lineNo={6}
          value={ulaState?.keyLines?.[6]}
          titles={["Enter", "L", "K", "J", "H"]}
          clicked={keyClicked}
        />
      </Col>
      <Col>
        <Label text="KL7" width={LAB_WIDTH} tooltip="Keyboard line #7" />
        <KeyboardLine
          lineNo={7}
          value={ulaState?.keyLines?.[7]}
          titles={["Space", "Symbol Shift", "M", "N", "B"]}
          clicked={keyClicked}
        />
      </Col>
      {machineId === "sp128" && (
        <>
          <Separator />
          <SimpleValue label="ROMP" value={ulaState?.romP} tooltip="Current ROM page" />
          <SimpleValue label="RAMB" value={ulaState?.ramB} tooltip="Current RAM bank" />
        </>
      )}
    </SidePanel>
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
    <Col>
      <BitValue value={toFlag(value, 4)} clicked={() => lineClicked(4)} tooltip={titles?.[4]} />
      <BitValue value={toFlag(value, 3)} clicked={() => lineClicked(3)} tooltip={titles?.[3]} />
      <BitValue value={toFlag(value, 2)} clicked={() => lineClicked(2)} tooltip={titles?.[2]} />
      <BitValue value={toFlag(value, 1)} clicked={() => lineClicked(1)} tooltip={titles?.[1]} />
      <BitValue value={toFlag(value, 0)} clicked={() => lineClicked(0)} tooltip={titles?.[0]} />
    </Col>
  );
};

export const ulaPanelRenderer = () => <UlaPanel />;
