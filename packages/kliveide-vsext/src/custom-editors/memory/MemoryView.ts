import {
  getMemoryContents,
  getRomPage,
  getBankPage,
} from "../messaging/messaging-core";

/**
 * Size of a memory line
 */
export const LINE_SIZE = 0x10;

/**
 * Gets the contents of memory ordered into memory lines
 */
export async function memory(
  viewMode: number,
  displayedRom: number,
  displayedBank: number
): Promise<MemoryLine[] | null> {
  const from = 0x0000;
  const to = viewMode ? 0x3fff : 0xffff;

  // --- Get the Z80 memory to disassemble
  let memoryContents: string;
  switch (viewMode) {
    case 1:
      memoryContents = (await getRomPage(displayedRom)).bytes;
      break;
    case 2:
      memoryContents = (await getBankPage(displayedBank)).bytes;
      break;
    default:
      memoryContents = (await getMemoryContents(from, to)).bytes;
      break;
  }
  const bytes = new Uint8Array(Buffer.from(memoryContents, "base64"));

  if (!bytes) {
    return null;
  }

  // --- Prepare lines
  const lines: MemoryLine[] = [];
  let offset = 0;
  for (let address = from; address <= to; address += LINE_SIZE) {
    const line: MemoryLine = {
      address,
      contents: new Uint8Array(LINE_SIZE),
      charContents: "",
    };
    for (let j = 0; j < LINE_SIZE; j++) {
      const byte = bytes[offset + j];
      line.contents[j] = byte;
      line.charContents +=
        byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".";
    }
    lines.push(line);
    offset += LINE_SIZE;
  }
  return lines;
}

/**
 * Represents the 8-byte contents of a memory line
 */
export interface MemoryLine {
  address: number;
  contents: Uint8Array;
  charContents: string;
}
