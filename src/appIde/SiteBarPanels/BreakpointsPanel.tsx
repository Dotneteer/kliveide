import {
  Label,
  LabelSeparator,
  Secondary,
  Value
} from "@/controls/common/Labels";
import { useRendererContext, useSelector } from "@/core/RendererProvider";
import { BreakpointInfo } from "@/emu/abstractions/ExecutionContext";
import {
  EmuGetCpuStateResponse,
  EmuListBreakpointsResponse
} from "@messaging/main-to-emu";
import { useEffect, useRef, useState } from "react";
import { toHexa4 } from "../services/interactive-commands";
import { useStateRefresh } from "../useStateRefresh";
import { Z80Disassembler } from "../z80-disassembler/z80-disassembler";
import {
  MemorySection,
  MemorySectionType
} from "../z80-disassembler/disassembly-helper";
import styles from "./BreakpointsPanel.module.scss";
import { MachineControllerState } from "@state/MachineControllerState";
import { VirtualizedListView } from "@/controls/common/VirtualizedListView";
import { BreakpointIndicator } from "../DocumentPanels/BreakpointIndicator";

const BreakpointsPanel = () => {
  const { messenger } = useRendererContext();
  const [bps, setBps] = useState<BreakpointInfo[]>([]);
  const machineState = useSelector(s => s.emulatorState?.machineState);
  const bpsVersion = useSelector(s => s.emulatorState?.breakpointsVersion);
  const disassLines = useRef<string[]>();
  const pcValue = useRef(-1);

  // --- This function queries the breakpoints from the emulator
  const refreshBreakpoints = async () => {
    // --- Get breakpoint information
    const bpResponse = (await messenger.sendMessage({
      type: "EmuListBreakpoints"
    })) as EmuListBreakpointsResponse;
    const cpuResponse = (await messenger.sendMessage({
      type: "EmuGetCpuState"
    })) as EmuGetCpuStateResponse;
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
      const addr = bpResponse.breakpoints[i].address;
      const disass = new Z80Disassembler(
        [new MemorySection(addr, addr, MemorySectionType.Disassemble)],
        mem,
        {
          noLabelPrefix: false
        }
      );
      const output = await disass.disassemble(addr, addr);
      disassLines.current[i] = output.outputItems?.[0]?.instruction ?? "???";
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

  // --- Take care of refreshing the screen
  useStateRefresh(500, async () => {
    await refreshBreakpoints();
  });

  return (
    <div className={styles.breakpointsPanel}>
      {bps.length === 0 && (
        <div className={styles.center}>No breakpoints defined </div>
      )}
      {bps.length > 0 && (
        <VirtualizedListView
          items={bps}
          approxSize={20}
          fixItemHeight={false}
          itemRenderer={idx => {
            const addr = bps[idx].address;
            const disabled = bps[idx].disabled ?? false;
            const isCurrent =
              (machineState === MachineControllerState.Running ||
                machineState === MachineControllerState.Paused) &&
              pcValue.current === addr;
            return (
              <div className={styles.breakpoint}>
                <LabelSeparator width={4} />
                <BreakpointIndicator
                  address={addr}
                  current={isCurrent}
                  hasBreakpoint={true}
                  disabled={disabled}
                />
                <LabelSeparator width={4} />
                <Label text={`${toHexa4(addr)}`} width={40} />
                <Secondary text={`(${addr})`} width={64} />
                <Value text={disassLines.current[idx] ?? "???"} width='auto' />
              </div>
            );
          }}
        />
      )}
    </div>
  );
};

export const breakpointsPanelRenderer = () => <BreakpointsPanel />;
