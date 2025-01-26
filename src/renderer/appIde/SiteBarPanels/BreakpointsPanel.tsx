import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { LabelSeparator, Label, Value, Secondary } from "@controls/Labels";
import { VirtualizedListView } from "@controls/VirtualizedListView";
import { useSelector } from "@renderer/core/RendererProvider";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useState, useRef, useEffect } from "react";
import { BreakpointIndicator } from "../DocumentPanels/BreakpointIndicator";
import { useStateRefresh } from "../useStateRefresh";
import { MemorySection, MemorySectionType } from "../z80-disassembler/disassembly-helper";
import { Z80Disassembler } from "../z80-disassembler/z80-disassembler";
import styles from "./BreakpointsPanel.module.scss";
import { getBreakpointKey } from "@common/utils/breakpoints";
import { toHexa4 } from "../services/ide-commands";
import { useEmuApi } from "@renderer/core/EmuApi";
import { CpuState } from "@common/messaging/EmuApi";

const BreakpointsPanel = () => {
  const emuApi = useEmuApi();
  const [bps, setBps] = useState<BreakpointInfo[]>([]);
  const [partitionLabels, setPartitionLabels] = useState<Record<number, string>>({});
  const [lastCpuState, setLastCpuState] = useState<CpuState>();
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const bpsVersion = useSelector((s) => s.emulatorState?.breakpointsVersion);
  const disassLines = useRef<string[]>();
  const pcValue = useRef(-1);

  // --- Gets the address to display in the context of the breakpoint
  const getBpAddress = (bp: BreakpointInfo): number => {
    if (bp.memoryRead || bp.memoryWrite || bp.ioRead || bp.ioWrite) {
      return lastCpuState?.opStartAddress ?? -1;
    }
    return bp.address ?? -1;
  };

  // --- This function queries the breakpoints from the emulator
  const refreshBreakpoints = async () => {
    // --- Get breakpoint information
    const bpState = await emuApi.listBreakpoints();
    console.log("Breakpoints", bpState);
    const cpuState = await emuApi.getCpuState();
    setLastCpuState(cpuState);
    pcValue.current = cpuState.pc;

    // --- Any memory information received?
    if (!bpState.memorySegments) return;

    // --- Copy memory segment samples
    const mem = new Uint8Array(0x1_0000);
    for (let i = 0; i < bpState.breakpoints.length; i++) {
      const memSegment = bpState.memorySegments[i];
      if (!memSegment) continue;

      const addr = getBpAddress(bpState.breakpoints[i]);
      for (let j = 0; j < memSegment.length; j++) {
        mem[(addr + j) & 0xffff] = memSegment[j];
      }
    }

    // --- Disassemble memory data
    disassLines.current = [];
    for (let i = 0; i < bpState.breakpoints.length; i++) {
      const bpInfo = bpState.breakpoints[i];
      if (bpInfo.address !== undefined) {
        const bpAddr = getBpAddress(bpInfo);

        // --- Do the disassembly
        const disass = new Z80Disassembler(
          [new MemorySection(bpAddr, bpAddr, MemorySectionType.Disassemble)],
          mem,
          undefined,
          {
            noLabelPrefix: false
          }
        );
        const output = await disass.disassemble(bpAddr, bpAddr);
        disassLines.current[i] = output.outputItems?.[0]?.instruction ?? "???";
      } else {
        disassLines.current[i] = "";
      }
    }

    // --- Store the breakpoint info
    setBps(bpState.breakpoints);
  };

  // --- Whenever machine state changes or breakpoints change, refresh the list
  useEffect(() => {
    (async function () {
      await refreshBreakpoints();
    })();
  }, [machineState, bpsVersion]);

  // --- Obtain available partition labels for the current machine type
  useEffect(() => {
    (async function () {
      const labels = await emuApi.getPartitionLabels();
      setPartitionLabels(labels);
    })();
  }, [machineId]);

  // --- Take care of refreshing the screen
  useStateRefresh(500, async () => {
    await refreshBreakpoints();
  });

  return (
    <div className={styles.breakpointsPanel}>
      {bps.length === 0 && <div className={styles.center}>No breakpoints defined </div>}
      {bps.length > 0 && (
        <VirtualizedListView
          items={bps}
          approxSize={20}
          fixItemHeight={true}
          itemRenderer={(idx) => {
            const bp = bps[idx];
            const addrKey = getBreakpointKey(
              { ...bp, memoryRead: false, memoryWrite: false, ioRead: false, ioWrite: false },
              partitionLabels
            );
            const addr = bp.address;
            const disabled = bp.disabled ?? false;
            let isCurrent = false;
            if (bp.exec) {
              isCurrent =
                (machineState === MachineControllerState.Running ||
                  machineState === MachineControllerState.Paused) &&
                (pcValue.current === addr || pcValue.current === bp.resolvedAddress);
            } else if (machineState === MachineControllerState.Paused) {
              if (bp.memoryRead) {
                isCurrent = lastCpuState?.lastMemoryReads?.includes(addr) ?? false;
              } else if (bp.memoryWrite) {
                isCurrent = lastCpuState?.lastMemoryWrites?.includes(addr) ?? false;
              } else if (bp.ioRead) {
                isCurrent = !!(lastCpuState?.lastIoReadPort === addr);
              } else if (bp.ioWrite) {
                isCurrent = !!(lastCpuState?.lastIoWritePort === addr);
              }
            }
            return (
              <div className={styles.breakpoint}>
                <LabelSeparator width={4} />
                <BreakpointIndicator
                  partition={
                    bp?.partition !== undefined ? partitionLabels[bp.partition] ?? "?" : undefined
                  }
                  address={addr ?? addrKey}
                  current={isCurrent}
                  hasBreakpoint={true}
                  disabled={disabled}
                  memoryRead={bp.memoryRead}
                  memoryWrite={bp.memoryWrite}
                  ioRead={bp.ioRead}
                  ioWrite={bp.ioWrite}
                  ioMask={bp.ioMask}
                />
                <LabelSeparator width={4} />
                {bp.resolvedAddress !== undefined && (
                  <Value text={`$${toHexa4(bp.resolvedAddress)}`} width={72} />
                )}
                <Label text={addrKey} width={addr !== undefined ? 40 : undefined} />
                {bp.address !== undefined && <Label text="" width={40} />}
                {bp.exec && <Value text={disassLines.current[idx] ?? "???"} width="auto" />}
                {(bp.memoryRead || bp.memoryWrite || bp.ioRead || bp.ioWrite) &&
                  machineState === MachineControllerState.Paused && (
                    <>
                      <Secondary
                        text={`$${toHexa4(lastCpuState?.opStartAddress ?? -1)}:`}
                        width={52}
                      />
                      <Value text={disassLines.current[idx] ?? "???"} width="auto" />
                    </>
                  )}
              </div>
            );
          }}
        />
      )}
    </div>
  );
};

export const breakpointsPanelRenderer = () => <BreakpointsPanel />;
