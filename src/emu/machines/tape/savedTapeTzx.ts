import { BinaryWriter } from "@utils/BinaryWriter";
import { TzxHeader } from "./TzxHeader";
import { TzxStandardSpeedBlock } from "./TzxStandardSpeedBlock";

/**
 * The blocks a SAVE captured, as a TZX file named after the first Spectrum header among them
 * ("export" when there is none), each block standard speed with a one-second pause.
 */
export function savedTapeTzx(blocks: Uint8Array[]): { name: string; contents: Uint8Array } {
  const writer = new BinaryWriter();
  new TzxHeader().writeTo(writer);
  let savedName = "export";
  for (const blockData of blocks) {
    if (blockData.length === 0x13 && blockData[0] === 0x00) {
      savedName = spectrumHeaderName(blockData) ?? savedName;
    }
    const tzxBlock = new TzxStandardSpeedBlock();
    tzxBlock.pauseAfter = 1000;
    tzxBlock.dataLength = blockData.length;
    tzxBlock.data = blockData;
    tzxBlock.writeTo(writer);
  }
  return { name: `${savedName}.tzx`, contents: writer.buffer };
}

/** The file name in a Spectrum tape header block (bytes 2-11), printable characters only */
function spectrumHeaderName(blockData: Uint8Array): string | undefined {
  const chars: string[] = [];
  for (let i = 2; i < 12; i++) {
    const charCode = blockData[i];
    if (charCode >= 32 && charCode <= 126) chars.push(String.fromCharCode(charCode));
  }
  const name = chars.join("").trim();
  return name.length > 0 ? name : undefined;
}
