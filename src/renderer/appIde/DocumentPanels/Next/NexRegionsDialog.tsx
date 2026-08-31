import { useMemo, useState } from "react";
import classnames from "classnames";
import { Button } from "@renderer/controls/Button";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import {
  NEX_BANK_LAST_OFFSET,
  type NexAnnotationRegion,
  type NexAnnotationRegionType
} from "./nexAnnotations";
import {
  formatRegionOffset,
  formatRegionPreview
} from "./NexRegionDialog";
import styles from "./NexRegionsDialog.module.scss";

type NexRegionTypeFilter = "all" | NexAnnotationRegionType;

export type NexRegionsDialogResult =
  | { action: "add" }
  | { action: "edit"; region: NexAnnotationRegion }
  | { action: "split"; region: NexAnnotationRegion }
  | { action: "revert"; region: NexAnnotationRegion }
  | { action: "go-to"; region: NexAnnotationRegion };

export type NexRegionsDialogProps = DialogComponentProps<NexRegionsDialogResult> & {
  activeOffset?: number;
  bytes: number[];
  regions: NexAnnotationRegion[];
};

const REGION_TYPE_OPTIONS: Array<{ value: NexRegionTypeFilter; label: string }> = [
  { value: "all", label: "All Types" },
  { value: "disassemble", label: "Disassembly" },
  { value: "bytes", label: "Bytes" },
  { value: "words", label: "Words" },
  { value: "skip", label: "Skip" }
];

export function NexRegionsDialog({
  activeOffset,
  bytes,
  regions,
  controls
}: NexRegionsDialogProps) {
  const sortedRegions = useMemo(
    () => [...regions].sort((left, right) => left.start - right.start),
    [regions]
  );
  const initialRegion = useMemo(
    () => findRegionAtOffset(sortedRegions, activeOffset) ?? sortedRegions[0],
    [activeOffset, sortedRegions]
  );
  const [selectedRegionKey, setSelectedRegionKey] = useState(
    initialRegion ? getRegionKey(initialRegion) : ""
  );
  const [searchText, setSearchText] = useState("");
  const [typeFilter, setTypeFilter] = useState<NexRegionTypeFilter>("all");
  const filteredRegions = useMemo(
    () => filterRegions(sortedRegions, searchText, typeFilter),
    [searchText, sortedRegions, typeFilter]
  );
  const selectedRegion = useMemo(
    () => sortedRegions.find((region) => getRegionKey(region) === selectedRegionKey),
    [selectedRegionKey, sortedRegions]
  );

  return (
    <div>
      <div className={styles.toolbar}>
        <input
          autoFocus
          className={styles.search}
          placeholder="Search regions"
          spellCheck={false}
          value={searchText}
          onChange={(event) => setSearchText(event.target.value)}
        />
        <select
          className={styles.typeFilter}
          aria-label="Filter region type"
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as NexRegionTypeFilter)}
        >
          {REGION_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div className={styles.table}>
        <div className={styles.tableHeader}>
          <span>Start</span>
          <span>End</span>
          <span>Length</span>
          <span>Type</span>
          <span>Lines</span>
          <span />
        </div>
        {filteredRegions.map((region) => {
          const selected = getRegionKey(region) === selectedRegionKey;
          return (
            <div
              className={classnames(styles.regionRow, { [styles.selected]: selected })}
              key={getRegionKey(region)}
              onClick={() => setSelectedRegionKey(getRegionKey(region))}
            >
              <span>{formatRegionOffset(region.start)}</span>
              <span>{formatRegionOffset(region.end)}</span>
              <span>{formatRegionLength(region)}</span>
              <span className={styles.type}>{formatRegionType(region.type)}</span>
              <span className={styles.muted}>{estimateRegionLineCount(region)}</span>
              <span className={styles.actions}>
                <button
                  className={styles.actionButton}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    controls.close({ action: "go-to", region });
                  }}
                >
                  Go To
                </button>
                <button
                  className={styles.actionButton}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    controls.close({ action: "edit", region });
                  }}
                >
                  Edit
                </button>
                <button
                  className={styles.actionButton}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    controls.close({ action: "split", region });
                  }}
                >
                  Split
                </button>
                <button
                  className={styles.actionButton}
                  disabled={region.type === "disassemble"}
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    controls.close({ action: "revert", region });
                  }}
                >
                  Revert
                </button>
              </span>
            </div>
          );
        })}
        {filteredRegions.length === 0 && (
          <div className={styles.emptyList}>No matching regions</div>
        )}
      </div>
      <DialogRow label="Preview" rows={true}>
        <div className={styles.preview} aria-label="Region preview">
          {selectedRegion
            ? formatRegionPreview(selectedRegion.type, selectedRegion.start, selectedRegion.end, bytes)
            : ""}
        </div>
      </DialogRow>
      <footer className={styles.footer}>
        <Button text="Close" clicked={controls.cancel} />
        <div className={styles.footerSpacer} />
        <Button text="Add Region" clicked={() => controls.close({ action: "add" })} />
      </footer>
    </div>
  );
}

function filterRegions(
  regions: NexAnnotationRegion[],
  searchText: string,
  typeFilter: NexRegionTypeFilter
): NexAnnotationRegion[] {
  const normalizedSearch = searchText.trim().toLowerCase();
  return regions.filter((region) =>
    (typeFilter === "all" || region.type === typeFilter) &&
    matchesSearch(region, normalizedSearch)
  );
}

function matchesSearch(region: NexAnnotationRegion, searchText: string): boolean {
  if (!searchText) {
    return true;
  }
  return [
    formatRegionOffset(region.start),
    formatRegionOffset(region.end),
    String(region.start),
    String(region.end),
    formatRegionType(region.type),
    region.type
  ].some((value) => value.toLowerCase().includes(searchText));
}

function findRegionAtOffset(
  regions: NexAnnotationRegion[],
  offset: number | undefined
): NexAnnotationRegion | undefined {
  return offset === undefined
    ? undefined
    : regions.find((region) => region.start <= offset && region.end >= offset);
}

function formatRegionLength(region: NexAnnotationRegion): string {
  const length = region.end - region.start + 1;
  return `${formatRegionOffset(length)} (${length})`;
}

function formatRegionType(type: NexAnnotationRegionType): string {
  return type === "disassemble" ? "disassembly" : type;
}

function estimateRegionLineCount(region: NexAnnotationRegion): string {
  const length = region.end - region.start + 1;
  switch (region.type) {
    case "bytes":
    case "words":
      return String(Math.ceil(length / 4));
    case "skip":
      return "1";
    default:
      return `<= ${Math.min(length, NEX_BANK_LAST_OFFSET + 1)}`;
  }
}

function getRegionKey(region: NexAnnotationRegion): string {
  return `${region.start}:${region.end}:${region.type}`;
}
