import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@renderer/controls/Button";
import Dropdown, { type DropdownOption } from "@renderer/controls/Dropdown";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import {
  formatNexLabelValue,
  type NexLabelDialogLabel
} from "./NexLabelDialog";
import type { NexAnnotationLabelScope } from "./nexAnnotations";
import styles from "./NexLabelsDialog.module.scss";
import {
  DialogFooter,
  DialogFooterSpacer
} from "@renderer/controls/overlay/DialogFooter";

type NexLabelsScopeFilter = "all" | NexAnnotationLabelScope;
type NexLabelsSortMode = "address" | "name" | "references";

const sortOptions: DropdownOption[] = [
  { value: "address", label: "Address" },
  { value: "name", label: "Name" },
  { value: "references", label: "References" }
];

/**
 * Going to a label is the only thing that *ends* this dialog.
 *
 * Adding, editing and deleting all happen with the list still open — see `LabelAction` — so they
 * never travel back to the caller as a result. Navigating does: it scrolls the disassembly
 * underneath, and a list left open on top would cover the row it just moved to.
 */
export type NexLabelsDialogResult = { action: "go-to"; label: NexLabelDialogLabel };

/**
 * Runs one change against the annotations and answers with the list as it now stands.
 *
 * The dialog stays mounted while this runs, which is the whole point: the editor or the delete
 * confirmation it opens stacks *over* the list rather than replacing it, so the row you were
 * working on is still behind the dialog asking about it. The refreshed list comes back through the
 * return value because a managed dialog's props are captured when it opens — the caller cannot push
 * new ones in.
 */
export type LabelAction = () => Promise<NexLabelDialogLabel[]>;

export type NexLabelsDialogProps = DialogComponentProps<NexLabelsDialogResult> & {
  bank: number;
  bankAddressOffset: number;
  initialScope?: NexLabelsScopeFilter;
  labels: NexLabelDialogLabel[];
  onAddLabel: (scope: NexAnnotationLabelScope) => Promise<NexLabelDialogLabel[]>;
  onEditLabel: (label: NexLabelDialogLabel) => Promise<NexLabelDialogLabel[]>;
  onDeleteLabel: (label: NexLabelDialogLabel) => Promise<NexLabelDialogLabel[]>;
};

export function NexLabelsDialog({
  bank,
  bankAddressOffset,
  initialScope = "local",
  labels,
  onAddLabel,
  onEditLabel,
  onDeleteLabel,
  controls
}: NexLabelsDialogProps) {
  const [scopeFilter, setScopeFilter] = useState<NexLabelsScopeFilter>(initialScope);
  const [searchText, setSearchText] = useState("");
  const [sortMode, setSortMode] = useState<NexLabelsSortMode>("address");
  /*
   * The list is state, not the prop, because it outlives the changes made to it. The prop is only
   * the starting point; every action hands back the list as it now stands.
   */
  const [currentLabels, setCurrentLabels] = useState(labels);
  /*
   * One child dialog at a time. Without this, a double-click on Edit opens two editors on the same
   * label, and the second would be applied over whatever the first decided.
   *
   * The ref is the guard and the state only disables the buttons: a second click has to be refused
   * the moment it arrives, not once React has re-rendered with the flag set.
   */
  const runningRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const filteredLabels = useMemo(
    () => filterAndSortLabels(currentLabels, scopeFilter, searchText, sortMode, bankAddressOffset),
    [bankAddressOffset, currentLabels, scopeFilter, searchText, sortMode]
  );

  const runAction = useCallback(async (action: LabelAction) => {
    if (runningRef.current) return;
    runningRef.current = true;
    setBusy(true);
    try {
      setCurrentLabels(await action());
    } finally {
      runningRef.current = false;
      setBusy(false);
    }
  }, []);

  return (
    <div>
      <p className={styles.intro}>
        A <strong>bank label</strong> names an address inside bank {bank} alone, so two banks can
        each have their own <code>Start</code>. A <strong>global label</strong> names a 16-bit
        address anywhere in memory and is visible from every bank.
      </p>
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
        <Dropdown
          ariaLabel="Sort labels"
          options={sortOptions}
          initialValue={sortMode}
          onChanged={(value) => setSortMode(value as NexLabelsSortMode)}
        />
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
              {/*
                * "Go To" keeps its words: it is the one action here that navigates away, it has no
                * glyph anyone would read unaided, and it is what most rows are clicked for. The two
                * that manage the label are icons — recognisable, and the pair takes the width a
                * single spelled-out "Delete" used to.
                */}
              <button
                className={styles.actionButton}
                type="button"
                onClick={() => controls.close({ action: "go-to", label })}
              >
                Go To
              </button>
              <SmallIconButton
                iconName="pencil"
                title={`Edit ${label.name}`}
                fill="--color-command-icon"
                enable={!busy}
                clicked={() => void runAction(() => onEditLabel(label))}
              />
              {/*
                * The danger hue is on the glyph, not on a background: the row already carries a
                * zebra stripe and a hover wash, and a filled red button in every row would read as
                * an alert list rather than a label list.
                */}
              <SmallIconButton
                iconName="trash"
                title={`Delete ${label.name}`}
                fill="--status-error"
                enable={!busy}
                clicked={() => void runAction(() => onDeleteLabel(label))}
              />
            </span>
          </div>
        ))}
        {filteredLabels.length === 0 && (
          <div className={styles.emptyList}>No matching labels</div>
        )}
      </div>
      <DialogFooter>
        <Button text="Close" clicked={controls.cancel} />
        <DialogFooterSpacer />
        <Button
          text="Add Global Label"
          disabled={busy}
          clicked={() => void runAction(() => onAddLabel("global"))}
        />
        <Button
          text="Add Bank Label"
          disabled={busy}
          clicked={() => void runAction(() => onAddLabel("local"))}
        />
      </DialogFooter>
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
