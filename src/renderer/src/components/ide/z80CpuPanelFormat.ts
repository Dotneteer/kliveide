export function toHex8(value: number | undefined): string {
  return toHex(value, 2);
}

export function toHex16(value: number | undefined): string {
  return toHex(value, 4);
}

export function toHex(value: number | undefined, width: number): string {
  if (value === undefined) {
    return "-".repeat(width);
  }

  const modulus = 2 ** (width * 4);
  const maskedValue = ((value % modulus) + modulus) % modulus;
  return maskedValue.toString(16).toUpperCase().padStart(width, "0");
}

export function toFlag(value: number | undefined, bitNo: number): boolean | undefined {
  if (!Number.isInteger(bitNo) || bitNo < 0 || bitNo > 31) {
    throw new RangeError("bitNo must be an integer between 0 and 31.");
  }

  if (value === undefined) {
    return undefined;
  }

  return ((value >>> bitNo) & 0x01) !== 0;
}
