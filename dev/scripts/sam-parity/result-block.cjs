/**
 * Decodes a parity probe's result block from an .mgt image (the format is in
 * test/sam-hw/parity/probes/parity.inc.asm; test/sam-hw/parity/parity.ts reads it the same way).
 */
const MGT_SECTOR_SIZE = 512;
/** Track 79, side 2, sector 10 */
const RESULT_OFFSET = ((79 * 2 + 1) * 10 + (10 - 1)) * MGT_SECTOR_SIZE;

/** name -> value, or undefined when the block was never written */
function readResultRecords(image) {
  const block = image.subarray(RESULT_OFFSET, RESULT_OFFSET + MGT_SECTOR_SIZE);
  if (block.length < MGT_SECTOR_SIZE || block.toString("latin1", 0, 4) !== "KLPR") return undefined;
  const records = {};
  for (let i = 0; i < block[5]; i++) {
    const at = 16 + i * 12;
    records[block.toString("latin1", at, at + 8).trimEnd()] = block.readUInt32LE(at + 8);
  }
  return records;
}

module.exports = { RESULT_OFFSET, readResultRecords };
