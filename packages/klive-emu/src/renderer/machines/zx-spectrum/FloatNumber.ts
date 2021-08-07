/**
 * This class contains helpers that manage ZX Spectrum float numbers
 */
export class FloatNumber {
  /**
   * Convert bytes into a ZX Spectrum floating point number
   * @param bytes Bytes of the float number
   */
  static FromBytes(bytes: number[]): number {
    if (bytes.length !== 5) {
      throw new Error("A float number must be exactly 5 bytes");
    }

    if (bytes[0] === 0) {
      // --- Simple integer form
      const neg = bytes[1] === 0xff;
      return (bytes[2] + bytes[3] * 0x100) * (neg ? -1 : 1);
    }

    const sign = (bytes[1] & 0x80) === 0 ? 1 : -1;
    const mantUpper = (((bytes[1] & 0x7f) | 0x80) << 23) * 2;
    const mant = mantUpper + (bytes[2] << 16) + (bytes[3] << 8) + bytes[4];
    const exp = bytes[0] - 128 - 32;
    return sign * mant * Math.pow(2.0, exp);
  }

  /**
   * Convert compact bytes into a ZX Spectrum floating point number
   * @param bytes Bytes of the float number
   */
  static FromCompactBytes(bytes: number[]): number {
    let copyFrom = 1;
    let exp = bytes[0] & 0x3f;
    if (exp === 0) {
      exp = bytes[1];
      copyFrom = 2;
    }
    exp += 0x50;
    const newBytes = [0x00, 0x00, 0x00, 0x00, 0x00];
    newBytes[0] = exp;
    let idx = 1;
    for (let i = copyFrom; i < bytes.length; i++) {
      newBytes[idx++] = bytes[i];
    }
    return FloatNumber.FromBytes(newBytes);
  }
}
