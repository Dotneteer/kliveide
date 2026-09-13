import { useEffect, useMemo, useState } from "react";
import classnames from "classnames";
import { Button } from "@renderer/controls/Button";
import Dropdown, { type DropdownOption } from "@renderer/controls/Dropdown";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import {
  NEX_BANK_LAST_OFFSET,
  type NexAnnotationRegion,
  type NexAnnotationRegionType
} from "./nexAnnotations";
import {
  createRegionPreview,
  formatRegionOffset
} from "./NexRegionDialog";
import { parseNexLabelValue } from "./NexLabelDialog";
import styles from "./NexRegionsDialog.module.scss";
import {
  DialogFooter,
  DialogFooterSpacer
} from "@renderer/controls/overlay/DialogFooter";

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

const REGION_TYPE_OPTIONS: DropdownOption[] = [
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
  /*
   * An address, not free text.
   *
   * This was a search box matching the start offset, the end offset and the type name. The type
   * half was already served by the filter beside it, and the offset half only ever matched a
   * region's own boundaries — so finding the region covering $1A00 meant knowing where it started,
   * which is the thing you opened this dialog to find out. Regions tile the bank without gaps, so
   * "which region is this address in" is the only lookup there is, and now it is the one on offer.
   */
  const [findText, setFindText] = useState("");
  const findAddress = useMemo(() => parseNexLabelValue(findText), [findText]);
  const findIsInvalid = findText.trim().length > 0 && findAddress === undefined;
  const [typeFilter, setTypeFilter] = useState<NexRegionTypeFilter>("all");
  const filteredRegions = useMemo(
    () => filterRegions(sortedRegions, findAddress, typeFilter),
    [findAddress, sortedRegions, typeFilter]
  );
  /*
   * Narrowing to exactly one region selects it, so the preview below shows what you looked for
   * rather than whatever was selected before you typed.
   */
  const onlyMatchKey = filteredRegions.length === 1
    ? getRegionKey(filteredRegions[0])
    : undefined;
  useEffect(() => {
    if (onlyMatchKey) {
      setSelectedRegionKey(onlyMatchKey);
    }
  }, [onlyMatchKey]);
  const selectedRegion = useMemo(
    () => sortedRegions.find((region) => getRegionKey(region) === selectedRegionKey),
    [selectedRegionKey, sortedRegions]
  );

  // --- Awaited: a `disassemble` region is previewed by really disassembling it.
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (!selectedRegion) {
      setPreview("");
      return undefined;
    }
    let cancelled = false;
    void createRegionPreview(
      selectedRegion.type,
      selectedRegion.start,
      selectedRegion.end,
      bytes
    ).then((text) => {
      if (!cancelled) setPreview(text);
    });
    return () => {
      cancelled = true;
    };
  }, [bytes, selectedRegion]);

  return (
    <div>
      <div className={styles.toolbar}>
        <input
          autoFocus
          aria-invalid={findIsInvalid}
          aria-label="Find the region covering an address"
          className={classnames(styles.search, { [styles.invalid]: findIsInvalid })}
          placeholder="Find address, e.g. $1A00"
          spellCheck={false}
          value={findText}
          onChange={(event) => setFindText(event.target.value)}
        />
        {/* The app's own dropdown, as the Labels list's sort control uses. */}
        <Dropdown
          ariaLabel="Filter region type"
          options={REGION_TYPE_OPTIONS}
          initialValue={typeFilter}
          onChanged={(value) => setTypeFilter(value as NexRegionTypeFilter)}
        />
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
              role="button"
              tabIndex={0}
              aria-pressed={selected}
              onClick={() => setSelectedRegionKey(getRegionKey(region))}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedRegionKey(getRegionKey(region));
                }
              }}
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
          {preview}
        </div>
      </DialogRow>
      <DialogFooter>
        <Button text="Close" clicked={controls.cancel} />
        <DialogFooterSpacer />
        <Button text="Add Region" clicked={() => controls.close({ action: "add" })} />
      </DialogFooter>
    </div>
  );
}

function filterRegions(
  regions: NexAnnotationRegion[],
  findAddress: number | undefined,
  typeFilter: NexRegionTypeFilter
): NexAnnotationRegion[] {
  return regions.filter((region) =>
    (typeFilter === "all" || region.type === typeFilter) &&
    // --- Text that is not an address narrows nothing; the field says so instead.
    (findAddress === undefined || (region.start <= findAddress && findAddress <= region.end))
  );
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
