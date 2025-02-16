import { Flag, Label, LabelSeparator, Separator, Value } from "@controls/Labels";
import { useState } from "react";
import { useStateRefresh } from "../useStateRefresh";
import styles from "./CpuPanel.module.scss";
import { useEmuApi } from "@renderer/core/EmuApi";
import { CpuState } from "@common/messaging/EmuApi";

const FLAG_WIDTH = 16;
const LAB_WIDTH = 36;
const R16_WIDTH = 48;
const TACT_WIDTH = 72;

const CpuPanel = () => {
  const emuApi = useEmuApi();
  const [cpuState, setCpuState] = useState<CpuState>(null);

  const toHexa2 = (value?: number) =>
    value !== undefined ? value.toString(16).toUpperCase().padStart(2, "0") : "--";
  const toHexa4 = (value?: number) =>
    value !== undefined ? value.toString(16).toUpperCase().padStart(4, "0") : "----";
  const toTitle = (value?: number, reg16?: string, regH?: string, regL?: string) => {
    const valH = value >>> 8;
    const isNegH = valH > 127;
    const valL = value & 0xff;
    const isNegL = valL > 127;
    return value !== undefined
      ? `${reg16 ? reg16 + ":" : ""} ${value.toString()}, %${value.toString(2)}` +
          (regH
            ? `\n${regH}: ${valH.toString()}${
                isNegH ? ` (${valH - 256})` : ""
              }, %${valH.toString(2)}`
            : "") +
          (regL
            ? `\n${regL}: ${valL.toString()}${
                isNegL ? ` (${valL - 256})` : ""
              }, %${valL.toString(2)}`
            : "")
      : "n/a";
  };
  const toFlag = (value: number | undefined, bitNo: number) =>
    value !== undefined ? !!(value & (1 << bitNo)) : undefined;

  // --- Take care of refreshing the screen
  useStateRefresh(250, async () => {
    setCpuState(await emuApi.getCpuState());
  });

  return (
    <div className={styles.cpuPanel}>
      <div className={styles.flags}>
        <div className={styles.f}>F</div>
        <div className={styles.rows}>
          <div className={styles.cols}>
            <Label text="S" width={FLAG_WIDTH} center />
            <Label text="Z" width={FLAG_WIDTH} center />
            <Label text="5" width={FLAG_WIDTH} center />
            <Label text="H" width={FLAG_WIDTH} center />
            <Label text="3" width={FLAG_WIDTH} center />
            <Label text="P" width={FLAG_WIDTH} center />
            <Label text="N" width={FLAG_WIDTH} center />
            <Label text="C" width={FLAG_WIDTH} center />
          </div>
          <div className={styles.cols}>
            <Flag
              value={toFlag(cpuState?.af, 7)}
              adjustLeft={false}
              width={FLAG_WIDTH}
              tooltip="Sign"
            />
            <Flag
              value={toFlag(cpuState?.af, 6)}
              adjustLeft={false}
              width={FLAG_WIDTH}
              tooltip="Zero"
            />
            <Flag
              value={toFlag(cpuState?.af, 5)}
              adjustLeft={false}
              width={FLAG_WIDTH}
              tooltip="Bit 5"
            />
            <Flag
              value={toFlag(cpuState?.af, 4)}
              adjustLeft={false}
              width={FLAG_WIDTH}
              tooltip="Half Carry"
            />
            <Flag
              value={toFlag(cpuState?.af, 3)}
              adjustLeft={false}
              width={FLAG_WIDTH}
              tooltip="Bit 3"
            />
            <Flag
              value={toFlag(cpuState?.af, 2)}
              adjustLeft={false}
              width={FLAG_WIDTH}
              tooltip="Parity/Overflow"
            />
            <Flag
              value={toFlag(cpuState?.af, 1)}
              adjustLeft={false}
              width={FLAG_WIDTH}
              tooltip="Subtract"
            />
            <Flag
              value={toFlag(cpuState?.af, 0)}
              adjustLeft={false}
              width={FLAG_WIDTH}
              tooltip="Carry"
            />
          </div>
        </div>
      </div>
      <Separator />
      <div className={styles.cols}>
        <Label text="AF" width={LAB_WIDTH} />
        <Value
          text={toHexa4(cpuState?.af)}
          tooltip={toTitle(cpuState?.af, "AF", "A", "F")}
          width={R16_WIDTH}
        />
        <Label text="AF'" width={LAB_WIDTH} />
        <Value
          text={toHexa4(cpuState?.af_)}
          tooltip={toTitle(cpuState?.af_, "AF'")}
          width={R16_WIDTH}
        />
      </div>
      <div className={styles.cols}>
        <Label text="BC" width={LAB_WIDTH} />
        <Value
          text={toHexa4(cpuState?.bc)}
          tooltip={toTitle(cpuState?.bc, "BC", "B", "C")}
          width={R16_WIDTH}
        />
        <Label text="BC'" width={LAB_WIDTH} />
        <Value
          text={toHexa4(cpuState?.bc_)}
          tooltip={toTitle(cpuState?.bc_, "BC'")}
          width={R16_WIDTH}
        />
      </div>
      <div className={styles.cols}>
        <Label text="DE" width={LAB_WIDTH} />
        <Value
          text={toHexa4(cpuState?.de)}
          tooltip={toTitle(cpuState?.de, "DE", "D", "E")}
          width={R16_WIDTH}
        />
        <Label text="DE'" width={LAB_WIDTH} />
        <Value
          text={toHexa4(cpuState?.de_)}
          tooltip={toTitle(cpuState?.de_, "DE'")}
          width={R16_WIDTH}
        />
      </div>
      <div className={styles.cols}>
        <Label text="HL" width={LAB_WIDTH} />
        <Value
          text={toHexa4(cpuState?.hl)}
          tooltip={toTitle(cpuState?.hl, "HL", "H", "L")}
          width={R16_WIDTH}
        />
        <Label text="HL'" width={LAB_WIDTH} />
        <Value
          text={toHexa4(cpuState?.hl_)}
          tooltip={toTitle(cpuState?.hl_, "HL'")}
          width={R16_WIDTH}
        />
      </div>
      <div className={styles.cols}>
        <Label text="IX" width={LAB_WIDTH} />
        <Value
          text={toHexa4(cpuState?.ix)}
          tooltip={toTitle(cpuState?.ix, "IX", "XH", "XL")}
          width={R16_WIDTH}
        />
        <Label text="IY" width={LAB_WIDTH} />
        <Value
          text={toHexa4(cpuState?.iy)}
          tooltip={toTitle(cpuState?.iy, "IY", "YH", "YL")}
          width={R16_WIDTH}
        />
      </div>
      <div className={styles.cols}>
        <Label text="PC" width={LAB_WIDTH} />
        <Value
          text={toHexa4(cpuState?.pc)}
          tooltip={toTitle(cpuState?.pc, "PC")}
          width={R16_WIDTH}
        />
        <Label text="SP" width={LAB_WIDTH} />
        <Value
          text={toHexa4(cpuState?.sp)}
          tooltip={toTitle(cpuState?.sp, "SP")}
          width={R16_WIDTH}
        />
      </div>
      <div className={styles.cols}>
        <Label text="I" width={LAB_WIDTH} />
        <Value
          text={toHexa2(cpuState?.ir ? cpuState.ir >>> 8 : 0)}
          tooltip={toTitle(cpuState?.ir ? cpuState.ir >>> 8 : 0, "I")}
          width={R16_WIDTH}
        />
        <Label text="R" width={LAB_WIDTH} />
        <Value
          text={toHexa2(cpuState?.ir ? cpuState.ir & 0xff : 0)}
          tooltip={toTitle(cpuState?.ir ? cpuState.ir & 0xff : 0, "R")}
          width={R16_WIDTH}
        />
      </div>
      <div className={styles.cols}>
        <Label text="WZ" width={LAB_WIDTH} />
        <Value
          text={toHexa4(cpuState?.wz)}
          tooltip={toTitle(cpuState?.wz, "WZ", "WH", "WL")}
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
        <Label text="IM" width={LAB_WIDTH} />
        <Value
          text={cpuState?.interruptMode?.toString() ?? "-"}
          width={FLAG_WIDTH + 4}
          tooltip="Interrupt Mode"
        />
        <LabelSeparator width={R16_WIDTH - FLAG_WIDTH} />
        <Label text="SNZ" width={LAB_WIDTH - 3} />
        <Flag
          value={cpuState?.snoozed}
          width={FLAG_WIDTH}
          adjustLeft={false}
          center={false}
          tooltip="Is the CPU snoozed?"
        />
      </div>
      <div className={styles.cols}>
        <Label text="IFF1" width={LAB_WIDTH - 3} />
        <Flag
          value={cpuState?.iff1}
          width={FLAG_WIDTH + 3}
          adjustLeft={false}
          center={false}
          tooltip="Interrupt flip-flop #1"
        />
        <LabelSeparator width={R16_WIDTH - FLAG_WIDTH} />
        <Label text="IFF2" width={LAB_WIDTH + 1} />
        <Flag
          value={cpuState?.iff2}
          width={FLAG_WIDTH}
          adjustLeft={false}
          center={false}
          tooltip="Interrupt flip-flop #2"
        />
      </div>
      <div className={styles.cols}>
        <Label text="INT" width={LAB_WIDTH - 3} />
        <Flag
          value={cpuState?.sigINT}
          width={FLAG_WIDTH + 3}
          adjustLeft={false}
          center={false}
          tooltip="Interrupt signal"
        />
        <LabelSeparator width={R16_WIDTH - FLAG_WIDTH} />
        <Label text="HLT" width={LAB_WIDTH + 1} />
        <Flag
          value={cpuState?.halted}
          width={R16_WIDTH + 3}
          adjustLeft={false}
          center={false}
          tooltip="Halted"
        />
      </div>
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

export const cpuPanelRenderer = () => <CpuPanel />;
