/*
 * The layout of the WASM core's frame-trace ring (zxnext-trace.c): the header, the record size and
 * the capacity the loader sizes its view with.
 */

export const ZXNEXT_FRAME_TRACE_MAGIC = 0x5854465a;

export const ZXNEXT_FRAME_TRACE_VERSION = 1;

export const ZXNEXT_FRAME_TRACE_HEADER_SIZE = 64;

export const ZXNEXT_FRAME_TRACE_RECORD_SIZE = 128;

export const ZXNEXT_FRAME_TRACE_CAPACITY = 160_000;

export const ZXNEXT_FRAME_TRACE_TOTAL_BYTES =
  ZXNEXT_FRAME_TRACE_HEADER_SIZE +
  ZXNEXT_FRAME_TRACE_CAPACITY * ZXNEXT_FRAME_TRACE_RECORD_SIZE;

