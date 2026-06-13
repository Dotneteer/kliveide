const TZX_HEADER = new Uint8Array([
  0x5a,
  0x58,
  0x54,
  0x61,
  0x70,
  0x65,
  0x21,
  0x1a,
  0x01,
  0x14
]);

const TZX_STANDARD_SPEED_BLOCK = 0x10;

export function createTzxHeader(): Uint8Array {
  return new Uint8Array(TZX_HEADER);
}

export function createTzxStandardSpeedBlock(
  data: Uint8Array,
  pauseAfter = 1000
): Uint8Array {
  ensureUint16("pauseAfter", pauseAfter);
  ensureUint16("data length", data.length);

  const result = new Uint8Array(5 + data.length);
  result[0] = TZX_STANDARD_SPEED_BLOCK;
  writeUint16(result, 1, pauseAfter);
  writeUint16(result, 3, data.length);
  result.set(data, 5);
  return result;
}

export function createSavedTapeTzx(headerBlock: Uint8Array, dataBlock: Uint8Array): Uint8Array {
  return concatBytes(
    createTzxHeader(),
    createTzxStandardSpeedBlock(headerBlock),
    createTzxStandardSpeedBlock(dataBlock)
  );
}

function concatBytes(...chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

function ensureUint16(label: string, value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new Error(`Invalid TZX ${label}: ${value}.`);
  }
}

function writeUint16(target: Uint8Array, offset: number, value: number): void {
  target[offset] = value & 0xff;
  target[offset + 1] = (value >> 8) & 0xff;
}
