#ifndef ZXNEXT_PORTS_H
#define ZXNEXT_PORTS_H

#include <stdint.h>

static void zxnextPortsReset(void);
static uint32_t zxnextPortsRead(uint32_t address);
static void zxnextPortsWrite(uint32_t address, uint32_t value);

#endif
