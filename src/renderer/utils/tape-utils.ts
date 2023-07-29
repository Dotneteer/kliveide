import { TapReader } from "@emu/machines/tape/TapReader";
import { TzxBlockBase } from "@emu/machines/tape/TzxBlockBase";
import { TzxReader } from "@emu/machines/tape/TzxReader";
import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { BinaryReader } from "@common/utils/BinaryReader";

// --- Reads tape data from the specified contents
export function readTapeFile (contents: Uint8Array): {
  data?: (TapeDataBlock | TzxBlockBase)[];
  type?: string;
} {
  try {
    const reader = new BinaryReader(contents);
    const tzxReader = new TzxReader(reader);
    let result = tzxReader.readContent();
    if (result) {
      reader.seek(0);
      const tapReader = new TapReader(reader);
      result = tapReader.readContent();
      if (result) {
        // --- Not a TZX or a TAP file
        return {};
      } else {
        return { data: tapReader.dataBlocks, type: "tap" };
      }
    }
    return { data: tzxReader.dataBlocks, type: "tzx" };
  } catch {
    return {};
  }
}
