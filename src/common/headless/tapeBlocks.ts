import type { TapeDataBlock } from "@common/structs/TapeDataBlock";

import { BinaryReader } from "@common/utils/BinaryReader";
import { TapReader } from "@emu/machines/tape/TapReader";
import { TzxReader } from "@emu/machines/tape/TzxReader";

/*
 * A `.tap` or `.tzx` file as the blocks a Spectrum's tape deck plays. The emulator's tape insert
 * (`MainToEmuProcessor.setTapeFile`) and `klive run` read tapes here
 * (`.plans/COMMAND_LINE_AUTOMATION_PLAN.md` D16).
 */

/** The tape's blocks, or why the file is not a tape: TZX is tried first, then TAP */
export function tapeBlocksOf(contents: Uint8Array): { blocks: TapeDataBlock[] } | { error: string } {
  const reader = new BinaryReader(contents);
  const tzxReader = new TzxReader(reader);
  if (!tzxReader.readContent()) {
    return { blocks: tzxReader.dataBlocks.map((b) => b.getDataBlock()).filter((b) => b) };
  }
  reader.seek(0);
  const tapReader = new TapReader(reader);
  const error = tapReader.readContent();
  return error ? { error } : { blocks: tapReader.dataBlocks };
}
