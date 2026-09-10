import { MF_BANK, MF_ROM } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import type { EmuApi } from "@common/messaging/EmuApi";
import type { DropdownOption } from "@renderer/controls/Dropdown";
import type { PartitionOption } from "@renderer/features/memory/memoryViewModel";
import { useEffect, useState } from "react";
import { createSegmentOptions, derivePartitionOptions } from "@renderer/features/memory/memoryViewModel";

export type DisassemblyMachineSetupState = {
  allowViews: boolean;
  displayBankMatrix: boolean;
  isInitializing: boolean;
  partitionLabels: Record<number, string>;
  segmentOptions: DropdownOption[];
  /** Every partition, for the matrix-shaped chooser. */
  partitionOptions: PartitionOption[];
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
  partitionOptions: [],
  showBanks: false,
  showRoms: false,
  setupVersion: 0
};

/**
 * The disassembly view's partition options.
 *
 * A re-export rather than a second implementation: this was a byte-for-byte copy of
 * `createSegmentOptions`, so the two views could drift apart in exactly the way this plan exists to
 * stop. Kept as a named function because callers and tests refer to it.
 */
export function createDisassemblySegmentOptions(
  labels: Record<number, string>,
  ramBankValue: number,
  descriptions: Record<number, string> = {}
): DropdownOption[] {
  return createSegmentOptions(labels, ramBankValue, descriptions);
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
  emuApi: Pick<EmuApi, "getPartitionLabels" | "getPartitionDescriptions" | "getPartitionGroups">
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
      const [labels, descriptions, groups] = await Promise.all([
        emuApi.getPartitionLabels(),
        emuApi.getPartitionDescriptions(),
        emuApi.getPartitionGroups()
      ]);

      if (cancelled) {
        return;
      }

      setSetup((prev) => ({
        allowViews: capabilities.allowViews,
        displayBankMatrix: capabilities.displayBankMatrix,
        isInitializing: false,
        partitionLabels: labels,
        segmentOptions: createDisassemblySegmentOptions(
          labels,
          capabilities.ramBankValue,
          descriptions
        ),
        partitionOptions: derivePartitionOptions(labels, descriptions, groups),
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
