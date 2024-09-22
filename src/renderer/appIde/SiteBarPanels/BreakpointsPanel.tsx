import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { LabelSeparator, Label, Value } from "@controls/Labels";
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

const BreakpointsPanel = () => {
  const emuApi = useEmuApi();
  const [bps, setBps] = useState<BreakpointInfo[]>([]);
  const [partitionLabels, setPartitionLabels] = useState<Record<number, string>>({});
  const machineId = useSelector((s) => s.emulatorState?.machineId);
  const machineState = useSelector((s) => s.emulatorState?.machineState);
  const bpsVersion = useSelector((s) => s.emulatorState?.breakpointsVersion);
  const disassLines = useRef<string[]>();
  const pcValue = useRef(-1);

  // --- This function queries the breakpoints from the emulator
  const refreshBreakpoints = async () => {
    // --- Get breakpoint information
    const bpResponse = await emuApi.listBreakpoints();
    const cpuResponse = await emuApi.getCpuState();
    pcValue.current = cpuResponse.pc;

    // --- Any memory information received?
    if (!bpResponse.memorySegments) return;

    // --- Copy memory segment samples
    const mem = new Uint8Array(0x1_0000);
    for (let i = 0; i < bpResponse.breakpoints.length; i++) {
      const memSegment = bpResponse.memorySegments[i];
      if (!memSegment) continue;

      const addr = bpResponse.breakpoints[i].address;
      for (let j = 0; j < memSegment.length; j++) {
        mem[(addr + j) & 0xffff] = memSegment[j];
      }
    }

    // --- Disassemble memory data
    disassLines.current = [];
    for (let i = 0; i < bpResponse.breakpoints.length; i++) {
      const bpInfo = bpResponse.breakpoints[i];
      if (bpInfo.address !== undefined) {
        const bpAddr = bpInfo.address;
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
    setBps(bpResponse.breakpoints);
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
      setPartitionLabels(labels.value);
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
            const addrKey = getBreakpointKey(bp, partitionLabels);
            const addr = bp.address;
            const disabled = bp.disabled ?? false;
            const isCurrent =
              (machineState === MachineControllerState.Running ||
                machineState === MachineControllerState.Paused) &&
              (pcValue.current === addr || pcValue.current === bp.resolvedAddress);
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
                />
                <LabelSeparator width={4} />
                {bp.resolvedAddress !== undefined && (
                  <Value text={`$${toHexa4(bp.resolvedAddress)}`} width={72} />
                )}
                <Label text={addrKey} width={addr !== undefined ? 40 : undefined} />
                {bp.address !== undefined && <Label text="" width={32} />}

                <Value text={disassLines.current[idx] ?? "???"} width="auto" />
              </div>
            );
          }}
        />
      )}
    </div>
  );
};

export const breakpointsPanelRenderer = () => <BreakpointsPanel />;
