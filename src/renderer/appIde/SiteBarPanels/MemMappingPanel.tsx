import { Flag, Label, LabelSeparator, Value } from "@controls/Labels";
import { useSelector } from "@renderer/core/RendererProvider";
import { useEffect, useState } from "react";
import { toHexa2, toHexa6 } from "../services/ide-commands";
import { useEmuStateListener } from "../useStateRefresh";
import styles from "./MemMappingPanel.module.scss";
import { MemoryPageInfo } from "@emu/machines/zxNext/MemoryDevice";
import { useEmuApi } from "@renderer/core/EmuApi";

const VAR_WIDTH = 108;

const MemMappingPanel = () => {
  const emuApi = useEmuApi();
  const [allRamBanks, setAllRamBanks] = useState<number[]>();
  const [selectedRom, setSelectedRom] = useState<number>(0);
  const [selectedRamBank, setSelectedRamBank] = useState<number>(0);
  const [port7ffd, setPort7ffd] = useState<number>(0);
  const [port1ffd, setPort1ffd] = useState<number>(0);
  const [portDffd, setPortDffd] = useState<number>(0);
  const [portEff7, setPortEff7] = useState<number>(0);
  const [portLayer2, setPortLayer2] = useState<number>(0);
  const [portTimex, setPortTimex] = useState<number>(0);
  const [divMmc, setDivMmc] = useState<number>(0);
  const [divMmcIn, setDivMmcIn] = useState<boolean>(false);
  const [pageInfo, setPageInfo] = useState<MemoryPageInfo[]>([]);
  const machineState = useSelector((s) => s.emulatorState?.machineState);

  // --- This function queries the breakpoints from the emulator
  const refreshMemoryMappingState = async () => {
    // --- Get breakpoint information
    const response = await emuApi.getNextMemoryMapping();
    setAllRamBanks(response.allRamsBanks);
    setSelectedRom(response.selectedRom);
    setSelectedRamBank(response.selectedBank);
    setPort7ffd(response.port7ffd);
    setPort1ffd(response.port1ffd);
    setPortDffd(response.portDffd);
    setPortEff7(response.portEff7);
    setPortLayer2(response.portLayer2);
    setPortTimex(response.portTimex);
    setDivMmc(response.divMmc);
    setDivMmcIn(response.divMmcIn);
    setPageInfo(response.pageInfo);
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

  let allRamValue = allRamBanks ? `[${allRamBanks.map((i) => toHexa2(i)).join(", ")}]` : "Off";
  return (
    <div className={styles.memMappingPanel}>
      <div className={styles.item}>
        <Label text="All RAM:" width={VAR_WIDTH} />
        <Value text={allRamValue} />
      </div>
      <div className={styles.item}>
        <Label text="Current ROM:" width={VAR_WIDTH} />
        <Value text={toHexa2(selectedRom)} />
      </div>
      <div className={styles.item}>
        <Label text="Current Bank:" width={VAR_WIDTH} />
        <Value text={toHexa2(selectedRamBank)} />
      </div>
      <div className={styles.item}>
        <Label text="Port 7FFD:" width={VAR_WIDTH} />
        <Value text={toHexa2(port7ffd)} />
      </div>
      <div className={styles.item}>
        <Label text="Port 1FFD:" width={VAR_WIDTH} />
        <Value text={toHexa2(port1ffd)} />
      </div>
      <div className={styles.item}>
        <Label text="Port DFFD:" width={VAR_WIDTH} />
        <Value text={toHexa2(portDffd)} />
      </div>
      <div className={styles.item}>
        <Label text="Port EFF7:" width={VAR_WIDTH} />
        <Value text={toHexa2(portEff7)} />
      </div>
      <div className={styles.item}>
        <Label text="Port L2:" width={VAR_WIDTH} />
        <Value text={toHexa2(portLayer2)} />
      </div>
      <div className={styles.item}>
        <Label text="Port Timex:" width={VAR_WIDTH} />
        <Value text={toHexa2(portTimex)} />
      </div>
      <div className={styles.item}>
        <Label text="DivMMC:" width={VAR_WIDTH} />
        <Value text={toHexa2(divMmc)} />
        <LabelSeparator width={8} />
        <Flag value={divMmcIn} />
      </div>
      {pageInfo[0] && (
        <div className={styles.item}>
          <Label text="Page 0:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(pageInfo[0].bank8k)} ${toHexa2(pageInfo[0].bank16k)} ${toHexa6(pageInfo[0].readOffset)} ${toHexa6(pageInfo[0].writeOffset ?? 0xff)}`}
          />
        </div>
      )}
      {pageInfo[1] && (
        <div className={styles.item}>
          <Label text="Page 1:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(pageInfo[1].bank8k)} ${toHexa2(pageInfo[1].bank16k)} ${toHexa6(pageInfo[1].readOffset)} ${toHexa6(pageInfo[1].writeOffset ?? 0xff )}`}
          />
        </div>
      )}
      {pageInfo[2] && (
        <div className={styles.item}>
          <Label text="Page 2:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(pageInfo[2].bank8k)} ${toHexa2(pageInfo[2].bank16k)} ${toHexa6(pageInfo[2].readOffset)} ${toHexa6(pageInfo[2].writeOffset ?? 0xff)}`}
          />
        </div>
      )}
      {pageInfo[3] && (
        <div className={styles.item}>
          <Label text="Page 3:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(pageInfo[3].bank8k)} ${toHexa2(pageInfo[3].bank16k)} ${toHexa6(pageInfo[3].readOffset)} ${toHexa6(pageInfo[3].writeOffset ?? 0xff)}`}
          />
        </div>
      )}
      {pageInfo[4] && (
        <div className={styles.item}>
          <Label text="Page 4:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(pageInfo[4].bank8k)} ${toHexa2(pageInfo[4].bank16k)} ${toHexa6(pageInfo[4].readOffset)} ${toHexa6(pageInfo[4].writeOffset ?? 0xff)}`}
          />
        </div>
      )}
      {pageInfo[5] && (
        <div className={styles.item}>
          <Label text="Page 5:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(pageInfo[5].bank8k)} ${toHexa2(pageInfo[5].bank16k)} ${toHexa6(pageInfo[5].readOffset)} ${toHexa6(pageInfo[5].writeOffset ?? 0xff)}`}
          />
        </div>
      )}
      {pageInfo[6] && (
        <div className={styles.item}>
          <Label text="Page 6:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(pageInfo[6].bank8k)} ${toHexa2(pageInfo[6].bank16k)} ${toHexa6(pageInfo[6].readOffset)} ${toHexa6(pageInfo[6].writeOffset ?? 0xff)}`}
          />
        </div>
      )}
      {pageInfo[7] && (
        <div className={styles.item}>
          <Label text="Page 7:" width={VAR_WIDTH} />
          <Value
            text={`${toHexa2(pageInfo[7].bank8k)} ${toHexa2(pageInfo[7].bank16k)} ${toHexa6(pageInfo[7].readOffset)}  ${toHexa6(pageInfo[7].writeOffset ?? 0xff)}`}
          />
        </div>
      )}
    </div>
  );
};

export const nextMemMappingPanelRenderer = () => <MemMappingPanel />;
