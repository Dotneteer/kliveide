import { Modal } from "@controls/Modal";
import { TextInput } from "@controls/TextInput";
import { DialogRow } from "@renderer/controls/DialogRow";
import { useState } from "react";
import { toHexa2, toHexa4 } from "../services/ide-commands";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import Dropdown from "@renderer/controls/Dropdown";
import { Checkbox } from "@renderer/controls/Checkbox";

const sizeOptions = [
  { value: "-b8", label: "1 byte" },
  { value: "-b16", label: "2 bytes" },
  { value: "-b24", label: "3 bytes" },
  { value: "-b32", label: "4 bytes" }
];

type Props = {
  address: number;
  currentValue: number;
  decimal: boolean;
  isRom?: boolean;
  onClose: () => void;
  onSetMemory: (result: SetMemoryDialogResult) => Promise<void> | void;
};

export type SetMemoryDialogResult = {
  value: string;
  sizeOption: string;
  bigEndian: boolean;
};

export const SetMemoryDialog = ({
  address,
  currentValue,
  decimal,
  isRom,
  onClose,
  onSetMemory
}: Props) => {
  const { ideCommandsService } = useAppServices();
  const [memValue, setMemValue] = useState(
    decimal ? currentValue.toString(10) : "$" + toHexa2(currentValue)
  );
  const [valueValid, setValueValid] = useState(true);
  const [sizeOption, setSizeOption] = useState("-b8");
  const [bigEndian, setBigEndian] = useState(false);

  const validate = async (value: string) => {
    const getNum = await ideCommandsService.executeCommand(`num ${value.replace(" ", "")}`);
    setValueValid(getNum.success);
    return getNum.success;
  };

  const submitMemoryValue = async (): Promise<boolean> => {
    if (!(await validate(memValue))) {
      return true;
    }
    await onSetMemory?.({ value: memValue, sizeOption, bigEndian });
    return false;
  };

  return (
    <Modal
      title="Set Memory Content"
      isOpen={true}
      fullScreen={false}
      width={300}
      primaryLabel="Set"
      primaryVisible={!isRom}
      primaryEnabled={!isRom && valueValid}
      cancelLabel={isRom ? "Close" : "Cancel"}
      initialFocus={isRom ? "cancel" : "none"}
      onPrimaryClicked={submitMemoryValue}
      onClose={() => {
        onClose();
      }}
    >
      {isRom && (
        <DialogRow rows={true}>
          <div style={{ color: "#ff6b6b", padding: "8px 0", fontWeight: "bold" }}>
            This memory location is read-only (ROM) and cannot be modified.
          </div>
        </DialogRow>
      )}
      {!isRom && (
        <>
          <DialogRow rows={true} label={`Memory content at $${toHexa4(address)} (${address}): *`}>
            <TextInput
              value={memValue}
              isValid={valueValid}
              focusOnInit={true}
              keyPressed={async (e) => {
                if (e.code === "Enter") {
                  const keepOpen = await submitMemoryValue();
                  if (!keepOpen) {
                    onClose();
                  }
                }
              }}
              valueChanged={(val) => {
                setMemValue(val);
                void validate(val);
                return false;
              }}
            />
          </DialogRow>
          <DialogRow label="Content size">
            <div style={{ display: "flex", padding: "8px 0" }}>
              <Dropdown
                placeholder="Select..."
                options={sizeOptions}
                initialValue={`-b8`}
                width={80}
                onChanged={async (option) => {
                  setSizeOption(option);
                }}
              />
            </div>
          </DialogRow>
          <DialogRow>
            <Checkbox
              enabled={sizeOption !== "-b8"}
              initialValue={bigEndian}
              label="Big-endian write"
              right={true}
              onChange={(value) => {
                setBigEndian(value);
              }}
            />
          </DialogRow>
        </>
      )}
    </Modal>
  );
};
