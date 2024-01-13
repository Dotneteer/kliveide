import styles from "./MemoryBankBar.module.scss";
import { LabeledSwitch } from "@renderer/controls/LabeledSwitch";
import { ToolbarSeparator } from "@renderer/controls/ToolbarSeparator";
import { LabeledGroup } from "@renderer/controls/LabeledGroup";
import { machineRegistry } from "@common/machines/machine-registry";
import { useSelector } from "@renderer/core/RendererProvider";
import { MF_ROM } from "@common/machines/constants";
import { AddressInput } from "@renderer/controls/AddressInput";
import { useRef, useState } from "react";

export type ViewMode = "full" | "rom" | "ram";

export type CachedRefreshState = {
  autoRefresh: boolean;
  viewMode: ViewMode;
  romPage: number;
  ramBank: number;
};

export const MemoryBankBar = ({
  viewMode,
  prevViewMode,
  romPages,
  ramBanks,
  selectedRomPage,
  selectedRamBank,
  currentRomPage,
  currentRamBank,
  changed
}: MemoryBankPanelProps) => {
  // --- Get the machine information
  const machineId = useSelector(s => s.emulatorState.machineId);
  const machineInfo = machineRegistry.find(mi => mi.machineId === machineId);
  const showRoms = (machineInfo?.features?.[MF_ROM] ?? 0) > 0;
  const headerRef = useRef<HTMLDivElement>(null);
  const [specifiedBank, setSpecifiedBank] = useState(0);

  // --- Need to have multiple ROM pages or RAM banks to render
  if (romPages < 2 && ramBanks < 2) return null;

  // --- Create a list of number range
  const range = (start: number, end: number) => {
    return [...Array(end - start + 1).keys()].map(i => i + start);
  };

  return (
    <div ref={headerRef} className={styles.header} tabIndex={-1}>
      <LabeledSwitch
        value={viewMode === "full"}
        label='Full View:'
        title='Show the full 64K memory'
        clicked={v => {
          changed({
            viewMode: v ? "full" : prevViewMode,
            prevViewMode: v ? viewMode : "full",
            romPage: selectedRomPage,
            ramBank: selectedRamBank
          });
        }}
      />
      {viewMode !== "full" && showRoms && (
        <>
          <ToolbarSeparator small={true} />
          <LabeledGroup
            label='ROM: '
            title='Select the ROM to display'
            values={range(0, romPages - 1)}
            marked={currentRomPage}
            selected={viewMode === "rom" ? selectedRomPage : -1}
            clicked={v => {
              changed({
                viewMode: "rom",
                prevViewMode: viewMode,
                romPage: v,
                ramBank: selectedRamBank
              });
            }}
          />
        </>
      )}
      {viewMode !== "full" && ramBanks <= 16 && (
        <>
          <ToolbarSeparator small={true} />
          <LabeledGroup
            label='RAM Bank: '
            title='Select the RAM Bank to display'
            values={range(0, ramBanks - 1)}
            marked={currentRamBank}
            selected={viewMode === "ram" ? selectedRamBank : -1}
            clicked={v => {
              changed({
                viewMode: "ram",
                prevViewMode: viewMode,
                romPage: selectedRomPage,
                ramBank: v
              });
            }}
          />
        </>
      )}
      {viewMode !== "full" && ramBanks > 16 && (
        <>
          <ToolbarSeparator small={true} />
          <AddressInput
            label='Bank:'
            eightBit={true}
            clearOnEnter={false}
            initialValue={specifiedBank}
            onAddressSent={async bank => {
              changed({
                viewMode: "ram",
                prevViewMode: viewMode,
                romPage: selectedRomPage,
                ramBank: bank
              });
              setSpecifiedBank(bank);
              if (headerRef.current) headerRef.current.focus();
            }}
          />
        </>
      )}
    </div>
  );
};

type MemoryBankViewChangedArgs = {
  viewMode: ViewMode;
  prevViewMode: ViewMode;
  romPage: number;
  ramBank: number;
};

type MemoryBankPanelProps = {
  viewMode: ViewMode;
  prevViewMode: ViewMode;
  romPages: number;
  ramBanks: number;
  selectedRomPage: number;
  selectedRamBank: number;
  currentRomPage: number;
  currentRamBank: number;
  changed?: (newView: MemoryBankViewChangedArgs) => void;
};
