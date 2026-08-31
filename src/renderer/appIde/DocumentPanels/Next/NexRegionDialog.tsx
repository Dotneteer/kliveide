import { FormEvent, useMemo, useState } from "react";
import { Button } from "@renderer/controls/Button";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import { toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import {
  NEX_BANK_LAST_OFFSET,
  type NexAnnotationRegion,
  type NexAnnotationRegionType
} from "./nexAnnotations";
import { parseNexLabelValue } from "./NexLabelDialog";
import styles from "./NexRegionDialog.module.scss";

export type NexRegionDialogResult = {
  type: NexAnnotationRegionType;
  start: number;
  end: number;
};

export type NexRegionDialogProps = DialogComponentProps<NexRegionDialogResult> & {
  initialType: NexAnnotationRegionType;
  initialStart: number;
  initialEnd: number;
  regions: NexAnnotationRegion[];
  bytes: number[];
};

const REGION_TYPES: Array<{ value: NexAnnotationRegionType; label: string }> = [
  { value: "disassemble", label: "Disassembly" },
  { value: "bytes", label: "Bytes" },
  { value: "words", label: "Words" },
  { value: "skip", label: "Skip" }
];

export function NexRegionDialog({
  initialType,
  initialStart,
  initialEnd,
  regions,
  bytes,
  controls
}: NexRegionDialogProps) {
  const [type, setType] = useState<NexAnnotationRegionType>(initialType);
  const [startText, setStartText] = useState(formatRegionOffset(initialStart));
  const [endText, setEndText] = useState(formatRegionOffset(initialEnd));
  const start = useMemo(() => parseNexLabelValue(startText), [startText]);
  const end = useMemo(() => parseNexLabelValue(endText), [endText]);
  const length = start !== undefined && end !== undefined && start <= end
    ? end - start + 1
    : undefined;
  const affectedRegions = useMemo(
    () => start !== undefined && end !== undefined && start <= end
      ? getAffectedRegions(regions, start, end)
      : [],
    [end, regions, start]
  );
  const error = useMemo(
    () => validateRegion(type, start, end),
    [end, start, type]
  );
  const preview = useMemo(
    () => start !== undefined && end !== undefined && start <= end
      ? formatRegionPreview(type, start, end, bytes)
      : "",
    [bytes, end, start, type]
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (error || start === undefined || end === undefined) {
      return;
    }
    controls.close({ type, start, end });
  };

  return (
    <form onSubmit={submit}>
      <DialogRow label="Type" rows={true}>
        <div className={styles.typeOptions}>
          {REGION_TYPES.map((regionType) => (
            <label className={styles.typeOption} key={regionType.value}>
              <input
                type="radio"
                name="nex-region-type"
                checked={type === regionType.value}
                onChange={() => setType(regionType.value)}
              />
              {regionType.label}
            </label>
          ))}
        </div>
      </DialogRow>
      <DialogRow label="Start offset" rows={true}>
        <input
          autoFocus
          className={styles.input}
          spellCheck={false}
          value={startText}
          onChange={(event) => setStartText(event.target.value)}
        />
      </DialogRow>
      <DialogRow label="End offset" rows={true}>
        <div className={styles.rangeInputRow}>
          <input
            className={styles.input}
            spellCheck={false}
            value={endText}
            onChange={(event) => setEndText(event.target.value)}
          />
          <Button
            text="Entire bank"
            clicked={() => {
              setStartText(formatRegionOffset(0));
              setEndText(formatRegionOffset(NEX_BANK_LAST_OFFSET));
            }}
          />
        </div>
      </DialogRow>
      <DialogRow label="Length" rows={true}>
        <div className={styles.readOnlyValue}>
          {length !== undefined ? `${formatRegionOffset(length)} (${length})` : ""}
        </div>
      </DialogRow>
      {error && <div className={styles.error}>{error}</div>}
      <DialogRow label="Affected regions" rows={true}>
        <div className={styles.regionList}>
          {affectedRegions.map((region) => (
            <div className={styles.regionItem} key={`${region.start}:${region.end}:${region.type}`}>
              <span>{formatRegionOffset(region.start)}</span>
              <span>{formatRegionOffset(region.end)}</span>
              <span>{formatRegionLength(region)}</span>
              <span>{region.type}</span>
              <span>{describeRegionEffect(region, start!, end!, type)}</span>
            </div>
          ))}
          {affectedRegions.length === 0 && (
            <div className={styles.emptyList}>No affected regions</div>
          )}
        </div>
      </DialogRow>
      <DialogRow label="Preview" rows={true}>
        <div className={styles.preview} aria-label="Region preview">
          {preview}
        </div>
      </DialogRow>
      <footer className={styles.footer}>
        <Button text="Save" type="submit" disabled={!!error} />
        <Button text="Cancel" clicked={controls.cancel} />
      </footer>
    </form>
  );
}

export function formatRegionOffset(value: number): string {
  return `$${toHexa4(value)}`;
}

export function formatRegionPreview(
  type: NexAnnotationRegionType,
  start: number,
  end: number,
  bytes: number[]
): string {
  const length = end - start + 1;
  switch (type) {
    case "bytes":
      return createPreviewLines(start, end, 4, (offset, values) =>
        `${formatRegionOffset(offset)}  .defb ${values.map((value) => `$${toHexa2(value)}`).join(", ")}`
      );
    case "words":
      return createPreviewLines(start, end, 4, (offset, values) => {
        const words: string[] = [];
        for (let i = 0; i + 1 < values.length; i += 2) {
          words.push(`$${toHexa4(values[i] | (values[i + 1] << 8))}`);
        }
        return `${formatRegionOffset(offset)}  .defw ${words.join(", ")}`;
      });
    case "skip":
      return `${formatRegionOffset(start)}  .skip ${formatRegionOffset(length)}`;
    default:
      return `${formatRegionOffset(start)}  Z80 disassembly, ${formatRegionOffset(length)} bytes`;
  }

  function createPreviewLines(
    firstOffset: number,
    lastOffset: number,
    step: number,
    createLine: (offset: number, values: number[]) => string
  ) {
    const lines: string[] = [];
    for (let offset = firstOffset; offset <= lastOffset && lines.length < 4; offset += step) {
      const values = bytes.slice(offset, Math.min(offset + step, lastOffset + 1));
      lines.push(createLine(offset, values));
    }
    if (firstOffset + step * 4 <= lastOffset) {
      lines.push("...");
    }
    return lines.join("\n");
  }
}

function validateRegion(
  type: NexAnnotationRegionType,
  start: number | undefined,
  end: number | undefined
): string | undefined {
  if (start === undefined || end === undefined) {
    return "Enter hexadecimal or decimal offsets.";
  }
  if (start < 0 || start > NEX_BANK_LAST_OFFSET || end < 0 || end > NEX_BANK_LAST_OFFSET) {
    return "Offsets must be in $0000..$3FFF.";
  }
  if (start > end) {
    return "Start offset must be less than or equal to end offset.";
  }
  if (type === "words" && (end - start + 1) % 2 !== 0) {
    return "Word regions must contain an even number of bytes.";
  }
  return undefined;
}

function getAffectedRegions(
  regions: NexAnnotationRegion[],
  start: number,
  end: number
): NexAnnotationRegion[] {
  return regions.filter((region) => region.start <= end && region.end >= start);
}

function formatRegionLength(region: NexAnnotationRegion): string {
  const length = region.end - region.start + 1;
  return `${formatRegionOffset(length)} (${length})`;
}

function describeRegionEffect(
  region: NexAnnotationRegion,
  start: number,
  end: number,
  type: NexAnnotationRegionType
): string {
  if (region.start >= start && region.end <= end) {
    return region.type === type ? "unchanged" : "replace";
  }
  return "split";
}
