import { Label, Value } from "@controls/Labels";
import { useSelector } from "@renderer/core/RendererProvider";
import { useEffect, useState } from "react";
import { toHexa2 } from "../services/ide-commands";
import { useStateRefresh } from "../useStateRefresh";
import styles from "./MemMappingPanel.module.scss";
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
  };

  // --- Whenever machine state changes or breakpoints change, refresh the list
  useEffect(() => {
    (async function () {
      await refreshMemoryMappingState();
    })();
  }, [machineState]);

  // --- Take care of refreshing the screen
  useStateRefresh(500, async () => {
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
    </div>
  );
};

export const nextMemMappingPanelRenderer = () => <MemMappingPanel />;
