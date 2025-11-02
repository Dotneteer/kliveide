import { convertLongToShortName } from "./file-names";

/**
 * This class is a common base class to handle short and long file names.
 */
export class FsName {
  constructor(public readonly name: string, seqNo?: number) {
    const sfn = convertLongToShortName(this.name, seqNo);
    this.flags = sfn.flags;
    this.sfn12 = sfn.name;
    const shortParts = sfn.name.split(".");
    this.sfn11 = shortParts[0].padEnd(8, " ") + shortParts[1].padEnd(3, " ");
    const ext = shortParts[1].trim();
    this.sfn = shortParts[0].trim() + (ext ? "." + ext : "");
  }

  // --- Flags for base and extension character case and LFN
  flags: number;
  // --- Short File Name
  sfn12: string;
  sfn11: string;
  sfn: string;
}

export type FsPath = {
  segments: FsName[];
};
