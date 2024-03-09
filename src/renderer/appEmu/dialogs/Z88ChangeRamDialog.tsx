import styles from "./Z88ChangeRamDialog.module.scss";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import { DialogRow } from "@renderer/controls/DialogRow";
import { Dropdown } from "@renderer/controls/Dropdown";
import { Modal } from "@renderer/controls/Modal";
import { useRendererContext } from "@renderer/core/RendererProvider";
import { useState } from "react";
import { MC_Z88_INTRAM } from "@common/machines/constants";
import { get } from "lodash";
import { MachineControllerState } from "@abstractions/MachineControllerState";

// --- These are the RAM sizes available for the Z88 Internal RAM
const ramSizes = [
  { value: "32", label: "32K" },
  { value: "128", label: "128K" },
  { value: "512", label: "512K" }
];

type Props = {
  onClose: () => void;
};

export const Z88ChangeRamDialog = ({ onClose }: Props) => {
  const { store, messenger } = useRendererContext();
  const { machineService } = useAppServices();

  // --- Get the current RAM size
  const emulatorState = store.getState()?.emulatorState;
  const config = emulatorState?.config ?? {};
  let ramSize = 512;
  let ramMask = config[MC_Z88_INTRAM];
  switch (ramMask) {
    case 0x01:
      ramSize = 32;
      break;
    case 0x07:
      ramSize = 128;
      break;
  }

  // --- Find the index of the current RAM size
  const ramIndex = ramSizes.findIndex(rs => rs.value === ramSize.toString());
  const [selectedSize, setSelectedSize] = useState(
    ramSizes[ramIndex >= 0 ? ramIndex : ramSizes.length - 1].value
  );
  const [ramToChange, setRamToChange] = useState(false);

  // --- Get the new RAM size's chip mask
  const getRamChipMask = (size: string) => {
    let newRamSize = 0x1f;
    switch (size) {
      case "32":
        newRamSize = 0x01;
        break;
      case "128":
        newRamSize = 0x07;
        break;
    }
    return newRamSize;
  };

  return (
    <Modal
      isOpen={true}
      title={`Change Z88 RAM size`}
      width={300}
      translateY={0}
      onPrimaryClicked={async () => {
        // --- Get the new RAM size's chip mask
        const emulatorState = store.getState()?.emulatorState;
        const newRamSize = getRamChipMask(selectedSize);
        const config = emulatorState?.config ?? {};
        if (config[MC_Z88_INTRAM] === newRamSize) {
          // --- No change, nothing to do
          return;
        }

        // --- Get the new machine configuration
        const machineId = emulatorState?.machineId;
        const modelId = emulatorState?.modelId;
        const newConfig = { ...config, [MC_Z88_INTRAM]: newRamSize };

        // --- Change the configuration
        await machineService.setMachineType(machineId, modelId, newConfig);
        await messenger.sendMessage({
          type: "IdeDisplayOutput",
          pane: "emu",
          text: `Z88 internal RAM size changed to ${selectedSize}K`,
          color: "bright-cyan",
          writeLine: true
        });

        // --- Close the dialog
        return false;
      }}
      onClose={() => {
        onClose();
      }}
    >
      <DialogRow label='Z88 internal RAM size:'>
        <div className={styles.dropdownWrapper}>
          <Dropdown
            placeholder='Select...'
            options={ramSizes}
            value={selectedSize}
            width={268}
            onSelectionChanged={async option => {
              const emulatorState = store.getState()?.emulatorState;
              const newRamSize = getRamChipMask(option);
              const config = emulatorState?.config ?? {};
              setRamToChange(config[MC_Z88_INTRAM] !== newRamSize);
              setSelectedSize(option);
            }}
          />
        </div>
      </DialogRow>
      {ramToChange &&
        emulatorState.machineState !== MachineControllerState.Stopped &&
        emulatorState.machineState !== MachineControllerState.None && (
          <DialogRow>
            <div className={styles.warning}>
              Changing the RAM will stop the machine! Click Ok, when you are
              ready to proceed.
            </div>
          </DialogRow>
        )}
    </Modal>
  );
};
