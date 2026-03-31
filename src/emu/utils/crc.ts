export function calculateCRC7(data: Uint8Array): number {
  const poly = 0b10001001;
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
     crc ^= data[i];
     for (let j = 0; j < 8; j++) {
      crc = (crc & 0x80) ? ((crc << 1) ^ (poly << 1)) : (crc << 1);
    }
  }
  return crc >> 1;
}

// CRC16-CCITT (polynomial 0x1021, initial value 0x0000) used for SD card data blocks
export function calculateCRC16(data: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}
