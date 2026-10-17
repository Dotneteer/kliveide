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
import { useT } from "@common/i18n/useT";

/** The `num` command's size flags and how many bytes each writes. */
const SIZE_FLAGS = [
  { value: "-b8", bytes: 1 },
  { value: "-b16", bytes: 2 },
  { value: "-b24", bytes: 3 },
  { value: "-b32", bytes: 4 }
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
  const t = useT();
  const sizeOptions = SIZE_FLAGS.map(({ value, bytes }) => ({
    value,
    label: t("dialog.setMemory.sizeOption", { count: bytes })
  }));
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
        setSubmitError(t("dialog.setMemory.invalidValue"));
        return false;
      }
      await onSetMemory?.({ value: memValue, sizeOption, bigEndian: effectiveBigEndian });
      return true;
    } catch (err) {
      setSubmitError((err as Error)?.message ?? t("dialog.setMemory.writeFailed"));
      return false;
    }
  };

  return (
    <Modal
      title={t("dialog.setMemory.title")}
      iconName="memory-icon"
      isOpen={true}
      fullScreen={false}
      width={300}
      footerVisible={isRom}
      cancelLabel={isRom ? t("common.button.close") : t("common.button.cancel")}
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
            {t("dialog.setMemory.romWarning")}
          </div>
        </DialogRow>
      )}
      {!isRom && (
        <DialogForm
          submitLabel={t("dialog.setMemory.submit")}
          submitDisabled={false}
          onSubmit={async () => {
            if (await submitMemoryValue()) onClose();
          }}
          onCancel={onClose}
        >
          <DialogRow rows={true} label={t("dialog.setMemory.contentLabel", { address: `$${toHexa4(address)}`, decimal: address })}>
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
          <DialogRow label={t("dialog.setMemory.sizeLabel")}>
            <div className={styles.sizeRow}>
              <Dropdown
                placeholder={t("dialog.setMemory.sizePlaceholder")}
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
              label={t("dialog.setMemory.bigEndian")}
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
