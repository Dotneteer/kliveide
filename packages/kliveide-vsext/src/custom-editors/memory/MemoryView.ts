/**
 * Size of a memory line
 */
export const LINE_SIZE = 0x10;

/**
 * Creates a memory line
 * @param bytes Memory contents
 * @param index Line index
 */
export function createMemoryLine(bytes: Uint8Array, index: number) : MemoryLine {
  const line: MemoryLine = {
    address: index * LINE_SIZE,
    contents: new Uint8Array(LINE_SIZE),
    charContents: "",
  };
  for (let j = 0; j < LINE_SIZE; j++) {
    const byte = bytes[line.address + j];
    line.contents[j] = byte;
    line.charContents +=
      byte >= 32 && byte <= 126 ? String.fromCharCode(byte) : ".";
  }
  return line;
}

/**
 * Represents the 8-byte contents of a memory line
 */
export interface MemoryLine {
  address: number;
  contents: Uint8Array;
  charContents: string;
}
