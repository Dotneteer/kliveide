import { ModalApi, Modal } from "@controls/Modal";
import { TextInput } from "@controls/TextInput";
import { DialogRow } from "@renderer/controls/DialogRow";
import { useRef, useState } from "react";
import { toHexa2, toHexa4 } from "../services/ide-commands";
import { useAppServices } from "../services/AppServicesProvider";
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
  onClose: () => void;
  onSetMemory: (value: string, option: string, bigEndian: boolean) => Promise<void>;
};

export const SetMemoryDialog = ({
  address,
  currentValue,
  decimal,
  onClose,
  onSetMemory
}: Props) => {
  const { ideCommandsService } = useAppServices();
  const modalApi = useRef<ModalApi>(null);
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

  return (
    <Modal
      title="Set Memory Content"
      isOpen={true}
      fullScreen={false}
      width={300}
      onApiLoaded={(api) => (modalApi.current = api)}
      primaryLabel="Set"
      primaryEnabled={valueValid}
      initialFocus="none"
      onPrimaryClicked={async (result) => {
        if (!result) {
          await onSetMemory?.(memValue, sizeOption, bigEndian);
        }
        return false;
      }}
      onClose={() => {
        onClose();
      }}
    >
      <DialogRow rows={true} label={`Memory content at $${toHexa4(address)} (${address}): *`}>
        <TextInput
          value={memValue}
          isValid={valueValid}
          focusOnInit={true}
          keyPressed={async (e) => {
            if (e.code === "Enter") {
              if (await validate(memValue)) {
                await onSetMemory?.(memValue, sizeOption, bigEndian);
                modalApi.current.triggerPrimary(-1);
              }
            }
          }}
          valueChanged={(val) => {
            validate(val);
            setMemValue(val);
            modalApi.current.enablePrimaryButton(valueValid);
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
    </Modal>
  );
};
