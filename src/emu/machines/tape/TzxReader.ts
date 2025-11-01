import { BinaryReader } from "@utils/BinaryReader";
import { TzxArchiveInfoBlock } from "./TzxArchiveInfoBlock";
import { TzxBlockBase } from "./TzxBlockBase";
import { TzxC64RomTypeBlock } from "./TzxC64RomTypeBlock";
import { TzxC64TurboTapeBlock } from "./TzxC64TurboTapeBlock";
import { TzxCallSequenceBlock } from "./TzxCallSequenceBlock";
import { TzxCswRecordingBlock } from "./TzxCswRecordingBlock";
import { TzxCustomInfoBlock } from "./TzxCustomInfoBlock";
import { TzxDeprecatedBlockBase } from "./TzxDeprecatedBlockBase";
import { TzxDirectRecordingBlock } from "./TzxDirectRecordingBlock";
import { TzxEmulationInfoBlock } from "./TzxEmulationInfoBlock";
import { TzxGeneralizedBlock } from "./TzxGeneralizedBlock";
import { TzxGlueBlock } from "./TzxGlueBlock";
import { TzxGroupEndBlock } from "./TzxGroupEndBlock";
import { TzxGroupStartBlock } from "./TzxGroupStartBlock";
import { TzxHardwareInfoBlock } from "./TzxHardwareInfoBlock";
import { TzxHeader } from "./TzxHeader";
import { TzxJumpBlock } from "./TzxJumpBlock";
import { TzxLoopEndBlock } from "./TzxLoopEndBlock";
import { TzxLoopStartBlock } from "./TzxLoopStartBlock";
import { TzxMessageBlock } from "./TzxMessageBlock";
import { TzxPulseSequenceBlock } from "./TzxPulseSequenceBlock";
import { TzxPureBlock } from "./TzxPureBlock";
import { TzxPureToneBlock } from "./TzxPureToneBlock";
import { TzxReturnFromSequenceBlock } from "./TzxReturnFromSequenceBlock";
import { TzxSelectBlock } from "./TzxSelectBlock";
import { TzxSetSignalLevelBlock } from "./TzxSetSignalLevelBlock";
import { TzxSilenceBlock } from "./TzxSilenceBlock";
import { TzxSnapshotBlock } from "./TzxSnapshotBlock";
import { TzxStandardSpeedBlock } from "./TzxStandardSpeedBlock";
import { TzxStopTheTape48Block } from "./TzxStopTheTape48Block";
import { TzxTextDescriptionBlock } from "./TzxTextDescriptionBlock";
import { TzxTurboSpeedBlock } from "./TzxTurboSpeedBlock";

// --- Represents the available TZX data block types
const dataBlockTypes = new Map<number, () => TzxBlockBase>([
  [0x10, () => new TzxStandardSpeedBlock()],
  [0x11, () => new TzxTurboSpeedBlock()],
  [0x12, () => new TzxPureToneBlock()],
  [0x13, () => new TzxPulseSequenceBlock()],
  [0x14, () => new TzxPureBlock()],
  [0x15, () => new TzxDirectRecordingBlock()],
  [0x16, () => new TzxC64RomTypeBlock()],
  [0x17, () => new TzxC64TurboTapeBlock()],
  [0x18, () => new TzxCswRecordingBlock()],
  [0x19, () => new TzxGeneralizedBlock()],
  [0x20, () => new TzxSilenceBlock()],
  [0x21, () => new TzxGroupStartBlock()],
  [0x22, () => new TzxGroupEndBlock()],
  [0x23, () => new TzxJumpBlock()],
  [0x24, () => new TzxLoopStartBlock()],
  [0x25, () => new TzxLoopEndBlock()],
  [0x26, () => new TzxCallSequenceBlock()],
  [0x27, () => new TzxReturnFromSequenceBlock()],
  [0x28, () => new TzxSelectBlock()],
  [0x2a, () => new TzxStopTheTape48Block()],
  [0x2b, () => new TzxSetSignalLevelBlock()],
  [0x30, () => new TzxTextDescriptionBlock()],
  [0x31, () => new TzxMessageBlock()],
  [0x32, () => new TzxArchiveInfoBlock()],
  [0x33, () => new TzxHardwareInfoBlock()],
  [0x34, () => new TzxEmulationInfoBlock()],
  [0x35, () => new TzxCustomInfoBlock()],
  [0x40, () => new TzxSnapshotBlock()],
  [0x5a, () => new TzxGlueBlock()]
]);

/**
 * This class reads a TZX file
 */
export class TzxReader {
  /**
   * Data blocks of this TZX file
   */
  readonly dataBlocks: TzxBlockBase[];

  /**
   * Major version number of the file
   */
  majorVersion: number;

  /**
   * Minor version number of the file
   */
  minorVersion: number;

  /**
   * Initializes the player from the specified reader
   * @param _reader Reader to use
   */
  constructor (private readonly _reader: BinaryReader) {
    this.dataBlocks = [];
  }

  /**
   * Reads in the content of the TZX file so that it can be played
   * @returns True, if read was successful; otherwise, false
   */
  readContent (): string | null {
    const header = new TzxHeader();
    try {
      header.readFrom(this._reader);
      if (!header.isValid) {
        throw new Error("Invalid TZX header");
      }

      this.majorVersion = header.majorVersion;
      this.minorVersion = header.minorVersion;

      while (this._reader.position !== this._reader.length) {
        const blockType = this._reader.readByte();
        const factory = dataBlockTypes.get(blockType);
        if (!factory) {
          throw new Error(`Unkonwn TZX block type: ${blockType}`);
        }

        try {
          const block = factory() as TzxBlockBase;
          if (!block) {
            throw Error(
              `Cannot instantiate TZX data block with type ${blockType}.`
            );
          }
          if ((block as any).readThrough) {
            (block as TzxDeprecatedBlockBase).readThrough(this._reader);
          } else {
            block.readFrom(this._reader);
          }

          this.dataBlocks.push(block);
        } catch (err) {
          throw new Error(
            `Cannot read TZX data block ${blockType}. (${err.message})`
          );
        }
      }

      // --- Done.
      return null;
    } catch (err) {
      // --- This exception is intentionally ignored
      return err.message;
    }
  }
}
