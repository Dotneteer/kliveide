import { t } from "@common/i18n/i18n";
import { TVC_PROGRAM_FILE_TYPE, type TvcCasPart } from "./tvcCasModel";

/*
 * A TVC `.cas` header's bytes, field by field - the model behind the viewer's byte anatomy, as
 * `ht1080zTapeFields.ts` is for an HT-1080Z tape. Worded in the current language: call it at display
 * time.
 */

export type TvcByteGroup = { first: number; last: number; kind?: "data" };
export type TvcField = { group: number; name: string; value: string };
export type TvcPartAnatomy = { groups: TvcByteGroup[]; fields: TvcField[] };

const hex2 = (value: number) => value.toString(16).toUpperCase().padStart(2, "0");
const word = (b: Uint8Array, at: number) => b[at] | (b[at + 1] << 8);

/**
 * The byte anatomy of a header part, or undefined for a part that has none (the payload's parts are
 * shown as a listing or popped out as memory)
 */
export function tvcCasPartAnatomy(part: TvcCasPart): TvcPartAnatomy | undefined {
  const b = part.bytes;
  const groups: TvcByteGroup[] = [];
  const fields: TvcField[] = [];
  const add = (first: number, last: number, name: string, value: string, kind?: "data") => {
    if (first > last || first >= b.length) return;
    groups.push({ first, last: Math.min(last, b.length - 1), ...(kind ? { kind } : {}) });
    fields.push({ group: groups.length - 1, name, value });
  };
  switch (part.role) {
    case "fileHeader":
      add(0, 0, t("panels.tvcTape.field.identifier"), t("panels.tvcTape.field.identifierValue", { value: hex2(b[0]) }));
      add(1, 1, t("panels.tvcTape.field.unused"), `${hex2(b[1])}h`);
      add(2, 3, t("panels.tvcTape.field.records"), t("panels.tvcTape.field.recordsValue", { count: word(b, 2) }));
      add(4, 5, t("panels.tvcTape.field.lastRecord"), t("panels.tvcTape.field.lastRecordValue", { count: word(b, 4) }));
      add(6, b.length - 1, t("panels.tvcTape.field.unused"), t("panels.helpers.bytes", { count: b.length - 6 }), "data");
      return { groups, fields };
    case "appHeader":
      add(0, 0, t("panels.tvcTape.field.unused"), `${hex2(b[0])}h`);
      add(
        1,
        1,
        t("panels.tvcTape.field.fileType"),
        b[1] === TVC_PROGRAM_FILE_TYPE
          ? t("panels.tvcTape.field.fileTypeProgram", { value: hex2(b[1]) })
          : t("panels.tvcTape.field.fileTypeOther", { value: hex2(b[1]) })
      );
      add(2, 3, t("panels.tvcTape.field.length"), t("panels.helpers.bytes", { count: word(b, 2) }));
      add(4, 4, t("panels.tvcTape.field.autostart"), b[4] ? t("panels.tvcTape.field.autostartOn", { value: hex2(b[4]) }) : t("panels.tvcTape.field.autostartOff"));
      add(5, b.length - 1, t("panels.tvcTape.field.reserved"), t("panels.helpers.bytes", { count: b.length - 5 }), "data");
      return { groups, fields };
    default:
      return undefined;
  }
}
