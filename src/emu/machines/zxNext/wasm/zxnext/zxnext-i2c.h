#ifndef ZXNEXT_I2C_H
#define ZXNEXT_I2C_H

#include <stdint.h>

void zxnextI2cReset(void);
uint32_t zxnextI2cReadSclPort(void);
uint32_t zxnextI2cReadSdaPort(void);
void zxnextI2cWriteSclPort(uint32_t value);
void zxnextI2cWriteSdaPort(uint32_t value);
uint32_t zxnextGetI2cScl(void);
uint32_t zxnextGetI2cSda(void);

#endif
