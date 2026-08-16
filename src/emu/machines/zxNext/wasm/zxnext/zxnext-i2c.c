#include "zxnext.h"

#define ZXNEXT_I2C_INVALID_PORT 0xffffffffu
#define ZXNEXT_I2C_STATE_IDLE 0u
#define ZXNEXT_I2C_STATE_ADDRESS 1u
#define ZXNEXT_I2C_STATE_ADDRESS_ACK 2u
#define ZXNEXT_I2C_STATE_DATA_WRITE 3u
#define ZXNEXT_I2C_STATE_DATA_WRITE_ACK 4u
#define ZXNEXT_I2C_STATE_DATA_READ 5u
#define ZXNEXT_I2C_STATE_DATA_READ_ACK 6u
#define ZXNEXT_I2C_DS1307_ADDRESS 0x68u

static uint8_t i2cToBcd(uint32_t value) {
  return (uint8_t)((((value / 10u) & 0x0fu) << 4u) | (value % 10u));
}

static uint32_t i2cFromBcd(uint32_t bcd) {
  return (((bcd >> 4u) & 0x0fu) * 10u) + (bcd & 0x0fu);
}

static void i2cInitDefaultCmos(void) {
  for (uint32_t i = 0u; i < 64u; i++) i2cCmos[i] = 0u;
  i2cCmos[0x00u] = 0x00u;
  i2cCmos[0x01u] = 0x00u;
  i2cCmos[0x02u] = 0x00u;
  i2cCmos[0x03u] = 0x01u;
  i2cCmos[0x04u] = 0x01u;
  i2cCmos[0x05u] = 0x01u;
  i2cCmos[0x06u] = 0x00u;
  i2cCmos[0x07u] = 0x00u;
}

static void resetI2cState(void) {
  i2cSclOut = 1u;
  i2cSdaOut = 1u;
  i2cSdaSlave = 1u;
  i2cPrevScl = 1u;
  i2cPrevSda = 1u;
  i2cState = ZXNEXT_I2C_STATE_IDLE;
  i2cShiftReg = 0u;
  i2cBitCount = 0u;
  i2cIsRead = 0u;
  i2cAddressed = 0u;
  i2cRegPointer = 0u;
  i2cFirstWrite = 1u;
  i2cFrameCounter = 0u;
  i2cFramesPerSecond = 50u;
  i2cClockAdvanceCount = 0u;
  i2cInitDefaultCmos();
}

static void i2cAdvanceDate(uint32_t dayOfWeek, uint32_t date, uint32_t month, uint32_t year) {
  dayOfWeek = dayOfWeek >= 7u ? 1u : dayOfWeek + 1u;
  i2cCmos[0x03u] = i2cToBcd(dayOfWeek);

  uint32_t daysInMonth = 31u;
  switch (month) {
    case 2u:
      daysInMonth = ((year % 4u) == 0u && ((year % 100u) != 0u || year == 0u)) ? 29u : 28u;
      break;
    case 4u:
    case 6u:
    case 9u:
    case 11u:
      daysInMonth = 30u;
      break;
    default:
      daysInMonth = 31u;
      break;
  }

  date++;
  if (date > daysInMonth) {
    date = 1u;
    month++;
    if (month > 12u) {
      month = 1u;
      year = (year + 1u) % 100u;
      i2cCmos[0x06u] = i2cToBcd(year);
    }
    i2cCmos[0x05u] = i2cToBcd(month);
  }
  i2cCmos[0x04u] = i2cToBcd(date);
}

void zxnextAdvanceI2cClock(void) {
  if ((i2cCmos[0x00u] & 0x80u) != 0u) return;

  uint32_t seconds = i2cFromBcd(i2cCmos[0x00u] & 0x7fu);
  uint32_t minutes = i2cFromBcd(i2cCmos[0x01u] & 0x7fu);
  const uint32_t is12Hour = (i2cCmos[0x02u] & 0x40u) != 0u;
  uint32_t hours = is12Hour != 0u ? i2cFromBcd(i2cCmos[0x02u] & 0x1fu) : i2cFromBcd(i2cCmos[0x02u] & 0x3fu);
  uint32_t isPm = (i2cCmos[0x02u] & 0x20u) != 0u;
  uint32_t dayOfWeek = i2cFromBcd(i2cCmos[0x03u] & 0x07u);
  uint32_t date = i2cFromBcd(i2cCmos[0x04u] & 0x3fu);
  uint32_t month = i2cFromBcd(i2cCmos[0x05u] & 0x1fu);
  uint32_t year = i2cFromBcd(i2cCmos[0x06u]);

  seconds++;
  if (seconds >= 60u) {
    seconds = 0u;
    minutes++;
    if (minutes >= 60u) {
      minutes = 0u;
      if (is12Hour != 0u) {
        hours++;
        if (hours == 12u) {
          isPm = isPm == 0u;
          if (isPm == 0u) {
            i2cAdvanceDate(dayOfWeek, date, month, year);
          }
        } else if (hours > 12u) {
          hours = 1u;
        }
        i2cCmos[0x02u] = (uint8_t)(0x40u | (isPm != 0u ? 0x20u : 0x00u) | i2cToBcd(hours));
      } else {
        hours++;
        if (hours >= 24u) {
          hours = 0u;
          i2cAdvanceDate(dayOfWeek, date, month, year);
        }
        i2cCmos[0x02u] = i2cToBcd(hours);
      }
    }
    i2cCmos[0x01u] = i2cToBcd(minutes);
  }
  i2cCmos[0x00u] = i2cToBcd(seconds);
  i2cClockAdvanceCount++;
}

static uint32_t i2cReadDs1307Register(void) {
  const uint32_t value = i2cCmos[i2cRegPointer & 0x3fu];
  i2cRegPointer = (uint8_t)((i2cRegPointer + 1u) & 0x3fu);
  return value;
}

static void i2cWriteDs1307Register(uint32_t value) {
  if (i2cFirstWrite != 0u) {
    i2cRegPointer = (uint8_t)(value & 0x3fu);
    i2cFirstWrite = 0u;
  } else {
    i2cCmos[i2cRegPointer & 0x3fu] = (uint8_t)(value & 0xffu);
    i2cRegPointer = (uint8_t)((i2cRegPointer + 1u) & 0x3fu);
  }
}

static void i2cOnSclRisingEdge(uint32_t sda) {
  switch (i2cState) {
    case ZXNEXT_I2C_STATE_ADDRESS:
      i2cShiftReg = (uint8_t)(((i2cShiftReg << 1u) | (sda != 0u ? 1u : 0u)) & 0xffu);
      i2cBitCount++;
      if (i2cBitCount == 8u) {
        const uint32_t address = (i2cShiftReg >> 1u) & 0x7fu;
        i2cIsRead = i2cShiftReg & 0x01u;
        i2cAddressed = address == ZXNEXT_I2C_DS1307_ADDRESS;
        i2cState = ZXNEXT_I2C_STATE_ADDRESS_ACK;
      }
      break;
    case ZXNEXT_I2C_STATE_ADDRESS_ACK:
      if (i2cAddressed != 0u) {
        if (i2cIsRead != 0u) {
          i2cState = ZXNEXT_I2C_STATE_DATA_READ;
          i2cBitCount = 0u;
          i2cShiftReg = (uint8_t)i2cReadDs1307Register();
        } else {
          i2cState = ZXNEXT_I2C_STATE_DATA_WRITE;
          i2cBitCount = 0u;
          i2cShiftReg = 0u;
          i2cFirstWrite = 1u;
        }
      } else {
        i2cState = ZXNEXT_I2C_STATE_IDLE;
      }
      break;
    case ZXNEXT_I2C_STATE_DATA_WRITE:
      i2cShiftReg = (uint8_t)(((i2cShiftReg << 1u) | (sda != 0u ? 1u : 0u)) & 0xffu);
      i2cBitCount++;
      if (i2cBitCount == 8u) {
        i2cWriteDs1307Register(i2cShiftReg);
        i2cState = ZXNEXT_I2C_STATE_DATA_WRITE_ACK;
      }
      break;
    case ZXNEXT_I2C_STATE_DATA_WRITE_ACK:
      i2cState = ZXNEXT_I2C_STATE_DATA_WRITE;
      i2cBitCount = 0u;
      i2cShiftReg = 0u;
      break;
    case ZXNEXT_I2C_STATE_DATA_READ:
      i2cBitCount++;
      if (i2cBitCount == 8u) i2cState = ZXNEXT_I2C_STATE_DATA_READ_ACK;
      break;
    case ZXNEXT_I2C_STATE_DATA_READ_ACK:
      if (sda == 0u) {
        i2cState = ZXNEXT_I2C_STATE_DATA_READ;
        i2cBitCount = 0u;
        i2cShiftReg = (uint8_t)i2cReadDs1307Register();
      } else {
        i2cState = ZXNEXT_I2C_STATE_IDLE;
        i2cSdaSlave = 1u;
      }
      break;
    default:
      break;
  }
}

static void i2cOnSclFallingEdge(void) {
  switch (i2cState) {
    case ZXNEXT_I2C_STATE_ADDRESS_ACK:
      i2cSdaSlave = i2cAddressed == 0u;
      break;
    case ZXNEXT_I2C_STATE_DATA_WRITE_ACK:
      i2cSdaSlave = 0u;
      break;
    case ZXNEXT_I2C_STATE_DATA_READ:
      i2cSdaSlave = ((i2cShiftReg >> (7u - i2cBitCount)) & 0x01u) != 0u;
      break;
    case ZXNEXT_I2C_STATE_DATA_READ_ACK:
      i2cSdaSlave = 1u;
      break;
    default:
      i2cSdaSlave = 1u;
      break;
  }
}

static void i2cProcess(void) {
  const uint8_t scl = i2cSclOut;
  const uint8_t sda = i2cSdaOut;
  const uint8_t prevScl = i2cPrevScl;
  const uint8_t prevSda = i2cPrevSda;

  if (prevSda != 0u && sda == 0u && scl != 0u) {
    i2cState = ZXNEXT_I2C_STATE_ADDRESS;
    i2cBitCount = 0u;
    i2cShiftReg = 0u;
    i2cAddressed = 0u;
    i2cSdaSlave = 1u;
    i2cPrevScl = scl;
    i2cPrevSda = sda;
    return;
  }

  if (prevSda == 0u && sda != 0u && scl != 0u) {
    i2cState = ZXNEXT_I2C_STATE_IDLE;
    i2cAddressed = 0u;
    i2cSdaSlave = 1u;
    i2cPrevScl = scl;
    i2cPrevSda = sda;
    return;
  }

  if (scl != 0u && prevScl == 0u) i2cOnSclRisingEdge(sda);
  if (scl == 0u && prevScl != 0u) i2cOnSclFallingEdge();

  i2cPrevScl = scl;
  i2cPrevSda = sda;
}

static uint32_t zxnextReadI2cPort(uint32_t address) {
  const uint16_t port = (uint16_t)(address & 0xffffu);
  if (port != 0x103bu && port != 0x113bu) return ZXNEXT_I2C_INVALID_PORT;
  if (isPortGroupEnabled(1u, 2u) == 0u) return 0xffu;
  if (port == 0x103bu) return 0xfeu | (i2cSclOut != 0u ? 1u : 0u);
  return 0xfeu | ((i2cSdaOut != 0u && i2cSdaSlave != 0u) ? 1u : 0u);
}

static uint32_t zxnextWriteI2cPort(uint32_t address, uint32_t value) {
  const uint16_t port = (uint16_t)(address & 0xffffu);
  if (port != 0x103bu && port != 0x113bu) return 0u;
  if (isPortGroupEnabled(1u, 2u) == 0u) return 1u;
  if (port == 0x103bu) {
    i2cSclOut = (value & 0x01u) != 0u;
  } else {
    i2cSdaOut = (value & 0x01u) != 0u;
  }
  i2cProcess();
  return 1u;
}

void zxnextI2cOnNewFrame(void) {
  i2cFrameCounter++;
  if (i2cFrameCounter >= i2cFramesPerSecond) {
    i2cFrameCounter = 0u;
    zxnextAdvanceI2cClock();
  }
}

void zxnextSetI2cCmosByte(uint32_t index, uint32_t value) {
  i2cCmos[index & 0x3fu] = (uint8_t)(value & 0xffu);
}
uint32_t zxnextGetI2cCmosByte(uint32_t index) { return i2cCmos[index & 0x3fu]; }
void zxnextSetI2cFrameRate(uint32_t framesPerSecond) {
  i2cFramesPerSecond = framesPerSecond == 0u ? 50u : framesPerSecond;
}
uint32_t zxnextGetI2cSclOut(void) { return i2cSclOut; }
uint32_t zxnextGetI2cSdaOut(void) { return i2cSdaOut; }
uint32_t zxnextGetI2cSdaLine(void) { return i2cSdaOut != 0u && i2cSdaSlave != 0u; }
uint32_t zxnextGetI2cState(void) { return i2cState; }
uint32_t zxnextGetI2cRegPointer(void) { return i2cRegPointer; }
uint32_t zxnextGetI2cFrameCounter(void) { return i2cFrameCounter; }
uint32_t zxnextGetI2cFramesPerSecond(void) { return i2cFramesPerSecond; }
uint32_t zxnextGetI2cClockAdvanceCount(void) { return i2cClockAdvanceCount; }
