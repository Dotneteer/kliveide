import { useEffect, useMemo, useState } from "react";
import classnames from "classnames";
import { Button } from "@renderer/controls/Button";
import { TextInput } from "@renderer/controls/TextInput";
import Dropdown, { type DropdownOption } from "@renderer/controls/Dropdown";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import {
  ANNOTATION_BANK_LAST_OFFSET,
  type AnnotationRegion,
  type AnnotationRegionType
} from "@renderer/appIde/annotations/programAnnotations";
import {
  createRegionPreview,
  dmaTrimSuggestion,
  formatRegionOffset
} from "./NexRegionDialog";
import { parseNexLabelValue } from "./NexLabelDialog";
import styles from "./NexRegionsDialog.module.scss";
import {
  DialogFooter,
  DialogFooterSpacer
} from "@renderer/controls/overlay/DialogFooter";

type NexRegionTypeFilter = "all" | AnnotationRegionType;

export type NexRegionsDialogResult =
  | { action: "add" }
  | { action: "edit"; region: AnnotationRegion }
  | { action: "split"; region: AnnotationRegion }
  | { action: "revert"; region: AnnotationRegion }
  | { action: "go-to"; region: AnnotationRegion };

export type NexRegionsDialogProps = DialogComponentProps<NexRegionsDialogResult> & {
  activeOffset?: number;
  bytes: number[];
  regions: AnnotationRegion[];
};

const REGION_TYPE_OPTIONS: DropdownOption[] = [
  { value: "all", label: "All Types" },
  { value: "disassemble", label: "Disassembly" },
  { value: "bytes", label: "Bytes" },
  { value: "words", label: "Words" },
  { value: "copper", label: "Copper" },
  { value: "dma", label: "DMA" },
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

  // --- A DMA region ending in a long `$00` run: offer to edit it with the trimmed end (plan D8).
  const trimEnd = useMemo(
    () =>
      selectedRegion?.type === "dma"
        ? dmaTrimSuggestion(bytes, selectedRegion.start, selectedRegion.end)
        : undefined,
    [bytes, selectedRegion]
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
        {/* --- `error` drives both the invalid styling and `aria-invalid` inside `TextInput`, so
            --- the hand-rolled pair of those goes with the bare input. */}
        <TextInput
          autoFocus
          ariaLabel="Find the region covering an address"
          placeholder="Find address, e.g. $1A00"
          error={findIsInvalid ? "No region covers that address." : undefined}
          value={findText}
          onChange={setFindText}
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
      {selectedRegion && trimEnd !== undefined && (
        <div className={styles.hint} role="status">
          <span>{`Ends in ${selectedRegion.end - trimEnd} zero bytes, each listed as a WR2 write.`}</span>
          <Button
            text={`Trim to ${formatRegionOffset(trimEnd)}`}
            variant="secondary"
            clicked={() =>
              controls.close({ action: "edit", region: { ...selectedRegion, end: trimEnd } })
            }
          />
        </div>
      )}
      <DialogFooter>
        <Button variant="secondary" text="Close" clicked={controls.cancel} />
        <DialogFooterSpacer />
        <Button text="Add Region" clicked={() => controls.close({ action: "add" })} />
      </DialogFooter>
    </div>
  );
}

function filterRegions(
  regions: AnnotationRegion[],
  findAddress: number | undefined,
  typeFilter: NexRegionTypeFilter
): AnnotationRegion[] {
  return regions.filter((region) =>
    (typeFilter === "all" || region.type === typeFilter) &&
    // --- Text that is not an address narrows nothing; the field says so instead.
    (findAddress === undefined || (region.start <= findAddress && findAddress <= region.end))
  );
}

function findRegionAtOffset(
  regions: AnnotationRegion[],
  offset: number | undefined
): AnnotationRegion | undefined {
  return offset === undefined
    ? undefined
    : regions.find((region) => region.start <= offset && region.end >= offset);
}

function formatRegionLength(region: AnnotationRegion): string {
  const length = region.end - region.start + 1;
  return `${formatRegionOffset(length)} (${length})`;
}

function formatRegionType(type: AnnotationRegionType): string {
  return type === "disassemble" ? "disassembly" : type;
}

function estimateRegionLineCount(region: AnnotationRegion): string {
  const length = region.end - region.start + 1;
  switch (region.type) {
    case "bytes":
    case "words":
      return String(Math.ceil(length / 4));
    case "copper":
      return String(Math.ceil(length / 2));
    case "dma":
      return `<= ${length}`;
    case "skip":
      return "1";
    default:
      return `<= ${Math.min(length, ANNOTATION_BANK_LAST_OFFSET + 1)}`;
  }
}

function getRegionKey(region: AnnotationRegion): string {
  return `${region.start}:${region.end}:${region.type}`;
}
