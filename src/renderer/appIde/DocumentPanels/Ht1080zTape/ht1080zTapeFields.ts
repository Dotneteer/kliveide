import type { CharDescriptor } from "@common/machines/info-types";
import { ht1080zTokenName } from "@common/ht1080z/basicTokens";
import { t } from "@common/i18n/i18n";
import type { Ht1080zBasicLine, Ht1080zPart } from "./ht1080zTapeView";

/*
 * A part's bytes, field by field - the model behind the viewer's byte anatomy
 * (`.plans/HT1080Z_TAPE_VIEWERS_PLAN.md` D4, D5), as `tapeHeaderFields.ts` is for a Spectrum header.
 * The bytes are cut into groups (a marker, a length, an address, the data...), and each field names a
 * group and says what it holds. Worded in the current language, so call it at display time.
 */

/** A run of the part's bytes, shown together */
export type Ht1080zByteGroup = {
  first: number;
  last: number;
  /** A keyword token (shown in the token colour), or a long run abbreviated in the view */
  kind?: "token" | "data";
};

export type Ht1080zField = {
  /** The group the field describes */
  group: number;
  name: string;
  value: string;
};

export type Ht1080zPartAnatomy = { groups: Ht1080zByteGroup[]; fields: Ht1080zField[] };

const hex2 = (value: number) => value.toString(16).toUpperCase().padStart(2, "0");
const hex4 = (value: number) => `$${value.toString(16).toUpperCase().padStart(4, "0")}`;
const word = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);

/** Text in the model's characters: a code its set lacks shows as a middle dot */
function textOf(bytes: ArrayLike<number>, charSet: Record<number, CharDescriptor>): string {
  return Array.from(bytes, (b) => (charSet[b]?.v ?? "·").replace("\xa0", " ")).join("");
}

/**
 * The byte anatomy of a part, or undefined for one that has none (the leader, the sync, trailing bytes)
 * @param part The part
 * @param charSet The characters names and text are shown in (`ht1080zCharsFor`)
 */
export function ht1080zPartAnatomy(part: Ht1080zPart, charSet: Record<number, CharDescriptor>): Ht1080zPartAnatomy | undefined {
  const b = part.bytes;
  const groups: Ht1080zByteGroup[] = [];
  const fields: Ht1080zField[] = [];
  const add = (first: number, last: number, name: string, value: string, kind?: Ht1080zByteGroup["kind"]) => {
    if (first > last || first >= b.length) return;
    groups.push({ first, last: Math.min(last, b.length - 1), ...(kind ? { kind } : {}) });
    fields.push({ group: groups.length - 1, name, value });
  };
  switch (part.role) {
    case "basicHeader":
      add(0, 2, t("panels.htTape.field.marker"), t("panels.htTape.field.basicMarker"));
      add(3, 3, t("panels.htTape.field.name"), t("panels.htTape.field.basicName", { name: textOf(b.subarray(3, 4), charSet) }));
      break;
    case "systemHeader":
      add(0, 0, t("panels.htTape.field.marker"), t("panels.htTape.field.systemMarker"));
      add(1, 6, t("panels.htTape.field.name"), t("panels.htTape.field.systemName", { name: textOf(b.subarray(1, 7), charSet).trimEnd() }));
      break;
    case "systemBlock": {
      const count = b[1] || 256;
      add(0, 0, t("panels.htTape.field.marker"), t("panels.htTape.field.blockMarker"));
      add(1, 1, t("panels.htTape.field.length"), t("panels.htTape.field.blockLength", { count }));
      add(2, 3, t("panels.htTape.field.address"), t("panels.htTape.field.address.value", { address: hex4(word(b, 2)) }));
      add(4, 3 + count, t("panels.htTape.field.data"), t("panels.htTape.field.dataBytes", { count }), "data");
      if (part.checksum) {
        add(4 + count, 4 + count, t("panels.htTape.field.checksum"),
          part.checksum.stored === part.checksum.computed
            ? t("panels.htTape.field.checksumOk", { value: hex2(part.checksum.stored) })
            : t("panels.htTape.field.checksumBad", { value: hex2(part.checksum.stored), expected: hex2(part.checksum.computed) }));
      }
      break;
    }
    case "systemEntry":
      add(0, 0, t("panels.htTape.field.marker"), t("panels.htTape.field.entryMarker"));
      add(1, 2, t("panels.htTape.field.entry"), t("panels.htTape.field.entry.value", { address: hex4(word(b, 1)) }));
      break;
    case "programEnd":
      add(0, 1, t("panels.htTape.field.link"), t("panels.htTape.field.endLink"));
      break;
    case "cmdHeader":
      add(0, 0, t("panels.htTape.field.type"), t("panels.htTape.field.cmdHeaderType"));
      add(1, 1, t("panels.htTape.field.length"), `${b[1]}`);
      add(2, b.length - 1, t("panels.htTape.field.name"), t("panels.htTape.field.cmdName", { name: textOf(b.subarray(2), charSet).trimEnd() }));
      break;
    case "cmdLoad": {
      const data = b.length - 4;
      add(0, 0, t("panels.htTape.field.type"), t("panels.htTape.field.cmdLoadType"));
      add(1, 1, t("panels.htTape.field.length"), t("panels.htTape.field.cmdLoadLength", { value: hex2(b[1]), count: data + 2, data }));
      add(2, 3, t("panels.htTape.field.address"), t("panels.htTape.field.address.value", { address: hex4(word(b, 2)) }));
      add(4, b.length - 1, t("panels.htTape.field.data"), t("panels.htTape.field.dataBytes", { count: data }), "data");
      break;
    }
    case "cmdTransfer":
      add(0, 0, t("panels.htTape.field.type"), t("panels.htTape.field.cmdTransferType"));
      add(1, 1, t("panels.htTape.field.length"), `${b[1]}`);
      add(2, 3, t("panels.htTape.field.entry"), t("panels.htTape.field.entry.value", { address: hex4(word(b, 2)) }));
      break;
    case "cmdOther":
      add(0, 0, t("panels.htTape.field.type"), t("panels.htTape.field.cmdOtherType", { value: hex2(b[0]) }));
      add(1, 1, t("panels.htTape.field.length"), `${b[1]}`);
      add(2, b.length - 1, t("panels.htTape.field.data"), t("panels.htTape.field.dataBytes", { count: b.length - 2 }), "data");
      break;
    case "basLine":
      if (part.line) return ht1080zLineAnatomy(part.line, charSet);
      return undefined;
    default:
      return undefined;
  }
  return { groups, fields };
}

/**
 * A program line's anatomy: the link, the line number, then the text in runs of characters and the
 * keyword tokens between them, and the closing 00h. Offsets are from the line's first byte.
 */
export function ht1080zLineAnatomy(line: Ht1080zBasicLine, charSet: Record<number, CharDescriptor>): Ht1080zPartAnatomy {
  const groups: Ht1080zByteGroup[] = [{ first: 0, last: 1 }, { first: 2, last: 3 }];
  const fields: Ht1080zField[] = [
    { group: 0, name: t("panels.htTape.field.link"), value: t("panels.htTape.field.lineLink", { address: hex4(line.link) }) },
    { group: 1, name: t("panels.htTape.field.line"), value: `${line.lineNo}` }
  ];
  let runStart = -1;
  const flush = (end: number) => {
    if (runStart < 0) return;
    groups.push({ first: 4 + runStart, last: 4 + end - 1 });
    fields.push({ group: groups.length - 1, name: t("panels.htTape.field.text"), value: textOf(line.text.subarray(runStart, end), charSet) });
    runStart = -1;
  };
  line.text.forEach((code, i) => {
    const keyword = ht1080zTokenName(code);
    if (keyword) {
      flush(i);
      groups.push({ first: 4 + i, last: 4 + i, kind: "token" });
      fields.push({ group: groups.length - 1, name: t("panels.htTape.field.token"), value: t("panels.htTape.field.token.value", { code: hex2(code), keyword }) });
    } else if (runStart < 0) {
      runStart = i;
    }
  });
  flush(line.text.length);
  groups.push({ first: line.length - 1, last: line.length - 1 });
  fields.push({ group: groups.length - 1, name: t("panels.htTape.field.end"), value: t("panels.htTape.field.lineEnd") });
  return { groups, fields };
}
