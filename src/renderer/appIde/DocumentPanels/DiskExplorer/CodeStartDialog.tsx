import { useState } from "react";

import { TextInput } from "@controls/TextInput";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogForm } from "@renderer/controls/DialogForm";
import type { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import { useT } from "@common/i18n/useT";

/*
 * Where a headerless binary added to a disk loads (.plans/DISK_IMAGES_AND_FILE_SYSTEMS_PLAN.md,
 * B4): a decimal or $-hex address, 32768 suggested.
 */

type Props = DialogComponentProps<{ start: number }> & { fileName: string };

/** The address a text names: decimal, `$hex` or `#hex`; undefined when it names none */
export function parseCodeStart (text: string): number | undefined {
  const value = text.trim();
  const parsed = /^[$#]([0-9a-f]{1,4})$/i.test(value) ? parseInt(value.slice(1), 16) : /^\d{1,5}$/.test(value) ? parseInt(value, 10) : NaN;
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 0xffff ? parsed : undefined;
}

export const CodeStartDialog = ({ fileName, controls }: Props) => {
  const t = useT();
  const [text, setText] = useState("32768");
  const start = parseCodeStart(text);
  return (
    <DialogForm
      submitLabel={t("panels.diskExplorer.codeStart.submit")}
      submitDisabled={start === undefined}
      onSubmit={() => start !== undefined && controls.close({ start })}
      onCancel={controls.cancel}
    >
      <DialogRow rows={true}>
        <div>{t("panels.diskExplorer.codeStart.prompt", { name: fileName })}</div>
        <TextInput
          value={text}
          autoFocus={true}
          error={start === undefined ? t("panels.diskExplorer.codeStart.invalid") : undefined}
          onChange={setText}
        />
      </DialogRow>
    </DialogForm>
  );
};
