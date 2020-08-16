import { getMemoryContents } from "../messaging/messaging-core";

/**
 * Size of a memory line
 */
export const LINE_SIZE = 0x10;

/**
 * Gets the contents of memory ordered into memory lines
 */
export async function memory(from?: number, to?: number): Promise<MemoryLine[] | null> {
  if (from === undefined) {
    from = 0x0000;
  }
  if (to === undefined) {
    to = 0xffff;
  }

  // --- Round values according to line size
  from = LINE_SIZE * Math.floor(from/LINE_SIZE);
  to = LINE_SIZE * Math.floor((to + LINE_SIZE)/LINE_SIZE) - 1;

  // --- Get the Z80 memory to disassemble
  const memoryContents = await getMemoryContents(from, to);
  const bytes = new Uint8Array(Buffer.from(memoryContents.bytes, "base64"));
  
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
