#include "zxnext-i2c.h"

/*
 * The I2C bus (zxnext.vhd ~3224: a bit-banged master on $103B SCL / $113B SDA, bit 0, open drain,
 * released by a reset; reads give "1111111" & the line) with the board's DS1307 real-time clock on it
 * (Maxim DS1307 datasheet). The same model as I2cDevice.ts. The DS1307 is battery backed: no Next
 * reset touches its registers, RAM or clock. Its seconds come from the 28 MHz clock (28M per second).
 */

#define ZXNEXT_DS1307_ADDRESS 0x68u

enum {
  ZXNEXT_I2C_IDLE = 0,
  ZXNEXT_I2C_ADDRESS,
  ZXNEXT_I2C_ADDRESS_ACK,
  ZXNEXT_I2C_DATA_WRITE,
  ZXNEXT_I2C_DATA_WRITE_ACK,
  ZXNEXT_I2C_DATA_READ,
  ZXNEXT_I2C_DATA_READ_ACK
};

static uint8_t zxnextI2cSclOut = 1;
static uint8_t zxnextI2cSdaOut = 1;
static uint8_t zxnextI2cSdaSlave = 1;
static uint8_t zxnextI2cPrevScl = 1;
static uint8_t zxnextI2cPrevSda = 1;

static uint8_t zxnextI2cState;
static uint8_t zxnextI2cShift;
static uint8_t zxnextI2cBitCount;
static uint8_t zxnextI2cIsRead;
static uint8_t zxnextI2cAddressed;
static uint8_t zxnextI2cFirstWrite = 1;

/* DS1307: 7 time registers, control, 56 bytes of RAM; the user buffer read between STARTs */
static uint8_t zxnextRtcRegs[0x40];
static uint8_t zxnextRtcUser[7];
static uint8_t zxnextRtcPointer;
static ZxNextClock28 zxnextRtcClock;
static uint64_t zxnextRtcCountdownStart;
static uint8_t zxnextRtcCountdownStarted;

static uint8_t zxnextRtcToBcd(uint32_t v) { return (uint8_t)(((v / 10u) << 4) | (v % 10u)); }
static uint32_t zxnextRtcFromBcd(uint8_t b) { return ((b >> 4) & 0x0fu) * 10u + (b & 0x0fu); }

/* One second of the counter chain over registers 0-6 (rtcAdvanceOneSecond in I2cDevice.ts) */
static void zxnextRtcAdvanceOneSecond(uint8_t *r) {
  uint32_t seconds = zxnextRtcFromBcd(r[0] & 0x7fu) + 1u;
  if (seconds < 60u) { r[0] = zxnextRtcToBcd(seconds); return; }
  r[0] = 0;
  uint32_t minutes = zxnextRtcFromBcd(r[1] & 0x7fu) + 1u;
  if (minutes < 60u) { r[1] = zxnextRtcToBcd(minutes); return; }
  r[1] = 0;
  uint8_t newDay;
  if (r[2] & 0x40u) {
    /* 12-hour mode: 12 -> 1 -> ... -> 11 -> 12, AM/PM (bit 5) flips at 11 -> 12 */
    uint32_t hours = zxnextRtcFromBcd(r[2] & 0x1fu) + 1u;
    uint8_t pm = (r[2] & 0x20u) != 0u;
    newDay = 0;
    if (hours == 12u) {
      pm = !pm;
      newDay = !pm;
    } else if (hours > 12u) {
      hours = 1u;
    }
    r[2] = (uint8_t)(0x40u | (pm ? 0x20u : 0u) | zxnextRtcToBcd(hours));
  } else {
    uint32_t hours = zxnextRtcFromBcd(r[2] & 0x3fu) + 1u;
    newDay = hours >= 24u;
    r[2] = newDay ? 0u : zxnextRtcToBcd(hours);
  }
  if (!newDay) return;

  r[3] = (r[3] & 0x07u) >= 7u ? 1u : (uint8_t)((r[3] & 0x07u) + 1u);
  uint32_t year = zxnextRtcFromBcd(r[6]);
  uint32_t month = zxnextRtcFromBcd(r[5] & 0x1fu);
  static const uint8_t monthDays[12] = { 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31 };
  uint32_t days = (month >= 1u && month <= 12u) ? monthDays[month - 1u] : 31u;
  if (month == 2u && year % 4u == 0u) days = 29u; /* leap years to 2100 */
  uint32_t date = zxnextRtcFromBcd(r[4] & 0x3fu) + 1u;
  if (date <= days) { r[4] = zxnextRtcToBcd(date); return; }
  r[4] = 1;
  if (month < 12u) { r[5] = zxnextRtcToBcd(month + 1u); return; }
  r[5] = 1;
  r[6] = zxnextRtcToBcd((year + 1u) % 100u);
}

/* Brings the counter chain up to the machine's clock: one step per whole second elapsed */
static void zxnextRtcSync(void) {
  uint64_t now = zxnextClock28Now(&zxnextRtcClock);
  if (!zxnextRtcCountdownStarted || (zxnextRtcRegs[0] & 0x80u) != 0u) {
    /* The first use, or CH: the oscillator is stopped */
    zxnextRtcCountdownStart = now;
    zxnextRtcCountdownStarted = 1;
    return;
  }
  uint64_t seconds = (now - zxnextRtcCountdownStart) / ZXNEXT_CLOCK28_PER_SECOND;
  for (uint64_t i = 0; i < seconds; i++) zxnextRtcAdvanceOneSecond(zxnextRtcRegs);
  zxnextRtcCountdownStart += seconds * ZXNEXT_CLOCK28_PER_SECOND;
}

/* Time registers 0-6 as a clock set before (the battery keeps it); the second restarts now */
void zxnextRtcSetTime(uint32_t seconds, uint32_t minutes, uint32_t hours, uint32_t day, uint32_t date,
                      uint32_t month, uint32_t year) {
  zxnextRtcRegs[0] = (uint8_t)seconds;
  zxnextRtcRegs[1] = (uint8_t)minutes;
  zxnextRtcRegs[2] = (uint8_t)hours;
  zxnextRtcRegs[3] = (uint8_t)day;
  zxnextRtcRegs[4] = (uint8_t)date;
  zxnextRtcRegs[5] = (uint8_t)month;
  zxnextRtcRegs[6] = (uint8_t)year;
  zxnextRtcCountdownStart = zxnextClock28Now(&zxnextRtcClock);
  zxnextRtcCountdownStarted = 1;
}

/* A Next reset releases SCL and SDA (zxnext.vhd ~3232); the DS1307 keeps everything */
void zxnextI2cReset(void) {
  zxnextI2cSclOut = 1;
  zxnextI2cSdaOut = 1;
  zxnextI2cSdaSlave = 1;
  zxnextI2cPrevScl = 1;
  zxnextI2cPrevSda = 1;
  zxnextI2cState = ZXNEXT_I2C_IDLE;
  zxnextI2cAddressed = 0;
}

/* Time registers from the user buffer, the rest from RAM; the pointer wraps $3F -> $00 */
static uint8_t zxnextRtcReadRegister(void) {
  uint8_t p = zxnextRtcPointer;
  zxnextRtcPointer = (uint8_t)((p + 1u) & 0x3fu);
  return p < 7u ? zxnextRtcUser[p] : zxnextRtcRegs[p];
}

/* The first byte of a write sets the pointer; writing seconds restarts the second */
static void zxnextRtcWriteRegister(uint8_t data) {
  if (zxnextI2cFirstWrite) {
    zxnextRtcPointer = data & 0x3fu;
    zxnextI2cFirstWrite = 0;
    return;
  }
  uint8_t p = zxnextRtcPointer;
  zxnextRtcPointer = (uint8_t)((p + 1u) & 0x3fu);
  zxnextRtcSync();
  zxnextRtcRegs[p] = data;
  if (p < 7u) zxnextRtcUser[p] = data;
  if (p == 0u) zxnextRtcCountdownStart = zxnextClock28Now(&zxnextRtcClock);
}

/* SCL rising edge: the master's bit is valid (data, or its ACK/NACK) */
static void zxnextI2cSclRising(uint8_t sda) {
  switch (zxnextI2cState) {
    case ZXNEXT_I2C_ADDRESS:
      zxnextI2cShift = (uint8_t)((zxnextI2cShift << 1) | sda);
      if (++zxnextI2cBitCount == 8u) {
        zxnextI2cIsRead = zxnextI2cShift & 0x01u;
        zxnextI2cAddressed = (zxnextI2cShift >> 1) == ZXNEXT_DS1307_ADDRESS;
        zxnextI2cState = ZXNEXT_I2C_ADDRESS_ACK;
      }
      break;
    case ZXNEXT_I2C_ADDRESS_ACK:
      if (!zxnextI2cAddressed) {
        zxnextI2cState = ZXNEXT_I2C_IDLE;
      } else if (zxnextI2cIsRead) {
        zxnextI2cState = ZXNEXT_I2C_DATA_READ;
        zxnextI2cBitCount = 0;
        zxnextI2cShift = zxnextRtcReadRegister();
      } else {
        zxnextI2cState = ZXNEXT_I2C_DATA_WRITE;
        zxnextI2cBitCount = 0;
        zxnextI2cShift = 0;
        zxnextI2cFirstWrite = 1;
      }
      break;
    case ZXNEXT_I2C_DATA_WRITE:
      zxnextI2cShift = (uint8_t)((zxnextI2cShift << 1) | sda);
      if (++zxnextI2cBitCount == 8u) {
        zxnextRtcWriteRegister(zxnextI2cShift);
        zxnextI2cState = ZXNEXT_I2C_DATA_WRITE_ACK;
      }
      break;
    case ZXNEXT_I2C_DATA_WRITE_ACK:
      zxnextI2cState = ZXNEXT_I2C_DATA_WRITE;
      zxnextI2cBitCount = 0;
      zxnextI2cShift = 0;
      break;
    case ZXNEXT_I2C_DATA_READ:
      if (++zxnextI2cBitCount == 8u) zxnextI2cState = ZXNEXT_I2C_DATA_READ_ACK;
      break;
    case ZXNEXT_I2C_DATA_READ_ACK:
      if (!sda) {
        zxnextI2cState = ZXNEXT_I2C_DATA_READ;
        zxnextI2cBitCount = 0;
        zxnextI2cShift = zxnextRtcReadRegister();
      } else {
        zxnextI2cState = ZXNEXT_I2C_IDLE;
        zxnextI2cSdaSlave = 1;
      }
      break;
  }
}

/* SCL falling edge: the DS1307 drives SDA for its ACK or its next data bit */
static void zxnextI2cSclFalling(void) {
  switch (zxnextI2cState) {
    case ZXNEXT_I2C_ADDRESS_ACK: zxnextI2cSdaSlave = !zxnextI2cAddressed; break;
    case ZXNEXT_I2C_DATA_WRITE_ACK: zxnextI2cSdaSlave = 0; break;
    case ZXNEXT_I2C_DATA_READ: zxnextI2cSdaSlave = (zxnextI2cShift >> (7u - zxnextI2cBitCount)) & 0x01u; break;
    default: zxnextI2cSdaSlave = 1; break;
  }
}

static void zxnextI2cProcess(void) {
  uint8_t scl = zxnextI2cSclOut, sda = zxnextI2cSdaOut;
  uint8_t prevScl = zxnextI2cPrevScl, prevSda = zxnextI2cPrevSda;
  zxnextI2cPrevScl = scl;
  zxnextI2cPrevSda = sda;
  if (prevSda && !sda && scl && prevScl) {
    /* START (or repeated START): the user buffer follows the running registers */
    zxnextI2cState = ZXNEXT_I2C_ADDRESS;
    zxnextI2cBitCount = 0;
    zxnextI2cShift = 0;
    zxnextI2cAddressed = 0;
    zxnextI2cSdaSlave = 1;
    zxnextRtcSync();
    for (uint32_t i = 0; i < 7u; i++) zxnextRtcUser[i] = zxnextRtcRegs[i];
    return;
  }
  if (!prevSda && sda && scl && prevScl) {
    /* STOP */
    zxnextI2cState = ZXNEXT_I2C_IDLE;
    zxnextI2cAddressed = 0;
    zxnextI2cSdaSlave = 1;
    return;
  }
  if (scl && !prevScl) zxnextI2cSclRising(sda);
  if (!scl && prevScl) zxnextI2cSclFalling();
}

/* "1111111" & the SCL line: the DS1307 never stretches the clock */
uint32_t zxnextI2cReadSclPort(void) { return 0xfeu | (zxnextI2cSclOut ? 1u : 0u); }
/* "1111111" & the SDA line: low while the master or the DS1307 pulls it low */
uint32_t zxnextI2cReadSdaPort(void) { return 0xfeu | ((zxnextI2cSdaOut && zxnextI2cSdaSlave) ? 1u : 0u); }
void zxnextI2cWriteSclPort(uint32_t value) {
  zxnextI2cSclOut = (value & 0x01u) != 0;
  zxnextI2cProcess();
}
void zxnextI2cWriteSdaPort(uint32_t value) {
  zxnextI2cSdaOut = (value & 0x01u) != 0;
  zxnextI2cProcess();
}
