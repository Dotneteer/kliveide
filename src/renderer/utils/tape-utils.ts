import { TapReader } from "@emu/machines/tape/TapReader";
import { TzxBlockBase } from "@emu/machines/tape/TzxBlockBase";
import { TzxReader } from "@emu/machines/tape/TzxReader";
import { TapeDataBlock } from "@common/structs/TapeDataBlock";
import { BinaryReader } from "@common/utils/BinaryReader";

/**
 * Reads tape data from the specified contents.
 *
 * Both readers already return a message describing *why* they rejected the bytes
 * (`TzxReader.readContent(): string | null`), and both messages were being thrown away — the
 * viewer could then only say "Invalid tape file format". `error` carries the TAP reader's
 * complaint, which is the more useful of the two: a file that is neither format has almost always
 * failed the simpler TAP check for a reason worth reading.
 */
export function readTapeFile (contents: Uint8Array): {
  data?: (TapeDataBlock | TzxBlockBase)[];
  type?: string;
  error?: string;
} {
  try {
    const reader = new BinaryReader(contents);
    const tzxReader = new TzxReader(reader);
    const tzxError = tzxReader.readContent();
    if (tzxError) {
      reader.seek(0);
      const tapReader = new TapReader(reader);
      const tapError = tapReader.readContent();
      if (tapError) {
        // --- Neither a TZX nor a TAP file
        return { error: tapError };
      }
      return { data: tapReader.dataBlocks, type: "tap" };
    }
    return { data: tzxReader.dataBlocks, type: "tzx" };
  } catch (err) {
    return { error: (err as Error)?.message };
  }
}
