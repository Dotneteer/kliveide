#include "zxnext-diagnostics.h"
#include "zxnext-memory.h"

static uint32_t zxnextDiagnosticsGetFlags(void) {
  return ZXNEXT_DIAGNOSTIC_IMPLEMENTATION_INCOMPLETE;
}

static uint32_t zxnextDiagnosticsReadPhysical(uint32_t offset) {
  return zxnextMemoryReadPhysical(offset);
}

static uint32_t zxnextDiagnosticsChecksumPhysical(uint32_t offset, uint32_t length) {
  uint32_t checksum = 2166136261u;
  for (uint32_t i = 0; i < length; i++) {
    checksum ^= zxnextMemoryReadPhysical(offset + i);
    checksum *= 16777619u;
  }
  return checksum;
}
