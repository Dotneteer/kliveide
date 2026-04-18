import { Flag, Label, LabelSeparator, Value } from "@controls/Labels";
import { useSelector } from "@renderer/core/RendererProvider";
import { useEffect, useState } from "react";
import { toHexa2, toHexa6 } from "../services/ide-commands";
import { useEmuStateListener } from "../useStateRefresh";
import styles from "./MemMappingPanel.module.scss";
import { useEmuApi } from "@renderer/core/EmuApi";
import { NextMemoryMapping } from "@common/messaging/EmuApi";

const VAR_WIDTH = 108;

const MemMappingPanel = () => {
  const emuApi = useEmuApi();
  const [mappingState, setMappingState] = useState<NextMemoryMapping | null>(null);
  const machineState = useSelector((s) => s.emulatorState?.machineState);

  // --- This function queries the breakpoints from the emulator
  const refreshMemoryMappingState = async () => {
    const response = await emuApi.getNextMemoryMapping();
    setMappingState(response);
  };

  // --- Whenever machine state changes or breakpoints change, refresh the list
  useEffect(() => {
    (async function () {
      await refreshMemoryMappingState();
    })();
  }, [machineState]);

  // --- Take care of refreshing the screen
  useEmuStateListener(emuApi, async () => {
    await refreshMemoryMappingState();
  });

  let allRamValue = mappingState?.allRamsBanks
    ? `[${mappingState.allRamsBanks.map((i) => toHexa2(i)).join(", ")}]`
    : "Off";
  return (
    <div className={styles.memMappingPanel}>
      <div className={styles.item}>
        <Label text="All RAM:" width={VAR_WIDTH} />
        <Value text={allRamValue} />
      </div>
      <div className={styles.item}>
        <Label text="Current ROM:" width={VAR_WIDTH} />
        <Value text={toHexa2(mappingState?.selectedRom ?? 0)} />
      </div>
      <div className={styles.item}>
        <Label text="Current Bank:" width={VAR_WIDTH} />
        <Value text={toHexa2(mappingState?.selectedBank ?? 0)} />
      </div>
      <div className={styles.item}>
        <Label text="Port 7FFD:" width={VAR_WIDTH} />
        <Value text={toHexa2(mappingState?.port7ffd ?? 0)} />
      </div>
      <div className={styles.item}>
        <Label text="Port 1FFD:" width={VAR_WIDTH} />
        <Value text={toHexa2(mappingState?.port1ffd ?? 0)} />
      </div>
      <div className={styles.item}>
        <Label text="Port DFFD:" width={VAR_WIDTH} />
        <Value text={toHexa2(mappingState?.portDffd ?? 0)} />
      </div>
      <div className={styles.item}>
        <Label text="Port EFF7:" width={VAR_WIDTH} />
        <Value text={toHexa2(mappingState?.portEff7 ?? 0)} />
      </div>
      <div className={styles.item}>
        <Label text="Port L2:" width={VAR_WIDTH} />
        <Value text={toHexa2(mappingState?.portLayer2 ?? 0)} />
      </div>
      <div className={styles.item}>
        <Label text="Port Timex:" width={VAR_WIDTH} />
        <Value text={toHexa2(mappingState?.portTimex ?? 0)} />
      </div>
      <div className={styles.item}>
        <Label text="DivMMC:" width={VAR_WIDTH} />
        <Value text={toHexa2(mappingState?.divMmc ?? 0)} />
        <LabelSeparator width={8} />
        <Flag value={mappingState?.divMmcIn ?? false} />
      </div>
      {mappingState?.pageInfo[0] && (
        <div className={styles.item}>
          <Label text="Page 0:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(mappingState.pageInfo[0].bank8k)} ${toHexa2(mappingState.pageInfo[0].bank16k)} ${toHexa6(mappingState.pageInfo[0].readOffset)} ${toHexa6(mappingState.pageInfo[0].writeOffset ?? 0xff)}`}
          />
        </div>
      )}
      {mappingState?.pageInfo[1] && (
        <div className={styles.item}>
          <Label text="Page 1:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(mappingState.pageInfo[1].bank8k)} ${toHexa2(mappingState.pageInfo[1].bank16k)} ${toHexa6(mappingState.pageInfo[1].readOffset)} ${toHexa6(mappingState.pageInfo[1].writeOffset ?? 0xff)}`}
          />
        </div>
      )}
      {mappingState?.pageInfo[2] && (
        <div className={styles.item}>
          <Label text="Page 2:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(mappingState.pageInfo[2].bank8k)} ${toHexa2(mappingState.pageInfo[2].bank16k)} ${toHexa6(mappingState.pageInfo[2].readOffset)} ${toHexa6(mappingState.pageInfo[2].writeOffset ?? 0xff)}`}
          />
        </div>
      )}
      {mappingState?.pageInfo[3] && (
        <div className={styles.item}>
          <Label text="Page 3:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(mappingState.pageInfo[3].bank8k)} ${toHexa2(mappingState.pageInfo[3].bank16k)} ${toHexa6(mappingState.pageInfo[3].readOffset)} ${toHexa6(mappingState.pageInfo[3].writeOffset ?? 0xff)}`}
          />
        </div>
      )}
      {mappingState?.pageInfo[4] && (
        <div className={styles.item}>
          <Label text="Page 4:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(mappingState.pageInfo[4].bank8k)} ${toHexa2(mappingState.pageInfo[4].bank16k)} ${toHexa6(mappingState.pageInfo[4].readOffset)} ${toHexa6(mappingState.pageInfo[4].writeOffset ?? 0xff)}`}
          />
        </div>
      )}
      {mappingState?.pageInfo[5] && (
        <div className={styles.item}>
          <Label text="Page 5:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(mappingState.pageInfo[5].bank8k)} ${toHexa2(mappingState.pageInfo[5].bank16k)} ${toHexa6(mappingState.pageInfo[5].readOffset)} ${toHexa6(mappingState.pageInfo[5].writeOffset ?? 0xff)}`}
          />
        </div>
      )}
      {mappingState?.pageInfo[6] && (
        <div className={styles.item}>
          <Label text="Page 6:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(mappingState.pageInfo[6].bank8k)} ${toHexa2(mappingState.pageInfo[6].bank16k)} ${toHexa6(mappingState.pageInfo[6].readOffset)} ${toHexa6(mappingState.pageInfo[6].writeOffset ?? 0xff)}`}
          />
        </div>
      )}
      {mappingState?.pageInfo[7] && (
        <div className={styles.item}>
          <Label text="Page 7:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(mappingState.pageInfo[7].bank8k)} ${toHexa2(mappingState.pageInfo[7].bank16k)} ${toHexa6(mappingState.pageInfo[7].readOffset)}  ${toHexa6(mappingState.pageInfo[7].writeOffset ?? 0xff)}`}
          />
        </div>
      )}
    </div>
  );
};

export const nextMemMappingPanelRenderer = () => <MemMappingPanel />;
