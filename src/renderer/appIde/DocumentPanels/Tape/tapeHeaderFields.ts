import { t } from "@common/i18n/i18n";
import { parseTapeHeader } from "./tapeView";

/*
 * A standard tape header's 19 bytes, field by field, with what each one means - the model behind
 * the header byte explainer (`TapeHeaderBytes.tsx`). No React, so every explanation is unit-tested.
 *
 * The layout is the ROM's: flag, type, a ten-character name, then three little-endian words whose
 * meaning depends on the type, then an XOR checksum.
 */

export type TapeHeaderField = {
  /** Stable key: "flag", "type", "name", "length", "param1", "param2", "checksum" */
  key: string;
  name: string;
  /** The field's first and last byte offset in the block */
  first: number;
  last: number;
  /** The decoded value, short */
  value: string;
  /** What the field means, in a sentence or two */
  meaning: string;
};

/* --- Byte counts in the value column stay invariant: they sit beside hex, as data */
const fmt = (value: number) => value.toLocaleString("en-US");
const hex2 = (value: number) => value.toString(16).toUpperCase().padStart(2, "0");
const hex4 = (value: number) => value.toString(16).toUpperCase().padStart(4, "0");

/** How a little-endian word is read, using the field's own bytes as the example */
function wordReading(lo: number, hi: number): string {
  return t("panels.tape.hdr.wordReading", { lo: hex2(lo), hi: hex2(hi), word: `$${hex4(lo | (hi << 8))}` });
}

/**
 * The fields of a 19-byte header block, worded in the current language (call it at display time).
 * @param bytes The block as recorded: flag, type, name, three words, checksum
 * @param dataIndex The block index of the data block this header describes, if there is one
 */
export function tapeHeaderFields(bytes: Uint8Array, dataIndex?: number): TapeHeaderField[] {
  const header = parseTapeHeader(bytes);
  const word = (offset: number) => bytes[offset] | (bytes[offset + 1] << 8);
  let checksum = 0;
  for (let i = 0; i < 18; i++) checksum ^= bytes[i];
  const nameHasCodes = Array.from(bytes.subarray(2, 12)).some((b) => b < 0x20 || b >= 0x80);
  const lengthReading = wordReading(bytes[12], bytes[13]);

  const fields: TapeHeaderField[] = [
    {
      key: "flag",
      name: t("panels.tape.hdr.flag"),
      first: 0,
      last: 0,
      value: t("panels.tape.hdr.flagValue", { value: `$${hex2(bytes[0])}` }),
      meaning: t("panels.tape.hdr.flagMeaning")
    },
    {
      key: "type",
      name: t("panels.tape.hdr.type"),
      first: 1,
      last: 1,
      value: `${header.type} · ${header.typeName}`,
      meaning: t("panels.tape.hdr.typeMeaning")
    },
    {
      key: "name",
      name: t("panels.tape.hdr.name"),
      first: 2,
      last: 11,
      value: `"${header.name}"`,
      meaning: nameHasCodes ? t("panels.tape.hdr.nameMeaningCodes") : t("panels.tape.hdr.nameMeaning")
    },
    {
      key: "length",
      name: t("panels.tape.hdr.length"),
      first: 12,
      last: 13,
      value: fmt(header.dataLength),
      meaning:
        dataIndex === undefined
          ? t("panels.tape.hdr.lengthMeaningNext", { reading: lengthReading })
          : t("panels.tape.hdr.lengthMeaning", { index: dataIndex, reading: lengthReading })
    }
  ];

  switch (header.type) {
    case 0: {
      const program = header.variablesOffset ?? 0;
      const variables = Math.max(0, header.dataLength - program);
      const reading = wordReading(bytes[14], bytes[15]);
      fields.push(
        {
          key: "param1",
          name: t("panels.tape.hdr.autostart"),
          first: 14,
          last: 15,
          // --- LINE is the BASIC keyword: not translated
          value:
            header.autostart !== undefined
              ? `LINE ${header.autostart}`
              : t("panels.tape.hdr.autostartNone", { value: `$${hex4(word(14))}` }),
          meaning:
            header.autostart !== undefined
              ? t("panels.tape.hdr.autostartMeaning", { line: header.autostart, reading })
              : t("panels.tape.hdr.autostartMeaningNone", { reading })
        },
        {
          key: "param2",
          name: t("panels.tape.hdr.program"),
          first: 16,
          last: 17,
          value: fmt(program),
          meaning:
            variables > 0
              ? t("panels.tape.hdr.programMeaning", { program, variables })
              : t("panels.tape.hdr.programMeaningNoVars", { program })
        }
      );
      break;
    }
    case 1:
    case 2:
      fields.push(
        {
          key: "param1",
          name: t("panels.tape.hdr.array"),
          first: 14,
          last: 15,
          value: header.arrayName ?? "",
          meaning: t("panels.tape.hdr.arrayMeaning", { name: header.arrayName ?? "" })
        },
        {
          key: "param2",
          name: t("panels.tape.hdr.unused"),
          first: 16,
          last: 17,
          value: `$${hex4(word(16))}`,
          meaning: t("panels.tape.hdr.unusedArrayMeaning")
        }
      );
      break;
    default: {
      const reading = wordReading(bytes[14], bytes[15]);
      fields.push(
        {
          key: "param1",
          name: t("panels.tape.hdr.start"),
          first: 14,
          last: 15,
          value: `$${hex4(word(14))} (${word(14)})`,
          meaning:
            header.startAddress === 0x4000 && header.dataLength === 6912
              ? t("panels.tape.hdr.startMeaningScreen", { reading })
              : t("panels.tape.hdr.startMeaning", { reading })
        },
        {
          key: "param2",
          name: t("panels.tape.hdr.unused"),
          first: 16,
          last: 17,
          value: `$${hex4(word(16))}`,
          meaning: t("panels.tape.hdr.unusedBytesMeaning")
        }
      );
    }
  }

  fields.push({
    key: "checksum",
    name: t("panels.tape.hdr.checksum"),
    first: 18,
    last: 18,
    value: header.checksumOk
      ? t("panels.tape.hdr.checksumOk", { value: `$${hex2(bytes[18])}` })
      : t("panels.tape.hdr.checksumBad", { value: `$${hex2(bytes[18])}`, expected: `$${hex2(checksum)}` }),
    meaning: header.checksumOk
      ? t("panels.tape.hdr.checksumMeaning")
      : t("panels.tape.hdr.checksumMeaningBad", { expected: `$${hex2(checksum)}` })
  });
  return fields;
}

/** The field explained before the user points at one: what the header is mostly *for* */
export function initialHeaderField(fields: TapeHeaderField[]): string {
  return fields.some((f) => f.key === "param1") ? "param1" : "length";
}
