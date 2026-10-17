import { Fragment, useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@renderer/controls/Button";
import { TextInput } from "@renderer/controls/TextInput";
import { RadioGroup } from "@renderer/controls/RadioGroup";
import Dropdown, { type DropdownOption } from "@renderer/controls/Dropdown";
import { SmallIconButton } from "@renderer/controls/IconButton";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import {
  formatNexLabelValue,
  scopeText,
  type NexLabelDialogLabel
} from "./NexLabelDialog";
import type { AnnotationLabelScope } from "@renderer/appIde/annotations/programAnnotations";
import styles from "./NexLabelsDialog.module.scss";
import { t } from "@common/i18n/i18n";
import { useT } from "@common/i18n/useT";
import {
  DialogFooter,
  DialogFooterSpacer
} from "@renderer/controls/overlay/DialogFooter";

type NexLabelsScopeFilter = "all" | AnnotationLabelScope;
type NexLabelsSortMode = "address" | "name" | "references";

/** Built when drawn, so it follows the display language. */
const sortOptions = (): DropdownOption[] => [
  { value: "address", label: t("panels.next.labels.sort.address") },
  { value: "name", label: t("panels.next.labels.sort.name") },
  { value: "references", label: t("panels.next.labels.sort.references") }
];

/**
 * A message with `**bold**` and `` `code` `` markers, as elements.
 *
 * The intro is one translated passage with its emphasis inside it, so a translation can put the
 * emphasised words wherever its grammar wants them. Markdown-like markers rather than tags, because
 * the pseudo-locale accents a tag's letters but leaves `*` and `` ` `` alone.
 */
function renderMarkup(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

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
  onAddLabel: (scope: AnnotationLabelScope) => Promise<NexLabelDialogLabel[]>;
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
  const t = useT();
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
      <p className={styles.intro}>{renderMarkup(t("panels.next.labels.intro", { bank }))}</p>
      <DialogRow label={t("panels.next.field.scope")} rows={true}>
        <RadioGroup
          ariaLabel={t("panels.next.labels.scopeFilterAria")}
          columns={3}
          value={scopeFilter}
          options={[
            { value: "local", label: t("panels.next.scope.bank", { bank }) },
            { value: "global", label: t("panels.next.scope.global") },
            { value: "all", label: t("panels.next.scope.all") }
          ]}
          onChange={(next) => setScopeFilter(next as NexLabelsScopeFilter)}
        />
      </DialogRow>
      <div className={styles.toolbar}>
        <TextInput
          autoFocus
          placeholder={t("panels.next.search.labels")}
          ariaLabel={t("panels.next.search.labels")}
          value={searchText}
          onChange={setSearchText}
        />
        <Dropdown
          ariaLabel={t("panels.next.labels.sortAria")}
          options={sortOptions()}
          initialValue={sortMode}
          onChanged={(value) => setSortMode(value as NexLabelsSortMode)}
        />
      </div>
      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <span>{t("panels.next.field.scope")}</span>
          <span>{t("panels.next.field.name")}</span>
          <span>{t("panels.next.field.value")}</span>
          <span>{t("panels.next.labels.column.address")}</span>
          <span>{t("panels.next.labels.column.refs")}</span>
          <span />
        </div>
        {filteredLabels.map((label) => (
          <div className={styles.labelRow} key={getLabelKey(label)}>
            <span>{scopeText(label, bank)}</span>
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
                {t("panels.next.action.goTo")}
              </button>
              <SmallIconButton
                iconName="pencil"
                title={t("panels.next.labels.edit", { name: label.name })}
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
                title={t("panels.next.labels.delete", { name: label.name })}
                fill="--status-error"
                enable={!busy}
                clicked={() => void runAction(() => onDeleteLabel(label))}
              />
            </span>
          </div>
        ))}
        {filteredLabels.length === 0 && (
          <div className={styles.emptyList}>{t("panels.next.empty.noMatchingLabels")}</div>
        )}
      </div>
      <DialogFooter>
        <Button variant="secondary" text={t("common.button.close")} clicked={controls.cancel} />
        <DialogFooterSpacer />
        <Button
          text={t("panels.next.labels.addGlobal")}
          variant="secondary"
          disabled={busy}
          clicked={() => void runAction(() => onAddLabel("global"))}
        />
        <Button
          text={t("panels.next.labels.addBank")}
          variant="secondary"
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
    // --- The scope as shown, too, so a search in the display language finds it
    label.scope === "local" && label.bank === undefined ? "" : scopeText(label, label.bank ?? 0),
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
