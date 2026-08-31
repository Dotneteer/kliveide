import { useMemo, useState } from "react";
import { Button } from "@renderer/controls/Button";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import {
  formatNexLabelValue,
  type NexLabelDialogLabel
} from "./NexLabelDialog";
import type { NexAnnotationLabelScope } from "./nexAnnotations";
import styles from "./NexLabelsDialog.module.scss";

type NexLabelsScopeFilter = "all" | NexAnnotationLabelScope;
type NexLabelsSortMode = "address" | "name" | "references";

export type NexLabelsDialogResult =
  | { action: "add"; scope: NexAnnotationLabelScope }
  | { action: "edit"; label: NexLabelDialogLabel }
  | { action: "delete"; label: NexLabelDialogLabel }
  | { action: "go-to"; label: NexLabelDialogLabel };

export type NexLabelsDialogProps = DialogComponentProps<NexLabelsDialogResult> & {
  bank: number;
  bankAddressOffset: number;
  initialScope?: NexLabelsScopeFilter;
  labels: NexLabelDialogLabel[];
};

export function NexLabelsDialog({
  bank,
  bankAddressOffset,
  initialScope = "local",
  labels,
  controls
}: NexLabelsDialogProps) {
  const [scopeFilter, setScopeFilter] = useState<NexLabelsScopeFilter>(initialScope);
  const [searchText, setSearchText] = useState("");
  const [sortMode, setSortMode] = useState<NexLabelsSortMode>("address");
  const filteredLabels = useMemo(
    () => filterAndSortLabels(labels, scopeFilter, searchText, sortMode, bankAddressOffset),
    [bankAddressOffset, labels, scopeFilter, searchText, sortMode]
  );

  return (
    <div>
      <DialogRow label="Scope" rows={true}>
        <div className={styles.scopeOptions}>
          <label className={styles.scopeOption}>
            <input
              type="radio"
              name="nex-labels-scope"
              checked={scopeFilter === "local"}
              onChange={() => setScopeFilter("local")}
            />
            Bank {bank}
          </label>
          <label className={styles.scopeOption}>
            <input
              type="radio"
              name="nex-labels-scope"
              checked={scopeFilter === "global"}
              onChange={() => setScopeFilter("global")}
            />
            Global
          </label>
          <label className={styles.scopeOption}>
            <input
              type="radio"
              name="nex-labels-scope"
              checked={scopeFilter === "all"}
              onChange={() => setScopeFilter("all")}
            />
            All
          </label>
        </div>
      </DialogRow>
      <div className={styles.toolbar}>
        <input
          autoFocus
          className={styles.search}
          placeholder="Search labels"
          spellCheck={false}
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
        <select
          className={styles.sort}
          aria-label="Sort labels"
          value={sortMode}
          onChange={(event) => setSortMode(event.target.value as NexLabelsSortMode)}
        >
          <option value="address">Address</option>
          <option value="name">Name</option>
          <option value="references">References</option>
        </select>
      </div>
      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <span>Scope</span>
          <span>Name</span>
          <span>Value</span>
          <span>Address</span>
          <span>Refs</span>
          <span />
        </div>
        {filteredLabels.map((label) => (
          <div className={styles.labelRow} key={getLabelKey(label)}>
            <span>{label.scope === "global" ? "Global" : `Bank ${label.bank ?? bank}`}</span>
            <span className={styles.labelName} title={label.name}>{label.name}</span>
            <span>{formatNexLabelValue(label.value)}</span>
            <span className={label.scope === "global" ? styles.muted : undefined}>
              {label.scope === "local"
                ? formatNexLabelValue(getLocalEffectiveAddress(label, bankAddressOffset))
                : "-"}
            </span>
            <span>{label.referenceCount ?? (label.referenced ? 1 : 0)}</span>
            <span className={styles.actions}>
              <button
                className={styles.actionButton}
                type="button"
                onClick={() => controls.close({ action: "go-to", label })}
              >
                Go To
              </button>
              <button
                className={styles.actionButton}
                type="button"
                onClick={() => controls.close({ action: "edit", label })}
              >
                Edit
              </button>
              <button
                className={styles.actionButton}
                type="button"
                onClick={() => controls.close({ action: "delete", label })}
              >
                Delete
              </button>
            </span>
          </div>
        ))}
        {filteredLabels.length === 0 && (
          <div className={styles.emptyList}>No matching labels</div>
        )}
      </div>
      <footer className={styles.footer}>
        <Button text="Close" clicked={controls.cancel} />
        <div className={styles.footerSpacer} />
        <Button
          text="Add Global"
          clicked={() => controls.close({ action: "add", scope: "global" })}
        />
        <Button
          text="Add Bank Label"
          clicked={() => controls.close({ action: "add", scope: "local" })}
        />
      </footer>
    </div>
  );
}

function filterAndSortLabels(
  labels: NexLabelDialogLabel[],
  scopeFilter: NexLabelsScopeFilter,
  searchText: string,
  sortMode: NexLabelsSortMode,
  bankAddressOffset: number
): NexLabelDialogLabel[] {
  const trimmedSearch = searchText.trim().toLowerCase();
  const filtered = labels.filter((label) =>
    (scopeFilter === "all" || label.scope === scopeFilter) &&
    matchesSearch(label, trimmedSearch, bankAddressOffset)
  );
  return [...filtered].sort((left, right) => compareLabels(left, right, sortMode, bankAddressOffset));
}

function matchesSearch(
  label: NexLabelDialogLabel,
  searchText: string,
  bankAddressOffset: number
): boolean {
  if (!searchText) {
    return true;
  }
  const effectiveAddress = label.scope === "local"
    ? formatNexLabelValue(getLocalEffectiveAddress(label, bankAddressOffset))
    : "";
  return [
    label.name,
    label.scope,
    label.scope === "local" ? `bank ${label.bank ?? ""}` : "global",
    formatNexLabelValue(label.value),
    String(label.value),
    effectiveAddress
  ].some((value) => value.toLowerCase().includes(searchText));
}

function compareLabels(
  left: NexLabelDialogLabel,
  right: NexLabelDialogLabel,
  sortMode: NexLabelsSortMode,
  bankAddressOffset: number
): number {
  if (sortMode === "name") {
    return left.name.localeCompare(right.name) || compareLabelAddresses(left, right, bankAddressOffset);
  }
  if (sortMode === "references") {
    return (
      (right.referenceCount ?? 0) -
      (left.referenceCount ?? 0)
    ) || left.name.localeCompare(right.name);
  }
  return compareLabelAddresses(left, right, bankAddressOffset) || left.name.localeCompare(right.name);
}

function compareLabelAddresses(
  left: NexLabelDialogLabel,
  right: NexLabelDialogLabel,
  bankAddressOffset: number
): number {
  return getSortAddress(left, bankAddressOffset) - getSortAddress(right, bankAddressOffset);
}

function getSortAddress(label: NexLabelDialogLabel, bankAddressOffset: number): number {
  return label.scope === "local"
    ? getLocalEffectiveAddress(label, bankAddressOffset)
    : label.value;
}

function getLocalEffectiveAddress(label: NexLabelDialogLabel, bankAddressOffset: number): number {
  return (bankAddressOffset + label.value) & 0xffff;
}

function getLabelKey(label: NexLabelDialogLabel): string {
  return `${label.scope}:${label.bank ?? ""}:${label.name}:${label.value}`;
}
