import styles from "./M6510CpuPanel.module.scss";
import { Flag, Label, LabelSeparator, Separator, Value } from "@controls/Labels";
import { useState } from "react";
import { useEmuStateListener } from "../useStateRefresh";
import { useEmuApi } from "@renderer/core/EmuApi";
import { M6510CpuState } from "@common/messaging/EmuApi";
import { toBin16, toBin8 } from "../services/ide-commands";

const FLAG_WIDTH = 16;
const LAB_WIDTH = 36;
const R16_WIDTH = 48;
const TACT_WIDTH = 72;

const CpuPanel = () => {
  const emuApi = useEmuApi();
  const [cpuState, setCpuState] = useState<M6510CpuState>(null);

  const toHexa2 = (value?: number) =>
    value !== undefined ? value.toString(16).toUpperCase().padStart(2, "0") : "--";
  const toHexa4 = (value?: number) =>
    value !== undefined ? value.toString(16).toUpperCase().padStart(4, "0") : "----";
  const toTitle = (value: number | undefined, reg: string, is16Bit = false) => {
    return value !== undefined
      ? `${reg}: ${value.toString()}, ${is16Bit ? toBin16(value) : toBin8(value)}`
      : "n/a";
  };
  const toFlag = (value: number | undefined, bitNo: number) =>
    value !== undefined ? !!(value & (1 << bitNo)) : undefined;

  useEmuStateListener(emuApi, async () => {
    setCpuState(await emuApi.getCpuState() as M6510CpuState);
  });

  return (
    <div className={styles.cpuPanel}>
      <div className={styles.flags}>
        <div className={styles.f}>F</div>
        <div className={styles.rows}>
          <div className={styles.cols}>
            <Label text="N" width={FLAG_WIDTH} center />
            <Label text="V" width={FLAG_WIDTH} center />
            <Label text="-" width={FLAG_WIDTH} center />
            <Label text="B" width={FLAG_WIDTH} center />
            <Label text="D" width={FLAG_WIDTH} center />
            <Label text="I" width={FLAG_WIDTH} center />
            <Label text="Z" width={FLAG_WIDTH} center />
            <Label text="C" width={FLAG_WIDTH} center />
          </div>
          <div className={styles.cols}>
            <Flag
              value={toFlag(cpuState?.p, 7)}
              adjustLeft={false}
              width={FLAG_WIDTH}
              tooltip="Negative"
            />
            <Flag
              value={toFlag(cpuState?.p, 6)}
              adjustLeft={false}
              width={FLAG_WIDTH}
              tooltip="Overflow"
            />
            <Flag
              value={toFlag(cpuState?.p, 5)}
              adjustLeft={false}
              width={FLAG_WIDTH}
              tooltip="Unused (always set)"
            />
            <Flag
              value={toFlag(cpuState?.p, 4)}
              adjustLeft={false}
              width={FLAG_WIDTH}
              tooltip="Break"
            />
            <Flag
              value={toFlag(cpuState?.p, 3)}
              adjustLeft={false}
              width={FLAG_WIDTH}
              tooltip="Decimal mode"
            />
            <Flag
              value={toFlag(cpuState?.p, 2)}
              adjustLeft={false}
              width={FLAG_WIDTH}
              tooltip="Interrupt mask"
            />
            <Flag
              value={toFlag(cpuState?.p, 1)}
              adjustLeft={false}
              width={FLAG_WIDTH}
              tooltip="Zero"
            />
            <Flag
              value={toFlag(cpuState?.p, 0)}
              adjustLeft={false}
              width={FLAG_WIDTH}
              tooltip="Carry"
            />
          </div>
        </div>
      </div>
      <Separator />
      <div className={styles.cols}>
        <Label text="A" width={LAB_WIDTH} />
        <Value
          text={toHexa2(cpuState?.a)}
          tooltip={toTitle(cpuState?.a, "A")}
          width={R16_WIDTH}
        />
      </div>
      <div className={styles.cols}>
        <Label text="X" width={LAB_WIDTH} />
        <Value
          text={toHexa2(cpuState?.x)}
          tooltip={toTitle(cpuState?.x, "X")}
          width={R16_WIDTH}
        />
        <Label text="Y" width={LAB_WIDTH} />
        <Value
          text={toHexa2(cpuState?.y)}
          tooltip={toTitle(cpuState?.y, "Y")}
          width={R16_WIDTH}
        />
      </div>
      <div className={styles.cols}>
        <Label text="PC" width={LAB_WIDTH} />
        <Value
          text={toHexa4(cpuState?.pc)}
          tooltip={toTitle(cpuState?.pc, "PC", true)}
          width={R16_WIDTH}
        />
        <Label text="SP" width={LAB_WIDTH} />
        <Value
          text={toHexa2(cpuState?.sp)}
          tooltip={toTitle(cpuState?.sp, "SP")}
          width={R16_WIDTH}
        />
      </div>
      <Separator />
      <div className={styles.cols}>
        <Label text="LMR" width={LAB_WIDTH} />
        <Value
          text={toHexa2(cpuState?.lastMemoryReadValue ?? 0)}
          tooltip="Last value read from memory"
          width={R16_WIDTH}
        />
        <Label text="LMW" width={LAB_WIDTH} />
        <Value
          text={toHexa2(cpuState?.lastMemoryWriteValue ?? 0)}
          tooltip="Last value written to memory"
          width={R16_WIDTH}
        />
      </div>
      <div className={styles.cols}>
        <Label text="IRV" width={LAB_WIDTH} />
        <Value
          text={toHexa2(cpuState?.lastIoReadValue ?? 0)}
          tooltip="Last value read from the I/O port"
          width={R16_WIDTH}
        />
        <Label text="IWV" width={LAB_WIDTH} />
        <Value
          text={toHexa2(cpuState?.lastIoWriteValue ?? 0)}
          tooltip="Last value written to the I/O port"
          width={R16_WIDTH}
        />
      </div>
      <Separator />
      <div className={styles.cols}>
        <Label text="IRQ" width={LAB_WIDTH - 3} />
        <Flag
          value={cpuState?.irqRequested}
          width={FLAG_WIDTH + 3}
          adjustLeft={false}
          center={false}
          tooltip="IRQ requested"
        />
        <LabelSeparator width={R16_WIDTH - FLAG_WIDTH} />
        <Label text="NMI" width={LAB_WIDTH - 3} />
        <Flag
          value={cpuState?.nmiRequested}
          width={FLAG_WIDTH + 3}
          adjustLeft={false}
          center={false}
          tooltip="NMI requested"
        />
        <LabelSeparator width={R16_WIDTH - FLAG_WIDTH} />
      </div>
      <div className={styles.cols}>
        <Label text="STL" width={LAB_WIDTH - 3} />
        <Flag
          value={cpuState?.stalled}
          width={FLAG_WIDTH + 3}
          adjustLeft={false}
          center={false}
          tooltip="CPU stalled"
        />
        <LabelSeparator width={R16_WIDTH - FLAG_WIDTH} />
        <Label text="JAM" width={LAB_WIDTH - 3} />
        <Flag
          value={cpuState?.jammed}
          width={FLAG_WIDTH + 3}
          adjustLeft={false}
          center={false}
          tooltip="CPU jammed"
        />
        <LabelSeparator width={R16_WIDTH - FLAG_WIDTH} />
      </div>
      <Separator />
      <div className={styles.cols}>
        <Label text="CLK" width={LAB_WIDTH} />
        <Value
          text={cpuState?.tacts?.toString() ?? "---"}
          width={TACT_WIDTH}
          tooltip="Curent CPU clock"
        />
      </div>
      <div className={styles.cols}>
        <Label text="TSP" width={LAB_WIDTH} />
        <Value
          text={((cpuState?.tacts ?? 0) - (cpuState?.tactsAtLastStart ?? 0)).toString() ?? "---"}
          width={TACT_WIDTH}
          tooltip="T-States since last start after pause"
        />
      </div>
    </div>
  );
};

export const m6510CpuPanelRenderer = () => <CpuPanel />;
