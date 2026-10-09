import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@renderer/controls/Button";
import { TextInput } from "@renderer/controls/TextInput";
import { RadioGroup } from "@renderer/controls/RadioGroup";
import { DialogRow } from "@renderer/controls/DialogRow";
import { DialogComponentProps } from "@renderer/controls/overlay/DialogProvider";
import { toHexa2, toHexa4 } from "@renderer/appIde/services/ide-commands";
import {
  ANNOTATION_BANK_LAST_OFFSET,
  type AnnotationRegion,
  type AnnotationRegionType
} from "@renderer/appIde/annotations/programAnnotations";
import { parseNexLabelValue } from "./NexLabelDialog";
import { Z80Disassembler } from "@renderer/appIde/disassemblers/z80-disassembler/z80-disassembler";
import { MemorySection } from "@renderer/appIde/disassemblers/common-types";
import { MemorySectionType } from "@abstractions/MemorySection";
import styles from "./NexRegionDialog.module.scss";
import { DialogFooter } from "@renderer/controls/overlay/DialogFooter";
import { decodeCopperWord, formatCopperSource } from "@common/zxnext/copper/copperDecoder";
import { decodeDmaStream, formatDmaCommand } from "@common/zxnext/dma/dmaDecoder";

export type NexRegionDialogResult = {
  type: AnnotationRegionType;
  start: number;
  end: number;
};

export type NexRegionDialogProps = DialogComponentProps<NexRegionDialogResult> & {
  initialType: AnnotationRegionType;
  initialStart: number;
  initialEnd: number;
  regions: AnnotationRegion[];
  bytes: number[];
};

const REGION_TYPES: Array<{ value: AnnotationRegionType; label: string }> = [
  { value: "disassemble", label: "Disassembly" },
  { value: "bytes", label: "Bytes" },
  { value: "words", label: "Words" },
  { value: "copper", label: "Copper" },
  { value: "dma", label: "DMA" },
  { value: "text", label: "Text" },
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
  const [type, setType] = useState<AnnotationRegionType>(initialType);
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
  const hint = useMemo(
    () => (error ? undefined : regionHint(type, start!, end!, bytes)),
    [bytes, end, error, start, type]
  );
  /*
   * The preview is awaited, because previewing a `disassemble` region means really disassembling it.
   * The guard drops a result that arrives after the range has moved on — the user types into the
   * offset fields, so this re-runs on nearly every keystroke.
   */
  const [preview, setPreview] = useState("");
  useEffect(() => {
    if (start === undefined || end === undefined || start > end) {
      setPreview("");
      return undefined;
    }
    let cancelled = false;
    void createRegionPreview(type, start, end, bytes).then((text) => {
      if (!cancelled) setPreview(text);
    });
    return () => {
      cancelled = true;
    };
  }, [bytes, end, start, type]);

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
        <RadioGroup
          ariaLabel="Region type"
          columns={REGION_TYPES.length}
          value={type}
          options={REGION_TYPES.map((regionType) => ({
            value: regionType.value,
            label: regionType.label
          }))}
          onChange={(next) => setType(next as AnnotationRegion["type"])}
        />
      </DialogRow>
      <DialogRow label="Start offset" rows={true}>
        <TextInput autoFocus value={startText} onChange={setStartText} />
      </DialogRow>
      <DialogRow label="End offset" rows={true}>
        <div className={styles.rangeInputRow}>
          <TextInput value={endText} onChange={setEndText} />
          <Button
            text="Entire bank"
            variant="secondary"
            clicked={() => {
              setStartText(formatRegionOffset(0));
              setEndText(formatRegionOffset(ANNOTATION_BANK_LAST_OFFSET));
            }}
          />
        </div>
      </DialogRow>
      <DialogRow label="Length" rows={true}>
        <div className={styles.readOnlyValue}>
          {length !== undefined ? `${formatRegionOffset(length)} (${length})` : ""}
        </div>
      </DialogRow>
      {/* --- `role="alert"`: a validation message rendered into a plain div is never
          --- announced, so a screen-reader user submits and the dialog appears to have
          --- ignored them. `BreakpointDialog` and `DialogField` both do this. */}
      {error && (
        <div className={styles.error} role="alert">
          {error}
        </div>
      )}
      {/* --- Non-blocking: a suggestion the user may take or leave (plan D8). */}
      {hint && (
        <div className={styles.hint} role="status">
          <span>{hint.text}</span>
          {hint.trimEnd !== undefined && (
            <Button
              text={`Trim to ${formatRegionOffset(hint.trimEnd)}`}
              variant="secondary"
              clicked={() => setEndText(formatRegionOffset(hint.trimEnd!))}
            />
          )}
        </div>
      )}
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
      <DialogFooter>
        <Button text="Save" type="submit" disabled={!!error} />
        <Button variant="secondary" text="Cancel" clicked={controls.cancel} />
      </DialogFooter>
    </form>
  );
}

export function formatRegionOffset(value: number): string {
  return `$${toHexa4(value)}`;
}

/** How many lines any region preview shows before it trails off. */
const PREVIEW_LINE_LIMIT = 4;

/**
 * What a region actually contains, as the listing would show it.
 *
 * Async because the `disassemble` case really disassembles: every other region type is a direct
 * rendering of the bytes, but code is only knowable by decoding it, and the decoder is async. The
 * alternative — the one this replaces — was to print a sentence *about* the region
 * ("Z80 disassembly, $3FFC bytes"), which tells you nothing you did not already read off the row.
 *
 * Offsets are bank-relative, matching the Start and End columns beside it, so the disassembler runs
 * with no address offset and its item addresses are already the right ones to print.
 */
export async function createRegionPreview(
  type: AnnotationRegionType,
  start: number,
  end: number,
  bytes: number[]
): Promise<string> {
  if (type !== "disassemble") {
    return formatRegionPreview(type, start, end, bytes);
  }

  const disassembler = new Z80Disassembler(
    [new MemorySection(start, end, MemorySectionType.Disassemble)],
    Uint8Array.from(bytes),
    undefined,
    { allowExtendedSet: true }
  );
  const output = await disassembler.disassemble(start, end);
  const items = output?.outputItems ?? [];
  const lines = items
    .slice(0, PREVIEW_LINE_LIMIT)
    .map((item) => `${formatRegionOffset(item.address)}  ${item.instruction ?? ""}`);
  if (items.length > PREVIEW_LINE_LIMIT) {
    lines.push("...");
  }
  return lines.join("\n");
}

export function formatRegionPreview(
  type: AnnotationRegionType,
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
    case "copper":
      return createPreviewLines(start, end, 2, (offset, values) => {
        if (values.length < 2) {
          return `${formatRegionOffset(offset)}  .defb $${toHexa2(values[0])}`;
        }
        const word = (values[0] << 8) | values[1];
        return `${formatRegionOffset(offset)}  ${formatCopperSource(decodeCopperWord(0, word))}`;
      });
    case "dma": {
      const commands = decodeDmaStream(bytes, start, end + 1);
      const lines = commands
        .slice(0, PREVIEW_LINE_LIMIT)
        .map((cmd) => `${formatRegionOffset(cmd.offset)}  ${formatDmaCommand(cmd).text}`);
      if (commands.length > PREVIEW_LINE_LIMIT) lines.push("...");
      return lines.join("\n");
    }
    case "text":
      return createPreviewLines(start, end, 16, (offset, values) => {
        const printable = values.every((v) => v >= 0x20 && v < 0x7f && v !== 0x22 && v !== 0x5c);
        return printable
          ? `${formatRegionOffset(offset)}  .defm "${String.fromCharCode(...values)}"`
          : `${formatRegionOffset(offset)}  .defb ${values.map((v) => `$${toHexa2(v)}`).join(", ")}`;
      });
    case "skip":
      return `${formatRegionOffset(start)}  .skip ${formatRegionOffset(length)}`;
    default:
      /*
       * The disassembly case is the one this function cannot answer.
       *
       * Disassembling is async, so it is `createRegionPreview`'s job — see there. Reaching this
       * line means a caller wanted a synchronous preview of a `disassemble` region, and saying so
       * is better than the sentence this used to return, which described the region rather than
       * previewing it: "$0004  Z80 disassembly, $3FFC bytes".
       */
      return "";
  }

  function createPreviewLines(
    firstOffset: number,
    lastOffset: number,
    step: number,
    createLine: (offset: number, values: number[]) => string
  ) {
    const lines: string[] = [];
    for (
      let offset = firstOffset;
      offset <= lastOffset && lines.length < PREVIEW_LINE_LIMIT;
      offset += step
    ) {
      const values = bytes.slice(offset, Math.min(offset + step, lastOffset + 1));
      lines.push(createLine(offset, values));
    }
    if (firstOffset + step * PREVIEW_LINE_LIMIT <= lastOffset) {
      lines.push("...");
    }
    return lines.join("\n");
  }
}

/** A trailing run of `$00` bytes this long in a DMA region gets a trim suggestion (plan D8). */
export const DMA_ZERO_TAIL_THRESHOLD = 8;

/**
 * Where a DMA region could end instead, when it ends in a long run of `$00`.
 *
 * `$00` is a valid WR2 write, so a zero-filled tail lists as an endless run of
 * `.dma wr2 memory, decrement`: honest, but almost always a sign the range is too long. The cut is
 * made at a command boundary — after the last command with any non-zero byte — so trimming never
 * truncates a command whose follow bytes happen to be zero. `undefined` when there is nothing to
 * suggest, including a region that is zero throughout.
 */
export function dmaTrimSuggestion(
  bytes: ArrayLike<number>,
  start: number,
  end: number
): number | undefined {
  let lastUsedEnd: number | undefined;
  for (const cmd of decodeDmaStream(bytes, start, end + 1)) {
    if (cmd.bytes.some((b) => b !== 0)) lastUsedEnd = cmd.offset + cmd.bytes.length - 1;
  }
  if (lastUsedEnd === undefined) return undefined;
  return end - lastUsedEnd >= DMA_ZERO_TAIL_THRESHOLD ? lastUsedEnd : undefined;
}

export type RegionHint = { text: string; trimEnd?: number };

/** A non-blocking note about a valid region: a DMA zero tail, or a Copper list on an odd offset. */
export function regionHint(
  type: AnnotationRegionType,
  start: number,
  end: number,
  bytes: ArrayLike<number>
): RegionHint | undefined {
  if (type === "dma") {
    const trimEnd = dmaTrimSuggestion(bytes, start, end);
    if (trimEnd !== undefined) {
      return {
        text: `The range ends in ${end - trimEnd} zero bytes, each listed as a WR2 write.`,
        trimEnd
      };
    }
  }
  if (type === "copper" && start % 2 !== 0) {
    return { text: "Copper words are read from the region start, which is on an odd offset." };
  }
  return undefined;
}

export function validateRegion(
  type: AnnotationRegionType,
  start: number | undefined,
  end: number | undefined
): string | undefined {
  if (start === undefined || end === undefined) {
    return "Enter hexadecimal or decimal offsets.";
  }
  if (start < 0 || start > ANNOTATION_BANK_LAST_OFFSET || end < 0 || end > ANNOTATION_BANK_LAST_OFFSET) {
    return "Offsets must be in $0000..$3FFF.";
  }
  if (start > end) {
    return "Start offset must be less than or equal to end offset.";
  }
  if (type === "words" && (end - start + 1) % 2 !== 0) {
    return "Word regions must contain an even number of bytes.";
  }
  if (type === "copper" && (end - start + 1) % 2 !== 0) {
    return "Copper regions must contain an even number of bytes.";
  }
  return undefined;
}

function getAffectedRegions(
  regions: AnnotationRegion[],
  start: number,
  end: number
): AnnotationRegion[] {
  return regions.filter((region) => region.start <= end && region.end >= start);
}

function formatRegionLength(region: AnnotationRegion): string {
  const length = region.end - region.start + 1;
  return `${formatRegionOffset(length)} (${length})`;
}

function describeRegionEffect(
  region: AnnotationRegion,
  start: number,
  end: number,
  type: AnnotationRegionType
): string {
  if (region.start >= start && region.end <= end) {
    return region.type === type ? "unchanged" : "replace";
  }
  return "split";
}
