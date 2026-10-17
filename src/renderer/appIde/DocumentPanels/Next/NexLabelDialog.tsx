import { FormEvent, useMemo, useState } from "react";
import { Button } from "@renderer/controls/Button";
import { TextInput } from "@renderer/controls/TextInput";
import { RadioGroup } from "@renderer/controls/RadioGroup";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import {
  isValidLabelName,
  ANNOTATION_BANK_LAST_OFFSET,
  ANNOTATION_LABEL_MAX_LENGTH,
  type AnnotationLabelScope
} from "@renderer/appIde/annotations/programAnnotations";
import styles from "./NexLabelDialog.module.scss";
import { t } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";
import {
  DialogFooter,
  DialogFooterSpacer
} from "@renderer/controls/overlay/DialogFooter";

export type NexLabelDialogLabel = {
  scope: AnnotationLabelScope;
  bank?: number;
  name: string;
  value: number;
  referenced?: boolean;
  referenceCount?: number;
};

export type NexLabelDialogResult = {
  action: "save" | "delete";
  scope: AnnotationLabelScope;
  name: string;
  value: number;
  originalLabel?: NexLabelDialogLabel;
};

export type NexLabelDialogProps = DialogComponentProps<NexLabelDialogResult> & {
  bank: number;
  initialScope: AnnotationLabelScope;
  initialGlobalValue: number;
  initialLocalValue: number;
  labels: NexLabelDialogLabel[];
};

export function NexLabelDialog({
  bank,
  initialScope,
  initialGlobalValue,
  initialLocalValue,
  labels,
  controls
}: NexLabelDialogProps) {
  const t = useT();
  const initialLabel = useMemo(
    () => findLabelAtValue(labels, initialScope, initialScope === "global"
      ? initialGlobalValue
      : initialLocalValue),
    [initialGlobalValue, initialLocalValue, initialScope, labels]
  );
  const [scope, setScope] = useState<AnnotationLabelScope>(initialScope);
  const [name, setName] = useState(
    initialLabel?.name ?? suggestNexLabelName(
      initialScope,
      initialScope === "global" ? initialGlobalValue : initialLocalValue
    )
  );
  const [valueText, setValueText] = useState(
    formatNexLabelValue(initialScope === "global" ? initialGlobalValue : initialLocalValue)
  );
  const [searchText, setSearchText] = useState("");
  const [originalLabel, setOriginalLabel] = useState<NexLabelDialogLabel | undefined>(
    initialLabel
  );

  const parsedValue = useMemo(() => parseNexLabelValue(valueText), [valueText]);
  // --- Not memoized: cheap, and its message is in the display language, which can change
  const error = validateLabel(labels, originalLabel, scope, name, parsedValue);
  const filteredLabels = useMemo(
    () => filterLabels(labels, searchText),
    [labels, searchText]
  );

  const setScopeAndDefault = (nextScope: AnnotationLabelScope) => {
    const nextValue = nextScope === "global" ? initialGlobalValue : initialLocalValue;
    const nextLabel = findLabelAtValue(labels, nextScope, nextValue);
    setScope(nextScope);
    setOriginalLabel(nextLabel);
    setName(nextLabel?.name ?? suggestNexLabelName(nextScope, nextValue));
    setValueText(formatNexLabelValue(nextValue));
  };

  const loadLabel = (label: NexLabelDialogLabel) => {
    setScope(label.scope);
    setName(label.name);
    setValueText(formatNexLabelValue(label.value));
    setOriginalLabel(label);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (error || parsedValue === undefined) {
      return;
    }
    controls.close({
      action: "save",
      scope,
      name: name.trim(),
      value: parsedValue,
      originalLabel
    });
  };

  return (
    <form onSubmit={submit}>
      {/*
        * The same two names, in the same order, as the Labels list's scope filter. They were
        * "Global" / "Local to Bank 5" here against "Bank 5" / "Global" there — two namings and two
        * orders for one pair of concepts, in two dialogs that open one on top of the other.
        */}
      <DialogRow label={t("panels.next.field.scope")} rows={true}>
        <RadioGroup
          ariaLabel={t("panels.next.label.scopeAria")}
          columns={2}
          value={scope}
          options={[
            { value: "local", label: t("panels.next.scope.bank", { bank }) },
            { value: "global", label: t("panels.next.scope.global") }
          ]}
          onChange={(next) => setScopeAndDefault(next as "local" | "global")}
        />
      </DialogRow>
      <DialogRow label={t("panels.next.field.name")} rows={true}>
        <TextInput
          autoFocus
          maxLength={ANNOTATION_LABEL_MAX_LENGTH}
          value={name}
          onChange={(value) => setName(value.slice(0, ANNOTATION_LABEL_MAX_LENGTH))}
        />
      </DialogRow>
      <DialogRow label={t("panels.next.field.value")} rows={true}>
        {/* --- No `error` prop: this dialog validates the name and the value together and shows
            --- one message below both. Passing it here would render the same sentence twice. */}
        <TextInput value={valueText} onChange={setValueText} />
      </DialogRow>
      {/* --- `role="alert"`: a validation message rendered into a plain div is never
          --- announced, so a screen-reader user submits and the dialog appears to have
          --- ignored them. `BreakpointDialog` and `DialogField` both do this. */}
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      <DialogRow label={t("panels.next.label.existing")} rows={true}>
        <TextInput
          placeholder={t("panels.next.search.labels")}
          ariaLabel={t("panels.next.search.labels")}
          value={searchText}
          onChange={setSearchText}
        />
        <div className={styles.labelList}>
          {filteredLabels.map((label) => (
            <button
              className={styles.labelItem}
              key={`${label.scope}:${label.bank ?? ""}:${label.name}`}
              type="button"
              onClick={() => loadLabel(label)}
            >
              <span className={styles.labelName}>{label.name}</span>
              <span>{formatNexLabelValue(label.value)}</span>
              <span>{scopeText(label, bank)}</span>
              {/*
                * A count, as the Labels list shows for the same fact — but spelled out, because
                * this list has no column header to say what a bare number would mean.
                */}
              <span className={styles.labelRefs}>{formatReferenceCount(label)}</span>
            </button>
          ))}
          {filteredLabels.length === 0 && (
            <div className={styles.emptyList}>{t("panels.next.empty.noMatchingLabels")}</div>
          )}
        </div>
      </DialogRow>
      <DialogFooter>
        <Button text={t("panels.next.button.save")} type="submit" disabled={!!error} />
        <Button variant="secondary" text={t("common.button.cancel")} clicked={controls.cancel} />
        {originalLabel && (
          <>
            <DialogFooterSpacer />
            <Button
              text={t("panels.next.button.delete")}
              isDanger
              clicked={() => controls.close({
                action: "delete",
                scope: originalLabel.scope,
                name: originalLabel.name,
                value: originalLabel.value,
                originalLabel
              })}
            />
          </>
        )}
      </DialogFooter>
    </form>
  );
}

/** How many operands point at a label, in the same terms the Labels list counts them. */
function formatReferenceCount(label: NexLabelDialogLabel): string {
  const count = label.referenceCount ?? (label.referenced ? 1 : 0);
  return count > 0 ? t("panels.next.label.refs", { count }) : "";
}

/** A label's scope as the label lists show it: `Global`, or the bank it belongs to. */
export function scopeText(label: Pick<NexLabelDialogLabel, "scope" | "bank">, bank: number): string {
  return label.scope === "global"
    ? t("panels.next.scope.global")
    : t("panels.next.scope.bank", { bank: label.bank ?? bank });
}

export function suggestNexLabelName(scope: AnnotationLabelScope, value: number): string {
  return scope === "global" ? `L_${toHexa4(value)}` : `L_${toHexa4(value & ANNOTATION_BANK_LAST_OFFSET)}`;
}

export function formatNexLabelValue(value: number): string {
  return `$${toHexa4(value)}`;
}

export function parseNexLabelValue(valueText: string): number | undefined {
  const value = valueText.trim();
  if (!value) {
    return undefined;
  }

  let parsed: number;
  if (/^\$[0-9a-f]+$/i.test(value)) {
    parsed = parseInt(value.substring(1), 16);
  } else if (/^0x[0-9a-f]+$/i.test(value)) {
    parsed = parseInt(value.substring(2), 16);
  } else if (/^#[0-9a-f]+$/i.test(value)) {
    parsed = parseInt(value.substring(1), 16);
  } else if (/^[0-9a-f]+h$/i.test(value)) {
    parsed = parseInt(value.substring(0, value.length - 1), 16);
  } else if (/^[0-9]+$/.test(value)) {
    parsed = parseInt(value, 10);
  } else {
    return undefined;
  }
  return Number.isInteger(parsed) ? parsed : undefined;
}

function validateLabel(
  labels: NexLabelDialogLabel[],
  originalLabel: NexLabelDialogLabel | undefined,
  scope: AnnotationLabelScope,
  name: string,
  value: number | undefined
): string | undefined {
  const trimmedName = name.trim();
  if (!isValidLabelName(trimmedName)) {
    return t("panels.next.label.error.name", { max: ANNOTATION_LABEL_MAX_LENGTH });
  }
  if (value === undefined) {
    return t("panels.next.label.error.value");
  }
  const maxValue = scope === "global" ? 0xffff : ANNOTATION_BANK_LAST_OFFSET;
  if (value < 0 || value > maxValue) {
    return scope === "global"
      ? t("panels.next.label.error.globalRange")
      : t("panels.next.label.error.localRange");
  }
  const duplicate = labels.some((label) =>
    label.scope === scope &&
    label.name === trimmedName &&
    !isSameLabel(label, originalLabel)
  );
  return duplicate ? t("panels.next.label.error.duplicate") : undefined;
}

function filterLabels(labels: NexLabelDialogLabel[], searchText: string): NexLabelDialogLabel[] {
  const normalizedSearch = searchText.trim().toLowerCase();
  if (!normalizedSearch) {
    return labels;
  }
  return labels.filter((label) => {
    const searchValues = [
      label.name,
      formatNexLabelValue(label.value),
      label.value.toString(10),
      label.scope,
      label.scope === "local" ? `bank ${label.bank ?? ""}` : "global",
      // --- The scope as shown, too, so a search in the display language finds it
      label.scope === "local" && label.bank === undefined ? "" : scopeText(label, label.bank ?? 0)
    ];
    return searchValues.some((value) => value.toLowerCase().includes(normalizedSearch));
  });
}

function findLabelAtValue(
  labels: NexLabelDialogLabel[],
  scope: AnnotationLabelScope,
  value: number
): NexLabelDialogLabel | undefined {
  return labels.find((label) => label.scope === scope && label.value === value);
}

function isSameLabel(
  left: NexLabelDialogLabel,
  right: NexLabelDialogLabel | undefined
): boolean {
  return !!right &&
    left.scope === right.scope &&
    left.name === right.name &&
    left.value === right.value &&
    left.bank === right.bank;
}
