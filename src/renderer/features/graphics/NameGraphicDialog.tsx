import { FormEvent, useMemo, useState } from "react";

import { t as translate } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";
import type { MessageKey } from "@common/i18n/keys.generated";

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
import { MASK_LABELS } from "./GraphicsToolbar";
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

/** The dialog's title, in the current language (read when the dialog opens) */
export const nameGraphicDialogTitle = () => translate("panels.graphics.nameDialog.title");

const LAYOUTS: { value: BankGraphicLayout; labelKey: MessageKey }[] = [
  { value: "linear", labelKey: "panels.graphics.layout.linear" },
  { value: "cells", labelKey: "panels.graphics.nameDialog.layout.cells" },
  { value: "columns", labelKey: "panels.graphics.layout.columns" },
  { value: "screen", labelKey: "panels.graphics.nameDialog.layout.screen" }
];
const MASKS: BankGraphicMask[] = ["none", "interleaved", "before", "after"];

export function NameGraphicDialog({ initial, baseAddress, controls }: NameGraphicDialogProps) {
  const t = useT();
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
      return { error: t("panels.graphics.nameDialog.errorName", { max: ANNOTATION_LABEL_MAX_LENGTH }) };
    }
    if (!(w >= 1 && w <= 32)) return { error: t("panels.graphics.nameDialog.errorWidth") };
    if (!(h >= 1 && h <= 256)) return { error: t("panels.graphics.nameDialog.errorHeight") };
    if (!(c >= 1)) return { error: t("panels.graphics.nameDialog.errorCount") };
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
      return { error: t("panels.graphics.nameDialog.errorLength", { length }) };
    }
    return { graphic, length };
  }, [count, height, initial.offset, layout, mask, name, width, t]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if ("graphic" in result && result.graphic) controls.close(result.graphic);
  };

  const start = (baseAddress + initial.offset) & 0xffff;
  return (
    <form onSubmit={submit}>
      <DialogRow label={t("panels.graphics.nameDialog.name")} rows={true}>
        <TextInput
          autoFocus
          maxLength={ANNOTATION_LABEL_MAX_LENGTH}
          value={name}
          onChange={(value) => setName(value.slice(0, ANNOTATION_LABEL_MAX_LENGTH))}
        />
      </DialogRow>
      <div className={styles.grid}>
        <DialogRow label={t("panels.graphics.nameDialog.width")} rows={true}>
          <TextInput value={width} onChange={setWidth} />
        </DialogRow>
        <DialogRow label={t("panels.graphics.nameDialog.height")} rows={true}>
          <TextInput value={height} onChange={setHeight} />
        </DialogRow>
        <DialogRow label={t("panels.graphics.nameDialog.frames")} rows={true}>
          <TextInput value={count} onChange={setCount} />
        </DialogRow>
      </div>
      <div className={styles.grid}>
        <DialogRow label={t("panels.graphics.byteOrder")} rows={true}>
          <Dropdown
            ariaLabel={t("panels.graphics.byteOrder")}
            options={LAYOUTS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
            initialValue={layout}
            width={180}
            onChanged={(value) => setLayout(value as BankGraphicLayout)}
          />
        </DialogRow>
        <DialogRow label={t("panels.graphics.mask")} rows={true}>
          <Dropdown
            ariaLabel={t("panels.graphics.mask")}
            options={MASKS.map((value) => ({ value, label: t(MASK_LABELS[value]) }))}
            initialValue={mask}
            width={150}
            onChanged={(value) => setMask(value as BankGraphicMask)}
          />
        </DialogRow>
      </div>
      <div className={styles.summary}>
        {"length" in result && result.length !== undefined
          ? t("panels.graphics.nameDialog.range", {
              start: `$${toHexa4(start)}`,
              end: `$${toHexa4((start + result.length - 1) & 0xffff)}`,
              length: result.length
            })
          : t("panels.graphics.nameDialog.from", { start: `$${toHexa4(start)}` })}
      </div>
      {"error" in result && result.error && (
        <div className={styles.error} role="alert">
          {result.error}
        </div>
      )}
      <DialogFooter>
        <Button text={t("panels.graphics.nameDialog.name")} type="submit" disabled={"error" in result && !!result.error} />
        <Button variant="secondary" text={t("common.button.cancel")} clicked={controls.cancel} />
      </DialogFooter>
    </form>
  );
}
