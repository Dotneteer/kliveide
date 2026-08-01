import { Modal } from "@controls/Modal";
import { TextInput } from "@controls/TextInput";
import { DialogRow } from "@renderer/controls/DialogRow";
import { useState } from "react";
import { toHexa2, toHexa4 } from "../services/ide-commands";
import { useAppServices } from "@renderer/appIde/services/AppServicesProvider";
import Dropdown from "@renderer/controls/Dropdown";
import { Checkbox } from "@renderer/controls/Checkbox";
import { DialogForm } from "@renderer/controls/DialogForm";

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
  const [submitError, setSubmitError] = useState<string>();
  const [sizeOption, setSizeOption] = useState("-b8");
  const [bigEndian, setBigEndian] = useState(false);

  const validate = async (value: string) => {
    const getNum = await ideCommandsService.executeCommand(`num ${value.replace(" ", "")}`);
    return getNum.success;
  };

  const submitMemoryValue = async (): Promise<boolean> => {
    if (!(await validate(memValue))) {
      setSubmitError("Enter a valid numeric value.");
      return false;
    }
    await onSetMemory?.({ value: memValue, sizeOption, bigEndian });
    return true;
  };

  return (
    <Modal
      title="Set Memory Content"
      isOpen={true}
      fullScreen={false}
      width={300}
      footerVisible={isRom}
      cancelLabel={isRom ? "Close" : "Cancel"}
      cancelVisible={isRom}
      initialFocus={isRom ? "cancel" : "none"}
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
        <DialogForm
          submitLabel="Set"
          submitDisabled={false}
          onSubmit={async () => {
            if (await submitMemoryValue()) onClose();
          }}
          onCancel={onClose}
        >
          <DialogRow rows={true} label={`Memory content at $${toHexa4(address)} (${address}): *`}>
            <TextInput
              value={memValue}
              error={submitError}
              autoFocus={true}
              onChange={(val) => {
                setMemValue(val);
                setSubmitError(undefined);
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
        </DialogForm>
      )}
    </Modal>
  );
};
