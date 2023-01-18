import { Icon } from "@/controls/common/Icon";
import { SmallIconButton } from "@/controls/common/IconButton";
import {
  Label,
  LabelSeparator,
  Secondary,
  Value
} from "@/controls/common/Labels";
import { ToolbarSeparator } from "@/controls/common/ToolbarSeparator";
import { TooltipFactory } from "@/controls/common/Tooltip";
import { VirtualizedListApi } from "@/controls/common/VirtualizedList";
import { VirtualizedListView } from "@/controls/common/VirtualizedListView";
import { useRendererContext, useSelector } from "@/core/RendererProvider";
import { BreakpointInfo } from "@/emu/abstractions/ExecutionContext";
import classnames from "@/utils/classnames";
import { EmuGetMemoryResponse } from "@messaging/main-to-emu";
import { MachineControllerState } from "@state/MachineControllerState";
import { useEffect, useRef, useState } from "react";
import { toHexa4 } from "../services/interactive-commands";
import { useStateRefresh } from "../useStateRefresh";
import {
  DisassemblyItem,
  MemorySection,
  MemorySectionType
} from "../z80-disassembler/disassembly-helper";
import { Z80Disassembler } from "../z80-disassembler/z80-disassembler";
import styles from "./DisassemblyPanel.module.scss";

const DisassemblyPanel = () => {
  const { messenger } = useRendererContext();
  const [followPc, setFollowPc] = useState(false);
  const usePc = useRef(false);
  const initialized = useRef(false);
  const [ram, setRam] = useState(true);
  const [screen, setScreen] = useState(false);
  const machineState = useSelector(s => s.emulatorState?.machineState);
  const [disassemblyItems, setDisassemblyItems] = useState<DisassemblyItem[]>(
    []
  );
  const [firstAddr, setFirstAddr] = useState(0);
  const [lastAddr, setLastAddr] = useState(0);
  const [pausedPc, setPausedPc] = useState(0);
  const pcValue = useRef(0);
  const breakpoints = useRef<BreakpointInfo[]>();
  const bpsVersion = useSelector(s => s.emulatorState?.breakpointsVersion);
  const vlApi = useRef<VirtualizedListApi>(null);
  const refreshedOnStateChange = useRef(false);

  // --- This function refreshes the memory
  const refreshBreakpoints = async () => {
    // --- Obtain the memory contents
    const response = (await messenger.sendMessage({
      type: "EmuGetMemory"
    })) as EmuGetMemoryResponse;
    const memory = response.memory;
    pcValue.current = response.pc;
    setPausedPc(response.pc);
    breakpoints.current = response.memBreakpoints;

    // --- Specify memory sections to disassemble
    const memSections: MemorySection[] = [];

    if (usePc.current) {
      // --- Disassemble only one KB from the current PC value
      memSections.push(
        new MemorySection(
          pcValue.current,
          (pcValue.current + 1024) & 0xffff,
          MemorySectionType.Disassemble
        )
      );
    } else {
      // --- Use the memory segments according to the "ram" and "screen" flags
      memSections.push(
        new MemorySection(0x0000, 0x3fff, MemorySectionType.Disassemble)
      );
      if (ram) {
        if (screen) {
          memSections.push(
            new MemorySection(0x4000, 0xffff, MemorySectionType.Disassemble)
          );
        } else {
          memSections.push(
            new MemorySection(0x5b00, 0xffff, MemorySectionType.Disassemble)
          );
        }
      } else if (screen) {
        memSections.push(
          new MemorySection(0x4000, 0x5aff, MemorySectionType.Disassemble)
        );
      }
    }

    // --- Disassemble the specified memory segments
    const disassembler = new Z80Disassembler(memSections, memory, {
      noLabelPrefix: true
    });
    const output = await disassembler.disassemble(0x0000, 0xffff);
    const items = output.outputItems;
    setDisassemblyItems(items);

    if (items.length > 0) {
      setFirstAddr(items[0].address);
      setLastAddr(items[items.length - 1].address);
    }

    // --- Navigate to the top when following the PC
    if (usePc.current) {
      vlApi.current?.scrollToTop();
    }
  };

  // --- Initial view
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    refreshBreakpoints();
  });

  // --- Whenever machine state changes or breakpoints change, refresh the list
  useEffect(() => {
    (async function () {
      switch (machineState) {
        case MachineControllerState.Paused:
        case MachineControllerState.Stopped:
          await refreshBreakpoints();
          refreshedOnStateChange.current = true;
      }
    })();
  }, [machineState]);

  // --- Whenever the state of view options change
  useEffect(() => {
    (async function () {
      await refreshBreakpoints();
    })();
  }, [ram, screen, bpsVersion, pausedPc]);

  // --- Take care of refreshing the screen
  useStateRefresh(500, () => {
    if (usePc.current || refreshedOnStateChange.current) {
      refreshBreakpoints();
      refreshedOnStateChange.current = false;
    }
  });

  return (
    <div className={styles.disassemblyPanel}>
      <div className={styles.header}>
        <SmallIconButton iconName='refresh' title={"Refresh now"} />
        <ToolbarSeparator small={true} />
        <HeaderLabel text='Follow PC:' />
        <SmallIconButton
          iconName={followPc ? "circle-filled" : "circle-outline"}
          title='Follow the changes of PC'
          clicked={() => {
            usePc.current = !followPc;
            setFollowPc(!followPc);
          }}
        />
        <ToolbarSeparator small={true} />
        <HeaderLabel text='RAM:' />
        <SmallIconButton
          iconName={ram ? "circle-filled" : "circle-outline"}
          title='Disasseble RAM?'
          clicked={() => setRam(!ram)}
        />
        <ToolbarSeparator small={true} />
        <HeaderLabel text='Screen:' />
        <SmallIconButton
          iconName={screen ? "circle-filled" : "circle-outline"}
          title='Disasseble screen?'
          clicked={() => setScreen(!screen)}
        />
        <ToolbarSeparator small={true} />
        <ValueLabel text={`${toHexa4(firstAddr)} - ${toHexa4(lastAddr)}`} />
      </div>
      <div className={styles.disassemblyWrapper}>
        <VirtualizedListView
          items={disassemblyItems}
          approxSize={20}
          fixItemHeight={false}
          apiLoaded={api => (vlApi.current = api)}
          itemRenderer={idx => {
            const address = disassemblyItems?.[idx].address;
            const execPoint = address === pcValue.current;
            const breakpoint = breakpoints.current.find(
              bp => bp.address === address
            );
            return (
              <div
                className={classnames(styles.item, {
                  [styles.even]: idx % 2 == 0
                })}
              >
                {execPoint || breakpoint ? (
                  <div>
                    <Icon
                      width={16}
                      height={16}
                      iconName={execPoint ? "debug-current" : "circle-filled"}
                      fill={
                        execPoint
                          ? "--color-breakpoint-current"
                          : breakpoint?.disabled ?? false
                          ? "--color-breakpoint-disabled"
                          : "--color-breakpoint-enabled"
                      }
                    />
                  </div>
                ) : (
                  <>
                    <div className={styles.iconPlaceholder} />
                  </>
                )}
                <LabelSeparator width={4} />
                <Label text={`${toHexa4(address)}`} width={40} />
                <Secondary text={disassemblyItems?.[idx].opCodes} width={100} />
                <Label
                  text={
                    disassemblyItems?.[idx].hasLabel
                      ? `L${toHexa4(address)}:`
                      : ""
                  }
                  width={80}
                />
                <Value text={disassemblyItems?.[idx].instruction} />
              </div>
            );
          }}
        />
      </div>
    </div>
  );
};

type LabelProps = {
  text: string;
};

const HeaderLabel = ({ text }: LabelProps) => {
  return <div className={styles.headerLabel}>{text}</div>;
};

const ValueLabel = ({ text }: LabelProps) => {
  return <div className={styles.valueLabel}>{text}</div>;
};

export const createDisassemblyPanel = () => <DisassemblyPanel />;
