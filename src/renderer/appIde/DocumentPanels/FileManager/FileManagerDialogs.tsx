import { useState } from "react";
import classnames from "classnames";

import { useT } from "@common/i18n/useT";
import { isCatalogue, type FmPlanItem, type FmTransferOptions } from "@common/fileManager/fmTransfer";
import { fmErrorCodeOf } from "@common/fileManager/fmTypes";
import type { FmTransferPlan } from "@common/fileManager/fmJobTypes";
import { Button } from "@renderer/controls/Button";
import { Checkbox } from "@renderer/controls/Checkbox";
import { DialogForm } from "@renderer/controls/DialogForm";
import { TextInput } from "@renderer/controls/TextInput";
import type { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import type { ConflictAnswer, TransferConfirmation, TransferDialogRequest } from "./FileManagerController";
import { becomesText, errorText, formatSizeWithUnit } from "./FileManagerViewModel";
import styles from "./FileManagerDialogs.module.scss";

/*
 * The File Manager's dialogs (.plans/FILE_MANAGER_PLAN.md §4.3, §4.4): the copy dialog, which shows
 * what each file becomes and plans again when an option changes; the conflict dialog; delete.
 */

/** Rows the copy dialog lists before "and N more" */
const LISTED_ROWS = 200;

type OnExisting = TransferConfirmation["onExisting"];

type TransferProps = DialogComponentProps<TransferConfirmation> & TransferDialogRequest;

export const FmTransferDialog = ({ plan: firstPlan, options: firstOptions, sourceLabel, targetLabel, replan, controls }: TransferProps) => {
  const t = useT();
  const [plan, setPlan] = useState<FmTransferPlan>(firstPlan);
  const [options, setOptions] = useState<FmTransferOptions>(firstOptions);
  const [onExisting, setOnExisting] = useState<OnExisting>("ask");
  const [codeStart, setCodeStart] = useState(String(firstOptions.codeStart ?? 32768));
  const [autoRun, setAutoRun] = useState(firstOptions.autoRun === undefined ? "" : String(firstOptions.autoRun));
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | undefined>();

  const crossing = isCatalogue(plan.from) !== isCatalogue(plan.to);
  const toCatalogue = !isCatalogue(plan.from) && isCatalogue(plan.to);
  const conflicts = plan.items.filter((i) => i.conflict).length;
  const files = plan.items.filter((i) => !i.isDirectory);
  const shortened = files.filter((i) => i.shortened).length;
  const startError = toCatalogue && !validWord(codeStart) ? t("panels.fileManager.dialog.badAddress") : undefined;
  const autoRunError = toCatalogue && autoRun.trim() && !validLine(autoRun) ? t("panels.fileManager.dialog.badLine") : undefined;

  const change = async (next: FmTransferOptions) => {
    setOptions(next);
    setPlanning(true);
    try {
      setPlan(await replan(next));
      setPlanError(undefined);
    } catch (err) {
      setPlanError(errorText(fmErrorCodeOf(err)));
    } finally {
      setPlanning(false);
    }
  };

  const numbers = (): FmTransferOptions => ({
    ...options,
    codeStart: validWord(codeStart) ? Number(codeStart) : options.codeStart,
    autoRun: validLine(autoRun) ? Number(autoRun) : undefined
  });

  // --- One chosen item is named; several are counted (what they hold is in the table)
  const single = !/^\d+$/.test(sourceLabel);
  const title = single
    ? t(plan.move ? "panels.fileManager.dialog.moveOne" : "panels.fileManager.dialog.copyOne", { name: sourceLabel, target: targetLabel })
    : t(plan.move ? "panels.fileManager.dialog.moveMany" : "panels.fileManager.dialog.copyMany", { count: Number(sourceLabel), target: targetLabel });

  return (
    <DialogForm
      submitLabel={t(plan.move ? "panels.fileManager.command.move" : "panels.fileManager.command.copy")}
      submitDisabled={planning || !!planError || !plan.fits || plan.items.length === 0 || !!startError || !!autoRunError}
      onSubmit={async () => {
        // --- Numbers typed but not yet planned with: plan with them before closing
        const final = numbers();
        const changed = final.codeStart !== options.codeStart || final.autoRun !== options.autoRun;
        const finalPlan = changed && toCatalogue ? await replan(final) : plan;
        controls.close({ plan: finalPlan, options: final, onExisting });
      }}
      onCancel={controls.cancel}
    >
      <div className={styles.body} data-testid="fm-transfer-dialog">
        <div className={styles.lead}>{title}</div>

        {crossing && (
          <div className={styles.field}>
            <span className={styles.label}>{t("panels.fileManager.dialog.mode")}</span>
            <Segmented
              value={options.mode}
              choices={[
                ["auto", t("panels.fileManager.dialog.modeAuto")],
                ["headers", t("panels.fileManager.dialog.modeHeaders")],
                ["raw", t("panels.fileManager.dialog.modeRaw")]
              ]}
              onChange={(mode) => change({ ...numbers(), mode: mode as FmTransferOptions["mode"] })}
            />
          </div>
        )}
        {crossing && <div className={styles.hint}>{t(MODE_HINTS[options.mode])}</div>}

        {toCatalogue && (
          <div className={styles.numbers}>
            <label className={styles.field}>
              <span className={styles.label}>{t("panels.fileManager.dialog.codeStart")}</span>
              <TextInput value={codeStart} width="9ch" numberOnly error={startError} onChange={setCodeStart} />
            </label>
            <label className={styles.field}>
              <span className={styles.label}>{t("panels.fileManager.dialog.autoRun")}</span>
              <TextInput value={autoRun} width="9ch" numberOnly error={autoRunError} onChange={setAutoRun} />
            </label>
          </div>
        )}

        {(plan.skippedFolders.length > 0 || options.flatten) && (
          <Checkbox
            right={true}
            label={t("panels.fileManager.dialog.flatten")}
            initialValue={!!options.flatten}
            onChange={(flatten) => change({ ...numbers(), flatten })}
          />
        )}

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{t("panels.fileManager.dialog.colSource")}</th>
                <th>{t("panels.fileManager.dialog.colTarget")}</th>
                <th>{t("panels.fileManager.dialog.colBecomes")}</th>
                <th className={styles.end}>{t("panels.fileManager.col.size")}</th>
              </tr>
            </thead>
            <tbody>
              {plan.items.slice(0, LISTED_ROWS).map((i) => (
                <tr key={i.id}>
                  <td>{i.part ? `└ ${i.sourceName}` : (i.relDir ? `${i.relDir}/` : "") + i.sourceName}</td>
                  <td className={classnames({ [styles.renamed]: i.shortened, [styles.conflict]: i.conflict })}>{i.isDirectory ? `${i.targetName}/` : i.targetName}</td>
                  <td>{i.isDirectory ? t("panels.fileManager.becomes.folder") : becomesText(i.becomes)}</td>
                  <td className={styles.end}>{i.isDirectory ? "" : formatSizeWithUnit(i.size)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {plan.items.length > LISTED_ROWS && (
            <div className={styles.more}>{t("panels.fileManager.dialog.more", { count: plan.items.length - LISTED_ROWS })}</div>
          )}
        </div>

        {conflicts > 0 && (
          <div className={styles.field}>
            <span className={styles.label}>{t("panels.fileManager.dialog.onExisting", { count: conflicts })}</span>
            <Segmented
              value={onExisting}
              choices={[
                ["ask", t("panels.fileManager.dialog.ask")],
                ["replace", t("panels.fileManager.dialog.replace")],
                ["skip", t("panels.fileManager.dialog.skip")]
              ]}
              onChange={(v) => setOnExisting(v as OnExisting)}
            />
          </div>
        )}

        {planError ? (
          <div className={styles.error}>{planError}</div>
        ) : plan.fits ? (
          <div className={styles.ok}>
            {plan.freeBytes === undefined
              ? t("panels.fileManager.dialog.size", { size: formatSizeWithUnit(plan.needBytes) })
              : t("panels.fileManager.dialog.fits", { size: formatSizeWithUnit(plan.needBytes), free: formatSizeWithUnit(plan.freeBytes) })}
          </div>
        ) : (
          <div className={styles.error}>
            {t("panels.fileManager.dialog.noRoom", { size: formatSizeWithUnit(plan.needBytes), free: formatSizeWithUnit(plan.freeBytes ?? 0) })}
          </div>
        )}
        {shortened > 0 && <div className={styles.note}>{t("panels.fileManager.dialog.shortened", { count: shortened })}</div>}
        {plan.skippedFolders.length > 0 && (
          <div className={styles.note}>{t("panels.fileManager.dialog.skippedFolders", { count: plan.skippedFolders.length })}</div>
        )}
        {isCatalogue(plan.to) && <div className={styles.hint}>{t("panels.fileManager.dialog.imageOnce")}</div>}
      </div>
    </DialogForm>
  );
};

const MODE_HINTS = {
  auto: "panels.fileManager.dialog.modeAutoHint",
  headers: "panels.fileManager.dialog.modeHeadersHint",
  raw: "panels.fileManager.dialog.modeRawHint"
} as const;

function validWord (text: string): boolean {
  return /^\d{1,5}$/.test(text.trim()) && Number(text) <= 65535;
}

function validLine (text: string): boolean {
  return /^\d{1,4}$/.test(text.trim()) && Number(text) <= 9999;
}

type SegmentedProps<T extends string> = { value: T; choices: [T, string][]; onChange: (value: T) => void };

const Segmented = <T extends string>({ value, choices, onChange }: SegmentedProps<T>) => (
  <span className={styles.segmented} role="radiogroup">
    {choices.map(([v, label]) => (
      <button
        type="button"
        role="radio"
        aria-checked={v === value}
        key={v}
        className={classnames(styles.segment, { [styles.segmentOn]: v === value })}
        onClick={() => onChange(v)}
      >
        {label}
      </button>
    ))}
  </span>
);

// -------------------------------------------------------------------------------------------------

type ConflictProps = DialogComponentProps<ConflictAnswer> & { item: FmPlanItem; suggestion: string; remaining: number };

export const FmConflictDialog = ({ item, suggestion, remaining, controls }: ConflictProps) => {
  const t = useT();
  const [name, setName] = useState(suggestion);
  const nameError = !name.trim() || /[\\/]/.test(name) ? t("panels.fileManager.dialog.badName") : undefined;
  return (
    <div className={styles.body} data-testid="fm-conflict-dialog">
      <div className={styles.lead}>{t("panels.fileManager.dialog.exists", { name: item.targetName })}</div>
      <label className={styles.field}>
        <span className={styles.label}>{t("panels.fileManager.dialog.orName")}</span>
        <TextInput value={name} error={nameError} autoFocus onChange={setName} />
      </label>
      {remaining > 0 && <div className={styles.hint}>{t("panels.fileManager.dialog.remaining", { count: remaining })}</div>}
      <footer className={styles.footer}>
        <Button text={t("panels.fileManager.dialog.replace")} clicked={() => controls.close({ kind: "replace" })} />
        <Button text={t("panels.fileManager.dialog.rename")} variant="secondary" disabled={!!nameError} clicked={() => controls.close({ kind: "rename", name: name.trim() })} />
        <Button text={t("panels.fileManager.dialog.skip")} variant="secondary" clicked={() => controls.close({ kind: "skip" })} />
        {remaining > 0 && <Button text={t("panels.fileManager.dialog.replaceAll")} variant="secondary" clicked={() => controls.close({ kind: "replaceAll" })} />}
        {remaining > 0 && <Button text={t("panels.fileManager.dialog.skipAll")} variant="secondary" clicked={() => controls.close({ kind: "skipAll" })} />}
        <Button text={t("common.button.cancel")} variant="secondary" clicked={() => controls.close({ kind: "cancel" })} />
      </footer>
    </div>
  );
};

// -------------------------------------------------------------------------------------------------

type DeleteProps = DialogComponentProps<true> & { names: string[]; permanent: boolean };

export const FmDeleteDialog = ({ names, permanent, controls }: DeleteProps) => {
  const t = useT();
  return (
    <DialogForm
      submitLabel={t("panels.fileManager.command.delete")}
      submitDanger
      onSubmit={() => controls.close(true)}
      onCancel={controls.cancel}
    >
      <div className={styles.body} data-testid="fm-delete-dialog">
        <div className={styles.lead}>
          {names.length === 1
            ? t("panels.fileManager.dialog.deleteOne", { name: names[0] })
            : t("panels.fileManager.dialog.deleteMany", { count: names.length })}
        </div>
        {names.length > 1 && (
          <ul className={styles.names}>
            {names.slice(0, 12).map((n) => <li key={n}>{n}</li>)}
            {names.length > 12 && <li>{t("panels.fileManager.dialog.more", { count: names.length - 12 })}</li>}
          </ul>
        )}
        <div className={permanent ? styles.note : styles.hint}>
          {t(permanent ? "panels.fileManager.dialog.deletePermanent" : "panels.fileManager.dialog.deleteTrash", { count: names.length })}
        </div>
      </div>
    </DialogForm>
  );
};
