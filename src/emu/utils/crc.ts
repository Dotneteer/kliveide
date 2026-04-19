// CRC7 lookup table (polynomial 0b10001001, input=full byte XOR current crc)
const CRC7_TABLE: Uint8Array = (() => {
  const poly = 0b10001001;
  const t = new Uint8Array(256);
  for (let x = 0; x < 256; x++) {
    let crc = x;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x80) ? ((crc << 1) ^ (poly << 1)) & 0xff : (crc << 1) & 0xff;
    }
    t[x] = crc;
  }
  return t;
})();

export function calculateCRC7(data: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc = CRC7_TABLE[crc ^ data[i]];
  }
  return crc >> 1;
}

// CRC16-CCITT lookup table (polynomial 0x1021)
const CRC16_TABLE: Uint16Array = (() => {
  const t = new Uint16Array(256);
  for (let i = 0; i < 256; i++) {
    let crc = i << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
    t[i] = crc;
  }
  return t;
})();

// CRC16-CCITT (polynomial 0x1021, initial value 0x0000) used for SD card data blocks
export function calculateCRC16(data: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc = (CRC16_TABLE[(crc >> 8) ^ data[i]] ^ ((crc << 8) & 0xffff));
  }
  return crc;
}
