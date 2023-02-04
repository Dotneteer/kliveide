import {
  Flag,
  Label,
  Separator,
  Value
} from "@/controls/common/Labels";
import { useRendererContext } from "@/core/RendererProvider";
import {
  EmuGetUlaStateResponse
} from "@messaging/main-to-emu";
import { useState } from "react";
import { useStateRefresh } from "../useStateRefresh";
import styles from "./UlaPanel.module.scss";

const FLAG_WIDTH = 16;
const LAB_WIDTH = 36;
const R16_WIDTH = 48;

const UlaPanel = () => {
  const { messenger } = useRendererContext();
  const [ulaState, setUlaState] = useState<EmuGetUlaStateResponse>(null);

  useStateRefresh(250, async () => {
    setUlaState(
      (await messenger.sendMessage({
        type: "EmuGetUlaState"
      })) as EmuGetUlaStateResponse
    );
  });

  return (
    <div className={styles.ulaPanel}>
      <div className={styles.cols}>
        <Label text='FCL' width={LAB_WIDTH} />
        <Value
          text={ulaState?.fcl?.toString()}
          tooltip='Frame Clock'
          width={R16_WIDTH}
        />
      </div>
      <div className={styles.cols}>
        <Label text='FRM' width={LAB_WIDTH} />
        <Value
          text={ulaState?.frm?.toString()}
          tooltip='#of frames rendered'
          width={R16_WIDTH}
        />
      </div>
      <div className={styles.cols}>
        <Label text='RAS' width={LAB_WIDTH} />
        <Value
          text={ulaState?.ras?.toString()}
          tooltip='Current raster line'
          width={R16_WIDTH}
        />
      </div>
      <div className={styles.cols}>
        <Label text='POS' width={LAB_WIDTH} />
        <Value
          text={ulaState?.pos?.toString()}
          tooltip='Pixel in the current line'
          width={R16_WIDTH}
        />
      </div>
      <div className={styles.cols}>
        <Label text='PIX' width={LAB_WIDTH} />
        <Value
          text={ulaState?.pix}
          tooltip='Pixel operation'
          width={R16_WIDTH}
        />
      </div>
      <div className={styles.cols}>
        <Label text='BOR' width={LAB_WIDTH} />
        <Value
          text={ulaState?.bor}
          tooltip='Current border color'
          width={R16_WIDTH}
        />
      </div>
      <div className={styles.cols}>
        <Label text='FLO' width={LAB_WIDTH} />
        <Value
          text={ulaState?.flo?.toString()}
          tooltip='Floating bus value'
          width={R16_WIDTH}
        />
      </div>
      <Separator />
      <div className={styles.cols}>
        <Label text='CON' width={LAB_WIDTH} />
        <Value
          text={ulaState?.con?.toString()}
          tooltip='Accumulated contention tacts'
          width={R16_WIDTH}
        />
      </div>
      <div className={styles.cols}>
        <Label text='LCO' width={LAB_WIDTH} />
        <Value
          text={ulaState?.lco?.toString()}
          tooltip={"Accumulated contention \n since last resume"}
          width={R16_WIDTH}
        />
      </div>
      <div className={styles.cols}>
        <Label text='EAR' width={LAB_WIDTH} />
        <Flag
          value={ulaState?.ear}
          tooltip='EAR bit value'
          width={FLAG_WIDTH}
          center={false}
        />
      </div>
      <div className={styles.cols}>
        <Label text='MIC' width={LAB_WIDTH} />
        <Flag
          value={false}
          tooltip='MIC bit value'
          width={FLAG_WIDTH}
          center={ulaState?.mic}
        />
      </div>
      <Separator />
      <div className={styles.cols}>
        <Label text='KL0' width={LAB_WIDTH} tooltip='Keyboard line #0' />
        <KeyboardLine
          value={ulaState?.keyLines?.[0]}
          titles={["Caps Shift", "Z", "X", "C", "V"]}
        />
      </div>
      <div className={styles.cols}>
        <Label text='KL1' width={LAB_WIDTH} tooltip='Keyboard line #1' />
        <KeyboardLine
          value={ulaState?.keyLines?.[1]}
          titles={["A", "S", "D", "F", "H"]}
        />
      </div>
      <div className={styles.cols}>
        <Label text='KL2' width={LAB_WIDTH} tooltip='Keyboard line #2' />
        <KeyboardLine
          value={ulaState?.keyLines?.[2]}
          titles={["Q", "W", "E", "R", "T"]}
        />
      </div>
      <div className={styles.cols}>
        <Label text='KL3' width={LAB_WIDTH} tooltip='Keyboard line #3' />
        <KeyboardLine
          value={ulaState?.keyLines?.[3]}
          titles={["1", "2", "3", "4", "5"]}
        />
      </div>
      <div className={styles.cols}>
        <Label text='KL4' width={LAB_WIDTH} tooltip='Keyboard line #4' />
        <KeyboardLine
          value={ulaState?.keyLines?.[4]}
          titles={["0", "9", "8", "7", "6"]}
        />
      </div>
      <div className={styles.cols}>
        <Label text='KL5' width={LAB_WIDTH} tooltip='Keyboard line #5' />
        <KeyboardLine
          value={ulaState?.keyLines?.[5]}
          titles={["P", "O", "I", "U", "Y"]}
        />
      </div>
      <div className={styles.cols}>
        <Label text='KL6' width={LAB_WIDTH} tooltip='Keyboard line #6' />
        <KeyboardLine
          value={ulaState?.keyLines?.[6]}
          titles={["Enter", "L", "K", "J", "H"]}
        />
      </div>
      <div className={styles.cols}>
        <Label text='KL7' width={LAB_WIDTH} tooltip='Keyboard line #7' />
        <KeyboardLine
          value={ulaState?.keyLines?.[7]}
          titles={["Space", "Symbol Shift", "M", "N", "B"]}
        />
      </div>
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
      <Flag value={toFlag(value, 4)} width={FLAG_WIDTH} tooltip={titles?.[4]} />
      <Flag value={toFlag(value, 3)} width={FLAG_WIDTH} tooltip={titles?.[3]} />
      <Flag value={toFlag(value, 2)} width={FLAG_WIDTH} tooltip={titles?.[2]} />
      <Flag value={toFlag(value, 1)} width={FLAG_WIDTH} tooltip={titles?.[1]} />
      <Flag value={toFlag(value, 0)} width={FLAG_WIDTH} tooltip={titles?.[0]} />
    </div>
  );
};

export const ulaPanelRenderer = () => <UlaPanel />;
