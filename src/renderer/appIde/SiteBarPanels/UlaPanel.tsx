import { Label } from "@renderer/controls/layout/Label";
import { Separator } from "@renderer/controls/layout/Separator";
import { useSelector } from "@renderer/core/RendererProvider";
import { useState } from "react";
import { useEmuStateListener } from "../useStateRefresh";
import { useEmuApi } from "@renderer/core/EmuApi";
import { UlaState } from "@common/messaging/EmuApi";
import { BitValue, FlagValue, SimpleValue } from "@renderer/controls/data/registers";
import { DataPanel, DataRow } from "@renderer/controls/data";
import regStyles from "@renderer/controls/data/Registers.module.scss";
import styles from "./UlaPanel.module.scss";

/**
 * The token every value in this panel is drawn with. Labels stay on `--data-label`; see the comment
 * over `--color-state-value` in `theming/tokens/componentAliases.ts` for why the panel takes one
 * hue rather than several.
 */
const VALUE_FILL = "--color-state-value";

export const UlaPanel = () => {
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
    <DataPanel autoHeight>
      <DataRow dense>
        <SimpleValue
          label="FCL"
          value={ulaState?.fcl}
          tooltip="FrameClock"
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="FRM"
          value={ulaState?.frm}
          tooltip="#of frames rendered"
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="RAS"
          value={ulaState?.ras}
          tooltip="Current raster line"
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="POS"
          value={ulaState?.pos}
          tooltip="Pixel in the current line"
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="PIX"
          value={ulaState?.pix}
          tooltip="Pixel operation"
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="BOR"
          value={ulaState?.bor}
          tooltip="Current border color"
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="FLO"
          value={ulaState?.flo}
          tooltip="Floating bus value"
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="CON"
          value={ulaState?.con}
          tooltip="Contention tacts"
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="LCO"
          value={ulaState?.lco}
          tooltip="Contention tacts since last pause"
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue label="EAR" value={ulaState?.ear} tooltip="EAR bit value" iconFill={VALUE_FILL} />
        <FlagValue label="MIC" value={ulaState?.mic} tooltip="MIC bit value" iconFill={VALUE_FILL} />
      </DataRow>
      <Separator />
      <DataRow dense>
        <Label text="KL0" className={styles.klLabel} tooltip="Keyboard line #0" />
        <KeyboardLine
          lineNo={0}
          value={ulaState?.keyLines?.[0]}
          titles={["Caps Shift", "Z", "X", "C", "V"]}
          clicked={keyClicked}
        />
      </DataRow>
      <DataRow dense>
        <Label text="KL1" className={styles.klLabel} tooltip="Keyboard line #1" />
        <KeyboardLine
          lineNo={1}
          value={ulaState?.keyLines?.[1]}
          titles={["A", "S", "D", "F", "G"]}
          clicked={keyClicked}
        />
      </DataRow>
      <DataRow dense>
        <Label text="KL2" className={styles.klLabel} tooltip="Keyboard line #2" />
        <KeyboardLine
          lineNo={2}
          value={ulaState?.keyLines?.[2]}
          titles={["Q", "W", "E", "R", "T"]}
          clicked={keyClicked}
        />
      </DataRow>
      <DataRow dense>
        <Label text="KL3" className={styles.klLabel} tooltip="Keyboard line #3" />
        <KeyboardLine
          lineNo={3}
          value={ulaState?.keyLines?.[3]}
          titles={["1", "2", "3", "4", "5"]}
          clicked={keyClicked}
        />
      </DataRow>
      <DataRow dense>
        <Label text="KL4" className={styles.klLabel} tooltip="Keyboard line #4" />
        <KeyboardLine
          lineNo={4}
          value={ulaState?.keyLines?.[4]}
          titles={["0", "9", "8", "7", "6"]}
          clicked={keyClicked}
        />
      </DataRow>
      <DataRow dense>
        <Label text="KL5" className={styles.klLabel} tooltip="Keyboard line #5" />
        <KeyboardLine
          lineNo={5}
          value={ulaState?.keyLines?.[5]}
          titles={["P", "O", "I", "U", "Y"]}
          clicked={keyClicked}
        />
      </DataRow>
      <DataRow dense>
        <Label text="KL6" className={styles.klLabel} tooltip="Keyboard line #6" />
        <KeyboardLine
          lineNo={6}
          value={ulaState?.keyLines?.[6]}
          titles={["Enter", "L", "K", "J", "H"]}
          clicked={keyClicked}
        />
      </DataRow>
      <DataRow dense>
        <Label text="KL7" className={styles.klLabel} tooltip="Keyboard line #7" />
        <KeyboardLine
          lineNo={7}
          value={ulaState?.keyLines?.[7]}
          titles={["Space", "Symbol Shift", "M", "N", "B"]}
          clicked={keyClicked}
        />
      </DataRow>
      {machineId === "sp128" && (
        <>
          <Separator />
          <SimpleValue
            label="ROMP"
            value={ulaState?.romP}
            tooltip="Current ROM page"
            valueXclass={regStyles.stateValue}
          />
          <SimpleValue
            label="RAMB"
            value={ulaState?.ramB}
            tooltip="Current RAM bank"
            valueXclass={regStyles.stateValue}
          />
        </>
      )}
    </DataPanel>
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
    <DataRow dense>
      {[4, 3, 2, 1, 0].map((bit) => (
        <BitValue
          key={bit}
          value={toFlag(value, bit)}
          clicked={() => lineClicked(bit)}
          tooltip={titles?.[bit]}
          iconFill={VALUE_FILL}
          xclass={styles.keyBit}
        />
      ))}
    </DataRow>
  );
};

