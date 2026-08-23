#include "zxnext-i2c.h"

static uint8_t zxnextI2cSclOut;
static uint8_t zxnextI2cSdaOut;
static uint8_t zxnextI2cSdaSlave;

void zxnextI2cReset(void) {
  zxnextI2cSclOut = 1;
  zxnextI2cSdaOut = 1;
  zxnextI2cSdaSlave = 1;
}

uint32_t zxnextI2cReadSclPort(void) { return 0xfeu | (zxnextI2cSclOut ? 1u : 0u); }
uint32_t zxnextI2cReadSdaPort(void) { return 0xfeu | ((zxnextI2cSdaOut && zxnextI2cSdaSlave) ? 1u : 0u); }
void zxnextI2cWriteSclPort(uint32_t value) { zxnextI2cSclOut = (value & 0x01u) != 0; }
void zxnextI2cWriteSdaPort(uint32_t value) { zxnextI2cSdaOut = (value & 0x01u) != 0; }
uint32_t zxnextGetI2cScl(void) { return zxnextI2cSclOut; }
uint32_t zxnextGetI2cSda(void) { return zxnextI2cSdaOut && zxnextI2cSdaSlave; }
