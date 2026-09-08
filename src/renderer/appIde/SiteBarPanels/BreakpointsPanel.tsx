import type { BreakpointInfo } from "@abstractions/BreakpointInfo";

import { Label } from "@renderer/controls/layout/Label";
import { Value } from "@renderer/controls/layout/Value";
import { Secondary } from "@renderer/controls/layout/Secondary";
import { useSelector } from "@renderer/core/RendererProvider";
import { MachineControllerState } from "@abstractions/MachineControllerState";
import { useState, useRef, useEffect } from "react";
import { BreakpointIndicator } from "../DocumentPanels/BreakpointIndicator";
import { useEmuStateListener } from "../useStateRefresh";
import styles from "./BreakpointsPanel.module.scss";
import { getBreakpointKey } from "@common/utils/breakpoints";
import { toHexa4 } from "../services/ide-commands";
import { useEmuApi } from "@renderer/core/EmuApi";
import { CpuState } from "@common/messaging/EmuApi";
import { VirtualizedList } from "@renderer/controls/VirtualizedList";
import classnames from "classnames";
import { TooltipFactory, useTooltipRef } from "@renderer/controls/Tooltip";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { MemorySection } from "../disassemblers/common-types";
import { Z80Disassembler } from "../disassemblers/z80-disassembler/z80-disassembler";
import { MemorySectionType } from "@abstractions/MemorySection";
import { DataRow, EmptyState } from "@renderer/controls/data";
import regStyles from "@renderer/controls/data/Registers.module.scss";
import type { ReactNode } from "react";

/*
 * M2: `ch`, not px. Capacity preserved from the px widths at the panel's old 12.8px size (px / 6.4),
 * so the columns keep the room they had while no longer being tuned to one font.
 */
const RESOLVED_WIDTH = "13ch"; // 80px / 6.4 = 12.5
const OP_ADDR_WIDTH = "8ch"; // 52px / 6.4 = 8.125

/**
 * What a breakpoint row says when you hover it.
 *
 * The panel packs a lot into a narrow row — an indicator whose shape encodes the type, one or two
 * addresses, and a disassembled instruction — so the tooltip is where those are named. It folds in
 * the "go to source" hint that used to live on the address label alone, because the row now owns the
 * tooltip and two nested tooltips would both try to show.
 */
const breakpointTooltip = (
  bp: BreakpointInfo,
  addrKey: string,
  instruction: string,
  isWatchpoint: boolean
): string => {
  const kind = bp.memoryRead
    ? "Memory read"
    : bp.memoryWrite
      ? "Memory write"
      : bp.ioRead
        ? "I/O read"
        : bp.ioWrite
          ? "I/O write"
          : "Execution";
  const lines = [`${kind} breakpoint at ${addrKey}`];
  if (bp.disabled) lines.push("Disabled");
  if (bp.resolvedAddress !== undefined) {
    lines.push(`Resolves to $${toHexa4(bp.resolvedAddress)} (${bp.resolvedAddress})`);
  }
  if ((bp.exec || isWatchpoint) && instruction) lines.push(instruction);
  if (bp.resource !== undefined && bp.line !== undefined) {
    lines.push(`Click the address to go to ${bp.resource.split("/").pop()}:${bp.line}`);
  }
  // --- The indicator's own action hints, folded in: it renders with `noTooltip` here so that its
  // --- two tooltips do not fire on top of this one.
  lines.push(bp.disabled ? "Check the box to enable" : "Uncheck the box to disable");
  lines.push("Right-click the indicator to remove");
  return lines.join("\n");
};

/**
 * A breakpoint row whose tooltip covers the whole row.
 *
 * Same shape as `TipRow` in `MemMappingPanel`: `DataRow` forwards its ref, `TooltipFactory` binds to
 * whatever element it is handed, and it renders nothing inline (it portals only while visible) so it
 * is safe as a child of the row's flex container.
 */
const BreakpointRow = ({ tooltip, children }: { tooltip: string; children: ReactNode }) => {
  const ref = useTooltipRef<HTMLDivElement>();

  return (
    <DataRow hoverable ref={ref}>
      {children}
      <TooltipFactory
        refElement={ref.current}
        placement="right"
        offsetX={0}
        offsetY={0}
        showDelay={100}
        content={tooltip}
      />
    </DataRow>
  );
};

export const BreakpointsPanel = () => {
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
    setBps(bpState.breakpoints.map((bp) => ({ ...bp })));
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
  useEmuStateListener(emuApi, async () => {
    await refreshBreakpoints();
  });

  return (
    <div className={styles.breakpointsPanel}>
      {bps.length === 0 && <EmptyState message="No breakpoints defined" />}
      {bps.length > 0 && (
        <VirtualizedList
          items={bps}
          renderItem={(idx) => {
            try {
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

              const isWatchpoint = !!(bp.memoryRead || bp.memoryWrite || bp.ioRead || bp.ioWrite);
              const instruction = disassLines.current[idx] ?? "???";

              return (
                <BreakpointRow tooltip={breakpointTooltip(bp, addrKey, instruction, isWatchpoint)}>
                  <BreakpointIndicator
                    partition={
                      bp?.partition !== undefined ? partitionLabels[bp.partition] ?? "?" : undefined
                    }
                    address={addr ?? addrKey}
                    resolvedAddress={bp.resolvedAddress}
                    current={isCurrent}
                    hasBreakpoint={true}
                    disabled={disabled}
                    memoryRead={bp.memoryRead}
                    memoryWrite={bp.memoryWrite}
                    ioRead={bp.ioRead}
                    ioWrite={bp.ioWrite}
                    ioMask={bp.ioMask}
                    showType
                    noTooltip
                  />
                  {/*
                    * The breakpoint's own address is the headline and takes the primary accent (see
                    * `.bpLabel`); the *resolved* address is the supporting one and takes the
                    * secondary (`--color-state-value-alt`). The disassembled instruction keeps
                    * `Value`'s neutral `--data-value` — it is context for the address.
                    */}
                  {bp.resolvedAddress !== undefined && (
                    <Value
                      text={`$${toHexa4(bp.resolvedAddress)}`}
                      width={RESOLVED_WIDTH}
                      className={classnames(styles.bpCell, regStyles.stateValueAlt)}
                    />
                  )}
                  <BreakpointAddressLabel addrKey={addrKey} breakpoint={bp} />
                  {bp.exec && (
                    <Value
                      text={instruction}
                      width="auto"
                      className={styles.bpCell}
                    />
                  )}
                  {isWatchpoint && machineState === MachineControllerState.Paused && (
                    <>
                      <Secondary
                        text={`$${toHexa4(lastCpuState?.opStartAddress ?? -1)}:`}
                        width={OP_ADDR_WIDTH}
                        className={regStyles.stateValueAlt}
                      />
                      <Value
                        text={instruction}
                        width="auto"
                        className={styles.bpCell}
                      />
                    </>
                  )}
                </BreakpointRow>
              );
            } catch (e) {
              return <div key={idx} />;
            }
          }}
        />
      )}
    </div>
  );
};

type BreakpointAddressLabelProps = {
  addrKey: string;
  breakpoint: BreakpointInfo;
};

const BreakpointAddressLabel = ({ addrKey, breakpoint }: BreakpointAddressLabelProps) => {
  const { ideCommandsService } = useAppServices();
  const navigable = breakpoint.resource !== undefined && breakpoint.line !== undefined;

  return (
    <span
      className={classnames({ [styles.navigable]: navigable })}
      onClick={async () => {
        // --- Only a source-backed breakpoint has somewhere to go. Without this guard a click on an
        // --- address-only breakpoint still ran `nav "undefined" undefined`, and the cursor never
        // --- suggested it was clickable in the first place.
        if (!navigable) return;
        const command = `nav "${breakpoint.resource}" ${breakpoint.line}`;
        await ideCommandsService.executeCommand(command);
      }}
    >
      {/*
        * No tooltip of its own any more: the row carries one, and it names this navigation hint. A
        * second tooltip nested inside the row's would try to show at the same time.
        */}
      <Label text={addrKey} className={styles.bpLabel} />
    </span>
  );
};
