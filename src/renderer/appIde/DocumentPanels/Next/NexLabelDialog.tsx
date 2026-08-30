import { FormEvent, useMemo, useState } from "react";
import { Button } from "@renderer/controls/Button";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import { toHexa4 } from "@renderer/appIde/services/ide-commands";
import {
  isValidNexLabelName,
  NEX_BANK_LAST_OFFSET,
  NEX_LABEL_MAX_LENGTH,
  type NexAnnotationLabelScope
} from "./nexAnnotations";
import styles from "./NexLabelDialog.module.scss";

export type NexLabelDialogLabel = {
  scope: NexAnnotationLabelScope;
  bank?: number;
  name: string;
  value: number;
  referenced?: boolean;
};

export type NexLabelDialogResult = {
  action: "save" | "delete";
  scope: NexAnnotationLabelScope;
  name: string;
  value: number;
  originalLabel?: NexLabelDialogLabel;
};

export type NexLabelDialogProps = DialogComponentProps<NexLabelDialogResult> & {
  bank: number;
  initialScope: NexAnnotationLabelScope;
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
  const initialLabel = useMemo(
    () => findLabelAtValue(labels, initialScope, initialScope === "global"
      ? initialGlobalValue
      : initialLocalValue),
    [initialGlobalValue, initialLocalValue, initialScope, labels]
  );
  const [scope, setScope] = useState<NexAnnotationLabelScope>(initialScope);
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
  const error = useMemo(
    () => validateLabel(labels, originalLabel, scope, name, parsedValue),
    [labels, name, originalLabel, parsedValue, scope]
  );
  const filteredLabels = useMemo(
    () => filterLabels(labels, searchText),
    [labels, searchText]
  );

  const setScopeAndDefault = (nextScope: NexAnnotationLabelScope) => {
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
      <DialogRow label="Scope" rows={true}>
        <div className={styles.scopeOptions}>
          <label className={styles.scopeOption}>
            <input
              type="radio"
              name="nex-label-scope"
              checked={scope === "global"}
              onChange={() => setScopeAndDefault("global")}
            />
            Global
          </label>
          <label className={styles.scopeOption}>
            <input
              type="radio"
              name="nex-label-scope"
              checked={scope === "local"}
              onChange={() => setScopeAndDefault("local")}
            />
            Local to Bank {bank}
          </label>
        </div>
      </DialogRow>
      <DialogRow label="Name" rows={true}>
        <input
          autoFocus
          className={styles.input}
          spellCheck={false}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </DialogRow>
      <DialogRow label="Value" rows={true}>
        <input
          className={styles.input}
          spellCheck={false}
          value={valueText}
          onChange={(event) => setValueText(event.target.value)}
        />
      </DialogRow>
      {error && <div className={styles.error}>{error}</div>}
      <DialogRow label="Existing labels" rows={true}>
        <input
          className={styles.search}
          placeholder="Search labels"
          spellCheck={false}
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
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
              <span>{label.scope === "global" ? "Global" : `Bank ${label.bank ?? bank}`}</span>
              <span>{label.referenced ? "referenced" : ""}</span>
            </button>
          ))}
          {filteredLabels.length === 0 && (
            <div className={styles.emptyList}>No matching labels</div>
          )}
        </div>
      </DialogRow>
      <footer className={styles.footer}>
        <Button text="Save" type="submit" disabled={!!error} />
        <Button text="Cancel" clicked={controls.cancel} />
        {originalLabel && (
          <>
            <div className={styles.footerSpacer} />
            <Button
              text="Delete"
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
      </footer>
    </form>
  );
}

export function suggestNexLabelName(scope: NexAnnotationLabelScope, value: number): string {
  return scope === "global" ? `L_${toHexa4(value)}` : `L_${toHexa4(value & NEX_BANK_LAST_OFFSET)}`;
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
  scope: NexAnnotationLabelScope,
  name: string,
  value: number | undefined
): string | undefined {
  const trimmedName = name.trim();
  if (!isValidNexLabelName(trimmedName)) {
    return `Use an identifier name up to ${NEX_LABEL_MAX_LENGTH} characters.`;
  }
  if (value === undefined) {
    return "Enter a hexadecimal or decimal value.";
  }
  const maxValue = scope === "global" ? 0xffff : NEX_BANK_LAST_OFFSET;
  if (value < 0 || value > maxValue) {
    return scope === "global"
      ? "Global label values must be in $0000..$FFFF."
      : "Local label values must be in $0000..$3FFF.";
  }
  const duplicate = labels.some((label) =>
    label.scope === scope &&
    label.name === trimmedName &&
    !isSameLabel(label, originalLabel)
  );
  return duplicate ? "A label with this name already exists in this scope." : undefined;
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
      label.scope === "local" ? `bank ${label.bank ?? ""}` : "global"
    ];
    return searchValues.some((value) => value.toLowerCase().includes(normalizedSearch));
  });
}

function findLabelAtValue(
  labels: NexLabelDialogLabel[],
  scope: NexAnnotationLabelScope,
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
