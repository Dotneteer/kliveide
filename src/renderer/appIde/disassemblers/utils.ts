/**
 * Common utility functions shared between different CPU disassemblers
 */

/**
 * Allows the JavaScript event loop to process waiting messages
 */
export function processMessages(): Promise<void> {
  return new Promise<void>(resolve => {
    setTimeout(() => {
      resolve();
    }, 0);
  });
}

/**
 * Converts an unsigned byte to a signed byte
 */
export function toSbyte(x: number) {
  x &= 0xff;
  return x >= 128 ? x - 256 : x;
}

/**
 * Converts value to a signed short
 */
export function toSshort(x: number) {
  x &= 0xffff;
  return x >= 32768 ? x - 65536 : x;
}

/**
 * Converts the input value to a 2-digit hexadecimal string
 * @param value Value to convert
 */
export function intToX2(value: number): string {
  const hnum = value.toString(16).toUpperCase();
  if (hnum.length >= 2) {
    return hnum;
  }
  return "0" + hnum;
}

/**
 * Converts the input value to a 4-digit hexadecimal string
 * @param value Value to convert
 */
export function intToX4(value: number): string {
  const hnum = value.toString(16).toUpperCase();
  if (hnum.length >= 4) {
    return hnum;
  }
  return "0000".substring(0, 4 - hnum.length) + hnum;
}

/**
 * Converts the input value to a 3-digit decimal string
 * @param value Value to convert
 */
export function toDecimal3(value: number): string {
  return value.toString().padStart(3, " ");
}

/**
 * Converts the input value to a 5-digit decimal string
 * @param value Value to convert
 */
export function toDecimal5(value: number): string {
  return value.toString().padStart(5, " ");
}
