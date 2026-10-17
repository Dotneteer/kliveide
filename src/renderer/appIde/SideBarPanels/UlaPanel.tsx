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
import { HistoryPresentBanner } from "../debugger/history/HistoryPresentBanner";
import { useT } from "@common/i18n/useT";

/**
 * The token every value in this panel is drawn with. Labels stay on `--data-label`; see the comment
 * over `--color-state-value` in `theming/tokens/componentAliases.ts` for why the panel takes one
 * hue rather than several.
 */
const VALUE_FILL = "--color-state-value";

export const UlaPanel = () => {
  const t = useT();
  const emuApi = useEmuApi();
  const [ulaState, setUlaState] = useState<UlaState>(null);
  const machineId = useSelector((s) => s.emulatorState?.machineId);

  useEmuStateListener(emuApi, async () => setUlaState(await emuApi.getUlaState()));

  const keyClicked = async (lineNo: number, bitNo: number) => {
    /*
     * Every read here is optional-chained because the first state has not arrived yet on the first
     * paint — and the spread below was not, so a click before then threw
     * `TypeError: undefined is not iterable` rather than doing nothing. Bail instead: there is no
     * key state to toggle until the emulator has told us what it is.
     */
    if (!ulaState?.keyLines) return;

    const keyState = !!(ulaState.keyLines[lineNo] & (1 << bitNo));
    const newUlaState = { ...ulaState, keyLines: [...ulaState.keyLines] };
    newUlaState.keyLines[lineNo] = keyState
      ? newUlaState.keyLines[lineNo] & ~(1 << bitNo)
      : newUlaState.keyLines[lineNo] | (1 << bitNo);
    await emuApi.setKeyStatus(5 * lineNo + bitNo, !keyState);
    setUlaState(newUlaState);
  };

  return (
    <DataPanel autoHeight>
      <HistoryPresentBanner subject="ula" />
      <DataRow dense>
        <SimpleValue
          label="FCL"
          value={ulaState?.fcl}
          tooltip={t("panels.side.ula.frameClock")}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="FRM"
          value={ulaState?.frm}
          tooltip={t("panels.side.ula.framesRendered")}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="RAS"
          value={ulaState?.ras}
          tooltip={t("panels.side.ula.rasterLine")}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="POS"
          value={ulaState?.pos}
          tooltip={t("panels.side.ula.pixelInLine")}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="PIX"
          value={ulaState?.pix}
          tooltip={t("panels.side.ula.pixelOperation")}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="BOR"
          value={ulaState?.bor}
          tooltip={t("panels.side.ula.borderColor")}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <SimpleValue
          label="FLO"
          value={ulaState?.flo}
          tooltip={t("panels.side.ula.floatingBus")}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <Separator />
      <DataRow dense>
        <SimpleValue
          label="CON"
          value={ulaState?.con}
          tooltip={t("panels.side.ula.contention")}
          valueXclass={regStyles.stateValue}
        />
        <SimpleValue
          label="LCO"
          value={ulaState?.lco}
          tooltip={t("panels.side.ula.contentionSincePause")}
          valueXclass={regStyles.stateValue}
        />
      </DataRow>
      <DataRow dense>
        <FlagValue label="EAR" value={ulaState?.ear} tooltip={t("panels.side.ula.earBit")} iconFill={VALUE_FILL} />
        <FlagValue label="MIC" value={ulaState?.mic} tooltip={t("panels.side.ula.micBit")} iconFill={VALUE_FILL} />
      </DataRow>
      <Separator />
      <DataRow dense>
        <Label text="KL0" className={styles.klLabel} tooltip={t("panels.side.ula.keyboardLine", { line: 0 })} />
        <KeyboardLine
          lineNo={0}
          value={ulaState?.keyLines?.[0]}
          titles={["Caps Shift", "Z", "X", "C", "V"]}
          clicked={keyClicked}
        />
      </DataRow>
      <DataRow dense>
        <Label text="KL1" className={styles.klLabel} tooltip={t("panels.side.ula.keyboardLine", { line: 1 })} />
        <KeyboardLine
          lineNo={1}
          value={ulaState?.keyLines?.[1]}
          titles={["A", "S", "D", "F", "G"]}
          clicked={keyClicked}
        />
      </DataRow>
      <DataRow dense>
        <Label text="KL2" className={styles.klLabel} tooltip={t("panels.side.ula.keyboardLine", { line: 2 })} />
        <KeyboardLine
          lineNo={2}
          value={ulaState?.keyLines?.[2]}
          titles={["Q", "W", "E", "R", "T"]}
          clicked={keyClicked}
        />
      </DataRow>
      <DataRow dense>
        <Label text="KL3" className={styles.klLabel} tooltip={t("panels.side.ula.keyboardLine", { line: 3 })} />
        <KeyboardLine
          lineNo={3}
          value={ulaState?.keyLines?.[3]}
          titles={["1", "2", "3", "4", "5"]}
          clicked={keyClicked}
        />
      </DataRow>
      <DataRow dense>
        <Label text="KL4" className={styles.klLabel} tooltip={t("panels.side.ula.keyboardLine", { line: 4 })} />
        <KeyboardLine
          lineNo={4}
          value={ulaState?.keyLines?.[4]}
          titles={["0", "9", "8", "7", "6"]}
          clicked={keyClicked}
        />
      </DataRow>
      <DataRow dense>
        <Label text="KL5" className={styles.klLabel} tooltip={t("panels.side.ula.keyboardLine", { line: 5 })} />
        <KeyboardLine
          lineNo={5}
          value={ulaState?.keyLines?.[5]}
          titles={["P", "O", "I", "U", "Y"]}
          clicked={keyClicked}
        />
      </DataRow>
      <DataRow dense>
        <Label text="KL6" className={styles.klLabel} tooltip={t("panels.side.ula.keyboardLine", { line: 6 })} />
        <KeyboardLine
          lineNo={6}
          value={ulaState?.keyLines?.[6]}
          titles={["Enter", "L", "K", "J", "H"]}
          clicked={keyClicked}
        />
      </DataRow>
      <DataRow dense>
        <Label text="KL7" className={styles.klLabel} tooltip={t("panels.side.ula.keyboardLine", { line: 7 })} />
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
            tooltip={t("panels.side.ula.romPage")}
            valueXclass={regStyles.stateValue}
          />
          <SimpleValue
            label="RAMB"
            value={ulaState?.ramB}
            tooltip={t("panels.side.ula.ramBank")}
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

