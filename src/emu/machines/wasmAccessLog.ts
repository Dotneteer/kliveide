/**
 * The per-instruction data-access log of the WASM Z80 cores (`z80.c`).
 *
 * Every memory read and write an instruction makes as data - not its opcode, displacement or operand
 * fetches - is one entry, in access order: bits 0-15 the address, 16-23 the byte, bit 24 set for a
 * write. Each core exports the log's address (`…GetAccessLogPtr`) and the entry count of the last
 * instruction (`…GetAccessLogCount`); the loaders keep a view on it, so one count read replaces the
 * per-access export calls.
 */

/** Entries the core keeps; an access beyond it is dropped and counted (`…GetAccessLogOverflows`) */
export const WASM_ACCESS_LOG_CAPACITY = 8;

/** Bit 24 of an entry: the access is a write */
export const WASM_ACCESS_LOG_WRITE = 0x01000000;

/** The machine fields an instruction's accesses are imported into */
export interface AccessLogTarget {
  lastMemoryReads: Uint16Array;
  lastMemoryReadValues: Uint8Array;
  lastMemoryReadsCount: number;
  lastMemoryReadValue: number;
  lastMemoryWrites: Uint16Array;
  lastMemoryWriteValues: Uint8Array;
  lastMemoryWritesCount: number;
  lastMemoryWriteValue: number;
}

/**
 * Splits the first `count` entries of `log` into the target's read and write lists, each address
 * with its own byte. `lastMemoryReadValue` / `lastMemoryWriteValue` (shown by the CPU panel) take the
 * instruction's last read / write and keep their previous value when there is none.
 */
export function importAccessLog(target: AccessLogTarget, log: Uint32Array, count: number): void {
  let reads = 0;
  let writes = 0;
  const n = count < WASM_ACCESS_LOG_CAPACITY ? count : WASM_ACCESS_LOG_CAPACITY;
  for (let i = 0; i < n; i++) {
    const entry = log[i];
    const address = entry & 0xffff;
    const value = (entry >>> 16) & 0xff;
    if (entry & WASM_ACCESS_LOG_WRITE) {
      target.lastMemoryWrites[writes] = address;
      target.lastMemoryWriteValues[writes++] = value;
      target.lastMemoryWriteValue = value;
    } else {
      target.lastMemoryReads[reads] = address;
      target.lastMemoryReadValues[reads++] = value;
      target.lastMemoryReadValue = value;
    }
  }
  target.lastMemoryReadsCount = reads;
  target.lastMemoryWritesCount = writes;
}
