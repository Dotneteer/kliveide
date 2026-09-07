import { Flag } from "@renderer/controls/layout/Flag";
import { Label } from "@renderer/controls/layout/Label";
import { LabelSeparator } from "@renderer/controls/layout/LabelSeparator";
import { Value } from "@renderer/controls/layout/Value";
import { useState } from "react";
import { toHexa2, toHexa6 } from "../services/ide-commands";
import { useEmuStateListener } from "../useStateRefresh";
import styles from "./MemMappingPanel.module.scss";
import { useEmuApi } from "@renderer/core/EmuApi";
import { NextMemoryMapping } from "@common/messaging/EmuApi";
import { DataRow } from "@renderer/controls/data";

// M2: `ch`, not px. Capacity preserved from the px width at its old 12.8px size (px / 6.4).
const VAR_WIDTH = "17ch"; // 108px / 6.4 = 16.9

export const MemMappingPanel = () => {
  const emuApi = useEmuApi();
  const [mappingState, setMappingState] = useState<NextMemoryMapping | null>(null);

  // --- This function queries the breakpoints from the emulator
  const refreshMemoryMappingState = async () => {
    const response = await emuApi.getNextMemoryMapping();
    setMappingState(response);
  };

  // --- Take care of refreshing the screen
  useEmuStateListener(emuApi, async () => {
    await refreshMemoryMappingState();
  });

  let allRamValue = mappingState?.allRamsBanks
    ? `[${mappingState.allRamsBanks.map((i) => toHexa2(i)).join(", ")}]`
    : "Off";
  return (
    <div className={styles.memMappingPanel}>
      <DataRow hoverable>
        <Label text="All RAM:" width={VAR_WIDTH} />
        <Value text={allRamValue} />
      </DataRow>
      <DataRow hoverable>
        <Label text="Current ROM:" width={VAR_WIDTH} />
        <Value text={toHexa2(mappingState?.selectedRom ?? 0)} />
      </DataRow>
      <DataRow hoverable>
        <Label text="Current Bank:" width={VAR_WIDTH} />
        <Value text={toHexa2(mappingState?.selectedBank ?? 0)} />
      </DataRow>
      <DataRow hoverable>
        <Label text="Port 7FFD:" width={VAR_WIDTH} />
        <Value text={toHexa2(mappingState?.port7ffd ?? 0)} />
      </DataRow>
      <DataRow hoverable>
        <Label text="Port 1FFD:" width={VAR_WIDTH} />
        <Value text={toHexa2(mappingState?.port1ffd ?? 0)} />
      </DataRow>
      <DataRow hoverable>
        <Label text="Port DFFD:" width={VAR_WIDTH} />
        <Value text={toHexa2(mappingState?.portDffd ?? 0)} />
      </DataRow>
      <DataRow hoverable>
        <Label text="Port EFF7:" width={VAR_WIDTH} />
        <Value text={toHexa2(mappingState?.portEff7 ?? 0)} />
      </DataRow>
      <DataRow hoverable>
        <Label text="Port L2:" width={VAR_WIDTH} />
        <Value text={toHexa2(mappingState?.portLayer2 ?? 0)} />
      </DataRow>
      <DataRow hoverable>
        <Label text="Port Timex:" width={VAR_WIDTH} />
        <Value text={toHexa2(mappingState?.portTimex ?? 0)} />
      </DataRow>
      <DataRow hoverable>
        <Label text="DivMMC:" width={VAR_WIDTH} />
        <Value text={toHexa2(mappingState?.divMmc ?? 0)} />
        <LabelSeparator width={8} />
        <Flag value={mappingState?.divMmcIn ?? false} />
      </DataRow>
      {mappingState?.pageInfo[0] && (
        <DataRow hoverable>
          <Label text="Page 0:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(mappingState.pageInfo[0].bank8k)} ${toHexa2(mappingState.pageInfo[0].bank16k)} ${toHexa6(mappingState.pageInfo[0].readOffset)} ${toHexa6(mappingState.pageInfo[0].writeOffset ?? 0xff)}`}
          />
        </DataRow>
      )}
      {mappingState?.pageInfo[1] && (
        <DataRow hoverable>
          <Label text="Page 1:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(mappingState.pageInfo[1].bank8k)} ${toHexa2(mappingState.pageInfo[1].bank16k)} ${toHexa6(mappingState.pageInfo[1].readOffset)} ${toHexa6(mappingState.pageInfo[1].writeOffset ?? 0xff)}`}
          />
        </DataRow>
      )}
      {mappingState?.pageInfo[2] && (
        <DataRow hoverable>
          <Label text="Page 2:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(mappingState.pageInfo[2].bank8k)} ${toHexa2(mappingState.pageInfo[2].bank16k)} ${toHexa6(mappingState.pageInfo[2].readOffset)} ${toHexa6(mappingState.pageInfo[2].writeOffset ?? 0xff)}`}
          />
        </DataRow>
      )}
      {mappingState?.pageInfo[3] && (
        <DataRow hoverable>
          <Label text="Page 3:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(mappingState.pageInfo[3].bank8k)} ${toHexa2(mappingState.pageInfo[3].bank16k)} ${toHexa6(mappingState.pageInfo[3].readOffset)} ${toHexa6(mappingState.pageInfo[3].writeOffset ?? 0xff)}`}
          />
        </DataRow>
      )}
      {mappingState?.pageInfo[4] && (
        <DataRow hoverable>
          <Label text="Page 4:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(mappingState.pageInfo[4].bank8k)} ${toHexa2(mappingState.pageInfo[4].bank16k)} ${toHexa6(mappingState.pageInfo[4].readOffset)} ${toHexa6(mappingState.pageInfo[4].writeOffset ?? 0xff)}`}
          />
        </DataRow>
      )}
      {mappingState?.pageInfo[5] && (
        <DataRow hoverable>
          <Label text="Page 5:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(mappingState.pageInfo[5].bank8k)} ${toHexa2(mappingState.pageInfo[5].bank16k)} ${toHexa6(mappingState.pageInfo[5].readOffset)} ${toHexa6(mappingState.pageInfo[5].writeOffset ?? 0xff)}`}
          />
        </DataRow>
      )}
      {mappingState?.pageInfo[6] && (
        <DataRow hoverable>
          <Label text="Page 6:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(mappingState.pageInfo[6].bank8k)} ${toHexa2(mappingState.pageInfo[6].bank16k)} ${toHexa6(mappingState.pageInfo[6].readOffset)} ${toHexa6(mappingState.pageInfo[6].writeOffset ?? 0xff)}`}
          />
        </DataRow>
      )}
      {mappingState?.pageInfo[7] && (
        <DataRow hoverable>
          <Label text="Page 7:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(mappingState.pageInfo[7].bank8k)} ${toHexa2(mappingState.pageInfo[7].bank16k)} ${toHexa6(mappingState.pageInfo[7].readOffset)}  ${toHexa6(mappingState.pageInfo[7].writeOffset ?? 0xff)}`}
          />
        </DataRow>
      )}
    </div>
  );
};

