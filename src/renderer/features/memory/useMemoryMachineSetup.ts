import { MF_ROM } from "@common/machines/constants";
import { machineRegistry } from "@common/machines/machine-registry";
import type { EmuApi } from "@common/messaging/EmuApi";
import type { DropdownOption } from "@renderer/controls/Dropdown";
import { useEffect, useState } from "react";
import { derivePartitionSetup, getDefaultSegment } from "./memoryViewModel";

export type MemoryMachineSetupState = {
  banksView: boolean;
  defaultSegment: number;
  displayBankMatrix: boolean;
  isInitializing: boolean;
  partitionLabels: Record<number, string>;
  romFlags: boolean[];
  segmentOptions: DropdownOption[];
  setupVersion: number;
};

const initialSetupState: MemoryMachineSetupState = {
  banksView: false,
  defaultSegment: 0,
  displayBankMatrix: false,
  isInitializing: true,
  partitionLabels: {},
  romFlags: [],
  segmentOptions: [],
  setupVersion: 0
};

export function useMemoryMachineSetup(
  machineId: string | undefined,
  emuApi: Pick<EmuApi, "getPartitionLabels" | "getRomFlags">
): MemoryMachineSetupState {
  const [setup, setSetup] = useState<MemoryMachineSetupState>(initialSetupState);

  useEffect(() => {
    let cancelled = false;
    setSetup((prev) => ({
      ...prev,
      isInitializing: true
    }));

    const machine = machineRegistry.find((mi) => mi.machineId === machineId);
    const romPagesValue = machine?.features?.[MF_ROM] ?? 0;

    void (async () => {
      const [romFlags, labels] = await Promise.all([
        emuApi.getRomFlags(),
        emuApi.getPartitionLabels()
      ]);

      if (cancelled) {
        return;
      }

      // --- Shared with the breakpoint dialog, so the two offer the same chooser for a machine.
      const partitionSetup = derivePartitionSetup(machineId, labels);

      setSetup((prev) => ({
        banksView: partitionSetup.banksView,
        defaultSegment: getDefaultSegment(romPagesValue),
        displayBankMatrix: partitionSetup.displayBankMatrix,
        isInitializing: false,
        partitionLabels: labels,
        romFlags,
        segmentOptions: partitionSetup.segmentOptions,
        setupVersion: prev.setupVersion + 1
      }));
    })();

    return () => {
      cancelled = true;
    };
  }, [emuApi, machineId]);

  return setup;
}
