import styles from "./SetMemoryDialog.module.scss";
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

/** The `num` command's single-byte size flag. Was written as ``{`-b8`}`` at three call sites. */
const SINGLE_BYTE = "-b8";

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
  const [sizeOption, setSizeOption] = useState(SINGLE_BYTE);
  const [bigEndian, setBigEndian] = useState(false);

  /*
   * Endianness only exists for a multi-byte write.
   *
   * `bigEndian` was never reset when the size went back to one byte, so: pick "4 bytes", tick
   * "Big-endian write", return to "1 byte" — the checkbox correctly disables itself, and the stale
   * `true` was still submitted, appending `-be` to a single-byte command. Deriving the submitted
   * value rather than trying to remember to clear the state is what stops that recurring: there is
   * no second place to keep in step.
   */
  const isMultiByte = sizeOption !== SINGLE_BYTE;
  const effectiveBigEndian = isMultiByte && bigEndian;

  const validate = async (value: string) => {
    const getNum = await ideCommandsService.executeCommand(`num ${value.replace(" ", "")}`);
    return getNum.success;
  };

  const submitMemoryValue = async (): Promise<boolean> => {
    /*
     * The whole submit is guarded, not just its result.
     *
     * `validate` awaits a command and only `success === false` was handled; a *throw* propagated
     * out through `DialogForm`'s `await onSubmit()` as an unhandled rejection, leaving the dialog
     * open with no error and nothing in the UI to say why. Same for `onSetMemory`, which writes to
     * the machine.
     */
    try {
      if (!(await validate(memValue))) {
        setSubmitError("Enter a valid numeric value.");
        return false;
      }
      await onSetMemory?.({ value: memValue, sizeOption, bigEndian: effectiveBigEndian });
      return true;
    } catch (err) {
      setSubmitError((err as Error)?.message ?? "The memory could not be written.");
      return false;
    }
  };

  return (
    <Modal
      title="Set Memory Content"
      iconName="memory-icon"
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
          {/* --- Was `style={{ color: "#ff6b6b" }}` — the last raw hex colour in any dialog, and a
              --- shade of red that belongs to nothing. `--status-error` is the app's one failure
              --- colour and follows the theme. */}
          <div className={styles.romWarning}>
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
            <div className={styles.sizeRow}>
              <Dropdown
                placeholder="Select..."
                options={sizeOptions}
                initialValue={SINGLE_BYTE}
                width={80}
                onChanged={async (option) => {
                  setSizeOption(option);
                }}
              />
            </div>
          </DialogRow>
          <DialogRow>
            <Checkbox
              enabled={isMultiByte}
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
