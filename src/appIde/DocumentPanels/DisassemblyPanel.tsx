import { SmallIconButton } from "@/controls/common/IconButton";
import { ToolbarSeparator } from "@/controls/common/ToolbarSeparator";
import { VirtualizedListView } from "@/controls/common/VirtualizedListView";
import { useRendererContext, useSelector } from "@/core/RendererProvider";
import { EmuGetMemoryResponse } from "@messaging/main-to-emu";
import { MachineControllerState } from "@state/MachineControllerState";
import { useEffect, useRef, useState } from "react";
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

  // --- This function refreshes the memory
  const refreshBreakpoints = async () => {
    // --- Obtain the memory contents
    const memory = (
      (await messenger.sendMessage({
        type: "EmuGetMemory"
      })) as EmuGetMemoryResponse
    ).memory;

    // --- Specify memory sections to disassemble
    const memSections: MemorySection[] = [
      new MemorySection(0x0000, 0x3fff, MemorySectionType.Disassemble)
    ];
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

    // --- Disassemble the specified memory segments
    const disassembler = new Z80Disassembler(memSections, memory, {
      noLabelPrefix: true
    });
    const output = await disassembler.disassemble(0x0000, 0xffff);
    setDisassemblyItems(output.outputItems);
  };

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
      }
    })();
  }, [machineState]);

  // --- Whenever the state of view options change
  useEffect(() => {
    (async function () {
      await refreshBreakpoints();
    })();
  }, [ram, screen]);

  // --- Take care of refreshing the screen
  useStateRefresh(500, () => {
    if (usePc.current) {
      refreshBreakpoints();
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
        <ValueLabel text='0000 - ffff' />
      </div>
      <div className={styles.disassemblyWrapper}>
        <VirtualizedListView
          items={disassemblyItems}
          approxSize={20}
          fixItemHeight={false}
          itemRenderer={idx => {
            return <div key={idx}>{disassemblyItems?.[idx].address}</div>;
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
