#ifndef ZXNEXT_I2C_H
#define ZXNEXT_I2C_H

#include <stdint.h>

void zxnextI2cReset(void);
uint32_t zxnextI2cReadSclPort(void);
uint32_t zxnextI2cReadSdaPort(void);
void zxnextI2cWriteSclPort(uint32_t value);
void zxnextI2cWriteSdaPort(uint32_t value);
void zxnextRtcSetTime(uint32_t seconds, uint32_t minutes, uint32_t hours, uint32_t day, uint32_t date,
                      uint32_t month, uint32_t year);

#endif
