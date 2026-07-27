import { MF_BANK, MF_ROM } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import type { EmuApi } from "@common/messaging/EmuApi";
import type { DropdownOption } from "@renderer/controls/Dropdown";
import { useEffect, useState } from "react";

export type DisassemblyMachineSetupState = {
  allowViews: boolean;
  displayBankMatrix: boolean;
  isInitializing: boolean;
  partitionLabels: Record<number, string>;
  segmentOptions: DropdownOption[];
  showBanks: boolean;
  showRoms: boolean;
  setupVersion: number;
};

const initialSetupState: DisassemblyMachineSetupState = {
  allowViews: false,
  displayBankMatrix: false,
  isInitializing: true,
  partitionLabels: {},
  segmentOptions: [],
  showBanks: false,
  showRoms: false,
  setupVersion: 0
};

export function createDisassemblySegmentOptions(
  labels: Record<number, string>,
  ramBankValue: number
): DropdownOption[] {
  if (ramBankValue > 8) {
    return [];
  }

  return Object.keys(labels)
    .map((label) => parseInt(label, 10))
    .sort((a, b) => (a < 0 && b < 0 ? b - a : a - b))
    .map((key) => ({
      value: key.toString(),
      label: key < 0 ? `ROM ${-key - 1}` : `BANK ${key}`
    }));
}

export function getDisassemblyMachineCapabilities(machineId: string | undefined): {
  allowViews: boolean;
  displayBankMatrix: boolean;
  showBanks: boolean;
  showRoms: boolean;
  ramBankValue: number;
} {
  const machine = machineRegistry.find((mi) => mi.machineId === machineId);
  const romPagesValue = machine?.features?.[MF_ROM] ?? 0;
  const ramBankValue = machine?.features?.[MF_BANK] ?? 0;
  const showRoms = romPagesValue > 0;
  const showBanks = ramBankValue > 0;

  return {
    allowViews: showBanks || showRoms,
    displayBankMatrix: ramBankValue > 8 || romPagesValue > 8,
    showBanks,
    showRoms,
    ramBankValue
  };
}

export function useDisassemblyMachineSetup(
  machineId: string | undefined,
  emuApi: Pick<EmuApi, "getPartitionLabels">
): DisassemblyMachineSetupState {
  const [setup, setSetup] = useState<DisassemblyMachineSetupState>(initialSetupState);

  useEffect(() => {
    let cancelled = false;
    setSetup((prev) => ({
      ...prev,
      isInitializing: true
    }));

    const capabilities = getDisassemblyMachineCapabilities(machineId);

    void (async () => {
      const labels = await emuApi.getPartitionLabels();

      if (cancelled) {
        return;
      }

      setSetup((prev) => ({
        allowViews: capabilities.allowViews,
        displayBankMatrix: capabilities.displayBankMatrix,
        isInitializing: false,
        partitionLabels: labels,
        segmentOptions: createDisassemblySegmentOptions(labels, capabilities.ramBankValue),
        showBanks: capabilities.showBanks,
        showRoms: capabilities.showRoms,
        setupVersion: prev.setupVersion + 1
      }));
    })();

    return () => {
      cancelled = true;
    };
  }, [emuApi, machineId]);

  return setup;
}
