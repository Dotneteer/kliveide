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

const hex2 = (value: number) => value.toString(16).toUpperCase().padStart(2, "0");
const hex4 = (value: number) => value.toString(16).toUpperCase().padStart(4, "0");
const fmt = (value: number) => value.toLocaleString("en-US");

/** How a little-endian word is read, using the field's own bytes as the example */
function wordReading(lo: number, hi: number): string {
  return `${hex2(lo)} ${hex2(hi)} is $${hex4(lo | (hi << 8))}: the low byte comes first.`;
}

/**
 * The fields of a 19-byte header block.
 * @param bytes The block as recorded: flag, type, name, three words, checksum
 * @param dataIndex The block index of the data block this header describes, if there is one
 */
export function tapeHeaderFields(bytes: Uint8Array, dataIndex?: number): TapeHeaderField[] {
  const header = parseTapeHeader(bytes);
  const word = (offset: number) => bytes[offset] | (bytes[offset + 1] << 8);
  const dataBlock =
    dataIndex === undefined ? "the data block that follows" : `data block #${dataIndex}`;
  let checksum = 0;
  for (let i = 0; i < 18; i++) checksum ^= bytes[i];
  const nameHasCodes = Array.from(bytes.subarray(2, 12)).some((b) => b < 0x20 || b >= 0x80);

  const fields: TapeHeaderField[] = [
    {
      key: "flag",
      name: "Flag",
      first: 0,
      last: 0,
      value: `$${hex2(bytes[0])} (header)`,
      meaning: "Marks this block as a header. The data block after it starts with $FF."
    },
    {
      key: "type",
      name: "Type",
      first: 1,
      last: 1,
      value: `${header.type} · ${header.typeName}`,
      meaning: "0 Program, 1 Number array, 2 Character array, 3 Bytes (code or a screen)."
    },
    {
      key: "name",
      name: "Name",
      first: 2,
      last: 11,
      value: `"${header.name}"`,
      meaning:
        `Ten characters padded with spaces; LOAD "name" only loads a file whose name matches.` +
        (nameHasCodes
          ? " This one holds control codes or tokens, shown in braces: a trick to print something other than the name."
          : "")
    },
    {
      key: "length",
      name: "Length",
      first: 12,
      last: 13,
      value: fmt(header.dataLength),
      meaning: `How many bytes ${dataBlock} holds. ${wordReading(bytes[12], bytes[13])}`
    }
  ];

  switch (header.type) {
    case 0: {
      const program = header.variablesOffset ?? 0;
      const variables = Math.max(0, header.dataLength - program);
      fields.push(
        {
          key: "param1",
          name: "Autostart",
          first: 14,
          last: 15,
          value:
            header.autostart !== undefined
              ? `LINE ${header.autostart}`
              : `none ($${hex4(word(14))})`,
          meaning:
            (header.autostart !== undefined
              ? `After loading, the program runs from line ${header.autostart}, as if by GO TO.`
              : "32768 or more means no autostart: the program loads and stops.") +
            ` ${wordReading(bytes[14], bytes[15])}`
        },
        {
          key: "param2",
          name: "Program",
          first: 16,
          last: 17,
          value: fmt(program),
          meaning:
            `Where the variables start, counted from the start of the data: the program is ${fmt(program)} bytes and ` +
            (variables > 0
              ? `the remaining ${fmt(variables)} are its saved variables.`
              : "there are no saved variables.")
        }
      );
      break;
    }
    case 1:
    case 2:
      fields.push(
        {
          key: "param1",
          name: "Array",
          first: 14,
          last: 15,
          value: header.arrayName ?? "",
          meaning: `The array's name is in byte 15, encoded as in the variables area; byte 14 is unused. LOAD "name" DATA ${header.arrayName} restores it.`
        },
        {
          key: "param2",
          name: "Unused",
          first: 16,
          last: 17,
          value: `$${hex4(word(16))}`,
          meaning: "Means nothing for an array; SAVE leaves whatever was there."
        }
      );
      break;
    default:
      fields.push(
        {
          key: "param1",
          name: "Start",
          first: 14,
          last: 15,
          value: `$${hex4(word(14))} (${word(14)})`,
          meaning:
            `Where the bytes load unless LOAD "name" CODE gives another address.` +
            (header.startAddress === 0x4000 && header.dataLength === 6912
              ? " $4000 and 6,912 bytes: the screen."
              : "") +
            ` ${wordReading(bytes[14], bytes[15])}`
        },
        {
          key: "param2",
          name: "Unused",
          first: 16,
          last: 17,
          value: `$${hex4(word(16))}`,
          meaning: "Means nothing for Bytes; SAVE leaves whatever was there (often 32768 or more)."
        }
      );
  }

  fields.push({
    key: "checksum",
    name: "Checksum",
    first: 18,
    last: 18,
    value: `$${hex2(bytes[18])} · ${header.checksumOk ? "OK" : `should be $${hex2(checksum)}`}`,
    meaning: header.checksumOk
      ? "The XOR of bytes 0–17. The ROM checks it after loading the header."
      : `The XOR of bytes 0–17 is $${hex2(checksum)}, so the ROM would report R Tape loading error.`
  });
  return fields;
}

/** The field explained before the user points at one: what the header is mostly *for* */
export function initialHeaderField(fields: TapeHeaderField[]): string {
  return fields.some((f) => f.key === "param1") ? "param1" : "length";
}
