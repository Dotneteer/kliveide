import { getMemoryContents } from "../messaging/messaging-core";

/**
 * Size of a memory line
 */
const LINE_SIZE = 0x10;

/**
 * Gets the contents of memory ordered into memory lines
 */
export async function memory(): Promise<MemoryLine[] | null> {
  // --- Get the Z80 memory to disassemble
  const memoryContents = await getMemoryContents(0, 0xffff);
  const bytes = new Uint8Array(Buffer.from(memoryContents.bytes, "base64"));
  if (!bytes || bytes.length < 0x10000) {
    return null;
  }

  // --- Prepare lines
  const lines: MemoryLine[] = [];
  for (let address = 0x0000; address < 0x10000; address += LINE_SIZE) {
    const line: MemoryLine = {
      address,
      contents: new Uint8Array(LINE_SIZE),
      charContents: "",
    };
    for (let j = 0; j < LINE_SIZE; j++) {
      const byte = bytes[address + j];
      line.contents[j] = byte;
      line.charContents +=
        byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".";
    }
    lines.push(line);
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
