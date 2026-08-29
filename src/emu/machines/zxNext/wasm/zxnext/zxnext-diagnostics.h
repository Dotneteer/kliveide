#ifndef ZXNEXT_DIAGNOSTICS_H
#define ZXNEXT_DIAGNOSTICS_H

#include <stdint.h>

static uint32_t zxnextDiagnosticsGetFlags(void);
static uint32_t zxnextDiagnosticsReadPhysical(uint32_t offset);
static uint32_t zxnextDiagnosticsChecksumPhysical(uint32_t offset, uint32_t length);

#endif
