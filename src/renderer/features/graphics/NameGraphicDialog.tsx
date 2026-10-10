import { FormEvent, useMemo, useState } from "react";

import { Button } from "@renderer/controls/Button";
import { TextInput } from "@renderer/controls/TextInput";
import { DialogRow } from "@renderer/controls/DialogRow";
import Dropdown from "@renderer/controls/Dropdown";
import { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import { DialogFooter } from "@renderer/controls/overlay/DialogFooter";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import {
  ANNOTATION_BANK_LAST_OFFSET,
  ANNOTATION_LABEL_MAX_LENGTH,
  bankGraphicLength,
  isValidLabelName,
  type BankGraphic,
  type BankGraphicLayout,
  type BankGraphicMask
} from "@renderer/appIde/annotations/programAnnotations";
import styles from "./NameGraphicDialog.module.scss";

/*
 * *Name graphic…* (`.plans/REVERSE_ENGINEERING_TOOLS_PLAN.md` §5.5): a name and the layout the
 * graphic is read with, pre-filled from the finder's look. The caller publishes the result as one
 * session update (`withNamedGraphic`).
 */

export type NameGraphicDialogResult = BankGraphic & { label: string };

export type NameGraphicDialogProps = DialogComponentProps<NameGraphicDialogResult> & {
  initial: Omit<BankGraphic, "label"> & { label?: string };
  /** The address the bank's offset 0 is listed at, to show where the graphic is. */
  baseAddress: number;
};

export const NAME_GRAPHIC_DIALOG_TITLE = "Name graphic";

const LAYOUTS: { value: BankGraphicLayout; label: string }[] = [
  { value: "linear", label: "Linear" },
  { value: "cells", label: "Character cells" },
  { value: "columns", label: "Columns" },
  { value: "screen", label: "Screen order" }
];
const MASKS: { value: BankGraphicMask; label: string }[] = [
  { value: "none", label: "No mask" },
  { value: "interleaved", label: "Interleaved" },
  { value: "before", label: "Mask before" },
  { value: "after", label: "Mask after" }
];

export function NameGraphicDialog({ initial, baseAddress, controls }: NameGraphicDialogProps) {
  const [name, setName] = useState(initial.label ?? "");
  const [width, setWidth] = useState(String(initial.width));
  const [height, setHeight] = useState(String(initial.height));
  const [count, setCount] = useState(String(initial.count));
  const [layout, setLayout] = useState<BankGraphicLayout>(initial.layout);
  const [mask, setMask] = useState<BankGraphicMask>(initial.mask ?? "none");

  const result = useMemo(() => {
    const w = parseInt(width, 10);
    const h = parseInt(height, 10);
    const c = parseInt(count, 10);
    if (!isValidLabelName(name.trim())) {
      return { error: `Use an identifier of up to ${ANNOTATION_LABEL_MAX_LENGTH} characters.` };
    }
    if (!(w >= 1 && w <= 32)) return { error: "Width is 1 to 32 bytes." };
    if (!(h >= 1 && h <= 256)) return { error: "Height is 1 to 256 pixel rows." };
    if (!(c >= 1)) return { error: "Count is at least one frame." };
    const graphic: NameGraphicDialogResult = {
      offset: initial.offset,
      width: w,
      height: h,
      count: c,
      layout,
      ...(mask !== "none" ? { mask } : {}),
      label: name.trim()
    };
    const length = bankGraphicLength(graphic);
    if (initial.offset + length - 1 > ANNOTATION_BANK_LAST_OFFSET) {
      return { error: `${length} bytes run past the end of the bank.` };
    }
    return { graphic, length };
  }, [count, height, initial.offset, layout, mask, name, width]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ("graphic" in result && result.graphic) controls.close(result.graphic);
  };

  const start = (baseAddress + initial.offset) & 0xffff;
  return (
    <form onSubmit={submit}>
      <DialogRow label="Name" rows={true}>
        <TextInput
          autoFocus
          maxLength={ANNOTATION_LABEL_MAX_LENGTH}
          value={name}
          onChange={(value) => setName(value.slice(0, ANNOTATION_LABEL_MAX_LENGTH))}
        />
      </DialogRow>
      <div className={styles.grid}>
        <DialogRow label="Width (bytes)" rows={true}>
          <TextInput value={width} onChange={setWidth} />
        </DialogRow>
        <DialogRow label="Height (rows)" rows={true}>
          <TextInput value={height} onChange={setHeight} />
        </DialogRow>
        <DialogRow label="Frames" rows={true}>
          <TextInput value={count} onChange={setCount} />
        </DialogRow>
      </div>
      <div className={styles.grid}>
        <DialogRow label="Byte order" rows={true}>
          <Dropdown
            ariaLabel="Byte order"
            options={LAYOUTS}
            initialValue={layout}
            width={180}
            onChanged={(value) => setLayout(value as BankGraphicLayout)}
          />
        </DialogRow>
        <DialogRow label="Mask" rows={true}>
          <Dropdown
            ariaLabel="Mask"
            options={MASKS}
            initialValue={mask}
            width={150}
            onChanged={(value) => setMask(value as BankGraphicMask)}
          />
        </DialogRow>
      </div>
      <div className={styles.summary}>
        {"length" in result && result.length !== undefined
          ? `$${toHexa4(start)}-$${toHexa4((start + result.length - 1) & 0xffff)}, ${result.length} bytes`
          : `From $${toHexa4(start)}`}
      </div>
      {"error" in result && result.error && (
        <div className={styles.error} role="alert">
          {result.error}
        </div>
      )}
      <DialogFooter>
        <Button text="Name" type="submit" disabled={"error" in result && !!result.error} />
        <Button variant="secondary" text="Cancel" clicked={controls.cancel} />
      </DialogFooter>
    </form>
  );
}
