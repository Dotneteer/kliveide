export function toHexa8(value: number): string {
  return value.toString(16).toUpperCase().padStart(8, "0");
}

export function toHexa6(value: number): string {
  return value.toString(16).toUpperCase().padStart(6, "0");
}

export function toHexa4(value: number): string {
  return value.toString(16).toUpperCase().padStart(4, "0");
}

export function toHexa2(value: number): string {
  return value.toString(16).toUpperCase().padStart(2, "0");
}

export function toDecimal5(value: number): string {
  return value.toString(10).toUpperCase().padStart(5, "0");
}

export function toDecimal3(value: number): string {
  return value.toString(10).toUpperCase().padStart(3, "0");
}

export function toBin8(value: number): string {
  const binValue = value.toString(2).toUpperCase().padStart(8, "0");
  return `%${binValue.substring(0, 4)} ${binValue.substring(4)}`;
}

export function toBin16(value: number): string {
  const binValue = value.toString(2).toUpperCase().padStart(16, "0");
  return `%${binValue.substring(0, 4)} ${binValue.substring(4, 8)}\xa0\xa0${binValue.substring(8, 12)} ${binValue.substring(12)}`;
}

export function toSbyte(x: number) {
  x &= 0xff;
  return x >= 128 ? x - 256 : x;
}
