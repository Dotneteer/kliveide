import {
  Flag,
  Label,
  Secondary,
  Separator,
  Value
} from "@/controls/common/Labels";
import styles from "./CpuPanel.module.scss";

const FLAG_WIDTH = 16;
const LAB_WIDTH = 36;
const R16_WIDTH = 48;
const TACT_WIDTH = 102;

const CpuPanel = () => {
  return (
    <div className={styles.component}>
      <div className={styles.flags}>
        <div className={styles.f}>F</div>
        <div className={styles.rows}>
          <div className={styles.cols}>
            <Label text='S' width={FLAG_WIDTH} center />
            <Label text='Z' width={FLAG_WIDTH} center />
            <Label text='5' width={FLAG_WIDTH} center />
            <Label text='P' width={FLAG_WIDTH} center />
            <Label text='3' width={FLAG_WIDTH} center />
            <Label text='H' width={FLAG_WIDTH} center />
            <Label text='N' width={FLAG_WIDTH} center />
            <Label text='C' width={FLAG_WIDTH} center />
          </div>
          <div className={styles.cols}>
            <Flag value={0} width={FLAG_WIDTH} />
            <Flag value={1} width={FLAG_WIDTH} />
            <Flag value={0} width={FLAG_WIDTH} />
            <Flag value={1} width={FLAG_WIDTH} />
            <Flag value={0} width={FLAG_WIDTH} />
            <Flag value={1} width={FLAG_WIDTH} />
            <Flag value={0} width={FLAG_WIDTH} />
            <Flag value={1} width={FLAG_WIDTH} />
          </div>
        </div>
      </div>
      <Separator />
      <div className={styles.cols}>
        <Label text='AF' width={LAB_WIDTH} />
        <Value text='0ff0' tooltip="65535, %0101_0101_0101_0101" width={R16_WIDTH} />
        <Label text="AF'" width={LAB_WIDTH} />
        <Value text='0ff0' tooltip="65535, %0101_0101_0101_0101" width={R16_WIDTH} />
      </div>
      <div className={styles.cols}>
        <Label text='BC' width={LAB_WIDTH} />
        <Value text='0ff0' tooltip="65535, %0101_0101_0101_0101" width={R16_WIDTH} />
        <Label text="BC'" width={LAB_WIDTH} />
        <Value text='0ff0' tooltip="65535, %0101_0101_0101_0101" width={R16_WIDTH} />
      </div>
      <div className={styles.cols}>
        <Label text='DE' width={LAB_WIDTH} />
        <Value text='0ff0' tooltip="65535, %0101_0101_0101_0101" width={R16_WIDTH} />
        <Label text="DE'" width={LAB_WIDTH} />
        <Value text='0ff0' tooltip="65535, %0101_0101_0101_0101" width={R16_WIDTH} />
      </div>
      <div className={styles.cols}>
        <Label text='HL' width={LAB_WIDTH} />
        <Value text='0ff0' tooltip="65535, %0101_0101_0101_0101" width={R16_WIDTH} />
        <Label text="HL'" width={LAB_WIDTH} />
        <Value text='0ff0' tooltip="65535, %0101_0101_0101_0101" width={R16_WIDTH} />
      </div>
      <div className={styles.cols}>
        <Label text='PC' width={LAB_WIDTH} />
        <Value text='0ff0' tooltip="65535, %0101_0101_0101_0101" width={R16_WIDTH} />
        <Label text="SP" width={LAB_WIDTH} />
        <Value text='0ff0' tooltip="65535, %0101_0101_0101_0101" width={R16_WIDTH} />
      </div>
      <div className={styles.cols}>
        <Label text='IX' width={LAB_WIDTH} />
        <Value text='0ff0' tooltip="65535, %0101_0101_0101_0101" width={R16_WIDTH} />
        <Label text="IY" width={LAB_WIDTH} />
        <Value text='0ff0' tooltip="65535, %0101_0101_0101_0101" width={R16_WIDTH} />
      </div>
      <div className={styles.cols}>
        <Label text='I' width={LAB_WIDTH} />
        <Value text='ff' tooltip="255, %0101_0101" width={R16_WIDTH} />
        <Label text="R" width={LAB_WIDTH} />
        <Value text='ff' tooltip="255, %0101_0101" width={R16_WIDTH} />
      </div>
      <div className={styles.cols}>
        <Label text='WZ' width={LAB_WIDTH} />
        <Value text='0ff0' tooltip="65535, %0101_0101_0101_0101" width={R16_WIDTH} />
      </div>
      <Separator />
      <div className={styles.cols}>
        <Label text='CLK' width={LAB_WIDTH} />
        <Value text='123456789012' width={TACT_WIDTH} />
      </div>
      <div className={styles.cols}>
        <Label text='IM' width={LAB_WIDTH} />
        <Value text='1' width={R16_WIDTH} />
      </div>
      <div className={styles.cols}>
        <Label text='IFF1' width={LAB_WIDTH} />
        <Flag value={0} width={R16_WIDTH} center={false} />
        <Label text='IFF2' width={LAB_WIDTH} />
        <Flag value={1} width={R16_WIDTH} center={false} />
      </div>
      <div className={styles.cols}>
        <Label text='INT' width={LAB_WIDTH} />
        <Flag value={0} width={R16_WIDTH} center={false} />
        <Label text='HLT' width={LAB_WIDTH} />
        <Flag value={1} width={R16_WIDTH} center={false} />
      </div>
    </div>
  );
};

export const cpuPanelRenderer = () => <CpuPanel />;
